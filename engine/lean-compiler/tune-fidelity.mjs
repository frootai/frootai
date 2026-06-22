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

/** Collect (id, type, full) pairs for a directory of `<id>/<FILE>` primitives. */
function collectDir(rel, file, type) {
  const dir = join(ROOT, rel);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name, file);
    try {
      if (statSync(p).isFile()) out.push({ id: `${rel}/${name}`, type, full: readFileSync(p, "utf8") });
    } catch {
      /* not a primitive dir */
    }
  }
  return out;
}

/** Collect flat `<id>.<ext>` primitives (agents/instructions). */
function collectFlat(rel, suffix, type) {
  const dir = join(ROOT, rel);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(suffix)) continue;
    const p = join(dir, name);
    try {
      if (statSync(p).isFile()) out.push({ id: `${rel}/${name}`, type, full: readFileSync(p, "utf8") });
    } catch {
      /* skip */
    }
  }
  return out;
}

// [Z4.7] Per-type corpus: skills (core) + agents + instructions + hooks. Each
// item is tagged with its primitive type so the report can break the fidelity
// distribution down per type and confirm the single DEFAULT_THRESHOLD holds for
// every type (rather than only in aggregate).
const corpus = [
  ...collectDir("skills", "SKILL.md", "skill"),
  ...collectFlat("agents", ".agent.md", "agent"),
  ...collectFlat("instructions", ".instructions.md", "instruction"),
  ...collectDir("hooks", "README.md", "hook"),
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
const byType = {};

for (const { id, type, full } of corpus) {
  let lean;
  try {
    ({ lean } = compile(full, { type }));
  } catch (e) {
    failingExamples.push(`${id}: compile threw ${e.message}`);
    continue;
  }
  const v = scoreFidelity(full, lean);
  scores.push(v.score);
  const tFull = full.length || 1;
  const savedPct = Math.max(0, (tFull - lean.length) / tFull) * 100;
  if (v.hardFail) {
    hardFails += 1;
    if (failingExamples.length < 10) failingExamples.push(`${id}: hardFail ${v.reasons.join("; ")}`);
  }
  savedPctSum += savedPct;
  const b = (byType[type] ||= { scores: [], hardFails: 0, pass: 0, savedSum: 0 });
  b.scores.push(v.score);
  if (v.hardFail) b.hardFails += 1;
  else if (v.score >= DEFAULT_THRESHOLD) b.pass += 1;
  b.savedSum += savedPct;
}

scores.sort((a, b) => a - b);
const n = scores.length;
const mean = scores.reduce((a, s) => a + s, 0) / n;
const pct = (p) => scores[Math.min(n - 1, Math.floor((p / 100) * n))];

console.log(`\n[Z4.7] Fidelity distribution over ${n} primitives (skills+agents+instructions+hooks)\n`);
console.log(`  min ${scores[0].toFixed(1)} · p1 ${pct(1).toFixed(1)} · p5 ${pct(5).toFixed(1)} · median ${pct(50).toFixed(1)} · mean ${mean.toFixed(3)} · max ${scores[n - 1].toFixed(1)}`);
console.log(`  hard-fails: ${hardFails}`);
console.log(`  mean byte savings: ${(savedPctSum / n).toFixed(1)}%\n`);

// [Z4.7] Per-type breakdown — the point of this row: confirm the SINGLE default
// threshold passes 100% for every primitive type, so no per-type override is
// warranted (an honest "the defaults already generalise" rather than over-tuning).
console.log("  per-type (pass = no hard-fail AND score >= DEFAULT_THRESHOLD):");
console.log(`    ${"type".padEnd(12)} ${"n".padStart(4)}  ${"min".padStart(5)}  ${"median".padStart(6)}  ${"mean".padStart(6)}  ${"saved%".padStart(6)}  pass@${DEFAULT_THRESHOLD}`);
for (const t of ["skill", "agent", "instruction", "hook"]) {
  const b = byType[t];
  if (!b) continue;
  const s = [...b.scores].sort((a, c) => a - c);
  const bn = s.length;
  const bmean = s.reduce((a, x) => a + x, 0) / bn;
  const bmed = s[Math.floor(bn / 2)];
  const passRate = ((b.pass / bn) * 100).toFixed(1);
  console.log(`    ${t.padEnd(12)} ${String(bn).padStart(4)}  ${s[0].toFixed(1).padStart(5)}  ${bmed.toFixed(1).padStart(6)}  ${bmean.toFixed(3).padStart(6)}  ${(b.savedSum / bn).toFixed(1).padStart(5)}%  ${passRate.padStart(6)}%`);
}
console.log("");

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
