// @ts-check
/**
 * FAI Orchard CLI — typed CDN fetcher (mirror of frootai.dev/src/lib/orchard/cdn.ts).
 *
 * Same URL contract (`cdn.frootai.dev/orchard/v1/<file>`), same size caps, same
 * AbortController timeout pattern. JS-native via global `fetch` (Node 22+).
 *
 * Differences vs the website version:
 *   - No Next.js `next.revalidate` hint (CLI doesn't use ISR; gets fresh data per invocation)
 *   - Optional `tmpCacheDir` for on-disk caching (~/.frootai/cache/) — cuts network on repeat invocations
 *   - All async / Promise-based; throws OrchardCliError with .code on failure
 */
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { OrchardCliError } = require("./cli-error");
const { VARIETY_ENUM } = require("./types");

const DEFAULT_CDN_BASE_URL = "https://cdn.frootai.dev/orchard/v1";

const CDN_FILES = Object.freeze({
  MANIFEST: "manifest.json",
  INDEX: "index.json",
  POLLINATIONS: "pollinations.json",
  DAILY_HARVEST: "daily-harvest.json",
});

const CDN_FILE_MAX_BYTES = Object.freeze({
  MANIFEST: 4 * 1024 * 1024,
  INDEX: 64 * 1024 * 1024,
  VARIETY: 128 * 1024 * 1024,
  POLLINATIONS: 16 * 1024 * 1024,
  DAILY_HARVEST: 4 * 1024 * 1024,
});

const CDN_FETCH_TIMEOUT_MS = 30_000;
const CDN_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — same as A2.19 bundle cache policy

/** Default cache dir: ~/.frootai/cache/orchard/ */
const DEFAULT_CACHE_DIR = path.join(os.homedir(), ".frootai", "cache", "orchard");

function resolveCdnBaseUrl(env) {
  const e = env || process.env;
  const raw = e.ORCHARD_CDN_BASE_URL || e.FROOTAI_ORCHARD_CDN_BASE_URL;
  if (typeof raw !== "string" || raw.trim().length === 0) return DEFAULT_CDN_BASE_URL;
  return raw.trim().replace(/\/+$/, "");
}

function buildCdnUrl(file, baseUrl) {
  if (typeof file !== "string" || file.length === 0) {
    throw new OrchardCliError("invalid_input", "file must be non-empty string");
  }
  const base = baseUrl || resolveCdnBaseUrl();
  return `${base}/${file.replace(/^\/+/, "")}`;
}

function varietyBundleFilename(variety) {
  if (!VARIETY_ENUM.includes(variety)) {
    throw new OrchardCliError(
      "invalid_variety",
      `variety "${variety}" not in enum [${VARIETY_ENUM.join(", ")}]`,
      { received: variety, accepted: [...VARIETY_ENUM] },
    );
  }
  return `${variety}.json`;
}

async function _readCache(cacheDir, file) {
  try {
    const p = path.join(cacheDir, file);
    const stat = await fsP.stat(p);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > CDN_CACHE_TTL_MS) return null;
    const text = await fsP.readFile(p, "utf8");
    return { text, ageMs };
  } catch { return null; }
}

async function _writeCache(cacheDir, file, text) {
  try {
    await fsP.mkdir(cacheDir, { recursive: true });
    await fsP.writeFile(path.join(cacheDir, file), text, "utf8");
  } catch { /* best-effort */ }
}

/**
 * Low-level fetch + parse with size cap + timeout + optional disk cache.
 *
 * @template T
 * @param {string} file
 * @param {object} [opts]
 * @param {string} [opts.baseUrl]
 * @param {number} [opts.maxBytes]
 * @param {number} [opts.timeoutMs]
 * @param {boolean} [opts.useCache=true]
 * @param {string} [opts.cacheDir]
 * @param {typeof fetch} [opts.fetchImpl]
 * @returns {Promise<T>}
 */
