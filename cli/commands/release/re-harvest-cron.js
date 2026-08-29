// @ts-check
/**
 * [H11.7] re-harvest-cron.js — pure plan-builder for the weekly re-harvest
 * GitHub Actions workflow.
 *
 * Contract (verbatim from masterplan §3 row [H11.7]):
 *   Re-harvest cron: GitHub Actions weekly cron iterates over all committed
 *   plays; for each, `frootai orchard re-harvest <slug>` runs in CI;
 *   diff emitted
 *
 * **Top-level group** `release/` already hosts H8.18-H8.23 release-tooling
 * pure libraries. H11.7 extends it with a sibling re-harvest-cron lib —
 * the CI workflow at `.github/workflows/orchard-reharvest-cron.yml` consumes
 * `buildReHarvestPlan(args)` to enumerate all committed plays + emit a
 * shell-friendly plan that the workflow then executes via the H8.11
 * `frootai orchard re-harvest <play-dir>` command.
 *
 * **Why pure plan-builder + workflow split** (per H8.x doctrine carried into
 * H11 release-tooling): the plan-builder is hermetic + node-test-able; the
 * workflow shells out only to known-good commands (`frootai orchard
 * re-harvest`, `gh api`, `git`). The same pattern was used by H8.21
 * `linux-packages.js`, H8.22 `homebrew-tap.js`, H8.23 `winget-manifest.js`.
 *
 * **Plays-root enumeration** mirrors H8.12 `list-pending-reviews.js`
 * `scanPlaysRoot(root, io)` semantics — every direct subdirectory of
 * `<playsRoot>` that contains a `fai-manifest.json` is considered a
 * committed play. The plan-builder accepts the scan result (or runs the
 * scan via injected `readDir`/`existsSync` for hermetic testing).
 *
 * **Plan shape** (the workflow's two-inline-node pattern from H8.22 reads
 * this JSON via `node -e`): ordered list of `{step, tool, slug, argv, env?}`
 * entries. Step names use the H8.x convention (`reharvest-<slug>`,
 * `commit-diff-<slug>`). Tool names: `frootai` (the CLI binary) or `git`
 * (post-step diff-commit work).
 *
 * **Per-play timeout** caps individual re-harvest runs so a single hung
 * upstream can't burn the workflow's overall budget. Defaults to 10 min
 * (per masterplan §6 risk-mitigation cadence; matches the H8.x timeout
 * convention).
 *
 * **--diff-only** flag from H8.11/H8.29 docs is what the cron uses by
 * default — we don't want CI writing files into committed plays; the
 * workflow's job is to detect drift + raise an issue/PR, not to mutate.
 *
 * **DRY-RUN MODE**: when `dryRun: true` is passed, the plan flags every
 * step `dryRun: true` so the workflow can short-circuit `frootai` invocations
 * and just print the planned argv. Used by `workflow_dispatch` for rehearsal.
 *
 * **No third-party deps** (third-party-requires invariant — only `node:`
 * prefixed core modules are used).
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/re-harvest-cron
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** Sysexits-aligned exit codes. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  NOINPUT: 66,
  SOFTWARE: 70,
  IOERR: 74,
});

/** Cron schedule: every Monday at 06:00 UTC (matches masterplan "weekly" literal). */
const DEFAULT_CRON_SCHEDULE = "0 6 * * 1";

/** Default plays-root path. Mirrors H8.12 list-pending-reviews default. */
const DEFAULT_PLAYS_ROOT = "plays";

/** Default per-play timeout in milliseconds (10 min). */
const DEFAULT_PER_PLAY_TIMEOUT_MS = 10 * 60 * 1000;

/** Default total workflow budget (4 hours — sized for 100 plays × ~2 min each). */
const DEFAULT_TOTAL_BUDGET_MS = 4 * 60 * 60 * 1000;

/** The required marker file that identifies a committed play directory. */
const PLAY_MANIFEST_FILE = "fai-manifest.json";

/** Step-name prefixes — stable so workflow logs are diff-able. */
const STEP_PREFIX = Object.freeze({
  REHARVEST: "reharvest-",
  COLLECT_DIFF: "collect-diff-",
});

class ReHarvestCronError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "ReHarvestCronError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Validate that a string is a safe play slug — alphanumeric + dash + underscore,
 * length 1..128. The slug ends up in filesystem paths AND in `frootai orchard
 * re-harvest <slug>` argv, so we lock it down. Pure.
 *
 * @param {unknown} slug
 * @returns {boolean}
 */
