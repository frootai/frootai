// @ts-check
"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const manifest = require("./source-authority.v1.json");

const CORE_REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const WORKSPACE_ROOT = path.dirname(CORE_REPOSITORY_ROOT);
const EXPECTED_PLANNING_AUTHORITY = Object.freeze({ repository: "frootai-planning-agent-fai-cli", commit: "8245676a69c498defc7a208cec30d650bcde135d", sourceCardinality: 3 });
const EXPECTED_CORE_AUTHORITY = Object.freeze({ repository: "frootai-core-agent-fai-cli", commit: "b2399b946104825065dde2e2e53999cd8a2a3951", sourceCardinality: 5 });

const EXPECTED_PLANNING = [
  ["planning/agent-fai-cli/afcli-t005-approval-receipt.v1.json", "601a477a898e158aa3c4dba70a91369154f0fdf6", "\"decision\": \"approved\""],
  ["planning/agent-fai-cli/afcli-t005-invocation-research.v1.json", "1f89b9a791ce0c316fab8609c283af85dbda2a24", "\"canonical\": \"fai agent\""],
  ["planning/agent-fai-cli/architecture.md", "1b4de8327050c6b8e133f7eaa27609586a7de93b", "The command registry is executable authority"],
];
const EXPECTED_CORE = [
  ["cli/package.json", "bcaa5b64096a82558fc85c9ebd3305238854d220", "\"version\": \"6.2.0\""],
  ["cli/bin.js", "b5abaf1255309196747ab2b0cd39c63ab96d0c54", "const rawArgs = process.argv.slice(2)"],
  ["cli/lib/security/command-policy.js", "e559c858a869127077280854a21a4d26dc945698", "const RISK = Object.freeze"],
  ["cli/commands/completions/completions.js", "be402b45eb109d1b743284da75f4b0e516dded9a", "const SUPPORTED_SUBCOMMANDS = Object.freeze"],
  ["cli/lib/capabilities/inspect.js", "1e1b1cb659addd0b6b5eb7f0a90fef2ac260a4c9", "function inspectCapabilities()"],
];

function exactFields(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(`${label} must be a plain object`);
  const actual = Object.keys(value).sort();
  if (actual.join("|") !== [...expected].sort().join("|")) throw new Error(`${label} fields are not exact`);
}

function validateSources(label, sources, expected) {
  if (!Array.isArray(sources) || sources.length !== expected.length) {
    throw new Error(`${label} source cardinality mismatch`);
  }
  const paths = new Set();
  for (const source of sources) {
    exactFields(source, ["gitBlobOid", "path", "requiredPattern"], `${label} source`);
    if (paths.has(source.path)) throw new Error(`${label} source path is duplicated: ${source.path}`);
    if (!/^[0-9a-f]{40}$/u.test(source.gitBlobOid)) throw new Error(`${label} source blob is invalid: ${source.path}`);
    if (typeof source.requiredPattern !== "string" || source.requiredPattern.length === 0) {
      throw new Error(`${label} source pattern is missing: ${source.path}`);
    }
    paths.add(source.path);
  }
  const tuples = sources.map((source) => [source.path, source.gitBlobOid, source.requiredPattern]);
  if (JSON.stringify(tuples) !== JSON.stringify(expected)) throw new Error(`${label} source set does not match its pinned authority`);
}

function runGit(repositoryPath, args, label) {
  const result = spawnSync("git", ["-C", repositoryPath, ...args], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`${label} failed: ${(result.stderr || "git command failed").trim()}`);
  return result.stdout;
}

function verifyPinnedSources(label, authority, sources) {
  const repositoryPath = path.resolve(WORKSPACE_ROOT, authority.repository);
  const relative = path.relative(WORKSPACE_ROOT, repositoryPath);
  if (!relative || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new Error(`${label} repository escapes workspace root`);
  const commit = runGit(repositoryPath, ["rev-parse", "--verify", `${authority.commit}^{commit}`], `${label} commit`).trim();
  if (commit !== authority.commit) throw new Error(`${label} commit identity mismatch`);
  for (const source of sources) {
    const objectId = runGit(repositoryPath, ["rev-parse", `${authority.commit}:${source.path}`], `${label} source ${source.path}`).trim();
    if (objectId !== source.gitBlobOid) throw new Error(`${label} blob mismatch: ${source.path}`);
    const contents = runGit(repositoryPath, ["show", `${authority.commit}:${source.path}`], `${label} source ${source.path}`);
    if (!contents.includes(source.requiredPattern)) throw new Error(`${label} required pattern is absent: ${source.path}`);
  }
}

function validateAuthorityManifest(candidate = manifest) {
  const allowed = ["constraints", "coreAuthority", "coreSources", "implementationState", "nextTask", "parentStatus", "planningAuthority", "planningSources", "schemaVersion", "task"];
  exactFields(candidate, allowed, "authority manifest");
  if (candidate.schemaVersion !== "agent-fai-source-authority.v1" || candidate.task !== "AFCLI-T014") throw new Error("authority manifest identity is invalid");
  if (candidate.implementationState !== "routing-only-protocol-client-unavailable" || candidate.nextTask !== "AFCLI-T015") throw new Error("authority implementation state is invalid");
  exactFields(candidate.parentStatus, ["AFCLI-T005", "AFCLI-T010"], "authority parent status");
  if (JSON.stringify(candidate.parentStatus) !== JSON.stringify({ "AFCLI-T005": "approved", "AFCLI-T010": "approved" })) throw new Error("authority parent status is invalid");
  exactFields(candidate.planningAuthority, ["commit", "repository", "sourceCardinality"], "planning authority");
  exactFields(candidate.coreAuthority, ["commit", "repository", "sourceCardinality"], "Core authority");
  if (JSON.stringify(candidate.planningAuthority) !== JSON.stringify(EXPECTED_PLANNING_AUTHORITY)) throw new Error("planning authority is invalid");
  if (JSON.stringify(candidate.coreAuthority) !== JSON.stringify(EXPECTED_CORE_AUTHORITY)) throw new Error("Core authority is invalid");
  validateSources("planning", candidate.planningSources, EXPECTED_PLANNING);
  validateSources("Core", candidate.coreSources, EXPECTED_CORE);
  exactFields(candidate.constraints, ["canonical", "equivalent", "remoteOperations", "runtimeImplementations"], "authority constraints");
  if (JSON.stringify(candidate.constraints) !== JSON.stringify({ canonical: "fai agent", equivalent: ["frootai agent", "agent-fai"], runtimeImplementations: 1, remoteOperations: false })) throw new Error("authority constraints are invalid");
  verifyPinnedSources("planning", candidate.planningAuthority, candidate.planningSources);
  verifyPinnedSources("Core", candidate.coreAuthority, candidate.coreSources);
  return candidate;
}

module.exports = { manifest: validateAuthorityManifest(), validateAuthorityManifest, verifyPinnedSources };