// @ts-check
/**
 * [H8.14] entitlements.js — `GET /api/entitlements` pre-flight check.
 *
 * Contract (verbatim from masterplan §3 row [H8.14]):
 *   Entitlements check: every paid subcommand pre-flights `GET
 *   /api/entitlements` with cached token; on 401 prompt re-login; on
 *   `not-pro` print clear upgrade URL
 *
 * Library module (not a command handler — there is no `frootai entitlements`
 * subcommand). Plugs directly into the H8.10 commit handler's
 * `entitlementsImpl(env)` seam — the handler's `defaultEntitlementsCheck`
 * stub gets replaced by `buildEntitlementsImpl({...})` once a real OAuth
 * token is available (today's H8.10 still defaults to the env-override
 * stub; the wiring point in this ship is the commit handler's seam — we
 * REPLACE its default impl when the credentials store has a non-expired
 * token, and FALL BACK to the env-override stub otherwise so local-dev
 * `FROOTAI_PRO=1` still works without OAuth).
 *
 * Pipeline (per check):
 *   1. read credentials from store (XDG path or injected backend)
 *   2. if no creds OR expired → return `{ok:false, reason:"no_token",
 *      message:"Please run \`frootai login\` first."}`
 *   3. GET `<api-base>/entitlements` with `Authorization: Bearer <token>`
 *      (timeout per --request-timeout-ms; default 10s)
 *   4. on 200 + `{tier, scopes?, features?}` → check `tier` against the
 *      required tier (default "pro"); if insufficient, return ok:false
 *      with `not_pro` reason + the `upgrade_url` from the response body
 *      (server-provided) or the default `https://frootai.dev/pricing`
 *   5. on 401 → return ok:false with `unauthorized` reason +
 *      "credentials rejected; run \`frootai login\` again" message
 *   6. on 403 → return ok:false with `forbidden` reason
 *   7. on 5xx → return ok:false with `server_error` reason (caller decides
 *      whether to fail-open in --no-network mode; today's commit handler
 *      treats every ok:false as block)
 *   8. tier comparison via `tierAtLeast(actual, required)` per
 *      TIER_RANK ordering (free=0 < pro=10 < team=20 < enterprise=30)
 *
 * Two surfaces:
 *
 *   1. Programmatic `checkEntitlements({apiBase, requiredTier, ...},
 *      deps)` — pure + injectable. Returns the EntitlementResult shape:
 *      `{ok, tier, scopes, features, upgrade_url?, reason?, status?,
 *      message?}`. Caller maps ok:false → NOPERM 77 (matches the H8.10
 *      commit handler's behavior).
 *
 *   2. `buildEntitlementsImpl({apiBase?, requiredTier?, fetchImpl?,
 *      credentialsStore?, fallbackEnvCheck?, requestTimeoutMs?}) →
 *      (env) → Promise<{ok, ...}>` — drop-in replacement for the
 *      `defaultEntitlementsCheck(env)` stub in H8.10. Honors env-override
 *      `FROOTAI_PRO=1` first (preserves local-dev flow), THEN reads
 *      credentials, THEN HTTP-checks `/entitlements`. Returns the same
 *      `{ok, tier, message}` shape the H8.10 handler already consumes
 *      so no commit-handler changes are needed.
 *
 * License: CC0-1.0.
 */
"use strict";

/** Default config. */
const DEFAULT_API_BASE = "https://frootai.dev/api";
const DEFAULT_UPGRADE_URL = "https://frootai.dev/pricing";
const DEFAULT_REQUIRED_TIER = "pro";
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = "frootai-cli/1.0 (+https://frootai.dev)";

/** Tier ordering (higher = more access). Lowercased on compare. */
const TIER_RANK = Object.freeze({
  free: 0,
  pro: 10,
  team: 20,
  enterprise: 30,
});

/** Frozen set of allowed reason codes (for downstream switch statements). */
const REASON_CODES = Object.freeze({
  NO_TOKEN: "no_token",
  TOKEN_EXPIRED: "token_expired",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  NOT_PRO: "not_pro",
  MALFORMED_RESPONSE: "malformed_response",
  SERVER_ERROR: "server_error",
  NETWORK_ERROR: "network_error",
  ENV_PRO: "env_pro",   // ok:true reason — local-dev override
  OK: "ok",             // ok:true reason — happy path
});

