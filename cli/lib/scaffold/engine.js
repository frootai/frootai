// @ts-check
/**
 * A4.13-A4.18 — Scaffold engine orchestrator.
 *
 * Composes the four sub-modules into a single end-to-end install:
 *
 *   Phase 1 (FREE — A4.13):
 *     - git clone fruit.repo_url into targetDir (if !exists OR --force)
 *     - write .frootai/config.json with full manifest reference
 *
 *   Phase 2 (PAID — A4.14-A4.16, only if --upgrade-to-play <id>):
 *     - load Play recipe from configured provider
 *     - build drop plan (.github/copilot-instructions.md + agents/ + skills/ + prompts/ + ...)
 *     - apply A4.17 conflict policy (refuse to overwrite without --force)
 *     - execute plan (atomic per-file writes)
 *
 *   Phase 3 (A4.18):
 *     - detect post-install hooks (azd_init, npm_install, etc.)
 *     - run them (advisory by default; execute with --run-hooks)
 *
 * Doctrine:
 *   - ALL phases are dry-runnable. --dry-run produces the full report without
 *     touching disk OR network.
 *   - Failures in Phase 1 abort. Failures in Phase 2 surface as conflict_detected
 *     (when conflicts present) or io_error (when write fails); Phase 1 outputs
 *     are NOT rolled back (git clone is too expensive to undo for a Play drop failure).
 *   - Failures in Phase 3 hooks never fail the install — they're advisory.
 *   - Engine returns a structured report so the dispatcher can pretty-print
 *     OR --json emit.
 */
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const { OrchardCliError } = require("../orchard/cli-error");
const { gitClone, isCleanTarget } = require("./git-clone");
const { buildLocalDirRecipeProvider, summarizeRecipe } = require("./play-recipe");
const { buildCDNRecipeProvider } = require("./cdn-recipe-provider");
const { buildDropPlan, applyConflictPolicy, executePlan } = require("./file-drops");
const { detectHooks, runHooks } = require("./post-install");

const FROOTAI_CONFIG_REL = path.join(".frootai", "config.json");

/**
 * A5.26 — Select the recipe provider based on opts + env.
 *
 *   - If `deps.recipeProvider` is supplied, use it (test injection).
 *   - Else if `deps.cdnPlaysUrl` OR `FROOTAI_CDN_PLAYS_URL` env is set,
 *     use the CDN provider.
 *   - Else fall back to LocalDirRecipeProvider (dev mode, monorepo path).
 *
 * @param {object} d  scaffold deps
 * @returns {object}  recipe provider
 */
function _selectRecipeProvider(d) {
  const cdnUrl = d.cdnPlaysUrl || process.env.FROOTAI_CDN_PLAYS_URL;
  if (cdnUrl) {
    return buildCDNRecipeProvider({
      baseUrl: cdnUrl,
      cacheDir: d.recipeCacheDir,
      fetchImpl: d.fetchImpl,
      timeoutMs: d.recipeFetchTimeoutMs,
      cacheTtlMs: d.recipeCacheTtlMs,
      bypassCache: d.bypassRecipeCache,
    });
  }
  return buildLocalDirRecipeProvider({ playsRoot: d.playsRoot });
}

/** Pure: shape the .frootai/config.json content. */
function buildFrootaiConfig(fruit, opts) {
  const o = opts || {};
  return JSON.stringify({
    version: 1,
    accelerator_id: fruit.id,
    accelerator_slug: fruit.slug,
    name: fruit.name,
    variety: fruit.variety,
    repo_url: fruit.repo_url,
    default_branch: fruit.default_branch || "main",
    license: fruit.license || null,
    installed_at: o.nowIso || new Date().toISOString(),
    installed_by: "frootai-orchard-cli/1.0",
    upgrade_to_play: o.upgradeToPlay || null,
    manifest_ref: {
      cdn_url: o.manifestUrl || null,
      bundle_variety: fruit.variety,
    },
  }, null, 2) + "\n";
}

