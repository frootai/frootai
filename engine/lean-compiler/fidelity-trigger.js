/**
 * [Z1.2] Fidelity Gate — Trigger-retention checker.
 *
 * Second of the five retention classes (see [Z1.1] for the gate's rationale and
 * the shared checker shape). Triggers are the lines that decide WHEN a primitive
 * fires: `USE FOR` / `DO NOT USE FOR` / `USE WHEN` / `Use when` / `Triggers:` /
 * `applyTo` globs / hook event bindings. Dropping one silently changes the
 * primitive's activation surface even if every instruction survives — so the
 * gate treats these as behaviour tokens that MUST be retained in the Lean.
 *
 * Class separation: a "trigger" is a line the segmenter's heuristic classifies
 * as TRIGGER. TRIGGER has the HIGHEST precedence in `roleFromText`, so a line
 * that is both a trigger and (say) a guardrail is owned here — and counted by
 * exactly this checker, never double-counted by [Z1.4].
 */

import { roleFromText } from "./segment.js";

/**
 * Canonical comparison form: drop a leading list/number marker, collapse
 * whitespace, strip trailing sentence punctuation, lowercase. Glob/path values
 * (`**​/*.ts`) survive because they contain no whitespace and no trailing
 * sentence punctuation.
 * @param {string} line
 * @returns {string}
 */
function normalizeTrigger(line) {
  return line
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/[.;,]+$/, "")
    .trim()
    .toLowerCase();
}

/** Whole-text search form: collapse all whitespace (incl. newlines) + lowercase. */
function normalizeForSearch(text) {
  return text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").toLowerCase();
}

/**
 * Extract the DISTINCT trigger units from a document (per-line, de-duplicated).
 * @param {string} text
 * @returns {Set<string>} normalized trigger units
 */
function extractTriggers(text) {
  const units = new Set();
  for (const rawLine of String(text).replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (roleFromText(line) === "TRIGGER") {
      const norm = normalizeTrigger(line);
      if (norm) units.add(norm);
    }
  }
  return units;
}

/**
 * Check how many of Full's triggers survive into Lean.
 *
 * @param {string} full  the Full (readable) source
 * @param {string} lean  the Lean (compressed) candidate
 * @returns {{kind:"trigger", total:number, retained:number, missing:string[], ratio:number}}
 */
function checkTriggerRetention(full, lean) {
  const wanted = extractTriggers(full);
  const haystack = normalizeForSearch(lean);
  const missing = [];
  let retained = 0;

  for (const unit of wanted) {
    if (haystack.includes(unit)) retained += 1;
    else missing.push(unit);
  }

  const total = wanted.size;
  return {
    kind: "trigger",
    total,
    retained,
    missing,
    ratio: total === 0 ? 1 : retained / total,
  };
}

export { checkTriggerRetention, extractTriggers, normalizeTrigger };
