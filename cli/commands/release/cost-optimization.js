// @ts-check
/**
 * [H11.28] cost-optimization.js — pure monthly cost-optimization plan +
 * evaluator + renderer.
 *
 * Contract (verbatim from masterplan §3 row [H11.28]):
 *   Cost optimization: monthly Azure Advisor + ACR housekeeping + LLM
 *   cache hit-rate review; per-month cost-tracker dashboard
 *
 * **Sibling-lib doctrine** (25th confirmed app): NO edits to H11.18-
 * H11.27 sibling libs. The cost-optimization lib is fresh; it consumes
 * raw inputs (Azure Advisor recommendations, ACR repo listings, LLM
 * cache stats, monthly cost line items) and emits a posture report.
 *
 * **4 SECTIONS** (masterplan literal order): azure_advisor /
 * acr_housekeeping / llm_cache_review / cost_tracker. Each has a
 * distinct evaluator returning a discriminated-union verdict.
 *
 * **MONTHLY CADENCE**: this lib runs once per month — the founder
 * dumps Advisor recommendations + ACR repo listings + cache stats +
 * cost line items, runs `buildCostOptimizationPlan(...)`, and the
 * renderer emits `planning/cost-optimization/YYYY-MM.md` per month.
 *
 * **EXECUTION-SCOPE-BOUNDARY DOCTRINE** (H11.18, reapplied): lib
 * ships the structure + evaluators + renderer + plan template. Actual
 * cost cuts (resizing VMs, deleting ACR tags, raising cache TTLs) are
 * founder-operator work, not code ships.
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/cost-optimization
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
const COST_OPTIMIZATION_DOC_DIR = "planning/cost-optimization";
const REVIEW_CADENCE = "monthly";

/** Plan sections (masterplan-row order). */
const PLAN_SECTIONS = Object.freeze([
  "azure_advisor",
  "acr_housekeeping",
  "llm_cache_review",
  "cost_tracker",
]);

/** Per-section display copy. */
const SECTION_COPY = Object.freeze({
  azure_advisor: Object.freeze({
    title: "Azure Advisor recommendations",
    body: "Pulled from Azure Advisor monthly. Categories: cost / reliability / security / operational-excellence / performance. We action ALL cost recommendations + flag high-severity reliability/security recs for next month.",
  }),
  acr_housekeeping: Object.freeze({
    title: "ACR (Azure Container Registry) housekeeping",
    body: "Per-repo + per-tag review. Untagged manifests (orphan layers) older than 30 days are eligible for deletion. Tags older than 180 days that aren't `latest` / pinned are eligible. Storage GB tracked month-over-month.",
  }),
  llm_cache_review: Object.freeze({
    title: "LLM cache hit-rate review",
    body: "H5.x LLM cache (scaffold-llm-cache) — hit-rate target ≥ 60% (saves cost on every cached completion). Per-prompt-key breakdown shows which prompts are most cache-friendly. Misses concentrated in 1-2 keys → candidate for prompt-template flattening to improve hit rate.",
  }),
  cost_tracker: Object.freeze({
    title: "Per-month cost tracker dashboard",
    body: "Total spend in €, by service category. MoM trend. Compare to Q1/Q2/annual cost ceilings from H11.23/H11.24/H11.25. Identify the top 3 cost drivers + which Advisor rec / ACR housekeeping action / cache tweak addresses each.",
  }),
});

/** Azure Advisor recommendation categories (per Azure docs). */
const ADVISOR_CATEGORIES = Object.freeze([
  "cost",
  "reliability",
  "security",
  "operational_excellence",
  "performance",
]);

/** Advisor recommendation severity (per Azure). */
const ADVISOR_SEVERITIES = Object.freeze(["low", "medium", "high"]);

/** ACR housekeeping action kinds. */
const ACR_ACTION_KINDS = Object.freeze([
  "delete_untagged",        // untagged manifests > UNTAGGED_AGE_DAYS
  "delete_old_tag",         // tagged but stale + not pinned
  "keep_pinned",            // tagged "latest" / explicitly pinned
  "keep_recent",            // < threshold
]);

