// @ts-check
/**
 * [H11.8] diff-pr.js — pure auto-PR plan-builder for non-trivial re-harvest
 * drift.
 *
 * Contract (verbatim from masterplan §3 row [H11.8]):
 *   Diff PR flow: if re-harvest diff non-trivial, auto-open PR against
 *   `frootai/orchard/registry/` with diff snippet + founder review reqd
 *
 * **Pipeline position**: H11.7 cron classifies each per-slug diff as
 * `clean` / `drift` / `error` / `missing`. H11.8 takes the H11.7 summary +
 * for every `drift` row whose payload passes the `isDriftNonTrivial` gate,
 * builds a per-PR plan entry the cron workflow step then executes via
 * `gh pr create`.
 *
 * **Doctrine reuse** (carried from H11.7 / H8.21 / H8.22 / H8.23): pure
 * plan-builder + workflow shell-out. Builder is hermetic + node-test-able;
 * workflow runs `gh pr create` with the canonical argv this lib emits.
 *
 * **Why a separate lib from re-harvest-cron.js**: the cron lib stays
 * focused on enumerate + execute + summarize. The PR-flow lib stays
 * focused on classify-drift-and-build-PR-shape. Each is independently
 * versionable + the H11.8 tests don't bloat the H11.7 test footprint.
 *
 * **"non-trivial" interpretation** (masterplan literal): any drift is
 * non-trivial by default (`DEFAULT_NON_TRIVIAL_THRESHOLD = 1`). The cron
 * workflow can tighten via `non_trivial_threshold` input (e.g. 5 = "only
 * drifts with >= 5 file changes get a PR") if founder feedback shows the
 * default is too noisy. Whitespace-only / metadata-only drifts that
 * H11.7's `summarizeDiffResults` classifies as `clean` already short-circuit
 * before reaching this lib.
 *
 * **Target repo**: `frootai/orchard/registry/` — the public-facing community
 * + maintainer registry. The diff JSON is committed under
 * `reharvest-drifts/<slug>.json` so the founder can grep + diff against
 * previous cron runs of the same slug.
 *
 * **PR shape**:
 *   - Branch: `reharvest-drift/<slug>-<YYYY-MM-DD>` (deterministic
 *     per-slug-per-day so multiple cron runs on the same day idempotently
 *     target the same branch without churn)
 *   - Title:  `[re-harvest drift] <slug>` (grep-friendly + scannable in the
 *     PR list view)
 *   - Body:   founder-review-required checklist + diff summary stats +
 *     truncated diff snippet (cap at 50 KB to leave headroom under GitHub's
 *     65 KB PR body limit)
 *   - Labels: `needs-founder-review`, `re-harvest`, `drift`
 *   - Reviewers: founder handle from env / opts
 *   - Base:   `main` (configurable)
 *
 * **PURE module** — no `gh`, no `child_process`, no network. Unit-tested
 * in `frootai-core/tests/harvest/orchard-diff-pr.smoke.test.js`.
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/diff-pr
 */
"use strict";

const path = require("node:path");

/** Sysexits-aligned exit codes. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  NOINPUT: 66,
  SOFTWARE: 70,
  IOERR: 74,
});

/** Default threshold: ANY drift gets a PR (the H11.7 summarizer's
 *  `clean` already short-circuits zero-change drifts). */
const DEFAULT_NON_TRIVIAL_THRESHOLD = 1;

/** Max PR body size — GitHub caps PR bodies at ~65,536 chars; leave headroom
 *  for the static template + checklist. */
const DEFAULT_MAX_BODY_BYTES = 50_000;

/** Max bytes of the embedded diff JSON snippet (the rest is summary stats). */
const DEFAULT_MAX_DIFF_SNIPPET_BYTES = 30_000;

/** Default base branch the PR targets. */
const DEFAULT_BASE_BRANCH = "main";

/** Default reviewer + labels. Founder handle is overridable. */
const DEFAULT_FOUNDER_HANDLE = "pavle";
const DEFAULT_LABELS = Object.freeze(["needs-founder-review", "re-harvest", "drift"]);

/** Default registry-root path inside the workspace. */
const DEFAULT_REGISTRY_ROOT = "frootai/orchard/registry";

/** Sub-path inside the registry where drift JSONs are committed. */
const DRIFT_DIR_NAME = "reharvest-drifts";

