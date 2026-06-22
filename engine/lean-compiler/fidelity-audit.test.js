/**
 * [Z1.9] Tests — Fidelity audit log (JSONL, append-only).
 *
 * Lines are compact + secret-free (dropped COUNTS, never the dropped strings),
 * the builder is deterministic (injected timestamp), and appendAudit is
 * append-only and round-trips through parseAuditLog.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditLine, serializeAuditLine, appendAudit, parseAuditLog } from "./fidelity-audit.js";
import { gate } from "./fidelity-gate.js";

const AT = "2026-06-22T00:00:00.000Z";

test("[Z1.9] auditLine records a passing decision compactly", () => {
  const full = "You MUST validate input.\nRun the build.\nSet $FROOT_API_KEY.";
  const g = gate(full, full, { id: "demo", type: "skill" });
  const line = auditLine(g, { at: AT });
  assert.equal(line.ts, AT);
  assert.equal(line.id, "demo");
  assert.equal(line.type, "skill");
  assert.equal(line.decision, "lean");
  assert.equal(line.fallback, false);
  assert.equal(line.passed, true);
  assert.deepEqual(line.dropped, {});
});

test("[Z1.9] a fallback decision records dropped COUNTS, not the strings", () => {
  const full = "You MUST validate input.\nNEVER log secrets.\nDO NOT commit keys.";
  const lean = "You MUST validate input."; // two guardrails dropped
  const g = gate(full, lean, { id: "x", type: "skill" });
  const line = auditLine(g, { at: AT });
  assert.equal(line.decision, "full");
  assert.equal(line.fallback, true);
  assert.equal(line.hardFail, true);
  assert.equal(line.dropped.guardrail, 2);
  // Secret-free: the dropped value is a number, never the guardrail text.
  assert.equal(typeof line.dropped.guardrail, "number");
});

test("[Z1.9] the line carries no dropped token strings anywhere", () => {
  const full = "Set $SUPER_SECRET_TOKEN.\nSet $OTHER.";
  const lean = "Set OTHER."; // SUPER_SECRET_TOKEN dropped
  const line = auditLine(gate(full, lean), { at: AT });
  const blob = JSON.stringify(line);
  assert.equal(blob.includes("SUPER_SECRET_TOKEN"), false);
  assert.equal(line.dropped.param, 1);
});

test("[Z1.9] auditLine accepts a bare receipt too", () => {
  // A receipt has .dropped/.passed but no .flavor/.receipt.
  const g = gate("Run the build.", "Run the build.", { id: "r", type: "skill" });
  const line = auditLine(g.receipt, { at: AT });
  assert.equal(line.id, "r");
  assert.equal(line.decision, "lean");
  assert.equal(line.fallback, false);
});

test("[Z1.9] ts defaults to null when no timestamp is injected", () => {
  const line = auditLine(gate("Run the build.", "Run the build."));
  assert.equal(line.ts, null);
});

test("[Z1.9] serializeAuditLine is a single newline-terminated JSON line", () => {
  const line = auditLine(gate("Run the build.", "Run the build."), { at: AT });
  const s = serializeAuditLine(line);
  assert.equal(s.endsWith("\n"), true);
  assert.equal(s.trimEnd().includes("\n"), false, "must be exactly one line");
  assert.deepEqual(JSON.parse(s), line);
});

test("[Z1.9] auditLine is deterministic for a fixed timestamp", () => {
  const g = gate("You MUST validate.\nRun the build.", "You MUST validate.\nRun the build.");
  assert.deepEqual(auditLine(g, { at: AT }), auditLine(g, { at: AT }));
});

test("[Z1.9] appendAudit is append-only and round-trips through parseAuditLog", () => {
  const dir = mkdtempSync(join(tmpdir(), "fai-audit-"));
  const logPath = join(dir, "fidelity.jsonl");
  try {
    const full = "You MUST validate input.\nRun the build.";
    appendAudit(logPath, gate(full, full, { id: "a", type: "skill" }), { at: AT });
    appendAudit(logPath, gate(full, "Run the build.", { id: "b", type: "skill" }), { at: AT });

    const records = parseAuditLog(readFileSync(logPath, "utf8"));
    assert.equal(records.length, 2, "both lines present (append-only)");
    assert.equal(records[0].id, "a");
    assert.equal(records[0].decision, "lean");
    assert.equal(records[1].id, "b");
    assert.equal(records[1].decision, "full");
    assert.equal(records[1].dropped.guardrail, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[Z1.9] appendAudit stamps a default timestamp when none is given", () => {
  const dir = mkdtempSync(join(tmpdir(), "fai-audit-"));
  const logPath = join(dir, "fidelity.jsonl");
  try {
    const written = appendAudit(logPath, gate("Run the build.", "Run the build.", { id: "t" }));
    assert.equal(typeof written.ts, "string");
    assert.ok(!Number.isNaN(Date.parse(written.ts)), "ts is a valid ISO timestamp");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
