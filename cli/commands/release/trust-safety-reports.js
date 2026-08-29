// @ts-check
/**
 * [H11.26] trust-safety-reports.js — pure intake + triage + SLA tracking
 * for DMCA / license-violation / harassment reports.
 *
 * Contract (verbatim from masterplan §3 row [H11.26]):
 *   Trust + Safety: handle DMCA + license-violation reports + harassment
 *   reports; SLA 48h response; dedicated channel `security@frootai.io`
 *
 * **Sibling-lib doctrine** (23rd confirmed app): NO edits to H11.21
 * community-pr-validate (142) / H11.22 contributor-reputation (159) /
 * H11.25 revenue-retro-annual (183). The T+S lib is a fresh sibling
 * that wires INTAKE + TRIAGE + SLA timer logic without touching any
 * existing handler.
 *
 * **3 REPORT KINDS** (masterplan literal): dmca / license_violation /
 * harassment. Each has distinct intake fields + a distinct triage
 * decision tree + a uniform 48h SLA clock from received_at.
 *
 * **5 TRIAGE DECISIONS** (discriminated union): acknowledge /
 * needs_more_info / takedown / counter_notice / dismiss. Mirrors
 * H11.6/H11.12/H11.21/H11.22 decision-union doctrine.
 *
 * **48h SLA** pinned by SLA_HOURS = 48 (masterplan literal). The
 * `evaluateReportSla({receivedAt, respondedAt?, now?})` returns a
 * 4-state verdict: within_sla / due_soon (≤6h remaining) / breached /
 * unknown. Mirrors H11.24 churn-trend warn-not-miss family — process
 * gap is WARN, missed-deadline-with-data is MISS.
 *
 * **Reporter contact validation** mirrors H11.21 PII scan: a report
 * MUST carry a reporter contact (email or repo-url owner handle) so
 * the founder can reply; PII is REQUIRED here (unlike the H11.21
 * manifest fields where PII was rejected).
 *
 * **No external deps**: pure JS, no `child_process`, no network. The
 * SECURITY.md sibling doc + the GH issue template are the operator-
 * facing surfaces.
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/trust-safety-reports
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
const SECURITY_CONTACT_EMAIL = "security@frootai.io";
const SLA_HOURS = 48;
const SECURITY_DOC_PATH = "frootai/SECURITY.md";

/** Report kinds (masterplan literal). */
const REPORT_KINDS = Object.freeze(["dmca", "license_violation", "harassment"]);

/** Per-kind display copy. */
const REPORT_KIND_LABEL = Object.freeze({
  dmca: "DMCA takedown",
  license_violation: "License violation",
  harassment: "Harassment / TOS violation",
});

/** Triage decisions (discriminated union). */
const TRIAGE_DECISIONS = Object.freeze([
  "acknowledge",
  "needs_more_info",
  "takedown",
  "counter_notice",
  "dismiss",
]);

/** SLA verdict alphabet. */
const SLA_VERDICTS = Object.freeze(["within_sla", "due_soon", "breached", "unknown"]);

/** Reporter contact kinds. */
const CONTACT_KINDS = Object.freeze(["email", "github_handle", "repo_url"]);

/** Required fields per report kind (minimum-viable triage). */
const REQUIRED_FIELDS = Object.freeze({
  dmca: Object.freeze([
    "reporter_name",
    "reporter_contact",
    "infringing_content_url",
    "original_work_url",
    "good_faith_statement",
    "accuracy_statement",
    "signature",
  ]),
  license_violation: Object.freeze([
    "reporter_name",
    "reporter_contact",
    "play_slug",
    "violation_description",
    "alleged_violated_license",
  ]),
  harassment: Object.freeze([
    "reporter_name",
    "reporter_contact",
    "target_subject",
    "incident_description",
    "incident_location", // repo, PR, discussion, etc.
  ]),
});

/** Severity tiers used by `triageReport()`. */
const SEVERITY_TIERS = Object.freeze(["low", "medium", "high", "critical"]);

/** Mirrors H11.20+ — kept duplicated. */
const FOUNDER_REVIEW_SLA_DAYS = 7;

/** Labels for GitHub issue tracking. */
const LABELS = Object.freeze({
  ACK: "trust-safety:acknowledged",
  NEEDS_INFO: "trust-safety:needs-info",
  TAKEDOWN: "trust-safety:takedown",
  COUNTER_NOTICE: "trust-safety:counter-notice",
  DISMISSED: "trust-safety:dismissed",
  BREACHED: "trust-safety:sla-breached",
});

