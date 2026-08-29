// @ts-check
/**
 * [H11.27] privacy-compliance.js — pure plan + validators + renderer for
 * the GDPR / CCPA / SOC2-Type-1 readiness posture.
 *
 * Contract (verbatim from masterplan §3 row [H11.27]):
 *   Privacy compliance: GDPR (DPA + DPIA), CCPA, SOC2 Type 1 prep
 *   (Phase 36 / year 3); legal review at `frootai-core/legal/`
 *
 * **Sibling-lib doctrine** (24th confirmed app): NO edits to H11.21
 * (142) / H11.22 (159) / H11.25 (183) / H11.26 (194). The privacy lib
 * sits orthogonal to the H11.26 Trust+Safety lib — that one handles
 * REPORTER-side intake (DMCA / harassment); this one handles the
 * BUSINESS-side privacy compliance posture (DPA we sign with B2B
 * customers, DPIA for our own data flows, CCPA notice we publish, SOC2
 * Type-1 audit prep).
 *
 * **4 REGIMES** (masterplan literal): `gdpr_dpa` / `gdpr_dpia` /
 * `ccpa` / `soc2_type1`. Each has a distinct required-artifacts list
 * + maps to a doc under `frootai-core/legal/`.
 *
 * **4 READINESS VERDICTS** (discriminated union — mirrors H11.6 /
 * H11.12 / H11.21 / H11.22 / H11.23 / H11.26 family): `ready`
 * (all required artifacts in place) / `partial` (some artifacts
 * present, others missing) / `not_ready` (zero required artifacts) /
 * `unknown` (input missing or malformed).
 *
 * **Phase-36 / year-3 framing**: SOC2 Type-1 is a YEAR-3 deliverable
 * per masterplan ("Phase 36 / year 3"). This lib ships the READINESS
 * CHECKLIST + GAP TRACKER today, not the actual audit. Mirrors the
 * H11.18 execution-scope-boundary doctrine.
 *
 * **Context-dependent PII** (H11.26 doctrine, 1st re-app): GDPR
 * consent records + CCPA opt-out records REQUIRE PII (data subject
 * identity); the H11.21 manifest validator REJECTS PII in technical
 * fields. Lib JSDoc states the direction.
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/privacy-compliance
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
const LEGAL_DIR = "frootai-core/legal";

/** Regime enum (masterplan literal order). */
const REGIMES = Object.freeze(["gdpr_dpa", "gdpr_dpia", "ccpa", "soc2_type1"]);

/** Per-regime display label. */
const REGIME_LABEL = Object.freeze({
  gdpr_dpa: "GDPR — Data Processing Agreement (Article 28)",
  gdpr_dpia: "GDPR — Data Protection Impact Assessment (Article 35)",
  ccpa: "CCPA — Consumer privacy notice + opt-out (California)",
  soc2_type1: "SOC2 Type 1 — Year 3 audit readiness prep",
});

/** Per-regime canonical doc path under LEGAL_DIR. */
const REGIME_DOC_PATH = Object.freeze({
  gdpr_dpa: `${LEGAL_DIR}/gdpr-dpa.md`,
  gdpr_dpia: `${LEGAL_DIR}/gdpr-dpia.md`,
  ccpa: `${LEGAL_DIR}/ccpa-notice.md`,
  soc2_type1: `${LEGAL_DIR}/soc2-type1-readiness.md`,
});

/** Required artifacts per regime. */
const REGIME_REQUIRED_ARTIFACTS = Object.freeze({
  gdpr_dpa: Object.freeze([
    "doc_published",          // DPA template under frootai-core/legal/gdpr-dpa.md
    "data_subcategories",     // table of personal-data fields collected
    "subprocessors_list",     // sub-processor inventory (Stripe, Sentry, etc.)
    "retention_schedule",     // how long we keep each data category
    "lawful_basis_per_field", // GDPR Article 6 basis per data field
    "dpo_or_contact",         // DPO email OR named contact
  ]),
  gdpr_dpia: Object.freeze([
    "doc_published",
    "data_flow_diagram_described", // narrative description of system data flow
    "necessity_proportionality_assessment",
    "risks_to_data_subjects",
    "mitigations",
    "consultation_with_dpo",
  ]),
  ccpa: Object.freeze([
    "doc_published",
    "categories_collected",
    "categories_disclosed_for_business_purpose",
    "do_not_sell_link",       // "Do Not Sell or Share My Personal Information" link literal
    "opt_out_workflow",       // how user opts out + SLA
    "verification_method",    // how we verify a CCPA request
  ]),
  soc2_type1: Object.freeze([
    "doc_published",
    "trust_services_criteria_mapped", // Security / Availability / Processing-Integrity / Confidentiality / Privacy
    "control_inventory",      // ≥ 30 controls per Type-1 norm
    "evidence_collection_plan",
    "auditor_shortlist",
    "target_audit_date",      // ISO date (year-3 per masterplan)
  ]),
});