/**
 * Run the scaffold engine end-to-end.
 *
 * @param {object} input
 * @param {object} input.fruit                — validated fruit manifest
 * @param {string} input.targetDir            — install root
 * @param {boolean} [input.force]             — overwrite conflicts + non-empty target
 * @param {boolean} [input.dryRun]            — plan only, no IO
 * @param {string}  [input.upgradeToPlay]     — Play id (paid path)
 * @param {boolean} [input.runHooks]          — execute hooks vs advisory
 * @param {boolean} [input.skipClone]         — skip phase 1 (target already cloned)
 *
 * @param {object} [deps]
 * @param {object} [deps.recipeProvider]      — defaults to LocalDirRecipeProvider
 * @param {Function} [deps.gitCloneImpl]
 * @param {Function} [deps.writeFile]
 * @param {Function} [deps.mkdir]
 * @param {Function} [deps.existsSync]
 * @param {Function} [deps.readFile]
 * @param {Function} [deps.rename]
 * @param {Function} [deps.spawnImpl]
 * @param {string}  [deps.nowIso]
 *
 * @returns {Promise<{ok: boolean, phases: object, summary: object}>}
 */
async function runScaffold(input, deps) {
  if (!input || typeof input !== "object") {
    throw new OrchardCliError("invalid_input", "runScaffold requires input object", {});
  }
  if (!input.fruit || typeof input.fruit !== "object") {
    throw new OrchardCliError("invalid_input", "runScaffold requires input.fruit", {});
  }
  if (!input.targetDir || typeof input.targetDir !== "string") {
    throw new OrchardCliError("invalid_input", "runScaffold requires input.targetDir", {});
  }

  const d = deps || {};
  const dryRun = input.dryRun === true;
  const targetDir = path.resolve(input.targetDir);
  const isPaid = Boolean(input.upgradeToPlay) && input.upgradeToPlay !== true;

  const report = {
    target_dir: targetDir,
    accelerator_id: input.fruit.id,
    paid: isPaid,
    upgrade_to_play: isPaid ? String(input.upgradeToPlay) : null,
    dry_run: dryRun,
    phases: {
      clone: null,
      config: null,
      play_drops: null,
      hooks: null,
    },
  };

  // ─── Phase 1a: git clone ─────────────────────────────────────────
  if (input.skipClone) {
    report.phases.clone = { status: "skipped", reason: "skipClone=true" };
  } else {
    const cloneImpl = d.gitCloneImpl || gitClone;
    if (dryRun) {
      const clean = await isCleanTarget(targetDir, d);
      report.phases.clone = {
        status: "dry_run",
        url: input.fruit.repo_url,
        branch: input.fruit.default_branch || "main",
        dest: targetDir,
        target_clean: clean,
        would_force: Boolean(input.force) && !clean,
      };
    } else {
      try {
        const cloneResult = await cloneImpl({
          url: input.fruit.repo_url,
          dest: targetDir,
          branch: input.fruit.default_branch || "main",
          force: Boolean(input.force),
        }, d);
        report.phases.clone = {
          status: "cloned",
          url: input.fruit.repo_url,
          branch: input.fruit.default_branch || "main",
          dest: cloneResult.dest,
        };
      } catch (err) {
        report.phases.clone = {
          status: "failed",
          error_code: err instanceof OrchardCliError ? err.code : "unknown",
          message: err instanceof Error ? err.message : String(err),
        };
        report.ok = false;
        report.summary = { aborted_at: "clone" };
        throw err;
      }
    }
  }

  // ─── Phase 1b: write .frootai/config.json ────────────────────────
  const configAbs = path.join(targetDir, FROOTAI_CONFIG_REL);
  const configContent = buildFrootaiConfig(input.fruit, {
    upgradeToPlay: isPaid ? String(input.upgradeToPlay) : null,
    nowIso: d.nowIso,
    manifestUrl: input.manifestUrl,
  });
  if (dryRun) {
    report.phases.config = { status: "dry_run", path: configAbs, bytes: Buffer.byteLength(configContent, "utf8") };
  } else {
    const writeImpl = d.writeFile || fsP.writeFile;
    const mkdirImpl = d.mkdir || fsP.mkdir;
    const existsImpl = d.existsSync || fs.existsSync;
    if (existsImpl(configAbs) && !input.force) {
      report.phases.config = { status: "skipped", reason: "exists; use --force to overwrite", path: configAbs };
    } else {
      try {
        await mkdirImpl(path.dirname(configAbs), { recursive: true });
        const tempPath = `${configAbs}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await writeImpl(tempPath, configContent, "utf8");
        const renameImpl = d.rename || fsP.rename;
        await renameImpl(tempPath, configAbs);
        report.phases.config = { status: "written", path: configAbs, bytes: Buffer.byteLength(configContent, "utf8") };
      } catch (err) {
        report.phases.config = {
          status: "failed",
          path: configAbs,
          message: err instanceof Error ? err.message : String(err),
        };
        report.ok = false;
        report.summary = { aborted_at: "config" };
        throw new OrchardCliError("io_error", `failed to write .frootai/config.json: ${err instanceof Error ? err.message : String(err)}`, { path: configAbs });
      }
    }
  }

  // ─── Phase 2: Play recipe drops (paid only) ──────────────────────
  if (isPaid) {
    const provider = d.recipeProvider || _selectRecipeProvider(d);
    let recipe;
    try {
      recipe = await provider.loadRecipe(String(input.upgradeToPlay));
    } catch (err) {
      report.phases.play_drops = {
        status: "failed",
        provider: provider.name,
        message: err instanceof Error ? err.message : String(err),
      };
      report.ok = false;
      report.summary = { aborted_at: "play_recipe_load" };
      throw err;
    }
    const summary = summarizeRecipe(recipe);
    const plan = await buildDropPlan(recipe, targetDir, d);

    if (dryRun) {
      report.phases.play_drops = {
        status: "dry_run",
        provider: provider.name,
        play_id: recipe.play_id,
        play_slug: recipe.play_slug,
        recipe_summary: summary,
        plan_summary: {
          total: plan.drops.length,
          new_files: plan.new_files.length,
          identical: plan.identical.length,
          conflicts: plan.conflicts.length,
        },
        conflict_paths: plan.conflicts.map((c) => c.rel).slice(0, 50),
      };
    } else {
      try {
        applyConflictPolicy(plan, { force: Boolean(input.force) });
      } catch (err) {
        report.phases.play_drops = {
          status: "blocked_by_conflicts",
          provider: provider.name,
          play_id: recipe.play_id,
          play_slug: recipe.play_slug,
          conflict_count: plan.conflicts.length,
          conflict_paths: plan.conflicts.map((c) => c.rel),
        };
        report.ok = false;
        report.summary = { aborted_at: "play_drops" };
        throw err;
      }
      const execResult = await executePlan(plan, recipe.files, d);
      report.phases.play_drops = {
        status: "applied",
        provider: provider.name,
        play_id: recipe.play_id,
        play_slug: recipe.play_slug,
        recipe_summary: summary,
        written: execResult.total_written,
        skipped_identical: execResult.total_skipped,
        overwrote: execResult.written.filter((w) => w.overwrote).length,
      };
    }
  } else {
    report.phases.play_drops = { status: "n/a", reason: "free install" };
  }

  // ─── Phase 3: post-install hooks ─────────────────────────────────
  let hooks = [];
  try {
    hooks = detectHooks(input.fruit, targetDir, d);
  } catch {
    hooks = [];
  }
  const hookResult = await runHooks(hooks, {
    runMode: input.runHooks === true && !dryRun ? "execute" : "advisory",
  }, d);
  report.phases.hooks = {
    status: dryRun ? "dry_run" : (input.runHooks ? "executed" : "advisory"),
    detected: hooks.map((h) => ({ id: h.id, when: h.when, advisory_text: h.advisory_text, doc_url: h.doc_url })),
    outcomes: hookResult.outcomes.map((o) => ({
      hook_id: o.hook_id, ok: o.ok, ran: o.ran, advisory: o.advisory,
      not_installed: o.not_installed || false,
      error: o.error || null,
    })),
  };

  report.ok = true;
  report.summary = {
    cloned: report.phases.clone && report.phases.clone.status === "cloned",
    config_written: report.phases.config && report.phases.config.status === "written",
    play_drops_applied: isPaid && report.phases.play_drops && report.phases.play_drops.status === "applied",
    hooks_detected: hooks.length,
    hooks_executed: hookResult.ran,
  };
  return report;
}

module.exports = {
  FROOTAI_CONFIG_REL,
  buildFrootaiConfig,
  runScaffold,
};