/** Suspicious-shape patterns that auto-flag a report as `needs_more_info`. */
const VAGUE_DESCRIPTION_MIN_LEN = 40;

class TrustSafetyReportError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "TrustSafetyReportError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

// ──────────────────────────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────────────────────────

/** @param {unknown} s @returns {boolean} */
function isNonEmptyString(s) {
  return typeof s === "string" && s.trim().length > 0;
}

/** Email regex (basic; mirrors H11.14 isValidEmail). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @param {unknown} s @returns {boolean} */
function isValidEmail(s) {
  return typeof s === "string" && s.length <= 254 && EMAIL_RE.test(s);
}

/** @param {unknown} s @returns {boolean} */
function isValidGithubHandle(s) {
  return typeof s === "string" && /^@?[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(s.trim());
}

/** @param {unknown} s @returns {boolean} */
function isValidRepoUrl(s) {
  return typeof s === "string" && /^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/[^/\s]+\/[^/\s]+/i.test(s);
}

/**
 * Classify the reporter contact. Returns the contact kind or null.
 *
 * @param {unknown} contact
 * @returns {"email"|"github_handle"|"repo_url"|null}
 */
function classifyContact(contact) {
  if (!isNonEmptyString(contact)) return null;
  const trimmed = /** @type {string} */ (contact).trim();
  if (isValidEmail(trimmed)) return "email";
  if (isValidRepoUrl(trimmed)) return "repo_url";
  if (isValidGithubHandle(trimmed)) return "github_handle";
  return null;
}

/**
 * Tolerant timestamp parser.
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
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input === "string") {
    const v = Date.parse(input);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────
// Intake validator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} ReportInput
 * @property {string} kind
 * @property {string} [reporter_name]
 * @property {string} [reporter_contact]
 * @property {string} [received_at]
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {object} IntakeResult
 * @property {boolean} ok
 * @property {string|null} kind
 * @property {string|null} reporter_contact_kind
 * @property {ReadonlyArray<{code: string, field?: string, message: string}>} errors
 * @property {ReadonlyArray<{code: string, field?: string, message: string}>} warnings
 * @property {{
 *   reporter_name: string|null,
 *   reporter_contact: string|null,
 *   received_at: string|null,
 *   missing_required: string[],
 * }} summary
 */

/**
 * Validate a Trust+Safety report intake. Pure. NEVER throws.
 *
 * @param {unknown} input
 * @returns {IntakeResult}
 */
function validateReportIntake(input) {
  /** @type {Array<{code: string, field?: string, message: string}>} */
  const errors = [];
  /** @type {Array<{code: string, field?: string, message: string}>} */
  const warnings = [];
  const summary = {
    reporter_name: /** @type {string|null} */ (null),
    reporter_contact: /** @type {string|null} */ (null),
    received_at: /** @type {string|null} */ (null),
    /** @type {string[]} */
    missing_required: [],
  };

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    errors.push({ code: "report_not_object", message: "report must be a JSON object" });
    return finalize(false, null, null, errors, warnings, summary);
  }
  const r = /** @type {Record<string, unknown>} */ (input);

  // Kind
  const kind = typeof r.kind === "string" && REPORT_KINDS.includes(r.kind) ? r.kind : null;
  if (kind == null) {
    errors.push({ code: "invalid_kind", field: "kind", message: `kind must be one of ${REPORT_KINDS.join("|")}` });
  }

  // Reporter contact
  const contactKind = classifyContact(r.reporter_contact);
  if (contactKind == null) {
    errors.push({ code: "invalid_reporter_contact", field: "reporter_contact", message: "reporter_contact must be a valid email, GitHub handle, or repo URL" });
  } else {
    summary.reporter_contact = /** @type {string} */ (r.reporter_contact).trim();
  }

  // Reporter name
  if (isNonEmptyString(r.reporter_name)) {
    summary.reporter_name = /** @type {string} */ (r.reporter_name).trim();
  }

  // Received at
  const receivedMs = parseTimestamp(r.received_at);
  if (receivedMs == null) {
    warnings.push({ code: "missing_received_at", field: "received_at", message: "received_at missing or invalid; SLA clock cannot start" });
  } else {
    summary.received_at = new Date(receivedMs).toISOString();
  }

  // Per-kind required fields
  if (kind != null) {
    const required = REQUIRED_FIELDS[kind];
    const details = (r.details && typeof r.details === "object" && !Array.isArray(r.details))
      ? /** @type {Record<string, unknown>} */ (r.details)
      : {};
    for (const f of required) {
      // reporter_name + reporter_contact live at top level; others in details
      const value = f === "reporter_name" || f === "reporter_contact"
        ? r[f]
        : details[f];
      if (!isNonEmptyString(value)) {
        summary.missing_required.push(f);
        errors.push({ code: "missing_required_field", field: f, message: `required field "${f}" is missing or empty for ${kind} report` });
      }
    }

    // Heuristic: vague description
    if (kind === "license_violation" && typeof details.violation_description === "string" && details.violation_description.trim().length < VAGUE_DESCRIPTION_MIN_LEN) {
      warnings.push({ code: "vague_description", field: "violation_description", message: `violation_description shorter than ${VAGUE_DESCRIPTION_MIN_LEN} chars; founder may request more info` });
    }
    if (kind === "harassment" && typeof details.incident_description === "string" && details.incident_description.trim().length < VAGUE_DESCRIPTION_MIN_LEN) {
      warnings.push({ code: "vague_description", field: "incident_description", message: `incident_description shorter than ${VAGUE_DESCRIPTION_MIN_LEN} chars; founder may request more info` });
    }
  }

  return finalize(errors.length === 0, kind, contactKind, errors, warnings, summary);
}

