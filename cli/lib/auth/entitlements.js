// @ts-check
/**
 * FAI CLI auth — Pro entitlement check.
 *
 * Entitlement model:
 *   - Anonymous (no token) → tier: "free", entitlements: []
 *   - Authenticated → GET https://frootai.dev/api/entitlements with Bearer token
 *     returns { tier, entitlements: [...], expires_at: ISO, subject, email }
 *   - Cached at ~/.frootai/entitlements.json (1-hour TTL — matches A2.19 bundle policy)
 *   - Stale-while-revalidate: serves cached while async-refreshing in background
 *
 * Failure modes:
 *   - Network down → returns last-known cached entitlements with `stale: true` flag
 *     (so the caller can still grant access if cache is recent enough)
 *   - 401 / 403 → token invalid → returns free tier + signals caller to re-login
 *   - 5xx → returns cached entitlements with `stale: true`
 *
 * Pure helpers (hasEntitlement / parseEntitlements / classifyTier) split from IO.
 */
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { OrchardCliError } = require("../orchard/cli-error");

const DEFAULT_ENTITLEMENTS_URL = "https://frootai.dev/api/entitlements";
const DEFAULT_ENTITLEMENTS_CACHE_PATH = path.join(os.homedir(), ".frootai", "entitlements.json");
const ENTITLEMENTS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — matches A2.19 bundle cache
const ENTITLEMENTS_CACHE_MAX_BYTES = 64 * 1024;
const ENTITLEMENTS_FETCH_TIMEOUT_MS = 10_000;
const ENTITLEMENTS_VERSION = 1;

const TIER_ENUM = Object.freeze(["free", "pro", "team", "business", "enterprise"]);
const TIER_RANK = Object.freeze({ free: 0, pro: 1, team: 2, business: 3, enterprise: 4 });

/** Entitlements the CLI gates on (frozen for grep-ability). */
const KNOWN_ENTITLEMENTS = Object.freeze([
  "upgrade-to-play",   // A4.5 — paid Play scaffold
  "bushel-sync",       // A4.10-A4.12 — cross-device bushel sync (future)
  "telemetry-dash",    // A4.28 — view your own usage dashboard (future)
]);

const ANONYMOUS_RESULT = Object.freeze({
  v: ENTITLEMENTS_VERSION,
  tier: "free",
  entitlements: Object.freeze([]),
  expires_at: null,
  subject: null,
  email: null,
  fetched_at: null,
  stale: false,
  anonymous: true,
});

