// @ts-check
/**
 * [H11.12] quota-enforcement.js — pure server-side request-time gate for
 * per-tier paid-action quotas.
 *
 * Contract (verbatim from masterplan §3 row [H11.12]):
 *   Quota enforcement: Pro (10 customizes/mo), Team (50/mo), Business
 *   (unlimited); soft-limit warning at 80%; hard-stop at 100% with
 *   upgrade CTA
 *
 * **Masterplan-literal pins** (locked here so they grep cleanly across the
 * codebase + a regression bump can't slip in without a test break):
 *   - tier limits (per masterplan-row "customizes/mo"):
 *       free       → 0   (UI-side prohibition; masterplan row doesn't enum
 *                          free explicitly, but H11.10 portal already
 *                          shows free customizes_per_period: 0 — kept
 *                          consistent here)
 *       pro        → 10
 *       team       → 50
 *       business   → null (unlimited)
 *       enterprise → null (unlimited)
 *   - WARN threshold: 80 % (used >= 0.8 * limit AND used < limit)
 *   - HARD STOP threshold: 100 % (used >= limit)
 *   - hard-stop response includes an upgrade CTA pointing to the next
 *     paid tier's catalog product id (from H11.4 STRIPE_PRODUCTS)
 *
 * **Sibling-lib doctrine** (9th confirmed app in H11 arc — see H11.11):
 * this module does NOT edit H11.10 `account-portal.ts`, H11.11
 * `usage-events.js`, nor A5.1 `entitlements-store.js`. It CONSUMES the
 * H11.11 aggregator output via the `UsageCounts`-shaped `counts` input —
 * the call site fetches the aggregator result + passes it in. The
 * recorder for the action's own event runs AFTER the gate allows; the
 * gate itself only READS.
 *
 * **Two-surface lib** (mirrors H11.11):
 *
 *   1. **Decision surface** — `evaluateQuota({tier, action, counts,
 *      threshold?, hardLimitMargin?})` is the pure decision function.
 *      Returns a discriminated union `{decision: "allow"|"warn"|"deny",
 *      ...}` that the HTTP / CLI layer renders as appropriate.
 *
 *   2. **Gate surface** — `gateRequest({tier, action, subject, fetchCounts})`
 *      is the end-to-end async gate: fetches counts via the injected
 *      aggregator + delegates to `evaluateQuota` + wraps the response in
 *      a stable `{ok, decision, ...}` envelope including upgrade CTA
 *      data for "deny" + an `http_status` field (200 for allow/warn,
 *      429 for deny — matches standard rate-limit response code).
 *
 * **Why action is parameterised** (not hard-coded to "customizes"): the
 * gate framework is reusable for the H11.10-shipped 3-counter quota set
 * (imports / customizes / reharvests). The masterplan row only mentions
 * customizes explicitly, so the H11.12 ship's primary contract is
 * customizes — but plumbing the action argument keeps the lib forward-
 * compatible without a future refactor when the team / business plans
 * extend other counters too.
 *
 * **Why we expose both `evaluateQuota` + `gateRequest`**: the call sites
 * split — the HTTP middleware needs `gateRequest` (async I/O); the CLI
 * import handler running offline against a pre-fetched usage snapshot
 * (e.g. cached from the H11.10 portal load) calls `evaluateQuota`
 * synchronously without an async hop. Both share the same decision body.
 *
 * **No third-party deps** (third-party-requires invariant — only `node:`
 * prefixed core modules are used; lib intentionally has zero requires).
 *
 * **No pg / network** — gate delegates to the injected `fetchCounts`
 * function so consumers can wire pg-backed H11.11 aggregator, a cached
 * Redis layer, or a hermetic test stub.
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/quota-enforcement
 */
"use strict";

/** Sysexits-aligned exit codes (used by the future CLI surface; HTTP
 *  callers translate `decision` to status codes via `http_status`). */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  TEMPFAIL: 75,
  SOFTWARE: 70,
});

/** Three masterplan-literal usage actions matching H11.10's UsageAction +
 *  H11.11's USAGE_ACTIONS. */
const QUOTA_ACTIONS = Object.freeze(["imports", "customizes", "reharvests"]);

/** Per-tier action quotas. `null` = unlimited.
 *
 *  The customizes row matches the masterplan-literal numbers verbatim:
 *  Pro 10, Team 50, Business unlimited. Imports + reharvests carry the
 *  conservative H11.10 UI estimates so the gate's promise matches the
 *  portal's promise. H11 sub-phases may tighten these BUT NEVER LOOSEN
 *  without bumping the H11.10 UI display in lockstep. */
