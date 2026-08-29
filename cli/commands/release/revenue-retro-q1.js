// @ts-check
/**
 * [H11.23] revenue-retro-q1.js — pure plan + evaluator + renderer for the
 * Q1 revenue retrospective.
 *
 * Contract (verbatim from masterplan §3 row [H11.23]):
 *   Revenue retro Q1: `planning/retros/harvest-Q1.md` covering wave 1 + 2
 *   outcomes + MRR + cohort + cost vs revenue
 *
 * **Sibling-lib doctrine** (20th confirmed app): NO edits to H11.18
 * wave1-launch (107 cases) nor H11.19 wave2-launch (130 cases). This lib
 * accepts the EVALUATION RESULTS of those evaluators as input rather
 * than calling them — no runtime cross-import coupling. Founder runs
 * `evaluateWave1Metrics(wave1Actuals)` + `evaluateWave2Metrics(wave2Actuals)`
 * at retro time + threads the resulting objects into `buildRetroPlan`.
 *
 * **Execution-scope-boundary doctrine** (H11.18, reapplied): this ship
 * delivers the PLAN STRUCTURE + EVALUATORS + RENDERER + DOC TEMPLATE,
 * NOT the filled-in retro content. The Q1 retro can only be written
 * once Q1 ends + the actuals are known. Today the planning doc renders
 * with TBD placeholders that the founder fills in at quarter-close.
 *
 * **5 SECTIONS** pinned by masterplan literal: wave_1_outcomes /
 * wave_2_outcomes / mrr / cohort / cost_vs_revenue. Order pinned via
 * test (JSON.stringify against literal tuple).
 *
 * **TARGETS** are Q1-modest floors (founder-set; tunable pre-Q1; locked
 * once retro publishes per H11.18 lock-in doctrine):
 *   - MRR target €1500/mo by end of Q1
 *   - M1 retention floor 70%, M3 retention floor 50%
 *   - cost/revenue ceiling 1.0 (burn ≤ revenue = healthy for Q1)
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/revenue-retro-q1
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
const REVENUE_RETRO_DOC_PATH = "planning/retros/harvest-Q1.md";
const Q1_LABEL = "Q1 2027";
const Q1_QUARTER_KEY = "2027-Q1";

/** Retro section order (masterplan-literal). */
const RETRO_SECTIONS = Object.freeze([
  "wave_1_outcomes",
  "wave_2_outcomes",
  "mrr",
  "cohort",
  "cost_vs_revenue",
]);

/** Per-section display copy. */
const RETRO_SECTION_COPY = Object.freeze({
  wave_1_outcomes: Object.freeze({
    title: "Wave 1 outcomes (MSFT-anchor)",
    body: "Did the 20-play / 5-criterion / 30-day Wave 1 launch hit its locked targets? Cite the verdict from `evaluateWave1Metrics` + the channel-level lessons captured during the wave.",
  }),
  wave_2_outcomes: Object.freeze({
    title: "Wave 2 outcomes (community + AVM)",
    body: "Did the 40-play / 6-criterion / 60-day Wave 2 launch hit its locked targets? Per-criterion progression vs Wave 1 (was the tightening met)? Community PR signal — yes/no.",
  }),
  mrr: Object.freeze({
    title: "MRR snapshot",
    body: "End-of-Q1 MRR in €, MoM growth across the 3 months, gross churn % (cancellations / start-of-month subs). Compare to Q1 floor (€1500). Cite the H11.16 stats-page snapshot.",
  }),
  cohort: Object.freeze({
    title: "Cohort retention",
    body: "Per-cohort M1 + M3 retention % for the 3 Q1 cohorts. Are we above the floors (M1 ≥ 70%, M3 ≥ 50%)? Identify the strongest + weakest cohort + a hypothesis for the gap.",
  }),
  cost_vs_revenue: Object.freeze({
    title: "Cost vs revenue",
    body: "Q1 total cost (infra + Stripe fees + cloud reseller margin + tooling) vs Q1 total revenue. Ratio cost/revenue — pass (≤ 1.0) / breakeven / burning. Identify the largest 3 line items.",
  }),
});

