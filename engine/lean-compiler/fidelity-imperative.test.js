/**
 * [Z1.1] Tests — Imperative-retention checker.
 *
 * Verifies the gate (a) finds the directive verb-phrases, (b) does NOT count
 * lines that are really triggers / guardrails / params (class separation keeps
 * the [Z1.6] score from double-counting), and (c) flags a Lean that drops an
 * instruction. Includes a real-compiler integration check: our own Lean must
 * retain every imperative (ratio 1).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkImperativeRetention, extractImperatives, normalizeImperative } from "./fidelity-imperative.js";
import { compile } from "./index.js";

test("[Z1.1] extractImperatives finds directive lines and ignores plain prose", () => {
  const text = [
    "Run the build before pushing.",
    "This paragraph merely explains the rationale and is not an instruction.",
    "- Configure the API endpoint.",
    "1. Deploy the worker.",
  ].join("\n");
  const units = extractImperatives(text);
  assert.equal(units.size, 3);
  assert.ok(units.has("run the build before pushing"));
  assert.ok(units.has("configure the api endpoint"));
  assert.ok(units.has("deploy the worker"));
});

test("[Z1.1] de-duplicates repeated imperatives", () => {
  const units = extractImperatives("Run the build.\nRun the build.\n- Run the build");
  assert.equal(units.size, 1);
});

test("[Z1.1] does NOT count trigger / guardrail / param lines (class separation)", () => {
  // These match a higher-precedence role, so the imperative checker skips them.
  const units = extractImperatives(
    [
      "USE FOR generating a deployment.", // TRIGGER
      "MUST never log secrets.", // GUARDRAIL
      "Set FROOT_API_KEY in the environment.", // PARAM (env var token)
    ].join("\n"),
  );
  assert.equal(units.size, 0);
});

test("[Z1.1] full retention yields ratio 1 and no missing", () => {
  const full = "Run the build.\n- Configure the endpoint.\n1. Deploy the worker.";
  const lean = "Run the build. Configure the endpoint. Deploy the worker.";
  const r = checkImperativeRetention(full, lean);
  assert.equal(r.kind, "imperative");
  assert.equal(r.total, 3);
  assert.equal(r.retained, 3);
  assert.equal(r.ratio, 1);
  assert.deepEqual(r.missing, []);
});

test("[Z1.1] a dropped instruction is reported and lowers the ratio", () => {
  const full = "Run the build.\nConfigure the endpoint.\nDeploy the worker.";
  const lean = "Run the build. Deploy the worker."; // "configure the endpoint" dropped
  const r = checkImperativeRetention(full, lean);
  assert.equal(r.total, 3);
  assert.equal(r.retained, 2);
  assert.deepEqual(r.missing, ["configure the endpoint"]);
  assert.ok(r.ratio > 0.66 && r.ratio < 0.67);
});

test("[Z1.1] retention tolerates list markers and trailing punctuation in Lean", () => {
  const full = "Validate the input.";
  const lean = "- Validate the input;"; // bullet + different terminator
  const r = checkImperativeRetention(full, lean);
  assert.equal(r.retained, 1);
  assert.equal(r.ratio, 1);
});

test("[Z1.1] no imperatives in Full → vacuous pass (total 0, ratio 1)", () => {
  const r = checkImperativeRetention("Just some explanatory prose here.", "");
  assert.equal(r.total, 0);
  assert.equal(r.ratio, 1);
  assert.deepEqual(r.missing, []);
});

test("[Z1.1] normalizeImperative strips markers/punctuation and lowercases", () => {
  assert.equal(normalizeImperative("  - Run   the Build.  "), "run the build");
  assert.equal(normalizeImperative("12. Deploy the Worker;"), "deploy the worker");
});

test("[Z1.1] checker is deterministic", () => {
  const full = "Run the build.\nDeploy the worker.";
  const lean = "Run the build. Deploy the worker.";
  assert.deepEqual(checkImperativeRetention(full, lean), checkImperativeRetention(full, lean));
});

test("[Z1.1] our own Lean retains every imperative (ratio 1)", () => {
  const full = [
    "# Deploy",
    "",
    "It is important to note that the following steps configure the system.",
    "",
    "Run the build pipeline.",
    "",
    "- Configure the staging endpoint.",
    "- Deploy the worker to production.",
    "",
    "Verify the health check responds.",
  ].join("\n");
  const { lean } = compile(full);
  const r = checkImperativeRetention(full, lean);
  assert.equal(r.total > 0, true, "fixture should contain imperatives");
  assert.deepEqual(r.missing, []);
  assert.equal(r.ratio, 1);
});
