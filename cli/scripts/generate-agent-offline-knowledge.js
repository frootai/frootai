#!/usr/bin/env node
// @ts-check
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

const CLI_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(CLI_ROOT, "..");
const OUTPUT_PATH = path.join(CLI_ROOT, "lib", "agent", "offline-knowledge.generated.json");
const EXPECTED_SOURCE_SHA256 = "d82734acd7562a3db4af13acf050028de69d7ad2ce9afc83a218d2baae1ce54b";
const SOURCE = Object.freeze({ repository: "https://github.com/frootai/frootai-core.git", commit: "018931c2fffbe4eb2d3c5a3e86f2041c50fe872d", tree: "1ecd43c8de1cddafe06c5b4b489119e244ffa40b", path: "npm-mcp/index.js", gitBlobOid: "2c0696c2493271839e66abd3778a6bd3908aefc0", sha256: EXPECTED_SOURCE_SHA256, sourceUpdatedAt: "2026-07-28T14:03:13.000Z" });
const UAF_SNAPSHOTS = Object.freeze([
  ["UAF-T019", "lib/agent/offline-authority/uaf-t019-limitations.v1.json"],
  ["UAF-T021", "lib/agent/offline-authority/uaf-t021-limitations.v1.json"],
  ["UAF-T022", "lib/agent/offline-authority/uaf-t022-limitations.v1.json"],
]);
const SCHEMAS = Object.freeze([
  ["agent-fai-openapi.v1", "commands/agent/agent-fai-v1.openapi.json"],
  ["agent-fai-render-result.v1", "commands/agent/render-result.v1.schema.json"],
  ["agent-fai-generated-contracts.v1", "lib/agent/contracts/manifest.v1.json"],
  ["agent-fai-offline-knowledge.v1", "commands/agent/offline-knowledge.v1.schema.json"],
]);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const canonicalTextSha256 = (value) => sha256(Buffer.from(Buffer.from(value).toString("utf8").replace(/\r\n/gu, "\n"), "utf8"));
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

function extractPlayData(source) {
  if (sha256(source) !== EXPECTED_SOURCE_SHA256) throw new Error("offline knowledge source digest mismatch");
  source = Buffer.isBuffer(source) ? source.toString("utf8") : String(source);
  source = source.replace(/\r\n/gu, "\n");
  const startMarker = "  const PLAY_DATA = [";
  const endMarker = "\n  ];\n\n  const PRICING = {";
  const start = source.indexOf(startMarker); const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || source.indexOf(startMarker, start + 1) >= 0 || source.indexOf(endMarker, end + 1) >= 0) throw new Error("PLAY_DATA source boundary is not unique");
  const literal = source.slice(start + "  const PLAY_DATA = ".length, end + 4);
  const script = new vm.Script(`(${literal})`, { filename: "pinned-play-data.literal.js" });
  const value = script.runInNewContext(Object.create(null), { timeout: 100, codeGeneration: { strings: false, wasm: false } });
  return JSON.parse(JSON.stringify(value));
}

function readPinnedSource() {
  const commit = execFileSync("git", ["-C", REPO_ROOT, "rev-parse", `${SOURCE.commit}^{commit}`], { encoding: "utf8" }).trim();
  const tree = execFileSync("git", ["-C", REPO_ROOT, "rev-parse", `${SOURCE.commit}^{tree}`], { encoding: "utf8" }).trim();
  const blob = execFileSync("git", ["-C", REPO_ROOT, "rev-parse", `${SOURCE.commit}:${SOURCE.path}`], { encoding: "utf8" }).trim();
  if (commit !== SOURCE.commit || tree !== SOURCE.tree || blob !== SOURCE.gitBlobOid) throw new Error("offline knowledge Git authority mismatch");
  const bytes = execFileSync("git", ["-C", REPO_ROOT, "cat-file", "blob", SOURCE.gitBlobOid]);
  if (sha256(bytes) !== EXPECTED_SOURCE_SHA256) throw new Error("offline knowledge Git blob digest mismatch");
  return bytes;
}

