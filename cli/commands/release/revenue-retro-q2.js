// @ts-check
/**
 * [H11.24] revenue-retro-q2.js — pure plan + evaluator + renderer for the
 * Q2 revenue retrospective.
 *
 * Contract (verbatim from masterplan §3 row [H11.24]):
 *   Revenue retro Q2: include partner deal outcomes + churn analysis +
 *   roadmap adjustment
 *
 * **Sibling-lib doctrine** (21st confirmed app): NO edits to H11.18
 * wave1-launch (107) / H11.19 wave2-launch (130) / H11.20 wave3-launch
 * (151) / H11.23 revenue-retro-q1 (167). The Q2 retro CONSUMES the
 * H11.23 retro plan as `q1RetroPlan` input + adds 3 new sections:
 *  - wave_3_outcomes (the Wave 3 launch's evaluator result)
 *  - partner_deal_outcomes (per-partner-program-deal close + revenue)
 *  - churn_analysis (Q2 cohort retention deep dive vs Q1)
 *  - roadmap_adjustment (Phase H12 scope decisions based on Q2 actuals)
 *
 * **Evaluator-result-as-input pattern** (H11.23, 1st re-app): the Q1
 * retro plan is INPUT here, not re-evaluated. Founder runs Q1 retro at
 * Q1 close + threads the resulting plan into `buildQ2RetroPlan`.
 *
 * **Execution-scope-boundary doctrine** (H11.18, reapplied): ships the
 * structure + evaluators + renderer + template. Q2 actuals filled by
 * founder at Q2 close.
 *
 * **6 SECTIONS** in masterplan-row-driven order: wave_3_outcomes /
 * partner_deal_outcomes / churn_analysis / mrr / cohort /
 * roadmap_adjustment. (cost vs revenue carried implicitly via the
 * Q1-vs-Q2 comparison; the masterplan row's "include" wording means
 * Wave-3 + partner + churn + roadmap are ADDITIONAL to the standard
 * MRR + cohort retro shape, not REPLACING them.)
 *
 * **Q2 TARGETS** TIGHTENED from Q1 per the lock-in / strict-monotonic
 * doctrine (H11.18/H11.20):
 *  - MRR target €3000/mo (2× Q1)
 *  - M1 retention floor 72% (Q1 + 2pp)
 *  - M3 retention floor 55% (Q1 + 5pp)
 *  - cost/revenue ceiling 0.9 (Q1 was 1.0 — tighter as scale grows)
 *  - churn ceiling 7% (Q1 was 8% — tighter)
 *  - partner deals closed ≥ 2 (Q2 NEW)
 *  - partner revenue ≥ €1000 (Q2 NEW)
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/revenue-retro-q2
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
const REVENUE_RETRO_Q2_DOC_PATH = "planning/retros/harvest-Q2.md";
const Q2_LABEL = "Q2 2027";
const Q2_QUARTER_KEY = "2027-Q2";

/** Retro section order (masterplan-row-driven). */
const RETRO_SECTIONS = Object.freeze([
  "wave_3_outcomes",
  "partner_deal_outcomes",
  "churn_analysis",
  "mrr",
  "cohort",
  "roadmap_adjustment",
]);