/** LLM cache verdict-and-target thresholds. */
const LLM_CACHE_HIT_RATE_TARGET_PCT = 60;
const LLM_CACHE_HIT_RATE_WARN_FLOOR_PCT = 40;

/** ACR housekeeping thresholds. */
const ACR_UNTAGGED_AGE_DAYS = 30;
const ACR_STALE_TAG_AGE_DAYS = 180;

/** Cost tracker thresholds (mirrors H11.23 Q1 ceiling but applies monthly). */
const COST_TRACKER_TOP_LINE_ITEMS_COUNT = 3;

/** Verdict alphabet (uniform across all sections). */
const VERDICTS = Object.freeze(["pass", "warn", "miss", "unknown"]);

/** Mirrors H11.20+ — kept duplicated. */
const FOUNDER_REVIEW_SLA_DAYS = 7;

class CostOptimizationError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "CostOptimizationError";
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
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  return n;
}

/** @param {number|null} n @param {number} decimals @returns {number|null} */
function roundTo(n, decimals) {
  if (n == null || !Number.isFinite(n)) return null;
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}

/**
 * Validate month key as YYYY-MM. Pure.
 * @param {unknown} s @returns {boolean}
 */
function isValidMonthKey(s) {
  if (typeof s !== "string") return false;
  if (!/^\d{4}-\d{2}$/.test(s)) return false;
  const month = Number(s.slice(5, 7));
  return month >= 1 && month <= 12;
}

/**
 * Compute days between two ISO date inputs. Pure. Returns null on bad input.
 * @param {unknown} a @param {unknown} b @returns {number|null}
 */
function daysBetween(a, b) {
  const ta = parseTimestamp(a);
  const tb = parseTimestamp(b);
  if (ta == null || tb == null) return null;
  return Math.floor((tb - ta) / (24 * 3600 * 1000));
}