/** Allowed CCPA opt-out workflow shapes. */
const CCPA_OPT_OUT_KINDS = Object.freeze(["webform", "email", "in_app_toggle"]);

/** Allowed SOC2 trust-services criteria (TSC) per AICPA. */
const SOC2_TSC = Object.freeze([
  "security",
  "availability",
  "processing_integrity",
  "confidentiality",
  "privacy",
]);

/** Allowed lawful-basis values per GDPR Article 6. */
const GDPR_LAWFUL_BASES = Object.freeze([
  "consent",
  "contract",
  "legal_obligation",
  "vital_interests",
  "public_task",
  "legitimate_interests",
]);

/** Mirrors H11.20+/H11.26 — kept duplicated. */
const FOUNDER_REVIEW_SLA_DAYS = 7;

/** Verdict alphabet (4 entries). */
const READINESS_VERDICTS = Object.freeze(["ready", "partial", "not_ready", "unknown"]);

/** Risk severity tiers used by the DPIA section. */
const DPIA_RISK_SEVERITIES = Object.freeze(["low", "medium", "high"]);

/** Minimum control-inventory size for SOC2 Type-1 readiness. */
const SOC2_MIN_CONTROLS = 30;

class PrivacyComplianceError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "PrivacyComplianceError";
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

/** @param {unknown} n @returns {number|null} */
function coerceNonNegativeInt(n) {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/** @param {unknown} input @returns {string|null} ISO date or null */
function parseIsoDate(input) {
  if (typeof input !== "string") return null;
  const t = Date.parse(input);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

/** @param {unknown} v @returns {boolean} */
function isRegime(v) {
  return typeof v === "string" && REGIMES.includes(v);
}

// ──────────────────────────────────────────────────────────────────
// Per-regime evaluators
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} RegimeReadinessInput
 * @property {boolean} [doc_published]
 * @property {Record<string, unknown>} [artifacts] — per-artifact presence flags or values
 */

/**
 * @typedef {object} RegimeReadinessResult
 * @property {string} regime
 * @property {string} label
 * @property {string} doc_path
 * @property {"ready"|"partial"|"not_ready"|"unknown"} verdict
 * @property {ReadonlyArray<string>} required_artifacts
 * @property {ReadonlyArray<string>} present_artifacts
 * @property {ReadonlyArray<string>} missing_artifacts
 * @property {number} completion_pct
 * @property {ReadonlyArray<{code: string, message: string}>} warnings
 */

/**
 * Evaluate readiness of a single regime. Pure.
 *
 * @param {string} regime
 * @param {unknown} input
 * @returns {RegimeReadinessResult}
 */
function evaluateRegimeReadiness(regime, input) {
  if (!isRegime(regime)) {
    throw new PrivacyComplianceError("usage", `unknown regime: ${regime}`, { exitCode: EXIT.USAGE });
  }
  const required = REGIME_REQUIRED_ARTIFACTS[regime];
  /** @type {RegimeReadinessResult} */
  const base = {
    regime,
    label: REGIME_LABEL[regime],
    doc_path: REGIME_DOC_PATH[regime],
    verdict: "not_ready",
    required_artifacts: required,
    present_artifacts: Object.freeze([]),
    missing_artifacts: Object.freeze([...required]),
    completion_pct: 0,
    warnings: Object.freeze([]),
  };
  if (!input || typeof input !== "object") return base;
  const i = /** @type {Record<string, unknown>} */ (input);
  const artifacts = (i.artifacts && typeof i.artifacts === "object" && !Array.isArray(i.artifacts))
    ? /** @type {Record<string, unknown>} */ (i.artifacts)
    : {};
  // doc_published can be top-level boolean OR derived from artifacts.doc_published
  const docPublished = i.doc_published === true || artifacts.doc_published === true;
  /** @type {string[]} */
  const present = [];
  /** @type {string[]} */
  const missing = [];
  /** @type {Array<{code: string, message: string}>} */
  const warnings = [];
  for (const a of required) {
    if (a === "doc_published") {
      if (docPublished) present.push(a); else missing.push(a);
      continue;
    }
    const value = artifacts[a];
    if (value === true) {
      present.push(a);
    } else if (Array.isArray(value) && value.length > 0) {
      present.push(a);
    } else if (isNonEmptyString(value)) {
      present.push(a);
    } else if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0) {
      present.push(a);
    } else {
      missing.push(a);
    }
  }
  const pct = required.length > 0 ? Math.round((present.length / required.length) * 100) : 0;
  /** @type {"ready"|"partial"|"not_ready"|"unknown"} */
  let verdict;
  if (present.length === 0) verdict = "not_ready";
  else if (missing.length === 0) verdict = "ready";
  else verdict = "partial";

  // Per-regime extra warnings
  if (regime === "gdpr_dpa" && Array.isArray(artifacts.lawful_basis_per_field)) {
    for (const row of artifacts.lawful_basis_per_field) {
      if (!row || typeof row !== "object") continue;
      const r = /** @type {Record<string, unknown>} */ (row);
      const basis = typeof r.basis === "string" ? r.basis : null;
      if (basis != null && !GDPR_LAWFUL_BASES.includes(basis)) {
        warnings.push({ code: "invalid_lawful_basis", message: `field "${String(r.field)}" cites unknown lawful basis "${basis}"` });
      }
    }
  }
  if (regime === "ccpa" && typeof artifacts.opt_out_workflow === "string" && !CCPA_OPT_OUT_KINDS.includes(artifacts.opt_out_workflow)) {
    warnings.push({ code: "unknown_opt_out_kind", message: `opt_out_workflow "${artifacts.opt_out_workflow}" not in [${CCPA_OPT_OUT_KINDS.join(", ")}]` });
  }
  if (regime === "soc2_type1") {
    if (Array.isArray(artifacts.trust_services_criteria_mapped)) {
      for (const tsc of artifacts.trust_services_criteria_mapped) {
        if (typeof tsc === "string" && !SOC2_TSC.includes(tsc)) {
          warnings.push({ code: "invalid_tsc", message: `unknown SOC2 TSC: ${tsc}` });
        }
      }
    }
    const controlCount = coerceNonNegativeInt(artifacts.control_inventory_size)
      ?? (Array.isArray(artifacts.control_inventory) ? artifacts.control_inventory.length : null);
    if (controlCount != null && controlCount < SOC2_MIN_CONTROLS) {
      warnings.push({ code: "too_few_controls", message: `control inventory has ${controlCount} entries; SOC2 Type-1 norm is ≥ ${SOC2_MIN_CONTROLS}` });
    }
    if (typeof artifacts.target_audit_date === "string" && parseIsoDate(artifacts.target_audit_date) == null) {
      warnings.push({ code: "invalid_target_audit_date", message: `target_audit_date "${artifacts.target_audit_date}" is not a valid ISO date` });
    }
  }

  return {
    regime,
    label: REGIME_LABEL[regime],
    doc_path: REGIME_DOC_PATH[regime],
    verdict,
    required_artifacts: required,
    present_artifacts: Object.freeze(present),
    missing_artifacts: Object.freeze(missing),
    completion_pct: pct,
    warnings: Object.freeze(warnings),
  };
}