/** Per-section display copy. */
const RETRO_SECTION_COPY = Object.freeze({
  wave_3_outcomes: Object.freeze({
    title: "Wave 3 outcomes (community + agent-author)",
    body: "Did the 50-play / 7-criterion / 90-day Wave 3 launch hit its locked targets? Was the community PR contribution path opened + did community_prs + merged_community_prs land?",
  }),
  partner_deal_outcomes: Object.freeze({
    title: "Partner deal outcomes",
    body: "How many H11.14 partner-program deals closed in Q2? Per-deal revenue, kind (FastTrack / SI / regional reseller), benefits activated (bulk_discount / co_branded / private_mcp). Compare to Q2 floor (≥ 2 deals, ≥ €1000 partner revenue).",
  }),
  churn_analysis: Object.freeze({
    title: "Churn analysis (Q1 → Q2 trend)",
    body: "Q2 gross churn % vs Q1 — improving / steady / worsening? Per-cohort M1/M3 trend. Identify cancellation reasons (manual exit interview tags) + the 1 highest-leverage churn fix to ship.",
  }),
  mrr: Object.freeze({
    title: "MRR snapshot",
    body: "End-of-Q2 MRR in €, growth vs Q1, partner-attributed MRR vs catalog-attributed MRR. Compare to Q2 floor (€3000).",
  }),
  cohort: Object.freeze({
    title: "Cohort retention",
    body: "Q2 cohorts retention % at M1 + M3. Compare against TIGHTENED Q2 floors (M1 ≥ 72%, M3 ≥ 55%). Cross-link to Q1 retro for cohort-on-cohort comparison.",
  }),
  roadmap_adjustment: Object.freeze({
    title: "Roadmap adjustment",
    body: "Based on Q2 actuals: which Phase H12 scope items DESCALATE (defer / drop)? Which ESCALATE (priority bump / new sub-phase)? Record the 3 decisions the founder is committing to for Q3.",
  }),
});

/** Q2 targets locked (tightened from Q1 per lock-in / strict-monotonic doctrine). */
const Q2_MRR_TARGET_EUR = 3000;
const Q2_M1_RETENTION_FLOOR_PCT = 72;
const Q2_M3_RETENTION_FLOOR_PCT = 55;
const Q2_COST_TO_REVENUE_CEIL = 0.9;
const Q2_CHURN_CEIL_PCT = 7;
const Q2_PARTNER_DEALS_FLOOR = 2;
const Q2_PARTNER_REVENUE_FLOOR_EUR = 1000;

/** Partner-deal kind enum (matches H11.15 PARTNER_KINDS). */
const PARTNER_DEAL_KINDS = Object.freeze([
  "microsoft_fasttrack",
  "si",
  "regional_cloud_reseller",
]);

/** Allowed churn-reason tags (operator-curated; matches H11.27 future schema). */
const CHURN_REASON_TAGS = Object.freeze([
  "price",
  "missing_feature",
  "competitor_switch",
  "infra_unstable",
  "team_left_company",
  "scope_change",
  "unknown",
]);

/** Mirrors H11.20+/H11.21+/H11.22+/H11.23 — kept duplicated. */
const FOUNDER_REVIEW_SLA_DAYS = 7;

/** Verdict alphabet (carries forward from H11.23). */
const VERDICTS = Object.freeze(["pass", "warn", "miss", "unknown"]);
const CHURN_TRENDS = Object.freeze(["improving", "steady", "worsening", "unknown"]);

class RevenueRetroQ2Error extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "RevenueRetroQ2Error";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

// ──────────────────────────────────────────────────────────────────
// Pure helpers (mirror H11.23; duplicated to avoid coupling)
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
// Partner-deal evaluator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} PartnerDeal
 * @property {string} slug — case-study slug from H11.15
 * @property {string} kind — PARTNER_DEAL_KINDS
 * @property {number} revenue_eur — total revenue from this deal in Q2
 * @property {ReadonlyArray<string>} [benefits_activated]
 * @property {string} [closed_on] — ISO date
 */

/**
 * @typedef {object} PartnerDealSummary
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {ReadonlyArray<PartnerDeal>} deals
 * @property {number} deal_count
 * @property {number} total_revenue_eur
 * @property {Record<string, number>} revenue_by_kind
 * @property {{deals_floor: number, revenue_floor_eur: number}} floors
 */

/**
 * Summarise partner deals against Q2 floors. Pure.
 *
 * @param {unknown} deals
 * @returns {PartnerDealSummary}
 */
