// @ts-check
/**
 * [H11.20] wave3-launch.js — pure planning + post-launch metrics tracker
 * for Phase H11's third launch wave (50 community + agent-author plays,
 * 90-day plan, opens community PR contribution path).
 *
 * Contract (verbatim from masterplan §3 row [H11.20]):
 *   Wave 3 launch (50 community + agent-author plays): 90-day plan;
 *   opens community PR contribution path
 *
 * **Masterplan-literal pins** (each anchored by a named test):
 *   - 50 total plays mixing community + agent-author (`WAVE_3_TOTAL_PLAY_COUNT === 50`)
 *   - 90-day window (`WAVE_3_WINDOW_DAYS === 90`)
 *   - "opens community PR contribution path" — the wave's defining
 *     deliverable beyond plays-landing-in-catalog; pinned by
 *     `WAVE_3_OPENS_CONTRIBUTION_PATH === true` + a frozen
 *     `CONTRIBUTION_PATH` artifact (CONTRIBUTING.md outline) the
 *     planning doc references
 *   - 2-bucket composition: community + agent_authored (founder reviews
 *     both; agent_authored plays are LLM-drafted then founder-reviewed
 *     per the same H3.21 doctrine that's been live since the first
 *     harvest)
 *
 * **Sibling-lib doctrine** (17th confirmed app in H11 arc — see H11.19):
 * NO edits to H11.18 wave1-launch nor H11.19 wave2-launch. Each wave is
 * a fresh sibling. Code duplication is intentional + acceptable: each
 * launch wave's plan is locked separately + may diverge.
 *
 * **Inter-wave tightening doctrine** (locked at H11.19, re-applied here):
 * every carryover criterion's Wave-3 target ≥ Wave-2 target ≥ Wave-1
 * target. New criteria allowed (Wave 3 adds `merged_community_prs` +
 * `agent_author_plays_landed`). Channel swaps allowed. The named test
 * "criteria: every Wave-3 target >= Wave-2 equivalent (tightening
 * doctrine)" enforces.
 *
 * **Two-surface library** (mirrors H11.18 / H11.19): pre-launch
 * `buildWave3Plan()` + post-launch `evaluateWave3Metrics(actuals)` +
 * `renderPostMortemSkeleton({evaluation?, launchedOn?, retroOn?})`.
 *
 * **No third-party deps** (third-party-requires invariant — only `node:`
 * prefixed core modules are used).
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/wave3-launch
 */
"use strict";

/** Sysexits-aligned exit codes. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  SOFTWARE: 70,
});

/** Masterplan-literal anchors. */
const WAVE_3_COMMUNITY_PLAY_COUNT = 30;
const WAVE_3_AGENT_AUTHORED_COUNT = 20;
const WAVE_3_TOTAL_PLAY_COUNT = WAVE_3_COMMUNITY_PLAY_COUNT + WAVE_3_AGENT_AUTHORED_COUNT;
const WAVE_3_WINDOW_DAYS = 90;
const WAVE_3_NAME = "Wave 3 — community + agent-author launch";
const WAVE_3_CURATION = "founder_reviewed";

/** Masterplan literal: this wave opens the public community PR
 *  contribution path. Pinned as a boolean so a regression that drops
 *  the contribution-path deliverable fails fast. */
const WAVE_3_OPENS_CONTRIBUTION_PATH = true;

/** 2-bucket composition: community (human-author) + agent_authored
 *  (LLM-drafted, founder-reviewed). */
const WAVE_3_COMPOSITION = Object.freeze([
  Object.freeze({
    id: "community",
    label: "Community plays",
    count: WAVE_3_COMMUNITY_PLAY_COUNT,
    sourceNote: "Harvested from public GitHub via H1-H6; founder-reviewed.",
  }),
  Object.freeze({
    id: "agent_authored",
    label: "Agent-authored plays",
    count: WAVE_3_AGENT_AUTHORED_COUNT,
    sourceNote: "LLM-drafted via H4 retrieval + H5 scaffolder + H6 customize per H3.21 doctrine; founder-reviewed before publication.",
  }),
]);