/** MRR + retention + cost floors for the Q1 retro. */
const Q1_MRR_TARGET_EUR = 1500;
const Q1_M1_RETENTION_FLOOR_PCT = 70;
const Q1_M3_RETENTION_FLOOR_PCT = 50;
const Q1_COST_TO_REVENUE_CEIL = 1.0;
const Q1_CHURN_CEIL_PCT = 8;

/** Mirrors H11.20/H11.21/H11.22 — kept duplicated; no runtime coupling. */
const FOUNDER_REVIEW_SLA_DAYS = 7;

/** Verdict alphabet (discriminated union). */
const VERDICTS = Object.freeze(["pass", "warn", "miss", "unknown"]);
const COST_VERDICTS = Object.freeze(["profitable", "breakeven", "burning", "unknown"]);

class RevenueRetroError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "RevenueRetroError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

// ──────────────────────────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Coerce a number, treating negatives + NaN + non-numbers as null
 * (data-quality unknown ≠ zero — mirrors H11.18 doctrine).
 *
 * @param {unknown} n
 * @returns {number|null}
 */
function coerceNonNegative(n) {
  if (typeof n !== "number") return null;
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

/**
 * Round to N decimals (pure). null-safe.
 *
 * @param {number|null} n
 * @param {number} decimals
 * @returns {number|null}
 */
function roundTo(n, decimals) {
  if (n == null || !Number.isFinite(n)) return null;
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}

// ──────────────────────────────────────────────────────────────────
// MRR evaluator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} MrrSnapshot
 * @property {number} mrr_eur — end-of-quarter MRR in euros
 * @property {number} [mrr_start_eur] — start-of-quarter MRR (for MoM math)
 * @property {number} [cancellations] — subs cancelled in the quarter
 * @property {number} [subs_start] — subs at start of quarter (churn denom)
 */

/**
 * @typedef {object} MrrEvaluation
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {number|null} mrr_eur
 * @property {number|null} target_eur
 * @property {number|null} delta_eur
 * @property {number|null} growth_pct — Q-over-Q growth percent
 * @property {number|null} churn_pct
 */

/**
 * Evaluate an MRR snapshot against the Q1 floor. Pure.
 *
 * @param {unknown} snapshot
 * @returns {MrrEvaluation}
 */
function evaluateMrrSnapshot(snapshot) {
  const base = {
    verdict: /** @type {"unknown"} */ ("unknown"),
    mrr_eur: /** @type {number|null} */ (null),
    target_eur: Q1_MRR_TARGET_EUR,
    delta_eur: /** @type {number|null} */ (null),
    growth_pct: /** @type {number|null} */ (null),
    churn_pct: /** @type {number|null} */ (null),
  };
  if (!snapshot || typeof snapshot !== "object") return base;
  const s = /** @type {Record<string, unknown>} */ (snapshot);
  const mrr = coerceNonNegative(s.mrr_eur);
  base.mrr_eur = mrr;
  if (mrr == null) return base;
  base.delta_eur = mrr - Q1_MRR_TARGET_EUR;
  const start = coerceNonNegative(s.mrr_start_eur);
  if (start != null && start > 0) {
    base.growth_pct = roundTo(((mrr - start) / start) * 100, 1);
  } else if (start === 0) {
    base.growth_pct = mrr > 0 ? null : 0;
  }
  const cancellations = coerceNonNegative(s.cancellations);
  const subsStart = coerceNonNegative(s.subs_start);
  if (cancellations != null && subsStart != null && subsStart > 0) {
    base.churn_pct = roundTo((cancellations / subsStart) * 100, 1);
  }
  // Verdict
  if (mrr >= Q1_MRR_TARGET_EUR && (base.churn_pct == null || base.churn_pct <= Q1_CHURN_CEIL_PCT)) {
    base.verdict = "pass";
  } else if (mrr >= Q1_MRR_TARGET_EUR * 0.8) {
    base.verdict = "warn";
  } else {
    base.verdict = "miss";
  }
  if (base.churn_pct != null && base.churn_pct > Q1_CHURN_CEIL_PCT && base.verdict === "pass") {
    base.verdict = "warn";
  }
  return base;
}

// ──────────────────────────────────────────────────────────────────
// Cohort evaluator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} CohortRow
 * @property {string} cohort — "YYYY-MM"
 * @property {number} size — # of paying users in the cohort
 * @property {ReadonlyArray<number|null>} retention_pct — [M0, M1, M2, M3, ...]
 */

/**
 * @typedef {object} CohortSummary
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {ReadonlyArray<CohortRow>} cohorts
 * @property {number|null} avg_m1_pct
 * @property {number|null} avg_m3_pct
 * @property {number} cohort_count
 * @property {{m1_floor: number, m3_floor: number}} floors
 */

/**
 * Summarise cohort retention against Q1 floors. Pure.
 *
 * @param {unknown} cohortRows
 * @returns {CohortSummary}
 */
function buildCohortRetentionSummary(cohortRows) {
  const floors = { m1_floor: Q1_M1_RETENTION_FLOOR_PCT, m3_floor: Q1_M3_RETENTION_FLOOR_PCT };
  const base = {
    verdict: /** @type {"unknown"} */ ("unknown"),
    cohorts: /** @type {ReadonlyArray<CohortRow>} */ ([]),
    avg_m1_pct: /** @type {number|null} */ (null),
    avg_m3_pct: /** @type {number|null} */ (null),
    cohort_count: 0,
    floors,
  };
  if (!Array.isArray(cohortRows)) return base;
  /** @type {CohortRow[]} */
  const cleaned = [];
  for (const r of cohortRows) {
    if (!r || typeof r !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (r);
    const cohort = typeof row.cohort === "string" && /^\d{4}-\d{2}$/.test(row.cohort) ? row.cohort : null;
    if (cohort == null) continue;
    const size = coerceNonNegative(row.size);
    if (size == null) continue;
    const retention = Array.isArray(row.retention_pct)
      ? row.retention_pct.map((v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(100, v) : null))
      : [];
    cleaned.push({ cohort, size: Math.floor(size), retention_pct: Object.freeze(retention) });
  }
  cleaned.sort((a, b) => a.cohort.localeCompare(b.cohort));
  base.cohorts = Object.freeze(cleaned);
  base.cohort_count = cleaned.length;
  if (cleaned.length === 0) return base;
  // Averages at M1 + M3
  const m1Vals = cleaned.map((c) => c.retention_pct[1]).filter((v) => typeof v === "number");
  const m3Vals = cleaned.map((c) => c.retention_pct[3]).filter((v) => typeof v === "number");
  base.avg_m1_pct = m1Vals.length > 0 ? roundTo(m1Vals.reduce((a, b) => a + b, 0) / m1Vals.length, 1) : null;
  base.avg_m3_pct = m3Vals.length > 0 ? roundTo(m3Vals.reduce((a, b) => a + b, 0) / m3Vals.length, 1) : null;
  // Verdict
  if (base.avg_m1_pct == null && base.avg_m3_pct == null) {
    base.verdict = "unknown";
  } else {
    const m1Ok = base.avg_m1_pct == null || base.avg_m1_pct >= floors.m1_floor;
    const m3Ok = base.avg_m3_pct == null || base.avg_m3_pct >= floors.m3_floor;
    if (m1Ok && m3Ok) base.verdict = "pass";
    else if (
      (base.avg_m1_pct != null && base.avg_m1_pct >= floors.m1_floor * 0.85) &&
      (base.avg_m3_pct == null || base.avg_m3_pct >= floors.m3_floor * 0.85)
    ) base.verdict = "warn";
    else base.verdict = "miss";
  }
  return base;
}

// ──────────────────────────────────────────────────────────────────
// Cost vs revenue evaluator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} CostRevenueInputs
 * @property {number} cost_eur
 * @property {number} revenue_eur
 * @property {ReadonlyArray<{label: string, amount_eur: number}>} [line_items]
 */

/**
 * @typedef {object} CostRevenueEvaluation
 * @property {"profitable"|"breakeven"|"burning"|"unknown"} verdict
 * @property {number|null} cost_eur
 * @property {number|null} revenue_eur
 * @property {number|null} ratio — cost / revenue
 * @property {number|null} margin_eur — revenue - cost
 * @property {number} ceiling
 * @property {ReadonlyArray<{label: string, amount_eur: number}>} top_line_items
 */

/**
 * Evaluate cost vs revenue against the Q1 ceiling. Pure.
 *
 * @param {unknown} inputs
 * @returns {CostRevenueEvaluation}
 */
function evaluateCostVsRevenue(inputs) {
  const base = {
    verdict: /** @type {"unknown"} */ ("unknown"),
    cost_eur: /** @type {number|null} */ (null),
    revenue_eur: /** @type {number|null} */ (null),
    ratio: /** @type {number|null} */ (null),
    margin_eur: /** @type {number|null} */ (null),
    ceiling: Q1_COST_TO_REVENUE_CEIL,
    top_line_items: /** @type {ReadonlyArray<{label: string, amount_eur: number}>} */ ([]),
  };
  if (!inputs || typeof inputs !== "object") return base;
  const i = /** @type {Record<string, unknown>} */ (inputs);
  const cost = coerceNonNegative(i.cost_eur);
  const revenue = coerceNonNegative(i.revenue_eur);
  base.cost_eur = cost;
  base.revenue_eur = revenue;
  if (cost == null || revenue == null) return base;
  base.margin_eur = roundTo(revenue - cost, 2);
  if (revenue === 0) {
    base.ratio = cost === 0 ? 0 : null;
    base.verdict = cost === 0 ? "breakeven" : "burning";
  } else {
    base.ratio = roundTo(cost / revenue, 3);
    if (base.ratio == null) {
      base.verdict = "unknown";
    } else if (base.ratio <= Q1_COST_TO_REVENUE_CEIL * 0.8) {
      base.verdict = "profitable";
    } else if (base.ratio <= Q1_COST_TO_REVENUE_CEIL) {
      base.verdict = "breakeven";
    } else {
      base.verdict = "burning";
    }
  }
  // Top 3 line items by amount
  if (Array.isArray(i.line_items)) {
    /** @type {{label: string, amount_eur: number}[]} */
    const cleaned = [];
    for (const li of i.line_items) {
      if (!li || typeof li !== "object") continue;
      const item = /** @type {Record<string, unknown>} */ (li);
      const label = typeof item.label === "string" && item.label.trim().length > 0 ? item.label.trim() : null;
      const amount = coerceNonNegative(item.amount_eur);
      if (label == null || amount == null) continue;
      cleaned.push({ label, amount_eur: amount });
    }
    cleaned.sort((a, b) => b.amount_eur - a.amount_eur);
    base.top_line_items = Object.freeze(cleaned.slice(0, 3).map((x) => Object.freeze(x)));
  }
  return base;
}

// ──────────────────────────────────────────────────────────────────
// Top-level plan builder
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} RetroPlanInput
 * @property {{verdict?: string, passed?: number, total?: number, criteria?: ReadonlyArray<unknown>} | null} [wave1Evaluation]
 * @property {{verdict?: string, passed?: number, total?: number, criteria?: ReadonlyArray<unknown>} | null} [wave2Evaluation]
 * @property {MrrSnapshot | null} [mrrSnapshot]
 * @property {ReadonlyArray<CohortRow> | null} [cohorts]
 * @property {CostRevenueInputs | null} [costInputs]
 */

/**
 * @typedef {object} RetroPlan
 * @property {string} quarter
 * @property {string} label
 * @property {string} doc_path
 * @property {ReadonlyArray<string>} section_order
 * @property {{
 *   wave_1_outcomes: object,
 *   wave_2_outcomes: object,
 *   mrr: MrrEvaluation,
 *   cohort: CohortSummary,
 *   cost_vs_revenue: CostRevenueEvaluation,
 * }} sections
 * @property {"pass"|"warn"|"miss"|"unknown"} overall_verdict
 * @property {string} doctrine_note
 */

/**
 * Build the Q1 retro plan from raw inputs. Pure. NEVER throws.
 *
 * @param {RetroPlanInput} [input]
 * @returns {RetroPlan}
 */
function buildRetroPlan(input) {
  const i = input && typeof input === "object" ? input : {};
  const wave1 = projectWaveEvaluation(i.wave1Evaluation, 1);
  const wave2 = projectWaveEvaluation(i.wave2Evaluation, 2);
  const mrr = evaluateMrrSnapshot(i.mrrSnapshot ?? null);
  const cohort = buildCohortRetentionSummary(i.cohorts ?? null);
  const costVsRevenue = evaluateCostVsRevenue(i.costInputs ?? null);
  const overall = rollUpVerdict([wave1.verdict, wave2.verdict, mrr.verdict, cohort.verdict, mapCostVerdict(costVsRevenue.verdict)]);
  return {
    quarter: Q1_QUARTER_KEY,
    label: Q1_LABEL,
    doc_path: REVENUE_RETRO_DOC_PATH,
    section_order: RETRO_SECTIONS,
    sections: {
      wave_1_outcomes: wave1,
      wave_2_outcomes: wave2,
      mrr,
      cohort,
      cost_vs_revenue: costVsRevenue,
    },
    overall_verdict: overall,
    doctrine_note: "Targets MAY tighten between quarters but NEVER loosen post-publication (H11.18 lock-in doctrine).",
  };
}

/**
 * Project a wave evaluation result into the retro-section shape. Pure.
 *
 * @param {unknown} ev
 * @param {1|2} waveNum
 * @returns {{verdict: "pass"|"warn"|"miss"|"unknown", wave_number: number, passed: number|null, total: number|null, miss_criteria: string[]}}
 */
function projectWaveEvaluation(ev, waveNum) {
  if (!ev || typeof ev !== "object") {
    return { verdict: "unknown", wave_number: waveNum, passed: null, total: null, miss_criteria: [] };
  }
  const e = /** @type {Record<string, unknown>} */ (ev);
  const verdict = typeof e.verdict === "string" && VERDICTS.includes(/** @type {string} */ (e.verdict))
    ? /** @type {"pass"|"warn"|"miss"|"unknown"} */ (e.verdict)
    : "unknown";
  const passed = Number.isFinite(e.passed) ? /** @type {number} */ (e.passed) : null;
  const total = Number.isFinite(e.total) ? /** @type {number} */ (e.total) : null;
  /** @type {string[]} */
  const missCriteria = [];
  if (Array.isArray(e.criteria)) {
    for (const c of e.criteria) {
      if (!c || typeof c !== "object") continue;
      const cr = /** @type {Record<string, unknown>} */ (c);
      if (cr.verdict === "miss" && typeof cr.id === "string") missCriteria.push(cr.id);
    }
  }
  return { verdict, wave_number: waveNum, passed, total, miss_criteria: missCriteria };
}

/**
 * Roll up a list of section verdicts into the overall retro verdict. Pure.
 *
 * Rules: any miss → miss; else any warn → warn; else any pass → pass;
 * else unknown.
 *
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
 * Map cost verdict to standard verdict alphabet. Pure.
 *
 * @param {string} costVerdict
 * @returns {"pass"|"warn"|"miss"|"unknown"}
 */
function mapCostVerdict(costVerdict) {
  if (costVerdict === "profitable") return "pass";
  if (costVerdict === "breakeven") return "warn";
  if (costVerdict === "burning") return "miss";
  return "unknown";
}

// ──────────────────────────────────────────────────────────────────
// Renderer
// ──────────────────────────────────────────────────────────────────

/**
 * Render the retro plan as a markdown doc. Pure.
 *
 * @param {RetroPlan} plan
 * @param {{publishedOn?: string|null}} [opts]
 * @returns {string}
 */
function renderRetroDoc(plan, opts) {
  if (!plan || typeof plan !== "object") {
    throw new RevenueRetroError("usage", "plan must be an object", { exitCode: EXIT.USAGE });
  }
  const publishedOn = opts && typeof opts.publishedOn === "string" ? opts.publishedOn : "TBD";
  /** @type {string[]} */
  const out = [];
  out.push(`# Revenue retro — ${plan.label}`);
  out.push("");
  out.push(`> **Quarter**: ${plan.quarter}  `);
  out.push(`> **Published on**: ${publishedOn}  `);
  out.push(`> **Overall verdict**: ${verdictEmoji(plan.overall_verdict)} \`${plan.overall_verdict}\``);
  out.push("");
  out.push(`Covers: wave 1 + 2 outcomes + MRR + cohort + cost vs revenue.`);
  out.push("");
  out.push(`Doctrine: ${plan.doctrine_note}`);
  out.push("");

  // Section 1: Wave 1
  const w1 = plan.sections.wave_1_outcomes;
  out.push(`## 1. ${RETRO_SECTION_COPY.wave_1_outcomes.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(w1.verdict)} \`${w1.verdict}\``);
  if (w1.passed != null && w1.total != null) {
    out.push(`**Criteria met**: ${w1.passed} / ${w1.total}`);
  }
  if (w1.miss_criteria.length > 0) {
    out.push(`**Missed criteria**: ${w1.miss_criteria.map((c) => `\`${c}\``).join(", ")}`);
  }
  out.push("");
  out.push(RETRO_SECTION_COPY.wave_1_outcomes.body);
  out.push("");

  // Section 2: Wave 2
  const w2 = plan.sections.wave_2_outcomes;
  out.push(`## 2. ${RETRO_SECTION_COPY.wave_2_outcomes.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(w2.verdict)} \`${w2.verdict}\``);
  if (w2.passed != null && w2.total != null) {
    out.push(`**Criteria met**: ${w2.passed} / ${w2.total}`);
  }
  if (w2.miss_criteria.length > 0) {
    out.push(`**Missed criteria**: ${w2.miss_criteria.map((c) => `\`${c}\``).join(", ")}`);
  }
  out.push("");
  out.push(RETRO_SECTION_COPY.wave_2_outcomes.body);
  out.push("");

  // Section 3: MRR
  const mrr = plan.sections.mrr;
  out.push(`## 3. ${RETRO_SECTION_COPY.mrr.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(mrr.verdict)} \`${mrr.verdict}\`  `);
  out.push(`**Target**: €${mrr.target_eur ?? "—"}/mo  `);
  out.push(`**Actual**: ${mrr.mrr_eur != null ? `€${mrr.mrr_eur}/mo` : "TBD"}  `);
  if (mrr.growth_pct != null) out.push(`**Q-over-Q growth**: ${mrr.growth_pct}%  `);
  if (mrr.churn_pct != null) out.push(`**Gross churn**: ${mrr.churn_pct}% (ceiling ${Q1_CHURN_CEIL_PCT}%)`);
  out.push("");
  out.push(RETRO_SECTION_COPY.mrr.body);
  out.push("");

  // Section 4: Cohort
  const cohort = plan.sections.cohort;
  out.push(`## 4. ${RETRO_SECTION_COPY.cohort.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(cohort.verdict)} \`${cohort.verdict}\`  `);
  out.push(`**Cohorts**: ${cohort.cohort_count}  `);
  out.push(`**Avg M1 retention**: ${cohort.avg_m1_pct != null ? `${cohort.avg_m1_pct}%` : "TBD"} (floor ${cohort.floors.m1_floor}%)  `);
  out.push(`**Avg M3 retention**: ${cohort.avg_m3_pct != null ? `${cohort.avg_m3_pct}%` : "TBD"} (floor ${cohort.floors.m3_floor}%)`);
  out.push("");
  if (cohort.cohorts.length > 0) {
    out.push(`| Cohort | Size | M0 | M1 | M2 | M3 |`);
    out.push(`| --- | --- | --- | --- | --- | --- |`);
    for (const c of cohort.cohorts) {
      const cells = [0, 1, 2, 3].map((idx) => {
        const v = c.retention_pct[idx];
        return typeof v === "number" ? `${v}%` : "—";
      });
      out.push(`| ${c.cohort} | ${c.size} | ${cells.join(" | ")} |`);
    }
    out.push("");
  }
  out.push(RETRO_SECTION_COPY.cohort.body);
  out.push("");

  // Section 5: Cost vs revenue
  const cr = plan.sections.cost_vs_revenue;
  out.push(`## 5. ${RETRO_SECTION_COPY.cost_vs_revenue.title}`);
  out.push("");
  out.push(`**Verdict**: ${costVerdictEmoji(cr.verdict)} \`${cr.verdict}\`  `);
  out.push(`**Revenue**: ${cr.revenue_eur != null ? `€${cr.revenue_eur}` : "TBD"}  `);
  out.push(`**Cost**: ${cr.cost_eur != null ? `€${cr.cost_eur}` : "TBD"}  `);
  out.push(`**Ratio (cost/revenue)**: ${cr.ratio != null ? cr.ratio : "TBD"} (ceiling ${cr.ceiling})  `);
  out.push(`**Margin**: ${cr.margin_eur != null ? `€${cr.margin_eur}` : "TBD"}`);
  out.push("");
  if (cr.top_line_items.length > 0) {
    out.push(`**Top cost line items**:`);
    for (const li of cr.top_line_items) {
      out.push(`- ${li.label}: €${li.amount_eur}`);
    }
    out.push("");
  }
  out.push(RETRO_SECTION_COPY.cost_vs_revenue.body);
  out.push("");

  out.push(`---`);
  out.push("");
  out.push(`_Auto-generated by \`cli/commands/release/revenue-retro-q1.js\` ([H11.23])._`);
  return out.join("\n");
}

/** @param {string} v */
function verdictEmoji(v) {
  if (v === "pass") return "✅";
  if (v === "warn") return "⚠️";
  if (v === "miss") return "❌";
  return "❓";
}

/** @param {string} v */
function costVerdictEmoji(v) {
  if (v === "profitable") return "✅";
  if (v === "breakeven") return "⚠️";
  if (v === "burning") return "❌";
  return "❓";
}

module.exports = {
  EXIT,
  REVENUE_RETRO_DOC_PATH,
  Q1_LABEL,
  Q1_QUARTER_KEY,
  RETRO_SECTIONS,
  RETRO_SECTION_COPY,
  Q1_MRR_TARGET_EUR,
  Q1_M1_RETENTION_FLOOR_PCT,
  Q1_M3_RETENTION_FLOOR_PCT,
  Q1_COST_TO_REVENUE_CEIL,
  Q1_CHURN_CEIL_PCT,
  FOUNDER_REVIEW_SLA_DAYS,
  VERDICTS,
  COST_VERDICTS,
  RevenueRetroError,
  coerceNonNegative,
  roundTo,
  evaluateMrrSnapshot,
  buildCohortRetentionSummary,
  evaluateCostVsRevenue,
  buildRetroPlan,
  projectWaveEvaluation,
  rollUpVerdict,
  mapCostVerdict,
  renderRetroDoc,
  verdictEmoji,
  costVerdictEmoji,
};
