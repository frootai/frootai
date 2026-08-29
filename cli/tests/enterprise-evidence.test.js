// @ts-check
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { buildEvidence, digestFile, inventoryDigest, verifyEvidence } = require("../lib/release/enterprise-evidence");

test("inventory digest is deterministic across file order", () => {
  const a = [{ path: "b", size: 2, mode: 420 }, { path: "a", size: 1, mode: 420 }];
  assert.equal(inventoryDigest(a), inventoryDigest([...a].reverse()));
});

test("release eligibility is fail-closed when any gate fails", () => {
  const base = { generatedAt: "2026-01-01T00:00:00.000Z", package: {}, source: {}, environment: {}, policy: {}, capabilities: {} };
  assert.equal(buildEvidence({ ...base, gates: [{ id: "a", ok: true }] }).release_eligible, true);
  const failed = buildEvidence({ ...base, gates: [{ id: "a", ok: true }, { id: "b", ok: false }] });
  assert.equal(failed.release_eligible, false);
  assert.deepEqual(failed.failures, ["b"]);
});

test("evidence verification binds eligibility, digest, and size to one tarball", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "frootai-evidence-"));
  try {
    const tarball = path.join(root, "package.tgz");
    fs.writeFileSync(tarball, "artifact-one");
    const evidence = buildEvidence({
      generatedAt: "2026-01-01T00:00:00.000Z",
      package: { sha256: digestFile(tarball), packed_bytes: fs.statSync(tarball).size },
      source: {}, environment: {}, policy: {}, capabilities: {}, gates: [{ id: "all", ok: true }],
    });
    assert.deepEqual(verifyEvidence(evidence, tarball), { ok: true, errors: [] });
    fs.writeFileSync(tarball, "artifact-two");
    const tampered = verifyEvidence(evidence, tarball);
    assert.equal(tampered.ok, false);
    assert.ok(tampered.errors.includes("tarball sha256 mismatch"));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});