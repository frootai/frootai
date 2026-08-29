// @ts-check
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { AgentFaiClientError } = require("./client-error.js");
const { canonicalJson } = require("./semantic-runtime.generated.js");
const { parseStrictJson } = require("./strict-json.js");

const KNOWLEDGE_PATH = path.join(__dirname, "offline-knowledge.generated.json");
const EXPECTED_KNOWLEDGE_SHA256 = "e8b82bdc2c102b19efa82a1333e20ecc95d5b4482d2c1e090423e8e0fd380c55";
const EXPECTED_SOURCE = Object.freeze({ repository: "https://github.com/frootai/frootai-core.git", commit: "018931c2fffbe4eb2d3c5a3e86f2041c50fe872d", tree: "1ecd43c8de1cddafe06c5b4b489119e244ffa40b", path: "npm-mcp/index.js", gitBlobOid: "2c0696c2493271839e66abd3778a6bd3908aefc0", sha256: "d82734acd7562a3db4af13acf050028de69d7ad2ce9afc83a218d2baae1ce54b", sourceUpdatedAt: "2026-07-28T14:03:13.000Z" });
const FORMATS = new Set(["text", "markdown", "json"]);
const AVAILABLE = Object.freeze(["packaged-solution-play-discovery", "packaged-schema-inventory", "deterministic-capability-report"]);
const UNAVAILABLE = Object.freeze(["live-agent-fai", "live-model-judgment", "current-cloud-state", "current-pricing", "profile-readiness", "successful-remote-validation", "network-backed-grounding", "authentication", "mcp", "telemetry", "updates"]);
const PROHIBITED_CLAIMS = Object.freeze(["live-model-judgment", "current-cloud-state", "current-pricing", "profile-readiness", "successful-remote-validation", "network-backed-grounding"]);
const UAF_INPUTS = Object.freeze([
  Object.freeze({ task: "UAF-T019", packagePath: "lib/agent/offline-authority/uaf-t019-limitations.v1.json", packageSha256: "687fa92727cf009c6017388ce47d0ad5919fc3bd68d91fa7cd20e03c19ff8091", sourcePath: "planning/unified-ai-fabric-foundation/uaf-t019-contract-artifact.v1.json", sourceSha256: "cbaf02f625038e4181a6cfcdf82587a179ccb0497879bcc95b0ec1f5936799f5", authorityState: "local-approved-uncommitted" }),
  Object.freeze({ task: "UAF-T021", packagePath: "lib/agent/offline-authority/uaf-t021-limitations.v1.json", packageSha256: "9224c1c495ce19c4bf0d9e579b3fa92c3da9a2171bfdc75dd755f65840227323", sourcePath: "planning/unified-ai-fabric-foundation/uaf-t021-contract-artifact.v1.json", sourceSha256: "637dc638df8a8eedd409a08fe21f3f5fe0dc1d13229028dcb8c415c08a5075bf", authorityState: "local-approved-uncommitted" }),
  Object.freeze({ task: "UAF-T022", packagePath: "lib/agent/offline-authority/uaf-t022-limitations.v1.json", packageSha256: "d7e25b594286b7bfe8283a1e5a4240f917f8b765061d45aef96aa0038b7e38c2", sourcePath: "planning/unified-ai-fabric-foundation/uaf-t022-contract-artifact.v1.json", sourceSha256: "77092abf1effa132e0db094547f23b11aa832c5da69730c2edb1dc84fd03b10f", authorityState: "local-approved-uncommitted" }),
]);
const EXPECTED_SCHEMAS = Object.freeze([
  Object.freeze({ id: "agent-fai-openapi.v1", path: "commands/agent/agent-fai-v1.openapi.json", sha256: "ed31d1dbd9a70770bf1cbdcc85d2ee10d25c8dabf8fffdd3b3cebed860fe4c2f" }),
  Object.freeze({ id: "agent-fai-render-result.v1", path: "commands/agent/render-result.v1.schema.json", sha256: "f6aa0d9b520f598872c6357346f10ac37e3cb5be84b1ecae893cc40781abdfe1" }),
  Object.freeze({ id: "agent-fai-generated-contracts.v1", path: "lib/agent/contracts/manifest.v1.json", sha256: "49d48f1c1b03f9324f5d70b366cca3fde648c1ab752537b2989085e401831bfb" }),
  Object.freeze({ id: "agent-fai-offline-knowledge.v1", path: "commands/agent/offline-knowledge.v1.schema.json", sha256: "40cbc82820f81035489431fdbe2bdcf0a4b765e5ef6fd7d287e7b3fd6aec7cac" }),
]);
const LIMITATIONS = Object.freeze([
  "Packaged public knowledge may be stale and is never refreshed during offline execution.",
  "Results are deterministic lexical matches, not live model judgment or current grounding.",
  "UAF offline adapters are Degraded, the profile is Designed, and zero capabilities are Supported.",
  "No current cloud state, pricing, readiness, remote validation, authentication, MCP, telemetry, or updates are available.",
]);
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const canonicalTextSha256 = (value) => sha256(Buffer.from(Buffer.from(value).toString("utf8").replace(/\r\n/gu, "\n"), "utf8"));
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, fields) => plain(value) && Object.keys(value).sort().join("|") === [...fields].sort().join("|");