function isValidPlaySlug(slug) {
  if (typeof slug !== "string") return false;
  if (slug.length < 1 || slug.length > 128) return false;
  // Reject `.` and `..` explicitly (they pass the char class but are path-traversal vectors).
  if (slug === "." || slug === "..") return false;
  return /^[a-zA-Z0-9._-]+$/.test(slug);
}

/**
 * Scan a plays-root directory for committed plays. Pure (modulo injected
 * IO). A committed play is any direct subdirectory of `<root>` that
 * contains a `fai-manifest.json` file.
 *
 * @param {string} root
 * @param {{readDir: (p: string) => string[], existsSync: (p: string) => boolean, statSync?: (p: string) => {isDirectory(): boolean}}} io
 * @returns {Array<{slug: string, playDir: string, manifestPath: string}>}
 */
function scanCommittedPlays(root, io) {
  if (typeof root !== "string" || !root) {
    throw new ReHarvestCronError("usage", `scanCommittedPlays: root must be a non-empty string`, { exitCode: EXIT.USAGE });
  }
  if (!io || typeof io.readDir !== "function" || typeof io.existsSync !== "function") {
    throw new ReHarvestCronError("usage", `scanCommittedPlays: io.readDir + io.existsSync required`, { exitCode: EXIT.USAGE });
  }
  if (!io.existsSync(root)) return [];
  /** @type {string[]} */
  let entries;
  try { entries = io.readDir(root); }
  catch (err) {
    throw new ReHarvestCronError("ioerr", `scanCommittedPlays: cannot read ${root}: ${err && err.message}`, { exitCode: EXIT.IOERR });
  }
  if (!Array.isArray(entries)) return [];
  /** @type {Array<{slug: string, playDir: string, manifestPath: string}>} */
  const out = [];
  for (const name of entries) {
    if (!isValidPlaySlug(name)) continue;
    const playDir = path.posix.join(root, name);
    const manifestPath = path.posix.join(playDir, PLAY_MANIFEST_FILE);
    if (!io.existsSync(manifestPath)) continue;
    out.push({ slug: name, playDir, manifestPath });
  }
  // Sort by slug for stable plan ordering across runs.
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}

/**
 * Build the canonical `frootai orchard re-harvest` argv for a single play.
 * Pure. Always uses `--diff-only` (the cron never mutates committed plays)
 * + `--json` (so the workflow can pipe to per-slug `diffs/<slug>.json`).
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {string} args.playDir
 * @param {boolean} [args.dryRun]
 * @param {boolean} [args.noCache]
 * @returns {string[]}
 */
function buildReHarvestArgv(args) {
  const { slug, playDir, dryRun, noCache } = args || /** @type {*} */ ({});
  if (!isValidPlaySlug(slug)) {
    throw new ReHarvestCronError("usage", `buildReHarvestArgv: invalid slug "${slug}"`, { exitCode: EXIT.USAGE });
  }
  if (typeof playDir !== "string" || !playDir) {
    throw new ReHarvestCronError("usage", `buildReHarvestArgv: playDir must be a non-empty string`, { exitCode: EXIT.USAGE });
  }
  /** @type {string[]} */
  const argv = ["orchard", "re-harvest", playDir, "--diff-only", "--json"];
  if (noCache) argv.push("--no-cache");
  if (dryRun) argv.push("--print");
  return argv;
}

/**
 * Build the canonical diff-output path for a slug. Pure. Used by the
 * workflow's collect-diff step to know where to read each result. Always
 * POSIX-joined.
 *
 * @param {string} slug
 * @param {string} [diffDir]
 * @returns {string}
 */
function buildDiffPath(slug, diffDir = "tmp/reharvest-diffs") {
  if (!isValidPlaySlug(slug)) {
    throw new ReHarvestCronError("usage", `buildDiffPath: invalid slug "${slug}"`, { exitCode: EXIT.USAGE });
  }
  return path.posix.join(diffDir, `${slug}.json`);
}

