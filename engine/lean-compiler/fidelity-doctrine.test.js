/**
 * [Z1.12] Tests — the FIDELITY doctrine doc stays in sync with the code.
 *
 * A doctrine doc that drifts from the implementation is worse than none. These
 * tests pin the doc's hard claims (weights, threshold, hard-fail classes, the
 * five checker classes) to the actual exported values, so changing the gate
 * forces a doc update.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_WEIGHTS, DEFAULT_THRESHOLD, HARD_FAIL_CLASSES } from "./fidelity-score.js";

const DOC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "FIDELITY.md"), "utf8");

test("[Z1.12] doc names every behaviour class and its checker", () => {
  for (const cls of ["guardrail", "imperative", "param", "trigger", "code"]) {
    assert.ok(DOC.toLowerCase().includes(cls), `doc must mention ${cls}`);
  }
  for (const file of [
    "fidelity-guardrail",
    "fidelity-imperative",
    "fidelity-param",
    "fidelity-trigger",
    "fidelity-code",
  ]) {
    assert.ok(DOC.includes(file), `doc must reference ${file}`);
  }
});

test("[Z1.12] doc cites the actual default weights", () => {
  for (const [cls, w] of Object.entries(DEFAULT_WEIGHTS)) {
    // Each weight appears as `cls 0.NN` somewhere in the weights paragraph.
    const re = new RegExp(`${cls}\\s+${w.toFixed(2).replace(".", "\\.")}`, "i");
    assert.ok(re.test(DOC), `doc must cite weight ${cls} ${w.toFixed(2)}`);
  }
});

test("[Z1.12] doc cites the actual default threshold", () => {
  assert.ok(DOC.includes(String(DEFAULT_THRESHOLD)), `doc must cite threshold ${DEFAULT_THRESHOLD}`);
});

test("[Z1.12] doc lists exactly the hard-fail classes", () => {
  for (const cls of HARD_FAIL_CLASSES) {
    assert.ok(DOC.toLowerCase().includes(cls), `doc must list hard-fail class ${cls}`);
  }
  // The doc must describe the hard-fail trio together.
  assert.ok(/guardrail,?\s+param,?\s+(and\s+)?code/i.test(DOC), "doc must group guardrail+param+code as hard-fail");
});

test("[Z1.12] doc states the two non-negotiables (indentation + Full fallback)", () => {
  assert.ok(/indentation/i.test(DOC), "doc must call out code indentation");
  assert.ok(/fall ?back/i.test(DOC) && /byte-identical/i.test(DOC), "doc must state byte-identical Full fallback");
});