function validateQuery(value) {
  if (typeof value !== "string" || value.length < 1 || [...value].length > 8000 || Buffer.byteLength(value, "utf8") > 32000 || value.includes("\0")) throw new AgentFaiClientError("invalid_argument");
  for (let index = 0; index < value.length; index += 1) { const unit = value.charCodeAt(index); if (unit >= 0xd800 && unit <= 0xdbff) { const next = value.charCodeAt(++index); if (!(next >= 0xdc00 && next <= 0xdfff)) throw new AgentFaiClientError("invalid_argument"); } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new AgentFaiClientError("invalid_argument"); }
  return value;
}

function parseOfflineArgs(args) {
  if (!Array.isArray(args) || !args.every((entry) => typeof entry === "string")) throw new AgentFaiClientError("invalid_argument");
  let command = "report"; let format = "text"; let offlineCount = 0; let formatCount = 0; let positionalOnly = false; const prompt = [];
  let index = 0;
  if (args[0] === "ask") { command = "ask"; index = 1; }
  else if (args[0] && args[0] !== "--offline" && args[0] !== "--format") throw new AgentFaiClientError("invalid_argument");
  for (; index < args.length; index += 1) {
    const token = args[index];
    if (positionalOnly) { prompt.push(token); continue; }
    if (token === "--") { positionalOnly = true; continue; }
    if (token === "--offline") { offlineCount += 1; continue; }
    if (token === "--format") { formatCount += 1; if (++index >= args.length || !FORMATS.has(args[index])) throw new AgentFaiClientError("invalid_argument"); format = args[index]; continue; }
    if (token.startsWith("-")) throw new AgentFaiClientError("invalid_argument");
    if (command !== "ask") throw new AgentFaiClientError("invalid_argument");
    prompt.push(token);
  }
  if (offlineCount !== 1 || formatCount > 1 || (command === "ask" && prompt.length === 0) || (command === "report" && prompt.length > 0)) throw new AgentFaiClientError("invalid_argument");
  return Object.freeze({ command, format, query: command === "ask" ? validateQuery(prompt.join(" ")) : null });
}

