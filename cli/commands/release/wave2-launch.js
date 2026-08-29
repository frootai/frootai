// @ts-check
/**
 * [H11.19] wave2-launch.js — pure planning + post-launch metrics tracker
 * for Phase H11's second launch wave (30 community plays + 10 cultivated
 * AVM plays).
 *
 * Contract (verbatim from masterplan §3 row [H11.19]):
 *   Wave 2 launch (30 community plays + 10 cultivated AVM plays): 60-day
 *   plan; founder-curated
 *
 * **Masterplan-literal pins** (each anchored by a named test so regressions
 * go RED with the right name):
 *   - 30 community plays + 10 cultivated AVM plays = 40 total
 *     (`WAVE_2_COMMUNITY_PLAY_COUNT === 30`, `WAVE_2_CULTIVATED_AVM_COUNT === 10`,
 *     `WAVE_2_TOTAL_PLAY_COUNT === 40`)
 *   - 60-day window (`WAVE_2_WINDOW_DAYS === 60`)
 *   - "founder-curated" curation kind
 *   - 2-bucket play composition: community + cultivated_avm (frozen split)
 *
 * **Sibling-lib doctrine** (16th confirmed app in H11 arc — see H11.18):
 * NO edits to H11.18 wave1-launch lib (107-case test still green) nor any
 * other lib. This is a fresh sibling that REUSES the H11.18 doctrine shape
 * (locked criteria + 4-week-style timeline (here 8-week) + 5-section
 * post-mortem) WITHOUT importing wave1-launch — keeps the two libs
 * independently versioned. Code duplication is intentional + acceptable
 * here: each launch wave's plan is locked separately + may diverge.
 *
 * **Two-surface library** (mirrors H11.18 contract):
 *   1. **Pre-launch plan builder** — `buildWave2Plan()` returns the
 *      frozen 60-day plan structure (composition + channels + criteria +
 *      timeline + post-mortem template).
 *   2. **Post-launch metrics evaluator** — `evaluateWave2Metrics(actual)`
 *      compares observed metrics against locked criteria → discriminated-
 *      union verdict.
 *
 * **No third-party deps** (third-party-requires invariant — only `node:`
 * prefixed core modules are used).
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/wave2-launch
 */
"use strict";

/** Sysexits-aligned exit codes. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  SOFTWARE: 70,
});

/** Masterplan-literal anchors. */
const WAVE_2_COMMUNITY_PLAY_COUNT = 30;
const WAVE_2_CULTIVATED_AVM_COUNT = 10;
const WAVE_2_TOTAL_PLAY_COUNT = WAVE_2_COMMUNITY_PLAY_COUNT + WAVE_2_CULTIVATED_AVM_COUNT;
const WAVE_2_WINDOW_DAYS = 60;
const WAVE_2_NAME = "Wave 2 — community + cultivated-AVM launch";
const WAVE_2_CURATION = "founder_curated";

/** 2-bucket composition (frozen + tested). */
const WAVE_2_COMPOSITION = Object.freeze([
  Object.freeze({
    id: "community",
    label: "Community plays",
    count: WAVE_2_COMMUNITY_PLAY_COUNT,
    sourceNote: "Harvested from public GitHub repos via H1-H6 pipeline; founder-reviewed.",
  }),
  Object.freeze({
    id: "cultivated_avm",
    label: "Cultivated AVM plays",
    count: WAVE_2_CULTIVATED_AVM_COUNT,
    sourceNote: "Composed from Azure Verified Modules per H9.22 selection; founder-authored taglines + body.",
  }),
]);

/** Channels — community-tilted vs wave 1's MSFT-anchor mix. */
const WAVE_2_CHANNELS = Object.freeze([
  "twitter_x",
  "linkedin",
  "hacker_news",
  "reddit_azure",
  "dev_to",
  "github_discussions",
  "avm_partner_email",
]);

const CHANNEL_LABEL = Object.freeze({
  twitter_x: "Twitter/X",
  linkedin: "LinkedIn",
  hacker_news: "Hacker News",
  reddit_azure: "r/azure",
  dev_to: "dev.to",
  github_discussions: "GitHub Discussions",
  avm_partner_email: "Azure Verified Modules partner email",
});

/**
 * 6 locked success criteria — tightened from H11.18 (2× plays = ~2× signups
 * + ~3× conversions; press_mentions also bumped because we have a
 * launch-wave-1 case study to reference).
 *
 * Founder MAY tighten pre-launch but NEVER LOOSEN after launch (the
 * lock-in doctrine from H11.18, re-applied verbatim).
 */
