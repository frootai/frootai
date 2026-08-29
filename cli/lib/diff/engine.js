// @ts-check
/**
 * A4.19 — Diff engine: compares a Play recipe against current target dir state.
 *
 * For every file the Play recipe would drop, classifies it:
 *   - NEW       — target doesn't have this file yet
 *   - IDENTICAL — target already has byte-identical content (no diff)
 *   - MODIFIED  — target has different content; emit unified diff
 *
 * Returns a structured FileDiffSet that the renderer + --apply path consume.
 *
 * Doctrine:
 *   - Pure planning — no IO outside reading the existing target file (via
 *     injectable `readFile`/`existsSync`).
 *   - The diff engine SHARES the conflict semantics from A4.17:
 *       NEW       ≡ buildDropPlan().new_files
 *       IDENTICAL ≡ buildDropPlan().identical
 *       MODIFIED  ≡ buildDropPlan().conflicts
 *     This means `diff` shows the user EXACTLY what `install --upgrade-to-play`
 *     would do (preview-equals-execute parity).
 *   - The per-file unified diff content is computed once + cached on the result
 *     so render.js + --apply paths share the same source of truth.
 */
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const { OrchardCliError } = require("../orchard/cli-error");
const { buildDropPlan } = require("../scaffold/file-drops");
const { diffStrings } = require("./file-diff");

/** File diff classification constants. */
const KIND_NEW = "new";
const KIND_IDENTICAL = "identical";
const KIND_MODIFIED = "modified";
const KIND_ENUM = Object.freeze([KIND_NEW, KIND_IDENTICAL, KIND_MODIFIED]);

/**
 * Build the full diff between a recipe + a target dir.
 *
 * @param {object} recipe
 * @param {string} targetDir
 * @param {object} [opts]
 * @param {number} [opts.context]      lines of context per hunk (default 3)
 * @param {object} [deps]
 * @param {Function} [deps.existsSync]
 * @param {Function} [deps.readFile]
 * @returns {Promise<{
 *   target_dir: string,
 *   play_id: string,
 *   play_slug: string,
 *   files: Array<object>,
 *   summary: object,
 * }>}
 */
async function buildFileDiffSet(recipe, targetDir, opts, deps) {
  if (!recipe || typeof recipe !== "object" || !Array.isArray(recipe.files)) {
    throw new OrchardCliError("invalid_input", "buildFileDiffSet requires validated recipe", {});
  }
  if (!targetDir || typeof targetDir !== "string") {
    throw new OrchardCliError("invalid_input", "buildFileDiffSet requires targetDir string", {});
  }

  const o = opts || {};
  const d = deps || {};
  const readImpl = d.readFile || fsP.readFile;

  // Reuse A4.17 buildDropPlan for classification — single source of truth.
  const dropPlan = await buildDropPlan(recipe, targetDir, d);

  // Index drops by rel for fast lookup.
  const dropByRel = new Map();
  for (const drop of dropPlan.drops) dropByRel.set(drop.rel, drop);

  // Index recipe content by rel.
  const contentByRel = new Map();
  for (const f of recipe.files) contentByRel.set(f.rel, f.content);

  const files = [];
  let total_added = 0, total_removed = 0;
  let new_count = 0, identical_count = 0, modified_count = 0;
  let modified_bytes_in = 0, modified_bytes_out = 0;

  for (const recipeFile of recipe.files) {
    const drop = dropByRel.get(recipeFile.rel);
    if (!drop) {
      // Defensive — buildDropPlan should have classified every recipe entry.
      throw new OrchardCliError("io_error", `internal: drop missing for ${recipeFile.rel}`, { rel: recipeFile.rel });
    }
    const entry = {
      rel: recipeFile.rel,
      abs: drop.abs,
      bytes_recipe: Buffer.byteLength(recipeFile.content, "utf8"),
    };

    if (drop.identical) {
      entry.kind = KIND_IDENTICAL;
      entry.diff = null;
      identical_count += 1;
    } else if (!drop.exists) {
      entry.kind = KIND_NEW;
      // For a new file, the diff is "all lines added". Skip the LCS work — just
      // count lines (faster + always-identical-shape output).
      const recipeLines = String(recipeFile.content || "").split("\n");
      // Drop trailing empty (final newline) so line count matches the natural
      // notion of "lines in this file".
      if (recipeLines.length > 0 && recipeLines[recipeLines.length - 1] === "") recipeLines.pop();
      entry.diff = {
        identical: false,
        added: recipeLines.length,
        removed: 0,
        unchanged: 0,
        hunks: [{
          aStart: 0, aLen: 0,
          bStart: recipeLines.length > 0 ? 1 : 0, bLen: recipeLines.length,
          lines: recipeLines.map((text) => ({ tag: "+", text })),
        }],
      };
      total_added += recipeLines.length;
      new_count += 1;
    } else {
      // MODIFIED — compute unified diff.
      let existingContent;
      try { existingContent = await readImpl(entry.abs, "utf8"); }
      catch (err) {
        throw new OrchardCliError("io_error",
          `failed to read existing ${entry.abs}: ${err instanceof Error ? err.message : String(err)}`,
          { rel: entry.rel, abs: entry.abs });
      }
      entry.kind = KIND_MODIFIED;
      entry.diff = diffStrings(existingContent, recipeFile.content, { context: o.context });
      total_added += entry.diff.added;
      total_removed += entry.diff.removed;
      modified_bytes_in += Buffer.byteLength(existingContent, "utf8");
      modified_bytes_out += entry.bytes_recipe;
      modified_count += 1;
    }
    files.push(entry);
  }

  // Stable sort: NEW first (most additive), then MODIFIED, then IDENTICAL.
  const order = { [KIND_NEW]: 0, [KIND_MODIFIED]: 1, [KIND_IDENTICAL]: 2 };
  files.sort((a, b) => {
    const oa = order[a.kind];
    const ob = order[b.kind];
    if (oa !== ob) return oa - ob;
    return a.rel.localeCompare(b.rel);
  });

  return {
    target_dir: path.resolve(targetDir),
    play_id: recipe.play_id,
    play_slug: recipe.play_slug,
    files,
    summary: {
      total: files.length,
      new: new_count,
      identical: identical_count,
      modified: modified_count,
      lines_added: total_added,
      lines_removed: total_removed,
      modified_bytes_in,
      modified_bytes_out,
    },
  };
}

module.exports = {
  KIND_NEW,
  KIND_IDENTICAL,
  KIND_MODIFIED,
  KIND_ENUM,
  buildFileDiffSet,
};
