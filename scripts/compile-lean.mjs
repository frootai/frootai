/**
 * [Z2.1] Compile-Lean generator — walk all skills → compile → write `.lean.md`.
 *
 * Produces the committed `.lean.md` artifact next to every `SKILL.md`, BUT only
 * when the [Z1] fidelity gate certifies the Lean keeps the same capability. A
 * skill whose Lean would fail fidelity simply gets NO `.lean.md` — the website
 * then serves Full for it (the [Z1.8] fallback, materialised at build time).
 *
 * Pure planning (`planLeanArtifact`) is separated from I/O so it is testable and
 * deterministic; the file write only happens under `--write`. Dry-run (default)
 * reports the corpus outcome without touching the tree, so [Z2.1] ships the
 * generator and [Z2.6] runs `--write` to commit the artifacts.
 *
 *   node scripts/compile-lean.mjs            # dry-run report
 *   node scripts/compile-lean.mjs --write    # write the .lean.md files
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "../engine/lean-compiler/index.js";
import { artifactPaths } from "../engine/lean-compiler/emit.js";
import { gate } from "../engine/lean-compiler/fidelity-gate.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(ROOT, "skills");

/** Collect `{ id, path }` for every `skills/<id>/SKILL.md`, sorted by id. */
function collectSkills() {
  const out = [];
  for (const name of readdirSync(SKILLS_DIR)) {
    const path = join(SKILLS_DIR, name, "SKILL.md");
    try {
      if (statSync(path).isFile()) out.push({ id: name, path });
    } catch {
      /* not a skill dir */
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Plan the Lean artifact for one source — PURE (no I/O). Compiles, runs the
 * fidelity gate, and reports whether a `.lean.md` should be written.
 *
 * @param {string} full  the Full SKILL.md text
 * @param {{id?:string, type?:string, sourcePath?:string}} [meta]
 * @returns {{
 *   id:string|undefined, leanPath:string, lean:string, write:boolean,
 *   passed:boolean, score:number, savedTokens:number, saved:number,
 *   reason:string|null
 * }}
 */
function planLeanArtifact(full, { id, type = "skill", sourcePath = "SKILL.md" } = {}) {
  const { lean, sidecar } = compile(full, { type });
  const g = gate(full, lean, { id, type });
  return {
    id,
    leanPath: artifactPaths(sourcePath).lean,
    lean,
    write: g.flavor === "lean",
    passed: g.receipt.passed,
    score: g.receipt.score,
    savedTokens: sidecar.savedTokens,
    saved: sidecar.saved,
    reason: g.flavor === "lean" ? null : g.reason,
  };
}

/** Walk the corpus and (optionally) write the gated `.lean.md` files. */
function run({ write = false } = {}) {
  const plans = [];
  for (const s of collectSkills()) {
    const full = readFileSync(s.path, "utf8");
    const plan = planLeanArtifact(full, { id: s.id, type: "skill", sourcePath: s.path });
    if (write && plan.write) writeFileSync(plan.leanPath, plan.lean, "utf8");
    plans.push(plan);
  }
  return plans;
}

function report(plans) {
  const written = plans.filter((p) => p.write);
  const rejected = plans.filter((p) => !p.write);
  const savedPcts = written.map((p) => p.saved).sort((a, b) => a - b);
  const mean = savedPcts.length ? savedPcts.reduce((a, s) => a + s, 0) / savedPcts.length : 0;
  const median = savedPcts.length ? savedPcts[Math.floor(savedPcts.length / 2)] : 0;
  console.log(`\n[Z2.1] compile-lean over ${plans.length} skills`);
  console.log(`  lean written (gate-passed): ${written.length}`);
  console.log(`  rejected (Full-only): ${rejected.length}`);
  console.log(`  token savings on Lean: mean ${mean.toFixed(1)}% · median ${median}%`);
  for (const r of rejected.slice(0, 10)) console.log(`    - ${r.id}: ${r.reason}`);
  console.log("");
}

// Windows-safe main guard.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const write = process.argv.includes("--write");
  const plans = run({ write });
  report(plans);
  if (write) console.log(`Wrote ${plans.filter((p) => p.write).length} .lean.md files.\n`);
}

export { planLeanArtifact, collectSkills, run, SKILLS_DIR };
