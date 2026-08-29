// @ts-check
/**
 * A5.22 — Shared auth: VSCode extension reads the SAME `~/.frootai/.token` +
 * `~/.frootai/config.json` files the CLI writes (A4.9-A4.12). When a user
 * runs `frootai login` in their terminal, the VSCode extension picks up the
 * token on next tree-view refresh — no second sign-in.
 *
 * Doctrine:
 *   - NEVER throws — every read returns { signed_in, anonymous?, error? }.
 *   - NEVER writes — the extension reads token state for UI gating only.
 *     Sign-in itself MUST be performed via the CLI login flow (A4.10 uses
 *     the browser + device code, which only the CLI can spawn locally with
 *     proper PKCE handling).
 *   - NEVER caches across calls — the tree-view refresh might be the first
 *     time we notice a `frootai login` from terminal. Always re-read.
 *   - NEVER surfaces raw access_token in any returned object — only the
 *     redacted form (last 4 chars) for UX confirmation.
 *
 * What this module returns (the AuthSnapshot):
 *   {
 *     signed_in: boolean,
 *     anonymous: boolean,
 *     expired: boolean,
 *     subject: string|null,             // sub claim, only when signed in
 *     email: string|null,               // email claim, only when signed in
 *     tier: string,                     // free|pro|team|business|enterprise (default free)
 *     entitlements: string[],           // from cached entitlements.json, [] if missing
 *     token_redacted: string|null,      // e.g. "….a3f9"
 *     expires_at: string|null,          // ISO timestamp or null
 *     config_path: string,
 *     token_path: string,
 *     entitlements_cache_path: string,
 *   }
 *
 * Why the redacted token form:
 *   - The tree view's "Signed in as X · last4=… " badge needs SOMETHING to
 *     hint at which token is loaded (multiple machines = multiple tokens).
 *   - Returning the full token would be a footgun (it could leak into logs,
 *     stack traces, or screen-shared video).
 */
"use strict";

const path = require("node:path");
const os = require("node:os");

const {
  readToken,
  isTokenExpired,
  DEFAULT_TOKEN_PATH,
} = require("../../../cli/lib/auth/token-store");
const {
  readConfigFile,
  DEFAULT_CONFIG_PATH,
} = require("../../../cli/lib/auth/config-store");

const DEFAULT_FROOTAI_DIR = path.join(os.homedir(), ".frootai");
const DEFAULT_ENTITLEMENTS_CACHE_PATH = path.join(DEFAULT_FROOTAI_DIR, "entitlements.json");

