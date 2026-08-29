// @ts-check
"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const manifest = require("./source-authority-t016.v1.json");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const WORKSPACE_ROOT = path.dirname(REPO_ROOT);
const AUTHORITY_IDS = Object.freeze(["T005-decision", "planning-closure", "T006", "T008-original", "T008-superseding", "T010", "T014", "T015"]);
const SOURCE_COUNTS = Object.freeze({ "T005-decision": 2, "planning-closure": 2, T006: 2, "T008-original": 1, "T008-superseding": 5, T010: 1, T014: 2, T015: 2 });

function exactFields(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join("|") !== [...fields].sort().join("|")) throw new Error(`${label} fields are not exact`);
}
function git(repository, args) {
  const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error("T016 source authority Git validation failed");
  return result.stdout.trim();
}
function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function validateAuthorityManifest(candidate = manifest, verifyObjects = true) {
  exactFields(candidate, ["authorities", "constraints", "implementationState", "schemaVersion", "sources", "task"], "manifest");
  if (candidate !== manifest && JSON.stringify(candidate) !== JSON.stringify(manifest)) throw new Error("manifest does not match the pinned exact set");
  if (candidate.schemaVersion !== "agent-fai-source-authority-t016.v1" || candidate.task !== "AFCLI-T016" || candidate.implementationState !== "protocol-client-and-renderers-available-command-host-unavailable") throw new Error("manifest identity is invalid");
  if (!Array.isArray(candidate.authorities) || candidate.authorities.map((entry) => entry.id).join("|") !== AUTHORITY_IDS.join("|")) throw new Error("authority set is invalid");
  if (!Array.isArray(candidate.sources) || candidate.sources.length !== 17) throw new Error("source cardinality is invalid");
  const authorities = new Map();
  for (const authority of candidate.authorities) {
    exactFields(authority, ["commit", "id", "repository", "treeOid"], "authority");
    if (!/^[0-9a-f]{40}$/u.test(authority.commit) || !/^[0-9a-f]{40}$/u.test(authority.treeOid) || authorities.has(authority.id)) throw new Error("authority identity is invalid");
    authorities.set(authority.id, authority);
  }
  const identities = new Set();
  for (const source of candidate.sources) {
    exactFields(source, source.vendoredPath ? ["authority", "gitBlobOid", "path", "vendoredPath"] : ["authority", "gitBlobOid", "path"], "source");
    const identity = `${source.authority}:${source.path}`;
    if (!authorities.has(source.authority) || !/^[0-9a-f]{40}$/u.test(source.gitBlobOid) || identities.has(identity)) throw new Error("source identity is invalid");
    identities.add(identity);
  }
  for (const id of AUTHORITY_IDS) if (candidate.sources.filter((source) => source.authority === id).length !== SOURCE_COUNTS[id]) throw new Error("source authority cardinality is invalid");
  exactFields(candidate.constraints, ["commandHostAvailable", "limits", "networkAtRuntime", "reducerStartMode", "renderResultValidator", "rendererReplayStartSequence", "runtimeDependencies", "semanticRuntime", "stateCardinality", "transcriptCardinality"], "constraints");
  const constraints = candidate.constraints;
  if (constraints.runtimeDependencies !== 0 || constraints.commandHostAvailable !== false || constraints.networkAtRuntime !== false || constraints.transcriptCardinality !== 27 || constraints.stateCardinality !== 3 || constraints.reducerStartMode !== "complete-stream-only" || constraints.rendererReplayStartSequence !== 1) throw new Error("constraints are invalid");
  if (JSON.stringify(constraints.limits) !== JSON.stringify({ acceptedEvents: 100000, deliveredEvents: 200000, aggregateEventBytes: 16777216, eventBytes: 1048576, contentBytes: 2097152, sources: 1000, tools: 1000, artifacts: 1000, evidence: 1000, usage: 1000, diagnostics: 1000 })) throw new Error("limits are invalid");
  exactFields(constraints.semanticRuntime, ["generatedPath", "generatedSha256", "sourceBlobOid", "sourceCommit"], "semantic runtime authority");
  if (constraints.semanticRuntime.sourceCommit !== authorities.get("T006").commit || constraints.semanticRuntime.sourceBlobOid !== "d8e30e0fd993371fd8f3c2de196dba76c5c9af50") throw new Error("semantic runtime source is invalid");
  exactFields(constraints.renderResultValidator, ["generatedPath", "generatedSha256", "schemaPath", "schemaSha256"], "render result authority");
  if (!verifyObjects) return candidate;
  for (const authority of candidate.authorities) {
    const repository = path.join(WORKSPACE_ROOT, authority.repository);
    if (git(repository, ["rev-parse", `${authority.commit}^{commit}`]) !== authority.commit || git(repository, ["rev-parse", `${authority.commit}^{tree}`]) !== authority.treeOid) throw new Error("authority Git object mismatch");
    for (const source of candidate.sources.filter((entry) => entry.authority === authority.id)) {
      if (git(repository, ["rev-parse", `${authority.commit}:${source.path}`]) !== source.gitBlobOid) throw new Error("authority blob mismatch");
      if (source.vendoredPath) {
        const localPath = path.join(REPO_ROOT, source.vendoredPath);
        if (!fs.existsSync(localPath) || git(REPO_ROOT, ["hash-object", localPath]) !== source.gitBlobOid) throw new Error("vendored artifact mismatch");
      }
    }
  }
  for (const record of [constraints.semanticRuntime, constraints.renderResultValidator]) {
    if (record.schemaPath && sha256(path.join(REPO_ROOT, record.schemaPath)) !== record.schemaSha256) throw new Error("render result schema drift");
    if (sha256(path.join(REPO_ROOT, record.generatedPath)) !== record.generatedSha256) throw new Error("generated authority drift");
  }
  return candidate;
}

module.exports = { manifest, validateAuthorityManifest };