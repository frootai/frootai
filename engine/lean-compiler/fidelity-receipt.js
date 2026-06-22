/**
 * [Z1.7] Fidelity Gate — Full↔Lean diff receipt.
 *
 * A receipt is the per-primitive, stored record of a Lean build's fidelity: the
 * verdict ([Z1.6]), the token/byte savings, and — crucially — the DIFF: exactly
 * which behaviour units (if any) the Lean dropped, per class. For a passing Lean
 * every `dropped` list is empty; for a rejected one the receipt names precisely
 * what was lost, which is what the [Z1.8] fallback explains and the [Z1.9] audit
 * log appends.
 *
 * Determinism (mirrors the [Z0.9] sidecar contract): NO timestamps, NO host
 * paths, NO randomness — the same Full↔Lean pair yields a byte-identical
 * receipt, so receipts are reproducible and diff-stable in CI. Any wall-clock
 * metadata belongs to the caller (e.g. the [Z1.9] audit line), not the receipt.
 */

import { scoreFidelity } from "./fidelity-score.js";
import { countTokens } from "./tokens.js";

/** Canonical class order — fixes key order so serialized receipts are stable. */
const CLASS_ORDER = ["imperative", "trigger", "param", "guardrail", "code"];

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Build the deterministic fidelity receipt for one Full↔Lean pair.
 *
 * @param {string} full  the Full (readable) source
 * @param {string} lean  the Lean (compressed) candidate
 * @param {{id?:string, type?:string}} [meta]  primitive identity (optional)
 * @param {object} [options]  forwarded to scoreFidelity (weights/threshold/…)
 * @returns {{
 *   id:string|null, type:string|null,
 *   passed:boolean, hardFail:boolean, score:number, threshold:number,
 *   ratios:Record<string,number>,
 *   tokens:{full:number, lean:number, saved:number, savedPct:number},
 *   bytes:{full:number, lean:number, saved:number, savedPct:number},
 *   dropped:Record<string,string[]>,
 *   reasons:string[]
 * }}
 */
function buildReceipt(full, lean, meta = {}, options = {}) {
  const verdict = scoreFidelity(full, lean, options);

  const ratios = {};
  const dropped = {};
  for (const kind of CLASS_ORDER) {
    ratios[kind] = verdict.ratios[kind];
    dropped[kind] = [...verdict.checks[kind].missing];
  }

  const tFull = countTokens(full);
  const tLean = countTokens(lean);
  const bFull = String(full).length;
  const bLean = String(lean).length;

  return {
    id: meta.id ?? null,
    type: meta.type ?? null,
    passed: verdict.passed,
    hardFail: verdict.hardFail,
    score: verdict.score,
    threshold: verdict.threshold,
    ratios,
    tokens: { full: tFull, lean: tLean, saved: tFull - tLean, savedPct: pct(tFull - tLean, tFull) },
    bytes: { full: bFull, lean: bLean, saved: bFull - bLean, savedPct: pct(bFull - bLean, bFull) },
    dropped,
    reasons: [...verdict.reasons],
  };
}

/**
 * Serialize a receipt to a stable, pretty JSON string (newline-terminated).
 * @param {object} receipt
 * @returns {string}
 */
function serializeReceipt(receipt) {
  return JSON.stringify(receipt, null, 2) + "\n";
}

/**
 * Derive the receipt artifact path for a source path:
 *   `skills/foo/SKILL.md` → `skills/foo/SKILL.fidelity.json`
 * @param {string} sourcePath
 * @returns {string}
 */
function receiptPath(sourcePath) {
  const sep = Math.max(sourcePath.lastIndexOf("/"), sourcePath.lastIndexOf("\\"));
  const dot = sourcePath.lastIndexOf(".");
  const base = dot > sep ? sourcePath.slice(0, dot) : sourcePath;
  return base + ".fidelity.json";
}

export { buildReceipt, serializeReceipt, receiptPath, CLASS_ORDER };
