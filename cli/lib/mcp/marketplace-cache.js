// @ts-check
/**
 * FAI MCP CLI — `~/.frootai/cache/mcp-marketplace.json` reader (M4.4 ship).
 *
 * Mirrors the tolerant-reader pattern of `state.js` (M4.3). The bundled
 * fallback + the weekly background refresh land at M4.16/M4.17; M4.4 only
 * needs to:
 *   - return an empty roster when the file is absent (first-run UX),
 *   - parse the byte-shape of the M2.9 marketplace snapshot when present
 *     (`{ total: number, items: MarketplaceEntry[] }`), and
 *   - throw `McpCliError("marketplace_cache_read_failed")` on malformed
 *     JSON / shape so the discover command surfaces a deterministic
 *     remediation hint instead of a stack trace.
 *
 * Marketplace entry shape (mirrors `MarketplaceEntry` exported from
 * `src/federation/lifecycle-tools.ts`):
 *   { name, owner, slug, desc?, path?, author?, installs? }
 *
 * `installs` ships as a comma-separated string (`"153,269"`) per the M0
 * raw-marketplace.json; consumers should parse it via `parseInstalls()`.
 */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { McpCliError } = require("./cli-error");
const { buildAuthHeader, redactAuthHeader } = require("./auth-token");

const CACHE_FILE_RELPATH = path.join(".frootai", "cache", "mcp-marketplace.json");
const BUNDLED_SNAPSHOT_RELPATH = path.join("lib", "mcp", "marketplace-snapshot.bundled.json");
const DEFAULT_REFRESH_URL = "https://frootai.dev/v1/marketplace/mcp-snapshot.json";
const WEEKLY_REFRESH_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_TIMEOUT_MS = 15_000;

/**
 * @returns {{ total: number, items: Array<object> }}
 */
function emptyCache() {
  return { total: 0, items: [] };
}

function resolveCachePath(deps) {
  const d = deps || {};
  const home = d.homeDir || os.homedir();
  return path.join(home, CACHE_FILE_RELPATH);
}

/**
 * Resolve the absolute path of the bundled offline snapshot shipped
 * inside the CLI npm package. The bundle file itself lands at M4.17;
 * the resolver pins the canonical location now so the M4.16 fallback
 * path is wired and inert until then.
 *
 * @param {object} [deps]
 * @returns {string}
 */
function resolveBundledSnapshotPath(deps) {
  const d = deps || {};
  if (typeof d.bundledSnapshotPath === "string" && d.bundledSnapshotPath.length > 0) {
    return d.bundledSnapshotPath;
  }
  // `__dirname` is `…/frootai-core/cli/lib/mcp/`. The bundled file lives at
  // `…/frootai-core/cli/lib/mcp/marketplace-snapshot.bundled.json` (one folder
  // up from `mcp/`, then back into `lib/mcp/`). Using `path.resolve(__dirname,
  // "..", "..", BUNDLED_SNAPSHOT_RELPATH)` keeps the constant the source of
  // truth without depending on `process.cwd()`.
  return path.resolve(__dirname, "..", "..", BUNDLED_SNAPSHOT_RELPATH);
}

function _parseCache(raw, abs) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    throw new McpCliError(
      "marketplace_cache_read_failed",
      `marketplace cache is not valid JSON: ${abs}`,
      { hint: "Delete the file to fall back to the bundled snapshot; re-run with --refresh.", path: abs },
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new McpCliError(
      "marketplace_cache_read_failed",
      `marketplace cache root is not an object: ${abs}`,
      { hint: "Expected `{ total, items: [...] }` per src/federation/marketplace-snapshot.json.", path: abs },
    );
  }
  const items = Array.isArray(parsed.items)
    ? parsed.items.filter((e) => e && typeof e === "object" && typeof e.slug === "string")
    : [];
  return {
    total: typeof parsed.total === "number" ? parsed.total : items.length,
    items,
  };
}

