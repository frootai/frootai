/**
 * [Z10.7] Tests — the SLA / reproducibility doc stays in sync with the code.
 *
 * An SLA that drifts from the implementation is a liability. These tests pin the
 * doc's hard claims (threshold, hard-fail trio, the five checker classes, and
 * the modules that back each guarantee) to the actual exported values + file
 * names, so changing the engine forces an SLA update. All checks are POSITIVE
 * substring assertions (the doc MUST state X) — never negative-needle.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_THRESHOLD, HARD_FAIL_CLASSES } from "./fidelity-score.js";

const DOC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "SLA.md"), "utf8");

test("[Z10.7] SLA cites the actual gate threshold", () => {
  assert.ok(DOC.includes(String(DEFAULT_THRESHOLD)), `SLA must cite threshold ${DEFAULT_THRESHOLD}`);
});

test("[Z10.7] SLA lists exactly the hard-fail classes and groups them as a trio", () => {
  for (const cls of HARD_FAIL_CLASSES) {
    assert.ok(DOC.toLowerCase().includes(cls), `SLA must list hard-fail class ${cls}`);
  }
  assert.ok(/guardrail,?\s+param,?\s+(and\s+)?code/i.test(DOC), "SLA must group guardrail+param+code as hard-fail");
});

test("[Z10.7] SLA names all five retention checkers", () => {
  for (const cls of ["imperative", "trigger", "param", "guardrail", "code"]) {
    assert.ok(DOC.toLowerCase().includes(cls), `SLA must name checker class ${cls}`);
  }
});

test("[Z10.7] SLA references the module that backs each guarantee", () => {
  for (const file of [
    "fidelity-score.js", // the gate
    "fidelity-receipt.js", // determinism / reproducible receipt
    "fetch-audit.js", // audit
    "governance-policy.js", // governance
    "cost-meter.js", // cost transparency
    "lean-compiler-plus", // Lean+ same-gate
  ]) {
    assert.ok(DOC.includes(file), `SLA must reference ${file}`);
  }
});

test("[Z10.7] SLA states the reproducibility / determinism guarantee", () => {
  assert.ok(/determinist/i.test(DOC), "SLA must state determinism");
  assert.ok(/byte-identical/i.test(DOC), "SLA must promise byte-identical output");
  assert.ok(/no\s+timestamps/i.test(DOC), "SLA must state receipts carry no timestamps");
});

test("[Z10.7] SLA states the no-silent-loss fallback to lossless Full", () => {
  assert.ok(/fallback/i.test(DOC), "SLA must describe fallback");
  assert.ok(/full/i.test(DOC), "SLA must mention serving Full");
  assert.ok(/no silent capability loss/i.test(DOC), "SLA must promise no silent capability loss");
});

test("[Z10.7] SLA states the governance is fail-closed and per-tenant", () => {
  assert.ok(/fail-closed/i.test(DOC), "SLA must state fail-closed");
  assert.ok(/per-tenant/i.test(DOC), "SLA must state per-tenant governance");
});

test("[Z10.7] SLA states the audit is append-only and secret-free", () => {
  assert.ok(/append-only/i.test(DOC), "SLA must state append-only audit");
  assert.ok(/secret-free/i.test(DOC), "SLA must state secret-free audit");
});

test("[Z10.7] SLA states cost figures are sourced and never faked", () => {
  assert.ok(/sourced/i.test(DOC), "SLA must state prices are sourced");
  assert.ok(/stale/i.test(DOC), "SLA must state staleness is flagged");
});

test("[Z10.7] SLA states the Lean+ tier uses the same gate, never looser", () => {
  assert.ok(/same\s+(z1\s+)?gate/i.test(DOC), "SLA must state Lean+ uses the same gate");
  assert.ok(/no second gate/i.test(DOC) || /no looser threshold/i.test(DOC), "SLA must rule out a looser gate");
});
