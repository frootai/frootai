// @ts-check
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const manifest = require("./source-authority-t020.v1.json");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const WORKSPACE_ROOT = path.dirname(REPO_ROOT);
const SOURCE_PATHS = Object.freeze(["npm-mcp/index.js", "cli/commands/agent/command-registry.v1.json", "cli/lib/agent/dispatch.js", "cli/lib/agent/strict-json.js", "cli/lib/agent/semantic-runtime.generated.js", "cli/package.json", "cli/commands/agent/source-authority-t019.v1.json"]);
const CONSTRAINTS = Object.freeze({ runtimeDependencies: 0, explicitFlagRequired: true, networkAttempts: 0, knowledgeSource: "pinned-play-data-only-pricing-excluded", packagedPlays: 100, precisionAgriculturePlayId: "78", packagedSchemas: 4, freshnessMaximumAgeDays: 30, staleBehavior: "label-stale-never-refresh-or-fallback-silently", offlineAdapters: 7, capabilityStatus: "Degraded", profileReadiness: "Designed", supportedCapabilities: 0, unavailableLiveCapabilities: ["live-model-judgment", "current-cloud-state", "current-pricing", "profile-readiness", "successful-remote-validation", "network-backed-grounding"], silentFallback: false, authenticationUsed: false, telemetryUsed: false, mcpUsed: false, updatesUsed: false, azureResourcesCreated: false });
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const canonicalTextSha256 = (value) => sha256(Buffer.from(Buffer.from(value).toString("utf8").replace(/\r\n/gu, "\n"), "utf8"));
function exact(value, keys, label) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new Error(`${label} fields are not exact`); }
function git(repository, args) { const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 }); if (result.status !== 0) throw new Error("T020 source authority Git validation failed"); return result.stdout.trim(); }
function validateAuthorityManifest(candidate = manifest, verifyObjects = true) {
  exact(candidate, ["schemaVersion", "task", "implementationState", "authorities", "sources", "localLimitationInputs", "constraints"], "manifest");
  if (candidate !== manifest && JSON.stringify(candidate) !== JSON.stringify(manifest)) throw new Error("manifest does not match the independent pinned set");
  if (candidate.schemaVersion !== "agent-fai-source-authority-t020.v1" || candidate.task !== "AFCLI-T020" || candidate.implementationState !== "offline-profile-available-terminal-preview-partial") throw new Error("manifest identity is invalid");
  if (!Array.isArray(candidate.authorities) || candidate.authorities.length !== 1) throw new Error("authority set is invalid");
  const authority = candidate.authorities[0]; exact(authority, ["id", "repository", "commit", "treeOid"], "authority");
  if (authority.id !== "T019" || !/^[0-9a-f]{40}$/u.test(authority.commit) || !/^[0-9a-f]{40}$/u.test(authority.treeOid)) throw new Error("authority object is invalid");
  if (!Array.isArray(candidate.sources) || candidate.sources.length !== SOURCE_PATHS.length || candidate.sources.map((source) => source.path).join("|") !== SOURCE_PATHS.join("|")) throw new Error("source set is invalid");
  for (const source of candidate.sources) { exact(source, ["authority", "path", "gitBlobOid", "requiredPattern"], "source"); if (source.authority !== "T019" || !/^[0-9a-f]{40}$/u.test(source.gitBlobOid) || typeof source.requiredPattern !== "string") throw new Error("source identity is invalid"); }
  if (!Array.isArray(candidate.localLimitationInputs) || candidate.localLimitationInputs.length !== 3) throw new Error("local limitation set is invalid");
  for (const input of candidate.localLimitationInputs) { exact(input, ["task", "packagePath", "packageSha256", "sourcePath", "sourceSha256", "authorityState"], "local limitation"); if (!["UAF-T019", "UAF-T021", "UAF-T022"].includes(input.task) || !/^cli\/lib\/agent\/offline-authority\//u.test(input.packagePath) || !/^planning\/unified-ai-fabric-foundation\//u.test(input.sourcePath) || !/^[0-9a-f]{64}$/u.test(input.packageSha256) || !/^[0-9a-f]{64}$/u.test(input.sourceSha256) || input.authorityState !== "local-approved-uncommitted") throw new Error("local limitation identity is invalid"); }
  exact(candidate.constraints, Object.keys(CONSTRAINTS), "constraints"); if (JSON.stringify(candidate.constraints) !== JSON.stringify(CONSTRAINTS)) throw new Error("T020 constraint truth is invalid");
  if (!verifyObjects) return candidate;
  const repository = path.join(WORKSPACE_ROOT, authority.repository);
  if (git(repository, ["rev-parse", `${authority.commit}^{commit}`]) !== authority.commit || git(repository, ["rev-parse", `${authority.commit}^{tree}`]) !== authority.treeOid) throw new Error("authority Git object mismatch");
  for (const source of candidate.sources) { if (git(repository, ["rev-parse", `${authority.commit}:${source.path}`]) !== source.gitBlobOid) throw new Error("authority blob mismatch"); if (!git(repository, ["show", `${authority.commit}:${source.path}`]).includes(source.requiredPattern)) throw new Error("authority required pattern mismatch"); }
  for (const input of candidate.localLimitationInputs) { const file = path.join(repository, input.packagePath); if (!fs.existsSync(file) || canonicalTextSha256(fs.readFileSync(file)) !== input.packageSha256) throw new Error("packaged limitation input mismatch"); }
  return candidate;
}

module.exports = { manifest, validateAuthorityManifest };