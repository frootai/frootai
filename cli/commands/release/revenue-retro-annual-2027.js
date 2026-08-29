// @ts-check
/**
 * [H11.25] revenue-retro-annual-2027.js — pure plan + evaluator + renderer
 * for the annual 2027 revenue retrospective.
 *
 * Contract (verbatim from masterplan §3 row [H11.25]):
 *   Annual retro 2027: full year shape + ARR trajectory + cohort LTV +
 *   cost-to-acquire-customer trend
 *
 * **Sibling-lib doctrine** (22nd confirmed app): NO edits to H11.18
 * (107) / H11.19 (130) / H11.20 (151) / H11.23 (167) / H11.24 (189).
 * The annual retro CONSUMES the 4 quarterly retro plans as input
 * (`quarterlyRetroPlans[]`) — same evaluator-result-as-input pattern as
 * H11.24 consuming H11.23. NO runtime cross-imports.
 *
 * **5 SECTIONS** in masterplan-row-driven order: full_year_shape /
 * arr_trajectory / cohort_ltv / cac_trend / roadmap_2028. The
 * masterplan literal lists 4 deliverables; we add `roadmap_2028` as
 * the year-end decision-recording section (parallel to H11.24's
 * roadmap_adjustment but for the FULL NEXT YEAR not just Q3).
 *
 * **2027 TARGETS** STRICT-MONOTONIC TIGHTENED from Q4 (assumed to
 * have tightened from Q3 / Q2 / Q1 per H11.20 doctrine extended):
 *   - ARR target €120k (10× Q1 MRR × 12)
 *   - LTV floor €600 per paying user (12 months × €50 ARPU)
 *   - CAC ceiling €200 per acquired user (LTV/CAC ≥ 3 healthy)
 *   - LTV/CAC ratio floor 3.0 (industry-healthy SaaS gate)
 *   - annual gross churn ceiling 5% (Q2 was 7%, Q4 expected 6%)
 *   - cohort retention M12 floor 35% (NEW annual signal)
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/revenue-retro-annual-2027
 */
"use strict";

/** Sysexits-aligned exit codes. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  DATA_ERR: 65,
  SOFTWARE: 70,
});

/** Masterplan-literal anchors. */
const REVENUE_RETRO_ANNUAL_DOC_PATH = "planning/retros/harvest-annual-2027.md";
const ANNUAL_LABEL = "Annual 2027";
const ANNUAL_YEAR_KEY = "2027";

/** Retro section order (masterplan-row-driven). */
const RETRO_SECTIONS = Object.freeze([
  "full_year_shape",
  "arr_trajectory",
  "cohort_ltv",
  "cac_trend",
  "roadmap_2028",
]);

/** Per-section display copy. */
const RETRO_SECTION_COPY = Object.freeze({
  full_year_shape: Object.freeze({
    title: "Full year shape (Q1 → Q4 verdicts)",
    body: "What did each quarter look like overall (pass / warn / miss)? How many quarterly objectives did we land out of total? Which themes recurred (a criterion that missed in 2+ quarters is a structural problem, not a one-off).",
  }),
  arr_trajectory: Object.freeze({
    title: "ARR trajectory",
    body: "End-of-year ARR in €, MoM growth shape across 12 months, the 3 largest single-month jumps + the 3 largest dips. Compare to 2027 ARR floor (€120k). Identify the inflection-point months (a launch wave landing, a partner deal closing, a churn event).",
  }),
  cohort_ltv: Object.freeze({
    title: "Cohort LTV (lifetime value)",
    body: "Per-cohort LTV = average revenue per paying user × estimated lifetime months. Use M12 retention as the lifetime-floor proxy. Compare to 2027 LTV floor (€600 per paying user). Identify the strongest + weakest cohort + a hypothesis for the gap.",
  }),
  cac_trend: Object.freeze({
    title: "CAC trend (cost to acquire customer)",
    body: "Per-quarter CAC = (channel spend + tooling) / new paying users in that quarter. Trend across 4 quarters. Compare to 2027 CAC ceiling (€200) AND the LTV/CAC ratio floor (3.0 — industry-healthy SaaS gate). A CAC bump in Q3 + Q4 vs Q1 + Q2 means channels saturated.",
  }),
  roadmap_2028: Object.freeze({
    title: "Roadmap 2028 (year-shape decisions)",
    body: "Based on the 2027 actuals: which Phase H12+ scope items DESCALATE (defer / drop)? Which ESCALATE (priority bump / new sub-phase)? Which DOUBLE-DOWN (re-commit at higher scale)? Record the 5 decisions the founder is committing to for 2028 H1.",
  }),
});