/**
 * Read the marketplace cache with offline fallback to the bundled
 * snapshot. Returns `{ total, items, source, ageMs }`:
 *   - `source: "cache"`   user cache file present + parsed
 *   - `source: "bundle"`  cache absent; bundled snapshot present
 *   - `source: "empty"`   both absent (first-run before M4.17 ships the bundle)
 *   - `ageMs` is the mtime age of the SOURCE file (cache or bundle); `null`
 *     for `empty` source.
 *
 * Malformed JSON in either file still throws
 * `McpCliError('marketplace_cache_read_failed')` so the operator can
 * see + fix the broken file.
 *
 * @param {object} [deps]
 * @returns {{ total: number, items: Array<object>, source: "cache" | "bundle" | "empty", ageMs: number | null, path: string | null }}
 */
function readMarketplaceCache(deps) {
  const d = deps || {};
  const now = (typeof d.now === "function") ? d.now : () => Date.now();
  const cacheAbs = resolveCachePath(deps);
  try {
    const raw = fs.readFileSync(cacheAbs, "utf8");
    const parsed = _parseCache(raw, cacheAbs);
    let ageMs = null;
    try {
      const st = fs.statSync(cacheAbs);
      ageMs = Math.max(0, now() - st.mtimeMs);
    } catch { /* noop */ }
    return { total: parsed.total, items: parsed.items, source: "cache", ageMs, path: cacheAbs };
  } catch (err) {
    if (!(err && err.code === "ENOENT")) {
      if (err instanceof McpCliError) throw err;
      throw new McpCliError(
        "marketplace_cache_read_failed",
        `cannot read ${cacheAbs}: ${err && err.message}`,
        { hint: `Check permissions on ${path.dirname(cacheAbs)}.`, path: cacheAbs },
      );
    }
  }
  // Cache absent — try the bundled offline snapshot.
  const bundleAbs = resolveBundledSnapshotPath(deps);
  try {
    const raw = fs.readFileSync(bundleAbs, "utf8");
    const parsed = _parseCache(raw, bundleAbs);
    let ageMs = null;
    try {
      const st = fs.statSync(bundleAbs);
      ageMs = Math.max(0, now() - st.mtimeMs);
    } catch { /* noop */ }
    return { total: parsed.total, items: parsed.items, source: "bundle", ageMs, path: bundleAbs };
  } catch (err) {
    if (!(err && err.code === "ENOENT")) {
      if (err instanceof McpCliError) throw err;
      throw new McpCliError(
        "marketplace_cache_read_failed",
        `cannot read bundled snapshot at ${bundleAbs}: ${err && err.message}`,
        { hint: "Reinstall frootai or run `frootai mcp discover --refresh` once online.", path: bundleAbs },
      );
    }
  }
  return { total: 0, items: [], source: "empty", ageMs: null, path: null };
}

/**
 * Atomically write the marketplace cache. Pattern mirrors `state.js
 * writeState`: `.tmp` then rename so concurrent readers see either old
 * or new bytes only. Used by `refreshMarketplaceCache()`.
 *
 * @param {{ total: number, items: Array<object> }} body
 * @param {object} [deps]
 * @returns {string} absolute path of the written file
 */