/**
 * Build the full re-harvest plan: one ordered plan-entry per committed
 * play. Pure. The workflow's two-inline-node pattern consumes this JSON.
 *
 * @param {object} args
 * @param {Array<{slug: string, playDir: string, manifestPath: string}>} args.plays
 * @param {boolean} [args.dryRun]
 * @param {boolean} [args.noCache]
 * @param {number} [args.perPlayTimeoutMs]
 * @param {string} [args.diffDir]
 * @returns {{
 *   version: 1,
 *   total_plays: number,
 *   dry_run: boolean,
 *   per_play_timeout_ms: number,
 *   diff_dir: string,
 *   steps: Array<{
 *     step: string,
 *     tool: "frootai",
 *     slug: string,
 *     play_dir: string,
 *     argv: string[],
 *     diff_path: string,
 *     timeout_ms: number,
 *     dry_run: boolean,
 *   }>,
 * }}
 */
function buildReHarvestPlan(args) {
  const o = args || /** @type {*} */ ({});
  if (!Array.isArray(o.plays)) {
    throw new ReHarvestCronError("usage", `buildReHarvestPlan: plays must be an array`, { exitCode: EXIT.USAGE });
  }
  const dryRun = Boolean(o.dryRun);
  const noCache = Boolean(o.noCache);
  const perPlayTimeoutMs = Number.isInteger(o.perPlayTimeoutMs) && o.perPlayTimeoutMs > 0
    ? o.perPlayTimeoutMs
    : DEFAULT_PER_PLAY_TIMEOUT_MS;
  const diffDir = (typeof o.diffDir === "string" && o.diffDir) ? o.diffDir : "tmp/reharvest-diffs";
  /** @type {Array<*>} */
  const steps = [];
  for (const play of o.plays) {
    if (!play || typeof play !== "object") continue;
    const slug = /** @type {string} */ (play.slug);
    const playDir = /** @type {string} */ (play.playDir);
    if (!isValidPlaySlug(slug)) {
      throw new ReHarvestCronError("usage", `buildReHarvestPlan: invalid slug "${slug}"`, { exitCode: EXIT.USAGE });
    }
    if (typeof playDir !== "string" || !playDir) {
      throw new ReHarvestCronError("usage", `buildReHarvestPlan: playDir missing for slug "${slug}"`, { exitCode: EXIT.USAGE });
    }
    steps.push({
      step: STEP_PREFIX.REHARVEST + slug,
      tool: "frootai",
      slug,
      play_dir: playDir,
      argv: buildReHarvestArgv({ slug, playDir, dryRun, noCache }),
      diff_path: buildDiffPath(slug, diffDir),
      timeout_ms: perPlayTimeoutMs,
      dry_run: dryRun,
    });
  }
  return {
    version: 1,
    total_plays: steps.length,
    dry_run: dryRun,
    per_play_timeout_ms: perPlayTimeoutMs,
    diff_dir: diffDir,
    steps,
  };
}

/**
 * Summarize a set of per-play diff results. Pure. The workflow's
 * collect-diff step writes one JSON per slug; this summarizer reads them
 * (via injected `readFile`) + classifies each one as `clean` / `drift` /
 * `error`. The final summary is what gets posted to Slack + (optionally)
 * raised as a GitHub issue.
 *
 * @param {Array<{slug: string, diff_path: string}>} entries
 * @param {{readFile: (p: string) => string, existsSync: (p: string) => boolean}} io
 * @returns {{
 *   total: number,
 *   clean: number,
 *   drift: number,
 *   errored: number,
 *   missing: number,
 *   results: Array<{slug: string, status: "clean"|"drift"|"error"|"missing", diff?: object, error?: string}>,
 * }}
 */