/**
 * Contribution-path artifact outline — a frozen 5-section
 * `community-plays/CONTRIBUTING.md` shape the planning doc references.
 * This is the masterplan-literal "opens community PR contribution
 * path" deliverable; it's a structure pin, not the actual file (the
 * founder writes the prose during Wave 3 pre-launch).
 */
const CONTRIBUTION_PATH = Object.freeze({
  doc_path: "frootai/orchard/community-plays/CONTRIBUTING.md",
  sections: Object.freeze([
    "what_is_a_solution_play",
    "fai_manifest_schema",
    "submit_via_pr",
    "review_sla",
    "license_attribution",
  ]),
  section_copy: Object.freeze({
    what_is_a_solution_play: "What is a Solution Play",
    fai_manifest_schema: "fai-manifest.json schema",
    submit_via_pr: "Submit via PR",
    review_sla: "Founder review SLA",
    license_attribution: "License + attribution",
  }),
  review_sla_days: 7,
});

/** 8 channels — community PR funnel doubled; partner email replaced with
 *  general-launch outreach. */
const WAVE_3_CHANNELS = Object.freeze([
  "twitter_x",
  "linkedin",
  "hacker_news",
  "reddit_azure",
  "dev_to",
  "github_discussions",
  "youtube_demo",
  "newsletter",
]);

const CHANNEL_LABEL = Object.freeze({
  twitter_x: "Twitter/X",
  linkedin: "LinkedIn",
  hacker_news: "Hacker News",
  reddit_azure: "r/azure",
  dev_to: "dev.to",
  github_discussions: "GitHub Discussions",
  youtube_demo: "YouTube demo series",
  newsletter: "Founder newsletter",
});

/**
 * 7 locked success criteria — Wave 2's 6 carried over with TIGHTENED
 * targets + 1 NEW criterion (`merged_community_prs`) reflecting that
 * Wave 3's defining contribution is OPENING the PR path.
 *
 * Cross-wave invariant pinned by test: every Wave-3 carryover target ≥
 * Wave-2 equivalent (Wave 2 ≥ Wave 1 already pinned at H11.19).
 */
const WAVE_3_SUCCESS_CRITERIA = Object.freeze([
  Object.freeze({
    id: "plays_landed",
    label: "Total Wave-3 plays published",
    target: WAVE_3_TOTAL_PLAY_COUNT,
    op: ">=",
    unit: "plays",
    drivers: Object.freeze(["harvest_pipeline", "agent_author_pipeline", "founder_review"]),
  }),
  Object.freeze({
    id: "github_stars",
    label: "frootai-core GitHub stars (delta over wave)",
    target: 1000,
    op: ">=",
    unit: "stars",
    drivers: Object.freeze(["twitter_x", "hacker_news", "dev_to", "youtube_demo"]),
  }),
  Object.freeze({
    id: "signups",
    label: "frootai.dev free-tier signups (delta)",
    target: 600,
    op: ">=",
    unit: "signups",
    drivers: Object.freeze(["twitter_x", "linkedin", "dev_to", "newsletter", "youtube_demo"]),
  }),
  Object.freeze({
    id: "paid_conversions",
    label: "Free → Pro conversions (Stripe)",
    target: 40,
    op: ">=",
    unit: "conversions",
    drivers: Object.freeze(["account_portal", "upgrade_cta", "newsletter"]),
  }),
  Object.freeze({
    id: "press_mentions",
    label: "External press / blog mentions",
    target: 10,
    op: ">=",
    unit: "mentions",
    drivers: Object.freeze(["hacker_news", "dev_to", "youtube_demo"]),
  }),
  Object.freeze({
    id: "community_prs",
    label: "Community-opened Solution Play PRs",
    target: 30,
    op: ">=",
    unit: "prs",
    drivers: Object.freeze(["github_discussions", "dev_to", "newsletter"]),
  }),
  Object.freeze({
    id: "merged_community_prs",
    label: "Community PRs merged into the catalog (Wave 3 NEW)",
    target: 15,
    op: ">=",
    unit: "merged_prs",
    drivers: Object.freeze(["founder_review", "github_discussions"]),
  }),
]);

