// @ts-check
/**
 * [H11.18] wave1-launch.js — pure planning + post-launch metrics tracker
 * for Phase H11's first launch wave (20 MSFT-anchor plays).
 *
 * Contract (verbatim from masterplan §3 row [H11.18]):
 *   Wave 1 launch (20 MSFT-anchor plays): 30-day plan per
 *   `05-30-day-execution-plan.md`; success criteria + post-mortem
 *
 * **Masterplan-literal pins** (each anchored by a named test so regressions
 * go RED with the right name):
 *   - exactly 20 MSFT-anchor plays (`WAVE_1_TARGET_PLAY_COUNT === 20`)
 *   - 4-week window (`WAVE_1_WINDOW_DAYS === 30`)
 *   - 5 measurable success criteria (locked + frozen so a post-launch
 *     retro can't shift the bar after the fact)
 *   - post-mortem doc shape (5-section template)
 *
 * **Sibling-lib doctrine** (15th confirmed app in H11 arc — see H11.17):
 * NO edits to H11.x lib. This is a fresh frootai-core lib + smoke test.
 * Surface 📋 planning. Consumed by (a) the founder's launch checklist,
 * (b) a future H11.18.x post-launch retro that ingests real metrics.
 *
 * **Two-surface library**:
 *   1. **Pre-launch plan builder** — `buildWave1Plan()` returns the
 *      frozen 30-day plan structure (target plays + channels + success
 *      criteria + checklist).
 *   2. **Post-launch metrics evaluator** — `evaluateWave1Metrics(actual)`
 *      compares observed numbers against the locked success criteria +
 *      returns a per-criterion `pass|miss` discriminated-union with an
 *      overall verdict.
 *
 * **No third-party deps** (third-party-requires invariant — only `node:`
 * prefixed core modules are used).
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/wave1-launch
 */
"use strict";

/** Sysexits-aligned exit codes (used by a future CLI surface). */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  SOFTWARE: 70,
});

/** Masterplan-literal anchor: 20 MSFT-anchor plays. */
const WAVE_1_TARGET_PLAY_COUNT = 20;

/** Masterplan-literal anchor: 30-day window. */
const WAVE_1_WINDOW_DAYS = 30;

/** Wave 1 name. */
const WAVE_1_NAME = "Wave 1 — MSFT-anchor launch";

/** Launch channels (founder-led narrative push across 5 surfaces). */
const WAVE_1_CHANNELS = Object.freeze([
  "twitter_x",
  "linkedin",
  "hacker_news",
  "reddit_azure",
  "msft_partner_email",
]);

/** Channel display labels. */
const CHANNEL_LABEL = Object.freeze({
  twitter_x: "Twitter/X",
  linkedin: "LinkedIn",
  hacker_news: "Hacker News",
  reddit_azure: "r/azure",
  msft_partner_email: "Microsoft partner email",
});

/**
 * Locked success criteria. Each row is `{id, target, op, label,
 * unit, drivers}`. `op` is the comparison operator the evaluator
 * applies (`>=` or `<=`). Targets are conservative starting points
 * the founder MAY tighten before launch BUT NEVER LOOSEN after launch
 * (pinned by test).
 */
const WAVE_1_SUCCESS_CRITERIA = Object.freeze([
  Object.freeze({
    id: "plays_landed",
    label: "MSFT-anchor plays published",
    target: WAVE_1_TARGET_PLAY_COUNT,
    op: ">=",
    unit: "plays",
    drivers: Object.freeze(["harvest_pipeline", "founder_review"]),
  }),
  Object.freeze({
    id: "github_stars",
    label: "frootai-core GitHub stars (delta over wave)",
    target: 250,
    op: ">=",
    unit: "stars",
    drivers: Object.freeze(["twitter_x", "hacker_news"]),
  }),
  Object.freeze({
    id: "signups",
    label: "frootai.dev free-tier signups",
    target: 100,
    op: ">=",
    unit: "signups",
    drivers: Object.freeze(["twitter_x", "linkedin", "msft_partner_email"]),
  }),
  Object.freeze({
    id: "paid_conversions",
    label: "Free → Pro conversions (Stripe)",
    target: 5,
    op: ">=",
    unit: "conversions",
    drivers: Object.freeze(["account_portal", "upgrade_cta"]),
  }),
  Object.freeze({
    id: "press_mentions",
    label: "External press / blog mentions",
    target: 3,
    op: ">=",
    unit: "mentions",
    drivers: Object.freeze(["msft_partner_email", "hacker_news"]),
  }),
]);

