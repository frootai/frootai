// @ts-check
/**
 * A4.6 / A4.19-A4.22 — `frootai orchard diff <slug-or-id> --play <play-id>`
 *
 * Modes:
 *   - PREVIEW (A4.6 backward-compat): no `--target` → emits the diff plan stub
 *     (pollination edge + actions_preview list). Works for unauthenticated users.
 *
 *   - REAL DIFF (A4.19-A4.21): `--target <dir>` → loads the Play recipe + diffs
 *     against the current state of <dir>. Renders colored unified diff.
 *     `--json` emits the full FileDiffSet (machine-readable).
 *     `--show-identical` shows identical files in the body (always counted in summary).
 *     `--context <n>` controls hunk context lines (default 3).
 *
 *   - APPLY (A4.22): `--apply --target <dir>` invokes the scaffold engine to
 *     upgrade the install to the paid Play. Gated on the SAME Pro entitlement
 *     as `install --upgrade-to-play` (A4.11). `--force` overrides conflicts.
 *
 * Doctrine: diff is preview-equals-execute — what you see in `diff` is exactly
 * what `install --upgrade-to-play` (or `diff --apply`) would do, because both
 * paths share A4.17 `buildDropPlan` for classification.
 */
"use strict";

const path = require("node:path");
const { fetchIndexBundle, fetchVarietyBundle, fetchPollinationsBundle } = require("../cdn");
const { status, color, renderKeyValue } = require("../output");
const { OrchardCliError } = require("../cli-error");
const { VARIETY_ENUM } = require("../types");
const { UPGRADE_SIGN_IN_URL, UPGRADE_ENTITLEMENT } = require("./install");
const { readToken, isTokenExpired } = require("../../auth/token-store");
const { fetchEntitlements, hasEntitlement } = require("../../auth/entitlements");
const { buildLocalDirRecipeProvider } = require("../../scaffold/play-recipe");
const { buildFileDiffSet } = require("../../diff/engine");
const { renderFileDiffSet } = require("../../diff/render");
const { runScaffold: defaultRunScaffold } = require("../../scaffold/engine");
const { emitEvent: defaultEmitEvent } = require("../../telemetry/emitter");

/**
 * A4.28 — fire-and-forget telemetry helper for diff --apply.
 */
async function _fireDiffTelemetry(d, event, props) {
  if (d && d.disableTelemetry === true) return;
  try {
    const emitImpl = (d && d.emitEvent) || defaultEmitEvent;
    await emitImpl(event, props, (d && d.telemetryDeps) || {});
  } catch { /* fire-and-forget */ }
}

/**
 * Pure: assemble the diff plan.
 */
function buildDiffPlan(fruit, playId, pollEdges) {
  const matching = (pollEdges || []).find((e) => e.accelerator_id === fruit.id && e.play_id === String(playId));
  return {
    accelerator_id: fruit.id,
    play_id: String(playId),
    play_slug: matching && matching.play_slug ? matching.play_slug : null,
    relation: matching ? matching.relation : null,
    source: matching ? matching.source : null,
    confidence: matching ? matching.confidence : null,
    diff_summary: matching
      ? `Free install: clones ${fruit.repo_url}. Paid (--upgrade-to-play): layers ${matching.relation} Play "${matching.play_slug || playId}" via scaffold engine (A4.19-A4.22).`
      : `Play "${playId}" has NO pollination edge to accelerator "${fruit.id}". The diff would be empty.`,
    actions_preview: matching ? [
      ".github/copilot-instructions.md (NEW)",
      "agents/ (NEW — matched to Play)",
      "skills/ (NEW)",
      "prompts/ (NEW)",
      "evals/ (NEW)",
    ] : [],
    has_match: Boolean(matching),
  };
}

