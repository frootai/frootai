// @ts-check
/**
 * A5.18 — `frootai telemetry export` CLI client.
 *
 * Pulls the user's own telemetry events from /api/telemetry/export and writes
 * them to a local file. GDPR Article 20 (data portability) compliance.
 *
 * Flow:
 *   1. Read CLI token from token-store (must be signed in).
 *   2. Read anon-id from local file (proves ownership of the anon_id).
 *   3. GET /api/telemetry/export?anon_id=<id>&confirm=yes
 *      with Authorization: Bearer <token>.
 *   4. Validate response shape (v, anon_id matches, events array).
 *   5. Write to ~/.frootai/telemetry-export-<ISO_TS>.jsonl
 *      (one event per line — easy to grep / import / diff).
 *   6. Return { ok, path, event_count, range, schema_id }.
 *
 * Doctrine:
 *   - NEVER throws on network errors — returns { ok: false, error_code, hint }.
 *   - Atomic write (tmp + rename).
 *   - Default 10-second HTTP timeout (export can be larger than other endpoints).
 *   - Output file mode 0o600 on POSIX (same as token-store) — contains usage
 *     data that the user might consider sensitive even though it's pseudonymous.
 */
"use strict";

const path = require("path");
const fs = require("fs");
const fsP = require("fs").promises;
const os = require("os");

const { readToken, DEFAULT_TOKEN_PATH } = require("../auth/token-store");
const { readOrCreateAnonId, DEFAULT_ANON_ID_PATH } = require("./anon-id");

const DEFAULT_EXPORT_ENDPOINT = "https://frootai.dev/api/telemetry/export";
const EXPORT_FETCH_TIMEOUT_MS = 10_000;
const EXPORT_RESPONSE_MAX_BYTES = 50 * 1024 * 1024;   // 50 MiB (matches server cap × ~1 KiB/event)
const EXPORT_FILE_DIR = path.join(os.homedir(), ".frootai");
const EXPORT_FILENAME_PREFIX = "telemetry-export-";

// Error codes the CLI dispatcher maps to exit-code 1.
const ERR_NOT_SIGNED_IN = "not_signed_in";
const ERR_NO_ANON_ID = "no_anon_id";
const ERR_FETCH_FAILED = "fetch_failed";
const ERR_HTTP_ERROR = "http_error";
const ERR_BAD_RESPONSE_SHAPE = "bad_response_shape";
const ERR_WRITE_FAILED = "write_failed";

/**
 * Pure: build the export URL with required query params.
 *
 * @param {string} base
 * @param {string} anonId
 * @param {object} [opts]
 * @returns {string}
 */
function buildExportUrl(base, anonId, opts) {
  const o = opts || {};
  const params = new URLSearchParams();
  params.set("anon_id", anonId);
  params.set("confirm", "yes");
  if (o.start) params.set("start", o.start);
  if (o.end) params.set("end", o.end);
  return `${base.replace(/\/+$/, "")}?${params.toString()}`;
}

/**
 * Pure: build the local export filename (ISO timestamp, colons replaced).
 *
 * @param {string} isoTs
 * @returns {string}
 */
function buildExportFilename(isoTs) {
  const safe = String(isoTs).replace(/[:.]/g, "-");
  return `${EXPORT_FILENAME_PREFIX}${safe}.jsonl`;
}

/**
 * Pure: validate response shape from /api/telemetry/export.
 *
 * @param {unknown} body
 * @param {string} expectedAnonId
 * @returns {{ok: true, body: object} | {ok: false, reason: string}}
 */
function validateExportResponse(body, expectedAnonId) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, reason: "not_an_object" };
  }
  const b = /** @type {any} */(body);
  if (typeof b.v !== "number") return { ok: false, reason: "missing_v" };
  if (typeof b.anon_id !== "string") return { ok: false, reason: "missing_anon_id" };
  if (b.anon_id !== expectedAnonId) return { ok: false, reason: "anon_id_mismatch" };
  if (!Array.isArray(b.events)) return { ok: false, reason: "events_not_array" };
  if (typeof b.event_count !== "number") return { ok: false, reason: "missing_event_count" };
  if (b.event_count !== b.events.length) return { ok: false, reason: "event_count_mismatch" };
  return { ok: true, body: b };
}

/**
 * Pure: serialize events as JSONL (one JSON object per line).
 *
 * @param {Array<object>} events
 * @returns {string}
 */
function serializeJsonl(events) {
  if (!Array.isArray(events) || events.length === 0) return "";
  return events.map((e) => JSON.stringify(e)).join("\n") + "\n";
}

/**
 * Run the export flow.
 *
 * @param {object} [opts]
 * @param {string} [opts.endpoint]
 * @param {string} [opts.tokenPath]
 * @param {string} [opts.anonIdPath]
 * @param {string} [opts.outDir]
 * @param {string} [opts.start]
 * @param {string} [opts.end]
 * @param {number} [opts.timeoutMs]
 * @param {Function} [opts.fetchImpl]
 * @param {Function} [opts.readToken]
 * @param {Function} [opts.readOrCreateAnonId]
 * @param {Function} [opts.now]
 * @returns {Promise<{ok: boolean, path?: string, event_count?: number, range?: object, schema_id?: string, error_code?: string, hint?: string}>}
 */
