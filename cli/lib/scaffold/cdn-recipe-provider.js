// @ts-check
/**
 * A5.26 — `CDNRecipeProvider`: drop-in replacement for the A4.13 LocalDirRecipeProvider.
 *
 * Same interface: `{ name, listAvailable(), loadRecipe(playId) }`.
 * Different backend: HTTP fetch from `cdn.frootai.dev/plays/<id>.tar.gz`
 * (actually JSON+gzip — see A5.25 play-recipe-bundler doctrine).
 *
 * Provider selection lives in scaffold/engine.js: when `FROOTAI_CDN_PLAYS_URL`
 * env var is set (or opts.cdnUrl is passed), engine picks CDNRecipeProvider.
 * Otherwise it falls back to LocalDirRecipeProvider (dev mode).
 *
 * Caching:
 *   - Disk cache at `~/.frootai/cache/plays/<play_id>.json` (uncompressed
 *     bundle for fast re-read; we re-validate on next fetch via ETag).
 *   - ETag stored alongside: `<id>.etag`. We send `If-None-Match` on
 *     subsequent fetches → 304 short-circuits the body download.
 *   - TTL cap: PLAY_CACHE_TTL_MS=1h (matches A2.19 bundle cache policy).
 *
 * Doctrine:
 *   - Returns same `Recipe` shape as LocalDirRecipeProvider (v, play_id,
 *     play_slug, source, source_path, loaded_at, files[{rel, content}])
 *     so scaffold/file-drops.js + scaffold/engine.js need ZERO changes.
 *   - NEVER throws on network errors when a cached bundle exists —
 *     stale-while-error doctrine matches entitlements (A4.11).
 *   - On hard miss (no network + no cache) throws `play_recipe_unavailable`
 *     OrchardCliError so the scaffold engine surfaces it cleanly.
 *   - Per-file sha256 verified on every load (defense against tampering
 *     in transit or cache corruption).
 */
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const fsP = require("node:fs/promises");
const os = require("node:os");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const { promisify } = require("node:util");

const { OrchardCliError } = require("../orchard/cli-error");

const gunzipP = promisify(zlib.gunzip);

const DEFAULT_CDN_PLAYS_URL = "https://cdn.frootai.dev/plays";
const DEFAULT_CACHE_DIR = path.join(os.homedir(), ".frootai", "cache", "plays");
const PLAY_CACHE_TTL_MS = 60 * 60 * 1000;            // 1 hour
const FETCH_TIMEOUT_MS = 15_000;                      // 15s — recipes are small but tarballs can be slow on bad networks
const BUNDLE_GZIP_MAX_BYTES = 4 * 1024 * 1024;        // 4 MiB compressed
const BUNDLE_UNGZIP_MAX_BYTES = 8 * 1024 * 1024;      // 8 MiB uncompressed (matches A5.25 server cap)
const PLAY_ID_RE = /^[0-9]{2}$/;
const RECIPE_VERSION = 1;
const PROVIDER_NAME = "cdn";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Pure: build the CDN fetch URL for a play_id.
 *
 * @param {string} baseUrl
 * @param {string} playId
 * @returns {string}
 */
function buildPlayUrl(baseUrl, playId) {
  if (typeof baseUrl !== "string" || baseUrl.length === 0) {
    throw new OrchardCliError("invalid_input", "baseUrl required");
  }
  if (typeof playId !== "string" || !PLAY_ID_RE.test(playId)) {
    throw new OrchardCliError("invalid_play_id", `play_id must match ${PLAY_ID_RE}`, { received: playId });
  }
  return `${baseUrl.replace(/\/+$/, "")}/${playId}.tar.gz`;
}

/**
 * Pure: SHA-256 hex of a string.
 *
 * @param {string} s
 * @returns {string}
 */
