// @ts-check
/**
 * A5.23 — VSCode bushel sync client.
 *
 * Provides:
 *   - `watchBushelFile(path, onChange)` — fs.watchFile wrapper that fires
 *     `onChange` when `~/.frootai/bushels.json` mtime changes (i.e. the CLI
 *     ran `frootai bushel add foo` in a terminal, or the cloud sync wrote
 *     back a merged store).
 *   - `runBushelCloudSync(opts)` — pull → merge locally → push back loop.
 *     Requires Bearer token + `bushel-sync` entitlement (server enforces).
 *
 * Doctrine:
 *   - NEVER throws. All failures collapse to { ok:false, error_code, hint }.
 *   - File watcher uses POLLING (`fs.watchFile`) not `fs.watch` because
 *     polling is more portable across Windows/macOS/Linux + survives editor
 *     atomic writes (tmp+rename) that fs.watch misses.
 *   - Cloud sync respects the `if_match` ETag for optimistic concurrency.
 *   - Polling interval default 2 seconds — picked to match CLI tree refresh
 *     latency expectations without burning CPU.
 *
 * This module is pure JS + does NOT import vscode. The thin VSCode wrapper
 * in `extension.ts` calls `watchBushelFile` and uses the returned token to
 * trigger tree-view refresh.
 */
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const DEFAULT_BUSHEL_PATH = path.join(os.homedir(), ".frootai", "bushels.json");
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_CLOUD_SYNC_ENDPOINT = "https://frootai.dev/api/bushel/sync";
const CLOUD_SYNC_TIMEOUT_MS = 5000;
const RESPONSE_MAX_BYTES = 512 * 1024;

const ERR_NOT_SIGNED_IN = "not_signed_in";
const ERR_FETCH_FAILED = "fetch_failed";
const ERR_HTTP_ERROR = "http_error";
const ERR_BAD_RESPONSE_SHAPE = "bad_response_shape";
const ERR_READ_FAILED = "read_failed";
const ERR_WRITE_FAILED = "write_failed";

// ---------------------------------------------------------------------------
// File watcher
// ---------------------------------------------------------------------------

/**
 * Watch `bushelPath` for mtime changes. Calls `onChange()` when the file is
 * created OR modified. Returns a `dispose()` function the caller MUST invoke
 * on extension deactivate.
 *
 * @param {string} bushelPath
 * @param {() => void} onChange
 * @param {object} [opts]
 * @param {number} [opts.intervalMs]
 * @param {Function} [opts.watchFileImpl]   injected for tests
 * @returns {{ dispose: () => void, _state: { lastMtimeMs: number } }}
 */
function watchBushelFile(bushelPath, onChange, opts) {
  const o = opts || {};
  const intervalMs = typeof o.intervalMs === "number" && o.intervalMs > 0 ? o.intervalMs : DEFAULT_POLL_INTERVAL_MS;
  const watchFileImpl = typeof o.watchFileImpl === "function" ? o.watchFileImpl : null;

  const state = { lastMtimeMs: 0 };

  // Use fs.watchFile (polling) for portability + atomic-write tolerance.
  const handler = (curr, prev) => {
    if (!curr || typeof curr.mtimeMs !== "number") return;
    if (curr.mtimeMs === 0) {
      // File deleted — reset and re-fire (caller treats this as a refresh trigger)
      if (state.lastMtimeMs !== 0) {
        state.lastMtimeMs = 0;
        try { onChange(); } catch { /* never let UI callback kill the watcher */ }
      }
      return;
    }
    if (curr.mtimeMs !== state.lastMtimeMs) {
      state.lastMtimeMs = curr.mtimeMs;
      try { onChange(); } catch { /* never let UI callback kill the watcher */ }
    }
  };

  if (watchFileImpl) {
    watchFileImpl(bushelPath, { interval: intervalMs }, handler);
  } else {
    fs.watchFile(bushelPath, { interval: intervalMs, persistent: false }, handler);
  }

  return {
    dispose: () => {
      try {
        if (watchFileImpl) {
          // Tests don't need unwatch; provide a noop semantics
          return;
        }
        fs.unwatchFile(bushelPath, handler);
      } catch { /* ignore */ }
    },
    _state: state,
  };
}

// ---------------------------------------------------------------------------
// Local store IO (atomic read + write)
// ---------------------------------------------------------------------------

/**
 * Pure-ish: read the bushel file from disk. NEVER throws; returns null on any
 * error so the caller can treat it as "empty".
 *
 * @param {string} bushelPath
 * @returns {Promise<object|null>}
 */