const ANONYMOUS_SNAPSHOT_DEFAULTS = Object.freeze({
  signed_in: false,
  anonymous: true,
  expired: false,
  subject: null,
  email: null,
  tier: "free",
  entitlements: Object.freeze([]),
  token_redacted: null,
  expires_at: null,
  // A8.28 — enterprise-tier surface (null for anonymous + non-SSO users).
  org_id: null,
  sso_provider: null,
  home_region: null,
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Pure: redact an access_token to a UX-safe last-4-chars display.
 *
 * @param {unknown} accessToken
 * @returns {string|null}  e.g. "…a3f9" or null when not a string
 */
function redactAccessToken(accessToken) {
  if (typeof accessToken !== "string" || accessToken.length === 0) return null;
  if (accessToken.length <= 4) return "…" + accessToken;
  return "…" + accessToken.slice(-4);
}

/**
 * Pure: extract the safe display fields from a parsed token object.
 *
 * @param {object} token   shape from token-store.readToken: { access_token, refresh_token?, expires_at?, subject?, email?, tier? }
 * @returns {{ token_redacted: string|null, expires_at: string|null, subject: string|null, email: string|null, tier: string }}
 */
function buildTokenDisplay(token) {
  if (!token || typeof token !== "object") {
    return { token_redacted: null, expires_at: null, subject: null, email: null, tier: "free" };
  }
  return {
    token_redacted: redactAccessToken(token.access_token),
    expires_at: typeof token.expires_at === "string" ? token.expires_at : null,
    subject: typeof token.subject === "string" ? token.subject : null,
    email: typeof token.email === "string" ? token.email : null,
    tier: typeof token.tier === "string" ? token.tier : "free",
  };
}

/**
 * Pure: read the entitlements JSON cache off disk (CLI A4.11 wrote it).
 * Returns the parsed entitlements array or [] on any failure.
 *
 * @param {string} cachePath
 * @param {(p: string) => Promise<string>} readFileFn  injected for tests
 * @returns {Promise<string[]>}
 */
async function readEntitlementsCache(cachePath, readFileFn) {
  try {
    const text = await readFileFn(cachePath);
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.entitlements)) {
      return parsed.entitlements.filter((e) => typeof e === "string");
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * A8.28 — Read the full cached entitlements record (entitlements + enterprise
 * fields). Returns `{entitlements, sso_provider, home_region, org_id}` with
 * defaults when fields are missing. NEVER throws.
 *
 * @param {string} cachePath
 * @param {(p: string) => Promise<string>} readFileFn
 * @returns {Promise<{entitlements: string[], sso_provider: string|null, home_region: string|null, org_id: string|null}>}
 */
async function readEntitlementsCacheFull(cachePath, readFileFn) {
  const HOME_REGIONS_ALLOWED = ["us-east", "eu-west", "ap-south"];
  const empty = { entitlements: [], sso_provider: null, home_region: null, org_id: null };
  try {
    const text = await readFileFn(cachePath);
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return empty;
    return {
      entitlements: Array.isArray(parsed.entitlements)
        ? parsed.entitlements.filter((e) => typeof e === "string")
        : [],
      sso_provider: typeof parsed.sso_provider === "string" ? parsed.sso_provider : null,
      home_region: (typeof parsed.home_region === "string" && HOME_REGIONS_ALLOWED.includes(parsed.home_region))
        ? parsed.home_region
        : null,
      org_id: typeof parsed.org_id === "string" ? parsed.org_id : null,
    };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Snapshot reader
// ---------------------------------------------------------------------------

/**
 * Read the current AuthSnapshot from disk.
 *
 * NEVER throws. NEVER mutates. Returns a frozen-shape object.
 *
 * @param {object} [opts]
 * @param {string} [opts.frootaiDir]
 * @param {string} [opts.tokenPath]
 * @param {string} [opts.configPath]
 * @param {string} [opts.entitlementsCachePath]
 * @param {Function} [opts.readToken]
 * @param {Function} [opts.readConfigFile]
 * @param {Function} [opts.readFileImpl]
 * @param {Function} [opts.now]
 * @returns {Promise<object>}  AuthSnapshot
 */
async function readAuthSnapshot(opts) {
  const o = opts || {};
  const dir = o.frootaiDir || DEFAULT_FROOTAI_DIR;
  const tokenPath = o.tokenPath || path.join(dir, ".token");
  const configPath = o.configPath || path.join(dir, "config.json");
  const entCachePath = o.entitlementsCachePath || path.join(dir, "entitlements.json");
  const _readToken = o.readToken || readToken;
  const _readConfig = o.readConfigFile || readConfigFile;
  const _readFile = o.readFileImpl || ((p) => require("node:fs/promises").readFile(p, "utf8"));
  const now = o.now || (() => Date.now());

  // Read config (always returns SOMETHING — config-store seeds defaults).
  let config = null;
  try {
    config = await _readConfig({ configPath });
  } catch { /* read errors → treat as default config */ }

  // Read token. NEVER throws — readToken catches its own errors.
  let token = null;
  try {
    token = await _readToken({ tokenPath });
  } catch { /* fall through to anonymous */ }

  if (!token || !token.access_token) {
    return Object.freeze({
      ...ANONYMOUS_SNAPSHOT_DEFAULTS,
      entitlements: [],
      config_path: configPath,
      token_path: tokenPath,
      entitlements_cache_path: entCachePath,
    });
  }

  const display = buildTokenDisplay(token);
  const expired = isTokenExpired(token, now());
  // A8.28 — read the FULL cache so we can surface enterprise fields
  // (sso_provider, home_region, org_id) alongside the entitlements array.
  const cacheFull = await readEntitlementsCacheFull(entCachePath, _readFile);

  return Object.freeze({
    signed_in: !expired,
    anonymous: false,
    expired,
    subject: display.subject,
    email: display.email,
    tier: display.tier,
    entitlements: cacheFull.entitlements,
    token_redacted: display.token_redacted,
    expires_at: display.expires_at,
    org_id: cacheFull.org_id,
    sso_provider: cacheFull.sso_provider,
    home_region: cacheFull.home_region,
    config_path: configPath,
    token_path: tokenPath,
    entitlements_cache_path: entCachePath,
  });
}

/**
 * Pure: classify the snapshot into a one-line status badge for the tree view.
 *
 * @param {object} snapshot
 * @returns {{ kind: "anonymous"|"signed_in"|"expired", label: string, hint: string }}
 */
function classifyAuthBadge(snapshot) {
  if (!snapshot || snapshot.anonymous) {
    return {
      kind: "anonymous",
      label: "Anonymous",
      hint: "Run `frootai login` in a terminal to enable paid features.",
    };
  }
  if (snapshot.expired) {
    return {
      kind: "expired",
      label: `${snapshot.email || snapshot.subject || "Signed-in user"} (token expired)`,
      hint: "Run `frootai login` to refresh your access token.",
    };
  }
  return {
    kind: "signed_in",
    label: `${snapshot.email || snapshot.subject || "Signed in"} · ${snapshot.tier}`,
    hint: snapshot.entitlements.length > 0
      ? `Entitlements: ${snapshot.entitlements.join(", ")}`
      : "No paid entitlements yet — upgrade at https://frootai.dev/upgrade",
  };
}

/**
 * Convenience: return true if the snapshot grants a specific entitlement.
 *
 * @param {object} snapshot
 * @param {string} entitlement
 * @returns {boolean}
 */
function snapshotHasEntitlement(snapshot, entitlement) {
  if (!snapshot || !Array.isArray(snapshot.entitlements)) return false;
  if (typeof entitlement !== "string" || entitlement.length === 0) return false;
  return snapshot.entitlements.includes(entitlement);
}

module.exports = {
  // Snapshot
  readAuthSnapshot,
  classifyAuthBadge,
  snapshotHasEntitlement,
  // Pure helpers
  buildTokenDisplay,
  redactAccessToken,
  readEntitlementsCache,
  readEntitlementsCacheFull,
  // Constants
  DEFAULT_FROOTAI_DIR,
  DEFAULT_TOKEN_PATH,
  DEFAULT_CONFIG_PATH,
  DEFAULT_ENTITLEMENTS_CACHE_PATH,
  ANONYMOUS_SNAPSHOT_DEFAULTS,
};
