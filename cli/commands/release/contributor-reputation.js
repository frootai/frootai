// @ts-check
/**
 * [H11.22] contributor-reputation.js — spam/abuse guard for community-play PRs.
 *
 * Contract (verbatim from masterplan §3 row [H11.22]):
 *   Spam/abuse guard: contributor reputation gating + manual review queue
 *   for first PR from new contributor
 *
 * **Sibling-lib doctrine** (19th confirmed app): NO edits to H11.21
 * `community-pr-validate.js` (142-case test still green). The auto-validator
 * runs FIRST and enforces the manifest contract; this lib runs in parallel
 * and gates the PR on CONTRIBUTOR-level signals (account age, prior merged
 * PRs, blocklist, rate-limit) — orthogonal to the manifest-content checks.
 *
 * **Decision flow**:
 *   1. classifyReputation({mergedPrCount, accountAgeDays, blocked}) → tier
 *   2. evaluateContributor({contributor, prContext, blocklist?}) → gate result
 *   3. Workflow (`community-plays-spam-guard.yml`) reads PR + contributor
 *      history via gh API → calls evaluateContributor → applies labels +
 *      posts comment + fails check on block.
 *
 * **3 gate decisions** (discriminated union — mirrors H11.6/H11.12/H11.21):
 *   - `auto_validate` — returning/trusted contributor with clean signals; the
 *     H11.21 validator's result is authoritative.
 *   - `manual_review` — first PR from a new contributor OR heuristic-spam
 *     signals tripped; founder review required before merge.
 *   - `block` — explicit blocklist hit OR rate-limit exceeded.
 *
 * **NEVER throws** on bad input — wraps everything in `{ok:false}` shape.
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/contributor-reputation
 */
"use strict";

/** Sysexits-aligned exit codes. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  DATA_ERR: 65,
  SOFTWARE: 70,
});

/** Reputation tier ladder (low → high trust). */
const REPUTATION_TIERS = Object.freeze(["new", "returning", "trusted", "blocked"]);

/** Gate decisions emitted to the workflow. */
const GATING_DECISIONS = Object.freeze(["auto_validate", "manual_review", "block"]);

/** Thresholds for tier classification. */
const MIN_ACCOUNT_AGE_DAYS_TRUSTED = 30;
const MIN_MERGED_PRS_RETURNING = 1;
const MIN_MERGED_PRS_TRUSTED = 3;

/** Rate-limit: max community-play PRs from a NEW contributor per 24h. */
const MAX_PRS_PER_DAY_NEW_CONTRIBUTOR = 1;

/** Blocklist reason vocabulary (pinned for auditability). */
const BLOCKLIST_REASONS = Object.freeze([
  "spam_history",
  "tos_violation",
  "manual_block",
]);

/** Heuristic-spam thresholds. */
const HEURISTIC_MIN_TITLE_LEN = 8;
const HEURISTIC_MAX_FILES = 200;
const HEURISTIC_MIN_BODY_LEN = 40;

/** Suspicious filename patterns — fail-loud on common payload-drop shapes. */
const SUSPICIOUS_FILE_PATTERNS = Object.freeze([
  /\.exe$/i,
  /\.dll$/i,
  /\.so(\.[0-9]+)*$/i,
  /\.dylib$/i,
  /\.(bin|iso|dmg|msi)$/i,
  /node_modules\//,
  /\.env(\.|$)/,
  /id_rsa(\.pub)?$/,
  /\.pem$/i,
]);

/** Labels applied to the PR by the workflow. */
const LABELS = Object.freeze({
  MANUAL_REVIEW: "spam-guard:manual-review",
  BLOCKED: "spam-guard:blocked",
  TRUSTED: "spam-guard:trusted",
  RETURNING: "spam-guard:returning",
  NEW_CONTRIBUTOR: "spam-guard:new-contributor",
});

/** Mirrors H11.21 founder-review SLA (kept duplicated; no runtime coupling). */
const FOUNDER_REVIEW_SLA_DAYS = 7;

class ContributorReputationError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "ContributorReputationError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

// ──────────────────────────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Normalise a contributor login (lowercase, trimmed). Pure.
 *
 * @param {unknown} login
 * @returns {string|null}
 */
