// @ts-check
/**
 * A4.14-A4.17 — File drop planner + conflict detector.
 *
 * Doctrine (atomic plan-then-execute):
 *   1. From a recipe + a target dir, build a *plan* of file drops
 *      [{abs, rel, content_bytes, exists, conflicts_with_existing}].
 *   2. Pre-flight check: any drops where exists=true AND content differs
 *      → CONFLICT. Refuse to proceed unless `--force`.
 *   3. Identical content (recipe matches what's already on disk) → SKIP
 *      (no write needed, no conflict).
 *   4. Execute: write all files atomically (tmp + rename per file).
 *
 * This module is PURE planning + atomic write IO. The orchestrator (engine.js)
 * combines it with git-clone + post-install hooks.
 *
 * All file paths are dropped under `<targetDir>/.github/<recipe.rel>`.
 */
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { OrchardCliError } = require("../orchard/cli-error");
const { isSafeRelPath } = require("./play-recipe");

const TARGET_GITHUB_DIR = ".github";

/** Pure: compute sha256 of a string. */
function sha256(s) {
  return crypto.createHash("sha256").update(String(s || ""), "utf8").digest("hex");
}

/** Pure: build the absolute target path for a recipe file rel. */
function targetPathFor(targetDir, rel) {
  if (!isSafeRelPath(rel)) {
    throw new OrchardCliError("unsafe_path", `recipe file rel is unsafe: ${JSON.stringify(rel)}`, { rel });
  }
  // Defensive: re-check the JOINED path stays within targetDir.
  const baseAbs = path.resolve(targetDir);
  const joinedAbs = path.resolve(baseAbs, TARGET_GITHUB_DIR, rel);
  const expectedPrefix = path.resolve(baseAbs, TARGET_GITHUB_DIR) + path.sep;
  if (!(joinedAbs === path.resolve(baseAbs, TARGET_GITHUB_DIR) || joinedAbs.startsWith(expectedPrefix))) {
    throw new OrchardCliError("unsafe_path", `recipe file rel ${rel} escapes target .github/`, { rel, resolved: joinedAbs });
  }
  return joinedAbs;
}

/**
 * Build the drop plan from a recipe + target dir. Pure (no IO except stat/read).
 *
 * @param {object} recipe        validated recipe (from play-recipe.js)
 * @param {string} targetDir     install root
 * @param {object} [deps]
 * @param {Function} [deps.existsSync]
 * @param {Function} [deps.readFile]
 * @returns {Promise<{drops: Array<object>, conflicts: Array<object>, identical: Array<object>, new_files: Array<object>}>}
 */
async function buildDropPlan(recipe, targetDir, deps) {
  if (!recipe || !Array.isArray(recipe.files)) {
    throw new OrchardCliError("invalid_input", "buildDropPlan requires validated recipe", {});
  }
  if (!targetDir || typeof targetDir !== "string") {
    throw new OrchardCliError("invalid_input", "buildDropPlan requires targetDir", {});
  }

  const d = deps || {};
  const existsImpl = d.existsSync || fs.existsSync;
  const readImpl = d.readFile || fsP.readFile;

  const drops = [];
  const conflicts = [];
  const identical = [];
  const new_files = [];

  for (const file of recipe.files) {
    const abs = targetPathFor(targetDir, file.rel);
    const wouldBytes = Buffer.byteLength(file.content, "utf8");
    const exists = existsImpl(abs);
    let existing_content_hash = null;
    let conflict = false;
    let same = false;
    if (exists) {
      let existing;
      try { existing = await readImpl(abs, "utf8"); }
      catch (err) {
        // Unreadable file at target — treat as conflict (can't compare).
        existing = null;
        conflict = true;
      }
      if (existing !== null) {
        existing_content_hash = sha256(existing);
        const recipeHash = sha256(file.content);
        if (existing_content_hash === recipeHash) {
          same = true;
        } else {
          conflict = true;
        }
      }
    }
    const drop = {
      rel: file.rel,
      abs,
      bytes: wouldBytes,
      exists,
      existing_content_hash,
      identical: same,
      conflict,
    };
    drops.push(drop);
    if (same) identical.push(drop);
    else if (conflict) conflicts.push(drop);
    else new_files.push(drop);
  }

  return { drops, conflicts, identical, new_files };
}

