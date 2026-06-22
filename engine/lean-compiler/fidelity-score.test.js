/**
 * [Z1.6] Tests — Weighted fidelity score + threshold reject.
 *
 * Verifies the two reject paths: (1) the weighted score gates prose loss against
 * a threshold, and (2) the exact/safety classes (guardrail, param, code) HARD-
 * FAIL on any drop regardless of score. Includes a real-compiler check (our own
 * Lean scores a perfect 10 and passes).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFidelity, DEFAULT_WEIGHTS, DEFAULT_THRESHOLD, HARD_FAIL_CLASSES } from "./fidelity-score.js";
import { compile } from "./index.js";

test("[Z1.6] default weights sum to 1.0", () => {
  const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, w) => a + w, 0);
  assert.equal(Math.round(sum * 1e6) / 1e6, 1);
});

test("[Z1.6] an identical Lean scores a perfect 10 and passes", () => {
  const doc = [
    "USE FOR deploys.",
    "You MUST validate input.",
    "Set $FROOT_API_KEY.",
    "Run the build.",
    "```ts",
    "const x = 1;",
    "```",
  ].join("\n");
  const r = scoreFidelity(doc, doc);
  assert.equal(r.score, 10);
  assert.equal(r.passed, true);
  assert.equal(r.hardFail, false);
  assert.deepEqual(r.reasons, []);
});

test("[Z1.6] a dropped guardrail HARD-FAILS even with an otherwise perfect doc", () => {
  const full = "You MUST validate input.\nNEVER log secrets.\nRun the build.";
  const lean = "You MUST validate input. Run the build."; // NEVER prohibition dropped
  const r = scoreFidelity(full, lean);
  assert.equal(r.hardFail, true);
  assert.equal(r.passed, false);
  assert.equal(r.checks.guardrail.ratio < 1, true);
  assert.ok(r.reasons.some((x) => x.startsWith("guardrail dropped")));
});

test("[Z1.6] a dropped param HARD-FAILS", () => {
  const full = "Set $FROOT_API_KEY and $FROOT_REGION.";
  const lean = "Set FROOT_API_KEY."; // FROOT_REGION dropped
  const r = scoreFidelity(full, lean);
  assert.equal(r.hardFail, true);
  assert.equal(r.passed, false);
  assert.ok(r.reasons.some((x) => x.startsWith("param dropped")));
});

test("[Z1.6] a mutated code line HARD-FAILS", () => {
  const full = "```ts\nconst timeout = 30;\n```";
  const lean = "```ts\nconst timeout = 3000;\n```";
  const r = scoreFidelity(full, lean);
  assert.equal(r.hardFail, true);
  assert.equal(r.passed, false);
  assert.ok(r.reasons.some((x) => x.startsWith("code dropped")));
});

test("[Z1.6] prose loss alone is a threshold reject, not a hard-fail", () => {
  // Four imperatives, two dropped → imperative ratio 0.5, no exact-class loss.
  const full = "Run the build.\nDeploy the worker.\nValidate the input.\nVerify the health check.";
  const lean = "Run the build. Deploy the worker."; // two imperatives dropped
  const r = scoreFidelity(full, lean);
  assert.equal(r.hardFail, false, "imperative loss must not hard-fail");
  assert.equal(r.passed, false, "but it should fail the threshold");
  assert.equal(r.checks.imperative.ratio, 0.5);
  assert.ok(r.score < DEFAULT_THRESHOLD);
  assert.ok(r.reasons.some((x) => x.includes("threshold")));
});

test("[Z1.6] minor prose loss can still pass when above threshold", () => {
  // One of five imperatives lost → ratio 0.8; with weight 0.25 the score is
  // 10·(0.75 + 0.25·0.8) = 9.5, exactly the threshold → passes.
  const full = "Run a.\nDeploy b.\nValidate c.\nVerify d.\nConfigure e.";
  const lean = "Run a. Deploy b. Validate c. Verify d."; // "configure e" dropped
  const r = scoreFidelity(full, lean);
  assert.equal(r.checks.imperative.ratio, 0.8);
  assert.equal(r.hardFail, false);
  assert.equal(r.score, 9.5);
  assert.equal(r.passed, true);
});

test("[Z1.6] ratios and full checks are exposed for every class", () => {
  const r = scoreFidelity("Run the build.", "Run the build.");
  for (const kind of ["imperative", "trigger", "param", "guardrail", "code"]) {
    assert.equal(typeof r.ratios[kind], "number");
    assert.equal(r.checks[kind].kind, kind);
  }
});

test("[Z1.6] custom threshold and weights are honored and normalized", () => {
  const full = "Run a.\nDeploy b.";
  const lean = "Run a."; // imperative ratio 0.5
  // Make imperative the only weight → score = 10·0.5 = 5.0; lower threshold to pass.
  const r = scoreFidelity(full, lean, { weights: { imperative: 1 }, threshold: 4, hardFailClasses: [] });
  assert.equal(r.score, 5);
  assert.equal(r.passed, true);
  assert.equal(r.threshold, 4);
});

test("[Z1.6] hard-fail classes are configurable", () => {
  const full = "Run a.\nDeploy b.";
  const lean = "Run a.";
  // Treat imperative as a hard-fail class → any imperative drop rejects.
  const r = scoreFidelity(full, lean, { hardFailClasses: ["imperative"] });
  assert.equal(r.hardFail, true);
  assert.equal(r.passed, false);
});

test("[Z1.6] scorer is deterministic", () => {
  const full = "You MUST validate.\nRun the build.\nSet $FROOT_API_KEY.";
  const lean = full;
  assert.deepEqual(scoreFidelity(full, lean), scoreFidelity(full, lean));
});

test("[Z1.6] our own Lean scores 10 and passes the gate", () => {
  const full = [
    "---",
    'applyTo: "**/*.ts"',
    "---",
    "",
    "# Secure deploy",
    "",
    "USE FOR deploying the worker.",
    "",
    "It is important to note this paragraph is purely explanatory background prose.",
    "",
    "You MUST validate every input.",
    "- NEVER log secrets.",
    "",
    "Set the FROOT_API_KEY environment variable, then run with --write.",
    "",
    "Edit the src/app/config.ts file.",
    "",
    "```ts",
    "const timeout = 30;",
    "```",
  ].join("\n");
  const { lean } = compile(full);
  const r = scoreFidelity(full, lean);
  assert.equal(r.hardFail, false);
  assert.equal(r.passed, true);
  assert.equal(r.score, 10);
});