const WAVE_2_SUCCESS_CRITERIA = Object.freeze([
  Object.freeze({
    id: "plays_landed",
    label: "Total Wave-2 plays published",
    target: WAVE_2_TOTAL_PLAY_COUNT,
    op: ">=",
    unit: "plays",
    drivers: Object.freeze(["harvest_pipeline", "avm_composer", "founder_review"]),
  }),
  Object.freeze({
    id: "github_stars",
    label: "frootai-core GitHub stars (delta over wave)",
    target: 500,
    op: ">=",
    unit: "stars",
    drivers: Object.freeze(["twitter_x", "hacker_news", "dev_to"]),
  }),
  Object.freeze({
    id: "signups",
    label: "frootai.dev free-tier signups (delta)",
    target: 250,
    op: ">=",
    unit: "signups",
    drivers: Object.freeze(["twitter_x", "linkedin", "dev_to", "avm_partner_email"]),
  }),
  Object.freeze({
    id: "paid_conversions",
    label: "Free → Pro conversions (Stripe)",
    target: 15,
    op: ">=",
    unit: "conversions",
    drivers: Object.freeze(["account_portal", "upgrade_cta"]),
  }),
  Object.freeze({
    id: "press_mentions",
    label: "External press / blog mentions",
    target: 5,
    op: ">=",
    unit: "mentions",
    drivers: Object.freeze(["avm_partner_email", "hacker_news", "dev_to"]),
  }),
  Object.freeze({
    id: "community_prs",
    label: "Community-contributed Solution Play PRs (new criterion vs Wave 1)",
    target: 10,
    op: ">=",
    unit: "prs",
    drivers: Object.freeze(["github_discussions", "dev_to"]),
  }),
]);

/**
 * 8-week cadence — double Wave 1's 4-week window per masterplan literal
 * "60-day plan". Same focus-vocabulary as Wave 1 for cross-wave retro
 * comparison.
 */
const WAVE_2_TIMELINE = Object.freeze([
  Object.freeze({ week: 1, label: "Pre-launch: AVM composition finishes; 10 cultivated plays validated", focus: "harvest_quality" }),
  Object.freeze({ week: 2, label: "Pre-launch: 30 community plays harvested + founder-reviewed", focus: "harvest_quality" }),
  Object.freeze({ week: 3, label: "Launch week 1: AVM-anchor staged drop (Twitter + dev.to + AVM email)", focus: "channel_push" }),
  Object.freeze({ week: 4, label: "Launch week 2: Community-anchor staged drop (LinkedIn + HN + reddit)", focus: "channel_push" }),
  Object.freeze({ week: 5, label: "Activation: onboard signups + nurture toward Pro conversion", focus: "activation" }),
  Object.freeze({ week: 6, label: "Community: open GitHub Discussions + accept first community PRs", focus: "community" }),
  Object.freeze({ week: 7, label: "Mid-wave checkpoint: measure interim metrics; founder may pivot allocation", focus: "checkpoint" }),
  Object.freeze({ week: 8, label: "Post-mortem: collect metrics, write retro, freeze targets for Wave 3", focus: "retro" }),
]);

/** Locked 5-section post-mortem template (same shape as H11.18 — re-used
 *  for cross-wave readability). */
const POST_MORTEM_SECTIONS = Object.freeze([
  "metrics_vs_targets",
  "what_worked",
  "what_missed",
  "channel_lessons",
  "wave_3_changes",
]);

const POST_MORTEM_SECTION_COPY = Object.freeze({
  metrics_vs_targets: "Metrics vs. targets",
  what_worked: "What worked",
  what_missed: "What missed",
  channel_lessons: "Channel-level lessons",
  wave_3_changes: "Wave 3 changes",
});

class Wave2Error extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "Wave2Error";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

// ──────────────────────────────────────────────────────────────────
// Pre-launch plan builder
// ──────────────────────────────────────────────────────────────────

/**
 * Build the canonical Wave 2 launch plan. Pure. Always returns the same
 * shape — frozen + deterministic.
 *
 * @returns {{
 *   name: string,
 *   curation: string,
 *   total_play_count: number,
 *   community_play_count: number,
 *   cultivated_avm_count: number,
 *   window_days: number,
 *   composition: typeof WAVE_2_COMPOSITION,
 *   channels: ReadonlyArray<string>,
 *   channel_labels: Record<string, string>,
 *   success_criteria: typeof WAVE_2_SUCCESS_CRITERIA,
 *   timeline: typeof WAVE_2_TIMELINE,
 *   post_mortem_template: typeof POST_MORTEM_SECTIONS,
 *   doc_path: string,
 * }}
 */