/** @param {unknown} input @returns {number|null} */
function parseTimestamp(input) {
  if (input == null) return null;
  if (input instanceof Date) {
    const v = input.getTime();
    return Number.isFinite(v) ? v : null;
  }
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input === "string") {
    const v = Date.parse(input);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────
// Azure Advisor evaluator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} AdvisorRec
 * @property {string} id
 * @property {string} category
 * @property {string} severity
 * @property {string} [title]
 * @property {number} [estimated_savings_eur]
 * @property {boolean} [actioned]
 */

/**
 * @typedef {object} AdvisorSummary
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {number} total_count
 * @property {Record<string, number>} count_by_category
 * @property {Record<string, number>} count_by_severity
 * @property {number} cost_recs_count
 * @property {number} cost_recs_actioned_count
 * @property {number} high_severity_count
 * @property {number} total_estimated_savings_eur
 * @property {ReadonlyArray<AdvisorRec>} unactioned_high
 */

/**
 * Summarise Azure Advisor recommendations. Pure.
 *
 * Pass when: all cost recs actioned AND no unactioned high-severity recs.
 * Warn when: cost recs ≥ 80% actioned OR 1-2 unactioned high recs.
 * Miss otherwise. Empty/null → unknown.
 *
 * @param {unknown} recs
 * @returns {AdvisorSummary}
 */
function summarizeAdvisor(recs) {
  /** @type {AdvisorSummary} */
  const base = {
    verdict: "unknown",
    total_count: 0,
    count_by_category: { cost: 0, reliability: 0, security: 0, operational_excellence: 0, performance: 0 },
    count_by_severity: { low: 0, medium: 0, high: 0 },
    cost_recs_count: 0,
    cost_recs_actioned_count: 0,
    high_severity_count: 0,
    total_estimated_savings_eur: 0,
    unactioned_high: Object.freeze([]),
  };
  if (!Array.isArray(recs)) return base;
  /** @type {AdvisorRec[]} */
  const cleaned = [];
  /** @type {AdvisorRec[]} */
  const unactionedHigh = [];
  let savings = 0;
  for (const r of recs) {
    if (!r || typeof r !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (r);
    const id = typeof row.id === "string" && row.id.trim().length > 0 ? row.id.trim() : null;
    const category = typeof row.category === "string" && ADVISOR_CATEGORIES.includes(row.category) ? row.category : null;
    const severity = typeof row.severity === "string" && ADVISOR_SEVERITIES.includes(row.severity) ? row.severity : null;
    if (id == null || category == null || severity == null) continue;
    const rec = {
      id,
      category,
      severity,
      ...(typeof row.title === "string" ? { title: row.title } : {}),
      ...(coerceNonNegative(row.estimated_savings_eur) != null
        ? { estimated_savings_eur: /** @type {number} */ (coerceNonNegative(row.estimated_savings_eur)) }
        : {}),
      actioned: row.actioned === true,
    };
    cleaned.push(Object.freeze(rec));
    base.count_by_category[category] += 1;
    base.count_by_severity[severity] += 1;
    if (category === "cost") {
      base.cost_recs_count += 1;
      if (rec.actioned) base.cost_recs_actioned_count += 1;
      if (rec.estimated_savings_eur != null) savings += rec.estimated_savings_eur;
    }
    if (severity === "high") {
      base.high_severity_count += 1;
      if (!rec.actioned) unactionedHigh.push(rec);
    }
  }
  base.total_count = cleaned.length;
  base.total_estimated_savings_eur = roundTo(savings, 2) ?? 0;
  base.unactioned_high = Object.freeze(unactionedHigh);
  if (cleaned.length === 0) {
    base.verdict = "unknown";
  } else {
    const costRatio = base.cost_recs_count > 0
      ? base.cost_recs_actioned_count / base.cost_recs_count
      : 1;
    if (costRatio >= 1 && unactionedHigh.length === 0) base.verdict = "pass";
    else if (costRatio >= 0.8 && unactionedHigh.length <= 2) base.verdict = "warn";
    else base.verdict = "miss";
  }
  return base;
}

// ──────────────────────────────────────────────────────────────────
// ACR housekeeping evaluator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} AcrManifest
 * @property {string} repo
 * @property {string} [tag] — null for untagged
 * @property {string} pushed_at — ISO date
 * @property {number} [size_mb]
 * @property {boolean} [pinned]
 */

/**
 * @typedef {object} AcrPlan
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {number} total_manifests
 * @property {number} eligible_deletes_count
 * @property {number} estimated_reclaim_mb
 * @property {Record<string, number>} count_by_action
 * @property {ReadonlyArray<{repo: string, tag: string|null, action: string, age_days: number}>} actions
 */

/**
 * Build ACR housekeeping plan. Pure.
 *
 * @param {unknown} manifests
 * @param {{now?: string|number|Date}} [opts]
 * @returns {AcrPlan}
 */
function buildAcrHousekeepingPlan(manifests, opts) {
  /** @type {AcrPlan} */
  const base = {
    verdict: "unknown",
    total_manifests: 0,
    eligible_deletes_count: 0,
    estimated_reclaim_mb: 0,
    count_by_action: { delete_untagged: 0, delete_old_tag: 0, keep_pinned: 0, keep_recent: 0 },
    actions: Object.freeze([]),
  };
  if (!Array.isArray(manifests)) return base;
  const now = (opts && opts.now != null ? parseTimestamp(opts.now) : Date.now()) ?? Date.now();
  /** @type {Array<{repo: string, tag: string|null, action: string, age_days: number, size_mb: number}>} */
  const actions = [];
  let reclaim = 0;
  for (const m of manifests) {
    if (!m || typeof m !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (m);
    const repo = typeof row.repo === "string" && row.repo.trim().length > 0 ? row.repo.trim() : null;
    const pushedMs = parseTimestamp(row.pushed_at);
    if (repo == null || pushedMs == null) continue;
    const tag = typeof row.tag === "string" && row.tag.trim().length > 0 ? row.tag.trim() : null;
    const pinned = row.pinned === true || tag === "latest";
    const sizeMb = coerceNonNegative(row.size_mb) ?? 0;
    const ageDays = Math.floor((now - pushedMs) / (24 * 3600 * 1000));
    /** @type {"delete_untagged"|"delete_old_tag"|"keep_pinned"|"keep_recent"} */
    let action;
    if (pinned) {
      action = "keep_pinned";
    } else if (tag == null && ageDays > ACR_UNTAGGED_AGE_DAYS) {
      action = "delete_untagged";
      reclaim += sizeMb;
    } else if (tag != null && ageDays > ACR_STALE_TAG_AGE_DAYS) {
      action = "delete_old_tag";
      reclaim += sizeMb;
    } else {
      action = "keep_recent";
    }
    actions.push({ repo, tag, action, age_days: ageDays, size_mb: sizeMb });
    base.count_by_action[action] += 1;
  }
  actions.sort((a, b) => b.age_days - a.age_days);
  base.total_manifests = actions.length;
  base.eligible_deletes_count = base.count_by_action.delete_untagged + base.count_by_action.delete_old_tag;
  base.estimated_reclaim_mb = roundTo(reclaim, 2) ?? 0;
  base.actions = Object.freeze(actions.map((a) => Object.freeze({ repo: a.repo, tag: a.tag, action: a.action, age_days: a.age_days })));
  if (actions.length === 0) {
    base.verdict = "unknown";
  } else if (base.eligible_deletes_count === 0) {
    base.verdict = "pass"; // clean registry, no housekeeping needed
  } else if (base.eligible_deletes_count <= Math.ceil(actions.length * 0.2)) {
    base.verdict = "warn"; // some housekeeping pending but under 20%
  } else {
    base.verdict = "miss"; // > 20% of registry is housekeeping-eligible
  }
  return base;
}

// ──────────────────────────────────────────────────────────────────
// LLM cache hit-rate review
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} LlmCacheStat
 * @property {string} prompt_key
 * @property {number} hits
 * @property {number} misses
 * @property {number} [estimated_savings_eur]
 */

/**
 * @typedef {object} LlmCacheReview
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {number} total_hits
 * @property {number} total_misses
 * @property {number|null} hit_rate_pct
 * @property {number} target_pct
 * @property {ReadonlyArray<LlmCacheStat & {hit_rate_pct: number|null}>} per_prompt
 * @property {ReadonlyArray<string>} top_miss_keys
 * @property {number} total_estimated_savings_eur
 */

/**
 * Review LLM cache hit rate. Pure.
 *
 * @param {unknown} stats
 * @returns {LlmCacheReview}
 */
function buildLlmCacheReview(stats) {
  /** @type {LlmCacheReview} */
  const base = {
    verdict: "unknown",
    total_hits: 0,
    total_misses: 0,
    hit_rate_pct: null,
    target_pct: LLM_CACHE_HIT_RATE_TARGET_PCT,
    per_prompt: Object.freeze([]),
    top_miss_keys: Object.freeze([]),
    total_estimated_savings_eur: 0,
  };
  if (!Array.isArray(stats)) return base;
  /** @type {Array<LlmCacheStat & {hit_rate_pct: number|null}>} */
  const cleaned = [];
  let totalHits = 0;
  let totalMisses = 0;
  let savings = 0;
  for (const s of stats) {
    if (!s || typeof s !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (s);
    const key = typeof row.prompt_key === "string" && row.prompt_key.trim().length > 0 ? row.prompt_key.trim() : null;
    const hits = coerceNonNegative(row.hits);
    const misses = coerceNonNegative(row.misses);
    if (key == null || hits == null || misses == null) continue;
    const total = hits + misses;
    const rate = total > 0 ? roundTo((hits / total) * 100, 1) : null;
    cleaned.push(Object.freeze({
      prompt_key: key,
      hits,
      misses,
      hit_rate_pct: rate,
      ...(coerceNonNegative(row.estimated_savings_eur) != null
        ? { estimated_savings_eur: /** @type {number} */ (coerceNonNegative(row.estimated_savings_eur)) }
        : {}),
    }));
    totalHits += hits;
    totalMisses += misses;
    if (coerceNonNegative(row.estimated_savings_eur) != null) {
      savings += /** @type {number} */ (coerceNonNegative(row.estimated_savings_eur));
    }
  }
  cleaned.sort((a, b) => b.misses - a.misses);
  const overallTotal = totalHits + totalMisses;
  base.total_hits = totalHits;
  base.total_misses = totalMisses;
  base.hit_rate_pct = overallTotal > 0 ? roundTo((totalHits / overallTotal) * 100, 1) : null;
  base.per_prompt = Object.freeze(cleaned);
  base.top_miss_keys = Object.freeze(cleaned.slice(0, 3).map((c) => c.prompt_key));
  base.total_estimated_savings_eur = roundTo(savings, 2) ?? 0;
  if (cleaned.length === 0 || base.hit_rate_pct == null) {
    base.verdict = "unknown";
  } else if (base.hit_rate_pct >= LLM_CACHE_HIT_RATE_TARGET_PCT) {
    base.verdict = "pass";
  } else if (base.hit_rate_pct >= LLM_CACHE_HIT_RATE_WARN_FLOOR_PCT) {
    base.verdict = "warn";
  } else {
    base.verdict = "miss";
  }
  return base;
}

// ──────────────────────────────────────────────────────────────────
// Cost tracker dashboard
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} CostLineItem
 * @property {string} category
 * @property {number} amount_eur
 */

/**
 * @typedef {object} CostTrackerDashboard
 * @property {"pass"|"warn"|"miss"|"unknown"} verdict
 * @property {string|null} month
 * @property {number|null} total_eur
 * @property {number|null} prior_month_total_eur
 * @property {number|null} mom_delta_eur
 * @property {number|null} mom_delta_pct
 * @property {ReadonlyArray<CostLineItem>} top_line_items
 * @property {ReadonlyArray<CostLineItem>} all_line_items
 */

/**
 * Build per-month cost dashboard. Pure.
 *
 * @param {{
 *   month?: string,
 *   line_items?: ReadonlyArray<CostLineItem>,
 *   prior_month_total_eur?: number,
 *   monthly_budget_eur?: number,
 * }} input
 * @returns {CostTrackerDashboard}
 */
function buildCostTrackerDashboard(input) {
  /** @type {CostTrackerDashboard} */
  const base = {
    verdict: "unknown",
    month: null,
    total_eur: null,
    prior_month_total_eur: null,
    mom_delta_eur: null,
    mom_delta_pct: null,
    top_line_items: Object.freeze([]),
    all_line_items: Object.freeze([]),
  };
  if (!input || typeof input !== "object") return base;
  if (isValidMonthKey(input.month)) base.month = input.month;
  if (!Array.isArray(input.line_items)) return base;
  /** @type {CostLineItem[]} */
  const cleaned = [];
  let total = 0;
  for (const li of input.line_items) {
    if (!li || typeof li !== "object") continue;
    const row = /** @type {Record<string, unknown>} */ (li);
    const category = typeof row.category === "string" && row.category.trim().length > 0 ? row.category.trim() : null;
    const amount = coerceNonNegative(row.amount_eur);
    if (category == null || amount == null) continue;
    cleaned.push(Object.freeze({ category, amount_eur: amount }));
    total += amount;
  }
  cleaned.sort((a, b) => b.amount_eur - a.amount_eur);
  base.all_line_items = Object.freeze(cleaned);
  base.top_line_items = Object.freeze(cleaned.slice(0, COST_TRACKER_TOP_LINE_ITEMS_COUNT));
  base.total_eur = roundTo(total, 2);
  const prior = coerceNonNegative(input.prior_month_total_eur);
  if (prior != null) {
    base.prior_month_total_eur = prior;
    base.mom_delta_eur = roundTo(total - prior, 2);
    if (prior > 0) base.mom_delta_pct = roundTo(((total - prior) / prior) * 100, 1);
  }
  // Verdict
  const budget = coerceNonNegative(input.monthly_budget_eur);
  if (base.total_eur == null || cleaned.length === 0) {
    base.verdict = "unknown";
  } else if (budget == null) {
    // No budget reference → pass when total recorded
    base.verdict = "pass";
  } else if (base.total_eur <= budget) {
    base.verdict = "pass";
  } else if (base.total_eur <= budget * 1.1) {
    base.verdict = "warn";
  } else {
    base.verdict = "miss";
  }
  return base;
}

// ──────────────────────────────────────────────────────────────────
// Top-level plan builder
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} CostOptimizationPlanInput
 * @property {string} [month] — YYYY-MM
 * @property {ReadonlyArray<AdvisorRec>} [advisorRecs]
 * @property {ReadonlyArray<AcrManifest>} [acrManifests]
 * @property {ReadonlyArray<LlmCacheStat>} [llmCacheStats]
 * @property {{line_items?: ReadonlyArray<CostLineItem>, prior_month_total_eur?: number, monthly_budget_eur?: number}} [costTrackerInputs]
 * @property {string|number|Date} [now]
 */

/**
 * @typedef {object} CostOptimizationPlan
 * @property {string} month
 * @property {string} doc_path
 * @property {ReadonlyArray<string>} section_order
 * @property {{
 *   azure_advisor: AdvisorSummary,
 *   acr_housekeeping: AcrPlan,
 *   llm_cache_review: LlmCacheReview,
 *   cost_tracker: CostTrackerDashboard,
 * }} sections
 * @property {"pass"|"warn"|"miss"|"unknown"} overall_verdict
 * @property {number} total_estimated_savings_eur
 * @property {string} doctrine_note
 */

/**
 * Build the monthly cost-optimization plan. Pure. NEVER throws.
 *
 * @param {CostOptimizationPlanInput} [input]
 * @returns {CostOptimizationPlan}
 */
function buildCostOptimizationPlan(input) {
  const i = input && typeof input === "object" ? input : {};
  const month = isValidMonthKey(i.month) ? /** @type {string} */ (i.month) : "TBD";
  const advisor = summarizeAdvisor(i.advisorRecs ?? null);
  const acr = buildAcrHousekeepingPlan(i.acrManifests ?? null, { now: i.now });
  const cache = buildLlmCacheReview(i.llmCacheStats ?? null);
  const cost = buildCostTrackerDashboard({
    month,
    line_items: i.costTrackerInputs && i.costTrackerInputs.line_items,
    prior_month_total_eur: i.costTrackerInputs && i.costTrackerInputs.prior_month_total_eur,
    monthly_budget_eur: i.costTrackerInputs && i.costTrackerInputs.monthly_budget_eur,
  });
  const overall = rollUpVerdict([advisor.verdict, acr.verdict, cache.verdict, cost.verdict]);
  const totalSavings = roundTo(
    (advisor.total_estimated_savings_eur || 0)
    + (cache.total_estimated_savings_eur || 0),
    2,
  ) ?? 0;
  const docPath = month === "TBD"
    ? `${COST_OPTIMIZATION_DOC_DIR}/TBD.md`
    : `${COST_OPTIMIZATION_DOC_DIR}/${month}.md`;
  return {
    month,
    doc_path: docPath,
    section_order: PLAN_SECTIONS,
    sections: {
      azure_advisor: advisor,
      acr_housekeeping: acr,
      llm_cache_review: cache,
      cost_tracker: cost,
    },
    overall_verdict: overall,
    total_estimated_savings_eur: totalSavings,
    doctrine_note: "Monthly cost-optimization cadence per H11.28. Lib ships structure + evaluators + renderer; actual cost cuts (resize VMs, delete ACR tags, flatten prompts) are founder-operator work per H11.18 execution-scope-boundary doctrine.",
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

// ──────────────────────────────────────────────────────────────────
// Renderer
// ──────────────────────────────────────────────────────────────────

/**
 * @param {CostOptimizationPlan} plan
 * @returns {string}
 */
function renderPlanReport(plan) {
  if (!plan || typeof plan !== "object") {
    throw new CostOptimizationError("usage", "plan must be an object", { exitCode: EXIT.USAGE });
  }
  /** @type {string[]} */
  const out = [];
  out.push(`# Cost optimization — ${plan.month}`);
  out.push("");
  out.push(`> **Overall verdict**: ${verdictEmoji(plan.overall_verdict)} \`${plan.overall_verdict}\`  `);
  out.push(`> **Estimated savings identified**: €${plan.total_estimated_savings_eur}  `);
  out.push(`> **Cadence**: ${REVIEW_CADENCE}`);
  out.push("");
  out.push(`Covers: Azure Advisor + ACR housekeeping + LLM cache hit-rate review + cost-tracker dashboard.`);
  out.push("");
  out.push(`Doctrine: ${plan.doctrine_note}`);
  out.push("");

  // 1. Azure Advisor
  const adv = plan.sections.azure_advisor;
  out.push(`## 1. ${SECTION_COPY.azure_advisor.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(adv.verdict)} \`${adv.verdict}\`  `);
  out.push(`**Total recs**: ${adv.total_count}  `);
  out.push(`**Cost recs actioned**: ${adv.cost_recs_actioned_count} / ${adv.cost_recs_count}  `);
  out.push(`**High severity (unactioned)**: ${adv.unactioned_high.length} / ${adv.high_severity_count}  `);
  out.push(`**Estimated savings**: €${adv.total_estimated_savings_eur}`);
  out.push("");
  if (adv.total_count > 0) {
    out.push(`**By category**: cost ${adv.count_by_category.cost} · reliability ${adv.count_by_category.reliability} · security ${adv.count_by_category.security} · operational_excellence ${adv.count_by_category.operational_excellence} · performance ${adv.count_by_category.performance}`);
    out.push(`**By severity**: high ${adv.count_by_severity.high} · medium ${adv.count_by_severity.medium} · low ${adv.count_by_severity.low}`);
    out.push("");
  }
  if (adv.unactioned_high.length > 0) {
    out.push(`**Unactioned high-severity recs**:`);
    for (const r of adv.unactioned_high) {
      out.push(`- \`${r.id}\` (\`${r.category}\`): ${r.title ?? "—"}`);
    }
    out.push("");
  }
  out.push(SECTION_COPY.azure_advisor.body);
  out.push("");

  // 2. ACR housekeeping
  const acr = plan.sections.acr_housekeeping;
  out.push(`## 2. ${SECTION_COPY.acr_housekeeping.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(acr.verdict)} \`${acr.verdict}\`  `);
  out.push(`**Total manifests**: ${acr.total_manifests}  `);
  out.push(`**Eligible for delete**: ${acr.eligible_deletes_count} (${acr.count_by_action.delete_untagged} untagged > ${ACR_UNTAGGED_AGE_DAYS}d + ${acr.count_by_action.delete_old_tag} stale tags > ${ACR_STALE_TAG_AGE_DAYS}d)  `);
  out.push(`**Estimated reclaim**: ${acr.estimated_reclaim_mb} MB  `);
  out.push(`**Kept pinned**: ${acr.count_by_action.keep_pinned} · **Kept recent**: ${acr.count_by_action.keep_recent}`);
  out.push("");
  if (acr.actions.length > 0) {
    out.push(`| Repo | Tag | Age (days) | Action |`);
    out.push(`| --- | --- | --- | --- |`);
    for (const a of acr.actions.slice(0, 10)) {
      out.push(`| ${a.repo} | ${a.tag ?? "<untagged>"} | ${a.age_days} | \`${a.action}\` |`);
    }
    if (acr.actions.length > 10) {
      out.push(`| _… ${acr.actions.length - 10} more entries omitted_ | | | |`);
    }
    out.push("");
  }
  out.push(SECTION_COPY.acr_housekeeping.body);
  out.push("");

  // 3. LLM cache
  const cache = plan.sections.llm_cache_review;
  out.push(`## 3. ${SECTION_COPY.llm_cache_review.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(cache.verdict)} \`${cache.verdict}\`  `);
  out.push(`**Hit rate**: ${cache.hit_rate_pct != null ? `${cache.hit_rate_pct}%` : "TBD"} (target ${cache.target_pct}%)  `);
  out.push(`**Hits / misses**: ${cache.total_hits} / ${cache.total_misses}  `);
  out.push(`**Estimated savings**: €${cache.total_estimated_savings_eur}`);
  out.push("");
  if (cache.top_miss_keys.length > 0) {
    out.push(`**Top miss-heavy prompt keys**: ${cache.top_miss_keys.map((k) => `\`${k}\``).join(", ")}`);
    out.push("");
  }
  if (cache.per_prompt.length > 0) {
    out.push(`| Prompt key | Hits | Misses | Hit rate |`);
    out.push(`| --- | --- | --- | --- |`);
    for (const p of cache.per_prompt.slice(0, 10)) {
      out.push(`| \`${p.prompt_key}\` | ${p.hits} | ${p.misses} | ${p.hit_rate_pct != null ? `${p.hit_rate_pct}%` : "—"} |`);
    }
    out.push("");
  }
  out.push(SECTION_COPY.llm_cache_review.body);
  out.push("");

  // 4. Cost tracker
  const ct = plan.sections.cost_tracker;
  out.push(`## 4. ${SECTION_COPY.cost_tracker.title}`);
  out.push("");
  out.push(`**Verdict**: ${verdictEmoji(ct.verdict)} \`${ct.verdict}\`  `);
  out.push(`**Month**: ${ct.month ?? "TBD"}  `);
  out.push(`**Total spend**: ${ct.total_eur != null ? `€${ct.total_eur}` : "TBD"}  `);
  if (ct.prior_month_total_eur != null) out.push(`**Prior month**: €${ct.prior_month_total_eur}  `);
  if (ct.mom_delta_eur != null) out.push(`**MoM delta**: ${ct.mom_delta_eur >= 0 ? "+" : ""}€${ct.mom_delta_eur}${ct.mom_delta_pct != null ? ` (${ct.mom_delta_pct >= 0 ? "+" : ""}${ct.mom_delta_pct}%)` : ""}`);
  out.push("");
  if (ct.top_line_items.length > 0) {
    out.push(`**Top ${COST_TRACKER_TOP_LINE_ITEMS_COUNT} cost line items**:`);
    for (const li of ct.top_line_items) out.push(`- ${li.category}: €${li.amount_eur}`);
    out.push("");
  }
  out.push(SECTION_COPY.cost_tracker.body);
  out.push("");

  out.push(`---`);
  out.push("");
  out.push(`_Auto-generated by \`cli/commands/release/cost-optimization.js\` ([H11.28])._`);
  return out.join("\n");
}

