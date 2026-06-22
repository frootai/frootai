/**
 * [Z1.11] Fidelity threshold tuning — run the gate over the REAL corpus.
 *
 * Compiles every catalog primitive to its Lean, scores the Full↔Lean pair with
 * the [Z1.6] scorer, and reports the score distribution + the pass-rate at a
 * range of candidate thresholds. This is how the DEFAULT_THRESHOLD is justified
 * against real data instead of a guess: we want the highest threshold that still
 * passes ~100% of our own (near-lossless) corpus, so the gate never false-
 * rejects a faithful Lean while staying strict enough to catch a lossy one.
 *
 * Run from anywhere: `node engine/lean-compiler/tune-fidelity.mjs`
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./index.js";
import { scoreFidelity, DEFAULT_THRESHOLD } from "./fidelity-score.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Collect (id, full) pairs for a directory of `<id>/<FILE>` primitives. */
function collectDir(rel, file) {
  const dir = join(ROOT, rel);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name, file);
    try {
      if (statSync(p).isFile()) out.push({ id: `${rel}/${name}`, full: readFileSync(p, "utf8") });
    } catch {
      /* not a primitive dir */
    }
  }
  return out;
}

/** Collect flat `<id>.<ext>` primitives (agents/instructions). */
function collectFlat(rel, suffix) {
  const dir = join(ROOT, rel);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(suffix)) continue;
    const p = join(dir, name);
    try {
      if (statSync(p).isFile()) out.push({ id: `${rel}/${name}`, full: readFileSync(p, "utf8") });
    } catch {
      /* skip */
    }
  }
  return out;
}

const corpus = [
  ...collectDir("skills", "SKILL.md"),
  ...collectFlat("agents", ".agent.md"),
  ...collectFlat("instructions", ".instructions.md"),
];

if (corpus.length === 0) {
  console.error("No corpus primitives found — run from the frootai repo.");
  process.exit(1);
}

const CANDIDATES = [9.0, 9.3, 9.5, 9.7, 9.9, 10.0];
const scores = [];
let hardFails = 0;
const failingExamples = [];
let savedPctSum = 0;

for (const { id, full } of corpus) {
  let lean;
  try {
    ({ lean } = compile(full));
  } catch (e) {
    failingExamples.push(`${id}: compile threw ${e.message}`);
    continue;
  }
  const v = scoreFidelity(full, lean);
  scores.push(v.score);
  if (v.hardFail) {
    hardFails += 1;
    if (failingExamples.length < 10) failingExamples.push(`${id}: hardFail ${v.reasons.join("; ")}`);
  }
  const tFull = full.length || 1;
  savedPctSum += Math.max(0, (tFull - lean.length) / tFull) * 100;
}

scores.sort((a, b) => a - b);
const n = scores.length;
const mean = scores.reduce((a, s) => a + s, 0) / n;
const pct = (p) => scores[Math.min(n - 1, Math.floor((p / 100) * n))];

console.log(`\n[Z1.11] Fidelity distribution over ${n} primitives (skills+agents+instructions)\n`);
console.log(`  min ${scores[0].toFixed(1)} · p1 ${pct(1).toFixed(1)} · p5 ${pct(5).toFixed(1)} · median ${pct(50).toFixed(1)} · mean ${mean.toFixed(3)} · max ${scores[n - 1].toFixed(1)}`);
console.log(`  hard-fails: ${hardFails}`);
console.log(`  mean byte savings: ${(savedPctSum / n).toFixed(1)}%\n`);

console.log("  threshold  pass-rate (no hard-fail AND score>=t)");
for (const t of CANDIDATES) {
  let pass = 0;
  for (const s of scores) if (s >= t) pass += 1;
  // hard-fails never pass regardless of score; subtract them from the score-passers.
  const passNoHard = Math.max(0, pass - hardFails);
  console.log(`  ${t.toFixed(1).padStart(8)}   ${((passNoHard / n) * 100).toFixed(1)}%  (${passNoHard}/${n})`);
}
console.log(`\n  DEFAULT_THRESHOLD = ${DEFAULT_THRESHOLD}`);

if (failingExamples.length) {
  console.log("\n  examples below perfect / hard-fails:");
  for (const e of failingExamples) console.log(`    - ${e}`);
}
console.log("");
