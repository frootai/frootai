// @ts-check
/**
 * [H11.29] founder-runbooks.js — pure registry + validator for the 5
 * founder runbooks the masterplan pins.
 *
 * Contract (verbatim from masterplan §3 row [H11.29]):
 *   Founder runbooks: `frootai-core/runbooks/{billing-outage,cdn-outage,
 *   llm-quota-hit,partner-onboarding,public-incident}.md`
 *
 * **Sibling-lib doctrine** (26th confirmed app): NO edits to H11.18-
 * H11.28 sibling libs.
 *
 * **5 RUNBOOKS** (masterplan literal): billing-outage / cdn-outage /
 * llm-quota-hit / partner-onboarding / public-incident. Each is a
 * markdown doc at `frootai-core/runbooks/<slug>.md` with a frozen
 * required-sections checklist this lib validates against.
 *
 * **6 REQUIRED SECTIONS PER RUNBOOK** (operator playbook shape):
 * Summary / Triggers / Detection / Response steps / Rollback / Post-
 * incident. Each section heading anchored as `## <Title>` in the doc;
 * the validator greps for these literals.
 *
 * **PASS/PARTIAL/MISSING verdict alphabet** (mirrors H11.27 readiness
 * family): pass = all 5 runbooks present with all 6 sections each;
 * partial = some runbooks present-but-incomplete OR some missing
 * entirely; missing = 0 runbooks present.
 *
 * **EXECUTION-SCOPE-BOUNDARY DOCTRINE** (H11.18, reapplied): lib
 * ships structure + validator + 5 starter docs. The actual incident
 * response (paging, customer comms, post-mortem write-up) is founder-
 * operator work, not code.
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/founder-runbooks
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** Sysexits-aligned exit codes. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  DATA_ERR: 65,
  NOINPUT: 66,
  SOFTWARE: 70,
});

/** Masterplan-literal anchor. */
const RUNBOOKS_DIR = "frootai-core/runbooks";

/** 5 runbook slugs (masterplan-row order). */
const RUNBOOK_SLUGS = Object.freeze([
  "billing-outage",
  "cdn-outage",
  "llm-quota-hit",
  "partner-onboarding",
  "public-incident",
]);

/** Per-runbook display label + topic. */
const RUNBOOK_LABEL = Object.freeze({
  "billing-outage": "Billing outage (Stripe webhook stalled / payment processing down)",
  "cdn-outage": "CDN outage (R2 bundle distribution down / stale plays served)",
  "llm-quota-hit": "LLM quota hit (provider rate limit / spend cap tripped)",
  "partner-onboarding": "Partner onboarding (new H11.14 FrootAI Partner deal closed)",
  "public-incident": "Public incident (multi-customer outage requiring public status update)",
});

/** Required H2 section headings every runbook must include (lowercase
 *  + colon-stripped form for tolerant matching). */
const REQUIRED_SECTIONS = Object.freeze([
  "Summary",
  "Triggers",
  "Detection",
  "Response steps",
  "Rollback",
  "Post-incident",
]);

/** Recommended response-time SLAs per runbook (minutes from trigger
 *  to first action). Operator-curated; tracked by the validator. */
const RUNBOOK_RESPONSE_SLA_MINUTES = Object.freeze({
  "billing-outage": 30,
  "cdn-outage": 15,
  "llm-quota-hit": 60,
  "partner-onboarding": 1440, // 24h — partner-onboarding is a workflow not an incident
  "public-incident": 5,
});

/** Verdict alphabet (mirrors H11.27 readiness family). */
const VERDICTS = Object.freeze(["pass", "partial", "missing", "unknown"]);

/** Mirrors H11.20+ — kept duplicated. */
const FOUNDER_REVIEW_SLA_DAYS = 7;

class FounderRunbooksError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "FounderRunbooksError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

// ──────────────────────────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────────────────────────

/** @param {unknown} s @returns {boolean} */
function isRunbookSlug(s) {
  return typeof s === "string" && RUNBOOK_SLUGS.includes(s);
}

/**
 * Build the canonical absolute path to a runbook from a slug + a
 * repo-root path. Pure.
 *
 * @param {string} slug
 * @param {string} repoRoot
 * @returns {string}
 */
function buildRunbookPath(slug, repoRoot) {
  if (!isRunbookSlug(slug)) {
    throw new FounderRunbooksError("usage", `unknown runbook slug: ${slug}`, { exitCode: EXIT.USAGE });
  }
  if (typeof repoRoot !== "string" || repoRoot.length === 0) {
    throw new FounderRunbooksError("usage", "repoRoot required", { exitCode: EXIT.USAGE });
  }
  return path.join(repoRoot, "frootai-core", "runbooks", `${slug}.md`);
}

