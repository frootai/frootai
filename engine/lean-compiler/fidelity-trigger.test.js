/**
 * [Z1.2] Tests — Trigger-retention checker.
 *
 * Confirms the gate captures activation triggers (USE FOR / Use when / applyTo /
 * Triggers), keeps them separate from imperatives (class separation), preserves
 * glob values, and flags a Lean that drops a trigger. Includes a real-compiler
 * integration check: our own Lean retains every trigger (ratio 1).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTriggerRetention, extractTriggers, normalizeTrigger } from "./fidelity-trigger.js";
import { compile } from "./index.js";

test("[Z1.2] extractTriggers finds USE FOR / Use when / applyTo lines", () => {
  const text = [
    "USE FOR generating a deployment.",
    "Use when the user asks about pricing.",
    'applyTo: "**/*.ts"',
    "This is just descriptive prose, not a trigger.",
  ].join("\n");
  const units = extractTriggers(text);
  assert.equal(units.size, 3);
  assert.ok(units.has("use for generating a deployment"));
  assert.ok(units.has("use when the user asks about pricing"));
  assert.ok(units.has('applyto: "**/*.ts"'));
});

test("[Z1.2] does NOT count a pure imperative line (class separation)", () => {
  const units = extractTriggers("Run the build pipeline.");
  assert.equal(units.size, 0);
});

test("[Z1.2] de-duplicates repeated triggers", () => {
  const units = extractTriggers("USE FOR x.\nUSE FOR x.\n- USE FOR x");
  assert.equal(units.size, 1);
});

test("[Z1.2] full retention yields ratio 1 and no missing", () => {
  const full = "USE FOR deploys.\n- Use when staging.\napplyTo: src/**";
  const lean = "USE FOR deploys. Use when staging. applyTo: src/**";
  const r = checkTriggerRetention(full, lean);
  assert.equal(r.kind, "trigger");
  assert.equal(r.total, 3);
  assert.equal(r.retained, 3);
  assert.equal(r.ratio, 1);
  assert.deepEqual(r.missing, []);
});

test("[Z1.2] a dropped trigger is reported and lowers the ratio", () => {
  const full = "USE FOR deploys.\nUse when staging.";
  const lean = "USE FOR deploys."; // "use when staging" dropped
  const r = checkTriggerRetention(full, lean);
  assert.equal(r.total, 2);
  assert.equal(r.retained, 1);
  assert.deepEqual(r.missing, ["use when staging"]);
  assert.equal(r.ratio, 0.5);
});

test("[Z1.2] applyTo glob value must survive (dropping it fails)", () => {
  const full = 'applyTo: "**/*.ts"';
  const leanKept = 'header applyTo: "**/*.ts" footer';
  const leanDropped = "header applyTo footer";
  assert.equal(checkTriggerRetention(full, leanKept).ratio, 1);
  assert.equal(checkTriggerRetention(full, leanDropped).retained, 0);
});

test("[Z1.2] no triggers in Full → vacuous pass (total 0, ratio 1)", () => {
  const r = checkTriggerRetention("Just explanatory prose.", "");
  assert.equal(r.total, 0);
  assert.equal(r.ratio, 1);
  assert.deepEqual(r.missing, []);
});

test("[Z1.2] normalizeTrigger strips markers/punctuation and lowercases", () => {
  assert.equal(normalizeTrigger("  - USE FOR   Deploys.  "), "use for deploys");
  assert.equal(normalizeTrigger("1. Use when Staging;"), "use when staging");
});

test("[Z1.2] checker is deterministic", () => {
  const full = "USE FOR deploys.\nUse when staging.";
  const lean = "USE FOR deploys. Use when staging.";
  assert.deepEqual(checkTriggerRetention(full, lean), checkTriggerRetention(full, lean));
});

test("[Z1.2] our own Lean retains every trigger (ratio 1)", () => {
  const full = [
    "---",
    'applyTo: "**/*.ts"',
    "---",
    "",
    "# Pricing agent",
    "",
    "USE FOR answering pricing questions from the catalog.",
    "",
    "It is worth noting that this paragraph is purely explanatory background.",
    "",
    "Use when the user mentions cost, plans, or upgrades.",
  ].join("\n");
  const { lean } = compile(full);
  const r = checkTriggerRetention(full, lean);
  assert.equal(r.total > 0, true, "fixture should contain triggers");
  assert.deepEqual(r.missing, []);
  assert.equal(r.ratio, 1);
});