/** 2027 annual targets locked. */
const ANNUAL_2027_ARR_TARGET_EUR = 120_000;
const ANNUAL_2027_LTV_FLOOR_EUR = 600;
const ANNUAL_2027_CAC_CEIL_EUR = 200;
const ANNUAL_2027_LTV_CAC_RATIO_FLOOR = 3.0;
const ANNUAL_2027_CHURN_CEIL_PCT = 5;
const ANNUAL_2027_M12_RETENTION_FLOOR_PCT = 35;

/** Mirrors H11.20+/H11.21+/H11.22+/H11.23+/H11.24 — kept duplicated. */
const FOUNDER_REVIEW_SLA_DAYS = 7;

/** Verdict alphabets. */
const VERDICTS = Object.freeze(["pass", "warn", "miss", "unknown"]);
const TRAJECTORY_TRENDS = Object.freeze(["accelerating", "steady", "decelerating", "unknown"]);

/** Allowed roadmap-2028 kinds (extends H11.24's 3 with `double_down`). */
const ROADMAP_2028_KINDS = Object.freeze(["descalate", "escalate", "hold", "double_down"]);

/** Quarter keys (Q1-Q4 of 2027). */
const QUARTER_KEYS = Object.freeze(["2027-Q1", "2027-Q2", "2027-Q3", "2027-Q4"]);

class RevenueRetroAnnualError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "RevenueRetroAnnualError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

// ──────────────────────────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────────────────────────

/** @param {unknown} n @returns {number|null} */
function coerceNonNegative(n) {
  if (typeof n !== "number") return null;
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

/** @param {number|null} n @param {number} decimals @returns {number|null} */
function roundTo(n, decimals) {
  if (n == null || !Number.isFinite(n)) return null;
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}

// ──────────────────────────────────────────────────────────────────
// Full year shape
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} QuarterlyRetroSummary
 * @property {string} quarter
 * @property {"pass"|"warn"|"miss"|"unknown"} overall_verdict
 * @property {ReadonlyArray<string>} [recurring_misses]
 */

/**
 * @typedef {object} FullYearShape
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {ReadonlyArray<QuarterlyRetroSummary>} quarters
 * @property {number} quarter_count
 * @property {number} passes
 * @property {number} warns
 * @property {number} misses
 * @property {number} unknowns
 * @property {ReadonlyArray<string>} recurring_themes — criteria/items that missed in 2+ quarters
 */

/**
 * Summarise the 4 quarterly retros into a year shape. Pure.
 *
 * @param {unknown} quarterlyRetroPlans
 * @returns {FullYearShape}
 */
function buildFullYearShape(quarterlyRetroPlans) {
  /** @type {FullYearShape} */
  const base = {
    verdict: "unknown",
    quarters: Object.freeze([]),
    quarter_count: 0,
    passes: 0,
    warns: 0,
    misses: 0,
    unknowns: 0,
    recurring_themes: Object.freeze([]),
  };
  if (!Array.isArray(quarterlyRetroPlans)) return base;
  /** @type {QuarterlyRetroSummary[]} */
  const cleaned = [];
  /** @type {Map<string, number>} */
  const missCount = new Map();
  for (const p of quarterlyRetroPlans) {
    if (!p || typeof p !== "object") continue;
    const plan = /** @type {Record<string, unknown>} */ (p);
    const quarter = typeof plan.quarter === "string" && QUARTER_KEYS.includes(plan.quarter)
      ? plan.quarter : null;
    if (quarter == null) continue;
    const verdict = typeof plan.overall_verdict === "string" && VERDICTS.includes(/** @type {string} */ (plan.overall_verdict))
      ? /** @type {"pass"|"warn"|"miss"|"unknown"} */ (plan.overall_verdict) : "unknown";
    /** @type {string[]} */
    const missesThisQ = [];
    // Pull miss-criterion ids from any section that exposes miss_criteria
    if (plan.sections && typeof plan.sections === "object") {
      const sections = /** @type {Record<string, unknown>} */ (plan.sections);
      for (const section of Object.values(sections)) {
        if (!section || typeof section !== "object") continue;
        const s = /** @type {Record<string, unknown>} */ (section);
        if (Array.isArray(s.miss_criteria)) {
          for (const id of s.miss_criteria) {
            if (typeof id === "string") missesThisQ.push(id);
          }
        }
      }
    }
    for (const id of missesThisQ) {
      missCount.set(id, (missCount.get(id) || 0) + 1);
    }
    cleaned.push({
      quarter,
      overall_verdict: verdict,
      recurring_misses: Object.freeze(missesThisQ),
    });
  }
  cleaned.sort((a, b) => a.quarter.localeCompare(b.quarter));
  base.quarters = Object.freeze(cleaned);
  base.quarter_count = cleaned.length;
  for (const q of cleaned) {
    if (q.overall_verdict === "pass") base.passes += 1;
    else if (q.overall_verdict === "warn") base.warns += 1;
    else if (q.overall_verdict === "miss") base.misses += 1;
    else base.unknowns += 1;
  }
  /** @type {string[]} */
  const recurring = [];
  for (const [id, count] of missCount.entries()) {
    if (count >= 2) recurring.push(id);
  }
  recurring.sort();
  base.recurring_themes = Object.freeze(recurring);
  // Verdict
  if (cleaned.length === 0) {
    base.verdict = "unknown";
  } else if (base.misses === 0 && base.warns === 0) {
    base.verdict = "pass";
  } else if (base.misses === 0) {
    base.verdict = "warn";
  } else if (base.misses <= 1) {
    base.verdict = "warn";
  } else {
    base.verdict = "miss";
  }
  return base;
}

