// @ts-check
"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const manifest = require("./source-authority-t017.v1.json");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const WORKSPACE_ROOT = path.dirname(REPO_ROOT);
const AUTHORITY_IDS = Object.freeze(["T004-review", "T004-approval", "core-baseline", "T014", "T015", "T016"]);
const SOURCE_COUNTS = Object.freeze({ "T004-review": 2, "T004-approval": 1, "core-baseline": 6, T014: 2, T015: 2, T016: 2 });
const CONSTRAINTS = Object.freeze({ runtimeDependencies: 0, commandHostAvailable: false, operationalCommandsImplemented: false, osKeychainImplemented: false, servicePrincipalsImplemented: false, workloadIdentityImplemented: false, verifiedOrganizationPolicyImplemented: false, enterpriseKillSwitchesImplemented: false, retentionAdministrationImplemented: false, deletionReceiptsImplemented: false, dlpAdministrationImplemented: false, auditExportImplemented: false, organizationSnapshotAuthority: "display-only-deny-on-stale", crashLockRecovery: "operator-cleanup-required-no-automatic-stale-recovery", lockRelease: "atomic-owner-bound-rename-retained-no-path-cleanup", releaseTombstones: "all-retained-operator-cleanup-required-no-automatic-delete-or-restore", maximumReleaseTombstones: "default-1024-configurable-1-through-4096-cooperating-race-at-most-one-retained-overshoot-fail-lock-cleanup-required", lockOwnerMetadata: "content-free-schema-version-and-random-owner-only", failedLockReleaseArtifacts: "retained-for-operator-inspection-no-automatic-delete-or-restore", unavailableLockIdentity: "fail-closed-retain-owner-bound-release-artifact", injectedIoIdentity: "genuine-lstat-required-no-stat-substitution", windowsFileProtection: "no-owner-acl-enforcement-secure-storage-unimplemented" });

function exact(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new Error(`${label} fields are not exact`);
}
function git(repository, args) {
  const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw new Error("T017 source authority Git validation failed");
  return result.stdout.trim();
}
function validateAuthorityManifest(candidate = manifest, verifyObjects = true) {
  exact(candidate, ["schemaVersion", "task", "implementationState", "authorities", "sources", "constraints"], "manifest");
  if (candidate !== manifest && JSON.stringify(candidate) !== JSON.stringify(manifest)) throw new Error("manifest does not match the independent pinned set");
  if (candidate.schemaVersion !== "agent-fai-source-authority-t017.v1" || candidate.task !== "AFCLI-T017" || candidate.implementationState !== "protocol-client-renderers-and-identity-available-command-host-unavailable") throw new Error("manifest identity is invalid");
  if (!Array.isArray(candidate.authorities) || candidate.authorities.map((entry) => entry.id).join("|") !== AUTHORITY_IDS.join("|")) throw new Error("authority set is invalid");
  const authorities = new Map();
  for (const authority of candidate.authorities) {
    exact(authority, ["id", "repository", "commit", "treeOid"], "authority");
    if (!/^[0-9a-f]{40}$/u.test(authority.commit) || !/^[0-9a-f]{40}$/u.test(authority.treeOid) || authorities.has(authority.id)) throw new Error("authority object is invalid");
    authorities.set(authority.id, authority);
  }
  if (!Array.isArray(candidate.sources) || candidate.sources.length !== 15) throw new Error("source cardinality is invalid");
  const identities = new Set();
  for (const source of candidate.sources) {
    exact(source, ["authority", "path", "gitBlobOid", "requiredPattern"], "source");
    const identity = `${source.authority}:${source.path}`;
    if (!authorities.has(source.authority) || identities.has(identity) || !/^[0-9a-f]{40}$/u.test(source.gitBlobOid) || typeof source.requiredPattern !== "string" || source.requiredPattern.length < 3) throw new Error("source identity is invalid");
    identities.add(identity);
  }
  for (const id of AUTHORITY_IDS) if (candidate.sources.filter((source) => source.authority === id).length !== SOURCE_COUNTS[id]) throw new Error("source authority cardinality is invalid");
  exact(candidate.constraints, Object.keys(CONSTRAINTS), "constraints");
  if (JSON.stringify(candidate.constraints) !== JSON.stringify(CONSTRAINTS)) throw new Error("T043/T044 constraint truth is invalid");
  if (!verifyObjects) return candidate;
  for (const authority of candidate.authorities) {
    const repository = path.join(WORKSPACE_ROOT, authority.repository);
    if (git(repository, ["rev-parse", `${authority.commit}^{commit}`]) !== authority.commit || git(repository, ["rev-parse", `${authority.commit}^{tree}`]) !== authority.treeOid) throw new Error("authority Git object mismatch");
    for (const source of candidate.sources.filter((entry) => entry.authority === authority.id)) {
      if (git(repository, ["rev-parse", `${authority.commit}:${source.path}`]) !== source.gitBlobOid) throw new Error("authority blob mismatch");
      if (!git(repository, ["show", `${authority.commit}:${source.path}`]).includes(source.requiredPattern)) throw new Error("authority required pattern mismatch");
    }
  }
  return candidate;
}

module.exports = { manifest, validateAuthorityManifest };