/** @param {string} v */
function verdictEmoji(v) {
  if (v === "pass") return "✅";
  if (v === "warn") return "⚠️";
  if (v === "miss") return "❌";
  return "❓";
}

module.exports = {
  EXIT,
  COST_OPTIMIZATION_DOC_DIR,
  REVIEW_CADENCE,
  PLAN_SECTIONS,
  SECTION_COPY,
  ADVISOR_CATEGORIES,
  ADVISOR_SEVERITIES,
  ACR_ACTION_KINDS,
  LLM_CACHE_HIT_RATE_TARGET_PCT,
  LLM_CACHE_HIT_RATE_WARN_FLOOR_PCT,
  ACR_UNTAGGED_AGE_DAYS,
  ACR_STALE_TAG_AGE_DAYS,
  COST_TRACKER_TOP_LINE_ITEMS_COUNT,
  VERDICTS,
  FOUNDER_REVIEW_SLA_DAYS,
  CostOptimizationError,
  coerceNonNegative,
  roundTo,
  isValidMonthKey,
  daysBetween,
  parseTimestamp,
  summarizeAdvisor,
  buildAcrHousekeepingPlan,
  buildLlmCacheReview,
  buildCostTrackerDashboard,
  buildCostOptimizationPlan,
  rollUpVerdict,
  renderPlanReport,
  verdictEmoji,
};
