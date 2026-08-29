// @ts-check
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { AgentFaiClientError } = require("../lib/agent/client-error.js");
const { KNOWLEDGE_PATH, buildResult, executeOffline, loadKnowledge, parseOfflineArgs, searchPlays, validateOfflineResult } = require("../lib/agent/offline-host.js");

const observedNow = () => Date.parse("2026-08-13T12:00:00.000Z");

function exactTupleArrayMatches(schema, property, values) {
  const tuple = schema.properties[property]?.properties?.inputs || schema.properties[property];
  if (!tuple || tuple.items !== false || tuple.minItems !== tuple.maxItems || tuple.prefixItems.length !== values.length) return false;
  return tuple.prefixItems.every((entry, index) => {
    const definition = schema.$defs[entry.$ref.split("/").at(-1)]; const candidate = values[index];
    const base = definition?.$ref ? schema.$defs[definition.$ref.split("/").at(-1)] : {};
    const required = definition?.required || base.required; const properties = { ...(base.properties || {}), ...(definition?.properties || {}) };
    if (!definition || !candidate || (definition.additionalProperties ?? base.additionalProperties) !== false || !required || JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify([...required].sort())) return false;
    return Object.entries(properties).every(([key, constraint]) => constraint === true || constraint.const === undefined || candidate[key] === constraint.const);
  });
}

test("offline grammar requires explicit profile and bounded supported formats", () => {
  assert.deepEqual(parseOfflineArgs(["--offline"]), { command: "report", format: "text", query: null });
  assert.deepEqual(parseOfflineArgs(["ask", "precision", "agriculture", "--offline", "--format", "json"]), { command: "ask", format: "json", query: "precision agriculture" });
  assert.deepEqual(parseOfflineArgs(["ask", "--offline", "--", "--confirm-external"]), { command: "ask", format: "text", query: "--confirm-external" });
  for (const args of [[], ["--offline", "--offline"], ["ask", "hello"], ["run", "--offline"], ["ask", "--offline"], ["--offline", "extra"], ["ask", "hello", "--offline", "--format", "jsonl"], ["ask", "hello", "--offline", "--deadline", "1000"]]) assert.throws(() => parseOfflineArgs(args), (error) => error instanceof AgentFaiClientError && error.code === "invalid_argument");
  assert.throws(() => parseOfflineArgs(["--offline", "--format", "json", "--format", "text"]), (error) => error.code === "invalid_argument");
});

test("offline knowledge validates exact plays, schemas, source, and conservative UAF status", () => {
  const loaded = loadKnowledge();
  assert.equal(loaded.value.plays.length, 100);
  assert.deepEqual(loaded.value.plays[77], { id: "78", name: "Precision Agriculture Agent", services: ["IoT Hub", "AI Vision", "OpenAI", "Digital Twins", "ML"], pattern: "precision agriculture satellite imagery IoT sensor crop health irrigation fertilization yield prediction digital twin farmland", complexity: "Very High" });
  assert.equal(loaded.value.schemas.length, 4);
  assert.deepEqual({ status: loaded.value.uafCompatibility.capabilityStatus, readiness: loaded.value.uafCompatibility.profileReadiness, supported: loaded.value.uafCompatibility.supportedCapabilities }, { status: "Degraded", readiness: "Designed", supported: 0 });
  assert.match(loaded.digest, /^[0-9a-f]{64}$/u);
});

test("precision agriculture deterministically ranks Play 78 first", () => {
  const knowledge = loadKnowledge().value;
  const first = searchPlays(knowledge.plays, "precision agriculture satellite crop health");
  const second = searchPlays(knowledge.plays, "precision agriculture satellite crop health");
  assert.deepEqual(first, second);
  assert.equal(first[0].id, "78");
  assert.equal(first[0].name, "Precision Agriculture Agent");
  assert.equal(first[0].evidence, "packaged-public-play-index");
});

test("offline result labels profile, freshness, zero network, and unavailable live capabilities", () => {
  const parsed = parseOfflineArgs(["ask", "precision agriculture", "--offline", "--format", "json"]);
  const result = buildResult(parsed, { now: observedNow });
  assert.equal(result.profile, "offline");
  assert.equal(result.knowledge.observedDate, "2026-08-13");
  assert.equal(result.knowledge.ageDays, 16);
  assert.equal(result.knowledge.freshness, "current");
  assert.equal(result.capabilities.networkAttempts, 0);
  assert.equal(result.capabilities.uafStatus, "Degraded");
  assert.equal(result.capabilities.profileReadiness, "Designed");
  assert.equal(result.provenance.authorityState, "local-approved-uncommitted");
  assert.deepEqual(result.provenance.inputs.map((entry) => entry.task), ["UAF-T019", "UAF-T021", "UAF-T022"]);
  for (const capability of ["live-model-judgment", "current-cloud-state", "current-pricing", "profile-readiness", "successful-remote-validation"]) assert.equal(result.capabilities.unavailable.includes(capability), true, capability);
  assert.equal(result.matches[0].id, "78");
});

