/**
 * [Z10.1] Enterprise — Audit log per Lean FETCH (who / what / fidelity).
 *
 * Where [Z1.9] (`fidelity-audit.js`) records each BUILD-time gate decision, this
 * module records each SERVE-time FETCH: every time a tenant/principal pulls a
 * primitive's Lean (or falls back to Full), one append-only JSONL line captures
 *   - WHO  : the `actor` (tenant / principal / org id) — the governance dimension
 *            the build-time audit has no notion of,
 *   - WHAT : the primitive `id` (and `type`),
 *   - FIDELITY : the gate score the served variant carried, plus the savings.
 *
 * Operators read this trail to answer enterprise questions the build log can't:
 * which tenant fetched which primitive, at what fidelity, over which channel —
 * and whether any tenant is being served a fallback (Full) more than it should.
 *
 * Security posture (🔐) — identical contract to [Z1.9]:
 *   - SECRET-FREE: the line is assembled from a FIXED ALLOW-LIST of fields. Even
 *     if a caller hands us a fat event object carrying dropped guardrail/param
 *     STRINGS (or any other content), only ids / scores / counts are serialized
 *     — content can never reach the log.
 *   - APPEND-ONLY: `appendFetchAudit` only ever appends; it never rewrites.
 *
 * Determinism: the line BUILDER (`fetchAuditLine`) is pure — the timestamp is
 * injected, so tests are byte-stable. Only `appendFetchAudit` reaches for the
 * wall clock, and only as a default the caller can override.
 */

import { appendFileSync } from "node:fs";

/** Variants a fetch can serve. Anything else is normalized to "full". */
const VARIANTS = new Set(["lean", "full"]);

/** Coerce to a finite number, else null — keeps scores secret-free and clean. */
const numOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Coerce to a trimmed non-empty string, else null. */
const strOrNull = (v) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

/**
 * Build one compact, secret-free fetch-audit record. The timestamp is injected
 * for determinism. Only the named safe fields are read from `event`; any extra
 * keys (including dropped content strings) are ignored by construction.
 *
 * @param {{
 *   actor:string, id:string, type?:string,
 *   variant?:"lean"|"full", fidelity?:number, savedPct?:number,
 *   channel?:string, fallback?:boolean
 * }} event
 * @param {{at?:string|null}} [opts]  `at` = ISO timestamp for this line
 * @returns {{
 *   ts:string|null, actor:string, id:string, type:string|null,
 *   variant:"lean"|"full", fidelity:number|null, savedPct:number|null,
 *   channel:string, fallback:boolean
 * }}
 */
function fetchAuditLine(event = {}, { at = null } = {}) {
  const actor = strOrNull(event.actor);
  if (actor === null) {
    throw new TypeError("fetchAuditLine: `actor` (who) is required — a fetch audit line must name the principal/tenant.");
  }
  const id = strOrNull(event.id);
  if (id === null) {
    throw new TypeError("fetchAuditLine: `id` (what) is required — a fetch audit line must name the primitive fetched.");
  }

  const variant = VARIANTS.has(event.variant) ? event.variant : "full";

  return {
    ts: at,
    actor,
    id,
    type: strOrNull(event.type),
    variant,
    fidelity: numOrNull(event.fidelity),
    savedPct: numOrNull(event.savedPct),
    channel: strOrNull(event.channel) ?? "unknown",
    fallback: event.fallback != null ? Boolean(event.fallback) : variant !== "lean",
  };
}

/**
 * Serialize one fetch-audit record to a single newline-terminated JSON line
 * (one object, NOT pretty-printed).
 * @param {object} line
 * @returns {string}
 */
function serializeFetchAuditLine(line) {
  return JSON.stringify(line) + "\n";
}

/**
 * Append one Lean fetch to a JSONL audit log (append-only). Defaults the
 * timestamp to now, which the caller may override for replay/testing.
 *
 * @param {string} path  the JSONL log file path
 * @param {object} event  the fetch event (see `fetchAuditLine`)
 * @param {{at?:string}} [opts]
 * @returns {object} the audit line that was written
 */
function appendFetchAudit(path, event, { at = new Date().toISOString() } = {}) {
  const line = fetchAuditLine(event, { at });
  appendFileSync(path, serializeFetchAuditLine(line), "utf8");
  return line;
}

/**
 * Parse a JSONL fetch-audit log body into an array of records (blank lines
 * skipped).
 * @param {string} text
 * @returns {object[]}
 */
function parseFetchAuditLog(text) {
  return String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

export { fetchAuditLine, serializeFetchAuditLine, appendFetchAudit, parseFetchAuditLog };
