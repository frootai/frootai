/**
 * [Z0.1] Smoke test — Lean Compiler entry-API scaffold.
 *
 * Row literal: "Scaffold `engine/lean-compiler/` + entry API
 *   `compile(md) → { lean, stats }`".
 *
 * Validates the entry CONTRACT only (shape + determinism + no-op pass-through).
 * Compression-quality tests arrive with the real stages ([Z0.11] golden fixtures).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { compile, STAGES } from "./index.js";

test("[Z0.1] compile returns { lean, stats } with the correct shape", () => {
  const md = "# Title\n\nSome body text long enough to count a few tokens.";
  const out = compile(md);
  assert.equal(typeof out.lean, "string");
  assert.ok(out.stats && typeof out.stats === "object");
  assert.equal(typeof out.stats.tokensBefore, "number");
  assert.equal(typeof out.stats.tokensAfter, "number");
  assert.equal(typeof out.stats.saved, "number");
  assert.ok(Array.isArray(out.stats.stagesApplied));
});

test("[Z0.1] scaffold is a valid no-op compiler (identity pass-through)", () => {
  const md = "# Heading\n\nbody content here";
  const out = compile(md);
  assert.equal(out.lean, md); // no real stages yet → output unchanged
  assert.equal(out.stats.saved, 0);
  assert.equal(out.stats.tokensBefore, out.stats.tokensAfter);
});

test("[Z0.1] every pipeline stage runs, in order", () => {
  const out = compile("x");
  assert.deepEqual(out.stats.stagesApplied, STAGES.map((s) => s.id));
});

test("[Z0.1] compile is deterministic (same input → same output)", () => {
  const md = "# Deterministic\n\n- a\n- b\n";
  const a = compile(md);
  const b = compile(md);
  assert.equal(a.lean, b.lean);
  assert.deepEqual(a.stats, b.stats);
});

test("[Z0.1] non-string input throws TypeError", () => {
  assert.throws(() => compile(123), TypeError);
  assert.throws(() => compile(null), TypeError);
  assert.throws(() => compile(undefined), TypeError);
});

test("[Z0.1] empty string compiles to empty with zero stats", () => {
  const out = compile("");
  assert.equal(out.lean, "");
  assert.equal(out.stats.tokensBefore, 0);
  assert.equal(out.stats.saved, 0);
});