const TIER_QUOTAS = Object.freeze({
  free: Object.freeze({
    imports: 3,
    customizes: 0,
    reharvests: 0,
  }),
  pro: Object.freeze({
    imports: 25,
    customizes: 10,
    reharvests: 25,
  }),
  team: Object.freeze({
    imports: 100,
    customizes: 50,
    reharvests: 100,
  }),
  business: Object.freeze({
    imports: null,
    customizes: null,
    reharvests: null,
  }),
  enterprise: Object.freeze({
    imports: null,
    customizes: null,
    reharvests: null,
  }),
});

/** Soft-limit threshold from masterplan literal — 80 % triggers warn. */
const SOFT_WARN_THRESHOLD = 0.8;

/** Tier ladder for the upgrade-CTA next-tier resolver. */
const TIER_LADDER = Object.freeze(["free", "pro", "team", "business", "enterprise"]);

/** Mapping from masterplan-tier → H11.4 catalog product id (the canonical
 *  upgrade target). Used by the deny-decision CTA. Frozen literal. */
const TIER_TO_PRODUCT_ID = Object.freeze({
  pro: "frootai-pro-monthly",
  team: "frootai-team-monthly",
  business: "frootai-business-monthly",
});

/** HTTP status code per decision kind. */
const HTTP_STATUS_BY_DECISION = Object.freeze({
  allow: 200,
  warn: 200,
  deny: 429,
});

/** Default upgrade CTA copy (frozen). */
const UPGRADE_CTA_COPY = Object.freeze({
  upgradeTitle: "You've hit your monthly quota",
  upgradeBody: "Upgrade to a higher plan to keep customising plays this month.",
  warnTitle: "Approaching your monthly quota",
  warnBody: "You've used 80% of your monthly allowance. Upgrade to avoid interruptions.",
});

class QuotaEnforcementError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "QuotaEnforcementError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

// ──────────────────────────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Whether the action is one of the 3 known quota actions. Pure type-guard.
 *
 * @param {unknown} a
 * @returns {boolean}
 */
function isValidAction(a) {
  return typeof a === "string" && QUOTA_ACTIONS.includes(a);
}

/**
 * Whether the tier is in the canonical ladder. Pure type-guard.
 *
 * @param {unknown} t
 * @returns {boolean}
 */
function isKnownTier(t) {
  return typeof t === "string" && TIER_LADDER.includes(t);
}

/**
 * Lookup the per-action quota for a tier. Pure. Unknown tiers fall back
 * to the strictest tier (`free`) — fail-closed: if we don't recognise the
 * tier, we apply the lowest limits rather than waving them through.
 *
 * @param {string} tier
 * @param {string} action
 * @returns {number|null}
 */
function quotaForTierAction(tier, action) {
  if (!isValidAction(action)) {
    throw new QuotaEnforcementError("usage", `action must be one of ${QUOTA_ACTIONS.join("|")}`, { exitCode: EXIT.USAGE });
  }
  const t = isKnownTier(tier) ? tier : "free";
  const row = TIER_QUOTAS[/** @type {keyof typeof TIER_QUOTAS} */ (t)] || TIER_QUOTAS.free;
  const v = row[/** @type {keyof typeof row} */ (action)];
  return v === null ? null : v;
}

/**
 * Resolve the NEXT-UP paid tier for an upgrade CTA. Pure.
 *   - free       → pro
 *   - pro        → team
 *   - team       → business
 *   - business   → enterprise
 *   - enterprise → null (already at top)
 *
 * @param {string} tier
 * @returns {string|null}
 */
function nextUpgradeTier(tier) {
  const idx = TIER_LADDER.indexOf(tier);
  if (idx < 0) return "pro"; // unknown tier → suggest the entry-level paid
  if (idx >= TIER_LADDER.length - 1) return null;
  return TIER_LADDER[idx + 1];
}

/**
 * Map a tier name to the H11.4 catalog product id (canonical upgrade
 * target). Pure. Returns null for tiers without a public catalog product
 * (free / enterprise).
 *
 * @param {string|null} tier
 * @returns {string|null}
 */
function productIdForTier(tier) {
  if (typeof tier !== "string") return null;
  const id = TIER_TO_PRODUCT_ID[/** @type {keyof typeof TIER_TO_PRODUCT_ID} */ (tier)];
  return typeof id === "string" ? id : null;
}