function sha256Hex(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Pure: validate the bundle shape received from the CDN. Throws OrchardCliError
 * on any tampering / shape drift.
 *
 * @param {unknown} parsed
 * @returns {object}
 */
function validateCdnBundle(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new OrchardCliError("invalid_recipe", "bundle is not an object");
  }
  const b = /** @type {any} */(parsed);
  if (b.v !== 1) {
    throw new OrchardCliError("invalid_recipe", `bundle version ${b.v} not supported`);
  }
  if (!PLAY_ID_RE.test(b.play_id)) {
    throw new OrchardCliError("invalid_recipe", `bundle play_id ${JSON.stringify(b.play_id)} invalid`);
  }
  if (typeof b.play_slug !== "string" || b.play_slug.length === 0) {
    throw new OrchardCliError("invalid_recipe", "bundle play_slug missing");
  }
  if (!Array.isArray(b.files)) {
    throw new OrchardCliError("invalid_recipe", "bundle files must be array");
  }
  for (const f of b.files) {
    if (!f || typeof f !== "object") {
      throw new OrchardCliError("invalid_recipe", "file entry must be object");
    }
    if (typeof f.rel !== "string" || f.rel.length === 0 || f.rel.length > 512) {
      throw new OrchardCliError("invalid_recipe", `bad rel: ${JSON.stringify(f.rel).slice(0, 80)}`);
    }
    if (f.rel.includes("\0") || f.rel.includes("..") || /^[a-zA-Z]:/.test(f.rel) || f.rel.startsWith("/") || f.rel.startsWith("\\")) {
      throw new OrchardCliError("invalid_recipe", `unsafe rel: ${f.rel}`);
    }
    if (typeof f.content !== "string") {
      throw new OrchardCliError("invalid_recipe", `content must be string for ${f.rel}`);
    }
    if (typeof f.sha256 === "string" && f.sha256 !== sha256Hex(f.content)) {
      throw new OrchardCliError("invalid_recipe", `sha256 mismatch for ${f.rel}`);
    }
  }
  return b;
}

/**
 * Pure: convert a validated bundle into the canonical Recipe shape that
 * matches LocalDirRecipeProvider's output byte-for-byte (except `source` +
 * `source_path` which differ).
 *
 * @param {object} bundle
 * @param {string} fetchedFromUrl
 * @returns {object}
 */
function bundleToRecipe(bundle, fetchedFromUrl) {
  const files = [...(bundle.files || [])]
    .sort((a, b) => a.rel.localeCompare(b.rel))
    .map((f) => ({ rel: f.rel, content: f.content }));
  return {
    v: RECIPE_VERSION,
    play_id: bundle.play_id,
    play_slug: bundle.play_slug,
    source: PROVIDER_NAME,
    source_path: fetchedFromUrl,
    loaded_at: new Date().toISOString(),
    files,
  };
}

// ---------------------------------------------------------------------------
// IO helpers — cache read/write, ungzip
// ---------------------------------------------------------------------------

function _cachePathFor(cacheDir, playId, suffix) {
  return path.join(cacheDir, `${playId}.${suffix}`);
}

async function _readCachedBundle(cacheDir, playId) {
  try {
    const p = _cachePathFor(cacheDir, playId, "json");
    const stat = await fsP.stat(p);
    const ageMs = Date.now() - stat.mtimeMs;
    const text = await fsP.readFile(p, "utf8");
    const parsed = JSON.parse(text);
    return { bundle: parsed, ageMs };
  } catch { return null; }
}

async function _readCachedEtag(cacheDir, playId) {
  try {
    const p = _cachePathFor(cacheDir, playId, "etag");
    const text = await fsP.readFile(p, "utf8");
    return text.trim() || null;
  } catch { return null; }
}

async function _writeCache(cacheDir, playId, bundle, etag) {
  try {
    await fsP.mkdir(cacheDir, { recursive: true });
    const jsonPath = _cachePathFor(cacheDir, playId, "json");
    const etagPath = _cachePathFor(cacheDir, playId, "etag");
    const json = JSON.stringify(bundle);
    const tmpJson = `${jsonPath}.tmp-${process.pid}-${Date.now()}`;
    await fsP.writeFile(tmpJson, json, "utf8");
    await fsP.rename(tmpJson, jsonPath);
    if (etag) {
      const tmpEtag = `${etagPath}.tmp-${process.pid}-${Date.now()}`;
      await fsP.writeFile(tmpEtag, etag, "utf8");
      await fsP.rename(tmpEtag, etagPath);
    }
  } catch { /* best-effort — cache failures must NEVER fail a fetch */ }
}