/** Pure — normalize a server response into the canonical shape. */
function parseEntitlements(raw) {
  if (!raw) return null;
  let parsed;
  try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { return null; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const tier = typeof parsed.tier === "string" && TIER_ENUM.includes(parsed.tier) ? parsed.tier : "free";
  const entitlements = Array.isArray(parsed.entitlements)
    ? parsed.entitlements.filter((e) => typeof e === "string" && e.length > 0)
    : [];
  // A8.28 — surface enterprise-tier fields when present (passthrough).
  const HOME_REGIONS_ALLOWED = ["us-east", "eu-west", "ap-south"];
  return {
    v: ENTITLEMENTS_VERSION,
    tier,
    entitlements: Object.freeze([...new Set(entitlements)]),
    expires_at: typeof parsed.expires_at === "string" ? parsed.expires_at : null,
    subject: typeof parsed.subject === "string" ? parsed.subject : null,
    email: typeof parsed.email === "string" ? parsed.email : null,
    org_id: typeof parsed.org_id === "string" ? parsed.org_id : null,
    sso_provider: typeof parsed.sso_provider === "string" ? parsed.sso_provider : null,
    home_region: (typeof parsed.home_region === "string" && HOME_REGIONS_ALLOWED.includes(parsed.home_region))
      ? parsed.home_region
      : null,
    fetched_at: typeof parsed.fetched_at === "string" ? parsed.fetched_at : null,
    stale: parsed.stale === true,
    anonymous: parsed.anonymous === true,
  };
}

/** Pure — does this entitlements result grant the named entitlement? */
function hasEntitlement(result, name) {
  if (!result || typeof result !== "object") return false;
  if (!name || typeof name !== "string") return false;
  if (!Array.isArray(result.entitlements)) return false;
  return result.entitlements.includes(name);
}

/** Pure — rank one tier against another. Returns true iff tierA >= tierB. */
function isTierAtLeast(tierA, tierB) {
  const a = TIER_RANK[tierA];
  const b = TIER_RANK[tierB];
  if (typeof a !== "number" || typeof b !== "number") return false;
  return a >= b;
}

/** Pure — is the cache entry stale? */
function isCacheStale(result, nowMs) {
  if (!result || !result.fetched_at) return true;
  const fetchedMs = Date.parse(result.fetched_at);
  if (!Number.isFinite(fetchedMs)) return true;
  const now = typeof nowMs === "number" ? nowMs : Date.now();
  return (now - fetchedMs) > ENTITLEMENTS_CACHE_TTL_MS;
}

async function _readCache(cachePath) {
  try {
    const stat = await fsP.stat(cachePath);
    if (stat.size > ENTITLEMENTS_CACHE_MAX_BYTES) return null;
    const raw = await fsP.readFile(cachePath, "utf8");
    return parseEntitlements(raw);
  } catch { return null; }
}

async function _writeCache(cachePath, result) {
  try {
    await fsP.mkdir(path.dirname(cachePath), { recursive: true });
    await fsP.writeFile(cachePath, JSON.stringify(result, null, 2) + "\n", "utf8");
  } catch { /* best-effort */ }
}

/**
 * Fetch entitlements with stale-while-revalidate caching.
 *
 * @param {object} [opts]
 * @param {string} [opts.token]  access token; if absent → anonymous
 * @param {string} [opts.endpoint]  override entitlements URL
 * @param {string} [opts.cachePath]
 * @param {boolean} [opts.bypassCache=false]
 * @param {number} [opts.timeoutMs]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {() => number} [opts.now]
 */
async function fetchEntitlements(opts) {
  const o = opts || {};
  const cachePath = o.cachePath || DEFAULT_ENTITLEMENTS_CACHE_PATH;
  const nowMs = (o.now || Date.now)();
  const nowIso = new Date(nowMs).toISOString();

  // Anonymous fast path — no network, no cache.
  if (!o.token || typeof o.token !== "string" || o.token.length === 0) {
    return { ...ANONYMOUS_RESULT, fetched_at: nowIso };
  }

  // Cache check.
  // bypassCache skips the short-circuit (forces network) but we still LOAD
  // the cache so we can fall back to it if the network call fails (stale-while-error).
  let cached = await _readCache(cachePath);
  if (!o.bypassCache && cached && !isCacheStale(cached, nowMs)) {
    return { ...cached, stale: false };
  }

  // Fetch (with cached fallback on failure).
  const fetchImpl = o.fetchImpl || fetch;
  const endpoint = o.endpoint || DEFAULT_ENTITLEMENTS_URL;
  const timeoutMs = o.timeoutMs || ENTITLEMENTS_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${o.token}`,
        "User-Agent": "frootai-orchard-cli/1.0",
      },
    });
    clearTimeout(timer);

    if (response.status === 401 || response.status === 403) {
      throw new OrchardCliError("auth_failed",
        `Entitlement check returned ${response.status} — token may be expired or revoked. Try \`frootai login\`.`,
        { status: response.status });
    }

    if (!response.ok) {
      // 5xx — fall back to cached (even if stale).
      if (cached) return { ...cached, stale: true };
      throw new OrchardCliError("entitlement_fetch_failed",
        `Entitlement check returned ${response.status}; no cached fallback available.`,
        { status: response.status });
    }

    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > ENTITLEMENTS_CACHE_MAX_BYTES) {
      throw new OrchardCliError("entitlement_fetch_failed",
        `Entitlement response > ${ENTITLEMENTS_CACHE_MAX_BYTES} bytes`,
        { bytes: Buffer.byteLength(text, "utf8") });
    }

    let parsed = parseEntitlements(text);
    if (!parsed) {
      throw new OrchardCliError("entitlement_fetch_failed",
        "Entitlement response did not parse as canonical shape.",
        { raw_sample: text.slice(0, 200) });
    }
    parsed = { ...parsed, fetched_at: nowIso, stale: false, anonymous: false };
    await _writeCache(cachePath, parsed);
    return parsed;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof OrchardCliError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (cached) {
      // Network failure — fall back to stale cache.
      return { ...cached, stale: true };
    }
    if (message.includes("abort")) {
      throw new OrchardCliError("timeout", `Entitlement check timed out after ${timeoutMs}ms`, { endpoint, timeoutMs });
    }
    throw new OrchardCliError("network_error", `Entitlement check failed: ${message}`, { endpoint, cause: message });
  }
}

/** Clear the on-disk entitlements cache. Returns true if file existed. */
async function clearEntitlementsCache(cachePath, io = fsP) {
  const p = cachePath || DEFAULT_ENTITLEMENTS_CACHE_PATH;
  try { await io.unlink(p); return true; }
  catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

module.exports = {
  DEFAULT_ENTITLEMENTS_URL,
  DEFAULT_ENTITLEMENTS_CACHE_PATH,
  ENTITLEMENTS_CACHE_TTL_MS,
  ENTITLEMENTS_CACHE_MAX_BYTES,
  ENTITLEMENTS_FETCH_TIMEOUT_MS,
  ENTITLEMENTS_VERSION,
  TIER_ENUM,
  TIER_RANK,
  KNOWN_ENTITLEMENTS,
  ANONYMOUS_RESULT,
  parseEntitlements,
  hasEntitlement,
  isTierAtLeast,
  isCacheStale,
  fetchEntitlements,
  clearEntitlementsCache,
};