/**
 * Pure — case-insensitive comparison via TIER_RANK. Unknown tiers rank 0.
 *
 * @param {string|null|undefined} actual
 * @param {string|null|undefined} required
 * @returns {boolean}
 */
function tierAtLeast(actual, required) {
  const a = typeof actual === "string" ? actual.toLowerCase() : "";
  const r = typeof required === "string" ? required.toLowerCase() : "free";
  const aRank = Object.prototype.hasOwnProperty.call(TIER_RANK, a) ? TIER_RANK[a] : 0;
  const rRank = Object.prototype.hasOwnProperty.call(TIER_RANK, r) ? TIER_RANK[r] : 0;
  return aRank >= rRank;
}

/**
 * Pure — build a human-readable upgrade message given the actual tier +
 * a server-provided upgrade_url (falls back to DEFAULT_UPGRADE_URL).
 *
 * @param {string|null|undefined} actualTier
 * @param {string|null|undefined} requiredTier
 * @param {string|null|undefined} upgradeUrl
 * @returns {string}
 */
function buildUpgradeMessage(actualTier, requiredTier, upgradeUrl) {
  const a = typeof actualTier === "string" && actualTier.length > 0 ? actualTier : "free";
  const r = typeof requiredTier === "string" && requiredTier.length > 0 ? requiredTier : "pro";
  const url = typeof upgradeUrl === "string" && upgradeUrl.length > 0 ? upgradeUrl : DEFAULT_UPGRADE_URL;
  return `${r} tier required (current: ${a}). Upgrade at ${url}`;
}

/**
 * Pure — parse + validate an /entitlements 200 response. Returns null on
 * malformed shape (caller treats as a fatal `malformed_response`).
 *
 * Accepted shape (any of):
 *   { tier: "pro", scopes?: string[], features?: string[], upgrade_url?: string }
 *
 * @param {any} body
 * @returns {{ tier: string, scopes: string[], features: string[], upgrade_url: string|null }|null}
 */
function parseEntitlementsBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (typeof body.tier !== "string" || body.tier.length === 0) return null;
  return {
    tier: body.tier,
    scopes: Array.isArray(body.scopes) ? body.scopes.filter((s) => typeof s === "string") : [],
    features: Array.isArray(body.features) ? body.features.filter((s) => typeof s === "string") : [],
    upgrade_url: typeof body.upgrade_url === "string" ? body.upgrade_url : null,
  };
}

/**
 * Build the `Authorization: Bearer <token>` header value. Pure.
 *
 * @param {object|null|undefined} creds
 * @returns {string|null}
 */
function bearerHeader(creds) {
  if (!creds || typeof creds.access_token !== "string" || creds.access_token.length < 8) return null;
  const tokenType = typeof creds.token_type === "string" && creds.token_type.length > 0 ? creds.token_type : "Bearer";
  return `${tokenType} ${creds.access_token}`;
}

/**
 * GET <apiBase>/entitlements with the bearer token. Returns `{ status,
 * body }` on any HTTP response; throws a tagged Error on network failure.
 *
 * @param {typeof fetch} fetchImpl
 * @param {string} apiBase
 * @param {string} bearerAuth
 * @param {number} [reqTimeoutMs]
 */
async function fetchEntitlements(fetchImpl, apiBase, bearerAuth, reqTimeoutMs) {
  const url = `${apiBase.replace(/\/+$/, "")}/entitlements`;
  const controller = new AbortController();
  const reqTimer = setTimeout(() => controller.abort(), reqTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Authorization": bearerAuth,
        "Accept": "application/json",
        "User-Agent": DEFAULT_USER_AGENT,
      },
    });
  } catch (err) {
    clearTimeout(reqTimer);
    const tagged = new Error(`network error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`);
    /** @type {any} */ (tagged).code = "network_error";
    /** @type {any} */ (tagged).url = url;
    throw tagged;
  }
  clearTimeout(reqTimer);
  let body = null;
  let raw = "";
  try { raw = await res.text(); } catch { raw = ""; }
  if (raw && raw.length > 0) {
    try { body = JSON.parse(raw); } catch { body = null; }
  }
  return { status: res.status, body, raw };
}