function validateKnowledge(value, bytes, cliRoot) {
  if (canonicalTextSha256(bytes) !== EXPECTED_KNOWLEDGE_SHA256) throw new AgentFaiClientError("integrity_failed");
  if (!exact(value, ["schemaVersion", "profile", "source", "freshnessPolicy", "uafCompatibility", "schemas", "plays"]) || value.schemaVersion !== "agent-fai-offline-knowledge.v1" || value.profile !== "offline") throw new AgentFaiClientError("integrity_failed");
  if (JSON.stringify(value.source) !== JSON.stringify(EXPECTED_SOURCE)) throw new AgentFaiClientError("integrity_failed");
  if (!exact(value.freshnessPolicy, ["maximumAgeDays", "staleBehavior"]) || value.freshnessPolicy.maximumAgeDays !== 30 || value.freshnessPolicy.staleBehavior !== "label-stale-never-refresh-or-fallback-silently") throw new AgentFaiClientError("integrity_failed");
  const uaf = value.uafCompatibility;
  if (!exact(uaf, ["offlineAdapters", "adapterStatus", "capabilityStatus", "profileReadiness", "supportedCapabilities", "readinessPromoted", "sourceInputs"]) || uaf.offlineAdapters !== 7 || uaf.adapterStatus !== "Degraded" || uaf.capabilityStatus !== "Degraded" || uaf.profileReadiness !== "Designed" || uaf.supportedCapabilities !== 0 || uaf.readinessPromoted !== false || JSON.stringify(uaf.sourceInputs) !== JSON.stringify(UAF_INPUTS)) throw new AgentFaiClientError("integrity_failed");
  if (JSON.stringify(value.schemas) !== JSON.stringify(EXPECTED_SCHEMAS)) throw new AgentFaiClientError("integrity_failed");
  for (const schema of value.schemas) {
    const resolved = path.resolve(cliRoot, schema.path); const relative = path.relative(cliRoot, resolved);
    if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !fs.existsSync(resolved) || canonicalTextSha256(fs.readFileSync(resolved)) !== schema.sha256) throw new AgentFaiClientError("integrity_failed");
  }
  for (const input of UAF_INPUTS) { const resolved = path.resolve(cliRoot, input.packagePath); const relative = path.relative(cliRoot, resolved); if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !fs.existsSync(resolved) || canonicalTextSha256(fs.readFileSync(resolved)) !== input.packageSha256) throw new AgentFaiClientError("integrity_failed"); }
  if (!Array.isArray(value.plays) || value.plays.length !== 100) throw new AgentFaiClientError("integrity_failed");
  for (let index = 0; index < value.plays.length; index += 1) {
    const play = value.plays[index]; const id = String(index + 1).padStart(2, "0");
    if (!exact(play, ["id", "name", "services", "pattern", "complexity"]) || play.id !== id || typeof play.name !== "string" || play.name.length < 1 || play.name.length > 128 || CONTROL.test(play.name) || !Array.isArray(play.services) || play.services.length < 1 || play.services.length > 16 || play.services.some((item) => typeof item !== "string" || CONTROL.test(item)) || typeof play.pattern !== "string" || play.pattern.length < 3 || play.pattern.length > 1024 || CONTROL.test(play.pattern) || !["Low", "Medium", "High", "Very High", "Foundation"].includes(play.complexity)) throw new AgentFaiClientError("integrity_failed");
  }
  if (value.plays[77].name !== "Precision Agriculture Agent") throw new AgentFaiClientError("integrity_failed");
  return Object.freeze({ value, digest: canonicalTextSha256(bytes) });
}

function loadKnowledge(options = {}) {
  const assetPath = options.knowledgePath || KNOWLEDGE_PATH;
  let bytes;
  try { bytes = options.knowledgeBytes || fs.readFileSync(assetPath); } catch { throw new AgentFaiClientError("integrity_failed"); }
  let value;
  try { value = parseStrictJson(Buffer.from(bytes).toString("utf8"), "offline knowledge"); } catch { throw new AgentFaiClientError("integrity_failed"); }
  return validateKnowledge(value, bytes, options.cliRoot || path.resolve(__dirname, "../.."));
}

