// @ts-check
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const manifest = require("./source-authority-t015.v1.json");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const WORKSPACE_ROOT = path.dirname(REPO_ROOT);
const TASKS = Object.freeze(["AFCLI-T006", "AFCLI-T009", "AFCLI-T010", "AFCLI-T014"]);
const SOURCE_COUNTS = Object.freeze({ "AFCLI-T006": 4, "AFCLI-T009": 1, "AFCLI-T010": 3, "AFCLI-T014": 4 });

function exactFields(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== [...fields].sort().join("|")) throw new Error(`${label} fields are not exact`);
}
function git(repository, args) {
  const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error("source authority Git validation failed");
  return result.stdout.trim();
}
function validateAuthorityManifest(candidate = manifest, verifyObjects = true) {
  exactFields(candidate, ["authorities", "constraints", "implementationState", "schemaVersion", "sources", "task"], "manifest");
  if (candidate !== manifest && JSON.stringify(candidate) !== JSON.stringify(manifest)) throw new Error("manifest does not match the pinned exact set");
  if (candidate.schemaVersion !== "agent-fai-source-authority-t015.v1" || candidate.task !== "AFCLI-T015" || candidate.implementationState !== "protocol-client-available-command-host-unavailable") throw new Error("manifest identity is invalid");
  if (!Array.isArray(candidate.authorities) || candidate.authorities.map((entry) => entry.task).join("|") !== TASKS.join("|")) throw new Error("authority set is invalid");
  if (!Array.isArray(candidate.sources) || candidate.sources.length !== 12) throw new Error("source cardinality is invalid");
  for (const authority of candidate.authorities) exactFields(authority, ["commit", "repository", "task"], "authority");
  const paths = new Set();
  for (const source of candidate.sources) {
    exactFields(source, source.vendoredPath ? ["gitBlobOid", "path", "task", "vendoredPath"] : ["gitBlobOid", "path", "task"], "source");
    if (!TASKS.includes(source.task) || !/^[0-9a-f]{40}$/u.test(source.gitBlobOid) || paths.has(`${source.task}:${source.path}`)) throw new Error("source identity is invalid");
    paths.add(`${source.task}:${source.path}`);
  }
  for (const task of TASKS) if (candidate.sources.filter((source) => source.task === task).length !== SOURCE_COUNTS[task]) throw new Error("source task cardinality is invalid");
  exactFields(candidate.constraints, ["commandHostAvailable", "defaultCredentialStore", "environmentEndpointOverride", "httpsOnly", "proxyDispatcherInjected", "runtimeDependencies"], "constraints");
  if (JSON.stringify(candidate.constraints) !== JSON.stringify({ httpsOnly: true, environmentEndpointOverride: false, defaultCredentialStore: "cli/commands/auth/credentials-store.js", proxyDispatcherInjected: true, runtimeDependencies: 0, commandHostAvailable: false })) throw new Error("constraints are invalid");
  if (!verifyObjects) return candidate;
  for (const authority of candidate.authorities) {
    const repository = path.join(WORKSPACE_ROOT, authority.repository);
    if (git(repository, ["rev-parse", `${authority.commit}^{commit}`]) !== authority.commit) throw new Error("authority commit mismatch");
    for (const source of candidate.sources.filter((entry) => entry.task === authority.task)) {
      if (git(repository, ["rev-parse", `${authority.commit}:${source.path}`]) !== source.gitBlobOid) throw new Error("authority blob mismatch");
      if (source.vendoredPath) {
        const local = git(REPO_ROOT, ["hash-object", path.join(REPO_ROOT, source.vendoredPath)]);
        if (local !== source.gitBlobOid || !fs.existsSync(path.join(REPO_ROOT, source.vendoredPath))) throw new Error("vendored artifact mismatch");
      }
    }
  }
  return candidate;
}

module.exports = { manifest, validateAuthorityManifest };