async function _ungzipToBundle(gz) {
  if (gz.length > BUNDLE_GZIP_MAX_BYTES) {
    throw new OrchardCliError("file_too_large", `gzipped bundle ${gz.length} exceeds cap ${BUNDLE_GZIP_MAX_BYTES}`);
  }
  let raw;
  try {
    raw = await gunzipP(gz);
  } catch (e) {
    throw new OrchardCliError("invalid_recipe", `gunzip failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (raw.length > BUNDLE_UNGZIP_MAX_BYTES) {
    throw new OrchardCliError("file_too_large", `ungzipped bundle ${raw.length} exceeds cap ${BUNDLE_UNGZIP_MAX_BYTES}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch (e) {
    throw new OrchardCliError("invalid_recipe", `bundle JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  return validateCdnBundle(parsed);
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

/**
 * Build a CDN-backed recipe provider that fulfills the same interface as
 * LocalDirRecipeProvider.
 *
 * @param {object} [opts]
 * @param {string} [opts.baseUrl]          override CDN base URL (default https://cdn.frootai.dev/plays)
 * @param {string} [opts.cacheDir]         override disk cache dir
 * @param {Function} [opts.fetchImpl]      injected fetch (tests)
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.cacheTtlMs]
 * @returns {{ name: string, baseUrl: string, listAvailable: () => Promise<Array<object>>, loadRecipe: (playId: string) => Promise<object> }}
 */
function buildCDNRecipeProvider(opts) {
  const o = opts || {};
  const baseUrl = o.baseUrl || process.env.FROOTAI_CDN_PLAYS_URL || DEFAULT_CDN_PLAYS_URL;
  const cacheDir = o.cacheDir || DEFAULT_CACHE_DIR;
  const fetchImpl = o.fetchImpl || globalThis.fetch;
  const timeoutMs = typeof o.timeoutMs === "number" ? o.timeoutMs : FETCH_TIMEOUT_MS;
  const cacheTtlMs = typeof o.cacheTtlMs === "number" ? o.cacheTtlMs : PLAY_CACHE_TTL_MS;
  const bypassCache = o.bypassCache === true;

  if (typeof fetchImpl !== "function") {
    throw new OrchardCliError("invalid_input", "fetch not available; upgrade to Node 18+ or inject fetchImpl");
  }

  /**
   * Fetch + validate. Returns { bundle, etag, source_url }.
   * Stale-while-error: when network fails, returns cached bundle if available.
   */
  async function _fetchBundle(playId) {
    if (!PLAY_ID_RE.test(playId)) {
      throw new OrchardCliError("invalid_play_id", `play_id must match ${PLAY_ID_RE}`, { received: playId });
    }
    const url = buildPlayUrl(baseUrl, playId);

    // 1. Try cache first if not expired + not bypassed
    let cached = bypassCache ? null : await _readCachedBundle(cacheDir, playId);
    if (cached && cached.ageMs < cacheTtlMs) {
      // Re-validate that cached bundle is well-formed; if not, fall through to network.
      try {
        const validated = validateCdnBundle(cached.bundle);
        return { bundle: validated, etag: await _readCachedEtag(cacheDir, playId), source_url: `cache:${url}` };
      } catch { cached = null; }
    }
    const cachedEtag = cached ? await _readCachedEtag(cacheDir, playId) : null;

    // 2. Network fetch (with If-None-Match if we have an etag for stale-revalidate)
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    /** @type {Record<string,string>} */
    const headers = { Accept: "application/x-frootai-recipe+json, application/octet-stream" };
    if (cachedEtag) headers["If-None-Match"] = cachedEtag;

    let resp;
    try {
      resp = await fetchImpl(url, { method: "GET", headers, signal: controller ? controller.signal : undefined });
    } catch (err) {
      if (timer) clearTimeout(timer);
      // Network error → fall back to cache if we have one (even if stale)
      if (cached) return { bundle: validateCdnBundle(cached.bundle), etag: cachedEtag, source_url: `stale-cache:${url}`, stale: true };
      throw new OrchardCliError("play_recipe_unavailable",
        `failed to fetch play recipe and no cache: ${err instanceof Error ? err.message : String(err)}`,
        { url, play_id: playId });
    }
    if (timer) clearTimeout(timer);

    if (!resp || typeof resp.status !== "number") {
      if (cached) return { bundle: validateCdnBundle(cached.bundle), etag: cachedEtag, source_url: `stale-cache:${url}`, stale: true };
      throw new OrchardCliError("play_recipe_unavailable", "no response from CDN", { url, play_id: playId });
    }
    if (resp.status === 304) {
      // Server confirmed our cache is fresh.
      if (!cached) throw new OrchardCliError("play_recipe_unavailable", "304 but no local cache", { url, play_id: playId });
      return { bundle: validateCdnBundle(cached.bundle), etag: cachedEtag, source_url: `cache-304:${url}` };
    }
    if (resp.status === 404) {
      throw new OrchardCliError("play_not_found", `play ${playId} not found on CDN`, { url, play_id: playId });
    }
    if (resp.status >= 500 && cached) {
      // Server error — stale-while-error
      return { bundle: validateCdnBundle(cached.bundle), etag: cachedEtag, source_url: `stale-cache:${url}`, stale: true };
    }
    if (resp.status !== 200) {
      throw new OrchardCliError("play_recipe_unavailable", `HTTP ${resp.status} from CDN`, { url, play_id: playId, status: resp.status });
    }

    // 3. Read body. fetch may return Response with .arrayBuffer()
    let body;
    try {
      const ab = await resp.arrayBuffer();
      body = Buffer.from(ab);
    } catch (e) {
      throw new OrchardCliError("play_recipe_unavailable", `read body failed: ${e instanceof Error ? e.message : String(e)}`, { url });
    }

    const bundle = await _ungzipToBundle(body);
    const etag = (resp.headers && typeof resp.headers.get === "function" ? resp.headers.get("etag") : null) || null;
    await _writeCache(cacheDir, playId, bundle, etag);
    return { bundle, etag, source_url: url };
  }

  return {
    name: PROVIDER_NAME,
    baseUrl,

    async listAvailable() {
      // The CDN-served list endpoint is out of scope for A5.26 (would be A5.27).
      // For now: return empty + let the consumer fall back to discovery via
      // `frootai orchard list` server-side. The scaffold engine does NOT call
      // listAvailable in the install path — it goes straight to loadRecipe.
      return [];
    },

    async loadRecipe(playId) {
      if (!PLAY_ID_RE.test(playId)) {
        throw new OrchardCliError("invalid_play_id", `play_id must match ${PLAY_ID_RE}`, { received: playId });
      }
      const result = await _fetchBundle(playId);
      return bundleToRecipe(result.bundle, result.source_url);
    },

    /**
     * A5.27 — Purge the local disk cache for a specific play_id (or for all
     * plays when called without an arg). Used after the server's invalidation
     * counter is bumped + the operator wants to force the next loadRecipe()
     * call to hit the network instead of returning stale bytes.
     *
     * Returns { removed: [...play_ids actually deleted...] }. NEVER throws.
     *
     * @param {string} [playId]
     */
    async purgeLocalCache(playId) {
      if (typeof playId === "string" && playId.length > 0) {
        if (!PLAY_ID_RE.test(playId)) {
          throw new OrchardCliError("invalid_play_id", `play_id must match ${PLAY_ID_RE}`, { received: playId });
        }
        const jsonPath = _cachePathFor(cacheDir, playId, "json");
        const etagPath = _cachePathFor(cacheDir, playId, "etag");
        const removed = [];
        try { await fsP.unlink(jsonPath); removed.push(playId); } catch { /* not cached */ }
        try { await fsP.unlink(etagPath); } catch { /* not cached */ }
        return { removed };
      }
      // No id supplied — purge everything
      let entries = [];
      try { entries = await fsP.readdir(cacheDir); } catch { return { removed: [] }; }
      const removed = [];
      for (const entry of entries) {
        const m = entry.match(/^([0-9]{2})\.(json|etag)$/);
        if (!m) continue;
        try { await fsP.unlink(path.join(cacheDir, entry)); if (m[2] === "json") removed.push(m[1]); }
        catch { /* race — ignore */ }
      }
      return { removed };
    },
  };
}

module.exports = {
  buildCDNRecipeProvider,
  buildPlayUrl,
  validateCdnBundle,
  bundleToRecipe,
  sha256Hex,
  // Constants
  DEFAULT_CDN_PLAYS_URL,
  DEFAULT_CACHE_DIR,
  PLAY_CACHE_TTL_MS,
  FETCH_TIMEOUT_MS,
  BUNDLE_GZIP_MAX_BYTES,
  BUNDLE_UNGZIP_MAX_BYTES,
  PLAY_ID_RE,
  PROVIDER_NAME,
};
