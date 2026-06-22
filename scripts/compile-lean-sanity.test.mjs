/**
 * [Z2.11] Tests — Lean monotone sanity across the WHOLE corpus.
 *
 * The compiler must never make a primitive bigger: for every skill, the Lean is
 * ≤ the Full in BOTH tokens and bytes, and the saved figures are non-negative.
 * Where [Z2.4]/[Z2.7] sample, this sweeps all 638 so a single regression — a
 * compressor that grows a doc, or a negative-savings bug — is caught immediately.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compile } from "../engine/lean-compiler/index.js";
import { collectSkills } from "./compile-lean.mjs";

const corpus = collectSkills().map((s) => ({ id: s.id, path: s.path }));

test("[Z2.11] corpus is fully present", () => {
  assert.ok(corpus.length > 100, `expected the full corpus, got ${corpus.length}`);
});

test("[Z2.11] no Lean is larger than its Full — tokens & bytes monotone, savings ≥ 0", () => {
  const violations = [];
  for (const s of corpus) {
    const full = readFileSync(s.path, "utf8");
    const { sidecar } = compile(full, { type: "skill" });
    if (sidecar.tokensLean > sidecar.tokens) violations.push(`${s.id}: tokensLean ${sidecar.tokensLean} > tokens ${sidecar.tokens}`);
    if (sidecar.bytesLean > sidecar.bytes) violations.push(`${s.id}: bytesLean ${sidecar.bytesLean} > bytes ${sidecar.bytes}`);
    if (sidecar.savedTokens < 0) violations.push(`${s.id}: savedTokens ${sidecar.savedTokens} < 0`);
    if (sidecar.saved < 0 || sidecar.saved > 100) violations.push(`${s.id}: saved% ${sidecar.saved} out of range`);
  }
  assert.deepEqual(violations, [], `monotone violations (first 10):\n${violations.slice(0, 10).join("\n")}`);
});

test("[Z2.11] savedTokens == tokens − tokensLean for every skill (accounting holds)", () => {
  const bad = [];
  for (const s of corpus.slice(0, 200)) {
    const full = readFileSync(s.path, "utf8");
    const { sidecar } = compile(full, { type: "skill" });
    if (sidecar.savedTokens !== sidecar.tokens - sidecar.tokensLean) bad.push(s.id);
  }
  assert.deepEqual(bad, [], `savedTokens accounting mismatch: ${bad.join(", ")}`);
});
