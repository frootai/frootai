/**
 * [Z1.7] Tests — Full↔Lean diff receipt.
 *
 * The receipt records the verdict, the token/byte savings, and the per-class
 * diff (dropped behaviour). It must be deterministic (no timestamps) and
 * serialize stably. Includes a real-compiler check.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReceipt, serializeReceipt, receiptPath, CLASS_ORDER } from "./fidelity-receipt.js";
import { compile } from "./index.js";

test("[Z1.7] a passing Lean yields an empty diff and passed:true", () => {
  const full = "You MUST validate input.\nRun the build.\nSet $FROOT_API_KEY.";
  const r = buildReceipt(full, full, { id: "demo", type: "skill" });
  assert.equal(r.id, "demo");
  assert.equal(r.type, "skill");
  assert.equal(r.passed, true);
  assert.equal(r.hardFail, false);
  assert.equal(r.score, 10);
  for (const kind of CLASS_ORDER) assert.deepEqual(r.dropped[kind], []);
});

test("[Z1.7] a dropped guardrail is recorded in the diff and fails", () => {
  const full = "You MUST validate input.\nNEVER log secrets.";
  const lean = "You MUST validate input."; // NEVER dropped
  const r = buildReceipt(full, lean);
  assert.equal(r.passed, false);
  assert.equal(r.hardFail, true);
  assert.deepEqual(r.dropped.guardrail, ["never log secrets"]);
  assert.ok(r.reasons.some((x) => x.startsWith("guardrail dropped")));
});

test("[Z1.7] token + byte savings are computed", () => {
  const full = "It is very important to note that you should run the build pipeline now.";
  const lean = "Run the build pipeline.";
  const r = buildReceipt(full, lean);
  assert.equal(r.tokens.full > r.tokens.lean, true);
  assert.equal(r.tokens.saved, r.tokens.full - r.tokens.lean);
  assert.equal(r.tokens.savedPct, Math.round((r.tokens.saved / r.tokens.full) * 100));
  assert.equal(r.bytes.full, full.length);
  assert.equal(r.bytes.lean, lean.length);
});

test("[Z1.7] id/type default to null when no meta is given", () => {
  const r = buildReceipt("Run the build.", "Run the build.");
  assert.equal(r.id, null);
  assert.equal(r.type, null);
});

test("[Z1.7] dropped carries all five classes in canonical order", () => {
  const r = buildReceipt("Run the build.", "Run the build.");
  assert.deepEqual(Object.keys(r.dropped), CLASS_ORDER);
  for (const kind of CLASS_ORDER) assert.ok(Array.isArray(r.dropped[kind]));
});

test("[Z1.7] receipt is deterministic (no timestamps / host paths)", () => {
  const full = "You MUST validate.\nRun the build.\nSet $FROOT_API_KEY.";
  const a = buildReceipt(full, full, { id: "x", type: "skill" });
  const b = buildReceipt(full, full, { id: "x", type: "skill" });
  assert.deepEqual(a, b);
  // No wall-clock / environment keys leak into the receipt.
  for (const key of ["generatedAt", "timestamp", "date", "cwd", "path", "host"]) {
    assert.equal(key in a, false, `receipt must not contain ${key}`);
  }
});

test("[Z1.7] serializeReceipt is stable JSON, newline-terminated and round-trips", () => {
  const r = buildReceipt("Run the build.", "Run the build.", { id: "x", type: "skill" });
  const s1 = serializeReceipt(r);
  const s2 = serializeReceipt(buildReceipt("Run the build.", "Run the build.", { id: "x", type: "skill" }));
  assert.equal(s1, s2);
  assert.equal(s1.endsWith("\n"), true);
  assert.deepEqual(JSON.parse(s1), r);
});

test("[Z1.7] receiptPath derives a sibling .fidelity.json", () => {
  assert.equal(receiptPath("skills/foo/SKILL.md"), "skills/foo/SKILL.fidelity.json");
  assert.equal(receiptPath("agents/bar.agent.md"), "agents/bar.agent.fidelity.json");
  assert.equal(receiptPath("README"), "README.fidelity.json");
});

test("[Z1.7] options (threshold/weights) forward to the verdict", () => {
  const full = "Run a.\nDeploy b."; // 2 imperatives
  const lean = "Run a."; // imperative ratio 0.5
  const strict = buildReceipt(full, lean);
  const lenient = buildReceipt(full, lean, {}, { threshold: 5 });
  assert.equal(strict.passed, false);
  assert.equal(lenient.passed, true);
  assert.equal(lenient.threshold, 5);
});

test("[Z1.7] our own Lean produces a passing receipt with non-negative savings", () => {
  const full = [
    "# Deploy",
    "",
    "It is worth noting that this paragraph is purely explanatory background prose.",
    "",
    "You MUST validate every input.",
    "",
    "Run the build with --write.",
    "",
    "```ts",
    "const x = 1;",
    "```",
  ].join("\n");
  const { lean } = compile(full);
  const r = buildReceipt(full, lean, { id: "deploy", type: "skill" });
  assert.equal(r.passed, true);
  assert.equal(r.hardFail, false);
  assert.equal(r.tokens.saved >= 0, true);
  for (const kind of CLASS_ORDER) assert.deepEqual(r.dropped[kind], []);
});