function normalizeLogin(login) {
  if (typeof login !== "string") return null;
  const t = login.trim().toLowerCase();
  if (t.length === 0) return null;
  return t;
}

/**
 * Whether a contributor login appears in the blocklist. Pure.
 *
 * @param {unknown} login
 * @param {ReadonlyArray<{login: string, reason?: string}>} [blocklist]
 * @returns {{blocked: boolean, reason?: string}}
 */
function checkBlocklist(login, blocklist) {
  const norm = normalizeLogin(login);
  if (norm == null) return { blocked: false };
  if (!Array.isArray(blocklist)) return { blocked: false };
  for (const entry of blocklist) {
    if (!entry || typeof entry !== "object") continue;
    const entryLogin = normalizeLogin(entry.login);
    if (entryLogin == null) continue;
    if (entryLogin === norm) {
      return {
        blocked: true,
        reason: typeof entry.reason === "string" && BLOCKLIST_REASONS.includes(entry.reason)
          ? entry.reason
          : "manual_block",
      };
    }
  }
  return { blocked: false };
}

/**
 * Classify reputation tier from raw signals. Pure.
 *
 * @param {{mergedPrCount?: number, accountAgeDays?: number, blocked?: boolean}} signals
 * @returns {"new"|"returning"|"trusted"|"blocked"}
 */
function classifyReputation(signals) {
  if (!signals || typeof signals !== "object") return "new";
  if (signals.blocked === true) return "blocked";
  const merged = Number.isFinite(signals.mergedPrCount) && /** @type {number} */ (signals.mergedPrCount) >= 0
    ? Math.floor(/** @type {number} */ (signals.mergedPrCount))
    : 0;
  const age = Number.isFinite(signals.accountAgeDays) && /** @type {number} */ (signals.accountAgeDays) >= 0
    ? Math.floor(/** @type {number} */ (signals.accountAgeDays))
    : 0;
  if (merged >= MIN_MERGED_PRS_TRUSTED && age >= MIN_ACCOUNT_AGE_DAYS_TRUSTED) return "trusted";
  if (merged >= MIN_MERGED_PRS_RETURNING) return "returning";
  return "new";
}

/**
 * Apply heuristic-spam checks against a PR context. Pure.
 *
 * @param {{
 *   title?: string,
 *   body?: string,
 *   files?: ReadonlyArray<string>,
 * }} prContext
 * @returns {{flagged: boolean, reasons: string[]}}
 */
function isHeuristicSpam(prContext) {
  /** @type {string[]} */
  const reasons = [];
  if (!prContext || typeof prContext !== "object") return { flagged: false, reasons };
  const title = typeof prContext.title === "string" ? prContext.title.trim() : "";
  if (title.length < HEURISTIC_MIN_TITLE_LEN) reasons.push("title_too_short");
  const body = typeof prContext.body === "string" ? prContext.body.trim() : "";
  if (body.length < HEURISTIC_MIN_BODY_LEN) reasons.push("body_too_short");
  const files = Array.isArray(prContext.files) ? prContext.files : [];
  if (files.length > HEURISTIC_MAX_FILES) reasons.push("too_many_files");
  for (const f of files) {
    if (typeof f !== "string") continue;
    for (const re of SUSPICIOUS_FILE_PATTERNS) {
      if (re.test(f)) {
        reasons.push(`suspicious_file:${f}`);
        break;
      }
    }
  }
  return { flagged: reasons.length > 0, reasons };
}

/**
 * Whether the new contributor exceeded the per-day PR rate limit. Pure.
 *
 * @param {ReadonlyArray<{opened_at: string|number|Date}>} recentPrs
 * @param {string|number|Date} now
 * @returns {{exceeded: boolean, count: number}}
 */