/**
 * Programmatic — check entitlements end-to-end. Pure + injectable.
 *
 * @param {object} opts
 * @param {string} [opts.apiBase]                  — default https://frootai.dev/api
 * @param {string} [opts.requiredTier]             — default "pro"
 * @param {string} [opts.defaultUpgradeUrl]        — default https://frootai.dev/pricing
 * @param {number} [opts.requestTimeoutMs]
 * @param {object} [deps]
 * @param {typeof fetch} [deps.fetchImpl]
 * @param {object} [deps.credentialsStore]         — needs readCredentials + isCredentialsExpired
 * @param {object} [deps.credentialsBackend]
 * @param {string} [deps.credentialsPath]
 * @param {Record<string,string|undefined>} [deps.env]
 * @param {() => number} [deps.now]
 * @returns {Promise<{ok: boolean, tier: string|null, scopes: string[], features: string[], upgrade_url: string|null, reason: string, status: number|null, message: string}>}
 */
async function checkEntitlements(opts = {}, deps = {}) {
  const apiBase = opts.apiBase || DEFAULT_API_BASE;
  const requiredTier = opts.requiredTier || DEFAULT_REQUIRED_TIER;
  const defaultUpgradeUrl = opts.defaultUpgradeUrl || DEFAULT_UPGRADE_URL;
  // Honor explicit `fetchImpl: null` (test-only override to force the
  // "no fetch available" path); otherwise fall back to the global fetch
  // when on Node 18+.
  const fetchImpl = ("fetchImpl" in deps)
    ? deps.fetchImpl
    : (typeof fetch === "function" ? fetch : null);
  const credentialsStore = deps.credentialsStore || require("./credentials-store.js");
  const now = deps.now || Date.now;

  // 1. Load credentials.
  let creds;
  try {
    creds = await credentialsStore.readCredentials({
      backend: deps.credentialsBackend,
      path: deps.credentialsPath,
      env: deps.env,
    });
  } catch (err) {
    return result(false, null, REASON_CODES.NO_TOKEN, null,
      `failed to read credentials: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!creds) {
    return result(false, null, REASON_CODES.NO_TOKEN, null,
      "no credentials found. Run `frootai login` to authenticate.");
  }

  // 2. Expiry check (60s safety margin baked into store).
  if (credentialsStore.isCredentialsExpired(creds, now())) {
    return result(false, creds.tier || null, REASON_CODES.TOKEN_EXPIRED, null,
      "cached credentials have expired. Run `frootai login` to re-authenticate.");
  }

  // 3. fetch availability.
  if (typeof fetchImpl !== "function") {
    return result(false, creds.tier || null, REASON_CODES.NETWORK_ERROR, null,
      "no fetch implementation available (require Node 18+ or pass deps.fetchImpl)");
  }

  // 4. HTTP check.
  const auth = bearerHeader(creds);
  if (!auth) {
    return result(false, creds.tier || null, REASON_CODES.NO_TOKEN, null,
      "stored credentials are malformed (missing access_token)");
  }
  /** @type {Awaited<ReturnType<typeof fetchEntitlements>>} */
  let res;
  try {
    res = await fetchEntitlements(fetchImpl, apiBase, auth, opts.requestTimeoutMs);
  } catch (err) {
    return result(false, creds.tier || null, REASON_CODES.NETWORK_ERROR, null,
      err instanceof Error ? err.message : String(err));
  }

  if (res.status === 200) {
    const parsed = parseEntitlementsBody(res.body);
    if (!parsed) {
      return result(false, creds.tier || null, REASON_CODES.MALFORMED_RESPONSE, res.status,
        `/entitlements returned 200 but the body was not a valid entitlements object`);
    }
    if (!tierAtLeast(parsed.tier, requiredTier)) {
      return {
        ok: false,
        tier: parsed.tier,
        scopes: parsed.scopes,
        features: parsed.features,
        upgrade_url: parsed.upgrade_url || defaultUpgradeUrl,
        reason: REASON_CODES.NOT_PRO,
        status: res.status,
        message: buildUpgradeMessage(parsed.tier, requiredTier, parsed.upgrade_url || defaultUpgradeUrl),
      };
    }
    return {
      ok: true,
      tier: parsed.tier,
      scopes: parsed.scopes,
      features: parsed.features,
      upgrade_url: parsed.upgrade_url || null,
      reason: REASON_CODES.OK,
      status: res.status,
      message: `${parsed.tier} entitlement verified`,
    };
  }

  if (res.status === 401) {
    return result(false, creds.tier || null, REASON_CODES.UNAUTHORIZED, res.status,
      "credentials rejected (401). Run `frootai login` again to refresh your session.");
  }

  if (res.status === 403) {
    return result(false, creds.tier || null, REASON_CODES.FORBIDDEN, res.status,
      "access forbidden (403) for this account.");
  }

  if (res.status >= 500) {
    return result(false, creds.tier || null, REASON_CODES.SERVER_ERROR, res.status,
      `/entitlements returned server error ${res.status}. Try again shortly.`);
  }

  return result(false, creds.tier || null, REASON_CODES.SERVER_ERROR, res.status,
    `/entitlements returned unexpected status ${res.status}`);
}

function result(ok, tier, reason, status, message) {
  return { ok, tier, scopes: [], features: [], upgrade_url: null, reason, status, message };
}

/**
 * Build an `entitlementsImpl(env)` function that's a drop-in replacement
 * for the H8.10 commit handler's `defaultEntitlementsCheck(env)` stub.
 *
 * Behavior (in order):
 *   1. If `env.FROOTAI_PRO === "1"|"true"` → return ok:true (local-dev
 *      override; preserves the existing H8.10 behavior so no
 *      commit-handler changes are needed).
 *   2. Else delegate to `checkEntitlements(opts, deps)` and return the
 *      result in the {ok, tier, message} shape the commit handler reads.
 *      `upgrade_url` is appended to `message` when ok:false + present.
 *
 * @param {object} [opts]
 * @param {string} [opts.apiBase]
 * @param {string} [opts.requiredTier]
 * @param {string} [opts.defaultUpgradeUrl]
 * @param {number} [opts.requestTimeoutMs]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {object} [opts.credentialsStore]
 * @param {object} [opts.credentialsBackend]
 * @param {string} [opts.credentialsPath]
 * @param {boolean} [opts.honorEnvOverride] — default true; pass false to disable the FROOTAI_PRO env bypass
 * @returns {(env: Record<string,string|undefined>) => Promise<{ ok: boolean, tier: string, message: string, reason?: string, upgrade_url?: string|null, status?: number|null }>}
 */
function buildEntitlementsImpl(opts = {}) {
  const honorEnv = opts.honorEnvOverride !== false;
  return async function entitlementsImpl(env) {
    const e = env || {};
    if (honorEnv && (e.FROOTAI_PRO === "1" || e.FROOTAI_PRO === "true")) {
      return {
        ok: true,
        tier: "pro-env",
        message: "Pro+ via FROOTAI_PRO env override",
        reason: REASON_CODES.ENV_PRO,
      };
    }
    const r = await checkEntitlements(opts, {
      fetchImpl: opts.fetchImpl,
      credentialsStore: opts.credentialsStore,
      credentialsBackend: opts.credentialsBackend,
      credentialsPath: opts.credentialsPath,
      env: e,
    });
    return {
      ok: r.ok,
      tier: r.tier || "free",
      message: r.message,
      reason: r.reason,
      upgrade_url: r.upgrade_url || null,
      status: r.status,
    };
  };
}

module.exports = {
  DEFAULT_API_BASE,
  DEFAULT_UPGRADE_URL,
  DEFAULT_REQUIRED_TIER,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  TIER_RANK,
  REASON_CODES,
  tierAtLeast,
  buildUpgradeMessage,
  parseEntitlementsBody,
  bearerHeader,
  fetchEntitlements,
  checkEntitlements,
  buildEntitlementsImpl,
};