/**
 * Build the upgrade CTA shape for deny / warn decisions. Pure. Returns
 * null when no upgrade is available (enterprise has no next tier).
 *
 * @param {string} currentTier
 * @returns {{tier: string, productId: string|null, label: string}|null}
 */
function buildUpgradeCta(currentTier) {
  const next = nextUpgradeTier(currentTier);
  if (next == null) return null;
  return {
    tier: next,
    productId: productIdForTier(next),
    label: `Upgrade to ${next.charAt(0).toUpperCase() + next.slice(1)}`,
  };
}

/**
 * Compute used count for the action from a H11.11-shaped counts object.
 * Pure. Tolerates missing keys + non-number values (coerces to 0).
 *
 * @param {unknown} counts
 * @param {string} action
 * @returns {number}
 */
function pickUsedCount(counts, action) {
  if (!counts || typeof counts !== "object") return 0;
  const v = /** @type {Record<string, unknown>} */ (counts)[action];
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return 0;
  return Math.floor(v);
}

// ──────────────────────────────────────────────────────────────────
// Decision surface
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} QuotaDecisionAllow
 * @property {"allow"} decision
 * @property {string} tier
 * @property {string} action
 * @property {number} used
 * @property {number|null} limit
 * @property {number|null} remaining — null when unlimited
 * @property {number|null} ratio — used/limit, null when unlimited
 * @property {number|null} percent_used — Math.round(ratio*100), null when unlimited
 * @property {string} reason — short stable code, e.g. "under_threshold" / "unmetered"
 */

/**
 * @typedef {object} QuotaDecisionWarn
 * @property {"warn"} decision
 * @property {string} tier
 * @property {string} action
 * @property {number} used
 * @property {number} limit
 * @property {number} remaining
 * @property {number} ratio
 * @property {number} percent_used
 * @property {string} reason
 * @property {{tier: string, productId: string|null, label: string}|null} upgrade
 * @property {string} message
 */

/**
 * @typedef {object} QuotaDecisionDeny
 * @property {"deny"} decision
 * @property {string} tier
 * @property {string} action
 * @property {number} used
 * @property {number} limit
 * @property {number} remaining — always 0
 * @property {number} ratio — >= 1
 * @property {number} percent_used — >= 100
 * @property {string} reason — "hard_stop" | "free_tier_locked"
 * @property {{tier: string, productId: string|null, label: string}|null} upgrade
 * @property {string} message
 */

/**
 * @typedef {QuotaDecisionAllow|QuotaDecisionWarn|QuotaDecisionDeny} QuotaDecision
 */

/**
 * Pure decision function. Given a tier, action, and current-period
 * counts, return one of three discriminated-union decisions. Never
 * throws on non-USAGE input shape — only validates the contract args
 * (`tier`, `action`); counts is best-effort-coerced.
 *
 * @param {{
 *   tier: string,
 *   action: string,
 *   counts: unknown,
 *   threshold?: number,
 *   nowDelta?: number,
 * }} args
 * @returns {QuotaDecision}
 */