/**
 * @param {boolean} ok
 * @param {string|null} kind
 * @param {"email"|"github_handle"|"repo_url"|null} contactKind
 * @param {Array<{code: string, field?: string, message: string}>} errors
 * @param {Array<{code: string, field?: string, message: string}>} warnings
 * @param {IntakeResult["summary"]} summary
 * @returns {IntakeResult}
 */
function finalize(ok, kind, contactKind, errors, warnings, summary) {
  return { ok, kind, reporter_contact_kind: contactKind, errors, warnings, summary };
}

// ──────────────────────────────────────────────────────────────────
// Triage decision tree
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} TriageInput
 * @property {IntakeResult} intake
 * @property {boolean} [has_takedown_evidence]
 * @property {boolean} [has_counter_evidence]
 * @property {"low"|"medium"|"high"|"critical"} [severity]
 * @property {boolean} [bad_faith_signals]
 */

/**
 * @typedef {object} TriageResult
 * @property {"acknowledge"|"needs_more_info"|"takedown"|"counter_notice"|"dismiss"} decision
 * @property {string} severity
 * @property {ReadonlyArray<{code: string, message: string}>} reasons
 * @property {ReadonlyArray<string>} labels
 * @property {string} kind
 */

/**
 * Decide the triage action for a validated report. Pure.
 *
 * @param {TriageInput} input
 * @returns {TriageResult}
 */
