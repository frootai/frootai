/**
 * [Z1.9] Fidelity Gate — Audit log (JSONL, append-only).
 *
 * Every gate decision ([Z1.8]) is recorded as one line of JSON (JSONL): an
 * append-only, tamper-evident trail of which Leans shipped, which fell back, and
 * why. [Z1.11] reads this log to tune thresholds against the real distribution,
 * and operators read it to spot a primitive whose Lean keeps getting rejected.
 *
 * Security posture (🔐):
 *   - SECRET-FREE: the line stores dropped COUNTS per class, never the dropped
 *     token strings — so a leaked guardrail/param text can never end up in the
 *     log. It carries only ids, the verdict, the score, and savings.
 *   - APPEND-ONLY: `appendAudit` only ever appends; it never rewrites history.
 *
 * Determinism: the line BUILDER (`auditLine`) is pure — the timestamp is
 * injected, so tests are deterministic. Only `appendAudit` reaches for the wall
 * clock, and only as a default the caller can override.
 */

import { appendFileSync } from "node:fs";

/**
 * Build one compact, secret-free audit record from a gate result (or a bare
 * [Z1.7] receipt). The timestamp is injected for determinism.
 *
 * @param {object} source  a [Z1.8] gate result (has `.receipt`) or a [Z1.7] receipt
 * @param {{at?:string|null}} [opts]  `at` = ISO timestamp for this line
 * @returns {{
 *   ts:string|null, id:string|null, type:string|null,
 *   decision:"lean"|"full", fallback:boolean,
 *   passed:boolean, hardFail:boolean, score:number, savedPct:number|null,
 *   dropped:Record<string,number>
 * }}
 */
function auditLine(source, { at = null } = {}) {
  const receipt = source && source.receipt ? source.receipt : source || {};
  const decision = source && source.flavor ? source.flavor : receipt.passed ? "lean" : "full";
  const fallback = source && source.fallback != null ? source.fallback : !receipt.passed;

  const dropped = {};
  for (const [kind, list] of Object.entries(receipt.dropped || {})) {
    if (Array.isArray(list) && list.length > 0) dropped[kind] = list.length;
  }

  return {
    ts: at,
    id: receipt.id ?? null,
    type: receipt.type ?? null,
    decision,
    fallback,
    passed: Boolean(receipt.passed),
    hardFail: Boolean(receipt.hardFail),
    score: receipt.score ?? null,
    savedPct: receipt.tokens ? receipt.tokens.savedPct : null,
    dropped,
  };
}

/**
 * Serialize one audit record to a single JSONL line (one object, newline-
 * terminated, NOT pretty-printed).
 * @param {object} line
 * @returns {string}
 */
function serializeAuditLine(line) {
  return JSON.stringify(line) + "\n";
}

/**
 * Append one gate decision to a JSONL audit log (append-only). Defaults the
 * timestamp to now, which the caller may override for replay/testing.
 *
 * @param {string} path  the JSONL log file path
 * @param {object} source  a gate result or receipt
 * @param {{at?:string}} [opts]
 * @returns {object} the audit line that was written
 */
function appendAudit(path, source, { at = new Date().toISOString() } = {}) {
  const line = auditLine(source, { at });
  appendFileSync(path, serializeAuditLine(line), "utf8");
  return line;
}

/**
 * Parse a JSONL audit log body into an array of records (blank lines skipped).
 * @param {string} text
 * @returns {object[]}
 */
function parseAuditLog(text) {
  return String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

export { auditLine, serializeAuditLine, appendAudit, parseAuditLog };
