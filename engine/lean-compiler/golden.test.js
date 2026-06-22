/**
 * [Z0.11] Tests — golden fixtures (skill, agent, instruction, hook).
 *
 * Row literal: "Unit tests — golden fixtures (skill, agent, instruction, hook)".
 *
 * Each fixture is a committed Full→Lean snapshot pair in `./fixtures/`:
 *   <name>.md       — the Full primitive (intentionally verbose)
 *   <name>.lean.md  — the blessed Lean output of `compile()`
 *
 * The golden test recompiles the Full and asserts byte-equality with the
 * committed Lean. ANY change in compressor behaviour trips the matching golden,
 * so a future tweak can't silently alter real output. Goldens are regenerated
 * deliberately (run the compiler, eyeball the diff, re-commit) — never by the
 * test itself.
 *
 * Each fixture also asserts:
 *   - the compile is a fixed point ([Z0.10] idempotence), and
 *   - every behaviour-bearing line (MUST / NEVER / USE FOR / DO NOT USE FOR)
 *     survives verbatim in the Lean ([Z0.7] preservation, observable form).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compile, isFixedPoint } from "./index.js";

const FIXTURES = ["skill", "agent", "instruction", "hook"];
const lf = (s) => s.replace(/\r\n/g, "\n");
const read = (rel) => lf(readFileSync(new URL(rel, import.meta.url), "utf8"));

// Behaviour-bearing lines that must appear verbatim in the Lean output.
const BEHAVIOUR_RE = /\b(MUST|NEVER|USE FOR|DO NOT USE FOR)\b/;

for (const name of FIXTURES) {
  test(`[Z0.11] golden: ${name} compiles to its committed Lean snapshot`, () => {
    const full = read(`./fixtures/${name}.md`);
    const golden = read(`./fixtures/${name}.lean.md`);
    const { lean } = compile(full);
    assert.equal(
      lf(lean),
      golden,
      `Lean output drifted from the committed golden for ${name}.md — ` +
        `regenerate ./fixtures/${name}.lean.md if this change is intended.`,
    );
  });

  test(`[Z0.11] golden: ${name} is a fixed point and shrinks`, () => {
    const full = read(`./fixtures/${name}.md`);
    assert.equal(isFixedPoint(full), true);
    assert.ok(compile(full).sidecar.saved > 0, `${name} fixture should compress`);
  });

  test(`[Z0.11] golden: ${name} preserves every behaviour-bearing line`, () => {
    const full = read(`./fixtures/${name}.md`);
    const { lean } = compile(full);
    const leanText = lf(lean);
    for (const line of full.split("\n")) {
      const t = line.trim();
      if (t && BEHAVIOUR_RE.test(t)) {
        assert.ok(
          leanText.includes(t),
          `behaviour line dropped from ${name} Lean: "${t}"`,
        );
      }
    }
  });
}