function validatePlays(plays) {
  if (!Array.isArray(plays) || plays.length !== 100) throw new Error("offline play cardinality must be 100");
  for (let index = 0; index < plays.length; index += 1) {
    const play = plays[index]; const id = String(index + 1).padStart(2, "0");
    if (!plain(play) || Object.keys(play).sort().join("|") !== "cx|id|name|pattern|services" || play.id !== id || typeof play.name !== "string" || play.name.length < 1 || play.name.length > 128 || CONTROL.test(play.name) || !Array.isArray(play.services) || play.services.length < 1 || play.services.length > 16 || new Set(play.services).size !== play.services.length || play.services.some((item) => typeof item !== "string" || item.length < 1 || item.length > 128 || CONTROL.test(item)) || typeof play.pattern !== "string" || play.pattern.length < 3 || play.pattern.length > 1024 || CONTROL.test(play.pattern) || !["Low", "Medium", "High", "Very High", "Foundation"].includes(play.cx)) throw new Error(`invalid offline play ${id}`);
  }
  const play78 = plays[77];
  if (play78.name !== "Precision Agriculture Agent" || !play78.pattern.includes("precision agriculture")) throw new Error("Play 78 authority mismatch");
  return plays.map((play) => ({ id: play.id, name: play.name, services: play.services, pattern: play.pattern, complexity: play.cx }));
}

function loadUafInputs() {
  return UAF_SNAPSHOTS.map(([task, packagePath]) => {
    const file = path.join(CLI_ROOT, packagePath); const bytes = fs.readFileSync(file); const snapshot = JSON.parse(bytes.toString("utf8"));
    if (!plain(snapshot) || Object.keys(snapshot).sort().join("|") !== "authorityState|claims|schemaVersion|source|task" || snapshot.schemaVersion !== "agent-fai-offline-uaf-limitation.v1" || snapshot.task !== task || snapshot.authorityState !== "local-approved-uncommitted" || !plain(snapshot.source) || Object.keys(snapshot.source).sort().join("|") !== "path|sha256" || !/^planning\/unified-ai-fabric-foundation\/uaf-t0(?:19|21|22)-contract-artifact\.v1\.json$/u.test(snapshot.source.path) || !/^[0-9a-f]{64}$/u.test(snapshot.source.sha256) || !plain(snapshot.claims)) throw new Error(`${task} packaged limitation snapshot mismatch`);
    if (task === "UAF-T019" && JSON.stringify(snapshot.claims) !== JSON.stringify({ offlineAdapters: 7, adapterStatus: "Degraded", capabilityStatus: "Degraded", profileReadiness: "Designed", evidenceRefs: [], readinessPromoted: false })) throw new Error("UAF-T019 limitation claims mismatch");
    if (task === "UAF-T021" && JSON.stringify(snapshot.claims) !== JSON.stringify({ adapterCandidatesPassed: 15, offlineNetworkConformance: "isolated-child-process-denial", sourceCatalogStatus: "Designed", capabilityStatus: "Degraded", profileReadiness: "Designed", readinessPromoted: false })) throw new Error("UAF-T021 limitation claims mismatch");
    if (task === "UAF-T022" && JSON.stringify(snapshot.claims) !== JSON.stringify({ supportedCapabilities: 0, emulatedCapabilities: 0, degradedCapabilities: 15, unsupportedCapabilities: 15, profileReadiness: "Designed", readinessPromoted: false })) throw new Error("UAF-T022 limitation claims mismatch");
    return { task, packagePath, packageSha256: canonicalTextSha256(bytes), sourcePath: snapshot.source.path, sourceSha256: snapshot.source.sha256, authorityState: snapshot.authorityState };
  });
}

function generate() {
  const sourceBytes = readPinnedSource();
  const plays = validatePlays(extractPlayData(sourceBytes));
  const schemas = SCHEMAS.map(([id, relative]) => ({ id, path: relative, sha256: canonicalTextSha256(fs.readFileSync(path.join(CLI_ROOT, relative))) }));
  const knowledge = {
    schemaVersion: "agent-fai-offline-knowledge.v1", profile: "offline", source: SOURCE,
    freshnessPolicy: { maximumAgeDays: 30, staleBehavior: "label-stale-never-refresh-or-fallback-silently" },
    uafCompatibility: { offlineAdapters: 7, adapterStatus: "Degraded", capabilityStatus: "Degraded", profileReadiness: "Designed", supportedCapabilities: 0, readinessPromoted: false, sourceInputs: loadUafInputs() },
    schemas, plays,
  };
  return `${JSON.stringify(knowledge, null, 2)}\n`;
}

function main(argv = process.argv.slice(2)) {
  const output = generate();
  if (argv.includes("--write")) { fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true }); fs.writeFileSync(OUTPUT_PATH, output, "utf8"); return 0; }
  if (argv.includes("--check")) { if (!fs.existsSync(OUTPUT_PATH) || fs.readFileSync(OUTPUT_PATH, "utf8") !== output) { process.stderr.write("Agent FAI offline knowledge drift detected; run generate:agent-offline.\n"); return 1; } return 0; }
  process.stdout.write(output); return 0;
}

if (require.main === module) process.exitCode = main();
module.exports = { OUTPUT_PATH, SOURCE, UAF_SNAPSHOTS, extractPlayData, generate, loadUafInputs, main, readPinnedSource, validatePlays };