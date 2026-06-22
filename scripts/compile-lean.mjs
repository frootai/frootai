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
import { getProfile, assertProfilePreserved } from "../engine/lean-compiler/profiles.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(ROOT, "skills");
const PLAYS_DIR = join(ROOT, "solution-plays");
const AGENTS_DIR = join(ROOT, "agents");

/** Recursively collect every `SKILL.md` path under a root. */
function findSkillMd(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) findSkillMd(full, out);
    else if (name === "SKILL.md") out.push(full);
  }
  return out;
}

/**
 * Collect `{ id, path }` for every skill — CORE (`skills/<id>/SKILL.md`) and
 * PLAY (`solution-plays/<play>/.github/skills/<name>/SKILL.md`) — so the written
 * artifacts match the catalog's full 638-skill coverage. Sorted by path
 * (deterministic; play names can legitimately collide with core ids).
 */
function collectSkills() {
  return [...findSkillMd(SKILLS_DIR), ...findSkillMd(PLAYS_DIR)]
    .map((path) => ({ id: dirname(path).split(/[\\/]/).pop(), path }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * [Z4.4] Collect `{ id, path }` for every agent. Agents are FLAT files
 * `agents/<id>.agent.md` (not folders), so the id is the filename stem. Sorted
 * by path for deterministic output.
 */
function collectAgents() {
  let entries;
  try {
    entries = readdirSync(AGENTS_DIR);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.endsWith(".agent.md"))
    .map((name) => ({ id: name.replace(/\.agent\.md$/, ""), path: join(AGENTS_DIR, name) }))
    .sort((a, b) => a.path.localeCompare(b.path));
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
  let write = g.flavor === "lean";
  let reason = write ? null : g.reason;
  // [Z4.4] Enforce the per-type preservation profile (agent tools/model/WAF,
  // instruction applyTo, …). A Lean that drops a load-bearing field is rejected
  // even if the fidelity gate passed, so the catalog never serves a broken Lean.
  const profile = getProfile(type);
  if (write && profile) {
    const preserved = assertProfilePreserved(profile, full, lean);
    if (!preserved.ok) {
      write = false;
      reason = `profile:${preserved.reason}`;
    }
  }
  return {
    id,
    type,
    leanPath: artifactPaths(sourcePath).lean,
    lean,
    write,
    passed: g.receipt.passed,
    score: g.receipt.score,
    savedTokens: sidecar.savedTokens,
    saved: sidecar.saved,
    reason,
  };
}

/** Walk the corpus and (optionally) write the gated `.lean.md` files. */
function run({ write = false } = {}) {
  const plans = [];
  const sources = [
    ...collectSkills().map((s) => ({ ...s, type: "skill" })),
    ...collectAgents().map((a) => ({ ...a, type: "agent" })),
  ];
  for (const s of sources) {
    const full = readFileSync(s.path, "utf8");
    const plan = planLeanArtifact(full, { id: s.id, type: s.type, sourcePath: s.path });
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
  console.log(`\n[Z2/Z4] compile-lean over ${plans.length} primitives`);
  for (const t of [...new Set(plans.map((p) => p.type || "skill"))]) {
    const tp = plans.filter((p) => (p.type || "skill") === t);
    console.log(`  ${t}: ${tp.filter((p) => p.write).length}/${tp.length} lean written`);
  }
  console.log(`  lean written (gate-passed): ${written.length}`);
  console.log(`  rejected (Full-only): ${rejected.length}`);
  console.log(`  token savings on Lean: mean ${mean.toFixed(1)}% · median ${median}%`);
  for (const r of rejected.slice(0, 10)) console.log(`    - ${r.type || "skill"}/${r.id}: ${r.reason}`);
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

export { planLeanArtifact, collectSkills, collectAgents, run, SKILLS_DIR, AGENTS_DIR };