function triageReport(input) {
  /** @type {Array<{code: string, message: string}>} */
  const reasons = [];
  /** @type {string[]} */
  const labels = [];
  if (!input || typeof input !== "object" || !input.intake || typeof input.intake !== "object") {
    throw new TrustSafetyReportError("usage", "triageReport requires {intake} input", { exitCode: EXIT.USAGE });
  }
  const intake = input.intake;
  const kind = intake.kind ?? "unknown";
  const severity = SEVERITY_TIERS.includes(/** @type {string} */ (input.severity))
    ? /** @type {"low"|"medium"|"high"|"critical"} */ (input.severity)
    : "medium";

  // Intake failed → needs_more_info
  if (!intake.ok) {
    reasons.push({ code: "intake_invalid", message: "report intake failed validation; collect missing fields before triage" });
    labels.push(LABELS.NEEDS_INFO);
    return { decision: "needs_more_info", severity, reasons: Object.freeze(reasons), labels: Object.freeze(labels), kind };
  }

  // Vague-description warnings → needs_more_info
  const vague = intake.warnings.find((w) => w.code === "vague_description");
  if (vague) {
    reasons.push({ code: "vague_description", message: vague.message });
    labels.push(LABELS.NEEDS_INFO);
    return { decision: "needs_more_info", severity, reasons: Object.freeze(reasons), labels: Object.freeze(labels), kind };
  }

  // Bad-faith signals → dismiss
  if (input.bad_faith_signals === true) {
    reasons.push({ code: "bad_faith_signals", message: "reporter shows bad-faith signals; dismiss + log" });
    labels.push(LABELS.DISMISSED);
    return { decision: "dismiss", severity, reasons: Object.freeze(reasons), labels: Object.freeze(labels), kind };
  }

  // Per-kind action paths
  if (kind === "dmca") {
    if (input.has_counter_evidence === true) {
      reasons.push({ code: "counter_evidence_present", message: "alleged-infringer counter-notice present; route to counter_notice review" });
      labels.push(LABELS.COUNTER_NOTICE);
      return { decision: "counter_notice", severity, reasons: Object.freeze(reasons), labels: Object.freeze(labels), kind };
    }
    if (input.has_takedown_evidence === true) {
      reasons.push({ code: "takedown_evidence_present", message: "DMCA evidence + accuracy + signature complete; proceed with takedown" });
      labels.push(LABELS.TAKEDOWN);
      return { decision: "takedown", severity, reasons: Object.freeze(reasons), labels: Object.freeze(labels), kind };
    }
    reasons.push({ code: "acknowledge_dmca", message: "DMCA intake valid; acknowledge receipt within SLA; collect takedown evidence" });
    labels.push(LABELS.ACK);
    return { decision: "acknowledge", severity, reasons: Object.freeze(reasons), labels: Object.freeze(labels), kind };
  }

  if (kind === "license_violation") {
    if (input.has_takedown_evidence === true) {
      reasons.push({ code: "license_violation_confirmed", message: "license violation confirmed; takedown + notify upstream" });
      labels.push(LABELS.TAKEDOWN);
      return { decision: "takedown", severity, reasons: Object.freeze(reasons), labels: Object.freeze(labels), kind };
    }
    reasons.push({ code: "acknowledge_license", message: "license-violation intake valid; acknowledge + investigate" });
    labels.push(LABELS.ACK);
    return { decision: "acknowledge", severity, reasons: Object.freeze(reasons), labels: Object.freeze(labels), kind };
  }

  if (kind === "harassment") {
    if (severity === "high" || severity === "critical") {
      reasons.push({ code: "harassment_severe", message: "harassment severity high/critical; takedown + suspend account" });
      labels.push(LABELS.TAKEDOWN);
      return { decision: "takedown", severity, reasons: Object.freeze(reasons), labels: Object.freeze(labels), kind };
    }
    reasons.push({ code: "acknowledge_harassment", message: "harassment intake valid; acknowledge receipt + collect more context" });
    labels.push(LABELS.ACK);
    return { decision: "acknowledge", severity, reasons: Object.freeze(reasons), labels: Object.freeze(labels), kind };
  }

  // Unknown kind (shouldn't happen — intake guards) — needs_more_info
  reasons.push({ code: "unknown_kind", message: `unknown report kind: ${kind}` });
  labels.push(LABELS.NEEDS_INFO);
  return { decision: "needs_more_info", severity, reasons: Object.freeze(reasons), labels: Object.freeze(labels), kind };
}

// ──────────────────────────────────────────────────────────────────
// SLA timer
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} SlaInput
 * @property {string|number|Date} receivedAt
 * @property {string|number|Date} [respondedAt]
 * @property {string|number|Date} [now]
 * @property {number} [slaHours]
 */

/**
 * @typedef {object} SlaResult
 * @property {"within_sla"|"due_soon"|"breached"|"unknown"} verdict
 * @property {number|null} elapsed_hours
 * @property {number|null} remaining_hours
 * @property {number} sla_hours
 * @property {boolean} responded
 * @property {string|null} due_at
 * @property {boolean} sla_breach_label
 */

/**
 * Evaluate the SLA state for a report. Pure.
 *
 * @param {SlaInput} input
 * @returns {SlaResult}
 */
function evaluateReportSla(input) {
  /** @type {SlaResult} */
  const base = {
    verdict: "unknown",
    elapsed_hours: null,
    remaining_hours: null,
    sla_hours: SLA_HOURS,
    responded: false,
    due_at: null,
    sla_breach_label: false,
  };
  if (!input || typeof input !== "object") return base;
  const slaHours = Number.isFinite(input.slaHours) && /** @type {number} */ (input.slaHours) > 0
    ? Math.floor(/** @type {number} */ (input.slaHours))
    : SLA_HOURS;
  base.sla_hours = slaHours;
  const receivedMs = parseTimestamp(input.receivedAt);
  if (receivedMs == null) return base;
  const dueMs = receivedMs + slaHours * 3600 * 1000;
  base.due_at = new Date(dueMs).toISOString();
  const respondedMs = parseTimestamp(input.respondedAt);
  const nowMs = parseTimestamp(input.now ?? new Date()) ?? Date.now();
  if (respondedMs != null) {
    base.responded = true;
    base.elapsed_hours = Math.round(((respondedMs - receivedMs) / 3600 / 1000) * 100) / 100;
    base.remaining_hours = 0;
    base.verdict = respondedMs <= dueMs ? "within_sla" : "breached";
    base.sla_breach_label = base.verdict === "breached";
    return base;
  }
  base.elapsed_hours = Math.round(((nowMs - receivedMs) / 3600 / 1000) * 100) / 100;
  base.remaining_hours = Math.round(((dueMs - nowMs) / 3600 / 1000) * 100) / 100;
  if (nowMs > dueMs) {
    base.verdict = "breached";
    base.sla_breach_label = true;
  } else if ((dueMs - nowMs) <= 6 * 3600 * 1000) {
    base.verdict = "due_soon";
  } else {
    base.verdict = "within_sla";
  }
  return base;
}

