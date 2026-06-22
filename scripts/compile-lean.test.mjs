/**
 * [Z2.1] Tests — compile-lean generator.
 *
 * Verifies the pure planner gates correctly, derives the right artifact path,
 * is deterministic + idempotent, and that the real corpus sample all plans a
 * Lean (consistent with the [Z1.11] 100%-byte-faithful result).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { compile } from "../engine/lean-compiler/index.js";
import { planLeanArtifact, collectSkills, SKILLS_DIR } from "./compile-lean.mjs";

const FAITHFUL = [
  "# Deploy",
  "",
  "It is worth noting that this paragraph is purely explanatory background prose.",
  "",
  "You MUST validate every input.",
  "",
  "Run the build with --write.",
  "",
  "```ts",
  "const x = 1;",
  "```",
].join("\n");

test("[Z2.1] a faithful skill plans a Lean artifact (write:true, passed)", () => {
  const p = planLeanArtifact(FAITHFUL, { id: "deploy", type: "skill", sourcePath: "skills/deploy/SKILL.md" });
  assert.equal(p.write, true);
  assert.equal(p.passed, true);
  assert.equal(p.reason, null);
  assert.equal(p.savedTokens >= 0, true);
});

test("[Z2.1] leanPath is the sibling .lean.md of the source", () => {
  const p = planLeanArtifact(FAITHFUL, { id: "deploy", sourcePath: "skills/deploy/SKILL.md" });
  assert.equal(p.leanPath, "skills/deploy/SKILL.lean.md");
});

test("[Z2.1] the planned Lean is a fixed point (idempotent — re-compile = no change)", () => {
  const p = planLeanArtifact(FAITHFUL, { id: "deploy" });
  assert.equal(compile(p.lean, { type: "skill" }).lean, p.lean);
});

test("[Z2.1] planning is deterministic", () => {
  const a = planLeanArtifact(FAITHFUL, { id: "deploy", sourcePath: "skills/deploy/SKILL.md" });
  const b = planLeanArtifact(FAITHFUL, { id: "deploy", sourcePath: "skills/deploy/SKILL.md" });
  assert.deepEqual(a, b);
});

test("[Z2.1] collectSkills finds the real corpus, sorted and de-duplicated", () => {
  const skills = collectSkills();
  assert.ok(skills.length > 100, `expected many skills, got ${skills.length}`);
  const ids = skills.map((s) => s.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => a.localeCompare(b)), "must be sorted");
  assert.equal(new Set(ids).size, ids.length, "no duplicate ids");
});

test("[Z2.1] a real-corpus sample all plans a faithful Lean (gate-passed)", () => {
  const sample = collectSkills().slice(0, 60);
  for (const s of sample) {
    const full = readFileSync(join(SKILLS_DIR, s.id, "SKILL.md"), "utf8");
    const p = planLeanArtifact(full, { id: s.id, type: "skill", sourcePath: s.path });
    assert.equal(p.write, true, `${s.id} should plan a Lean: ${p.reason}`);
  }
});
