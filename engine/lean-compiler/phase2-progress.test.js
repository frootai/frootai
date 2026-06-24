/**
 * [Phase-2 progress] Honest measurement of the marginal savings the deterministic
 * Lean+ tier earns ON REAL CATALOG CONTENT, vs the 30–40 % Phase-2 target.
 *
 * Why this test exists: the founder asked "are we 30–40 % yet?" The answer
 * lives in the engine, not in marketing. This test scans actual primitives
 * from the catalog, runs them through (a) the Z0 lossless floor and (b) the
 * deterministic Lean+ tier on top, and prints/asserts the honestly measured
 * marginal. It exists so that:
 *
 *   1. The number can't drift — every CI run reports it.
 *   2. A future LLM-backed semantic backend has a real baseline to beat
 *      (it must clear the same gate, and earn MORE marginal than the rule
 *      backend does today).
 *   3. The honesty contract is explicit: when this test prints a single-digit
 *      marginal, that IS the truthful state. The 30–40 % target is a Phase-2
 *      LLM goal, never preannounced as shipped.
 *
 * The assertions pin only what HONESTY requires (never inflate, never go
 * negative, lossless floor stays positive). The actual marginal is REPORTED,
 * not asserted to a magic number.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { compile as compileLossless } from "./index.js";
import { countTokens } from "./tokens.js";
import { compilePlus, RuleSemanticCompressor } from "../lean-compiler-plus/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

/** Walk a dir for real (non-`.lean.md`) markdown primitives. */
function walkMd(dir, out = [], limit = Infinity) {
  if (out.length >= limit) return out;
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (out.length >= limit) return out;
    const p = join(dir, e);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) walkMd(p, out, limit);
    else if (e.endsWith(".md") && !e.endsWith(".lean.md")) out.push(p);
  }
  return out;
}

// Sample real catalog content. Capped so the test stays fast (< 5s).
const SAMPLE_ROOTS = ["solution-plays", "cookbook"].map((r) => join(ROOT, r)).filter(existsSync);
const SAMPLE = SAMPLE_ROOTS.flatMap((r) => walkMd(r, [], 40)).slice(0, 60);

test("[phase2-progress] sample is real, non-trivial catalog content", () => {
  assert.ok(SAMPLE.length >= 10, `expected >= 10 real markdown files, got ${SAMPLE.length}`);
  const sizes = SAMPLE.map((f) => readFileSync(f, "utf8").length);
  const total = sizes.reduce((a, b) => a + b, 0);
  assert.ok(total > 50_000, `expected > 50 KB of sample content, got ${total}`);
});

test("[phase2-progress] lossless floor earns positive savings across the catalog", () => {
  let fullTok = 0, leanTok = 0;
  for (const f of SAMPLE) {
    const src = readFileSync(f, "utf8");
    const out = compileLossless(src, { type: "agent" });
    fullTok += countTokens(src);
    leanTok += countTokens(out.lean);
  }
  const saved = fullTok - leanTok;
  const pct = (saved / fullTok) * 100;
  // Honest floor: small but positive (never negative on aggregate).
  assert.ok(saved >= 0, `lossless aggregate must not grow (saved ${saved})`);
  // Print the measured number so CI surfaces it.
  console.log(`[phase2-progress] LOSSLESS aggregate: ${fullTok} → ${leanTok} tok (saved ${saved} = ${pct.toFixed(2)}%)`);
});

test("[phase2-progress] deterministic Lean+ tier earns non-negative MARGINAL over lossless", async () => {
  let losslessTok = 0, plusTok = 0;
  let perFile = 0, withMarginal = 0;
  for (const f of SAMPLE) {
    const src = readFileSync(f, "utf8");
    const lossless = compileLossless(src, { type: "agent" });
    const plus = await compilePlus(src, { semantic: RuleSemanticCompressor, primitiveType: "agent" });
    losslessTok += countTokens(lossless.lean);
    plusTok += countTokens(plus.lean);
    perFile++;
    if (plus.stats.savedTokensVsLossless > 0) withMarginal++;
  }
  const marginal = losslessTok - plusTok;
  const marginalPct = losslessTok > 0 ? (marginal / losslessTok) * 100 : 0;
  // Honest: marginal must NEVER be negative (Lean+ would have grown vs lossless).
  assert.ok(marginal >= 0, `Lean+ aggregate must not grow vs lossless (marginal ${marginal})`);
  // Print the measured number so CI surfaces it.
  console.log(
    `[phase2-progress] Lean+ MARGINAL over lossless: ${losslessTok} → ${plusTok} tok ` +
    `(saved ${marginal} = ${marginalPct.toFixed(2)}%) — ${withMarginal}/${perFile} files had any marginal`,
  );
});

test("[phase2-progress] HONESTY: rule-paraphrase-v1 alone is FAR below the 30–40% Phase-2 target", async () => {
  // This is the assertion that hard-codes the honesty contract:
  //   the deterministic rule tier earns a SINGLE-DIGIT marginal at best.
  //   30–40 % requires the LLM tier (see RETRO.md). A future PR that bumps a
  //   rule backend high enough to break this assertion must update RETRO too.
  let losslessTok = 0, plusTok = 0;
  for (const f of SAMPLE) {
    const src = readFileSync(f, "utf8");
    const lossless = compileLossless(src, { type: "agent" });
    const plus = await compilePlus(src, { semantic: RuleSemanticCompressor, primitiveType: "agent" });
    losslessTok += countTokens(lossless.lean);
    plusTok += countTokens(plus.lean);
  }
  const marginalPct = losslessTok > 0 ? ((losslessTok - plusTok) / losslessTok) * 100 : 0;
  assert.ok(
    marginalPct < 15,
    `Lean+ rule-tier marginal is ${marginalPct.toFixed(2)}% — if this is >= 15% the rules are doing more than ` +
    `safe paraphrase (or the catalog changed shape); revisit RETRO + the 30–40% framing.`,
  );
});