// ──────────────────────────────────────────────────────────────────
// ARR trajectory
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} MonthlyMrr
 * @property {string} month — "YYYY-MM"
 * @property {number} mrr_eur
 */

/**
 * @typedef {object} ArrTrajectory
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {"accelerating"|"steady"|"decelerating"|"unknown"} trend
 * @property {number|null} arr_eur — end-of-year ARR
 * @property {number} target_eur
 * @property {number|null} delta_eur
 * @property {ReadonlyArray<MonthlyMrr>} monthly
 * @property {ReadonlyArray<{month: string, delta_eur: number}>} top_jumps
 * @property {ReadonlyArray<{month: string, delta_eur: number}>} top_dips
 */

/**
 * Build the ARR trajectory from 12 monthly MRR snapshots. Pure.
 *
 * @param {unknown} monthlyMrrSnapshots
 * @returns {ArrTrajectory}
 */
function buildArrTrajectory(monthlyMrrSnapshots) {
  /** @type {ArrTrajectory} */
  const base = {
    verdict: "unknown",
    trend: "unknown",
    arr_eur: null,
    target_eur: ANNUAL_2027_ARR_TARGET_EUR,
    delta_eur: null,
    monthly: Object.freeze([]),
    top_jumps: Object.freeze([]),
    top_dips: Object.freeze([]),
  };
  if (!Array.isArray(monthlyMrrSnapshots)) return base;
  /** @type {MonthlyMrr[]} */
  const cleaned = [];
  for (const m of monthlyMrrSnapshots) {
    if (!m || typeof m !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (m);
    const month = typeof row.month === "string" && /^\d{4}-\d{2}$/.test(row.month) ? row.month : null;
    const mrr = coerceNonNegative(row.mrr_eur);
    if (month == null || mrr == null) continue;
    cleaned.push({ month, mrr_eur: mrr });
  }
  cleaned.sort((a, b) => a.month.localeCompare(b.month));
  base.monthly = Object.freeze(cleaned);
  if (cleaned.length === 0) return base;
  // ARR = end-of-year MRR × 12
  const endMrr = cleaned[cleaned.length - 1].mrr_eur;
  base.arr_eur = endMrr * 12;
  base.delta_eur = base.arr_eur - ANNUAL_2027_ARR_TARGET_EUR;
  // Top jumps + dips
  /** @type {{month: string, delta_eur: number}[]} */
  const deltas = [];
  for (let i = 1; i < cleaned.length; i += 1) {
    const d = roundTo(cleaned[i].mrr_eur - cleaned[i - 1].mrr_eur, 2) ?? 0;
    deltas.push({ month: cleaned[i].month, delta_eur: d });
  }
  base.top_jumps = Object.freeze(deltas
    .filter((d) => d.delta_eur > 0)
    .sort((a, b) => b.delta_eur - a.delta_eur)
    .slice(0, 3)
    .map((x) => Object.freeze(x)));
  base.top_dips = Object.freeze(deltas
    .filter((d) => d.delta_eur < 0)
    .sort((a, b) => a.delta_eur - b.delta_eur)
    .slice(0, 3)
    .map((x) => Object.freeze(x)));
  // Trend: compare first-half avg growth vs second-half avg growth
  if (deltas.length >= 4) {
    const half = Math.floor(deltas.length / 2);
    const firstAvg = deltas.slice(0, half).reduce((a, b) => a + b.delta_eur, 0) / half;
    const secondAvg = deltas.slice(half).reduce((a, b) => a + b.delta_eur, 0) / (deltas.length - half);
    const diff = secondAvg - firstAvg;
    if (Math.abs(diff) < 50) base.trend = "steady";
    else if (diff > 0) base.trend = "accelerating";
    else base.trend = "decelerating";
  }
  // Verdict
  if (base.arr_eur >= ANNUAL_2027_ARR_TARGET_EUR) base.verdict = "pass";
  else if (base.arr_eur >= ANNUAL_2027_ARR_TARGET_EUR * 0.75) base.verdict = "warn";
  else base.verdict = "miss";
  return base;
}

// ──────────────────────────────────────────────────────────────────
// Cohort LTV
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} CohortLtvRow
 * @property {string} cohort — "YYYY-MM"
 * @property {number} arpu_eur — average revenue per paying user per month
 * @property {number} m12_retention_pct — retention at month 12 (or projected)
 */