function exceedsRateLimit(recentPrs, now) {
  if (!Array.isArray(recentPrs)) return { exceeded: false, count: 0 };
  const nowMs = parseTimestamp(now);
  if (nowMs == null) return { exceeded: false, count: 0 };
  const windowStart = nowMs - 24 * 60 * 60 * 1000;
  let count = 0;
  for (const pr of recentPrs) {
    if (!pr || typeof pr !== "object") continue;
    const t = parseTimestamp(pr.opened_at);
    if (t == null) continue;
    if (t >= windowStart && t <= nowMs) count += 1;
  }
  return { exceeded: count > MAX_PRS_PER_DAY_NEW_CONTRIBUTOR, count };
}

/**
 * Tolerant timestamp parser. Pure.
 *
 * @param {unknown} input
 * @returns {number|null}
 */
function parseTimestamp(input) {
  if (input == null) return null;
  if (input instanceof Date) {
    const v = input.getTime();
    return Number.isFinite(v) ? v : null;
  }
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : null;
  }
  if (typeof input === "string") {
    const v = Date.parse(input);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────
// Top-level evaluator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} ContributorSignals
 * @property {string} login
 * @property {number} mergedPrCount — prior merged PRs in this repo
 * @property {number} accountAgeDays
 * @property {ReadonlyArray<{opened_at: string|number|Date}>} [recentPrs]
 */

/**
 * @typedef {object} PrContext
 * @property {string} title
 * @property {string} body
 * @property {ReadonlyArray<string>} files
 */

/**
 * @typedef {object} GateReason
 * @property {string} code
 * @property {string} message
 */

/**
 * @typedef {object} GateResult
 * @property {boolean} ok — true unless evaluation itself errored
 * @property {"auto_validate"|"manual_review"|"block"} decision
 * @property {"new"|"returning"|"trusted"|"blocked"} tier
 * @property {GateReason[]} reasons
 * @property {string[]} labels
 * @property {boolean} requires_founder_review
 * @property {{
 *   login: string|null,
 *   merged_pr_count: number,
 *   account_age_days: number,
 *   recent_pr_count_24h: number,
 *   heuristic_flags: string[],
 *   blocklist_reason: string|null,
 * }} summary
 */

/**
 * Evaluate a contributor + PR + optional blocklist. Pure. NEVER throws.
 *
 * @param {{
 *   contributor: ContributorSignals,
 *   prContext: PrContext,
 *   blocklist?: ReadonlyArray<{login: string, reason?: string}>,
 *   now?: string|number|Date,
 * }} args
 * @returns {GateResult}
 */
function evaluateContributor(args) {
  /** @type {GateReason[]} */
  const reasons = [];
  /** @type {string[]} */
  const labels = [];
  const summary = {
    login: /** @type {string|null} */ (null),
    merged_pr_count: 0,
    account_age_days: 0,
    recent_pr_count_24h: 0,
    /** @type {string[]} */
    heuristic_flags: [],
    blocklist_reason: /** @type {string|null} */ (null),
  };

  if (!args || typeof args !== "object") {
    reasons.push({ code: "bad_input", message: "args must be an object" });
    return finalize("manual_review", "new", reasons, labels, true, summary, false);
  }
  const contributor = args.contributor;
  const prContext = args.prContext;
  const blocklist = args.blocklist;
  const now = args.now != null ? args.now : new Date();

  if (!contributor || typeof contributor !== "object") {
    reasons.push({ code: "missing_contributor", message: "contributor object is required" });
    return finalize("manual_review", "new", reasons, labels, true, summary, false);
  }
  if (!prContext || typeof prContext !== "object") {
    reasons.push({ code: "missing_pr_context", message: "prContext object is required" });
    return finalize("manual_review", "new", reasons, labels, true, summary, false);
  }

  const login = normalizeLogin(contributor.login);
  summary.login = login;
  summary.merged_pr_count = Number.isFinite(contributor.mergedPrCount) && contributor.mergedPrCount >= 0
    ? Math.floor(contributor.mergedPrCount)
    : 0;
  summary.account_age_days = Number.isFinite(contributor.accountAgeDays) && contributor.accountAgeDays >= 0
    ? Math.floor(contributor.accountAgeDays)
    : 0;

  // Blocklist short-circuit
  const block = checkBlocklist(login, blocklist);
  if (block.blocked) {
    summary.blocklist_reason = block.reason ?? "manual_block";
    reasons.push({ code: "blocklisted", message: `contributor is blocklisted: ${summary.blocklist_reason}` });
    labels.push(LABELS.BLOCKED);
    return finalize("block", "blocked", reasons, labels, true, summary, true);
  }

  // Classify reputation
  const tier = classifyReputation({
    mergedPrCount: summary.merged_pr_count,
    accountAgeDays: summary.account_age_days,
    blocked: false,
  });

  // Rate-limit check for new contributors
  if (tier === "new") {
    const rate = exceedsRateLimit(contributor.recentPrs ?? [], now);
    summary.recent_pr_count_24h = rate.count;
    if (rate.exceeded) {
      reasons.push({
        code: "rate_limited",
        message: `new contributor opened ${rate.count} PRs in the last 24h (max ${MAX_PRS_PER_DAY_NEW_CONTRIBUTOR})`,
      });
      labels.push(LABELS.BLOCKED);
      return finalize("block", "blocked", reasons, labels, true, summary, true);
    }
  }

  // Heuristic-spam scan
  const spam = isHeuristicSpam(prContext);
  summary.heuristic_flags = spam.reasons;

  // Tier-based default decision
  if (tier === "trusted") {
    labels.push(LABELS.TRUSTED);
    if (spam.flagged) {
      reasons.push({ code: "heuristic_flags_on_trusted", message: `trusted contributor but spam heuristics tripped: ${spam.reasons.join(", ")}` });
      labels.push(LABELS.MANUAL_REVIEW);
      return finalize("manual_review", tier, reasons, labels, true, summary, true);
    }
    reasons.push({ code: "trusted_contributor", message: "contributor is trusted; auto-validate" });
    return finalize("auto_validate", tier, reasons, labels, false, summary, true);
  }

  if (tier === "returning") {
    labels.push(LABELS.RETURNING);
    if (spam.flagged) {
      reasons.push({ code: "heuristic_flags_on_returning", message: `returning contributor but spam heuristics tripped: ${spam.reasons.join(", ")}` });
      labels.push(LABELS.MANUAL_REVIEW);
      return finalize("manual_review", tier, reasons, labels, true, summary, true);
    }
    reasons.push({ code: "returning_contributor", message: "contributor has prior merged PRs; auto-validate" });
    return finalize("auto_validate", tier, reasons, labels, false, summary, true);
  }

  // tier === "new" → ALWAYS requires manual review (masterplan literal:
  // "manual review queue for first PR from new contributor")
  labels.push(LABELS.NEW_CONTRIBUTOR);
  labels.push(LABELS.MANUAL_REVIEW);
  reasons.push({
    code: "first_pr_new_contributor",
    message: "first PR from new contributor; founder review required before merge",
  });
  if (spam.flagged) {
    reasons.push({ code: "heuristic_flags_on_new", message: `spam heuristics tripped: ${spam.reasons.join(", ")}` });
  }
  return finalize("manual_review", tier, reasons, labels, true, summary, true);
}

/**
 * @param {"auto_validate"|"manual_review"|"block"} decision
 * @param {"new"|"returning"|"trusted"|"blocked"} tier
 * @param {GateReason[]} reasons
 * @param {string[]} labels
 * @param {boolean} requiresFounderReview
 * @param {GateResult["summary"]} summary
 * @param {boolean} ok
 * @returns {GateResult}
 */
function finalize(decision, tier, reasons, labels, requiresFounderReview, summary, ok) {
  return {
    ok,
    decision,
    tier,
    reasons,
    labels,
    requires_founder_review: requiresFounderReview,
    summary,
  };
}

/**
 * Build a markdown comment for the PR explaining the gate decision. Pure.
 *
 * @param {GateResult} result
 * @returns {string}
 */
function renderGateComment(result) {
  if (!result || typeof result !== "object") {
    throw new ContributorReputationError("usage", "result must be an object", { exitCode: EXIT.USAGE });
  }
  /** @type {string[]} */
  const out = [];
  out.push(`## Spam/abuse guard`);
  out.push("");
  const emoji = result.decision === "auto_validate" ? "✅" : result.decision === "manual_review" ? "🛡️" : "⛔";
  const tone = result.decision === "auto_validate" ? "auto-validating"
    : result.decision === "manual_review" ? "queued for founder review"
    : "blocked";
  out.push(`${emoji} **Decision**: \`${result.decision}\` — ${tone}.`);
  out.push("");
  out.push(`- Reputation tier: \`${result.tier}\``);
  out.push(`- Prior merged PRs: ${result.summary.merged_pr_count}`);
  out.push(`- Account age: ${result.summary.account_age_days} days`);
  if (result.summary.recent_pr_count_24h > 0) {
    out.push(`- PRs in last 24h: ${result.summary.recent_pr_count_24h}`);
  }
  if (result.summary.blocklist_reason) {
    out.push(`- Blocklist reason: \`${result.summary.blocklist_reason}\``);
  }
  if (result.summary.heuristic_flags.length > 0) {
    out.push(`- Spam heuristics: ${result.summary.heuristic_flags.map((f) => `\`${f}\``).join(", ")}`);
  }
  out.push("");
  if (result.reasons.length > 0) {
    out.push("### Reasons");
    out.push("");
    for (const r of result.reasons) {
      out.push(`- **${r.code}**: ${r.message}`);
    }
    out.push("");
  }
  if (result.requires_founder_review) {
    out.push(`> Founder review SLA: ${FOUNDER_REVIEW_SLA_DAYS} days from this comment.`);
    out.push("");
  }
  out.push(`_Auto-generated by \`cli/commands/release/contributor-reputation.js\` ([H11.22])._`);
  return out.join("\n");
}