function summarizeDiffResults(entries, io) {
  if (!Array.isArray(entries)) {
    throw new ReHarvestCronError("usage", `summarizeDiffResults: entries must be an array`, { exitCode: EXIT.USAGE });
  }
  if (!io || typeof io.readFile !== "function" || typeof io.existsSync !== "function") {
    throw new ReHarvestCronError("usage", `summarizeDiffResults: io.readFile + io.existsSync required`, { exitCode: EXIT.USAGE });
  }
  /** @type {Array<*>} */
  const results = [];
  let clean = 0, drift = 0, errored = 0, missing = 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const slug = /** @type {string} */ (entry.slug);
    const diffPath = /** @type {string} */ (entry.diff_path);
    if (!io.existsSync(diffPath)) {
      results.push({ slug, status: "missing" });
      missing += 1;
      continue;
    }
    /** @type {*} */
    let parsed;
    try { parsed = JSON.parse(io.readFile(diffPath)); }
    catch (err) {
      results.push({ slug, status: "error", error: `parse: ${err && err.message}` });
      errored += 1;
      continue;
    }
    if (!parsed || typeof parsed !== "object") {
      results.push({ slug, status: "error", error: "diff JSON is not an object" });
      errored += 1;
      continue;
    }
    if (parsed.ok === false) {
      results.push({ slug, status: "error", error: typeof parsed.error === "string" ? parsed.error : "re-harvest reported !ok" });
      errored += 1;
      continue;
    }
    // Heuristic: if the diff has 0 changes (no `files`, no `changes`, no
    // `summary.modified`), it's clean; otherwise it's drift.
    const hasFiles = Array.isArray(parsed.files) && parsed.files.length > 0;
    const hasChanges = Array.isArray(parsed.changes) && parsed.changes.length > 0;
    const modifiedCount = parsed.summary && typeof parsed.summary === "object" && typeof parsed.summary.modified === "number"
      ? parsed.summary.modified
      : 0;
    if (hasFiles || hasChanges || modifiedCount > 0) {
      results.push({ slug, status: "drift", diff: parsed });
      drift += 1;
    } else {
      results.push({ slug, status: "clean" });
      clean += 1;
    }
  }
  return {
    total: results.length,
    clean,
    drift,
    errored,
    missing,
    results,
  };
}

/**
 * Build the canonical Slack message for the cron's run summary. Pure.
 * Mirrors the A2.21 Slack run-summary shape so #orchard-cron is consistent.
 *
 * @param {ReturnType<typeof summarizeDiffResults>} summary
 * @param {object} [opts]
 * @param {string} [opts.runUrl] — GitHub Actions run URL for the footer link
 * @param {string} [opts.scheduleNote] — e.g. "weekly cron at 06:00 UTC Mon"
 * @returns {{text: string, blocks: Array<object>}}
 */
function buildSlackSummary(summary, opts = {}) {
  if (!summary || typeof summary !== "object") {
    throw new ReHarvestCronError("usage", `buildSlackSummary: summary required`, { exitCode: EXIT.USAGE });
  }
  const { total, clean, drift, errored, missing } = summary;
  const driftEmoji = drift > 0 ? ":warning:" : ":white_check_mark:";
  const text = `${driftEmoji} Re-harvest cron: ${drift} drift, ${clean} clean, ${errored} error, ${missing} missing (${total} plays total)`;
  /** @type {Array<*>} */
  const blocks = [
    { type: "header", text: { type: "plain_text", text: `Re-harvest cron — ${total} plays` } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Drift:* ${drift}` },
        { type: "mrkdwn", text: `*Clean:* ${clean}` },
        { type: "mrkdwn", text: `*Errored:* ${errored}` },
        { type: "mrkdwn", text: `*Missing:* ${missing}` },
      ],
    },
  ];
  if (drift > 0) {
    const driftSlugs = summary.results.filter((r) => r.status === "drift").map((r) => r.slug);
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Plays with upstream drift:* ${driftSlugs.slice(0, 20).map((s) => "`" + s + "`").join(", ")}${driftSlugs.length > 20 ? ` … +${driftSlugs.length - 20} more` : ""}` },
    });
  }
  if (opts && typeof opts.runUrl === "string" && opts.runUrl) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `<${opts.runUrl}|View run on GitHub> · ${opts.scheduleNote || "weekly cron"}` }],
    });
  }
  return { text, blocks };
}

/**
 * Default IO bindings using `node:fs`. The CI script + tests both use
 * the same factory so the bindings round-trip identically.
 *
 * @returns {{readDir: (p: string) => string[], existsSync: (p: string) => boolean, readFile: (p: string) => string}}
 */
function defaultIo() {
  return {
    readDir: (p) => fs.readdirSync(p),
    existsSync: (p) => fs.existsSync(p),
    readFile: (p) => fs.readFileSync(p, "utf8"),
  };
}

module.exports = {
  EXIT,
  DEFAULT_CRON_SCHEDULE,
  DEFAULT_PLAYS_ROOT,
  DEFAULT_PER_PLAY_TIMEOUT_MS,
  DEFAULT_TOTAL_BUDGET_MS,
  PLAY_MANIFEST_FILE,
  STEP_PREFIX,
  ReHarvestCronError,
  isValidPlaySlug,
  scanCommittedPlays,
  buildReHarvestArgv,
  buildDiffPath,
  buildReHarvestPlan,
  summarizeDiffResults,
  buildSlackSummary,
  defaultIo,
};