async function runExport(opts) {
  const o = opts || {};
  const endpoint = o.endpoint || DEFAULT_EXPORT_ENDPOINT;
  const tokenPath = o.tokenPath || DEFAULT_TOKEN_PATH;
  const anonIdPath = o.anonIdPath || DEFAULT_ANON_ID_PATH;
  const outDir = o.outDir || EXPORT_FILE_DIR;
  const timeoutMs = o.timeoutMs || EXPORT_FETCH_TIMEOUT_MS;
  const fetchImpl = o.fetchImpl || globalThis.fetch;
  const _readToken = o.readToken || readToken;
  const _readAnonId = o.readOrCreateAnonId || readOrCreateAnonId;
  const now = o.now || (() => Date.now());

  // 1. Token
  let token;
  try {
    const tok = await _readToken({ tokenPath });
    token = tok && tok.access_token ? tok.access_token : null;
  } catch { token = null; }
  if (!token) {
    return {
      ok: false,
      error_code: ERR_NOT_SIGNED_IN,
      hint: "Run `frootai login` first.",
    };
  }

  // 2. Anon-id
  let anonId;
  try {
    anonId = await _readAnonId({ anonIdPath });
  } catch { anonId = null; }
  if (!anonId) {
    return {
      ok: false,
      error_code: ERR_NO_ANON_ID,
      hint: "No anonymous id on this machine. Run `frootai telemetry on` first.",
    };
  }

  // 3. Fetch
  if (typeof fetchImpl !== "function") {
    return { ok: false, error_code: ERR_FETCH_FAILED, hint: "fetch is not available; upgrade to Node 18+." };
  }
  const url = buildExportUrl(endpoint, anonId, { start: o.start, end: o.end });
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let resp;
  try {
    resp = await fetchImpl(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
      signal: controller ? controller.signal : undefined,
    });
  } catch (err) {
    if (timer) clearTimeout(timer);
    return {
      ok: false,
      error_code: ERR_FETCH_FAILED,
      hint: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (timer) clearTimeout(timer);

  if (!resp || typeof resp.status !== "number") {
    return { ok: false, error_code: ERR_FETCH_FAILED, hint: "no response" };
  }
  if (resp.status !== 200) {
    let bodyText = "";
    try { bodyText = await resp.text(); } catch { /* ignore */ }
    return {
      ok: false,
      error_code: ERR_HTTP_ERROR,
      hint: `HTTP ${resp.status}: ${bodyText.slice(0, 200)}`,
    };
  }

  // 4. Validate
  let body;
  try {
    const text = await resp.text();
    if (text.length > EXPORT_RESPONSE_MAX_BYTES) {
      return { ok: false, error_code: ERR_BAD_RESPONSE_SHAPE, hint: "response exceeded size cap" };
    }
    body = JSON.parse(text);
  } catch (err) {
    return { ok: false, error_code: ERR_BAD_RESPONSE_SHAPE, hint: `parse error: ${err instanceof Error ? err.message : String(err)}` };
  }
  const v = validateExportResponse(body, anonId);
  if (!v.ok) {
    return { ok: false, error_code: ERR_BAD_RESPONSE_SHAPE, hint: v.reason };
  }

  // 5. Write atomically
  const isoTs = new Date(now()).toISOString();
  const outPath = path.join(outDir, buildExportFilename(isoTs));
  try {
    await fsP.mkdir(outDir, { recursive: true });
    const jsonl = serializeJsonl(v.body.events);
    const tmp = outPath + ".tmp";
    await fsP.writeFile(tmp, jsonl, "utf8");
    await fsP.rename(tmp, outPath);
    // Mode 0o600 on POSIX (Windows ignores).
    if (process.platform !== "win32") {
      try { await fsP.chmod(outPath, 0o600); } catch { /* best-effort */ }
    }
  } catch (err) {
    return {
      ok: false,
      error_code: ERR_WRITE_FAILED,
      hint: `Write error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return {
    ok: true,
    path: outPath,
    event_count: v.body.event_count,
    range: v.body.range,
    schema_id: v.body.schema_id,
  };
}

module.exports = {
  // Constants
  DEFAULT_EXPORT_ENDPOINT,
  EXPORT_FETCH_TIMEOUT_MS,
  EXPORT_RESPONSE_MAX_BYTES,
  EXPORT_FILE_DIR,
  EXPORT_FILENAME_PREFIX,
  ERR_NOT_SIGNED_IN,
  ERR_NO_ANON_ID,
  ERR_FETCH_FAILED,
  ERR_HTTP_ERROR,
  ERR_BAD_RESPONSE_SHAPE,
  ERR_WRITE_FAILED,
  // Pure helpers
  buildExportUrl,
  buildExportFilename,
  validateExportResponse,
  serializeJsonl,
  // Orchestrator
  runExport,
};