/**
 * Pure: A4.17 conflict resolution policy.
 *   - If conflicts.length === 0 → ok (proceed)
 *   - If --force → ok (overwrite)
 *   - Else → throw conflict_detected with full path list (caller renders)
 */
function applyConflictPolicy(plan, opts) {
  const o = opts || {};
  if (!plan || !Array.isArray(plan.conflicts)) {
    throw new OrchardCliError("invalid_input", "applyConflictPolicy requires plan with .conflicts", {});
  }
  if (plan.conflicts.length === 0) return { policy: "no_conflicts", proceed: true };
  if (o.force === true) return { policy: "force_overwrite", proceed: true, overwrite_count: plan.conflicts.length };
  throw new OrchardCliError("conflict_detected",
    `${plan.conflicts.length} file${plan.conflicts.length === 1 ? "" : "s"} would be overwritten. Re-run with --force to overwrite (or remove the existing files manually).`,
    {
      conflict_count: plan.conflicts.length,
      conflicts: plan.conflicts.slice(0, 100).map((c) => c.rel),
      hint: "Use `--force` to overwrite, or `frootai orchard diff` to inspect changes first.",
    });
}

/**
 * Execute the plan: write all non-identical files atomically (tmp + rename).
 * Returns {written, skipped, errors}.
 *
 * @param {object} plan
 * @param {Array<object>} recipeFiles   the original recipe.files (carry .content)
 * @param {object} [deps]
 * @param {Function} [deps.writeFile]
 * @param {Function} [deps.mkdir]
 * @param {Function} [deps.rename]
 * @param {Function} [deps.chmod]
 */
async function executePlan(plan, recipeFiles, deps) {
  if (!plan || !Array.isArray(plan.drops)) {
    throw new OrchardCliError("invalid_input", "executePlan requires plan with .drops", {});
  }
  if (!Array.isArray(recipeFiles)) {
    throw new OrchardCliError("invalid_input", "executePlan requires recipeFiles array", {});
  }
  const d = deps || {};
  const writeImpl = d.writeFile || fsP.writeFile;
  const mkdirImpl = d.mkdir || fsP.mkdir;
  const renameImpl = d.rename || fsP.rename;

  // Index recipe content by rel.
  const contentByRel = new Map();
  for (const f of recipeFiles) contentByRel.set(f.rel, f.content);

  const written = [];
  const skipped = [];
  for (const drop of plan.drops) {
    if (drop.identical) {
      skipped.push({ rel: drop.rel, reason: "identical" });
      continue;
    }
    const content = contentByRel.get(drop.rel);
    if (typeof content !== "string") {
      throw new OrchardCliError("invalid_input",
        `executePlan: drop.rel ${drop.rel} has no matching content in recipeFiles`,
        { rel: drop.rel });
    }
    const tempPath = `${drop.abs}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await mkdirImpl(path.dirname(drop.abs), { recursive: true });
      await writeImpl(tempPath, content, "utf8");
      await renameImpl(tempPath, drop.abs);
      written.push({ rel: drop.rel, bytes: drop.bytes, overwrote: drop.conflict });
    } catch (err) {
      try { await fsP.unlink(tempPath); } catch { /* */ }
      throw new OrchardCliError("io_error",
        `failed to write ${drop.abs}: ${err instanceof Error ? err.message : String(err)}`,
        { rel: drop.rel, abs: drop.abs });
    }
  }
  return { written, skipped, total_written: written.length, total_skipped: skipped.length };
}

module.exports = {
  TARGET_GITHUB_DIR,
  sha256,
  targetPathFor,
  buildDropPlan,
  applyConflictPolicy,
  executePlan,
};
