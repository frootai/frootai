/**
 * [Z1.10] Tests — Adversarial fidelity fixtures.
 *
 * This is the PROOF the fidelity gate ([Z1.1]–[Z1.8]) actually defends the
 * "Lean == same capability" claim that the cloned competitors never make. Each
 * fixture is a deliberately-LOSSY Lean of the same Full — the kind a naive (or
 * over-eager LLM) compressor would emit — and the gate MUST catch it: fall back
 * to Full so the loss never reaches a user. The one faithful paraphrase, which
 * keeps every behaviour token, must still PASS.
 *
 * The canonical Full below carries one unit of every behaviour class: a trigger,
 * a guardrail, a param/env-var, an imperative, and a fenced code block.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { gate } from "./fidelity-gate.js";

const FULL = [
  "---",
  'applyTo: "**/*.ts"',
  "---",
  "",
  "# Token issuer",
  "",
  "USE FOR issuing short-lived access tokens.",
  "",
  "It is worth noting that this paragraph is purely explanatory background prose.",
  "",
  "You MUST validate the audience claim.",
  "- NEVER log the signing secret.",
  "",
  "Set the FROOT_SIGNING_KEY environment variable, then run with --rotate.",
  "",
  "Issue the token for the requested scope.",
  "",
  "```ts",
  "const ttlSeconds = 300;",
  "```",
].join("\n");

/** A faithful Lean (our compiler's posture): all behaviour tokens survive. */
const FAITHFUL_LEAN = [
  "---",
  'applyTo: "**/*.ts"',
  "---",
  "# Token issuer",
  "USE FOR issuing short-lived access tokens.",
  "You MUST validate the audience claim.",
  "- NEVER log the signing secret.",
  "Set the FROOT_SIGNING_KEY environment variable, then run with --rotate.",
  "Issue the token for the requested scope.",
  "```ts",
  "const ttlSeconds = 300;",
  "```",
].join("\n");

test("[Z1.10] sanity: the faithful Lean PASSES the gate", () => {
  const g = gate(FULL, FAITHFUL_LEAN, { id: "issuer", type: "skill" });
  assert.equal(g.flavor, "lean");
  assert.equal(g.fallback, false);
  assert.equal(g.receipt.hardFail, false);
});

test("[Z1.10] ADVERSARIAL: dropped guardrail is caught (hard-fail → Full)", () => {
  // The compressor silently drops the "NEVER log the signing secret" line.
  const evil = FAITHFUL_LEAN.replace("- NEVER log the signing secret.\n", "");
  const g = gate(FULL, evil);
  assert.equal(g.fallback, true);
  assert.equal(g.flavor, "full");
  assert.equal(g.receipt.hardFail, true);
  assert.equal(g.receipt.dropped.guardrail.length, 1);
});

test("[Z1.10] ADVERSARIAL: a REWORDED guardrail is still caught (conservative)", () => {
  // "NEVER log the signing secret" → "avoid logging the secret": semantically
  // similar but the prohibition token is gone, so the gate rejects (better safe).
  const evil = FAITHFUL_LEAN.replace("- NEVER log the signing secret.", "- Avoid logging the secret.");
  const g = gate(FULL, evil);
  assert.equal(g.fallback, true);
  assert.equal(g.receipt.hardFail, true);
});

test("[Z1.10] ADVERSARIAL: dropped env-var param is caught (hard-fail → Full)", () => {
  const evil = FAITHFUL_LEAN.replace("FROOT_SIGNING_KEY environment variable, then run with --rotate", "signing key, then rotate");
  const g = gate(FULL, evil);
  assert.equal(g.fallback, true);
  assert.equal(g.receipt.hardFail, true);
  // both the env var and the --rotate flag were lost
  assert.ok(g.receipt.dropped.param.length >= 1);
});

test("[Z1.10] ADVERSARIAL: a mutated code value is caught (byte-identity → Full)", () => {
  // 300s TTL silently becomes 30000s — a real security regression.
  const evil = FAITHFUL_LEAN.replace("const ttlSeconds = 300;", "const ttlSeconds = 30000;");
  const g = gate(FULL, evil);
  assert.equal(g.fallback, true);
  assert.equal(g.receipt.hardFail, true);
  assert.equal(g.receipt.dropped.code.length, 1);
});

test("[Z1.10] ADVERSARIAL: a dropped code block is caught", () => {
  const evil = FAITHFUL_LEAN.replace("```ts\nconst ttlSeconds = 300;\n```", "");
  const g = gate(FULL, evil);
  assert.equal(g.fallback, true);
  assert.equal(g.receipt.hardFail, true);
});

test("[Z1.10] ADVERSARIAL: a dropped trigger is caught (threshold → Full)", () => {
  const evil = FAITHFUL_LEAN.replace("USE FOR issuing short-lived access tokens.\n", "");
  const g = gate(FULL, evil);
  assert.equal(g.fallback, true);
  assert.equal(g.flavor, "full");
  assert.equal(g.receipt.ratios.trigger < 1, true);
});

test("[Z1.10] ADVERSARIAL: an over-summarized Lean (title only) is caught", () => {
  const evil = "# Token issuer\nIssues tokens.";
  const g = gate(FULL, evil);
  assert.equal(g.fallback, true);
  assert.equal(g.receipt.hardFail, true); // guardrail + param + code all gone
});

test("[Z1.10] ADVERSARIAL: a truncated Lean (first half only) is caught", () => {
  const half = FAITHFUL_LEAN.slice(0, Math.floor(FAITHFUL_LEAN.length / 2));
  const g = gate(FULL, half);
  assert.equal(g.fallback, true);
});

test("[Z1.10] ADVERSARIAL: an empty Lean is caught (boundary guard → Full)", () => {
  const g = gate(FULL, "");
  assert.equal(g.fallback, true);
  assert.equal(g.flavor, "full");
});

test("[Z1.10] ADVERSARIAL: whitespace-only changes are NOT a false positive (still passes)", () => {
  // Reclaiming blank lines / trailing spaces is the compressor's legitimate
  // remit — it must NOT be mistaken for behaviour loss.
  const ws = FAITHFUL_LEAN.replace(/^/gm, "").replace("const ttlSeconds = 300;", "const ttlSeconds = 300;   ");
  const g = gate(FULL, ws);
  assert.equal(g.flavor, "lean");
  assert.equal(g.fallback, false);
});

test("[Z1.10] every adversarial fallback still serves Full byte-identically", () => {
  for (const evil of ["", "# Token issuer", FAITHFUL_LEAN.replace("- NEVER log the signing secret.\n", "")]) {
    const g = gate(FULL, evil);
    assert.equal(g.fallback, true);
    assert.equal(g.served, FULL);
  }
});