test("offline output is deterministic for one observation date and exposes limitations", async () => {
  const args = ["ask", "precision agriculture", "--offline", "--format", "json"];
  const first = await executeOffline(args, { now: observedNow });
  const second = await executeOffline(args, { now: observedNow });
  assert.deepEqual(first, second);
  assert.equal(first.exitCode, 0);
  const document = JSON.parse(first.output);
  assert.equal(document.matches[0].id, "78");
  assert.equal(document.prohibitedClaims.includes("current-pricing"), true);
  assert.equal(first.error, "");
  const text = await executeOffline(["--offline"], { now: observedNow });
  assert.match(text.output, /^Profile: offline$/mu);
  assert.match(text.output, /Network attempts: 0/u);
  assert.match(text.output, /current-pricing/u);
  assert.match(text.output, /UAF authority: local-approved-uncommitted/u);
  assert.match(text.output, /UAF-T019: packageSha256=/u);
});

test("freshness becomes stale without refreshing or changing profile", () => {
  const result = buildResult(parseOfflineArgs(["--offline"]), { now: () => Date.parse("2026-10-01T00:00:00.000Z") });
  assert.equal(result.profile, "offline");
  assert.equal(result.knowledge.freshness, "stale");
  assert.equal(result.matches.length, 0);
  assert.equal(result.capabilities.networkAttempts, 0);
});