/** Default GitHub owner+repo the PR is opened against. */
const DEFAULT_TARGET_OWNER = "frootai";
const DEFAULT_TARGET_REPO = "frootai";

class DiffPrError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "DiffPrError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Mirror of H11.7's `isValidPlaySlug` — explicit reject of `.` + `..` for
 * path-traversal safety. Kept in this lib so callers don't have to import
 * the H11.7 lib just for the validator. Pure.
 *
 * @param {unknown} slug
 * @returns {boolean}
 */
function isValidPlaySlug(slug) {
  if (typeof slug !== "string") return false;
  if (slug.length < 1 || slug.length > 128) return false;
  if (slug === "." || slug === "..") return false;
  return /^[a-zA-Z0-9._-]+$/.test(slug);
}

/**
 * Count the change-signals in a diff payload. Pure.
 * Returns the MAX of {files-length, changes-length, summary.modified} so
 * any single positive signal triggers non-trivial. Mirrors the same
 * 3-signal logic H11.7's `summarizeDiffResults` uses for drift detection.
 *
 * @param {unknown} diff
 * @returns {number}
 */
function countDriftSignals(diff) {
  if (!diff || typeof diff !== "object") return 0;
  const d = /** @type {Record<string, unknown>} */ (diff);
  const fileCount = Array.isArray(d.files) ? d.files.length : 0;
  const changeCount = Array.isArray(d.changes) ? d.changes.length : 0;
  const summary = d.summary && typeof d.summary === "object" ? d.summary : null;
  const modified = summary && typeof (/** @type {Record<string, unknown>} */ (summary)).modified === "number"
    ? /** @type {number} */ ((/** @type {Record<string, unknown>} */ (summary)).modified) : 0;
  return Math.max(fileCount, changeCount, modified);
}

/**
 * Whether a drift payload is non-trivial enough to warrant a PR. Pure.
 *
 * @param {unknown} diff
 * @param {number} [threshold]
 * @returns {boolean}
 */
function isDriftNonTrivial(diff, threshold = DEFAULT_NON_TRIVIAL_THRESHOLD) {
  const t = Number.isInteger(threshold) && threshold > 0 ? threshold : DEFAULT_NON_TRIVIAL_THRESHOLD;
  return countDriftSignals(diff) >= t;
}

/**
 * Format a date as `YYYY-MM-DD` in UTC. Pure.
 *
 * @param {Date|string|number} input
 * @returns {string}
 */
