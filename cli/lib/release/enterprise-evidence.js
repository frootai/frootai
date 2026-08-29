// @ts-check
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");

const EVIDENCE_SCHEMA_VERSION = 1;
const EVIDENCE_KIND = "frootai.cli.enterprise-release-evidence";
const MAX_PACKED_BYTES = 2 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 5 * 1024 * 1024;

function digestFile(filePath, algorithm = "sha256", encoding = "hex") {
  const hash = crypto.createHash(algorithm);
  hash.update(fs.readFileSync(filePath));
  return hash.digest(encoding);
}

function digestJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function inventoryDigest(files) {
  const rows = [...files]
    .map((file) => `${file.path}:${file.size}:${file.mode}`)
    .sort();
  return crypto.createHash("sha256").update(rows.join("\n")).digest("hex");
}

function buildEvidence(input) {
  const failed = input.gates.filter((gate) => gate.ok !== true);
  return {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    kind: EVIDENCE_KIND,
    generated_at: input.generatedAt,
    release_eligible: failed.length === 0,
    package: input.package,
    source: input.source,
    environment: input.environment,
    policy: input.policy,
    capabilities: input.capabilities,
    gates: input.gates,
    failures: failed.map((gate) => gate.id),
  };
}

function verifyEvidence(evidence, tarballPath) {
  const errors = [];
  if (!evidence || evidence.schema_version !== EVIDENCE_SCHEMA_VERSION) errors.push("unsupported evidence schema");
  if (!evidence || evidence.kind !== EVIDENCE_KIND) errors.push("unexpected evidence kind");
  if (!evidence || evidence.release_eligible !== true) errors.push("evidence is not release eligible");
  if (!evidence || !evidence.package) errors.push("missing package evidence");
  if (evidence && Array.isArray(evidence.gates) && evidence.gates.some((gate) => gate.ok !== true)) errors.push("one or more gates failed");
  if (tarballPath && evidence && evidence.package) {
    if (!fs.existsSync(tarballPath)) errors.push("tarball does not exist");
    else {
      if (digestFile(tarballPath) !== evidence.package.sha256) errors.push("tarball sha256 mismatch");
      if (fs.statSync(tarballPath).size !== evidence.package.packed_bytes) errors.push("tarball size mismatch");
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_KIND,
  MAX_PACKED_BYTES,
  MAX_UNPACKED_BYTES,
  digestFile,
  digestJson,
  inventoryDigest,
  buildEvidence,
  verifyEvidence,
};