/**
 * 12-week cadence — 3× Wave 1, 1.5× Wave 2. Adds a dedicated
 * `contribution_path_open` focus in week 5 (the masterplan-literal
 * defining deliverable) + 2 community focus weeks (vs Wave 2's 1) +
 * 2 retro weeks (mid-wave + final).
 */
const WAVE_3_TIMELINE = Object.freeze([
  Object.freeze({ week: 1, label: "Pre-launch: agent-author 20 plays via H4-H6 pipeline; founder reviews 10", focus: "harvest_quality" }),
  Object.freeze({ week: 2, label: "Pre-launch: founder reviews remaining 10 agent-author plays + harvest 30 community plays", focus: "harvest_quality" }),
  Object.freeze({ week: 3, label: "Launch week 1: staged drop on Twitter + Hacker News + dev.to + YouTube demo 1", focus: "channel_push" }),
  Object.freeze({ week: 4, label: "Launch week 2: LinkedIn + r/azure + newsletter + YouTube demo 2", focus: "channel_push" }),
  Object.freeze({ week: 5, label: "Open contribution path: publish CONTRIBUTING.md + open GitHub Discussions PR category", focus: "contribution_path_open" }),
  Object.freeze({ week: 6, label: "Activation: onboard signups + nurture toward Pro conversion", focus: "activation" }),
  Object.freeze({ week: 7, label: "Community: review first community PRs + merge first cohort", focus: "community" }),
  Object.freeze({ week: 8, label: "Mid-wave checkpoint: measure interim metrics; founder may pivot allocation", focus: "checkpoint" }),
  Object.freeze({ week: 9, label: "Community: open YouTube channel comments + dev.to follow-up posts", focus: "community" }),
  Object.freeze({ week: 10, label: "Mid-wave retro: 4-week interim retro published; founder writes Wave-3-half post-mortem", focus: "interim_retro" }),
  Object.freeze({ week: 11, label: "Activation push: re-engage signups who haven't converted via newsletter sequence", focus: "activation" }),
  Object.freeze({ week: 12, label: "Final post-mortem: collect metrics, write retro, freeze targets for Wave 4 or Phase H12 transition", focus: "retro" }),
]);

/** Locked 5-section post-mortem template — section 5 forward-points to
 *  the next wave (`wave_4_changes`) OR a phase transition. */
const POST_MORTEM_SECTIONS = Object.freeze([
  "metrics_vs_targets",
  "what_worked",
  "what_missed",
  "channel_lessons",
  "wave_4_changes",
]);

const POST_MORTEM_SECTION_COPY = Object.freeze({
  metrics_vs_targets: "Metrics vs. targets",
  what_worked: "What worked",
  what_missed: "What missed",
  channel_lessons: "Channel-level lessons",
  wave_4_changes: "Wave 4 changes (or Phase H12 transition)",
});

class Wave3Error extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "Wave3Error";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

// ──────────────────────────────────────────────────────────────────
// Pre-launch plan builder
// ──────────────────────────────────────────────────────────────────

/**
 * Build the canonical Wave 3 launch plan. Pure. Always returns the same
 * shape — frozen + deterministic.
 *
 * @returns {{
 *   name: string,
 *   curation: string,
 *   total_play_count: number,
 *   community_play_count: number,
 *   agent_authored_count: number,
 *   window_days: number,
 *   opens_contribution_path: boolean,
 *   composition: typeof WAVE_3_COMPOSITION,
 *   contribution_path: typeof CONTRIBUTION_PATH,
 *   channels: ReadonlyArray<string>,
 *   channel_labels: Record<string, string>,
 *   success_criteria: typeof WAVE_3_SUCCESS_CRITERIA,
 *   timeline: typeof WAVE_3_TIMELINE,
 *   post_mortem_template: typeof POST_MORTEM_SECTIONS,
 *   doc_path: string,
 * }}
 */