function tokens(value) { return [...new Set(value.normalize("NFKC").toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) || [])].filter((token) => token.length >= 2); }
function searchPlays(plays, query, topK = 3) {
  const queryTokens = tokens(query); const phrase = query.normalize("NFKC").toLocaleLowerCase("en-US");
  return plays.map((play) => {
    const name = play.name.toLocaleLowerCase("en-US"); const patternTokens = new Set(tokens(play.pattern)); const nameTokens = new Set(tokens(play.name)); let score = name.includes(phrase) || play.pattern.toLocaleLowerCase("en-US").includes(phrase) ? 100 : 0;
    for (const token of queryTokens) score += nameTokens.has(token) ? 10 : patternTokens.has(token) ? 5 : [...patternTokens].some((candidate) => candidate.includes(token) || token.includes(candidate)) ? 1 : 0;
    return { id: play.id, name: play.name, score, complexity: play.complexity, evidence: "packaged-public-play-index" };
  }).filter((entry) => entry.score > 0).sort((left, right) => right.score - left.score || Number(left.id) - Number(right.id)).slice(0, Math.max(1, Math.min(5, topK)));
}

function buildResult(parsed, options = {}) {
  const loaded = loadKnowledge(options); const knowledge = loaded.value;
  const now = new Date((options.now || Date.now)()); const updated = new Date(knowledge.source.sourceUpdatedAt);
  if (!Number.isFinite(now.getTime()) || now.getTime() < updated.getTime()) throw new AgentFaiClientError("integrity_failed");
  const ageDays = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(updated.getUTCFullYear(), updated.getUTCMonth(), updated.getUTCDate())) / 86400000);
  return validateOfflineResult({
    schemaVersion: "agent-fai-offline-result.v1", profile: "offline", query: parsed.query,
    knowledge: { digest: loaded.digest, sourceCommit: knowledge.source.commit, sourceBlob: knowledge.source.gitBlobOid, sourceUpdatedAt: knowledge.source.sourceUpdatedAt, observedDate: now.toISOString().slice(0, 10), ageDays, maximumAgeDays: knowledge.freshnessPolicy.maximumAgeDays, freshness: ageDays <= knowledge.freshnessPolicy.maximumAgeDays ? "current" : "stale" },
    provenance: { authorityState: "local-approved-uncommitted", inputs: UAF_INPUTS.map((entry) => ({ ...entry })) },
    capabilities: { available: [...AVAILABLE], unavailable: [...UNAVAILABLE], networkAttempts: 0, uafStatus: knowledge.uafCompatibility.capabilityStatus, profileReadiness: knowledge.uafCompatibility.profileReadiness },
    matches: parsed.query === null ? [] : searchPlays(knowledge.plays, parsed.query), schemas: knowledge.schemas.map((entry) => ({ ...entry })), limitations: [...LIMITATIONS], prohibitedClaims: [...PROHIBITED_CLAIMS],
  });
}

function validateOfflineResult(value) {
  if (!exact(value, ["schemaVersion", "profile", "query", "knowledge", "provenance", "capabilities", "matches", "schemas", "limitations", "prohibitedClaims"]) || value.schemaVersion !== "agent-fai-offline-result.v1" || value.profile !== "offline" || !(value.query === null || typeof value.query === "string")) throw new AgentFaiClientError("integrity_failed");
  const knowledge = value.knowledge;
  if (!exact(knowledge, ["digest", "sourceCommit", "sourceBlob", "sourceUpdatedAt", "observedDate", "ageDays", "maximumAgeDays", "freshness"]) || !/^[0-9a-f]{64}$/u.test(knowledge.digest) || !/^[0-9a-f]{40}$/u.test(knowledge.sourceCommit) || !/^[0-9a-f]{40}$/u.test(knowledge.sourceBlob) || !Number.isFinite(Date.parse(knowledge.sourceUpdatedAt)) || !/^\d{4}-\d{2}-\d{2}$/u.test(knowledge.observedDate) || !Number.isInteger(knowledge.ageDays) || knowledge.ageDays < 0 || knowledge.maximumAgeDays !== 30 || !["current", "stale"].includes(knowledge.freshness)) throw new AgentFaiClientError("integrity_failed");
  const capabilities = value.capabilities;
  if (!exact(capabilities, ["available", "unavailable", "networkAttempts", "uafStatus", "profileReadiness"]) || JSON.stringify(capabilities.available) !== JSON.stringify(AVAILABLE) || JSON.stringify(capabilities.unavailable) !== JSON.stringify(UNAVAILABLE) || capabilities.networkAttempts !== 0 || capabilities.uafStatus !== "Degraded" || capabilities.profileReadiness !== "Designed") throw new AgentFaiClientError("integrity_failed");
  if (!exact(value.provenance, ["authorityState", "inputs"]) || value.provenance.authorityState !== "local-approved-uncommitted" || JSON.stringify(value.provenance.inputs) !== JSON.stringify(UAF_INPUTS)) throw new AgentFaiClientError("integrity_failed");
  if (!Array.isArray(value.matches) || value.matches.length > 5 || value.matches.some((entry) => !exact(entry, ["id", "name", "score", "complexity", "evidence"]) || !/^(?:0[1-9]|[1-9][0-9]|100)$/u.test(entry.id) || typeof entry.name !== "string" || entry.name.length < 1 || entry.name.length > 128 || CONTROL.test(entry.name) || !Number.isInteger(entry.score) || entry.score < 0 || !["Low", "Medium", "High", "Very High", "Foundation"].includes(entry.complexity) || entry.evidence !== "packaged-public-play-index")) throw new AgentFaiClientError("integrity_failed");
  if (JSON.stringify(value.schemas) !== JSON.stringify(EXPECTED_SCHEMAS)) throw new AgentFaiClientError("integrity_failed");
  if (JSON.stringify(value.limitations) !== JSON.stringify(LIMITATIONS) || JSON.stringify(value.prohibitedClaims) !== JSON.stringify(PROHIBITED_CLAIMS)) throw new AgentFaiClientError("integrity_failed");
  return value;
}

