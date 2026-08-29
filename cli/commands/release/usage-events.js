// @ts-check
/**
 * [H11.11] usage-events.js — pure usage-events recorder + nightly
 * aggregator for the paid-tier portal display.
 *
 * Contract (verbatim from masterplan §3 row [H11.11]):
 *   Usage tracking: every paid event recorded to `accounts.usage_events`
 *   (Postgres); aggregated nightly for portal display
 *
 * **Two-surface lib** (mirrors H11.7 cron / H11.8 diff-pr / H11.6
 * webhook-classifier doctrine):
 *
 *   1. **Recorder surface** — `buildUsageEvent({subject, action, ...})` +
 *      `buildInsertStatement(event, table?)` build the canonical event
 *      shape + the parameterised SQL INSERT the consumer executes against
 *      Postgres. The lib itself NEVER talks to Postgres (hermetic, pure +
 *      no `pg` dep) — callers inject the executor.
 *
 *   2. **Aggregator surface** — `buildPeriodBounds(now, period?)` resolves
 *      a `{start_iso, end_iso}` for the requested period;
 *      `buildAggregationQuery({subjectIds, period, now, table?})` builds
 *      the parameterised SQL; `aggregateRowsToCounts(rows)` projects the
 *      raw SQL result rows into the H11.10-shaped `Record<subject,
 *      UsageCounts>` view-model. `buildAggregationPlan({...})` is the
 *      full nightly-cron entry point.
 *
 * **`accounts.usage_events` schema** (canonical, locked by
 * `USAGE_EVENTS_TABLE_DDL`):
 *   - id            BIGSERIAL PRIMARY KEY
 *   - subject       TEXT NOT NULL                  -- user/org subject id
 *   - action        TEXT NOT NULL                  -- "import"|"customize"|"reharvest"
 *   - slug          TEXT                           -- play slug (nullable for reharvest)
 *   - variety       TEXT                           -- e.g. "azure"
 *   - tier          TEXT NOT NULL                  -- "free"|"pro"|...
 *   - product_id    TEXT                           -- H11.4 catalog id
 *   - source        TEXT NOT NULL                  -- "cli"|"web"|"mcp"|"system"
 *   - amount_minor  INTEGER NOT NULL DEFAULT 0     -- per-event cost
 *   - currency      TEXT NOT NULL DEFAULT 'eur'
 *   - metadata      JSONB                          -- forward-compat
 *   - request_id    TEXT                           -- dedupe key
 *   - occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   - UNIQUE (subject, request_id)                 -- idempotency
 *   - INDEX (subject, occurred_at DESC)
 *   - INDEX (occurred_at)                          -- aggregator scan
 *
 * **Why this is the right pinning point**: the recorder is invoked from
 * 3 surfaces — (a) `frootai orchard install --as-play` (CLI import),
 * (b) `frootai orchard customize` (CLI customize), (c) the H11.7 cron's
 * per-play re-harvest step. The aggregator runs nightly via a separate
 * GitHub Actions workflow (NOT shipped this turn — built atop this lib in
 * a later sub-phase if needed; for now consumers run `aggregateUsageEvents`
 * synchronously when serving the H11.10 portal). The shape is locked here
 * so all three call sites + the portal speak one canonical event.
 *
 * **Idempotency**: every recorder call requires a `request_id` (defaults
 * to a generated `uuid-like` from injected `{randomBytes}` if absent). The
 * `UNIQUE (subject, request_id)` constraint guarantees Postgres rejects
 * retries — recorder catches that as `{ok: true, duplicate: true}` (NOT an
 * error; retries are SUCCESSFUL no-ops).
 *
 * **No PII**: the event shape carries `subject` (an opaque id), NEVER
 * `email`/`name`/`ip`. Per-event `metadata` is JSON-shaped but the
 * recorder enforces a size cap + key-allowlist (3rd-party-safety).
 *
 * **No third-party deps** (third-party-requires invariant — only `node:`
 * prefixed core modules are used).
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/usage-events
 */
"use strict";

const crypto = require("node:crypto");