/**
 * @typedef {object} CohortLtvSummary
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {ReadonlyArray<CohortLtvRow & {ltv_eur: number}>} cohorts
 * @property {number|null} avg_ltv_eur
 * @property {number|null} avg_m12_retention_pct
 * @property {{ltv_floor_eur: number, m12_floor_pct: number}} floors
 * @property {{cohort: string, ltv_eur: number}|null} strongest
 * @property {{cohort: string, ltv_eur: number}|null} weakest
 */

/**
 * Compute LTV per cohort + summary. Pure.
 *
 * LTV = arpu × (12 / (1 - retention/100)) capped at 36 months for safety.
 * For tractability we use the simpler proxy: LTV = arpu × 12 × (m12_retention/100 + 1) / 2
 * — average of starting strength and m12 strength, ×12 months.
 *
 * @param {unknown} cohortRows
 * @returns {CohortLtvSummary}
 */
function buildCohortLtvSummary(cohortRows) {
  const floors = { ltv_floor_eur: ANNUAL_2027_LTV_FLOOR_EUR, m12_floor_pct: ANNUAL_2027_M12_RETENTION_FLOOR_PCT };
  /** @type {CohortLtvSummary} */
  const base = {
    verdict: "unknown",
    cohorts: Object.freeze([]),
    avg_ltv_eur: null,
    avg_m12_retention_pct: null,
    floors,
    strongest: null,
    weakest: null,
  };
  if (!Array.isArray(cohortRows)) return base;
  /** @type {Array<CohortLtvRow & {ltv_eur: number}>} */
  const cleaned = [];
  for (const r of cohortRows) {
    if (!r || typeof r !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (r);
    const cohort = typeof row.cohort === "string" && /^\d{4}-\d{2}$/.test(row.cohort) ? row.cohort : null;
    const arpu = coerceNonNegative(row.arpu_eur);
    const m12 = coerceNonNegative(row.m12_retention_pct);
    if (cohort == null || arpu == null || m12 == null) continue;
    const clampedM12 = Math.min(100, m12);
    const ltv = roundTo(arpu * 12 * ((clampedM12 / 100 + 1) / 2), 2) ?? 0;
    cleaned.push({ cohort, arpu_eur: arpu, m12_retention_pct: clampedM12, ltv_eur: ltv });
  }
  cleaned.sort((a, b) => a.cohort.localeCompare(b.cohort));
  base.cohorts = Object.freeze(cleaned.map((c) => Object.freeze(c)));
  if (cleaned.length === 0) return base;
  base.avg_ltv_eur = roundTo(cleaned.reduce((a, b) => a + b.ltv_eur, 0) / cleaned.length, 2);
  base.avg_m12_retention_pct = roundTo(cleaned.reduce((a, b) => a + b.m12_retention_pct, 0) / cleaned.length, 1);
  const sortedByLtv = [...cleaned].sort((a, b) => b.ltv_eur - a.ltv_eur);
  base.strongest = { cohort: sortedByLtv[0].cohort, ltv_eur: sortedByLtv[0].ltv_eur };
  base.weakest = { cohort: sortedByLtv[sortedByLtv.length - 1].cohort, ltv_eur: sortedByLtv[sortedByLtv.length - 1].ltv_eur };
  // Verdict
  const ltvOk = base.avg_ltv_eur != null && base.avg_ltv_eur >= floors.ltv_floor_eur;
  const m12Ok = base.avg_m12_retention_pct != null && base.avg_m12_retention_pct >= floors.m12_floor_pct;
  if (ltvOk && m12Ok) base.verdict = "pass";
  else if (
    base.avg_ltv_eur != null && base.avg_ltv_eur >= floors.ltv_floor_eur * 0.8 &&
    base.avg_m12_retention_pct != null && base.avg_m12_retention_pct >= floors.m12_floor_pct * 0.8
  ) base.verdict = "warn";
  else base.verdict = "miss";
  return base;
}

// ──────────────────────────────────────────────────────────────────
// CAC trend
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} QuarterlyCacInput
 * @property {string} quarter — "YYYY-Qn"
 * @property {number} channel_spend_eur
 * @property {number} tooling_eur
 * @property {number} new_paying_users
 */

/**
 * @typedef {object} CacTrend
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {"accelerating"|"steady"|"decelerating"|"unknown"} trend
 * @property {ReadonlyArray<{quarter: string, cac_eur: number|null, total_spend_eur: number, new_paying_users: number}>} quarters
 * @property {number|null} avg_cac_eur
 * @property {number|null} ltv_cac_ratio — computed from cohortLtv if provided
 * @property {number} ceiling
 * @property {number} ratio_floor
 */