// ──────────────────────────────────────────────────────────────────
// Top-level posture builder
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} PrivacyPostureInput
 * @property {Record<string, RegimeReadinessInput>} [regimes]
 * @property {string} [reviewed_on]
 */

/**
 * @typedef {object} PrivacyPosture
 * @property {string} legal_dir
 * @property {ReadonlyArray<string>} regime_order
 * @property {Record<string, RegimeReadinessResult>} regimes
 * @property {"ready"|"partial"|"not_ready"|"unknown"} overall_verdict
 * @property {{ready: number, partial: number, not_ready: number, unknown: number, total: number}} tally
 * @property {number} avg_completion_pct
 * @property {string|null} reviewed_on
 * @property {string} doctrine_note
 */

/**
 * Build the privacy posture across all 4 regimes. Pure. NEVER throws.
 *
 * @param {PrivacyPostureInput} [input]
 * @returns {PrivacyPosture}
 */
function buildPrivacyPosture(input) {
  const i = input && typeof input === "object" ? input : {};
  const inputRegimes = (i.regimes && typeof i.regimes === "object" && !Array.isArray(i.regimes))
    ? /** @type {Record<string, RegimeReadinessInput>} */ (i.regimes)
    : {};
  /** @type {Record<string, RegimeReadinessResult>} */
  const out = {};
  let pctSum = 0;
  const tally = { ready: 0, partial: 0, not_ready: 0, unknown: 0, total: 0 };
  for (const r of REGIMES) {
    const result = evaluateRegimeReadiness(r, inputRegimes[r] ?? null);
    out[r] = result;
    pctSum += result.completion_pct;
    tally[result.verdict] += 1;
    tally.total += 1;
  }
  const avgPct = Math.round(pctSum / REGIMES.length);
  /** @type {"ready"|"partial"|"not_ready"|"unknown"} */
  let overall;
  if (tally.ready === REGIMES.length) overall = "ready";
  else if (tally.ready + tally.partial === REGIMES.length && tally.partial > 0) overall = "partial";
  else if (tally.not_ready === REGIMES.length) overall = "not_ready";
  else if (tally.ready === 0 && tally.partial === 0 && tally.unknown > 0) overall = "unknown";
  else if (tally.not_ready > 0) overall = "partial"; // mix of partial/not_ready/ready → partial
  else overall = "unknown";

  return {
    legal_dir: LEGAL_DIR,
    regime_order: REGIMES,
    regimes: out,
    overall_verdict: overall,
    tally,
    avg_completion_pct: avgPct,
    reviewed_on: typeof i.reviewed_on === "string" ? parseIsoDate(i.reviewed_on) : null,
    doctrine_note: "GDPR DPA + DPIA + CCPA are pre-launch deliverables; SOC2 Type-1 is a year-3 (Phase 36) milestone per masterplan. The lib ships the READINESS CHECKLIST + GAP TRACKER, not the audit itself (H11.18 execution-scope-boundary doctrine).",
  };
}