async function execDiff(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));

  const key = (args._ && args._[0]) || "";
  const playId = args.play;
  if (!key) {
    throw new OrchardCliError("invalid_input",
      "diff requires a slug or id: frootai orchard diff <slug-or-id> --play <play-id>",
      { hint: "frootai orchard diff azure-search-openai-demo --play 01" });
  }
  if (!playId || playId === true) {
    throw new OrchardCliError("invalid_input",
      "diff requires --play <play-id>",
      { hint: "frootai orchard diff <slug> --play 01" });
  }
  const variety = args.variety;
  if (variety !== undefined && variety !== true && !VARIETY_ENUM.includes(variety)) {
    throw new OrchardCliError("invalid_variety", `--variety "${variety}" not in enum`, { received: variety });
  }
  const targetDir = args.target && args.target !== true ? path.resolve(String(args.target)) : null;
  const applyMode = Boolean(args.apply);
  const colorOpts = { color: !args["no-color"] };

  if (applyMode && !targetDir) {
    throw new OrchardCliError("invalid_input",
      "--apply requires --target <dir> (the existing free install to upgrade)",
      { hint: "frootai orchard diff <slug> --play 01 --target ./my-install --apply" });
  }

  // ── A4.22 entitlement gate (only on --apply) ─────────────────
  // Plain diff (preview OR real) is free — no sign-in required so users can
  // INSPECT what they'd get before paying. --apply is the paid action, gated
  // identically to install --upgrade-to-play.
  let entitlementCheck = null;
  if (applyMode) {
    const readTokenImpl = d.readToken || readToken;
    const fetchEntImpl = d.fetchEntitlements || fetchEntitlements;
    const token = await readTokenImpl({ backend: d.tokenBackend, tokenPath: d.tokenPath });
    if (!token) {
      throw new OrchardCliError("not_signed_in",
        `--apply requires sign-in. Run \`frootai login\` first.`,
        { hint: `Then re-run: frootai orchard diff ${key} --play ${playId} --target ${targetDir} --apply` });
    }
    if (isTokenExpired(token, (d.now || Date.now)())) {
      throw new OrchardCliError("token_expired",
        `Your sign-in expired on ${token.expires_at}. Run \`frootai login\` to refresh.`,
        { expired_at: token.expires_at });
    }
    entitlementCheck = await fetchEntImpl({
      token: token.access_token,
      cachePath: d.entitlementsCachePath,
      fetchImpl: d.fetchImpl,
      now: d.now,
    });
    if (!hasEntitlement(entitlementCheck, UPGRADE_ENTITLEMENT)) {
      throw new OrchardCliError("entitlement_required",
        `Your tier "${entitlementCheck.tier}" does not include the "${UPGRADE_ENTITLEMENT}" entitlement. Upgrade at ${UPGRADE_SIGN_IN_URL}.`,
        { tier: entitlementCheck.tier, required_entitlement: UPGRADE_ENTITLEMENT, upgrade_url: UPGRADE_SIGN_IN_URL });
    }
  }

  // Manifest fetch.
  const fetchIndex = d.fetchIndex || fetchIndexBundle;
  const fetchVariety = d.fetchVariety || fetchVarietyBundle;
  const fetchPolls = d.fetchPollinations || fetchPollinationsBundle;

  let resolvedVariety = variety;
  if (!resolvedVariety || resolvedVariety === true) {
    const index = await fetchIndex();
    const slim = (index.entries || []).find((e) => e.slug === key || e.id === key);
    if (!slim) throw new OrchardCliError("not_found", `no accelerator found with slug or id "${key}"`, { key });
    resolvedVariety = slim.variety;
  }
  const [bundle, polls] = await Promise.all([
    fetchVariety(resolvedVariety),
    fetchPolls().catch(() => ({ edges: [] })),
  ]);
  const fruit = (bundle.fruits || []).find((f) => f && (f.slug === key || f.id === key));
  if (!fruit) {
    throw new OrchardCliError("not_found",
      `no accelerator with slug/id "${key}" in variety "${resolvedVariety}"`,
      { key, variety: resolvedVariety });
  }

  const plan = buildDiffPlan(fruit, playId, polls.edges);

  // ── PREVIEW MODE (no --target): A4.6 stub behavior ─────────────
  if (!targetDir) {
    if (args.json) {
      const out = JSON.stringify(plan, null, 2);
      log(out);
      return { exitCode: 0, output: out, plan };
    }
    const lines = [];
    lines.push(status("ok", `Diff plan: ${color("bold", fruit.name, colorOpts)} vs Play ${color("yellow", String(playId), colorOpts)}`, colorOpts));
    lines.push("");
    lines.push(renderKeyValue([
      { label: "Accelerator", value: fruit.id },
      { label: "Play id", value: String(playId) },
      { label: "Play slug", value: plan.play_slug || color("dim", "(not in pollinations registry)", colorOpts) },
      { label: "Relation", value: plan.relation || color("dim", "(no edge)", colorOpts) },
      { label: "Source", value: plan.source || color("dim", "(no edge)", colorOpts) },
      { label: "Confidence", value: plan.confidence != null ? `${Math.round(plan.confidence * 100)}%` : color("dim", "(no edge)", colorOpts) },
    ], colorOpts));
    lines.push("");
    lines.push(color("dim", "  Preview mode — pass --target <dir> to see the real per-file unified diff.", colorOpts));
    lines.push(`  ${plan.diff_summary}`);
    if (plan.has_match) {
      lines.push("");
      lines.push(color("dim", "  Files the paid scaffold would add (preview):", colorOpts));
      for (const f of plan.actions_preview) {
        lines.push(`    ${color("green", "+", colorOpts)} ${f}`);
      }
      lines.push("");
      lines.push(`  ${color("yellow", "$ frootai orchard diff " + fruit.id + " --play " + playId + " --target ./my-install", colorOpts)} ${color("dim", "# real per-file diff", colorOpts)}`);
    } else {
      lines.push("");
      lines.push(status("info", `No pollination edge from ${fruit.id} to Play ${playId} — propose one via \`frootai orchard pollinate\`.`, colorOpts));
    }
    const out = lines.join("\n");
    log(out);
    return { exitCode: 0, output: out, plan };
  }

  // ── REAL DIFF MODE (A4.19-A4.21): --target supplied ──────────
  const provider = d.recipeProvider || buildLocalDirRecipeProvider({ playsRoot: d.playsRoot });
  let recipe;
  try {
    recipe = await provider.loadRecipe(String(playId));
  } catch (err) {
    if (err instanceof OrchardCliError) throw err;
    throw new OrchardCliError("io_error", `failed to load Play recipe: ${err instanceof Error ? err.message : String(err)}`, { play_id: playId });
  }

  const context = args.context !== undefined && args.context !== true ? Math.max(0, parseInt(String(args.context), 10) || 0) : 3;
  const diffSet = await buildFileDiffSet(recipe, targetDir, { context }, d);

  // ── A4.22 APPLY ────────────────────────────────────
  if (applyMode) {
    const runScaffoldImpl = d.runScaffold || defaultRunScaffold;
    let report;
    try {
      report = await runScaffoldImpl({
        fruit,
        targetDir,
        upgradeToPlay: String(playId),
        force: Boolean(args.force),
        skipClone: true, // diff --apply targets an EXISTING install
        runHooks: Boolean(args["run-hooks"]),
        dryRun: false,
      }, d);
    } catch (err) {
      // A4.28 — fire upgrade_to_play_attempted (failure) before re-raising.
      void _fireDiffTelemetry(d, "upgrade_to_play_attempted", {
        variety: fruit.variety,
        success: "false",
        tier_class: "paid",
        error_code: err instanceof OrchardCliError ? err.code : "scaffold_engine_failed",
      });
      if (err instanceof OrchardCliError) throw err;
      throw new OrchardCliError("io_error",
        `scaffold engine failed during --apply: ${err instanceof Error ? err.message : String(err)}`,
        { target: targetDir, play_id: playId });
    }

    // A4.28 — fire upgrade_to_play_attempted (success).
    if (report.ok !== false) {
      void _fireDiffTelemetry(d, "upgrade_to_play_attempted", {
        variety: fruit.variety,
        success: "true",
        tier_class: "paid",
      });
    }

    if (args.json) {
      const out = JSON.stringify({ ...plan, diff_set: diffSet, apply_report: report }, null, 2);
      log(out);
      return { exitCode: report.ok === false ? 1 : 0, output: out, plan, diff_set: diffSet, report };
    }

    const lines = [];
    lines.push(status("ok", `Applied Play ${color("yellow", `${recipe.play_id}-${recipe.play_slug}`, colorOpts)} to ${color("cyan", targetDir, colorOpts)}`, colorOpts));
    const pd = report.phases && report.phases.play_drops;
    if (pd && pd.status === "applied") {
      lines.push(renderKeyValue([
        { label: "Written", value: String(pd.written || 0) },
        { label: "Skipped (identical)", value: String(pd.skipped_identical || 0) },
        { label: "Overwrote", value: String(pd.overwrote || 0) },
        { label: "Tier", value: (entitlementCheck && entitlementCheck.tier) || "pro" },
      ], colorOpts));
    }
    lines.push("");
    lines.push(color("dim", `  Manage subscription at ${color("cyan", UPGRADE_SIGN_IN_URL, colorOpts)}`, colorOpts));
    const out = lines.join("\n");
    log(out);
    return { exitCode: 0, output: out, plan, diff_set: diffSet, report };
  }

  // ── A4.21 JSON output ──────────────────────────────────
  if (args.json) {
    // Combined: backward-compat preview plan + real diff set.
    const out = JSON.stringify({ ...plan, diff_set: diffSet }, null, 2);
    log(out);
    return { exitCode: 0, output: out, plan, diff_set: diffSet };
  }

  // ── A4.20 pretty render ────────────────────────────────
  const rendered = renderFileDiffSet(diffSet, {
    color: colorOpts.color,
    hideIdentical: !args["show-identical"],
  });
  log(rendered);

  // Tailing footer with the upgrade CTA.
  const footer = [];
  footer.push("");
  footer.push(color("dim", `  To apply this diff: ${color("yellow", "$ frootai orchard diff " + fruit.id + " --play " + playId + " --target " + targetDir + " --apply", colorOpts)}`, colorOpts));
  footer.push(color("dim", `  --apply requires Pro sign-in (\`frootai login\`).`, colorOpts));
  const footerStr = footer.join("\n");
  log(footerStr);

  return { exitCode: 0, output: rendered + footerStr, plan, diff_set: diffSet };
}

module.exports = { execDiff, buildDiffPlan };