// ──────────────────────────────────────────────────────────────────
// Renderer
// ──────────────────────────────────────────────────────────────────

/**
 * Build a markdown ack comment for the reporter.
 *
 * @param {{intake: IntakeResult, triage: TriageResult, sla: SlaResult}} args
 * @returns {string}
 */
function renderAckComment(args) {
  if (!args || typeof args !== "object" || !args.intake || !args.triage || !args.sla) {
    throw new TrustSafetyReportError("usage", "args.intake, args.triage and args.sla are required", { exitCode: EXIT.USAGE });
  }
  const { intake, triage, sla } = args;
  /** @type {string[]} */
  const out = [];
  out.push(`## Trust + Safety report — receipt acknowledgement`);
  out.push("");
  const decisionEmoji = triage.decision === "takedown" ? "🛑"
    : triage.decision === "counter_notice" ? "↩️"
    : triage.decision === "needs_more_info" ? "📝"
    : triage.decision === "dismiss" ? "🗑️"
    : "✅";
  out.push(`${decisionEmoji} **Decision**: \`${triage.decision}\``);
  out.push(`**Kind**: \`${triage.kind}\` (${REPORT_KIND_LABEL[triage.kind] ?? triage.kind})  `);
  out.push(`**Severity**: \`${triage.severity}\`  `);
  out.push(`**SLA**: \`${sla.verdict}\` — ${sla.responded ? `responded in ${sla.elapsed_hours}h` : `${sla.remaining_hours != null ? `${sla.remaining_hours}h remaining` : "TBD"} (due ${sla.due_at ?? "—"})`}`);
  out.push("");
  if (intake.summary.reporter_name) {
    out.push(`Hi ${intake.summary.reporter_name},`);
    out.push("");
  } else {
    out.push(`Hi there,`);
    out.push("");
  }
  out.push(`Thank you for the report. We have received it and will respond per our ${SLA_HOURS}h SLA via \`${SECURITY_CONTACT_EMAIL}\`.`);
  out.push("");
  if (triage.reasons.length > 0) {
    out.push(`### Triage notes`);
    out.push("");
    for (const r of triage.reasons) {
      out.push(`- **${r.code}**: ${r.message}`);
    }
    out.push("");
  }
  if (intake.summary.missing_required.length > 0) {
    out.push(`### Missing fields (please reply with):`);
    out.push("");
    for (const f of intake.summary.missing_required) {
      out.push(`- \`${f}\``);
    }
    out.push("");
  }
  out.push(`---`);
  out.push("");
  out.push(`_Auto-generated by \`cli/commands/release/trust-safety-reports.js\` ([H11.26]). Contact: \`${SECURITY_CONTACT_EMAIL}\`._`);
  return out.join("\n");
}

module.exports = {
  EXIT,
  SECURITY_CONTACT_EMAIL,
  SLA_HOURS,
  SECURITY_DOC_PATH,
  REPORT_KINDS,
  REPORT_KIND_LABEL,
  TRIAGE_DECISIONS,
  SLA_VERDICTS,
  CONTACT_KINDS,
  REQUIRED_FIELDS,
  SEVERITY_TIERS,
  FOUNDER_REVIEW_SLA_DAYS,
  LABELS,
  VAGUE_DESCRIPTION_MIN_LEN,
  EMAIL_RE,
  TrustSafetyReportError,
  isNonEmptyString,
  isValidEmail,
  isValidGithubHandle,
  isValidRepoUrl,
  classifyContact,
  parseTimestamp,
  validateReportIntake,
  triageReport,
  evaluateReportSla,
  renderAckComment,
};