function evaluateQuota(args) {
  if (!args || typeof args !== "object") {
    throw new QuotaEnforcementError("usage", "args must be an object", { exitCode: EXIT.USAGE });
  }
  if (!isValidAction(args.action)) {
    throw new QuotaEnforcementError("usage", `action must be one of ${QUOTA_ACTIONS.join("|")}`, { exitCode: EXIT.USAGE });
  }
  const tier = isKnownTier(args.tier) ? args.tier : "free";
  const limit = quotaForTierAction(tier, args.action);
  const used = pickUsedCount(args.counts, args.action) + (Number.isInteger(args.nowDelta) ? /** @type {number} */ (args.nowDelta) : 0);
  // Unlimited tier → allow without ratio.
  if (limit === null) {
    return {
      decision: "allow",
      tier,
      action: args.action,
      used,
      limit: null,
      remaining: null,
      ratio: null,
      percent_used: null,
      reason: "unmetered",
    };
  }
  // Limit === 0 special-case: free tier "customizes" → always deny with
  // free_tier_locked reason (distinct from hard_stop so UI can word it
  // differently — "this feature requires an upgrade" vs "you've hit
  // your monthly cap").
  if (limit === 0) {
    return {
      decision: "deny",
      tier,
      action: args.action,
      used,
      limit: 0,
      remaining: 0,
      ratio: 1,
      percent_used: 100,
      reason: "free_tier_locked",
      upgrade: buildUpgradeCta(tier),
      message: `This action requires a paid plan — upgrade to use ${args.action}.`,
    };
  }
  const threshold = Number.isFinite(args.threshold) && /** @type {number} */ (args.threshold) > 0 && /** @type {number} */ (args.threshold) < 1
    ? /** @type {number} */ (args.threshold)
    : SOFT_WARN_THRESHOLD;
  const ratio = used / limit;
  const remaining = Math.max(0, limit - used);
  if (ratio >= 1) {
    return {
      decision: "deny",
      tier,
      action: args.action,
      used,
      limit,
      remaining: 0,
      ratio: ratio,
      percent_used: Math.round(ratio * 100),
      reason: "hard_stop",
      upgrade: buildUpgradeCta(tier),
      message: `You've used ${used} of ${limit} ${args.action} this period. Upgrade to keep going.`,
    };
  }
  if (ratio >= threshold) {
    return {
      decision: "warn",
      tier,
      action: args.action,
      used,
      limit,
      remaining,
      ratio,
      percent_used: Math.round(ratio * 100),
      reason: "soft_warn",
      upgrade: buildUpgradeCta(tier),
      message: `You've used ${Math.round(ratio * 100)}% of your monthly ${args.action} quota.`,
    };
  }
  return {
    decision: "allow",
    tier,
    action: args.action,
    used,
    limit,
    remaining,
    ratio,
    percent_used: Math.round(ratio * 100),
    reason: "under_threshold",
  };
}

// ──────────────────────────────────────────────────────────────────
// Gate surface (async, with injected aggregator)
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} GateResponseEnvelope
 * @property {boolean} ok
 * @property {QuotaDecision} decision
 * @property {number} http_status
 * @property {{kind: string, message: string}=} error
 */

/**
 * End-to-end async gate. Fetches counts via the injected `fetchCounts`
 * (typically a thin wrapper around H11.11 `aggregateUsageEvents` +
 * `projectToPortalCounts`) + delegates to `evaluateQuota`. Returns a
 * stable envelope including the HTTP status to send. Never throws.
 *
 * Fail-open behaviour: if the aggregator fails (DB down), the gate
 * returns a `warn` decision (NOT deny) — we don't want to block paying
 * customers due to our own infra blip. The error is reported alongside
 * for observability. Free-tier `customizes` is the exception: when the
 * limit is 0 the decision is always `free_tier_locked` regardless of
 * aggregator availability (no count needed).
 *
 * @param {{
 *   tier: string,
 *   action: string,
 *   subject: string,
 *   fetchCounts: (subject: string) => Promise<{ok: true, counts: {imports?: number, customizes?: number, reharvests?: number}} | {ok: false, error: {code: string, message: string}}>,
 *   threshold?: number,
 *   nowDelta?: number,
 * }} args
 * @returns {Promise<GateResponseEnvelope>}
 */