function buildWave2Plan() {
  return {
    name: WAVE_2_NAME,
    curation: WAVE_2_CURATION,
    total_play_count: WAVE_2_TOTAL_PLAY_COUNT,
    community_play_count: WAVE_2_COMMUNITY_PLAY_COUNT,
    cultivated_avm_count: WAVE_2_CULTIVATED_AVM_COUNT,
    window_days: WAVE_2_WINDOW_DAYS,
    composition: WAVE_2_COMPOSITION,
    channels: WAVE_2_CHANNELS,
    channel_labels: CHANNEL_LABEL,
    success_criteria: WAVE_2_SUCCESS_CRITERIA,
    timeline: WAVE_2_TIMELINE,
    post_mortem_template: POST_MORTEM_SECTIONS,
    doc_path: "planning/launches/wave2-community-avm.md",
  };
}

// ──────────────────────────────────────────────────────────────────
// Post-launch metrics evaluator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Wave2Actuals
 * @property {number} [plays_landed]
 * @property {number} [github_stars]
 * @property {number} [signups]
 * @property {number} [paid_conversions]
 * @property {number} [press_mentions]
 * @property {number} [community_prs]
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
 * Evaluate observed Wave 2 metrics against the locked success criteria.
 * Pure. NEVER throws. Same discriminated-union shape as H11.18 so the
 * future cross-wave dashboard can render both with a single rendering
 * function.
 *
 * @param {Wave2Actuals | null | undefined} actuals
 * @returns {{
 *   criteria: CriterionResult[],
 *   total: number,
 *   passed: number,
 *   missed: number,
 *   unknown: number,
 *   verdict: "pass" | "miss" | "partial" | "unknown",
 * }}
 */
function evaluateWave2Metrics(actuals) {
  /** @type {Wave2Actuals} */
  const a = actuals && typeof actuals === "object" ? actuals : {};
  /** @type {CriterionResult[]} */
  const results = [];
  for (const c of WAVE_2_SUCCESS_CRITERIA) {
    const raw = a[/** @type {keyof Wave2Actuals} */ (c.id)];
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
 * Render the post-mortem markdown skeleton. Pure. Mirrors H11.18's
 * renderPostMortemSkeleton but section heading is "Wave 3 changes" (next-
 * wave forward-pointer) instead of "Wave 2 changes".
 *
 * @param {{evaluation?: ReturnType<typeof evaluateWave2Metrics>, launchedOn?: string, retroOn?: string}} [opts]
 * @returns {string}
 */
function renderPostMortemSkeleton(opts) {
  const o = opts || {};
  const eval_ = o.evaluation || evaluateWave2Metrics(null);
  const launchedOn = typeof o.launchedOn === "string" && o.launchedOn ? o.launchedOn : "TBD";
  const retroOn = typeof o.retroOn === "string" && o.retroOn ? o.retroOn : "TBD";
  /** @type {string[]} */
  const out = [];
  out.push(`# ${WAVE_2_NAME} — post-mortem`);
  out.push("");
  out.push(`- **Launched on**: ${launchedOn}`);
  out.push(`- **Retro on**: ${retroOn}`);
  out.push(`- **Window**: ${WAVE_2_WINDOW_DAYS} days`);
  out.push(`- **Target plays**: ${WAVE_2_TOTAL_PLAY_COUNT} (${WAVE_2_COMMUNITY_PLAY_COUNT} community + ${WAVE_2_CULTIVATED_AVM_COUNT} cultivated AVM)`);
  out.push(`- **Curation**: ${WAVE_2_CURATION}`);
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
  WAVE_2_NAME,
  WAVE_2_CURATION,
  WAVE_2_COMMUNITY_PLAY_COUNT,
  WAVE_2_CULTIVATED_AVM_COUNT,
  WAVE_2_TOTAL_PLAY_COUNT,
  WAVE_2_WINDOW_DAYS,
  WAVE_2_COMPOSITION,
  WAVE_2_CHANNELS,
  CHANNEL_LABEL,
  WAVE_2_SUCCESS_CRITERIA,
  WAVE_2_TIMELINE,
  POST_MORTEM_SECTIONS,
  POST_MORTEM_SECTION_COPY,
  Wave2Error,
  buildWave2Plan,
  evaluateWave2Metrics,
  renderPostMortemSkeleton,
};