/**
 * Frozen 30-day cadence — 4 weeks × 4 days/week per
 * `05-30-day-execution-plan.md` doctrine.
 */
const WAVE_1_TIMELINE = Object.freeze([
  Object.freeze({ week: 1, label: "Pre-launch — 20 plays validated + landing page live", focus: "harvest_quality" }),
  Object.freeze({ week: 2, label: "Launch week — Twitter + LinkedIn + Hacker News in 3 staged drops", focus: "channel_push" }),
  Object.freeze({ week: 3, label: "Activation — onboard first 100 signups + 5 Pro conversions", focus: "activation" }),
  Object.freeze({ week: 4, label: "Post-mortem — collect metrics, write retro, freeze targets for Wave 2", focus: "retro" }),
]);

/** Locked 5-section post-mortem template structure (verified by test). */
const POST_MORTEM_SECTIONS = Object.freeze([
  "metrics_vs_targets",
  "what_worked",
  "what_missed",
  "channel_lessons",
  "wave_2_changes",
]);

/** Per-section display copy. */
const POST_MORTEM_SECTION_COPY = Object.freeze({
  metrics_vs_targets: "Metrics vs. targets",
  what_worked: "What worked",
  what_missed: "What missed",
  channel_lessons: "Channel-level lessons",
  wave_2_changes: "Wave 2 changes",
});

class Wave1Error extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "Wave1Error";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

// ──────────────────────────────────────────────────────────────────
// Pre-launch plan builder
// ──────────────────────────────────────────────────────────────────

/**
 * Build the canonical Wave 1 launch plan. Pure. Always returns the
 * same shape — frozen + deterministic.
 *
 * @returns {{name: string, target_play_count: number, window_days: number, channels: ReadonlyArray<string>, channel_labels: Record<string, string>, success_criteria: typeof WAVE_1_SUCCESS_CRITERIA, timeline: typeof WAVE_1_TIMELINE, post_mortem_template: typeof POST_MORTEM_SECTIONS, doc_path: string}}
 */
function buildWave1Plan() {
  return {
    name: WAVE_1_NAME,
    target_play_count: WAVE_1_TARGET_PLAY_COUNT,
    window_days: WAVE_1_WINDOW_DAYS,
    channels: WAVE_1_CHANNELS,
    channel_labels: CHANNEL_LABEL,
    success_criteria: WAVE_1_SUCCESS_CRITERIA,
    timeline: WAVE_1_TIMELINE,
    post_mortem_template: POST_MORTEM_SECTIONS,
    doc_path: "planning/launches/wave1-msft-anchor.md",
  };
}

// ──────────────────────────────────────────────────────────────────
// Post-launch metrics evaluator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Wave1Actuals
 * @property {number} [plays_landed]
 * @property {number} [github_stars]
 * @property {number} [signups]
 * @property {number} [paid_conversions]
 * @property {number} [press_mentions]
 */

/**
 * @typedef {object} CriterionResult
 * @property {string} id
 * @property {string} label
 * @property {number} target
 * @property {number} actual
 * @property {"pass"|"miss"|"unknown"} verdict
 * @property {string} op
 * @property {string} unit
 * @property {string} message
 */

/**
 * Evaluate observed Wave 1 metrics against the locked success criteria.
 * Pure. NEVER throws on missing actuals — returns verdict `unknown` for
 * any criterion whose actual is missing/null/NaN so the founder can see
 * which numbers haven't been measured yet.
 *
 * @param {Wave1Actuals | null | undefined} actuals
 * @returns {{
 *   criteria: CriterionResult[],
 *   total: number,
 *   passed: number,
 *   missed: number,
 *   unknown: number,
 *   verdict: "pass" | "miss" | "partial" | "unknown",
 * }}
 */