async function fetchFromCdn(file, opts) {
  const o = opts || {};
  const fetchImpl = o.fetchImpl || fetch;
  const baseUrl = o.baseUrl || resolveCdnBaseUrl();
  const url = buildCdnUrl(file, baseUrl);
  const maxBytes = o.maxBytes || CDN_FILE_MAX_BYTES.INDEX;
  const timeoutMs = o.timeoutMs || CDN_FETCH_TIMEOUT_MS;
  const useCache = o.useCache !== false;
  const cacheDir = o.cacheDir || DEFAULT_CACHE_DIR;

  // Disk cache check (skipped if useCache=false).
  if (useCache) {
    const cached = await _readCache(cacheDir, file);
    if (cached) {
      try { return JSON.parse(cached.text); }
      catch { /* fall through to network fetch */ }
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "Accept": "application/json", "User-Agent": "frootai-orchard-cli/1.0" },
    });
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort")) {
      throw new OrchardCliError("timeout", `timeout fetching ${url} after ${timeoutMs}ms`, { url, timeoutMs });
    }
    throw new OrchardCliError("network_error", `network error: ${message}`, { url, cause: message });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new OrchardCliError("http_error", `CDN returned ${response.status} for ${url}`, { url, status: response.status });
  }

  const cl = Number(response.headers.get("content-length") || 0);
  if (cl > maxBytes) {
    throw new OrchardCliError("file_too_large", `${url} content-length ${cl} > cap ${maxBytes}`, { url, bytes: cl, cap: maxBytes });
  }

  let text;
  try { text = await response.text(); }
  catch (err) {
    throw new OrchardCliError("read_error", `failed to read body: ${err instanceof Error ? err.message : String(err)}`, { url });
  }

  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new OrchardCliError("file_too_large", `${url} body > cap ${maxBytes}`, { url, cap: maxBytes });
  }

  let parsed;
  try { parsed = JSON.parse(text); }
  catch (err) {
    throw new OrchardCliError("parse_error", `body failed JSON.parse: ${err instanceof Error ? err.message : String(err)}`, { url });
  }

  if (useCache) await _writeCache(cacheDir, file, text);
  return parsed;
}

function fetchCdnManifest(opts) {
  return fetchFromCdn(CDN_FILES.MANIFEST, { maxBytes: CDN_FILE_MAX_BYTES.MANIFEST, ...(opts || {}) });
}
function fetchIndexBundle(opts) {
  return fetchFromCdn(CDN_FILES.INDEX, { maxBytes: CDN_FILE_MAX_BYTES.INDEX, ...(opts || {}) });
}
function fetchVarietyBundle(variety, opts) {
  return fetchFromCdn(varietyBundleFilename(variety), { maxBytes: CDN_FILE_MAX_BYTES.VARIETY, ...(opts || {}) });
}
function fetchPollinationsBundle(opts) {
  return fetchFromCdn(CDN_FILES.POLLINATIONS, { maxBytes: CDN_FILE_MAX_BYTES.POLLINATIONS, ...(opts || {}) });
}
function fetchDailyHarvestBundle(opts) {
  return fetchFromCdn(CDN_FILES.DAILY_HARVEST, { maxBytes: CDN_FILE_MAX_BYTES.DAILY_HARVEST, ...(opts || {}) });
}

/** Clear the on-disk cache. Returns count of files removed. */
async function clearCdnCache(cacheDir) {
  const dir = cacheDir || DEFAULT_CACHE_DIR;
  let removed = 0;
  try {
    const files = await fsP.readdir(dir);
    for (const f of files) {
      try { await fsP.unlink(path.join(dir, f)); removed += 1; } catch { /* */ }
    }
  } catch { /* missing dir is fine */ }
  return removed;
}

module.exports = {
  DEFAULT_CDN_BASE_URL,
  CDN_FILES,
  CDN_FILE_MAX_BYTES,
  CDN_FETCH_TIMEOUT_MS,
  CDN_CACHE_TTL_MS,
  DEFAULT_CACHE_DIR,
  resolveCdnBaseUrl,
  buildCdnUrl,
  varietyBundleFilename,
  fetchFromCdn,
  fetchCdnManifest,
  fetchIndexBundle,
  fetchVarietyBundle,
  fetchPollinationsBundle,
  fetchDailyHarvestBundle,
  clearCdnCache,
};