test("knowledge or packaged schema tampering fails closed", () => {
  const bytes = fs.readFileSync(KNOWLEDGE_PATH);
  const candidate = JSON.parse(bytes.toString("utf8"));
  candidate.plays[77].name = "Spoofed";
  assert.throws(() => loadKnowledge({ knowledgeBytes: Buffer.from(JSON.stringify(candidate)) }), (error) => error.code === "integrity_failed");
  const sourceSpoof = JSON.parse(bytes.toString("utf8")); sourceSpoof.source.commit = "0".repeat(40);
  assert.throws(() => loadKnowledge({ knowledgeBytes: Buffer.from(JSON.stringify(sourceSpoof)) }), (error) => error.code === "integrity_failed");
  const duplicateSchema = JSON.parse(bytes.toString("utf8")); duplicateSchema.schemas[1] = structuredClone(duplicateSchema.schemas[0]);
  assert.throws(() => loadKnowledge({ knowledgeBytes: Buffer.from(JSON.stringify(duplicateSchema)) }), (error) => error.code === "integrity_failed");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-fai-offline-schema-"));
  try {
    fs.cpSync(path.resolve(__dirname, ".."), root, { recursive: true });
    fs.appendFileSync(path.join(root, "commands", "agent", "render-result.v1.schema.json"), " ");
    assert.throws(() => loadKnowledge({ knowledgeBytes: bytes, cliRoot: root }), (error) => error.code === "integrity_failed");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("offline dispatch imports and executes with all network modules denied", () => {
  const script = String.raw`
    const Module = require('node:module');
    const denied = new Set(['node:http','http','node:https','https','node:http2','http2','node:net','net','node:tls','tls','node:dns','dns','node:dgram','dgram','undici','node:child_process','child_process','node:worker_threads','worker_threads','node:cluster','cluster']);
    const original = Module._load;
    Module._load = function(request, parent, isMain) { if (denied.has(request)) throw new Error('network import:'+request); return original.call(this, request, parent, isMain); };
    globalThis.fetch = () => { throw new Error('fetch attempted'); };
    const { runAgent } = require('./lib/agent/dispatch.js');
    runAgent(['ask','precision agriculture','--offline','--format','json'], { now: () => Date.parse('2026-08-13T12:00:00.000Z') }).then((result) => {
      const document = JSON.parse(result.output);
      if (result.exitCode !== 0 || document.matches[0].id !== '78' || document.capabilities.networkAttempts !== 0) process.exitCode = 1;
      else process.stdout.write('offline-zero-network-pass');
    }, () => { process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ["-e", script], { cwd: path.resolve(__dirname, ".."), encoding: "utf8", env: { PATH: process.env.PATH } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "offline-zero-network-pass");
});

test("all installed aliases route offline before denied broad imports", { timeout: 120000 }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-fai-offline-install-"));
  try {
    const cliRoot = path.resolve(__dirname, ".."); const packDir = path.join(root, "pack"); const installDir = path.join(root, "install"); fs.mkdirSync(packDir);
    const npm = process.platform === "win32" ? process.execPath : "npm";
    const prefix = process.platform === "win32" ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")] : [];
    const baseEnv = { ...process.env, npm_config_cache: path.join(root, "cache"), npm_config_offline: "true", npm_config_audit: "false", npm_config_fund: "false", npm_config_update_notifier: "false" };
    const packed = spawnSync(npm, [...prefix, "pack", cliRoot, "--ignore-scripts", "--offline", "--json", "--pack-destination", packDir], { encoding: "utf8", env: baseEnv });
    assert.equal(packed.status, 0, packed.stderr);
    const tarball = path.join(packDir, JSON.parse(packed.stdout)[0].filename);
    const installed = spawnSync(npm, [...prefix, "install", "--ignore-scripts", "--offline", "--no-audit", "--no-fund", "--prefix", installDir, tarball], { encoding: "utf8", env: baseEnv });
    assert.equal(installed.status, 0, installed.stderr);
    const preload = path.join(root, "deny-network.cjs");
    fs.writeFileSync(preload, `const Module=require('node:module');const denied=new Set(['node:http','http','node:https','https','node:http2','http2','node:net','net','node:tls','tls','node:dns','dns','node:dgram','dgram','undici','node:child_process','child_process','node:worker_threads','worker_threads','node:cluster','cluster']);const original=Module._load;Module._load=function(request,parent,isMain){if(denied.has(request))throw new Error('denied:'+request);return original.call(this,request,parent,isMain)};globalThis.fetch=()=>{throw new Error('fetch attempted')};`, "utf8");
    const shimRoot = path.join(installDir, "node_modules", ".bin"); const results = [];
    for (const name of ["frootai", "fai", "agent-fai"]) {
      const shim = path.join(shimRoot, name + (process.platform === "win32" ? ".cmd" : ""));
      const args = name === "agent-fai" ? ["ask", "precision agriculture", "--offline", "--format", "json"] : ["agent", "ask", "precision agriculture", "--offline", "--format", "json"];
      const command = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : shim;
      const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", shim, ...args] : args;
      const result = spawnSync(command, commandArgs, { cwd: root, encoding: "utf8", windowsHide: true, env: { PATH: process.env.PATH, NODE_OPTIONS: `--require=${preload}` } });
      assert.equal(result.status, 0, `${name}: ${result.stderr}`);
      const document = JSON.parse(result.stdout); assert.equal(document.profile, "offline"); assert.equal(document.matches[0].id, "78"); assert.equal(document.capabilities.networkAttempts, 0); results.push(result.stdout);
    }
    assert.equal(new Set(results).size, 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("online failure never silently switches to offline", async () => {
  const { runAgent } = require("../lib/agent/dispatch.js");
  const result = await runAgent(["ask", "precision agriculture"], { config: { agent: { defaultFormat: "text", color: "never", unicode: "always", requestTimeoutMs: 1000, reconnects: 0, retentionDays: 30 } }, protocolClient: { createSession: async () => { throw new AgentFaiClientError("service_unavailable"); } }, signalEmitter: new EventEmitter(), env: {} });
  assert.equal(result.exitCode, 69);
  assert.doesNotMatch(result.output + result.error, /Profile: offline|Play 78/u);
});

test("T020 source authority pins play source and conservative local UAF limitations", () => {
  const { manifest, validateAuthorityManifest } = require("../commands/agent/source-authority-t020.js");
  assert.equal(validateAuthorityManifest(manifest), manifest);
  assert.equal(manifest.constraints.precisionAgriculturePlayId, "78");
  assert.equal(manifest.constraints.networkAttempts, 0);
  assert.equal(manifest.constraints.supportedCapabilities, 0);
  for (const mutate of [(value) => { value.unknown = true; }, (value) => { value.authorities[0].commit = "0".repeat(40); }, (value) => { value.sources[0].gitBlobOid = "0".repeat(40); }, (value) => { value.localLimitationInputs[0].packageSha256 = "0".repeat(64); }, (value) => { value.constraints.networkAttempts = 1; }, (value) => { value.constraints.capabilityStatus = "Supported"; }, (value) => { value.constraints.silentFallback = true; }]) { const candidate = structuredClone(manifest); mutate(candidate); assert.throws(() => validateAuthorityManifest(candidate, false)); }
});

test("offline result validation rejects capability, network, limitation, and pricing-shaped drift", () => {
  const original = buildResult(parseOfflineArgs(["--offline"]), { now: observedNow });
  for (const mutate of [
    (value) => { value.capabilities.networkAttempts = 1; },
    (value) => { value.capabilities.uafStatus = "Supported"; },
    (value) => { value.limitations.pop(); },
    (value) => { value.prohibitedClaims = []; },
    (value) => { value.currentPrice = 10; },
    (value) => { value.matches = [{ id: "78", name: "Precision Agriculture Agent", score: 100, complexity: null, evidence: "packaged-public-play-index" }]; },
    (value) => { value.provenance.authorityState = "committed"; },
  ]) { const candidate = structuredClone(original); mutate(candidate); assert.throws(() => validateOfflineResult(candidate), (error) => error.code === "integrity_failed"); }
});

test("dispatch distinguishes offline flags from literal prompt content", async () => {
  const { requestsOffline, runAgent } = require("../lib/agent/dispatch.js");
  assert.equal(requestsOffline(["ask", "precision agriculture", "--offline"]), true);
  assert.equal(requestsOffline(["ask", "--", "--offline"]), false);
  assert.equal(requestsOffline(["run", "--prompt", "--offline"]), false);
  const client = { createSession: async () => { throw new AgentFaiClientError("service_unavailable"); } };
  const common = { config: { agent: { defaultFormat: "text", color: "never", unicode: "always", requestTimeoutMs: 1000, reconnects: 0, retentionDays: 30 } }, protocolClient: client, signalEmitter: new EventEmitter(), env: {} };
  const positional = await runAgent(["ask", "--", "--offline"], common);
  const optionValue = await runAgent(["run", "--prompt", "--offline"], common);
  assert.equal(positional.exitCode, 69);
  assert.equal(optionValue.exitCode, 69);
  assert.doesNotMatch(positional.output + positional.error + optionValue.output + optionValue.error, /Profile: offline/u);
});

test("offline result JSON Schema rejects duplicate or forged provenance and schema tuples", () => {
  const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../commands/agent/offline-result.v1.schema.json"), "utf8"));
  const result = buildResult(parseOfflineArgs(["--offline"]), { now: observedNow });
  assert.equal(exactTupleArrayMatches(schema, "provenance", result.provenance.inputs), true);
  assert.equal(exactTupleArrayMatches(schema, "schemas", result.schemas), true);
  const duplicateProvenance = structuredClone(result.provenance.inputs); duplicateProvenance[1] = structuredClone(duplicateProvenance[0]);
  const forgedProvenance = structuredClone(result.provenance.inputs); forgedProvenance[2].sourceSha256 = "0".repeat(64);
  const duplicateSchemas = structuredClone(result.schemas); duplicateSchemas[1] = structuredClone(duplicateSchemas[0]);
  const forgedSchemas = structuredClone(result.schemas); forgedSchemas[3].sha256 = "0".repeat(64);
  assert.equal(exactTupleArrayMatches(schema, "provenance", duplicateProvenance), false);
  assert.equal(exactTupleArrayMatches(schema, "provenance", forgedProvenance), false);
  assert.equal(exactTupleArrayMatches(schema, "schemas", duplicateSchemas), false);
  assert.equal(exactTupleArrayMatches(schema, "schemas", forgedSchemas), false);
});

test("offline asset and packaged schemas validate identically with LF or CRLF", () => {
  const bytes = fs.readFileSync(KNOWLEDGE_PATH);
  const crlf = Buffer.from(bytes.toString("utf8").replace(/(?<!\r)\n/gu, "\r\n"), "utf8");
  assert.equal(loadKnowledge({ knowledgeBytes: bytes }).digest, loadKnowledge({ knowledgeBytes: crlf }).digest);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-fai-offline-crlf-"));
  try {
    fs.cpSync(path.resolve(__dirname, ".."), root, { recursive: true });
    for (const relative of ["commands/agent/agent-fai-v1.openapi.json", "commands/agent/render-result.v1.schema.json", "lib/agent/contracts/manifest.v1.json", "commands/agent/offline-knowledge.v1.schema.json", "lib/agent/offline-authority/uaf-t019-limitations.v1.json", "lib/agent/offline-authority/uaf-t021-limitations.v1.json", "lib/agent/offline-authority/uaf-t022-limitations.v1.json"]) {
      const file = path.join(root, relative); const content = fs.readFileSync(file, "utf8").replace(/(?<!\r)\n/gu, "\r\n"); fs.writeFileSync(file, content, "utf8");
    }
    assert.equal(loadKnowledge({ knowledgeBytes: crlf, cliRoot: root }).digest, loadKnowledge().digest);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});