/**
 * Test whether a markdown body contains the given H2 section heading
 * (tolerant to trailing whitespace, optional trailing colon, prefix
 * `## ` exact match required). Pure.
 *
 * @param {string} body
 * @param {string} heading
 * @returns {boolean}
 */
function bodyHasSection(body, heading) {
  if (typeof body !== "string" || typeof heading !== "string") return false;
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^##\\s+${escaped}\\s*:?\\s*$`, "mi");
  return re.test(body);
}

// ──────────────────────────────────────────────────────────────────
// Per-runbook validator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} RunbookValidation
 * @property {string} slug
 * @property {string} label
 * @property {boolean} exists
 * @property {boolean} ok — exists AND all required sections present
 * @property {ReadonlyArray<string>} present_sections
 * @property {ReadonlyArray<string>} missing_sections
 * @property {number|null} response_sla_minutes
 * @property {number|null} body_length
 */

/**
 * Validate a single runbook against the required-sections checklist.
 * Pure (caller supplies the body string).
 *
 * @param {string} slug
 * @param {string|null} body
 * @returns {RunbookValidation}
 */
function validateRunbookBody(slug, body) {
  if (!isRunbookSlug(slug)) {
    throw new FounderRunbooksError("usage", `unknown runbook slug: ${slug}`, { exitCode: EXIT.USAGE });
  }
  const exists = typeof body === "string" && body.length > 0;
  /** @type {string[]} */
  const present = [];
  /** @type {string[]} */
  const missing = [];
  if (exists) {
    for (const h of REQUIRED_SECTIONS) {
      if (bodyHasSection(/** @type {string} */ (body), h)) present.push(h);
      else missing.push(h);
    }
  } else {
    for (const h of REQUIRED_SECTIONS) missing.push(h);
  }
  return {
    slug,
    label: RUNBOOK_LABEL[slug],
    exists,
    ok: exists && missing.length === 0,
    present_sections: Object.freeze(present),
    missing_sections: Object.freeze(missing),
    response_sla_minutes: RUNBOOK_RESPONSE_SLA_MINUTES[slug] ?? null,
    body_length: exists ? /** @type {string} */ (body).length : null,
  };
}

// ──────────────────────────────────────────────────────────────────
// Top-level posture builder
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} RunbooksPosture
 * @property {string} runbooks_dir
 * @property {ReadonlyArray<string>} runbook_order
 * @property {Record<string, RunbookValidation>} runbooks
 * @property {"pass"|"partial"|"missing"|"unknown"} overall_verdict
 * @property {{ok: number, exists_incomplete: number, missing: number, total: number}} tally
 * @property {number} avg_section_completion_pct
 * @property {string} doctrine_note
 */

/**
 * Build the posture across all 5 runbooks given a `bodies` map of
 * `{slug: bodyString|null}`. Pure. NEVER throws.
 *
 * @param {Record<string, string|null>} [bodies]
 * @returns {RunbooksPosture}
 */
function buildRunbooksPosture(bodies) {
  const b = (bodies && typeof bodies === "object" && !Array.isArray(bodies))
    ? /** @type {Record<string, string|null>} */ (bodies)
    : {};
  /** @type {Record<string, RunbookValidation>} */
  const out = {};
  let okCount = 0;
  let existsIncompleteCount = 0;
  let missingCount = 0;
  let sectionPctSum = 0;
  for (const slug of RUNBOOK_SLUGS) {
    const v = validateRunbookBody(slug, b[slug] ?? null);
    out[slug] = v;
    if (v.ok) {
      okCount += 1;
    } else if (v.exists) {
      existsIncompleteCount += 1;
    } else {
      missingCount += 1;
    }
    const pct = REQUIRED_SECTIONS.length > 0
      ? Math.round((v.present_sections.length / REQUIRED_SECTIONS.length) * 100)
      : 0;
    sectionPctSum += pct;
  }
  const tally = {
    ok: okCount,
    exists_incomplete: existsIncompleteCount,
    missing: missingCount,
    total: RUNBOOK_SLUGS.length,
  };
  /** @type {"pass"|"partial"|"missing"|"unknown"} */
  let overall;
  if (okCount === RUNBOOK_SLUGS.length) overall = "pass";
  else if (okCount === 0 && existsIncompleteCount === 0) overall = "missing";
  else overall = "partial";
  return {
    runbooks_dir: RUNBOOKS_DIR,
    runbook_order: RUNBOOK_SLUGS,
    runbooks: out,
    overall_verdict: overall,
    tally,
    avg_section_completion_pct: Math.round(sectionPctSum / RUNBOOK_SLUGS.length),
    doctrine_note: "Runbooks ship the OPERATOR STRUCTURE (5 starter docs + 6-section template); actual incident handling is founder-operator work per H11.18 execution-scope-boundary doctrine.",
  };
}

