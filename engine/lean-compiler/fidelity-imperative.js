/**
 * [Z1.1] Fidelity Gate — Imperative-retention checker.
 *
 * The Fidelity Gate ([Z1]) verifies the CLAIM that a Lean primitive keeps the
 * same capability as its Full form. Where the [Z0.7] behaviour-preserve guard
 * works BLOCK-to-block inside our own compiler, the gate works on the whole
 * Full↔Lean text pair — so it can vet ANY Lean (including a future
 * semantic/LLM-compressed one whose blocks no longer line up).
 *
 * This checker is the first of five retention classes (imperative / trigger /
 * param / guardrail / code-signature). It answers one question: are the
 * directive verb-phrases — the actual INSTRUCTIONS — still present in the Lean?
 *
 * Class separation: an "imperative" here is a line the segmenter's heuristic
 * classifies as IMPERATIVE, i.e. NOT already a TRIGGER / GUARDRAIL / PARAM
 * (those have precedence and are covered by [Z1.2]–[Z1.4]). Single-sourcing the
 * heuristic via `roleFromText` guarantees every behaviour token is counted by
 * exactly one checker, so the [Z1.6] weighted score never double-counts.
 */

import { roleFromText } from "./segment.js";

/**
 * Canonical form of an imperative line for comparison: drop the list/number
 * marker, collapse whitespace, strip trailing sentence punctuation, lowercase.
 * @param {string} line
 * @returns {string}
 */
function normalizeImperative(line) {
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
 * Extract the DISTINCT imperative units from a document.
 *
 * Per-line classification (not per-block) so a single directive line inside an
 * otherwise-prose paragraph is still captured. De-duplicated: if the same
 * instruction appears twice in Full, retaining it once in Lean is not a drop.
 *
 * @param {string} text
 * @returns {Set<string>} normalized imperative units
 */
function extractImperatives(text) {
  const units = new Set();
  for (const rawLine of String(text).replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (roleFromText(line) === "IMPERATIVE") {
      const norm = normalizeImperative(line);
      if (norm) units.add(norm);
    }
  }
  return units;
}

/**
 * Check how many of Full's imperatives survive into Lean.
 *
 * Retention is satisfied when the normalized imperative appears as a substring
 * of the normalized Lean text — verbatim retention (our compiler preserves the
 * block) passes; a genuinely dropped instruction is reported in `missing`.
 *
 * @param {string} full  the Full (readable) source
 * @param {string} lean  the Lean (compressed) candidate
 * @returns {{kind:"imperative", total:number, retained:number, missing:string[], ratio:number}}
 */
function checkImperativeRetention(full, lean) {
  const wanted = extractImperatives(full);
  const haystack = normalizeForSearch(lean);
  const missing = [];
  let retained = 0;

  for (const unit of wanted) {
    if (haystack.includes(unit)) retained += 1;
    else missing.push(unit);
  }

  const total = wanted.size;
  return {
    kind: "imperative",
    total,
    retained,
    missing,
    ratio: total === 0 ? 1 : retained / total,
  };
}

export { checkImperativeRetention, extractImperatives, normalizeImperative };