function formatDateIso(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new DiffPrError("usage", `formatDateIso: invalid date input`, { exitCode: EXIT.USAGE });
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Build the deterministic branch name. Pure.
 * Format: `reharvest-drift/<slug>-<YYYY-MM-DD>`. Same slug + same day → same
 * branch name (idempotent: multiple cron-day runs target the same branch).
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {Date|string|number} [args.now]
 * @returns {string}
 */
function buildBranchName(args) {
  const { slug, now } = args || /** @type {*} */ ({});
  if (!isValidPlaySlug(slug)) {
    throw new DiffPrError("usage", `buildBranchName: invalid slug "${slug}"`, { exitCode: EXIT.USAGE });
  }
  const date = formatDateIso(now != null ? now : new Date());
  return `reharvest-drift/${slug}-${date}`;
}

/**
 * Build the PR title. Pure. `[re-harvest drift] <slug>` — grep-friendly +
 * scannable. Square-bracket prefix mirrors common GitHub auto-PR conventions.
 *
 * @param {object} args
 * @param {string} args.slug
 * @returns {string}
 */
function buildPrTitle(args) {
  const { slug } = args || /** @type {*} */ ({});
  if (!isValidPlaySlug(slug)) {
    throw new DiffPrError("usage", `buildPrTitle: invalid slug "${slug}"`, { exitCode: EXIT.USAGE });
  }
  return `[re-harvest drift] ${slug}`;
}

/**
 * Build the POSIX-joined committed-diff-artifact path inside the registry.
 * Pure. Format: `<registryRoot>/reharvest-drifts/<slug>.json`.
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {string} [args.registryRoot]
 * @returns {string}
 */
function buildDiffArtifactPath(args) {
  const { slug, registryRoot } = args || /** @type {*} */ ({});
  if (!isValidPlaySlug(slug)) {
    throw new DiffPrError("usage", `buildDiffArtifactPath: invalid slug "${slug}"`, { exitCode: EXIT.USAGE });
  }
  const root = (typeof registryRoot === "string" && registryRoot) ? registryRoot : DEFAULT_REGISTRY_ROOT;
  return path.posix.join(root, DRIFT_DIR_NAME, `${slug}.json`);
}

/**
 * Truncate a JSON snippet to a max-byte budget, appending a `…` tail when
 * truncation occurred. Pure. Never throws (degrades to empty string on
 * unstringifiable input).
 *
 * @param {unknown} diff
 * @param {number} [maxBytes]
 * @returns {{snippet: string, truncated: boolean, original_bytes: number}}
 */
function buildDiffSnippet(diff, maxBytes = DEFAULT_MAX_DIFF_SNIPPET_BYTES) {
  let stringified = "";
  try { stringified = JSON.stringify(diff, null, 2); }
  catch { stringified = ""; }
  if (typeof stringified !== "string") stringified = "";
  const cap = Number.isInteger(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_MAX_DIFF_SNIPPET_BYTES;
  const originalBytes = Buffer.byteLength(stringified, "utf8");
  if (originalBytes <= cap) {
    return { snippet: stringified, truncated: false, original_bytes: originalBytes };
  }
  // Find the byte-offset cutoff (be careful with multi-byte UTF-8 chars).
  let cutoff = cap;
  while (cutoff > 0 && (stringified.charCodeAt(cutoff) & 0xc0) === 0x80) cutoff -= 1;
  return {
    snippet: stringified.slice(0, cutoff) + "\n…",
    truncated: true,
    original_bytes: originalBytes,
  };
}

/**
 * Build the PR body markdown. Pure. Self-contained: callers don't need to
 * inject a template engine. Total body is capped at `maxBodyBytes`; the
 * diff snippet is the only variable-length section + is truncated first.
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {unknown} args.diff
 * @param {string} [args.runUrl] — GitHub Actions run URL for cron context
 * @param {string} [args.founderHandle]
 * @param {number} [args.maxBodyBytes]
 * @param {number} [args.maxDiffSnippetBytes]
 * @param {string} [args.registryRoot]
 * @returns {string}
 */
function buildPrBody(args) {
  const { slug, diff, runUrl, founderHandle, maxBodyBytes, maxDiffSnippetBytes, registryRoot } = args || /** @type {*} */ ({});
  if (!isValidPlaySlug(slug)) {
    throw new DiffPrError("usage", `buildPrBody: invalid slug "${slug}"`, { exitCode: EXIT.USAGE });
  }
  const handle = (typeof founderHandle === "string" && founderHandle) ? founderHandle : DEFAULT_FOUNDER_HANDLE;
  const signals = countDriftSignals(diff);
  const filesChanged = (diff && typeof diff === "object" && Array.isArray((/** @type {*} */ (diff)).files))
    ? /** @type {*} */ (diff).files.length : 0;
  const changeCount = (diff && typeof diff === "object" && Array.isArray((/** @type {*} */ (diff)).changes))
    ? /** @type {*} */ (diff).changes.length : 0;
  const modifiedCount = (diff && typeof diff === "object" && (/** @type {*} */ (diff)).summary && typeof (/** @type {*} */ (diff)).summary.modified === "number")
    ? /** @type {*} */ (diff).summary.modified : 0;
  const artifactPath = buildDiffArtifactPath({ slug, registryRoot });
  const snippet = buildDiffSnippet(diff, maxDiffSnippetBytes);
  const truncationNote = snippet.truncated
    ? `\n\n> _Note: diff snippet truncated from **${snippet.original_bytes}** bytes; full diff is committed at \`${artifactPath}\`._`
    : "";

  const body = [
    `## Re-harvest drift detected: \`${slug}\``,
    "",
    "An automated re-harvest cron run detected upstream changes for this Solution Play. This PR commits the latest diff to the registry and requests founder review before any downstream propagation.",
    "",
    "### Summary",
    "",
    `| Signal | Count |`,
    `|---|---|`,
    `| Files changed | ${filesChanged} |`,
    `| Atomic changes | ${changeCount} |`,
    `| Modified marker | ${modifiedCount} |`,
    `| **Combined signal** | **${signals}** |`,
    "",
    `**Diff artifact**: [\`${artifactPath}\`](./${artifactPath})`,
    runUrl ? `**Cron run**: [${runUrl}](${runUrl})` : "**Cron run**: _(no link provided)_",
    "",
    "### Founder review checklist",
    "",
    `- [ ] Reviewed by @${handle}`,
    "- [ ] Drift is upstream-real (not a transient API blip)",
    "- [ ] Decision: merge / patch upstream / archive / wait-and-retry",
    "- [ ] Downstream consumers notified if breaking",
    "",
    "### Diff snippet",
    "",
    "```json",
    snippet.snippet,
    "```",
    truncationNote,
    "",
    "---",
    "",
    "_Auto-generated by `frootai-core/cli/commands/release/diff-pr.js` ([H11.8]) — please do not edit the body manually; close + re-run if more context is needed._",
  ].filter((s) => s !== undefined).join("\n");

  // Final size cap (after building the full body, in case static template is huge).
  const cap = Number.isInteger(maxBodyBytes) && maxBodyBytes > 0 ? maxBodyBytes : DEFAULT_MAX_BODY_BYTES;
  if (Buffer.byteLength(body, "utf8") <= cap) return body;
  // Body still over cap (unlikely with the truncated snippet) — drop the
  // snippet section entirely + append a pointer.
  const fallback = body.replace(/\n### Diff snippet[\s\S]*?(?=\n---)/m, `\n### Diff snippet\n\n_Snippet omitted — body would exceed GitHub's PR-body limit. Full diff at \`${artifactPath}\`._\n`);
  return fallback;
}

/**
 * Build the `gh pr create` argv. Pure. Caller writes the body to a file
 * + passes the path so `--body-file` can carry the full markdown safely
 * (avoids shell-quoting nightmares on Windows runners).
 *
 * @param {object} args
 * @param {string} args.title
 * @param {string} args.bodyPath
 * @param {string} args.branch
 * @param {string} [args.base]
 * @param {string[]} [args.reviewers]
 * @param {string[]} [args.labels]
 * @param {string} [args.targetOwner]
 * @param {string} [args.targetRepo]
 * @param {boolean} [args.draft]
 * @returns {string[]}
 */
function buildGhPrCreateArgv(args) {
  const { title, bodyPath, branch, base, reviewers, labels, targetOwner, targetRepo, draft } = args || /** @type {*} */ ({});
  if (typeof title !== "string" || !title) throw new DiffPrError("usage", `buildGhPrCreateArgv: title required`, { exitCode: EXIT.USAGE });
  if (typeof bodyPath !== "string" || !bodyPath) throw new DiffPrError("usage", `buildGhPrCreateArgv: bodyPath required`, { exitCode: EXIT.USAGE });
  if (typeof branch !== "string" || !branch) throw new DiffPrError("usage", `buildGhPrCreateArgv: branch required`, { exitCode: EXIT.USAGE });
  const owner = (typeof targetOwner === "string" && targetOwner) ? targetOwner : DEFAULT_TARGET_OWNER;
  const repo = (typeof targetRepo === "string" && targetRepo) ? targetRepo : DEFAULT_TARGET_REPO;
  const baseBranch = (typeof base === "string" && base) ? base : DEFAULT_BASE_BRANCH;
  /** @type {string[]} */
  const argv = [
    "pr", "create",
    "--repo", `${owner}/${repo}`,
    "--title", title,
    "--body-file", bodyPath,
    "--head", branch,
    "--base", baseBranch,
  ];
  const revs = Array.isArray(reviewers) ? reviewers.filter((r) => typeof r === "string" && r) : [];
  for (const r of revs) {
    argv.push("--reviewer", r);
  }
  const lbls = Array.isArray(labels) && labels.length > 0 ? labels.filter((l) => typeof l === "string" && l) : [...DEFAULT_LABELS];
  for (const l of lbls) {
    argv.push("--label", l);
  }
  if (draft === true) argv.push("--draft");
  return argv;
}

/**
 * Build the full PR-flow plan from an H11.7 summary. Pure. One ordered
 * plan-entry per drift-row that passes `isDriftNonTrivial`.
 *
 * @param {object} args
 * @param {{results: Array<{slug: string, status: string, diff?: unknown}>}} args.summary
 * @param {number} [args.nonTrivialThreshold]
 * @param {string} [args.registryRoot]
 * @param {string} [args.runUrl]
 * @param {string} [args.founderHandle]
 * @param {string[]} [args.reviewers]
 * @param {string[]} [args.labels]
 * @param {string} [args.base]
 * @param {string} [args.targetOwner]
 * @param {string} [args.targetRepo]
 * @param {Date|string|number} [args.now]
 * @param {number} [args.maxBodyBytes]
 * @param {number} [args.maxDiffSnippetBytes]
 * @param {boolean} [args.draft]
 * @returns {{
 *   version: 1,
 *   total_drifts_seen: number,
 *   total_prs_planned: number,
 *   threshold: number,
 *   skipped: Array<{slug: string, reason: "below_threshold"|"missing_diff"|"invalid_slug"}>,
 *   steps: Array<{
 *     step: string,
 *     tool: "gh",
 *     slug: string,
 *     branch: string,
 *     title: string,
 *     body: string,
 *     body_path: string,
 *     diff_artifact: string,
 *     gh_argv: string[],
 *     non_trivial_signals: number,
 *   }>,
 * }}
 */
function buildDiffPrPlan(args) {
  const o = args || /** @type {*} */ ({});
  if (!o.summary || typeof o.summary !== "object" || !Array.isArray(o.summary.results)) {
    throw new DiffPrError("usage", `buildDiffPrPlan: summary.results must be an array`, { exitCode: EXIT.USAGE });
  }
  const threshold = Number.isInteger(o.nonTrivialThreshold) && o.nonTrivialThreshold > 0
    ? o.nonTrivialThreshold : DEFAULT_NON_TRIVIAL_THRESHOLD;
  const registryRoot = (typeof o.registryRoot === "string" && o.registryRoot) ? o.registryRoot : DEFAULT_REGISTRY_ROOT;
  /** @type {Array<*>} */
  const steps = [];
  /** @type {Array<{slug: string, reason: string}>} */
  const skipped = [];
  let totalDriftsSeen = 0;
  for (const r of o.summary.results) {
    if (!r || typeof r !== "object" || r.status !== "drift") continue;
    totalDriftsSeen += 1;
    const slug = /** @type {string} */ (r.slug);
    if (!isValidPlaySlug(slug)) {
      skipped.push({ slug: String(slug), reason: "invalid_slug" });
      continue;
    }
    if (r.diff === undefined || r.diff === null) {
      skipped.push({ slug, reason: "missing_diff" });
      continue;
    }
    if (!isDriftNonTrivial(r.diff, threshold)) {
      skipped.push({ slug, reason: "below_threshold" });
      continue;
    }
    const branch = buildBranchName({ slug, now: o.now });
    const title = buildPrTitle({ slug });
    const body = buildPrBody({
      slug,
      diff: r.diff,
      runUrl: o.runUrl,
      founderHandle: o.founderHandle,
      maxBodyBytes: o.maxBodyBytes,
      maxDiffSnippetBytes: o.maxDiffSnippetBytes,
      registryRoot,
    });
    const diffArtifact = buildDiffArtifactPath({ slug, registryRoot });
    const bodyPath = path.posix.join("tmp", "diff-pr-bodies", `${slug}.md`);
    const ghArgv = buildGhPrCreateArgv({
      title,
      bodyPath,
      branch,
      base: o.base,
      reviewers: o.reviewers,
      labels: o.labels,
      targetOwner: o.targetOwner,
      targetRepo: o.targetRepo,
      draft: o.draft,
    });
    steps.push({
      step: `open-pr-${slug}`,
      tool: "gh",
      slug,
      branch,
      title,
      body,
      body_path: bodyPath,
      diff_artifact: diffArtifact,
      gh_argv: ghArgv,
      non_trivial_signals: countDriftSignals(r.diff),
    });
  }
  return {
    version: 1,
    total_drifts_seen: totalDriftsSeen,
    total_prs_planned: steps.length,
    threshold,
    skipped,
    steps,
  };
}

module.exports = {
  EXIT,
  DEFAULT_NON_TRIVIAL_THRESHOLD,
  DEFAULT_MAX_BODY_BYTES,
  DEFAULT_MAX_DIFF_SNIPPET_BYTES,
  DEFAULT_BASE_BRANCH,
  DEFAULT_FOUNDER_HANDLE,
  DEFAULT_LABELS,
  DEFAULT_REGISTRY_ROOT,
  DRIFT_DIR_NAME,
  DEFAULT_TARGET_OWNER,
  DEFAULT_TARGET_REPO,
  DiffPrError,
  isValidPlaySlug,
  countDriftSignals,
  isDriftNonTrivial,
  formatDateIso,
  buildBranchName,
  buildPrTitle,
  buildDiffArtifactPath,
  buildDiffSnippet,
  buildPrBody,
  buildGhPrCreateArgv,
  buildDiffPrPlan,
};