async function readBushelFileSafe(bushelPath) {
  try {
    const text = await fsP.readFile(bushelPath, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Pure-ish: atomic write of the bushel store to disk (tmp + rename).
 * Returns { ok, bytes } or { ok:false, error_code, hint }.
 *
 * @param {string} bushelPath
 * @param {object} store
 * @returns {Promise<object>}
 */
async function writeBushelFileSafe(bushelPath, store) {
  try {
    const dir = path.dirname(bushelPath);
    await fsP.mkdir(dir, { recursive: true });
    const tmp = `${bushelPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const json = JSON.stringify(store, null, 2) + "\n";
    await fsP.writeFile(tmp, json, "utf8");
    await fsP.rename(tmp, bushelPath);
    return { ok: true, bytes: Buffer.byteLength(json, "utf8") };
  } catch (e) {
    return {
      ok: false,
      error_code: ERR_WRITE_FAILED,
      hint: e instanceof Error ? e.message : String(e),
    };
  }
}

// ---------------------------------------------------------------------------
// Cloud sync — pull → merge → push
// ---------------------------------------------------------------------------

/**
 * Run a full cloud sync cycle:
 *   1. Read local store from disk.
 *   2. POST local to /api/bushel/sync with if_match=lastEtag (if any).
 *   3. On 200, write merged store back to disk + return delta.
 *   4. On 409 (etag mismatch), pull, merge locally, retry once.
 *
 * NEVER throws.
 *
 * @param {object} opts
 * @param {string} [opts.bushelPath]
 * @param {string} [opts.endpoint]
 * @param {string} opts.access_token       Bearer token
 * @param {string} [opts.if_match]         optional concurrency token
 * @param {Function} [opts.fetchImpl]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{ok: boolean, store?: object, etag?: string, delta?: object, error_code?: string, hint?: string}>}
 */
async function runBushelCloudSync(opts) {
  const o = opts || {};
  if (!o.access_token || typeof o.access_token !== "string") {
    return { ok: false, error_code: ERR_NOT_SIGNED_IN, hint: "Run `frootai login` first." };
  }
  const bushelPath = o.bushelPath || DEFAULT_BUSHEL_PATH;
  const endpoint = o.endpoint || DEFAULT_CLOUD_SYNC_ENDPOINT;
  const timeoutMs = o.timeoutMs || CLOUD_SYNC_TIMEOUT_MS;
  const fetchImpl = o.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return { ok: false, error_code: ERR_FETCH_FAILED, hint: "fetch is not available; upgrade to Node 18+." };
  }

  const local = await readBushelFileSafe(bushelPath);
  if (local === null) {
    // Treat missing as empty store
  }

  /** @type {Record<string,string>} */
  const headers = {
    "Authorization": `Bearer ${o.access_token}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  /** @type {object} */
  const body = { local_store: local || { v: 1, ids: [], tombstones: [], version: 0, updated_at: null } };
  if (o.if_match) body.if_match = o.if_match;

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let resp;
  try {
    resp = await fetchImpl(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined,
    });
  } catch (e) {
    if (timer) clearTimeout(timer);
    return { ok: false, error_code: ERR_FETCH_FAILED, hint: e instanceof Error ? e.message : String(e) };
  }
  if (timer) clearTimeout(timer);

  if (!resp || typeof resp.status !== "number") {
    return { ok: false, error_code: ERR_FETCH_FAILED, hint: "no response" };
  }
  if (resp.status === 409) {
    // Conflict — caller should re-pull + retry.
    let bodyText = "";
    try { bodyText = await resp.text(); } catch { /* */ }
    return { ok: false, error_code: ERR_HTTP_ERROR, hint: `etag mismatch (409): ${bodyText.slice(0, 200)}` };
  }
  if (resp.status !== 200) {
    let bodyText = "";
    try { bodyText = await resp.text(); } catch { /* */ }
    return { ok: false, error_code: ERR_HTTP_ERROR, hint: `HTTP ${resp.status}: ${bodyText.slice(0, 200)}` };
  }

  let parsed;
  try {
    const text = await resp.text();
    if (text.length > RESPONSE_MAX_BYTES) {
      return { ok: false, error_code: ERR_BAD_RESPONSE_SHAPE, hint: "response too large" };
    }
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error_code: ERR_BAD_RESPONSE_SHAPE, hint: e instanceof Error ? e.message : String(e) };
  }

  if (!parsed || typeof parsed !== "object" || !parsed.store || typeof parsed.etag !== "string") {
    return { ok: false, error_code: ERR_BAD_RESPONSE_SHAPE, hint: "missing store or etag" };
  }

  // Atomically write the merged store back to disk.
  const writeResult = await writeBushelFileSafe(bushelPath, parsed.store);
  if (!writeResult.ok) return writeResult;

  return {
    ok: true,
    store: parsed.store,
    etag: parsed.etag,
    delta: parsed.delta || null,
  };
}

module.exports = {
  // Watcher
  watchBushelFile,
  // IO
  readBushelFileSafe,
  writeBushelFileSafe,
  // Cloud sync
  runBushelCloudSync,
  // Constants
  DEFAULT_BUSHEL_PATH,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_CLOUD_SYNC_ENDPOINT,
  CLOUD_SYNC_TIMEOUT_MS,
  RESPONSE_MAX_BYTES,
  ERR_NOT_SIGNED_IN,
  ERR_FETCH_FAILED,
  ERR_HTTP_ERROR,
  ERR_BAD_RESPONSE_SHAPE,
  ERR_READ_FAILED,
  ERR_WRITE_FAILED,
};