/**
 * Build a queue-entry payload for downstream review tooling (founder
 * dashboard, Slack alert, etc.). Pure.
 *
 * @param {{
 *   pr: { number: number, title: string, url: string, head_sha?: string },
 *   contributor: { login: string },
 *   result: GateResult,
 *   now?: string|number|Date,
 * }} args
 * @returns {{
 *   queued_at: string,
 *   pr_number: number,
 *   pr_url: string,
 *   pr_title: string,
 *   head_sha: string|null,
 *   contributor_login: string,
 *   decision: string,
 *   tier: string,
 *   sla_days: number,
 * }}
 */
function buildReviewQueueEntry(args) {
  if (!args || typeof args !== "object" || !args.pr || !args.contributor || !args.result) {
    throw new ContributorReputationError("usage", "args.pr, args.contributor and args.result are required", { exitCode: EXIT.USAGE });
  }
  const nowMs = parseTimestamp(args.now ?? new Date());
  return {
    queued_at: new Date(nowMs ?? Date.now()).toISOString(),
    pr_number: Number.isInteger(args.pr.number) ? args.pr.number : 0,
    pr_url: typeof args.pr.url === "string" ? args.pr.url : "",
    pr_title: typeof args.pr.title === "string" ? args.pr.title : "",
    head_sha: typeof args.pr.head_sha === "string" && args.pr.head_sha.length > 0 ? args.pr.head_sha : null,
    contributor_login: normalizeLogin(args.contributor.login) ?? "",
    decision: args.result.decision,
    tier: args.result.tier,
    sla_days: FOUNDER_REVIEW_SLA_DAYS,
  };
}

module.exports = {
  EXIT,
  REPUTATION_TIERS,
  GATING_DECISIONS,
  MIN_ACCOUNT_AGE_DAYS_TRUSTED,
  MIN_MERGED_PRS_RETURNING,
  MIN_MERGED_PRS_TRUSTED,
  MAX_PRS_PER_DAY_NEW_CONTRIBUTOR,
  BLOCKLIST_REASONS,
  HEURISTIC_MIN_TITLE_LEN,
  HEURISTIC_MAX_FILES,
  HEURISTIC_MIN_BODY_LEN,
  SUSPICIOUS_FILE_PATTERNS,
  LABELS,
  FOUNDER_REVIEW_SLA_DAYS,
  ContributorReputationError,
  normalizeLogin,
  checkBlocklist,
  classifyReputation,
  isHeuristicSpam,
  exceedsRateLimit,
  parseTimestamp,
  evaluateContributor,
  renderGateComment,
  buildReviewQueueEntry,
};
