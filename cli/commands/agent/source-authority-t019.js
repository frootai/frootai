// @ts-check
"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const manifest = require("./source-authority-t019.v1.json");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const WORKSPACE_ROOT = path.dirname(REPO_ROOT);
const SOURCE_PATHS = Object.freeze(["cli/bin.js", "cli/lib/agent/dispatch.js", "cli/lib/agent/headless-host.js", "cli/lib/agent/protocol-client.js", "cli/lib/agent/renderers.js", "cli/lib/agent/session-metadata-store.js", "cli/lib/agent/config-v2.js", "cli/commands/agent/command-registry.v1.json", "cli/package.json", "cli/commands/agent/source-authority-t018.v1.json"]);
const CONSTRAINTS = Object.freeze({ runtimeDependencies: 0, backendAuthority: "shared-agent-fai-control-plane-no-new-backend", interactiveLineModeAvailable: true, implementedCommands: ["root", "resume", "sessions-list", "sessions-show", "sessions-resume", "sessions-export"], workflowModes: ["answer", "architecture", "plan", "review"], requestedAuthority: "observe-only", steeringQueueMaximum: 32, firstSignal: "cancel-active-turn-or-exit-idle", secondSignalWindowMs: 750, sessionMetadata: "content-free-bounded-local-projection", compact: "local-display-metadata-only-remote-context-unchanged", contextManifest: "null-until-trusted-context-broker", toolsImplemented: false, mcpImplemented: false, offlineImplemented: false, operateModeImplemented: false, localWriteImplemented: false, externalMutationImplemented: false, liveControlPlaneE2EValidated: false, azureResourcesCreated: false });

function exact(value, keys, label) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new Error(`${label} fields are not exact`); }
function git(repository, args) { const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 }); if (result.status !== 0) throw new Error("T019 source authority Git validation failed"); return result.stdout.trim(); }
function validateAuthorityManifest(candidate = manifest, verifyObjects = true) {
  exact(candidate, ["schemaVersion", "task", "implementationState", "authorities", "sources", "constraints"], "manifest");
  if (candidate !== manifest && JSON.stringify(candidate) !== JSON.stringify(manifest)) throw new Error("manifest does not match the independent pinned set");
  if (candidate.schemaVersion !== "agent-fai-source-authority-t019.v1" || candidate.task !== "AFCLI-T019" || candidate.implementationState !== "interactive-line-host-available-lifecycle-partial") throw new Error("manifest identity is invalid");
  if (!Array.isArray(candidate.authorities) || candidate.authorities.length !== 1) throw new Error("authority set is invalid");
  const authority = candidate.authorities[0]; exact(authority, ["id", "repository", "commit", "treeOid"], "authority");
  if (authority.id !== "T018" || !/^[0-9a-f]{40}$/u.test(authority.commit) || !/^[0-9a-f]{40}$/u.test(authority.treeOid)) throw new Error("authority object is invalid");
  if (!Array.isArray(candidate.sources) || candidate.sources.length !== SOURCE_PATHS.length || candidate.sources.map((source) => source.path).join("|") !== SOURCE_PATHS.join("|")) throw new Error("source set is invalid");
  const identities = new Set();
  for (const source of candidate.sources) { exact(source, ["authority", "path", "gitBlobOid", "requiredPattern"], "source"); if (source.authority !== "T018" || identities.has(source.path) || !/^[0-9a-f]{40}$/u.test(source.gitBlobOid) || typeof source.requiredPattern !== "string" || source.requiredPattern.length < 3) throw new Error("source identity is invalid"); identities.add(source.path); }
  exact(candidate.constraints, Object.keys(CONSTRAINTS), "constraints"); if (JSON.stringify(candidate.constraints) !== JSON.stringify(CONSTRAINTS)) throw new Error("T019 constraint truth is invalid");
  if (!verifyObjects) return candidate;
  const repository = path.join(WORKSPACE_ROOT, authority.repository);
  if (git(repository, ["rev-parse", `${authority.commit}^{commit}`]) !== authority.commit || git(repository, ["rev-parse", `${authority.commit}^{tree}`]) !== authority.treeOid) throw new Error("authority Git object mismatch");
  for (const source of candidate.sources) { if (git(repository, ["rev-parse", `${authority.commit}:${source.path}`]) !== source.gitBlobOid) throw new Error("authority blob mismatch"); if (!git(repository, ["show", `${authority.commit}:${source.path}`]).includes(source.requiredPattern)) throw new Error("authority required pattern mismatch"); }
  return candidate;
}

module.exports = { manifest, validateAuthorityManifest };