function buildWave3Plan() {
  return {
    name: WAVE_3_NAME,
    curation: WAVE_3_CURATION,
    total_play_count: WAVE_3_TOTAL_PLAY_COUNT,
    community_play_count: WAVE_3_COMMUNITY_PLAY_COUNT,
    agent_authored_count: WAVE_3_AGENT_AUTHORED_COUNT,
    window_days: WAVE_3_WINDOW_DAYS,
    opens_contribution_path: WAVE_3_OPENS_CONTRIBUTION_PATH,
    composition: WAVE_3_COMPOSITION,
    contribution_path: CONTRIBUTION_PATH,
    channels: WAVE_3_CHANNELS,
    channel_labels: CHANNEL_LABEL,
    success_criteria: WAVE_3_SUCCESS_CRITERIA,
    timeline: WAVE_3_TIMELINE,
    post_mortem_template: POST_MORTEM_SECTIONS,
    doc_path: "planning/launches/wave3-community-agent-author.md",
  };
}

// ──────────────────────────────────────────────────────────────────
// Post-launch metrics evaluator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Wave3Actuals
 * @property {number} [plays_landed]
 * @property {number} [github_stars]
 * @property {number} [signups]
 * @property {number} [paid_conversions]
 * @property {number} [press_mentions]
 * @property {number} [community_prs]
 * @property {number} [merged_community_prs]
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
 * Evaluate observed Wave 3 metrics against the locked success criteria.
 * Pure. NEVER throws. Same discriminated-union shape as H11.18/H11.19.
 *
 * @param {Wave3Actuals | null | undefined} actuals
 * @returns {{
 *   criteria: CriterionResult[],
 *   total: number,
 *   passed: number,
 *   missed: number,
 *   unknown: number,
 *   verdict: "pass" | "miss" | "partial" | "unknown",
 * }}
 */
function evaluateWave3Metrics(actuals) {
  /** @type {Wave3Actuals} */
  const a = actuals && typeof actuals === "object" ? actuals : {};
  /** @type {CriterionResult[]} */
  const results = [];
  for (const c of WAVE_3_SUCCESS_CRITERIA) {
    const raw = a[/** @type {keyof Wave3Actuals} */ (c.id)];
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
 * Render the post-mortem markdown skeleton. Pure.
 *
 * @param {{evaluation?: ReturnType<typeof evaluateWave3Metrics>, launchedOn?: string, retroOn?: string}} [opts]
 * @returns {string}
 */
function renderPostMortemSkeleton(opts) {
  const o = opts || {};
  const eval_ = o.evaluation || evaluateWave3Metrics(null);
  const launchedOn = typeof o.launchedOn === "string" && o.launchedOn ? o.launchedOn : "TBD";
  const retroOn = typeof o.retroOn === "string" && o.retroOn ? o.retroOn : "TBD";
  /** @type {string[]} */
  const out = [];
  out.push(`# ${WAVE_3_NAME} — post-mortem`);
  out.push("");
  out.push(`- **Launched on**: ${launchedOn}`);
  out.push(`- **Retro on**: ${retroOn}`);
  out.push(`- **Window**: ${WAVE_3_WINDOW_DAYS} days`);
  out.push(`- **Target plays**: ${WAVE_3_TOTAL_PLAY_COUNT} (${WAVE_3_COMMUNITY_PLAY_COUNT} community + ${WAVE_3_AGENT_AUTHORED_COUNT} agent-authored)`);
  out.push(`- **Curation**: ${WAVE_3_CURATION}`);
  out.push(`- **Opens community PR contribution path**: ${WAVE_3_OPENS_CONTRIBUTION_PATH ? "yes" : "no"}`);
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
  WAVE_3_NAME,
  WAVE_3_CURATION,
  WAVE_3_COMMUNITY_PLAY_COUNT,
  WAVE_3_AGENT_AUTHORED_COUNT,
  WAVE_3_TOTAL_PLAY_COUNT,
  WAVE_3_WINDOW_DAYS,
  WAVE_3_OPENS_CONTRIBUTION_PATH,
  WAVE_3_COMPOSITION,
  CONTRIBUTION_PATH,
  WAVE_3_CHANNELS,
  CHANNEL_LABEL,
  WAVE_3_SUCCESS_CRITERIA,
  WAVE_3_TIMELINE,
  POST_MORTEM_SECTIONS,
  POST_MORTEM_SECTION_COPY,
  Wave3Error,
  buildWave3Plan,
  evaluateWave3Metrics,
  renderPostMortemSkeleton,
};
