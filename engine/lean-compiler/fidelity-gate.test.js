/**
 * [Z1.8] Tests — Reject-and-fallback path.
 *
 * The gate serves Lean only when it passes; otherwise it falls back to Full so a
 * failing Lean is never user-visible. The served Full must be byte-identical to
 * the input (no silent loss in the fallback). Includes a real-compiler check.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { gate } from "./fidelity-gate.js";
import { compile } from "./index.js";

test("[Z1.8] a passing Lean is served (flavor lean, no fallback)", () => {
  const full = "You MUST validate input.\nRun the build.\nSet $FROOT_API_KEY.";
  const g = gate(full, full, { id: "demo", type: "skill" });
  assert.equal(g.flavor, "lean");
  assert.equal(g.served, full);
  assert.equal(g.fallback, false);
  assert.equal(g.reason, null);
  assert.equal(g.receipt.passed, true);
});

test("[Z1.8] a dropped guardrail forces a fallback to Full", () => {
  const full = "You MUST validate input.\nNEVER log secrets.\nRun the build.";
  const lean = "You MUST validate input. Run the build."; // NEVER dropped
  const g = gate(full, lean);
  assert.equal(g.flavor, "full");
  assert.equal(g.served, full); // reader silently gets Full
  assert.equal(g.fallback, true);
  assert.ok(g.reason.includes("guardrail dropped"));
});

test("[Z1.8] the fallback serves Full byte-identically (no silent loss)", () => {
  const full = "NEVER log secrets.\nRun the build.";
  const lean = "Run the build."; // guardrail dropped → fallback
  const g = gate(full, lean);
  assert.equal(g.fallback, true);
  assert.equal(g.served, full);
});

test("[Z1.8] a threshold-only failure also falls back", () => {
  const full = "Run a.\nDeploy b.\nValidate c.\nVerify d."; // 4 imperatives
  const lean = "Run a. Deploy b."; // half dropped, no exact-class loss
  const g = gate(full, lean);
  assert.equal(g.flavor, "full");
  assert.equal(g.fallback, true);
  assert.ok(g.reason.includes("threshold"));
});

test("[Z1.8] an empty Lean for a non-empty Full falls back even if vacuously passing", () => {
  const full = "Just explanatory prose with no behaviour tokens.";
  const g = gate(full, "");
  assert.equal(g.receipt.passed, true, "no behaviour to drop → receipt passes vacuously");
  assert.equal(g.flavor, "full");
  assert.equal(g.fallback, true);
  assert.ok(g.reason.includes("lean is empty"));
});

test("[Z1.8] the full Z1.7 receipt is attached", () => {
  const g = gate("Run the build.", "Run the build.", { id: "x", type: "skill" });
  assert.equal(g.receipt.id, "x");
  assert.equal(g.receipt.type, "skill");
  assert.ok(Array.isArray(g.receipt.dropped.guardrail));
  assert.equal(typeof g.receipt.score, "number");
});

test("[Z1.8] options forward to the scorer (lenient threshold serves Lean)", () => {
  const full = "Run a.\nDeploy b."; // 2 imperatives
  const lean = "Run a."; // imperative ratio 0.5
  assert.equal(gate(full, lean).flavor, "full");
  assert.equal(gate(full, lean, {}, { threshold: 5 }).flavor, "lean");
});

test("[Z1.8] gate is deterministic", () => {
  const full = "You MUST validate.\nRun the build.\nSet $FROOT_API_KEY.";
  assert.deepEqual(gate(full, full), gate(full, full));
});

test("[Z1.8] our own Lean is served by the gate (flavor lean, no fallback)", () => {
  const full = [
    "# Deploy",
    "",
    "It is worth noting that this paragraph is purely explanatory background prose.",
    "",
    "You MUST validate every input.",
    "- NEVER log secrets.",
    "",
    "Set the FROOT_API_KEY environment variable, then run with --write.",
    "",
    "```ts",
    "const x = 1;",
    "```",
  ].join("\n");
  const { lean } = compile(full);
  const g = gate(full, lean, { id: "deploy", type: "skill" });
  assert.equal(g.flavor, "lean");
  assert.equal(g.served, lean);
  assert.equal(g.fallback, false);
});