// ──────────────────────────────────────────────────────────────────
// Renderer
// ──────────────────────────────────────────────────────────────────

/**
 * Render the posture as a markdown report. Pure.
 *
 * @param {PrivacyPosture} posture
 * @returns {string}
 */
function renderPostureReport(posture) {
  if (!posture || typeof posture !== "object") {
    throw new PrivacyComplianceError("usage", "posture must be an object", { exitCode: EXIT.USAGE });
  }
  /** @type {string[]} */
  const out = [];
  out.push(`# Privacy compliance posture`);
  out.push("");
  out.push(`> **Overall verdict**: ${verdictEmoji(posture.overall_verdict)} \`${posture.overall_verdict}\``);
  out.push(`> **Reviewed on**: ${posture.reviewed_on ?? "TBD"}  `);
  out.push(`> **Avg completion**: ${posture.avg_completion_pct}%  `);
  out.push(`> **Tally**: ${posture.tally.ready} ready · ${posture.tally.partial} partial · ${posture.tally.not_ready} not_ready · ${posture.tally.unknown} unknown`);
  out.push("");
  out.push(`Legal docs live at \`${posture.legal_dir}/\`. Doctrine: ${posture.doctrine_note}`);
  out.push("");
  out.push(`| Regime | Verdict | Completion | Missing | Doc |`);
  out.push(`| --- | --- | --- | --- | --- |`);
  for (const r of posture.regime_order) {
    const rr = posture.regimes[r];
    const missing = rr.missing_artifacts.length > 0 ? rr.missing_artifacts.length : "—";
    out.push(`| ${r} | ${verdictEmoji(rr.verdict)} \`${rr.verdict}\` | ${rr.completion_pct}% | ${missing} | [\`${rr.doc_path}\`](../${rr.doc_path}) |`);
  }
  out.push("");
  for (const r of posture.regime_order) {
    const rr = posture.regimes[r];
    out.push(`## ${rr.label}`);
    out.push("");
    out.push(`**Verdict**: ${verdictEmoji(rr.verdict)} \`${rr.verdict}\` · **Completion**: ${rr.completion_pct}%`);
    out.push("");
    if (rr.present_artifacts.length > 0) {
      out.push(`**Present** (${rr.present_artifacts.length}):`);
      for (const a of rr.present_artifacts) out.push(`- ✅ \`${a}\``);
      out.push("");
    }
    if (rr.missing_artifacts.length > 0) {
      out.push(`**Missing** (${rr.missing_artifacts.length}):`);
      for (const a of rr.missing_artifacts) out.push(`- ❌ \`${a}\``);
      out.push("");
    }
    if (rr.warnings.length > 0) {
      out.push(`**Warnings**:`);
      for (const w of rr.warnings) out.push(`- ⚠️ **${w.code}**: ${w.message}`);
      out.push("");
    }
  }
  out.push(`---`);
  out.push("");
  out.push(`_Auto-generated by \`cli/commands/release/privacy-compliance.js\` ([H11.27])._`);
  return out.join("\n");
}

/** @param {string} v */
function verdictEmoji(v) {
  if (v === "ready") return "✅";
  if (v === "partial") return "⚠️";
  if (v === "not_ready") return "❌";
  return "❓";
}

module.exports = {
  EXIT,
  LEGAL_DIR,
  REGIMES,
  REGIME_LABEL,
  REGIME_DOC_PATH,
  REGIME_REQUIRED_ARTIFACTS,
  CCPA_OPT_OUT_KINDS,
  SOC2_TSC,
  GDPR_LAWFUL_BASES,
  READINESS_VERDICTS,
  DPIA_RISK_SEVERITIES,
  SOC2_MIN_CONTROLS,
  FOUNDER_REVIEW_SLA_DAYS,
  PrivacyComplianceError,
  isNonEmptyString,
  coerceNonNegativeInt,
  parseIsoDate,
  isRegime,
  evaluateRegimeReadiness,
  buildPrivacyPosture,
  renderPostureReport,
  verdictEmoji,
};
