// @ts-check
/**
 * A4.4 / A4.5 / A4.13-A4.18 — `frootai orchard install <slug-or-id>`
 *
 * Flags:
 *   --target <dir>             install location (default: ./<slug>)
 *   --variety <variety>        skip slim-index lookup
 *   --upgrade-to-play <id>     PAID — drops Play recipe on top of cloned accelerator (A4.14-A4.16)
 *   --force                    overwrite conflicts + non-empty target (A4.17)
 *   --dry-run                  plan + print without touching disk
 *   --skip-clone               assume target is already a clone (re-apply Play recipe only)
 *   --run-hooks                actually execute post-install hooks (A4.18 — default: advisory)
 *   --json                     emit plan + engine report as JSON
 *   --no-color                 disable ANSI colors
 *
 * Phases (handled by lib/scaffold/engine.js):
 *   1a. git clone (A4.13) — fast-clone fruit.repo_url (--depth 1 --single-branch)
 *   1b. write .frootai/config.json (A4.13) — manifest reference, atomic write
 *   2.  Play drops (A4.14-A4.16) — copilot-instructions.md + agents/ + skills/ + ...
 *       gated by A4.17 conflict policy (refuse to overwrite without --force)
 *   3.  post-install hooks (A4.18) — azd_init, npm_install, etc. (advisory by default)
 *
 * Auth (A4.9-A4.12):
 *   --upgrade-to-play requires sign-in + Pro entitlement (`upgrade-to-play`).
 *   Gate runs BEFORE manifest fetch so auth errors surface immediately.
 */
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const { fetchIndexBundle, fetchVarietyBundle, fetchPollinationsBundle } = require("../cdn");
const { status, color, renderKeyValue } = require("../output");
const { OrchardCliError } = require("../cli-error");
const { VARIETY_ENUM } = require("../types");
const { readToken, isTokenExpired } = require("../../auth/token-store");
const { fetchEntitlements, hasEntitlement } = require("../../auth/entitlements");
const { runScaffold: defaultRunScaffold } = require("../../scaffold/engine");
const { emitEvent: defaultEmitEvent } = require("../../telemetry/emitter");

const UPGRADE_SIGN_IN_URL = "https://frootai.dev/upgrade";
const UPGRADE_ENTITLEMENT = "upgrade-to-play";

/**
 * A4.28 — Fire a granular install telemetry event. NEVER throws/blocks.
 * Suppressed entirely when `deps.disableTelemetry === true` (used by self-tests).
 */
async function _fireInstallTelemetry(d, event, props) {
  if (d && d.disableTelemetry === true) return;
  try {
    const emitImpl = (d && d.emitEvent) || defaultEmitEvent;
    await emitImpl(event, props, (d && d.telemetryDeps) || {});
  } catch { /* fire-and-forget */ }
}

/**
 * Pure: build the install plan object that a future scaffolder consumes.
 *
 * @param {object} fruit
 * @param {object} opts
 * @returns {object}
 */
function buildInstallPlan(fruit, opts) {
  const o = opts || {};
  const targetDir = path.resolve(String(o.targetDir || `./${fruit.slug || fruit.id || "accelerator"}`));
  const plan = {
    accelerator_id: fruit.id,
    name: fruit.name,
    variety: fruit.variety,
    repo_url: fruit.repo_url,
    default_branch: fruit.default_branch || "main",
    target_dir: targetDir,
    actions: [
      { kind: "git_clone", url: fruit.repo_url, branch: fruit.default_branch || "main", into: targetDir },
      { kind: "write_file", path: path.join(targetDir, ".frootai", "config.json"),
        content: JSON.stringify({
          version: 1,
          accelerator_id: fruit.id,
          variety: fruit.variety,
          installed_at: o.nowIso || new Date().toISOString(),
          installed_by: "frootai-orchard-cli/1.0",
          upgrade_to_play: o.upgradeToPlay || null,
        }, null, 2) + "\n" },
    ],
    upgrade_to_play: o.upgradeToPlay || null,
    paid: Boolean(o.upgradeToPlay),
  };
  if (o.upgradeToPlay) {
    plan.actions.push({ kind: "play_recipe_drop", play_id: o.upgradeToPlay,
      note: "Engine resolves recipe + applies drops; see report.phases.play_drops" });
  }
  return plan;
}