async function gateRequest(args) {
  if (!args || typeof args !== "object") {
    return wrapError("usage", "args must be an object", "deny");
  }
  if (!isValidAction(args.action)) {
    return wrapError("usage", `action must be one of ${QUOTA_ACTIONS.join("|")}`, "deny");
  }
  if (typeof args.subject !== "string" || args.subject.length === 0) {
    return wrapError("usage", "subject must be a non-empty string", "deny");
  }
  if (typeof args.fetchCounts !== "function") {
    return wrapError("usage", "fetchCounts must be a function", "deny");
  }
  const tier = isKnownTier(args.tier) ? args.tier : "free";
  // Free-tier customizes hard-locks without needing usage counts.
  const limit = quotaForTierAction(tier, args.action);
  if (limit === 0) {
    const decision = evaluateQuota({ tier, action: args.action, counts: {}, threshold: args.threshold, nowDelta: args.nowDelta });
    return {
      ok: false,
      decision,
      http_status: HTTP_STATUS_BY_DECISION[decision.decision],
    };
  }
  // Unlimited tier: short-circuit allow without an aggregator hop.
  if (limit === null) {
    const decision = evaluateQuota({ tier, action: args.action, counts: {}, threshold: args.threshold, nowDelta: args.nowDelta });
    return { ok: true, decision, http_status: HTTP_STATUS_BY_DECISION[decision.decision] };
  }
  // Metered tier: fetch counts.
  let counts = {};
  try {
    const result = await args.fetchCounts(args.subject);
    if (result && result.ok === true && result.counts && typeof result.counts === "object") {
      counts = result.counts;
    } else {
      // Aggregator failed — fail-open with a warn decision.
      const decision = /** @type {QuotaDecisionWarn} */ (evaluateQuota({
        tier,
        action: args.action,
        counts: { [args.action]: Math.floor(limit * SOFT_WARN_THRESHOLD) }, // synthesise the warn-trigger
        threshold: args.threshold,
        nowDelta: args.nowDelta,
      }));
      return {
        ok: true,
        decision,
        http_status: HTTP_STATUS_BY_DECISION[decision.decision],
        error: {
          kind: result && /** @type {*} */ (result).error && /** @type {*} */ (result).error.code
            ? /** @type {*} */ (result).error.code
            : "aggregator_unavailable",
          message: result && /** @type {*} */ (result).error && /** @type {*} */ (result).error.message
            ? /** @type {*} */ (result).error.message
            : "usage aggregator returned no counts",
        },
      };
    }
  } catch (err) {
    const e = /** @type {Error} */ (err);
    const decision = /** @type {QuotaDecisionWarn} */ (evaluateQuota({
      tier,
      action: args.action,
      counts: { [args.action]: Math.floor(limit * SOFT_WARN_THRESHOLD) },
      threshold: args.threshold,
      nowDelta: args.nowDelta,
    }));
    return {
      ok: true,
      decision,
      http_status: HTTP_STATUS_BY_DECISION[decision.decision],
      error: { kind: "fetch_threw", message: e && e.message ? e.message : String(e) },
    };
  }
  const decision = evaluateQuota({ tier, action: args.action, counts, threshold: args.threshold, nowDelta: args.nowDelta });
  return {
    ok: decision.decision !== "deny",
    decision,
    http_status: HTTP_STATUS_BY_DECISION[decision.decision],
  };
}

/**
 * @param {string} kind
 * @param {string} message
 * @param {"allow"|"warn"|"deny"} forceDecision
 * @returns {GateResponseEnvelope}
 */
function wrapError(kind, message, forceDecision) {
  return {
    ok: false,
    decision: {
      decision: forceDecision,
      tier: "free",
      action: "customizes",
      used: 0,
      limit: 0,
      remaining: 0,
      ratio: 1,
      percent_used: 100,
      reason: "input_error",
      upgrade: null,
      message,
    },
    http_status: forceDecision === "deny" ? 400 : HTTP_STATUS_BY_DECISION[forceDecision],
    error: { kind, message },
  };
}

/**
 * Build an HTTP response body shape that matches the H11.10 portal's
 * tone-and-copy contract. Pure. Caller sets the HTTP status from
 * `envelope.http_status` separately. Useful for the future
 * `/api/quota/check` route (NOT shipped this turn).
 *
 * @param {GateResponseEnvelope} envelope
 * @returns {{ok: boolean, decision: string, tier: string, action: string, used: number, limit: number|null, remaining: number|null, percent_used: number|null, message: string, upgrade?: {tier: string, productId: string|null, label: string}|null}}
 */
function buildHttpResponseBody(envelope) {
  if (!envelope || typeof envelope !== "object") {
    throw new QuotaEnforcementError("usage", "envelope must be an object", { exitCode: EXIT.USAGE });
  }
  const d = envelope.decision;
  const body = {
    ok: envelope.ok,
    decision: d.decision,
    tier: d.tier,
    action: d.action,
    used: d.used,
    limit: d.limit,
    remaining: d.remaining,
    percent_used: d.percent_used,
    message: /** @type {*} */ (d).message || (d.decision === "allow" ? "within quota" : "quota status"),
  };
  if (/** @type {*} */ (d).upgrade !== undefined) {
    /** @type {*} */ (body).upgrade = /** @type {*} */ (d).upgrade;
  }
  return body;
}

module.exports = {
  EXIT,
  QUOTA_ACTIONS,
  TIER_QUOTAS,
  SOFT_WARN_THRESHOLD,
  TIER_LADDER,
  TIER_TO_PRODUCT_ID,
  HTTP_STATUS_BY_DECISION,
  UPGRADE_CTA_COPY,
  QuotaEnforcementError,
  isValidAction,
  isKnownTier,
  quotaForTierAction,
  nextUpgradeTier,
  productIdForTier,
  buildUpgradeCta,
  pickUsedCount,
  evaluateQuota,
  gateRequest,
  buildHttpResponseBody,
};