function writeMarketplaceCache(body, deps) {
  const abs = resolveCachePath(deps);
  const dir = path.dirname(abs);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (err) {
    throw new McpCliError(
      "marketplace_cache_write_failed",
      `cannot create ${dir}: ${err && err.message}`,
      { hint: "Check filesystem permissions on your home directory.", path: dir },
    );
  }
  const tmp = `${abs}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(body, null, 2) + "\n", "utf8");
    fs.renameSync(tmp, abs);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* noop */ }
    throw new McpCliError(
      "marketplace_cache_write_failed",
      `cannot write ${abs}: ${err && err.message}`,
      { hint: "Check disk space + permissions on ~/.frootai/cache/.", path: abs },
    );
  }
  return abs;
}

/**
 * Fetch a fresh marketplace snapshot from the published URL and write
 * it to the user cache. Returns `{ ok, fetchedFrom, fetchedAt,
 * totalEntries, statePath, error? }`. Network failures resolve to
 * `{ ok: false, error: { code, message } }` so the caller can decide
 * whether to fall back to the existing cache / bundle (the spec's
 * "falls back to bundled snapshot on offline" contract) instead of
 * exiting non-zero on transient network blips.
 *
 * Injectable `deps.fetch` for tests (Node 18+ provides global `fetch`).
 *
 * @param {object} [deps]
 * @returns {Promise<{ ok: boolean, fetchedFrom: string, fetchedAt: string, totalEntries: number, statePath: string | null, error?: { code: string, message: string } }>}
 */
async function refreshMarketplaceCache(deps) {
  const d = deps || {};
  const url = d.refreshUrl
    || process.env.FROOTAI_MCP_MARKETPLACE_URL
    || DEFAULT_REFRESH_URL;
  const nowFn = (typeof d.now === "function") ? d.now : () => Date.now();
  const fetchedAt = new Date(nowFn()).toISOString();
  // M4.26: --no-network short-circuits BEFORE any fetch is attempted.
  // Returns the structured failure shape so callers (`frootai mcp
  // discover --refresh`) fall back to the existing cache or bundled
  // snapshot per the M4.17 doctrine — zero remote calls.
  if (d.networkPolicy && d.networkPolicy.enabled) {
    return {
      ok: false, fetchedFrom: url, fetchedAt, totalEntries: 0, statePath: null,
      error: {
        code: "network_blocked",
        message: "--no-network blocks marketplace fetch; using bundled snapshot or existing cache",
      },
    };
  }
  const fetchImpl = (typeof d.fetch === "function") ? d.fetch
    : (typeof globalThis.fetch === "function") ? globalThis.fetch.bind(globalThis)
    : null;
  if (!fetchImpl) {
    return {
      ok: false, fetchedFrom: url, fetchedAt, totalEntries: 0, statePath: null,
      error: { code: "network", message: "no fetch implementation available (Node < 18 + no deps.fetch)" },
    };
  }
  // M4.27: build Authorization header from `deps.auth` if present.
  // The token is NEVER referenced in the return shape — only the
  // `auth.redacted` summary or the `authPresent` boolean is. The
  // wire-format header itself is constructed at the LAST POSSIBLE
  // MOMENT (just before fetch) and never assigned to any captured
  // variable beyond the fetch options object so it can't accidentally
  // surface in an error or telemetry envelope.
  const headers = {};
  const authHeader = buildAuthHeader(d.auth || null);
  const authPresent = Boolean(authHeader);
  if (authHeader) headers.Authorization = authHeader;
  let body;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), d.timeoutMs || REFRESH_TIMEOUT_MS);
    let res;
    try {
      res = await fetchImpl(url, { signal: controller.signal, headers });
    } finally { clearTimeout(timer); }
    if (!res || !res.ok) {
      const status = res ? res.status : "no-response";
      return {
        ok: false, fetchedFrom: url, fetchedAt, totalEntries: 0, statePath: null,
        authPresent,
        error: { code: "network", message: `fetch ${url} → ${status}` },
      };
    }
    body = await res.json();
  } catch (err) {
    return {
      ok: false, fetchedFrom: url, fetchedAt, totalEntries: 0, statePath: null,
      authPresent,
      error: { code: "network", message: `fetch ${url} failed: ${err && err.message ? err.message : String(err)}` },
    };
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || !Array.isArray(body.items)) {
    return {
      ok: false, fetchedFrom: url, fetchedAt, totalEntries: 0, statePath: null,
      authPresent,
      error: { code: "network", message: `fetch ${url} returned an unexpected payload shape` },
    };
  }
  const statePath = writeMarketplaceCache(
    { total: typeof body.total === "number" ? body.total : body.items.length, items: body.items },
    d,
  );
  return {
    ok: true, fetchedFrom: url, fetchedAt,
    totalEntries: typeof body.total === "number" ? body.total : body.items.length,
    statePath,
    authPresent,
  };
}

/**
 * Parse the comma-separated install count (`"153,269"` → `153269`).
 * Pure; returns `0` for unparseable input.
 *
 * @param {unknown} raw
 * @returns {number}
 */
function parseInstalls(raw) {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  if (typeof raw !== "string") return 0;
  const cleaned = raw.replace(/[^\d]/g, "");
  if (cleaned.length === 0) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

module.exports = {
  CACHE_FILE_RELPATH,
  BUNDLED_SNAPSHOT_RELPATH,
  DEFAULT_REFRESH_URL,
  WEEKLY_REFRESH_AGE_MS,
  REFRESH_TIMEOUT_MS,
  emptyCache,
  resolveCachePath,
  resolveBundledSnapshotPath,
  readMarketplaceCache,
  writeMarketplaceCache,
  refreshMarketplaceCache,
  parseInstalls,
};