// ──────────────────────────────────────────────────────────────────
// Filesystem helper (impure — caller-driven)
// ──────────────────────────────────────────────────────────────────

/**
 * Load all 5 runbooks from disk given a repoRoot. Returns `{bodies}`
 * with null for any missing runbook. Pure-with-injected-fs OR uses
 * node:fs by default.
 *
 * @param {string} repoRoot
 * @param {{readFile?: (p: string) => string|null}} [deps]
 * @returns {Record<string, string|null>}
 */
function loadRunbookBodies(repoRoot, deps) {
  const readFile = (deps && typeof deps.readFile === "function")
    ? deps.readFile
    : (/** @type {string} */ p) => {
        try { return fs.readFileSync(p, "utf8"); }
        catch { return null; }
      };
  /** @type {Record<string, string|null>} */
  const bodies = {};
  for (const slug of RUNBOOK_SLUGS) {
    const p = buildRunbookPath(slug, repoRoot);
    bodies[slug] = readFile(p);
  }
  return bodies;
}

// ──────────────────────────────────────────────────────────────────
// Renderer
// ──────────────────────────────────────────────────────────────────

/**
 * Render the posture as a markdown summary. Pure.
 *
 * @param {RunbooksPosture} posture
 * @returns {string}
 */
function renderPostureSummary(posture) {
  if (!posture || typeof posture !== "object") {
    throw new FounderRunbooksError("usage", "posture must be an object", { exitCode: EXIT.USAGE });
  }
  /** @type {string[]} */
  const out = [];
  out.push(`# Founder runbooks posture`);
  out.push("");
  out.push(`> **Overall verdict**: ${verdictEmoji(posture.overall_verdict)} \`${posture.overall_verdict}\`  `);
  out.push(`> **Tally**: ${posture.tally.ok} ok · ${posture.tally.exists_incomplete} exists-incomplete · ${posture.tally.missing} missing  `);
  out.push(`> **Avg section completion**: ${posture.avg_section_completion_pct}%`);
  out.push("");
  out.push(`Runbooks live at \`${posture.runbooks_dir}/\`. Doctrine: ${posture.doctrine_note}`);
  out.push("");
  out.push(`| Slug | Verdict | Sections | Missing | SLA |`);
  out.push(`| --- | --- | --- | --- | --- |`);
  for (const slug of posture.runbook_order) {
    const v = posture.runbooks[slug];
    const verdict = v.ok ? "pass" : v.exists ? "partial" : "missing";
    const missing = v.missing_sections.length > 0 ? v.missing_sections.length : "—";
    const sla = v.response_sla_minutes != null ? `${v.response_sla_minutes}m` : "—";
    out.push(`| \`${slug}\` | ${verdictEmoji(verdict)} \`${verdict}\` | ${v.present_sections.length}/${REQUIRED_SECTIONS.length} | ${missing} | ${sla} |`);
  }
  out.push("");
  for (const slug of posture.runbook_order) {
    const v = posture.runbooks[slug];
    out.push(`## \`${slug}\``);
    out.push("");
    out.push(`${v.label}`);
    out.push("");
    out.push(`- Exists: ${v.exists ? "✅" : "❌"}`);
    out.push(`- Sections: ${v.present_sections.length}/${REQUIRED_SECTIONS.length}`);
    if (v.missing_sections.length > 0) {
      out.push(`- Missing: ${v.missing_sections.map((s) => `\`${s}\``).join(", ")}`);
    }
    out.push(`- Response SLA: ${v.response_sla_minutes != null ? `${v.response_sla_minutes} minutes` : "—"}`);
    out.push("");
  }
  out.push(`---`);
  out.push("");
  out.push(`_Auto-generated by \`cli/commands/release/founder-runbooks.js\` ([H11.29])._`);
  return out.join("\n");
}

/** @param {string} v */
function verdictEmoji(v) {
  if (v === "pass") return "✅";
  if (v === "partial") return "⚠️";
  if (v === "missing") return "❌";
  return "❓";
}

module.exports = {
  EXIT,
  RUNBOOKS_DIR,
  RUNBOOK_SLUGS,
  RUNBOOK_LABEL,
  REQUIRED_SECTIONS,
  RUNBOOK_RESPONSE_SLA_MINUTES,
  VERDICTS,
  FOUNDER_REVIEW_SLA_DAYS,
  FounderRunbooksError,
  isRunbookSlug,
  buildRunbookPath,
  bodyHasSection,
  validateRunbookBody,
  buildRunbooksPosture,
  loadRunbookBodies,
  renderPostureSummary,
  verdictEmoji,
};