async function execInstall(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const key = (args._ && args._[0]) || "";
  if (!key) {
    throw new OrchardCliError("invalid_input",
      "install requires a slug or id: frootai orchard install <slug-or-id>",
      { hint: "frootai orchard install azure-search-openai-demo" });
  }
  const variety = args.variety;
  if (variety !== undefined && variety !== true && !VARIETY_ENUM.includes(variety)) {
    throw new OrchardCliError("invalid_variety", `--variety "${variety}" not in enum`, { received: variety });
  }

  const upgradeToPlay = args["upgrade-to-play"];
  const isPaid = Boolean(upgradeToPlay) && upgradeToPlay !== true;

  const fetchIndex = d.fetchIndex || fetchIndexBundle;
  const fetchVariety = d.fetchVariety || fetchVarietyBundle;
  const fetchPolls = d.fetchPollinations || fetchPollinationsBundle;

  // ── A4.11 entitlement gate ───────────────────────────────────────
  // Paid-path requires Pro+ tier with `upgrade-to-play` entitlement.
  // We check BEFORE resolving the fruit so the auth error surfaces immediately
  // (no point hitting the CDN if the user can't proceed).
  // Three failure modes:
  //   - No token        → "run frootai login"
  //   - Expired token   → "run frootai login again"
  //   - Token + no ent. → "upgrade tier at frootai.dev/upgrade"
  let entitlementCheck = null;
  if (isPaid) {
    const readTokenImpl = d.readToken || readToken;
    const fetchEntImpl = d.fetchEntitlements || fetchEntitlements;
    const token = await readTokenImpl({ backend: d.tokenBackend, tokenPath: d.tokenPath });
    if (!token) {
      throw new OrchardCliError("not_signed_in",
        `--upgrade-to-play requires sign-in. Run \`frootai login\` first.`,
        { hint: `Then re-run: frootai orchard install ${key} --upgrade-to-play ${upgradeToPlay}` });
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

  // Resolve the fruit (mirror show.js resolution logic).
  let resolvedVariety = variety;
  if (!resolvedVariety || resolvedVariety === true) {
    const index = await fetchIndex();
    const slim = (index.entries || []).find((e) => e.slug === key || e.id === key);
    if (!slim) throw new OrchardCliError("not_found",
      `no accelerator found with slug or id "${key}"`,
      { key });
    resolvedVariety = slim.variety;
  }
  const bundle = await fetchVariety(resolvedVariety);
  const fruit = (bundle.fruits || []).find((f) => f && (f.slug === key || f.id === key));
  if (!fruit) {
    throw new OrchardCliError("not_found",
      `no accelerator with slug/id "${key}" in variety "${resolvedVariety}"`,
      { key, variety: resolvedVariety });
  }

  // Paid-path validation: confirm the Play exists in pollinations.
  if (isPaid) {
    const polls = await fetchPolls().catch(() => ({ edges: [] }));
    const playExists = (polls.edges || []).some((e) => e && e.play_id === String(upgradeToPlay));
    if (!playExists) {
      throw new OrchardCliError("invalid_play_id",
        `Play "${upgradeToPlay}" does not appear in any pollination edge. Run \`frootai orchard show ${fruit.slug}\` to see available Plays.`,
        { play_id: upgradeToPlay });
    }
  }

  const plan = buildInstallPlan(fruit, {
    targetDir: args.target,
    upgradeToPlay: isPaid ? String(upgradeToPlay) : null,
  });

  // ── A4.13-A4.18 scaffold engine ──────────────────────────────────
  const runScaffoldImpl = d.runScaffold || defaultRunScaffold;
  const dryRun = Boolean(args["dry-run"]);
  let report;
  try {
    report = await runScaffoldImpl({
      fruit,
      targetDir: plan.target_dir,
      force: Boolean(args.force),
      dryRun,
      upgradeToPlay: isPaid ? String(upgradeToPlay) : null,
      runHooks: Boolean(args["run-hooks"]),
      skipClone: Boolean(args["skip-clone"]),
    }, d);
  } catch (err) {
    // A4.28 — fire upgrade_to_play_attempted (failure) before re-raising.
    if (isPaid) {
      void _fireInstallTelemetry(d, "upgrade_to_play_attempted", {
        variety: fruit.variety,
        success: "false",
        tier_class: "paid",
        error_code: err instanceof OrchardCliError ? err.code : "scaffold_engine_failed",
      });
    }
    if (err instanceof OrchardCliError) throw err;
    throw new OrchardCliError("io_error",
      `scaffold engine failed: ${err instanceof Error ? err.message : String(err)}`,
      { plan_target: plan.target_dir });
  }

  // A4.28 — emit granular install events (best-effort; never blocks/breaks).
  if (!dryRun && report.ok !== false) {
    void _fireInstallTelemetry(d, "install_succeeded", {
      variety: fruit.variety,
      paid: isPaid ? "true" : "false",
      dry_run: "false",
      hooks_count: String((report.phases && report.phases.hooks && Array.isArray(report.phases.hooks.detected) ? report.phases.hooks.detected.length : 0)),
    });
  }
  if (isPaid && report.ok !== false) {
    void _fireInstallTelemetry(d, "upgrade_to_play_attempted", {
      variety: fruit.variety,
      success: "true",
      tier_class: "paid",
      dry_run: dryRun ? "true" : "false",
    });
  }

  if (args.json) {
    const out = JSON.stringify({ ...plan, report }, null, 2);
    log(out);
    return { exitCode: 0, output: out, plan, report };
  }

  const lines = [];
  lines.push(status(report.ok === false ? "warn" : "ok", `Install plan for ${color("bold", fruit.name)}`));
  lines.push("");
  lines.push(renderKeyValue([
    { label: "Accelerator", value: fruit.id },
    { label: "Variety", value: fruit.variety },
    { label: "Repo", value: fruit.repo_url },
    { label: "Branch", value: fruit.default_branch || "main" },
    { label: "Target dir", value: plan.target_dir },
    { label: "Paid Play", value: isPaid ? color("yellow", String(upgradeToPlay)) : color("dim", "(none — free install)") },
    { label: "Mode", value: dryRun ? color("dim", "dry-run") : color("green", "live") },
  ]));
  lines.push("");

  // Phase 1a: clone
  const clonePhase = report.phases.clone;
  if (clonePhase) {
    if (clonePhase.status === "cloned") {
      lines.push(status("ok", `Cloned ${color("cyan", clonePhase.url)} → ${color("cyan", clonePhase.dest)}`));
    } else if (clonePhase.status === "dry_run") {
      lines.push(status("info", `Would clone ${color("cyan", clonePhase.url)} → ${color("cyan", clonePhase.dest)}${clonePhase.target_clean ? "" : color("yellow", " (target NOT empty)")}`));
    } else if (clonePhase.status === "skipped") {
      lines.push(status("info", `Clone skipped: ${clonePhase.reason}`));
    } else if (clonePhase.status === "failed") {
      lines.push(status("error", `Clone failed (${clonePhase.error_code}): ${clonePhase.message}`));
    }
  }

  // Phase 1b: .frootai/config.json
  const configPhase = report.phases.config;
  if (configPhase) {
    if (configPhase.status === "written") {
      lines.push(status("ok", `Wrote ${color("cyan", configPhase.path)} (${configPhase.bytes} bytes)`));
    } else if (configPhase.status === "dry_run") {
      lines.push(status("info", `Would write ${color("cyan", configPhase.path)} (${configPhase.bytes} bytes)`));
    } else if (configPhase.status === "skipped") {
      lines.push(status("warn", `Skipped ${color("cyan", configPhase.path)}: ${configPhase.reason}`));
    }
  }

  // Phase 2: play drops
  const playPhase = report.phases.play_drops;
  if (playPhase && isPaid) {
    if (playPhase.status === "applied") {
      lines.push(status("ok", `Applied Play recipe ${color("yellow", `${playPhase.play_id}-${playPhase.play_slug}`)} — ${playPhase.written} files written${playPhase.skipped_identical ? `, ${playPhase.skipped_identical} identical (skipped)` : ""}${playPhase.overwrote ? color("yellow", `, ${playPhase.overwrote} overwritten`) : ""}`));
    } else if (playPhase.status === "dry_run") {
      const ps = playPhase.plan_summary || {};
      lines.push(status("info", `Would apply Play ${color("yellow", `${playPhase.play_id}-${playPhase.play_slug}`)} — ${ps.total || 0} files (${ps.new_files || 0} new, ${ps.identical || 0} identical${(ps.conflicts || 0) > 0 ? color("yellow", `, ${ps.conflicts} CONFLICT`) : ""})`));
      if ((ps.conflicts || 0) > 0) {
        lines.push(color("yellow", `  Conflicts (first 10): ${(playPhase.conflict_paths || []).slice(0, 10).join(", ")}`));
        lines.push(color("dim", "  Re-run with --force to overwrite."));
      }
    }
  }

  // Phase 3: hooks
  const hookPhase = report.phases.hooks;
  if (hookPhase && Array.isArray(hookPhase.detected) && hookPhase.detected.length > 0) {
    lines.push("");
    if (hookPhase.status === "executed") {
      const ranOk = hookPhase.outcomes.filter((o) => o.ok && o.ran).length;
      const failed = hookPhase.outcomes.filter((o) => !o.ok && o.ran).length;
      lines.push(status(failed > 0 ? "warn" : "ok", `Ran ${ranOk} post-install hook${ranOk === 1 ? "" : "s"}${failed > 0 ? `, ${failed} failed` : ""}`));
      for (const o of hookPhase.outcomes) {
        if (!o.ok && o.error) {
          lines.push(color("yellow", `  · ${o.hook_id}: ${o.error}${o.not_installed ? " (command not installed)" : ""}`));
        }
      }
    } else {
      lines.push(color("bold", "Next steps (run these to finish setup):"));
      for (const h of hookPhase.detected) {
        lines.push(`  ${color("cyan", "$ " + h.advisory_text)} ${color("dim", "# " + h.when)}`);
      }
      lines.push(color("dim", "  (Pass --run-hooks to execute automatically next time.)"));
    }
  }

  lines.push("");
  if (!isPaid && !dryRun) {
    lines.push(color("dim", "  Want the agentic recipe layered on top?"));
    lines.push(`  ${color("yellow", "$ frootai orchard install " + fruit.id + " --upgrade-to-play <play-id>")}`);
  } else if (isPaid) {
    const tierLabel = entitlementCheck && entitlementCheck.tier ? entitlementCheck.tier : "pro";
    lines.push(color("dim", `  Paid Play applied via tier "${tierLabel}". Manage subscription at ${color("cyan", UPGRADE_SIGN_IN_URL)}`));
    if (entitlementCheck && entitlementCheck.stale) {
      lines.push(color("yellow", "  Note: entitlement check fell back to cached data (network unreachable)."));
    }
  }

  const out = lines.join("\n");
  log(out);
  return { exitCode: report.ok === false ? 1 : 0, output: out, plan, report };
}

module.exports = { execInstall, buildInstallPlan, UPGRADE_SIGN_IN_URL, UPGRADE_ENTITLEMENT };
