// @ts-check
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const { authorizeCommand, RISK } = require("../lib/security/command-policy");
const { appendAuditEvent, readRecords, safeFlags, verifyAuditLog } = require("../lib/security/audit-log");
const { authorizeReleaseScript, sha256 } = require("../lib/security/script-authorization");
const bin = path.resolve(__dirname, "..", "bin.js");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "frootai-security-"));
}

function invoke(args, root) {
  return spawnSync(process.execPath, [bin, ...args], {
    cwd: path.resolve(__dirname, "..", ".."),
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "false",
      FROOTAI_APPROVE_EXTERNAL: "",
      FROOTAI_APPROVE_FORCE: "",
      FROOTAI_DRY_RUN: "",
      FROOTAI_POLICY_OPERATION_ID: "",
      FROOTAI_POLICY_TOKEN: "",
      NO_COLOR: "1",
      FROOTAI_AUDIT_LOG: path.join(root, "audit", "operations.jsonl"),
      XDG_CONFIG_HOME: path.join(root, "config"),
      HOME: root,
      USERPROFILE: root,
    },
  });
}

test("external mutation is fail-closed and approval flags are consumed", () => {
  const denied = authorizeCommand(["ship", "cli", "patch"], {});
  assert.equal(denied.allowed, false);
  assert.equal(denied.risk, RISK.EXTERNAL_MUTATION);
  assert.equal(denied.exitCode, 77);
  const allowed = authorizeCommand(["ship", "cli", "patch", "--confirm-external"], {});
  assert.equal(allowed.allowed, true);
  assert.ok(!allowed.argv.includes("--confirm-external"));
  const forced = authorizeCommand(["ship", "cli", "patch", "--force", "--confirm-external"], {});
  assert.equal(forced.allowed, false);
  assert.match(forced.reason, /confirm-force/);
  assert.equal(authorizeCommand(["update", "--apply", "--yes"], {}).risk, RISK.EXTERNAL_MUTATION);
});

test("dry-run publication is not classified as external mutation", () => {
  assert.equal(authorizeCommand(["ship", "cli", "patch", "--dry-run"], {}).risk, RISK.LOCAL_WRITE);
  assert.notEqual(authorizeCommand(["engine", "commit", "play", "--upgrade-to-play", "--dry-run"], {}).risk, RISK.EXTERNAL_MUTATION);
});