function renderOffline(result, format) {
  if (format === "json") return `${canonicalJson(result)}\n`;
  const lines = ["Agent FAI", "Profile: offline", `Knowledge: sha256:${result.knowledge.digest} sourceUpdatedAt=${result.knowledge.sourceUpdatedAt} observedDate=${result.knowledge.observedDate} ageDays=${result.knowledge.ageDays} freshness=${result.knowledge.freshness}`, `UAF authority: ${result.provenance.authorityState}`, ...result.provenance.inputs.map((input) => `${input.task}: packageSha256=${input.packageSha256} sourceSha256=${input.sourceSha256}`), "Network attempts: 0"];
  if (result.matches.length) { lines.push("", format === "markdown" ? "## Packaged matches" : "Packaged matches"); for (const match of result.matches) lines.push(`${format === "markdown" ? "- " : ""}Play ${match.id}: ${match.name} (score=${match.score}, packaged-public-play-index)`); }
  lines.push("", format === "markdown" ? "## Available" : "Available", ...result.capabilities.available.map((value) => `${format === "markdown" ? "- " : ""}${value}`));
  lines.push("", format === "markdown" ? "## Unavailable" : "Unavailable", ...result.capabilities.unavailable.map((value) => `${format === "markdown" ? "- " : ""}${value}`));
  lines.push("", format === "markdown" ? "## Limitations" : "Limitations", ...result.limitations.map((value) => `${format === "markdown" ? "- " : ""}${value}`));
  return `${lines.join("\n")}\n`;
}

async function executeOffline(args, options = {}) {
  try { const parsed = parseOfflineArgs(args); const result = buildResult(parsed, options); return { exitCode: 0, output: renderOffline(result, parsed.format), error: "" }; }
  catch (error) { const normalized = error instanceof AgentFaiClientError ? error : new AgentFaiClientError("internal"); return { exitCode: normalized.exitCode, output: "", error: `Agent FAI offline error [${normalized.code}]: ${normalized.message}\n` }; }
}

module.exports = { AVAILABLE, EXPECTED_KNOWLEDGE_SHA256, EXPECTED_SCHEMAS, EXPECTED_SOURCE, KNOWLEDGE_PATH, LIMITATIONS, PROHIBITED_CLAIMS, UAF_INPUTS, UNAVAILABLE, buildResult, executeOffline, loadKnowledge, parseOfflineArgs, renderOffline, searchPlays, validateKnowledge, validateOfflineResult, validateQuery };