function evaluateWave1Metrics(actuals) {
  /** @type {Wave1Actuals} */
  const a = actuals && typeof actuals === "object" ? actuals : {};
  /** @type {CriterionResult[]} */
  const results = [];
  for (const c of WAVE_1_SUCCESS_CRITERIA) {
    const raw = a[/** @type {keyof Wave1Actuals} */ (c.id)];
    const known = typeof raw === "number" && Number.isFinite(raw) && raw >= 0;
    const actual = known ? Math.floor(raw) : 0;
    let verdict;
    let message;
    if (!known) {
      verdict = "unknown";
      message = `${c.label}: not yet measured (target ${c.op} ${c.target} ${c.unit})`;
    } else {
      const ok = c.op === ">=" ? actual >= c.target : actual <= c.target;
      verdict = ok ? "pass" : "miss";
      message = `${c.label}: ${actual} ${c.unit} (target ${c.op} ${c.target})`;
    }
    results.push({ id: c.id, label: c.label, target: c.target, actual, verdict, op: c.op, unit: c.unit, message });
  }
  let passed = 0, missed = 0, unknown = 0;
  for (const r of results) {
    if (r.verdict === "pass") passed += 1;
    else if (r.verdict === "miss") missed += 1;
    else unknown += 1;
  }
  let verdict;
  if (passed === results.length) verdict = "pass";
  else if (missed === results.length) verdict = "miss";
  else if (passed === 0 && unknown === results.length) verdict = "unknown";
  else verdict = "partial";
  return { criteria: results, total: results.length, passed, missed, unknown, verdict };
}

// ──────────────────────────────────────────────────────────────────
// Post-mortem rendering
// ──────────────────────────────────────────────────────────────────

/**
 * Render the post-mortem markdown skeleton from the locked 5-section
 * template + the evaluation summary. Pure.
 *
 * @param {{evaluation?: ReturnType<typeof evaluateWave1Metrics>, launchedOn?: string, retroOn?: string}} [opts]
 * @returns {string}
 */
function renderPostMortemSkeleton(opts) {
  const o = opts || {};
  const eval_ = o.evaluation || evaluateWave1Metrics(null);
  const launchedOn = typeof o.launchedOn === "string" && o.launchedOn ? o.launchedOn : "TBD";
  const retroOn = typeof o.retroOn === "string" && o.retroOn ? o.retroOn : "TBD";
  /** @type {string[]} */
  const out = [];
  out.push(`# ${WAVE_1_NAME} — post-mortem`);
  out.push("");
  out.push(`- **Launched on**: ${launchedOn}`);
  out.push(`- **Retro on**: ${retroOn}`);
  out.push(`- **Window**: ${WAVE_1_WINDOW_DAYS} days`);
  out.push(`- **Target plays**: ${WAVE_1_TARGET_PLAY_COUNT}`);
  out.push(`- **Verdict**: \`${eval_.verdict}\` (${eval_.passed}/${eval_.total} criteria passed, ${eval_.unknown} unknown)`);
  out.push("");
  for (const section of POST_MORTEM_SECTIONS) {
    out.push(`## ${POST_MORTEM_SECTION_COPY[section]}`);
    out.push("");
    if (section === "metrics_vs_targets") {
      out.push("| Criterion | Target | Actual | Verdict |");
      out.push("|---|---|---|---|");
      for (const r of eval_.criteria) {
        const verdictEmoji = r.verdict === "pass" ? "✅" : r.verdict === "miss" ? "❌" : "❓";
        out.push(`| ${r.label} | ${r.op} ${r.target} ${r.unit} | ${r.verdict === "unknown" ? "—" : r.actual + " " + r.unit} | ${verdictEmoji} ${r.verdict} |`);
      }
      out.push("");
    } else {
      out.push("_TBD_");
      out.push("");
    }
  }
  return out.join("\n");
}

module.exports = {
  EXIT,
  WAVE_1_NAME,
  WAVE_1_TARGET_PLAY_COUNT,
  WAVE_1_WINDOW_DAYS,
  WAVE_1_CHANNELS,
  CHANNEL_LABEL,
  WAVE_1_SUCCESS_CRITERIA,
  WAVE_1_TIMELINE,
  POST_MORTEM_SECTIONS,
  POST_MORTEM_SECTION_COPY,
  Wave1Error,
  buildWave1Plan,
  evaluateWave1Metrics,
  renderPostMortemSkeleton,
};