/**
 * Compute CAC trend across quarters + LTV/CAC ratio. Pure.
 *
 * @param {unknown} quarterlyInputs
 * @param {number|null} [avgLtvEur]
 * @returns {CacTrend}
 */
function buildCacTrend(quarterlyInputs, avgLtvEur) {
  /** @type {CacTrend} */
  const base = {
    verdict: "unknown",
    trend: "unknown",
    quarters: Object.freeze([]),
    avg_cac_eur: null,
    ltv_cac_ratio: null,
    ceiling: ANNUAL_2027_CAC_CEIL_EUR,
    ratio_floor: ANNUAL_2027_LTV_CAC_RATIO_FLOOR,
  };
  if (!Array.isArray(quarterlyInputs)) return base;
  /** @type {Array<{quarter: string, cac_eur: number|null, total_spend_eur: number, new_paying_users: number}>} */
  const cleaned = [];
  for (const q of quarterlyInputs) {
    if (!q || typeof q !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (q);
    const quarter = typeof row.quarter === "string" && /^\d{4}-Q[1-4]$/.test(row.quarter) ? row.quarter : null;
    const channel = coerceNonNegative(row.channel_spend_eur);
    const tooling = coerceNonNegative(row.tooling_eur);
    const newUsers = coerceNonNegative(row.new_paying_users);
    if (quarter == null || channel == null || tooling == null || newUsers == null) continue;
    const spend = roundTo(channel + tooling, 2) ?? 0;
    const cac = newUsers > 0 ? roundTo(spend / newUsers, 2) : null;
    cleaned.push({
      quarter,
      cac_eur: cac,
      total_spend_eur: spend,
      new_paying_users: Math.floor(newUsers),
    });
  }
  cleaned.sort((a, b) => a.quarter.localeCompare(b.quarter));
  base.quarters = Object.freeze(cleaned.map((c) => Object.freeze(c)));
  if (cleaned.length === 0) return base;
  const cacVals = cleaned.map((c) => c.cac_eur).filter((v) => typeof v === "number");
  base.avg_cac_eur = cacVals.length > 0 ? roundTo(cacVals.reduce((a, b) => a + b, 0) / cacVals.length, 2) : null;
  // LTV/CAC ratio
  if (avgLtvEur != null && base.avg_cac_eur != null && base.avg_cac_eur > 0) {
    base.ltv_cac_ratio = roundTo(avgLtvEur / base.avg_cac_eur, 2);
  }
  // Trend: first half vs second half avg CAC
  if (cacVals.length >= 4) {
    const half = Math.floor(cacVals.length / 2);
    const firstAvg = cacVals.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const secondAvg = cacVals.slice(half).reduce((a, b) => a + b, 0) / (cacVals.length - half);
    const diff = secondAvg - firstAvg;
    if (Math.abs(diff) < 10) base.trend = "steady";
    else if (diff > 0) base.trend = "decelerating"; // CAC up = customer acquisition decelerating
    else base.trend = "accelerating"; // CAC down = acquisition more efficient
  }
  // Verdict: CAC ≤ ceiling AND LTV/CAC ≥ floor → pass
  const cacOk = base.avg_cac_eur != null && base.avg_cac_eur <= ANNUAL_2027_CAC_CEIL_EUR;
  const ratioOk = base.ltv_cac_ratio == null || base.ltv_cac_ratio >= ANNUAL_2027_LTV_CAC_RATIO_FLOOR;
  if (cacOk && ratioOk) base.verdict = "pass";
  else if (
    base.avg_cac_eur != null && base.avg_cac_eur <= ANNUAL_2027_CAC_CEIL_EUR * 1.25 &&
    (base.ltv_cac_ratio == null || base.ltv_cac_ratio >= ANNUAL_2027_LTV_CAC_RATIO_FLOOR * 0.8)
  ) base.verdict = "warn";
  else base.verdict = "miss";
  return base;
}

// ──────────────────────────────────────────────────────────────────
// Roadmap 2028 (parallel to H11.24 buildRoadmapAdjustment but ≥5 decisions)
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Roadmap2028Decision
 * @property {string} item
 * @property {"descalate"|"escalate"|"hold"|"double_down"} kind
 * @property {string} rationale
 */

/**
 * @typedef {object} Roadmap2028
 * @property {"pass"|"warn"|"unknown"} verdict
 * @property {ReadonlyArray<Roadmap2028Decision>} decisions
 * @property {number} required_count
 * @property {Record<string, number>} count_by_kind
 */

/**
 * @param {unknown} decisions
 * @returns {Roadmap2028}
 */
function buildRoadmap2028(decisions) {
  /** @type {Roadmap2028} */
  const base = {
    verdict: "unknown",
    decisions: Object.freeze([]),
    required_count: 5,
    count_by_kind: { descalate: 0, escalate: 0, hold: 0, double_down: 0 },
  };
  if (!Array.isArray(decisions)) return base;
  /** @type {Roadmap2028Decision[]} */
  const cleaned = [];
  for (const d of decisions) {
    if (!d || typeof d !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (d);
    const item = typeof row.item === "string" && row.item.trim().length > 0 ? row.item.trim() : null;
    const kind = typeof row.kind === "string" && ROADMAP_2028_KINDS.includes(row.kind)
      ? /** @type {"descalate"|"escalate"|"hold"|"double_down"} */ (row.kind)
      : null;
    const rationale = typeof row.rationale === "string" && row.rationale.trim().length > 0 ? row.rationale.trim() : null;
    if (item == null || kind == null || rationale == null) continue;
    cleaned.push(Object.freeze({ item, kind, rationale }));
    base.count_by_kind[kind] = (base.count_by_kind[kind] || 0) + 1;
  }
  base.decisions = Object.freeze(cleaned);
  if (cleaned.length === 0) base.verdict = "unknown";
  else if (cleaned.length >= base.required_count) base.verdict = "pass";
  else base.verdict = "warn";
  return base;
}

// ──────────────────────────────────────────────────────────────────
// Top-level plan builder
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} AnnualRetroPlanInput
 * @property {ReadonlyArray<{quarter?: string, overall_verdict?: string, sections?: object}> | null} [quarterlyRetroPlans]
 * @property {ReadonlyArray<MonthlyMrr> | null} [monthlyMrr]
 * @property {ReadonlyArray<CohortLtvRow> | null} [cohortLtv]
 * @property {ReadonlyArray<QuarterlyCacInput> | null} [quarterlyCac]
 * @property {ReadonlyArray<Roadmap2028Decision> | null} [roadmap2028Decisions]
 */

/**
 * @typedef {object} AnnualRetroPlan
 * @property {string} year
 * @property {string} label
 * @property {string} doc_path
 * @property {ReadonlyArray<string>} section_order
 * @property {{
 *   full_year_shape: FullYearShape,
 *   arr_trajectory: ArrTrajectory,
 *   cohort_ltv: CohortLtvSummary,
 *   cac_trend: CacTrend,
 *   roadmap_2028: Roadmap2028,
 * }} sections
 * @property {"pass"|"warn"|"miss"|"unknown"} overall_verdict
 * @property {string} doctrine_note
 */

/**
 * Build the annual 2027 retro plan from raw inputs. Pure. NEVER throws.
 *
 * @param {AnnualRetroPlanInput} [input]
 * @returns {AnnualRetroPlan}
 */
function buildAnnualRetroPlan(input) {
  const i = input && typeof input === "object" ? input : {};
  const shape = buildFullYearShape(i.quarterlyRetroPlans ?? null);
  const arr = buildArrTrajectory(i.monthlyMrr ?? null);
  const ltv = buildCohortLtvSummary(i.cohortLtv ?? null);
  const cac = buildCacTrend(i.quarterlyCac ?? null, ltv.avg_ltv_eur);
  const roadmap = buildRoadmap2028(i.roadmap2028Decisions ?? null);
  const overall = rollUpVerdict([
    shape.verdict,
    arr.verdict,
    ltv.verdict,
    cac.verdict,
    mapRoadmapVerdict(roadmap.verdict),
  ]);
  return {
    year: ANNUAL_YEAR_KEY,
    label: ANNUAL_LABEL,
    doc_path: REVENUE_RETRO_ANNUAL_DOC_PATH,
    section_order: RETRO_SECTIONS,
    sections: {
      full_year_shape: shape,
      arr_trajectory: arr,
      cohort_ltv: ltv,
      cac_trend: cac,
      roadmap_2028: roadmap,
    },
    overall_verdict: overall,
    doctrine_note: "2027 targets STRICT-MONOTONIC TIGHTENED from Q4 per H11.18 lock-in + H11.20 strict-monotonic extended through the annual cadence; published 2027 floors are locked alongside actuals + inform 2028 floor-setting.",
  };
}

/**
 * @param {ReadonlyArray<string>} verdicts
 * @returns {"pass"|"warn"|"miss"|"unknown"}
 */
function rollUpVerdict(verdicts) {
  if (!Array.isArray(verdicts) || verdicts.length === 0) return "unknown";
  if (verdicts.includes("miss")) return "miss";
  if (verdicts.includes("warn")) return "warn";
  if (verdicts.includes("pass")) return "pass";
  return "unknown";
}

/**
 * Map roadmap verdict (pass/warn/unknown) onto standard alphabet. Pure.
 *
 * @param {string} v
 * @returns {"pass"|"warn"|"miss"|"unknown"}
 */
function mapRoadmapVerdict(v) {
  if (v === "pass") return "pass";
  if (v === "warn") return "warn";
  return "unknown";
}

// ──────────────────────────────────────────────────────────────────
// Renderer
// ──────────────────────────────────────────────────────────────────

/**
 * @param {AnnualRetroPlan} plan
 * @param {{publishedOn?: string|null}} [opts]
 * @returns {string}
 */
function renderRetroDoc(plan, opts) {
  if (!plan || typeof plan !== "object") {
    throw new RevenueRetroAnnualError("usage", "plan must be an object", { exitCode: EXIT.USAGE });
  }
  const publishedOn = opts && typeof opts.publishedOn === "string" ? opts.publishedOn : "TBD";
  /** @type {string[]} */
  const out = [];
  out.push(`# Revenue retro — ${plan.label}`);
  out.push("");
  out.push(`> **Year**: ${plan.year}  `);
  out.push(`> **Published on**: ${publishedOn}  `);
  out.push(`> **Overall verdict**: ${verdictEmoji(plan.overall_verdict)} \`${plan.overall_verdict}\``);
  out.push("");
  out.push(`Annual 2027 retro covers: full year shape + ARR trajectory + cohort LTV + cost-to-acquire-customer trend (+ Roadmap 2028 decisions).`);
  out.push("");
  out.push(`Doctrine: ${plan.doctrine_note}`);
  out.push("");

  // 1. Full year shape
  const shape = plan.sections.full_year_shape;
  out.push(`## 1. ${RETRO_SECTION_COPY.full_year_shape.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(shape.verdict)} \`${shape.verdict}\`  `);
  out.push(`**Quarters**: ${shape.quarter_count} / 4  `);
  out.push(`**Tally**: ${shape.passes} pass · ${shape.warns} warn · ${shape.misses} miss · ${shape.unknowns} unknown`);
  out.push("");
  if (shape.quarters.length > 0) {
    out.push(`| Quarter | Overall verdict |`);
    out.push(`| --- | --- |`);
    for (const q of shape.quarters) {
      out.push(`| ${q.quarter} | ${verdictEmoji(q.overall_verdict)} \`${q.overall_verdict}\` |`);
    }
    out.push("");
  }
  if (shape.recurring_themes.length > 0) {
    out.push(`**Recurring miss themes (failed in 2+ quarters)**: ${shape.recurring_themes.map((t) => `\`${t}\``).join(", ")}`);
    out.push("");
  }
  out.push(RETRO_SECTION_COPY.full_year_shape.body);
  out.push("");

  // 2. ARR trajectory
  const arr = plan.sections.arr_trajectory;
  out.push(`## 2. ${RETRO_SECTION_COPY.arr_trajectory.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(arr.verdict)} \`${arr.verdict}\`  `);
  out.push(`**Trend**: ${trajectoryEmoji(arr.trend)} \`${arr.trend}\`  `);
  out.push(`**Target ARR**: €${arr.target_eur}  `);
  out.push(`**Actual ARR**: ${arr.arr_eur != null ? `€${arr.arr_eur}` : "TBD"}  `);
  if (arr.delta_eur != null) out.push(`**Delta**: ${arr.delta_eur >= 0 ? "+" : ""}€${arr.delta_eur}`);
  out.push("");
  if (arr.top_jumps.length > 0) {
    out.push(`**Top MRR jumps**:`);
    for (const j of arr.top_jumps) out.push(`- ${j.month}: +€${j.delta_eur}`);
    out.push("");
  }
  if (arr.top_dips.length > 0) {
    out.push(`**Top MRR dips**:`);
    for (const d of arr.top_dips) out.push(`- ${d.month}: €${d.delta_eur}`);
    out.push("");
  }
  out.push(RETRO_SECTION_COPY.arr_trajectory.body);
  out.push("");

  // 3. Cohort LTV
  const ltv = plan.sections.cohort_ltv;
  out.push(`## 3. ${RETRO_SECTION_COPY.cohort_ltv.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(ltv.verdict)} \`${ltv.verdict}\`  `);
  out.push(`**Avg LTV**: ${ltv.avg_ltv_eur != null ? `€${ltv.avg_ltv_eur}` : "TBD"} (floor €${ltv.floors.ltv_floor_eur})  `);
  out.push(`**Avg M12 retention**: ${ltv.avg_m12_retention_pct != null ? `${ltv.avg_m12_retention_pct}%` : "TBD"} (floor ${ltv.floors.m12_floor_pct}%)`);
  out.push("");
  if (ltv.strongest) out.push(`**Strongest cohort**: \`${ltv.strongest.cohort}\` (LTV €${ltv.strongest.ltv_eur})  `);
  if (ltv.weakest) out.push(`**Weakest cohort**: \`${ltv.weakest.cohort}\` (LTV €${ltv.weakest.ltv_eur})`);
  if (ltv.strongest || ltv.weakest) out.push("");
  if (ltv.cohorts.length > 0) {
    out.push(`| Cohort | ARPU (€/mo) | M12 retention | LTV (€) |`);
    out.push(`| --- | --- | --- | --- |`);
    for (const c of ltv.cohorts) {
      out.push(`| ${c.cohort} | ${c.arpu_eur} | ${c.m12_retention_pct}% | ${c.ltv_eur} |`);
    }
    out.push("");
  }
  out.push(RETRO_SECTION_COPY.cohort_ltv.body);
  out.push("");

  // 4. CAC trend
  const cac = plan.sections.cac_trend;
  out.push(`## 4. ${RETRO_SECTION_COPY.cac_trend.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(cac.verdict)} \`${cac.verdict}\`  `);
  out.push(`**Trend**: ${trajectoryEmoji(cac.trend)} \`${cac.trend}\`  `);
  out.push(`**Avg CAC**: ${cac.avg_cac_eur != null ? `€${cac.avg_cac_eur}` : "TBD"} (ceiling €${cac.ceiling})  `);
  out.push(`**LTV/CAC ratio**: ${cac.ltv_cac_ratio != null ? cac.ltv_cac_ratio : "TBD"} (floor ${cac.ratio_floor})`);
  out.push("");
  if (cac.quarters.length > 0) {
    out.push(`| Quarter | Spend (€) | New paying users | CAC (€) |`);
    out.push(`| --- | --- | --- | --- |`);
    for (const q of cac.quarters) {
      out.push(`| ${q.quarter} | ${q.total_spend_eur} | ${q.new_paying_users} | ${q.cac_eur != null ? q.cac_eur : "—"} |`);
    }
    out.push("");
  }
  out.push(RETRO_SECTION_COPY.cac_trend.body);
  out.push("");

  // 5. Roadmap 2028
  const rm = plan.sections.roadmap_2028;
  out.push(`## 5. ${RETRO_SECTION_COPY.roadmap_2028.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(mapRoadmapVerdict(rm.verdict))} \`${rm.verdict}\`  `);
  out.push(`**Decisions recorded**: ${rm.decisions.length} (required ≥ ${rm.required_count})  `);
  out.push(`**By kind**: descalate ${rm.count_by_kind.descalate} · escalate ${rm.count_by_kind.escalate} · hold ${rm.count_by_kind.hold} · double_down ${rm.count_by_kind.double_down}`);
  out.push("");
  if (rm.decisions.length > 0) {
    for (const d of rm.decisions) {
      out.push(`- **${d.item}** — \`${d.kind}\`: ${d.rationale}`);
    }
    out.push("");
  }
  out.push(RETRO_SECTION_COPY.roadmap_2028.body);
  out.push("");

  out.push(`---`);
  out.push("");
  out.push(`_Auto-generated by \`cli/commands/release/revenue-retro-annual-2027.js\` ([H11.25])._`);
  return out.join("\n");
}

/** @param {string} v */
function verdictEmoji(v) {
  if (v === "pass") return "✅";
  if (v === "warn") return "⚠️";
  if (v === "miss") return "❌";
  return "❓";
}

/** @param {string} t */
function trajectoryEmoji(t) {
  if (t === "accelerating") return "📈";
  if (t === "decelerating") return "📉";
  if (t === "steady") return "➡️";
  return "❓";
}

module.exports = {
  EXIT,
  REVENUE_RETRO_ANNUAL_DOC_PATH,
  ANNUAL_LABEL,
  ANNUAL_YEAR_KEY,
  RETRO_SECTIONS,
  RETRO_SECTION_COPY,
  ANNUAL_2027_ARR_TARGET_EUR,
  ANNUAL_2027_LTV_FLOOR_EUR,
  ANNUAL_2027_CAC_CEIL_EUR,
  ANNUAL_2027_LTV_CAC_RATIO_FLOOR,
  ANNUAL_2027_CHURN_CEIL_PCT,
  ANNUAL_2027_M12_RETENTION_FLOOR_PCT,
  FOUNDER_REVIEW_SLA_DAYS,
  VERDICTS,
  TRAJECTORY_TRENDS,
  ROADMAP_2028_KINDS,
  QUARTER_KEYS,
  RevenueRetroAnnualError,
  coerceNonNegative,
  roundTo,
  buildFullYearShape,
  buildArrTrajectory,
  buildCohortLtvSummary,
  buildCacTrend,
  buildRoadmap2028,
  buildAnnualRetroPlan,
  rollUpVerdict,
  mapRoadmapVerdict,
  renderRetroDoc,
  verdictEmoji,
  trajectoryEmoji,
};
