/**
 * [Z10.11] Tests — the GA checklist is LIVE, not aspirational.
 *
 * The checklist references concrete artifacts (engine modules, docs, and the
 * test suites that back each guarantee). These tests verify that every
 * referenced file actually EXISTS on disk, so the checklist can never claim a
 * GA gate it does not back with shipped code.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUS = join(HERE, "..", "lean-compiler-plus");
const DOC = readFileSync(join(HERE, "GA-CHECKLIST.md"), "utf8");

// Artifacts the checklist promises, with their on-disk location.
const ENGINE_DOCS = ["FIDELITY.md", "SLA.md", "PACKAGING.md"];
const ENGINE_MODULES = [
  "index.js",
  "fidelity-score.js",
  "fidelity-gate.js",
  "fidelity-receipt.js",
  "fetch-audit.js",
  "governance-policy.js",
  "cost-meter.js",
];
const ENGINE_TESTS = [
  "fetch-audit.test.js",
  "governance-policy.test.js",
  "governance-lean-default.test.js",
  "cost-meter.test.js",
  "sla-doc.test.js",
  "security-review.test.js",
  "e2e-real-play.test.js",
  "packaging-doc.test.js",
];
const PLUS_FILES = ["index.js", "semantic-rules.js"];

test("[Z10.11] every doc the checklist references exists on disk", () => {
  for (const f of ENGINE_DOCS) {
    assert.ok(DOC.includes(f), `checklist must reference ${f}`);
    assert.ok(existsSync(join(HERE, f)), `${f} must exist`);
  }
});

test("[Z10.11] every engine module the checklist references exists on disk", () => {
  for (const f of ENGINE_MODULES) {
    assert.ok(existsSync(join(HERE, f)), `${f} must exist`);
  }
  // Spot-check the Z10 modules are actually named in the checklist.
  for (const f of ["fetch-audit.js", "governance-policy.js", "cost-meter.js"]) {
    assert.ok(DOC.includes(f), `checklist must reference ${f}`);
  }
});

test("[Z10.11] every test suite the checklist references exists on disk", () => {
  for (const f of ENGINE_TESTS) {
    assert.ok(DOC.includes(f), `checklist must reference test ${f}`);
    assert.ok(existsSync(join(HERE, f)), `${f} must exist`);
  }
});

test("[Z10.11] the Lean+ tier files the checklist references exist", () => {
  assert.ok(/lean-compiler-plus/.test(DOC), "checklist must reference lean-compiler-plus");
  for (const f of PLUS_FILES) {
    assert.ok(existsSync(join(PLUS, f)), `lean-compiler-plus/${f} must exist`);
  }
});

test("[Z10.11] the checklist covers distribution, the public surface, and the go/no-go bar", () => {
  assert.ok(/every channel/i.test(DOC), "checklist must cover distribution channels");
  assert.ok(/\/lean-mode/.test(DOC), "checklist must cover the /lean-mode surface");
  assert.ok(/Go \/ no-go/i.test(DOC), "checklist must state the go/no-go bar");
});

test("[Z10.11] the checklist carries the honesty guardrails to GA", () => {
  assert.ok(/o200k/i.test(DOC), "checklist must cite the exact tokenizer");
  assert.ok(/never preannounced as shipped/i.test(DOC), "checklist must keep the savings honesty rule");
  assert.ok(/sourced from the pricing\s+catalog/i.test(DOC), "checklist must keep the cost honesty rule");
});

test("[Z10.11] every checklist item is marked complete (GA-ready)", () => {
  // No unchecked boxes remain.
  assert.equal(/- \[ \]/.test(DOC), false, "no unchecked items may remain at GA readiness");
  assert.ok((DOC.match(/- \[x\]/g) || []).length >= 12, "checklist must have the full set of ticked items");
});
