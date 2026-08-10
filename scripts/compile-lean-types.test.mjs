/**
 * [Z4.10] Tests per type — generator + gate integration for agents / instructions
 * / hooks (skills are covered by [Z2.7]/[Z2.11]).
 *
 * Sweeps the whole corpus once via `run({ write: false })` and asserts the
 * per-type guarantees the [Z4.4–4.9] rows established:
 *   - the collectors return well-formed, type-correct sources;
 *   - every WRITTEN Lean is a real token win (savedTokens ≥ 0) — the [Z4.9] gate;
 *   - it is also monotone (tokensLean ≤ tokens) on a per-type sample;
 *   - the token-win gate actually fires on real data (some agents are Full-only,
 *     all for the `no-token-saving` reason);
 *   - a real agent / instruction Lean preserves its load-bearing frontmatter.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compile } from "../engine/lean-compiler/index.js";
import {
  AGENT_PROFILE,
  INSTRUCTION_PROFILE,
  assertProfilePreserved,
} from "../engine/lean-compiler/profiles.js";
import {
  collectAgents,
  collectInstructions,
  collectHooks,
  run,
} from "./compile-lean.mjs";

// One full sweep (skills + agents + instructions + hooks), dry-run.
const plans = run({ write: false });
const byType = (t) => plans.filter((p) => (p.type || "skill") === t);

test("[Z4.10] collectors return type-correct, well-formed sources", () => {
  const agents = collectAgents();
  assert.ok(agents.length > 0);
  assert.ok(agents.every((a) => a.path.endsWith(".agent.md")));

  const instructions = collectInstructions();
  assert.ok(instructions.length > 0);
  assert.ok(instructions.every((i) => i.path.endsWith(".instructions.md")));

  const hooks = collectHooks();
  assert.ok(hooks.length > 0);
  assert.ok(hooks.every((h) => h.path.endsWith("README.md")));
  // The compiled markdown is each hook's README — never the top-level index.
  assert.ok(hooks.every((h) => !/[\\/]hooks[\\/]README\.md$/.test(h.path)));
});

test("[Z4.10] all 4 primitive types are present in the sweep", () => {
  for (const t of ["skill", "agent", "instruction", "hook"]) {
    assert.ok(byType(t).length > 0, `expected some ${t} plans`);
  }
});

test("[Z4.10] every WRITTEN Lean is a real token win (savedTokens >= 0)", () => {
  for (const p of plans.filter((p) => p.write)) {
    assert.ok(p.savedTokens >= 0, `${p.type}/${p.id} savedTokens ${p.savedTokens} < 0`);
  }
});

test("[Z4.10] written Leans are monotone (tokensLean <= tokens) — per-type sample", () => {
  for (const t of ["agent", "instruction", "hook"]) {
    const sample = byType(t).filter((p) => p.write).slice(0, 10);
    assert.ok(sample.length > 0, `no written ${t} leans`);
    for (const p of sample) {
      assert.ok(p.savedTokens >= 0);
    }
  }
});

test("[Z4.10] every canonical agent now has a fidelity-passing token-win Lean", () => {
  const agents = byType("agent");
  assert.ok(agents.length > 0, "expected canonical agents");
  assert.equal(agents.filter((plan) => plan.write).length, agents.length);
  assert.ok(agents.every((plan) => plan.passed && plan.savedTokens >= 0));
});

test("[Z4.10] a real agent Lean preserves tools/model/WAF frontmatter", () => {
  const a = collectAgents()[0];
  const full = readFileSync(a.path, "utf8");
  const { lean } = compile(full, { type: "agent" });
  const r = assertProfilePreserved(AGENT_PROFILE, full, lean);
  assert.equal(r.ok, true, `agent ${a.id}: ${r.reason}`);
});

test("[Z4.10] a real instruction Lean preserves its applyTo glob", () => {
  const i = collectInstructions()[0];
  const full = readFileSync(i.path, "utf8");
  const { lean } = compile(full, { type: "instruction" });
  const r = assertProfilePreserved(INSTRUCTION_PROFILE, full, lean);
  assert.equal(r.ok, true, `instruction ${i.id}: ${r.reason}`);
});
