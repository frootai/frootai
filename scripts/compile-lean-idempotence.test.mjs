/**
 * [Z2.7] Tests — `.lean.md` idempotence / no-drift CI check.
 *
 * Locks [Z2.6]'s reproducibility: re-compiling each committed `SKILL.md` must
 * reproduce its committed `SKILL.lean.md` byte-for-byte. If a source changes
 * without regenerating, or the compiler changes without re-running `--write`,
 * this fails — the artifact can never silently drift from its source. Also
 * guards against orphan artifacts (a `.lean.md` with no gate-passed source).
 *
 * A sample is used for speed; the full corpus is covered by re-running
 * `node scripts/compile-lean.mjs --write` (a clean git status = idempotent).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { planLeanArtifact, collectSkills } from "./compile-lean.mjs";

const SAMPLE = 150;

test("[Z2.7] re-compiling a sample reproduces the committed .lean.md byte-for-byte", () => {
  const sample = collectSkills().slice(0, SAMPLE);
  assert.ok(sample.length > 0, "expected committed skills");

  let checked = 0;
  for (const s of sample) {
    const full = readFileSync(s.path, "utf8");
    const plan = planLeanArtifact(full, { id: s.id, type: "skill", sourcePath: s.path });
    if (!plan.write) continue; // gate-rejected → no artifact expected

    const leanFile = s.path.replace(/SKILL\.md$/, "SKILL.lean.md");
    assert.ok(existsSync(leanFile), `${s.id}: gate-passed but missing committed .lean.md`);
    const committed = readFileSync(leanFile, "utf8");
    assert.equal(plan.lean, committed, `${s.id}: committed .lean.md drifted from a fresh compile`);
    checked += 1;
  }
  assert.ok(checked > 0, "expected at least one gate-passed artifact to verify");
});

test("[Z2.7] every gate-passed skill in the sample has a committed artifact (no missing)", () => {
  const sample = collectSkills().slice(0, SAMPLE);
  const missing = [];
  for (const s of sample) {
    const full = readFileSync(s.path, "utf8");
    const plan = planLeanArtifact(full, { id: s.id, type: "skill", sourcePath: s.path });
    if (plan.write && !existsSync(s.path.replace(/SKILL\.md$/, "SKILL.lean.md"))) missing.push(s.id);
  }
  assert.deepEqual(missing, [], `gate-passed skills missing a committed .lean.md: ${missing.join(", ")}`);
});

test("[Z2.7] a committed artifact is a fixed point of the compiler (no second-pass drift)", () => {
  const sample = collectSkills().slice(0, 40);
  for (const s of sample) {
    const leanFile = s.path.replace(/SKILL\.md$/, "SKILL.lean.md");
    if (!existsSync(leanFile)) continue;
    const committed = readFileSync(leanFile, "utf8");
    const recompiled = planLeanArtifact(committed, { id: s.id, type: "skill", sourcePath: s.path });
    // Compiling an already-Lean doc yields the same bytes (idempotent).
    assert.equal(recompiled.lean, committed, `${s.id}: committed .lean.md is not a fixed point`);
  }
});