/** Sysexits-aligned exit codes (used by the future CLI surface). */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  DATA_ERR: 65,
  NOINPUT: 66,
  UNAVAILABLE: 69,
  SOFTWARE: 70,
  IOERR: 74,
});

/** Three masterplan-literal usage actions matching H11.10's UsageAction enum. */
const USAGE_ACTIONS = Object.freeze(["import", "customize", "reharvest"]);

/** Inverse plural alias map (matches the H11.10 portal's keys). */
const USAGE_ACTION_TO_PORTAL_KEY = Object.freeze({
  import: "imports",
  customize: "customizes",
  reharvest: "reharvests",
});

/** Sources from which events may originate. */
const USAGE_SOURCES = Object.freeze(["cli", "web", "mcp", "system"]);

/** Default Postgres table for the events (the masterplan-literal name). */
const DEFAULT_TABLE = "accounts.usage_events";

/** Period kinds supported by the aggregator. */
const PERIOD_KINDS = Object.freeze(["current_month", "last_30_days", "calendar_day"]);

/** Default currency in minor units (matches H11.4 catalog). */
const DEFAULT_CURRENCY = "eur";

/** Per-event metadata caps. */
const MAX_METADATA_BYTES = 4096;
const MAX_METADATA_KEYS = 32;
/** Allowlist for metadata top-level keys (rejects user-controlled overrides
 *  of audit fields). Forward-compat: extend here, NEVER ad-hoc at call
 *  sites. */
const METADATA_ALLOWED_KEYS = Object.freeze([
  "play_slug", "variety", "owner", "owner_type",
  "cli_version", "platform",
  "trace_id", "session_id",
  "auto", "scheduled",
  "input_token_count", "output_token_count",
  "duration_ms",
]);

/** Canonical DDL — exposed so the consumer's bootstrap script can apply it
 *  via `psql -f` or a programmatic migration. NOT executed by this lib. */
const USAGE_EVENTS_TABLE_DDL = `
CREATE SCHEMA IF NOT EXISTS accounts;

CREATE TABLE IF NOT EXISTS ${DEFAULT_TABLE} (
  id            BIGSERIAL PRIMARY KEY,
  subject       TEXT NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('import','customize','reharvest')),
  slug          TEXT,
  variety       TEXT,
  tier          TEXT NOT NULL,
  product_id    TEXT,
  source        TEXT NOT NULL CHECK (source IN ('cli','web','mcp','system')),
  amount_minor  INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'eur',
  metadata      JSONB,
  request_id    TEXT NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT usage_events_subject_request_id_uk UNIQUE (subject, request_id)
);

CREATE INDEX IF NOT EXISTS usage_events_subject_occurred_at_idx
  ON ${DEFAULT_TABLE} (subject, occurred_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_occurred_at_idx
  ON ${DEFAULT_TABLE} (occurred_at);
`;

class UsageEventsError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "UsageEventsError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

// ──────────────────────────────────────────────────────────────────
// Pure validators
// ──────────────────────────────────────────────────────────────────

/**
 * Whether the action is one of the 3 known usage actions. Pure type-guard.
 *
 * @param {unknown} a
 * @returns {boolean}
 */
function isValidAction(a) {
  return typeof a === "string" && USAGE_ACTIONS.includes(a);
}

/**
 * Whether the source is one of the 4 known sources. Pure type-guard.
 *
 * @param {unknown} s
 * @returns {boolean}
 */
function isValidSource(s) {
  return typeof s === "string" && USAGE_SOURCES.includes(s);
}

/**
 * Whether the subject is a non-empty trimmed string under 256 chars. Pure.
 * Rejects whitespace-only + non-strings.
 *
 * @param {unknown} sub
 * @returns {boolean}
 */
function isValidSubject(sub) {
  if (typeof sub !== "string") return false;
  const trimmed = sub.trim();
  if (trimmed.length < 1 || trimmed.length > 256) return false;
  return true;
}

/**
 * Whether the slug is alphanumeric + `._-` (or null). Mirrors H11.7's
 * isValidPlaySlug (incl. `.` + `..` reject for path-traversal safety).
 *
 * @param {unknown} slug
 * @returns {boolean}
 */
