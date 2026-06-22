/**
 * [Z1.4] Tests — Guardrail-retention checker.
 *
 * Guardrails are the safety class, so the gate must (a) capture MUST/NEVER/DO
 * NOT directives and the security idioms, (b) keep them separate from plain
 * imperatives, and (c) FAIL the moment a Lean drops a prohibition. Includes a
 * real-compiler integration check: our own Lean retains every guardrail.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGuardrailRetention, extractGuardrails, normalizeGuardrail } from "./fidelity-guardrail.js";
import { compile } from "./index.js";

test("[Z1.4] extractGuardrails finds MUST / NEVER / DO NOT directives", () => {
  const text = [
    "You MUST validate every input.",
    "NEVER log secrets.",
    "Do not commit credentials to the repo.",
    "This sentence is ordinary explanatory prose.",
  ].join("\n");
  const units = extractGuardrails(text);
  assert.equal(units.size, 3);
  assert.ok(units.has("you must validate every input"));
  assert.ok(units.has("never log secrets"));
  assert.ok(units.has("do not commit credentials to the repo"));
});

test("[Z1.4] captures security idioms without an explicit modal", () => {
  const units = extractGuardrails("Use managed identity and enforce least privilege.");
  assert.equal(units.size, 1);
  assert.ok(units.has("use managed identity and enforce least privilege"));
});

test("[Z1.4] does NOT count a plain imperative line (class separation)", () => {
  const units = extractGuardrails("Run the build pipeline.");
  assert.equal(units.size, 0);
});

test("[Z1.4] de-duplicates repeated guardrails", () => {
  const units = extractGuardrails("NEVER log secrets.\nNEVER log secrets.\n- NEVER log secrets");
  assert.equal(units.size, 1);
});

test("[Z1.4] full retention yields ratio 1 and no missing", () => {
  const full = "You MUST sanitize inputs.\n- NEVER expose the key.";
  const lean = "You MUST sanitize inputs. NEVER expose the key.";
  const r = checkGuardrailRetention(full, lean);
  assert.equal(r.kind, "guardrail");
  assert.equal(r.total, 2);
  assert.equal(r.retained, 2);
  assert.equal(r.ratio, 1);
  assert.deepEqual(r.missing, []);
});

test("[Z1.4] a dropped guardrail is reported and lowers the ratio (worst-case failure)", () => {
  const full = "You MUST validate input.\nNEVER log secrets.";
  const lean = "You MUST validate input."; // the NEVER prohibition was dropped
  const r = checkGuardrailRetention(full, lean);
  assert.equal(r.total, 2);
  assert.equal(r.retained, 1);
  assert.deepEqual(r.missing, ["never log secrets"]);
  assert.equal(r.ratio, 0.5);
});

test("[Z1.4] no guardrails in Full → vacuous pass (total 0, ratio 1)", () => {
  const r = checkGuardrailRetention("Just explanatory prose here.", "");
  assert.equal(r.total, 0);
  assert.equal(r.ratio, 1);
  assert.deepEqual(r.missing, []);
});

test("[Z1.4] normalizeGuardrail strips markers/punctuation and lowercases", () => {
  assert.equal(normalizeGuardrail("  - You MUST   Validate.  "), "you must validate");
  assert.equal(normalizeGuardrail("1. NEVER Log Secrets;"), "never log secrets");
});

test("[Z1.4] checker is deterministic", () => {
  const full = "You MUST sanitize.\nNEVER log secrets.";
  const lean = "You MUST sanitize. NEVER log secrets.";
  assert.deepEqual(checkGuardrailRetention(full, lean), checkGuardrailRetention(full, lean));
});

test("[Z1.4] our own Lean retains every guardrail (ratio 1)", () => {
  const full = [
    "# Secure deploy",
    "",
    "It is worth noting that this paragraph is purely explanatory background.",
    "",
    "You MUST validate every input before processing.",
    "",
    "- NEVER log secrets or credentials.",
    "- Use managed identity; do not hard-code keys.",
    "",
    "Enforce least privilege on all role assignments.",
  ].join("\n");
  const { lean } = compile(full);
  const r = checkGuardrailRetention(full, lean);
  assert.equal(r.total > 0, true, "fixture should contain guardrails");
  assert.deepEqual(r.missing, []);
  assert.equal(r.ratio, 1);
});