function buildPartnerDealSummary(deals) {
  const floors = { deals_floor: Q2_PARTNER_DEALS_FLOOR, revenue_floor_eur: Q2_PARTNER_REVENUE_FLOOR_EUR };
  /** @type {PartnerDealSummary} */
  const base = {
    verdict: "unknown",
    deals: Object.freeze([]),
    deal_count: 0,
    total_revenue_eur: 0,
    revenue_by_kind: { microsoft_fasttrack: 0, si: 0, regional_cloud_reseller: 0 },
    floors,
  };
  if (!Array.isArray(deals)) return base;
  /** @type {PartnerDeal[]} */
  const cleaned = [];
  for (const d of deals) {
    if (!d || typeof d !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (d);
    const slug = typeof row.slug === "string" && row.slug.trim().length > 0 ? row.slug.trim() : null;
    const kind = typeof row.kind === "string" && PARTNER_DEAL_KINDS.includes(row.kind) ? row.kind : null;
    const revenue = coerceNonNegative(row.revenue_eur);
    if (slug == null || kind == null || revenue == null) continue;
    const benefits = Array.isArray(row.benefits_activated)
      ? row.benefits_activated.filter((b) => typeof b === "string")
      : [];
    const closedOn = typeof row.closed_on === "string" ? row.closed_on : undefined;
    cleaned.push(Object.freeze({
      slug,
      kind,
      revenue_eur: revenue,
      benefits_activated: Object.freeze(benefits),
      ...(closedOn ? { closed_on: closedOn } : {}),
    }));
  }
  cleaned.sort((a, b) => b.revenue_eur - a.revenue_eur);
  base.deals = Object.freeze(cleaned);
  base.deal_count = cleaned.length;
  base.total_revenue_eur = roundTo(cleaned.reduce((a, b) => a + b.revenue_eur, 0), 2) ?? 0;
  for (const d of cleaned) {
    base.revenue_by_kind[d.kind] = roundTo((base.revenue_by_kind[d.kind] || 0) + d.revenue_eur, 2) ?? 0;
  }
  // Verdict
  if (cleaned.length === 0) {
    base.verdict = "unknown";
  } else if (base.deal_count >= floors.deals_floor && base.total_revenue_eur >= floors.revenue_floor_eur) {
    base.verdict = "pass";
  } else if (base.deal_count >= floors.deals_floor || base.total_revenue_eur >= floors.revenue_floor_eur) {
    base.verdict = "warn";
  } else {
    base.verdict = "miss";
  }
  return base;
}

// ──────────────────────────────────────────────────────────────────
// Churn analysis evaluator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} ChurnInputs
 * @property {number} q2_churn_pct — measured Q2 gross churn %
 * @property {number} [q1_churn_pct] — Q1 gross churn for trend
 * @property {ReadonlyArray<{tag: string, count: number}>} [reasons]
 */

/**
 * @typedef {object} ChurnAnalysis
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {"improving"|"steady"|"worsening"|"unknown"} trend
 * @property {number|null} q2_churn_pct
 * @property {number|null} q1_churn_pct
 * @property {number|null} delta_pp
 * @property {ReadonlyArray<{tag: string, count: number}>} top_reasons
 * @property {number} ceiling
 */

/**
 * Analyse Q2 churn vs Q1 + tag distribution. Pure.
 *
 * @param {unknown} inputs
 * @returns {ChurnAnalysis}
 */
function buildChurnAnalysis(inputs) {
  /** @type {ChurnAnalysis} */
  const base = {
    verdict: "unknown",
    trend: "unknown",
    q2_churn_pct: null,
    q1_churn_pct: null,
    delta_pp: null,
    top_reasons: Object.freeze([]),
    ceiling: Q2_CHURN_CEIL_PCT,
  };
  if (!inputs || typeof inputs !== "object") return base;
  const i = /** @type {Record<string, unknown>} */ (inputs);
  const q2 = coerceNonNegative(i.q2_churn_pct);
  base.q2_churn_pct = q2;
  const q1 = coerceNonNegative(i.q1_churn_pct);
  base.q1_churn_pct = q1;
  if (q2 != null && q1 != null) {
    base.delta_pp = roundTo(q2 - q1, 2);
    if (base.delta_pp < -0.5) base.trend = "improving";
    else if (base.delta_pp > 0.5) base.trend = "worsening";
    else base.trend = "steady";
  } else if (q2 != null) {
    base.trend = "unknown";
  }
  // Tag distribution
  if (Array.isArray(i.reasons)) {
    /** @type {{tag: string, count: number}[]} */
    const cleaned = [];
    for (const r of i.reasons) {
      if (!r || typeof r !== "object") continue;
      const row = /** @type {Record<string, unknown>} */ (r);
      const tag = typeof row.tag === "string" && CHURN_REASON_TAGS.includes(row.tag) ? row.tag : null;
      const count = coerceNonNegative(row.count);
      if (tag == null || count == null) continue;
      cleaned.push({ tag, count: Math.floor(count) });
    }
    cleaned.sort((a, b) => b.count - a.count);
    base.top_reasons = Object.freeze(cleaned.slice(0, 3).map((x) => Object.freeze(x)));
  }
  // Verdict (q2 must exist)
  if (q2 == null) {
    base.verdict = "unknown";
  } else if (q2 <= Q2_CHURN_CEIL_PCT) {
    base.verdict = base.trend === "worsening" ? "warn" : "pass";
  } else if (q2 <= Q2_CHURN_CEIL_PCT * 1.4) {
    base.verdict = "warn";
  } else {
    base.verdict = "miss";
  }
  return base;
}

// ──────────────────────────────────────────────────────────────────
// MRR + cohort evaluators (re-using H11.23 shapes but with Q2 floors)
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Q2MrrSnapshot
 * @property {number} mrr_eur
 * @property {number} [mrr_q1_end_eur]
 * @property {number} [partner_attributed_mrr_eur]
 * @property {number} [catalog_attributed_mrr_eur]
 */

/**
 * @typedef {object} Q2MrrEvaluation
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {number|null} mrr_eur
 * @property {number} target_eur
 * @property {number|null} delta_eur
 * @property {number|null} growth_pct
 * @property {number|null} partner_mrr_pct — partner-attributed % of total
 */

/**
 * @param {unknown} snapshot
 * @returns {Q2MrrEvaluation}
 */
function evaluateQ2MrrSnapshot(snapshot) {
  /** @type {Q2MrrEvaluation} */
  const base = {
    verdict: "unknown",
    mrr_eur: null,
    target_eur: Q2_MRR_TARGET_EUR,
    delta_eur: null,
    growth_pct: null,
    partner_mrr_pct: null,
  };
  if (!snapshot || typeof snapshot !== "object") return base;
  const s = /** @type {Record<string, unknown>} */ (snapshot);
  const mrr = coerceNonNegative(s.mrr_eur);
  base.mrr_eur = mrr;
  if (mrr == null) return base;
  base.delta_eur = mrr - Q2_MRR_TARGET_EUR;
  const q1End = coerceNonNegative(s.mrr_q1_end_eur);
  if (q1End != null && q1End > 0) {
    base.growth_pct = roundTo(((mrr - q1End) / q1End) * 100, 1);
  }
  const partnerMrr = coerceNonNegative(s.partner_attributed_mrr_eur);
  if (partnerMrr != null && mrr > 0) {
    base.partner_mrr_pct = roundTo((partnerMrr / mrr) * 100, 1);
  }
  // Verdict
  if (mrr >= Q2_MRR_TARGET_EUR) base.verdict = "pass";
  else if (mrr >= Q2_MRR_TARGET_EUR * 0.8) base.verdict = "warn";
  else base.verdict = "miss";
  return base;
}

/**
 * @typedef {object} Q2CohortRow
 * @property {string} cohort
 * @property {number} size
 * @property {ReadonlyArray<number|null>} retention_pct
 */

/**
 * @typedef {object} Q2CohortSummary
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {ReadonlyArray<Q2CohortRow>} cohorts
 * @property {number|null} avg_m1_pct
 * @property {number|null} avg_m3_pct
 * @property {number} cohort_count
 * @property {{m1_floor: number, m3_floor: number}} floors
 */

/**
 * @param {unknown} cohortRows
 * @returns {Q2CohortSummary}
 */
function buildQ2CohortSummary(cohortRows) {
  const floors = { m1_floor: Q2_M1_RETENTION_FLOOR_PCT, m3_floor: Q2_M3_RETENTION_FLOOR_PCT };
  /** @type {Q2CohortSummary} */
  const base = {
    verdict: "unknown",
    cohorts: Object.freeze([]),
    avg_m1_pct: null,
    avg_m3_pct: null,
    cohort_count: 0,
    floors,
  };
  if (!Array.isArray(cohortRows)) return base;
  /** @type {Q2CohortRow[]} */
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
  const m1Vals = cleaned.map((c) => c.retention_pct[1]).filter((v) => typeof v === "number");
  const m3Vals = cleaned.map((c) => c.retention_pct[3]).filter((v) => typeof v === "number");
  base.avg_m1_pct = m1Vals.length > 0 ? roundTo(m1Vals.reduce((a, b) => a + b, 0) / m1Vals.length, 1) : null;
  base.avg_m3_pct = m3Vals.length > 0 ? roundTo(m3Vals.reduce((a, b) => a + b, 0) / m3Vals.length, 1) : null;
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
// Roadmap adjustment
// ──────────────────────────────────────────────────────────────────

/** Allowed roadmap-adjustment kinds. */
const ROADMAP_ADJUSTMENT_KINDS = Object.freeze(["descalate", "escalate", "hold"]);

/**
 * @typedef {object} RoadmapDecision
 * @property {string} item — Phase H12 sub-phase id or scope item label
 * @property {"descalate"|"escalate"|"hold"} kind
 * @property {string} rationale
 */

/**
 * @typedef {object} RoadmapAdjustment
 * @property {"pass"|"warn"|"unknown"} verdict — pass when ≥ 3 decisions recorded
 * @property {ReadonlyArray<RoadmapDecision>} decisions
 * @property {number} required_count
 * @property {Record<string, number>} count_by_kind
 */

/**
 * Build the roadmap adjustment block. Pure.
 *
 * @param {unknown} decisions
 * @returns {RoadmapAdjustment}
 */
function buildRoadmapAdjustment(decisions) {
  /** @type {RoadmapAdjustment} */
  const base = {
    verdict: "unknown",
    decisions: Object.freeze([]),
    required_count: 3,
    count_by_kind: { descalate: 0, escalate: 0, hold: 0 },
  };
  if (!Array.isArray(decisions)) return base;
  /** @type {RoadmapDecision[]} */
  const cleaned = [];
  for (const d of decisions) {
    if (!d || typeof d !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (d);
    const item = typeof row.item === "string" && row.item.trim().length > 0 ? row.item.trim() : null;
    const kind = typeof row.kind === "string" && ROADMAP_ADJUSTMENT_KINDS.includes(row.kind)
      ? /** @type {"descalate"|"escalate"|"hold"} */ (row.kind)
      : null;
    const rationale = typeof row.rationale === "string" && row.rationale.trim().length > 0 ? row.rationale.trim() : null;
    if (item == null || kind == null || rationale == null) continue;
    cleaned.push(Object.freeze({ item, kind, rationale }));
    base.count_by_kind[kind] = (base.count_by_kind[kind] || 0) + 1;
  }
  base.decisions = Object.freeze(cleaned);
  if (cleaned.length === 0) {
    base.verdict = "unknown";
  } else if (cleaned.length >= base.required_count) {
    base.verdict = "pass";
  } else {
    base.verdict = "warn";
  }
  return base;
}

// ──────────────────────────────────────────────────────────────────
// Top-level plan builder
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Q2RetroPlanInput
 * @property {{overall_verdict?: string, sections?: object, quarter?: string} | null} [q1RetroPlan]
 * @property {{verdict?: string, passed?: number, total?: number, criteria?: ReadonlyArray<unknown>} | null} [wave3Evaluation]
 * @property {ReadonlyArray<PartnerDeal> | null} [partnerDeals]
 * @property {ChurnInputs | null} [churnInputs]
 * @property {Q2MrrSnapshot | null} [mrrSnapshot]
 * @property {ReadonlyArray<Q2CohortRow> | null} [cohorts]
 * @property {ReadonlyArray<RoadmapDecision> | null} [roadmapDecisions]
 */

/**
 * @typedef {object} Q2RetroPlan
 * @property {string} quarter
 * @property {string} label
 * @property {string} doc_path
 * @property {ReadonlyArray<string>} section_order
 * @property {{
 *   wave_3_outcomes: object,
 *   partner_deal_outcomes: PartnerDealSummary,
 *   churn_analysis: ChurnAnalysis,
 *   mrr: Q2MrrEvaluation,
 *   cohort: Q2CohortSummary,
 *   roadmap_adjustment: RoadmapAdjustment,
 * }} sections
 * @property {{quarter: string|null, overall_verdict: string|null}} q1_carryover
 * @property {"pass"|"warn"|"miss"|"unknown"} overall_verdict
 * @property {string} doctrine_note
 */

/**
 * Build the Q2 retro plan from raw inputs. Pure. NEVER throws.
 *
 * @param {Q2RetroPlanInput} [input]
 * @returns {Q2RetroPlan}
 */
function buildQ2RetroPlan(input) {
  const i = input && typeof input === "object" ? input : {};
  const wave3 = projectWaveEvaluation(i.wave3Evaluation, 3);
  const partner = buildPartnerDealSummary(i.partnerDeals ?? null);
  const churn = buildChurnAnalysis(i.churnInputs ?? null);
  const mrr = evaluateQ2MrrSnapshot(i.mrrSnapshot ?? null);
  const cohort = buildQ2CohortSummary(i.cohorts ?? null);
  const roadmap = buildRoadmapAdjustment(i.roadmapDecisions ?? null);
  const overall = rollUpVerdict([
    wave3.verdict,
    partner.verdict,
    churn.verdict,
    mrr.verdict,
    cohort.verdict,
    mapRoadmapVerdict(roadmap.verdict),
  ]);
  // Q1 carryover summary
  /** @type {{quarter: string|null, overall_verdict: string|null}} */
  const q1Carry = { quarter: null, overall_verdict: null };
  if (i.q1RetroPlan && typeof i.q1RetroPlan === "object") {
    const q = /** @type {Record<string, unknown>} */ (i.q1RetroPlan);
    if (typeof q.quarter === "string") q1Carry.quarter = q.quarter;
    if (typeof q.overall_verdict === "string") q1Carry.overall_verdict = q.overall_verdict;
  }
  return {
    quarter: Q2_QUARTER_KEY,
    label: Q2_LABEL,
    doc_path: REVENUE_RETRO_Q2_DOC_PATH,
    section_order: RETRO_SECTIONS,
    sections: {
      wave_3_outcomes: wave3,
      partner_deal_outcomes: partner,
      churn_analysis: churn,
      mrr,
      cohort,
      roadmap_adjustment: roadmap,
    },
    q1_carryover: q1Carry,
    overall_verdict: overall,
    doctrine_note: "Q2 targets TIGHTENED from Q1 per H11.18 lock-in + H11.20 strict-monotonic doctrine; once published, Q2 floors are locked alongside actuals.",
  };
}

/**
 * @param {unknown} ev
 * @param {3} waveNum
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
 * Map roadmap verdict alphabet onto the standard verdict alphabet. Pure.
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
 * @param {Q2RetroPlan} plan
 * @param {{publishedOn?: string|null}} [opts]
 * @returns {string}
 */
function renderRetroDoc(plan, opts) {
  if (!plan || typeof plan !== "object") {
    throw new RevenueRetroQ2Error("usage", "plan must be an object", { exitCode: EXIT.USAGE });
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
  out.push(`Q2 includes: partner deal outcomes + churn analysis + roadmap adjustment (on top of the standard Wave + MRR + cohort retro shape).`);
  out.push("");
  if (plan.q1_carryover.quarter) {
    out.push(`**Q1 carryover**: \`${plan.q1_carryover.quarter}\` ended at verdict \`${plan.q1_carryover.overall_verdict ?? "—"}\`. See [\`harvest-Q1.md\`](./harvest-Q1.md).`);
    out.push("");
  }
  out.push(`Doctrine: ${plan.doctrine_note}`);
  out.push("");

  // 1. Wave 3
  const w3 = plan.sections.wave_3_outcomes;
  out.push(`## 1. ${RETRO_SECTION_COPY.wave_3_outcomes.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(w3.verdict)} \`${w3.verdict}\``);
  if (w3.passed != null && w3.total != null) {
    out.push(`**Criteria met**: ${w3.passed} / ${w3.total}`);
  }
  if (w3.miss_criteria.length > 0) {
    out.push(`**Missed criteria**: ${w3.miss_criteria.map((c) => `\`${c}\``).join(", ")}`);
  }
  out.push("");
  out.push(RETRO_SECTION_COPY.wave_3_outcomes.body);
  out.push("");

  // 2. Partner deal outcomes
  const partner = plan.sections.partner_deal_outcomes;
  out.push(`## 2. ${RETRO_SECTION_COPY.partner_deal_outcomes.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(partner.verdict)} \`${partner.verdict}\`  `);
  out.push(`**Deals closed**: ${partner.deal_count} (floor ${partner.floors.deals_floor})  `);
  out.push(`**Total partner revenue**: €${partner.total_revenue_eur} (floor €${partner.floors.revenue_floor_eur})`);
  out.push("");
  if (partner.deals.length > 0) {
    out.push(`| Slug | Kind | Revenue (€) | Benefits activated |`);
    out.push(`| --- | --- | --- | --- |`);
    for (const d of partner.deals) {
      const benefits = d.benefits_activated.length > 0 ? d.benefits_activated.map((b) => `\`${b}\``).join(", ") : "—";
      out.push(`| \`${d.slug}\` | ${d.kind} | ${d.revenue_eur} | ${benefits} |`);
    }
    out.push("");
  }
  out.push(RETRO_SECTION_COPY.partner_deal_outcomes.body);
  out.push("");

  // 3. Churn analysis
  const churn = plan.sections.churn_analysis;
  out.push(`## 3. ${RETRO_SECTION_COPY.churn_analysis.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(churn.verdict)} \`${churn.verdict}\`  `);
  out.push(`**Trend**: ${trendEmoji(churn.trend)} \`${churn.trend}\`  `);
  out.push(`**Q2 churn**: ${churn.q2_churn_pct != null ? `${churn.q2_churn_pct}%` : "TBD"} (ceiling ${churn.ceiling}%)  `);
  if (churn.q1_churn_pct != null) out.push(`**Q1 churn**: ${churn.q1_churn_pct}%  `);
  if (churn.delta_pp != null) out.push(`**Delta (Q2 − Q1)**: ${churn.delta_pp >= 0 ? "+" : ""}${churn.delta_pp} pp`);
  out.push("");
  if (churn.top_reasons.length > 0) {
    out.push(`**Top cancellation reasons**:`);
    for (const r of churn.top_reasons) {
      out.push(`- \`${r.tag}\` × ${r.count}`);
    }
    out.push("");
  }
  out.push(RETRO_SECTION_COPY.churn_analysis.body);
  out.push("");

  // 4. MRR
  const mrr = plan.sections.mrr;
  out.push(`## 4. ${RETRO_SECTION_COPY.mrr.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(mrr.verdict)} \`${mrr.verdict}\`  `);
  out.push(`**Target**: €${mrr.target_eur}/mo  `);
  out.push(`**Actual**: ${mrr.mrr_eur != null ? `€${mrr.mrr_eur}/mo` : "TBD"}  `);
  if (mrr.growth_pct != null) out.push(`**Growth vs Q1**: ${mrr.growth_pct}%  `);
  if (mrr.partner_mrr_pct != null) out.push(`**Partner-attributed MRR share**: ${mrr.partner_mrr_pct}%`);
  out.push("");
  out.push(RETRO_SECTION_COPY.mrr.body);
  out.push("");

  // 5. Cohort
  const cohort = plan.sections.cohort;
  out.push(`## 5. ${RETRO_SECTION_COPY.cohort.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(cohort.verdict)} \`${cohort.verdict}\`  `);
  out.push(`**Cohorts**: ${cohort.cohort_count}  `);
  out.push(`**Avg M1 retention**: ${cohort.avg_m1_pct != null ? `${cohort.avg_m1_pct}%` : "TBD"} (Q2 floor ${cohort.floors.m1_floor}%)  `);
  out.push(`**Avg M3 retention**: ${cohort.avg_m3_pct != null ? `${cohort.avg_m3_pct}%` : "TBD"} (Q2 floor ${cohort.floors.m3_floor}%)`);
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

  // 6. Roadmap adjustment
  const rm = plan.sections.roadmap_adjustment;
  out.push(`## 6. ${RETRO_SECTION_COPY.roadmap_adjustment.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(mapRoadmapVerdict(rm.verdict))} \`${rm.verdict}\`  `);
  out.push(`**Decisions recorded**: ${rm.decisions.length} (required ≥ ${rm.required_count})  `);
  out.push(`**By kind**: descalate ${rm.count_by_kind.descalate} · escalate ${rm.count_by_kind.escalate} · hold ${rm.count_by_kind.hold}`);
  out.push("");
  if (rm.decisions.length > 0) {
    for (const d of rm.decisions) {
      out.push(`- **${d.item}** — \`${d.kind}\`: ${d.rationale}`);
    }
    out.push("");
  }
  out.push(RETRO_SECTION_COPY.roadmap_adjustment.body);
  out.push("");

  out.push(`---`);
  out.push("");
  out.push(`_Auto-generated by \`cli/commands/release/revenue-retro-q2.js\` ([H11.24])._`);
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
function trendEmoji(t) {
  if (t === "improving") return "📉";
  if (t === "worsening") return "📈";
  if (t === "steady") return "➡️";
  return "❓";
}

module.exports = {
  EXIT,
  REVENUE_RETRO_Q2_DOC_PATH,
  Q2_LABEL,
  Q2_QUARTER_KEY,
  RETRO_SECTIONS,
  RETRO_SECTION_COPY,
  Q2_MRR_TARGET_EUR,
  Q2_M1_RETENTION_FLOOR_PCT,
  Q2_M3_RETENTION_FLOOR_PCT,
  Q2_COST_TO_REVENUE_CEIL,
  Q2_CHURN_CEIL_PCT,
  Q2_PARTNER_DEALS_FLOOR,
  Q2_PARTNER_REVENUE_FLOOR_EUR,
  PARTNER_DEAL_KINDS,
  CHURN_REASON_TAGS,
  ROADMAP_ADJUSTMENT_KINDS,
  FOUNDER_REVIEW_SLA_DAYS,
  VERDICTS,
  CHURN_TRENDS,
  RevenueRetroQ2Error,
  coerceNonNegative,
  roundTo,
  buildPartnerDealSummary,
  buildChurnAnalysis,
  evaluateQ2MrrSnapshot,
  buildQ2CohortSummary,
  buildRoadmapAdjustment,
  buildQ2RetroPlan,
  projectWaveEvaluation,
  rollUpVerdict,
  mapRoadmapVerdict,
  renderRetroDoc,
  verdictEmoji,
  trendEmoji,
};