function isValidSlug(slug) {
  if (slug == null) return true; // nullable
  if (typeof slug !== "string") return false;
  if (slug.length < 1 || slug.length > 128) return false;
  if (slug === "." || slug === "..") return false;
  return /^[a-zA-Z0-9._-]+$/.test(slug);
}

/**
 * Whether the tier is a non-empty string. We don't pin the exact enum here
 * because the tier set is owned by A5.1 + the lib should be forward-compat
 * when A5.1 extends the ladder.
 *
 * @param {unknown} t
 * @returns {boolean}
 */
function isValidTier(t) {
  return typeof t === "string" && t.length > 0 && t.length <= 32;
}

/**
 * Sanitize metadata: rejects non-object inputs, applies key allowlist,
 * enforces size + key-count caps. Pure. Returns null when input is null
 * or undefined; throws on cap violations. Caller passes the returned
 * value (or null) to `buildUsageEvent`.
 *
 * @param {unknown} input
 * @returns {Record<string, unknown> | null}
 */
function sanitizeMetadata(input) {
  if (input == null) return null;
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new UsageEventsError("usage", "metadata must be a plain object or null", { exitCode: EXIT.USAGE });
  }
  const src = /** @type {Record<string, unknown>} */ (input);
  /** @type {Record<string, unknown>} */
  const out = {};
  let keyCount = 0;
  for (const k of Object.keys(src)) {
    if (!METADATA_ALLOWED_KEYS.includes(k)) continue;
    keyCount += 1;
    if (keyCount > MAX_METADATA_KEYS) {
      throw new UsageEventsError("usage", `metadata exceeds max key count (${MAX_METADATA_KEYS})`, { exitCode: EXIT.USAGE });
    }
    const v = src[k];
    if (v == null) continue;
    // Only primitives + plain objects/arrays of primitives allowed.
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else {
      // Stringify safely for forward-compat fields like duration_ms wrapped in
      // an object; this is intentionally lossy to keep DB rows small.
      try {
        const s = JSON.stringify(v);
        if (s.length <= 1024) out[k] = s;
      } catch { /* drop */ }
    }
  }
  if (Object.keys(out).length === 0) return null;
  const serialized = JSON.stringify(out);
  if (Buffer.byteLength(serialized, "utf8") > MAX_METADATA_BYTES) {
    throw new UsageEventsError("usage", `metadata exceeds max byte size (${MAX_METADATA_BYTES})`, { exitCode: EXIT.USAGE });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────
// Recorder surface
// ──────────────────────────────────────────────────────────────────

/**
 * Generate a request_id for deduplication. Default 16-byte hex (32 chars,
 * crypto-quality). Pure when randomBytes is injected.
 *
 * @param {{ randomBytes?: (n: number) => Buffer }} [deps]
 * @returns {string}
 */
function generateRequestId(deps) {
  const fn = deps && typeof deps.randomBytes === "function" ? deps.randomBytes : crypto.randomBytes;
  const buf = fn(16);
  return Buffer.from(buf).toString("hex");
}

/**
 * Whether a request_id is shaped correctly (32-char lowercase hex). Pure.
 *
 * @param {unknown} id
 * @returns {boolean}
 */
function isValidRequestId(id) {
  return typeof id === "string" && /^[a-f0-9]{32}$/.test(id);
}

/**
 * @typedef {object} UsageEventInput
 * @property {string} subject — opaque user/org id
 * @property {string} action — "import" | "customize" | "reharvest"
 * @property {string} tier — caller-resolved A5.1 tier
 * @property {string} source — "cli" | "web" | "mcp" | "system"
 * @property {string|null} [slug] — play slug (nullable for reharvest)
 * @property {string|null} [variety] — play variety
 * @property {string|null} [product_id] — H11.4 catalog id
 * @property {number} [amount_minor] — per-event cost (default 0)
 * @property {string} [currency] — default "eur"
 * @property {Record<string, unknown>|null} [metadata]
 * @property {string} [request_id] — defaults to randomBytes-based hex
 * @property {string|Date|number} [occurred_at] — defaults to "NOW()" SQL marker
 */

/**
 * @typedef {object} UsageEvent
 * @property {string} subject
 * @property {string} action
 * @property {string|null} slug
 * @property {string|null} variety
 * @property {string} tier
 * @property {string|null} product_id
 * @property {string} source
 * @property {number} amount_minor
 * @property {string} currency
 * @property {Record<string, unknown>|null} metadata
 * @property {string} request_id
 * @property {string|null} occurred_at — ISO string, or null when caller wants the DB DEFAULT NOW()
 */

/**
 * Build a canonical usage event from caller input. Pure. Validates +
 * normalizes all fields. Throws `UsageEventsError` with `exitCode = USAGE`
 * on bad inputs.
 *
 * @param {UsageEventInput} input
 * @param {{ randomBytes?: (n: number) => Buffer, now?: () => Date }} [deps]
 * @returns {UsageEvent}
 */
function buildUsageEvent(input, deps) {
  if (!input || typeof input !== "object") {
    throw new UsageEventsError("usage", "input must be a plain object", { exitCode: EXIT.USAGE });
  }
  if (!isValidSubject(input.subject)) {
    throw new UsageEventsError("usage", `invalid subject "${input.subject}"`, { exitCode: EXIT.USAGE });
  }
  if (!isValidAction(input.action)) {
    throw new UsageEventsError("usage", `action must be one of ${USAGE_ACTIONS.join("|")}`, { exitCode: EXIT.USAGE });
  }
  if (!isValidSource(input.source)) {
    throw new UsageEventsError("usage", `source must be one of ${USAGE_SOURCES.join("|")}`, { exitCode: EXIT.USAGE });
  }
  if (!isValidTier(input.tier)) {
    throw new UsageEventsError("usage", `invalid tier "${input.tier}"`, { exitCode: EXIT.USAGE });
  }
  if (input.slug != null && !isValidSlug(input.slug)) {
    throw new UsageEventsError("usage", `invalid slug "${input.slug}"`, { exitCode: EXIT.USAGE });
  }
  const amount = input.amount_minor;
  if (amount != null && (!Number.isInteger(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER)) {
    throw new UsageEventsError("usage", `amount_minor must be a non-negative integer`, { exitCode: EXIT.USAGE });
  }
  const currency = (typeof input.currency === "string" && input.currency.length > 0)
    ? input.currency.toLowerCase()
    : DEFAULT_CURRENCY;
  if (!/^[a-z]{3}$/.test(currency)) {
    throw new UsageEventsError("usage", `currency must be a 3-letter code, got "${input.currency}"`, { exitCode: EXIT.USAGE });
  }
  const metadata = sanitizeMetadata(input.metadata);
  const requestId = typeof input.request_id === "string" && isValidRequestId(input.request_id)
    ? input.request_id
    : generateRequestId(deps);
  let occurredAt = null;
  if (input.occurred_at != null) {
    const d = input.occurred_at instanceof Date
      ? input.occurred_at
      : new Date(input.occurred_at);
    if (!Number.isFinite(d.getTime())) {
      throw new UsageEventsError("usage", `invalid occurred_at "${input.occurred_at}"`, { exitCode: EXIT.USAGE });
    }
    occurredAt = d.toISOString();
  }
  return {
    subject: input.subject.trim(),
    action: input.action,
    slug: input.slug == null ? null : input.slug,
    variety: typeof input.variety === "string" && input.variety.length > 0 ? input.variety : null,
    tier: input.tier,
    product_id: typeof input.product_id === "string" && input.product_id.length > 0 ? input.product_id : null,
    source: input.source,
    amount_minor: typeof amount === "number" ? amount : 0,
    currency,
    metadata,
    request_id: requestId,
    occurred_at: occurredAt,
  };
}

/**
 * Build the parameterised SQL INSERT statement + the params array. Pure.
 * Consumer executes `executor(sql, params)` against any `pg`-compatible
 * driver. The `ON CONFLICT DO NOTHING` clause makes retries safe via the
 * UNIQUE (subject, request_id) constraint.
 *
 * @param {UsageEvent} event
 * @param {string} [table]
 * @returns {{ sql: string, params: Array<unknown> }}
 */
function buildInsertStatement(event, table = DEFAULT_TABLE) {
  if (!event || typeof event !== "object") {
    throw new UsageEventsError("usage", "event must be an object", { exitCode: EXIT.USAGE });
  }
  if (!isValidTable(table)) {
    throw new UsageEventsError("usage", `invalid table "${table}"`, { exitCode: EXIT.USAGE });
  }
  const cols = [
    "subject", "action", "slug", "variety", "tier", "product_id",
    "source", "amount_minor", "currency", "metadata", "request_id",
  ];
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const occurredClause = event.occurred_at == null
    ? ""
    : `, occurred_at`;
  const occurredPlaceholder = event.occurred_at == null
    ? ""
    : `, $${cols.length + 1}`;
  const sql = `INSERT INTO ${table} (${cols.join(", ")}${occurredClause}) VALUES (${placeholders}${occurredPlaceholder}) ON CONFLICT ON CONSTRAINT usage_events_subject_request_id_uk DO NOTHING RETURNING id, occurred_at;`;
  /** @type {Array<unknown>} */
  const params = [
    event.subject, event.action, event.slug, event.variety, event.tier, event.product_id,
    event.source, event.amount_minor, event.currency,
    event.metadata == null ? null : JSON.stringify(event.metadata),
    event.request_id,
  ];
  if (event.occurred_at != null) params.push(event.occurred_at);
  return { sql, params };
}

/**
 * Whether a table name is safe for SQL interpolation (schema.table form).
 * Pure. Rejects anything with quotes, semicolons, whitespace, or other
 * SQL-injection vectors.
 *
 * @param {unknown} name
 * @returns {boolean}
 */
function isValidTable(name) {
  if (typeof name !== "string") return false;
  if (name.length < 1 || name.length > 128) return false;
  return /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(name);
}

/**
 * Record a single usage event end-to-end. Pure when `executor` is injected
 * — caller wires a real `pg` `Client.query` for production. Returns
 * `{ok, duplicate, event, id?, error?}` so the caller can distinguish a
 * fresh insert from an idempotent retry without inspecting raw rows.
 *
 * Recorder NEVER throws on executor failure — wraps errors as
 * `{ok: false, error: {code, message}}` so producers (the CLI install
 * handler, the cron) can fire-and-forget the recording without aborting
 * the user-facing action.
 *
 * @param {UsageEventInput} input
 * @param {{ executor: (sql: string, params: Array<unknown>) => Promise<{rows: Array<{id: number, occurred_at: string}>, rowCount: number}>, randomBytes?: (n: number) => Buffer, now?: () => Date, table?: string }} deps
 * @returns {Promise<{ok: true, duplicate: boolean, event: UsageEvent, id: number|null, occurred_at: string|null} | {ok: false, error: {code: string, message: string}, event: UsageEvent|null}>}
 */
async function recordUsageEvent(input, deps) {
  if (!deps || typeof deps.executor !== "function") {
    return { ok: false, error: { code: "missing_executor", message: "deps.executor is required" }, event: null };
  }
  /** @type {UsageEvent} */
  let event;
  try {
    event = buildUsageEvent(input, deps);
  } catch (err) {
    const e = /** @type {Error & {code?: string}} */ (err);
    return { ok: false, error: { code: e.code || "build_failed", message: e.message }, event: null };
  }
  const stmt = buildInsertStatement(event, deps.table);
  try {
    const result = await deps.executor(stmt.sql, stmt.params);
    if (!result || typeof result !== "object") {
      return { ok: false, error: { code: "executor_returned_invalid", message: "executor result has no rows/rowCount" }, event };
    }
    if (result.rowCount === 0) {
      // Conflict on (subject, request_id) — idempotent replay.
      return { ok: true, duplicate: true, event, id: null, occurred_at: null };
    }
    const row = result.rows && result.rows[0] ? result.rows[0] : null;
    return {
      ok: true,
      duplicate: false,
      event,
      id: row && typeof row.id === "number" ? row.id : null,
      occurred_at: row && typeof row.occurred_at === "string" ? row.occurred_at : event.occurred_at,
    };
  } catch (err) {
    const e = /** @type {Error} */ (err);
    return { ok: false, error: { code: "executor_threw", message: e && e.message ? e.message : String(e) }, event };
  }
}

// ──────────────────────────────────────────────────────────────────
// Aggregator surface
// ──────────────────────────────────────────────────────────────────

/**
 * Resolve `{start_iso, end_iso}` for the requested period. Pure.
 *
 * Periods:
 *   - current_month  → first-of-month UTC → first-of-next-month UTC
 *   - last_30_days   → (now - 30d) → now
 *   - calendar_day   → start-of-day UTC → start-of-next-day UTC
 *
 * @param {Date|number|string|null|undefined} now
 * @param {string} [period]
 * @returns {{start_iso: string, end_iso: string, kind: string}}
 */
function buildPeriodBounds(now, period = "current_month") {
  if (!PERIOD_KINDS.includes(period)) {
    throw new UsageEventsError("usage", `period must be one of ${PERIOD_KINDS.join("|")}`, { exitCode: EXIT.USAGE });
  }
  const d = parseDateOrNull(now) || new Date();
  let start;
  let end;
  if (period === "current_month") {
    start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  } else if (period === "last_30_days") {
    end = new Date(d.getTime());
    start = new Date(d.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    // calendar_day
    start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  }
  return { start_iso: start.toISOString(), end_iso: end.toISOString(), kind: period };
}

/**
 * @param {unknown} input
 * @returns {Date|null}
 */
function parseDateOrNull(input) {
  if (input == null) return null;
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input : null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    const d = new Date(input);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof input === "string") {
    const t = input.trim();
    if (t.length === 0) return null;
    const d = new Date(t);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

/**
 * Build the parameterised aggregation SQL for one or more subjects over a
 * period. Pure. Returned shape (per-row): `{subject, action, count}`.
 *
 * Caller passes `params` to the executor; the SQL uses `= ANY($1::text[])`
 * so a single statement handles 1..N subjects (avoids N round-trips).
 *
 * @param {{subjectIds: ReadonlyArray<string>, period?: string, now?: Date|number|string|null, table?: string}} args
 * @returns {{sql: string, params: Array<unknown>, bounds: {start_iso: string, end_iso: string, kind: string}}}
 */
function buildAggregationQuery(args) {
  const o = args || /** @type {*} */ ({});
  if (!Array.isArray(o.subjectIds) || o.subjectIds.length === 0) {
    throw new UsageEventsError("usage", "subjectIds must be a non-empty array", { exitCode: EXIT.USAGE });
  }
  for (const s of o.subjectIds) {
    if (!isValidSubject(s)) {
      throw new UsageEventsError("usage", `invalid subject in subjectIds`, { exitCode: EXIT.USAGE });
    }
  }
  const table = o.table || DEFAULT_TABLE;
  if (!isValidTable(table)) {
    throw new UsageEventsError("usage", `invalid table "${table}"`, { exitCode: EXIT.USAGE });
  }
  const bounds = buildPeriodBounds(o.now, o.period || "current_month");
  const sql = `SELECT subject, action, COUNT(*)::bigint AS count, COALESCE(SUM(amount_minor), 0)::bigint AS amount_sum_minor FROM ${table} WHERE subject = ANY($1::text[]) AND occurred_at >= $2::timestamptz AND occurred_at < $3::timestamptz GROUP BY subject, action ORDER BY subject, action;`;
  /** @type {Array<unknown>} */
  const params = [Array.from(o.subjectIds), bounds.start_iso, bounds.end_iso];
  return { sql, params, bounds };
}

/**
 * @typedef {object} AggregateRow
 * @property {string} subject
 * @property {string} action
 * @property {number|bigint|string} count
 * @property {number|bigint|string} [amount_sum_minor]
 */

/**
 * Project the raw aggregation rows into a per-subject H11.10-compatible
 * `UsageCounts` map. Pure. Unknown actions are dropped (forward-compat —
 * older DBs may have rows we don't understand). Subjects with no events
 * still get a zero-filled entry IFF they're listed in `expectedSubjects`.
 *
 * @param {ReadonlyArray<AggregateRow>} rows
 * @param {{expectedSubjects?: ReadonlyArray<string>}} [opts]
 * @returns {Record<string, {imports: number, customizes: number, reharvests: number, amount_sum_minor: number}>}
 */
function aggregateRowsToCounts(rows, opts) {
  /** @type {Record<string, {imports: number, customizes: number, reharvests: number, amount_sum_minor: number}>} */
  const out = {};
  const initial = () => ({ imports: 0, customizes: 0, reharvests: 0, amount_sum_minor: 0 });
  const expected = opts && Array.isArray(opts.expectedSubjects) ? opts.expectedSubjects : [];
  for (const s of expected) {
    if (typeof s === "string" && s.length > 0 && !out[s]) out[s] = initial();
  }
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const subject = typeof r.subject === "string" ? r.subject : null;
    const action = typeof r.action === "string" ? r.action : null;
    if (!subject || !action) continue;
    const portalKey = USAGE_ACTION_TO_PORTAL_KEY[/** @type {keyof typeof USAGE_ACTION_TO_PORTAL_KEY} */ (action)];
    if (!portalKey) continue;
    if (!out[subject]) out[subject] = initial();
    const count = coerceBigCount(r.count);
    out[subject][portalKey] += count;
    const amount = coerceBigCount(r.amount_sum_minor);
    out[subject].amount_sum_minor += amount;
  }
  return out;
}

/**
 * @param {unknown} v
 * @returns {number}
 */
function coerceBigCount(v) {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (typeof v === "bigint") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  return 0;
}

/**
 * Aggregate usage events end-to-end. Pure when `executor` is injected.
 * Returns `{ok, counts, bounds, errored_subjects, query_sql, query_params}`.
 * Never throws on executor failure — wraps errors so the H11.10 portal
 * can degrade gracefully ("usage unavailable — try again in a moment")
 * instead of 500-ing the entire account page.
 *
 * @param {{subjectIds: ReadonlyArray<string>, period?: string, now?: Date|number|string|null, table?: string, executor: (sql: string, params: Array<unknown>) => Promise<{rows: ReadonlyArray<AggregateRow>}>}} args
 * @returns {Promise<{ok: true, counts: Record<string, {imports: number, customizes: number, reharvests: number, amount_sum_minor: number}>, bounds: {start_iso: string, end_iso: string, kind: string}} | {ok: false, error: {code: string, message: string}, bounds: {start_iso: string, end_iso: string, kind: string}|null}>}
 */
async function aggregateUsageEvents(args) {
  if (!args || typeof args.executor !== "function") {
    return { ok: false, error: { code: "missing_executor", message: "args.executor is required" }, bounds: null };
  }
  /** @type {{sql: string, params: Array<unknown>, bounds: {start_iso: string, end_iso: string, kind: string}}} */
  let q;
  try {
    q = buildAggregationQuery(args);
  } catch (err) {
    const e = /** @type {Error & {code?: string}} */ (err);
    return { ok: false, error: { code: e.code || "build_failed", message: e.message }, bounds: null };
  }
  try {
    const result = await args.executor(q.sql, q.params);
    const rows = result && Array.isArray(result.rows) ? result.rows : [];
    const counts = aggregateRowsToCounts(rows, { expectedSubjects: args.subjectIds });
    return { ok: true, counts, bounds: q.bounds };
  } catch (err) {
    const e = /** @type {Error} */ (err);
    return { ok: false, error: { code: "executor_threw", message: e && e.message ? e.message : String(e) }, bounds: q.bounds };
  }
}

/**
 * Project a single-subject aggregation result into the EXACT H11.10
 * `UsageCounts` shape (`{imports, customizes, reharvests}`) — strips the
 * amount_sum_minor field that the portal doesn't need. Pure.
 *
 * @param {Record<string, {imports: number, customizes: number, reharvests: number}>} counts
 * @param {string} subject
 * @returns {{imports: number, customizes: number, reharvests: number}}
 */
function projectToPortalCounts(counts, subject) {
  const entry = counts && counts[subject] ? counts[subject] : { imports: 0, customizes: 0, reharvests: 0 };
  return {
    imports: typeof entry.imports === "number" ? entry.imports : 0,
    customizes: typeof entry.customizes === "number" ? entry.customizes : 0,
    reharvests: typeof entry.reharvests === "number" ? entry.reharvests : 0,
  };
}

/**
 * Build the nightly-aggregation plan that the future GitHub Actions
 * workflow consumes. Pure. Returns the ordered steps for: (a) connect, (b)
 * run aggregation across all known subjects in batches, (c) optionally
 * write the per-subject counts to a cache table for fast portal reads.
 *
 * Caller (the workflow) executes each step via its own pg client. We
 * intentionally don't dispatch ourselves — same plan-builder doctrine as
 * H11.7 cron + H11.8 diff-pr.
 *
 * @param {{subjectIds: ReadonlyArray<string>, period?: string, now?: Date|number|string|null, table?: string, cacheTable?: string|null, batchSize?: number}} args
 * @returns {{version: 1, total_subjects: number, batch_size: number, period: string, bounds: {start_iso: string, end_iso: string, kind: string}, steps: Array<{step: string, kind: "aggregate"|"write_cache", batch_index: number, subject_ids: ReadonlyArray<string>, sql?: string, params?: Array<unknown>, cache_table?: string|null}>}}
 */
function buildAggregationPlan(args) {
  const o = args || /** @type {*} */ ({});
  if (!Array.isArray(o.subjectIds)) {
    throw new UsageEventsError("usage", "subjectIds must be an array", { exitCode: EXIT.USAGE });
  }
  const batchSize = Number.isInteger(o.batchSize) && o.batchSize > 0 ? Math.min(o.batchSize, 1000) : 200;
  const period = o.period || "current_month";
  const bounds = buildPeriodBounds(o.now, period);
  const table = o.table || DEFAULT_TABLE;
  if (!isValidTable(table)) {
    throw new UsageEventsError("usage", `invalid table "${table}"`, { exitCode: EXIT.USAGE });
  }
  if (o.cacheTable != null && !isValidTable(o.cacheTable)) {
    throw new UsageEventsError("usage", `invalid cacheTable "${o.cacheTable}"`, { exitCode: EXIT.USAGE });
  }
  /** @type {Array<*>} */
  const steps = [];
  for (let i = 0, batch = 0; i < o.subjectIds.length; i += batchSize, batch += 1) {
    const slice = o.subjectIds.slice(i, i + batchSize);
    if (slice.length === 0) continue;
    const q = buildAggregationQuery({ subjectIds: slice, period, now: o.now, table });
    steps.push({
      step: `aggregate-${batch}`,
      kind: "aggregate",
      batch_index: batch,
      subject_ids: slice,
      sql: q.sql,
      params: q.params,
    });
    if (o.cacheTable) {
      steps.push({
        step: `write_cache-${batch}`,
        kind: "write_cache",
        batch_index: batch,
        subject_ids: slice,
        cache_table: o.cacheTable,
      });
    }
  }
  return {
    version: 1,
    total_subjects: o.subjectIds.length,
    batch_size: batchSize,
    period,
    bounds,
    steps,
  };
}

module.exports = {
  EXIT,
  USAGE_ACTIONS,
  USAGE_ACTION_TO_PORTAL_KEY,
  USAGE_SOURCES,
  PERIOD_KINDS,
  DEFAULT_TABLE,
  DEFAULT_CURRENCY,
  MAX_METADATA_BYTES,
  MAX_METADATA_KEYS,
  METADATA_ALLOWED_KEYS,
  USAGE_EVENTS_TABLE_DDL,
  UsageEventsError,
  isValidAction,
  isValidSource,
  isValidSubject,
  isValidSlug,
  isValidTier,
  isValidTable,
  isValidRequestId,
  sanitizeMetadata,
  generateRequestId,
  buildUsageEvent,
  buildInsertStatement,
  recordUsageEvent,
  buildPeriodBounds,
  buildAggregationQuery,
  aggregateRowsToCounts,
  aggregateUsageEvents,
  projectToPortalCounts,
  buildAggregationPlan,
};