test("audit records form a verifiable chain and expose flags only", () => {
  const root = tempDir();
  try {
    const auditPath = path.join(root, "audit.jsonl");
    const common = { operationId: "op-1", operation: "config.set", risk: RISK.LOCAL_WRITE, argv: ["config", "set", "secret", "value", "--json"], cliVersion: "6.1.1", policyVersion: 1 };
    appendAuditEvent({ ...common, event: "policy.decision", decision: "allow" }, { auditPath });
    appendAuditEvent({ ...common, event: "operation.complete", decision: "complete", exitCode: 0 }, { auditPath });
    assert.deepEqual(safeFlags(common.argv), ["--json"]);
    assert.equal(verifyAuditLog(auditPath).ok, true);
    const records = readRecords(auditPath);
    assert.equal(records.length, 2);
    assert.equal(JSON.stringify(records).includes("secret"), false);
    records[0].operation = "tampered";
    fs.writeFileSync(auditPath, `${records.map(JSON.stringify).join("\n")}\n`);
    const result = verifyAuditLog(auditPath);
    assert.equal(result.ok, false);
    assert.equal(result.line, 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("audit target refuses symbolic-link redirection when supported", (t) => {
  const root = tempDir();
  try {
    const real = path.join(root, "real.jsonl");
    const link = path.join(root, "linked.jsonl");
    fs.writeFileSync(real, "");
    try { fs.symlinkSync(real, link, "file"); }
    catch { t.skip("symbolic links are not available in this environment"); return; }
    assert.throws(() => appendAuditEvent({ event: "policy.decision", operationId: "op", operation: "x", risk: RISK.LOCAL_WRITE, cliVersion: "6.1.1", policyVersion: 1 }, { auditPath: link }), /symbolic links/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("published binary blocks destructive commands before dispatch and audits denials", () => {
  const root = tempDir();
  try {
    const attempts = [
      ["ship", "cli", "patch"],
      ["engine", "commit", "fake", "--upgrade-to-play"],
      ["ship", "cli", "patch", "--force", "--confirm-external"],
    ];
    for (const args of attempts) {
      const result = invoke(args, root);
      assert.equal(result.status, 77, result.stderr);
      assert.match(result.stderr, /blocked by enterprise policy/);
      assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /FAI Factory|Release failed|play directory not found/);
    }
    const auditPath = path.join(root, "audit", "operations.jsonl");
    assert.deepEqual(verifyAuditLog(auditPath), { ...verifyAuditLog(auditPath), ok: true, records: 3 });
    const serialized = JSON.stringify(readRecords(auditPath));
    assert.doesNotMatch(serialized, /fake|patch/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("local mutation records policy and completion events", () => {
  const root = tempDir();
  try {
    const result = invoke(["config", "set", "telemetry", "false"], root);
    assert.equal(result.status, 0, result.stderr);
    const auditPath = path.join(root, "audit", "operations.jsonl");
    const records = readRecords(auditPath);
    assert.equal(records.length, 2);
    assert.equal(records[0].event, "policy.decision");
    assert.equal(records[1].event, "operation.complete");
    assert.equal(records[1].exit_code, 0);
    assert.equal(verifyAuditLog(auditPath).ok, true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("direct release scripts cannot bypass the audited binary", () => {
  const root = tempDir();
  try {
    for (const script of ["scripts/factory/ship.js", "scripts/release-channel.js"]) {
      const result = spawnSync(process.execPath, [path.resolve(__dirname, "..", "..", script), "cli", "patch"], {
        cwd: path.resolve(__dirname, "..", ".."),
        encoding: "utf8",
        env: { ...process.env, HOME: root, USERPROFILE: root, FROOTAI_AUDIT_LOG: path.join(root, "audit.jsonl") },
      });
      assert.equal(result.status, 77, `${script}: ${result.stderr}`);
      assert.match(result.stderr, /Release blocked/);
      assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Harvesting|Auto-detected bump|git push/);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("release-script authorization is token-bound, operation-bound, recent, and one-time", () => {
  const root = tempDir();
  try {
    const auditPath = path.join(root, "audit.jsonl");
    const token = "a".repeat(64);
    const operationId = "release-operation";
    const now = Date.parse("2026-07-26T12:00:00.000Z");
    const base = {
      event: "policy.decision", operationId, operation: "release.cli", risk: RISK.EXTERNAL_MUTATION,
      decision: "allow", argv: ["ship", "cli", "patch", "--confirm-external"], cliVersion: "6.1.1",
      policyVersion: 1, authorizationHash: sha256(token), ts: new Date(now).toISOString(),
    };
    appendAuditEvent(base, { auditPath });
    const env = { FROOTAI_POLICY_OPERATION_ID: operationId, FROOTAI_POLICY_TOKEN: token, FROOTAI_AUDIT_LOG: auditPath };
    assert.equal(authorizeReleaseScript({ env, operations: ["release.cli"], nowMs: now + 1000 }).allowed, true);
    assert.equal(authorizeReleaseScript({ env: { ...env, FROOTAI_POLICY_TOKEN: "b".repeat(64) }, operations: ["release.cli"], nowMs: now + 1000 }).allowed, false);
    assert.match(authorizeReleaseScript({ env, operations: ["release.mcp"], nowMs: now + 1000 }).reason, /operation mismatch/);
    assert.match(authorizeReleaseScript({ env, operations: ["release.cli"], nowMs: now + 6 * 60 * 1000 }).reason, /expired/);
    appendAuditEvent({ ...base, event: "operation.complete", decision: "complete", exitCode: 0, ts: new Date(now + 2000).toISOString() }, { auditPath });
    assert.match(authorizeReleaseScript({ env, operations: ["release.cli"], nowMs: now + 3000 }).reason, /already completed/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("direct non-dry-run release scripts cannot bypass the audited binary", () => {
  const env = { ...process.env, FROOTAI_POLICY_OPERATION_ID: "", FROOTAI_POLICY_TOKEN: "", FROOTAI_APPROVE_EXTERNAL: "1", CI: "true" };
  const scripts = [
    [path.resolve(__dirname, "..", "..", "scripts", "factory", "ship.js"), ["cli", "patch"]],
    [path.resolve(__dirname, "..", "..", "scripts", "release-channel.js"), ["cli", "patch"]],
  ];
  for (const [script, args] of scripts) {
    const result = spawnSync(process.execPath, [script, ...args], { cwd: path.resolve(__dirname, "..", ".."), encoding: "utf8", env });
    assert.equal(result.status, 77, `${script}: ${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /Release blocked/);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Harvesting|Running consistency check|Git operations/);
  }
});

test("direct Factory dry-run cannot bypass local-write auditing", () => {
  const script = path.resolve(__dirname, "..", "..", "scripts", "factory", "ship.js");
  const result = spawnSync(process.execPath, [script, "--dry-run", "cli", "patch"], {
    cwd: path.resolve(__dirname, "..", ".."), encoding: "utf8",
    env: { ...process.env, FROOTAI_POLICY_OPERATION_ID: "", FROOTAI_POLICY_TOKEN: "" },
  });
  assert.equal(result.status, 77, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /Release blocked/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Harvesting/);
});