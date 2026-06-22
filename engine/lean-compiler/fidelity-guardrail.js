/**
 * [Z1.4] Fidelity Gate — Guardrail-retention checker.
 *
 * Fourth of the five retention classes (see [Z1.1] for the gate's rationale).
 * Guardrails are the SAFETY directives: `MUST` / `MUST NOT` / `NEVER` / `SHALL`
 * / `REQUIRED` / `DO NOT`, plus the security idioms (no secrets, managed
 * identity, never log/commit/expose, rate-limit, sanitize, OWASP, least
 * privilege, default deny). Dropping one is the single WORST fidelity failure a
 * Lean can make — it silently removes a prohibition or a security requirement
 * while every instruction still appears to work. The [Z1.10] adversarial suite
 * targets exactly this: a compressor that drops a guardrail MUST fail the gate.
 *
 * Line-level (like [Z1.1]/[Z1.2]): a guardrail is a line the segmenter's
 * heuristic classifies as GUARDRAIL. GUARDRAIL sits just under TRIGGER in
 * `roleFromText` precedence, so each behaviour line is owned by exactly one
 * checker and the [Z1.6] weighted score never double-counts.
 */

import { roleFromText } from "./segment.js";

/**
 * Canonical comparison form: drop a leading list/number marker, collapse
 * whitespace, strip trailing sentence punctuation, lowercase.
 * @param {string} line
 * @returns {string}
 */
function normalizeGuardrail(line) {
  return line
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/[.;:,]+$/, "")
    .trim()
    .toLowerCase();
}

/** Whole-text search form: collapse all whitespace (incl. newlines) + lowercase. */
function normalizeForSearch(text) {
  return text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").toLowerCase();
}

/**
 * Extract the DISTINCT guardrail units from a document (per-line, de-duplicated).
 * @param {string} text
 * @returns {Set<string>} normalized guardrail units
 */
function extractGuardrails(text) {
  const units = new Set();
  for (const rawLine of String(text).replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (roleFromText(line) === "GUARDRAIL") {
      const norm = normalizeGuardrail(line);
      if (norm) units.add(norm);
    }
  }
  return units;
}

/**
 * Check how many of Full's guardrails survive into Lean.
 *
 * @param {string} full  the Full (readable) source
 * @param {string} lean  the Lean (compressed) candidate
 * @returns {{kind:"guardrail", total:number, retained:number, missing:string[], ratio:number}}
 */
function checkGuardrailRetention(full, lean) {
  const wanted = extractGuardrails(full);
  const haystack = normalizeForSearch(lean);
  const missing = [];
  let retained = 0;

  for (const unit of wanted) {
    if (haystack.includes(unit)) retained += 1;
    else missing.push(unit);
  }

  const total = wanted.size;
  return {
    kind: "guardrail",
    total,
    retained,
    missing,
    ratio: total === 0 ? 1 : retained / total,
  };
}

export { checkGuardrailRetention, extractGuardrails, normalizeGuardrail };
