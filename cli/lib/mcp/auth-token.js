// @ts-check
/**
 * FAI MCP CLI — auth-token adapter (M4.27 ship).
 *
 * Bridges the M4 federation surface to the existing CLI auth surface
 * shipped at H8.13 (`cli/commands/auth/credentials-store.js`). The
 * H8.13 store already implements the XDG-compliant 0600-permissioned
 * `~/.config/frootai/credentials.json` reader / writer / redactor; we
 * reuse it here rather than maintaining a parallel `~/.frootai/.token`
 * file (the masterplan row's literal phrasing) so there is exactly ONE
 * canonical token store on disk.
 *
 * Doctrine #6 (token never logged):
 *   - `redactToken(value)` collapses every token to a 4-char-prefix +
 *     4-char-suffix shape (`abcd…wxyz`) for ANY narration that mentions
 *     the value at all. Tokens shorter than 12 chars become `***<N>`.
 *   - `buildAuthHeader(auth)` is the ONLY function that constructs the
 *     full `<type> <token>` Authorization header. Its sibling
 *     `redactAuthHeader(header)` produces the safe-for-logging variant.
 *   - `loadMarketplaceAuth(deps)` returns `{ token, tokenType, ...meta,
 *     redacted: { ... } }`. Callers MUST narrate via `auth.redacted`,
 *     NEVER via `auth.token`. The verbose telemetry envelope (M4.25)
 *     consumes `auth.redacted` so the wire-format never carries the
 *     bearer secret.
 *
 * Failure shapes:
 *   - credentials file absent → resolves to `null` (NOT an error)
 *   - credentials malformed   → resolves to `null` (the H8.13 reader is
 *                               tolerant; corrupted files are treated as
 *                               "no auth available" so the air-gap path
 *                               keeps working)
 *   - credentials expired     → resolves to `null` so the marketplace
 *                               request falls back to the unauthenticated
 *                               surface; expired-token refresh is the
 *                               H8.14 row's job, not M4.27's
 *
 * Injection contract (tests):
 *   `deps.readCredentials` — async () => Credentials|null
 *   `deps.env`             — env-var override (XDG_CONFIG_HOME)
 *   `deps.homedir`         — () => string  (overrides os.homedir)
 *   `deps.now`             — () => epoch ms (deterministic expiry tests)
 */
"use strict";

const credentialsStore = require("../../commands/auth/credentials-store");

/**
 * Mask a token for safe logging. Pure.
 *
 * @param {unknown} value
 * @returns {string}
 */
function redactToken(value) {
  if (typeof value !== "string" || value.length === 0) return "<none>";
  if (value.length < 12) return `***<${value.length}>`;
  // 4 chars at each end keep enough entropy to recognise reuse-of-token
  // across log lines without enabling token reconstruction.
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/**
 * Mask an Authorization header for safe logging. Pure.
 *
 * @param {string|null|undefined} header
 * @returns {string}
 */
function redactAuthHeader(header) {
  if (typeof header !== "string" || header.length === 0) return "<none>";
  // Header shape: `<type> <token>` (RFC 7235 §2.1). If we can't split,
  // treat the whole string as opaque and redact aggressively.
  const sp = header.indexOf(" ");
  if (sp < 1) return redactToken(header);
  const type = header.slice(0, sp);
  const value = header.slice(sp + 1);
  return `${type} ${redactToken(value)}`;
}

/**
 * Build the Authorization header from a resolved auth object. Pure.
 * Returns null when `auth` is missing the bearer token.
 *
 * @param {{ token?: string, tokenType?: string }|null|undefined} auth
 * @returns {string|null}
 */
function buildAuthHeader(auth) {
  if (!auth || typeof auth.token !== "string" || auth.token.length === 0) return null;
  const type = (typeof auth.tokenType === "string" && auth.tokenType.length > 0)
    ? auth.tokenType : "Bearer";
  return `${type} ${auth.token}`;
}

/**
 * Build the safe-for-logging redacted summary of a resolved auth object.
 * Pure — never includes `auth.token` or `auth.refresh_token`.
 *
 * @param {object|null|undefined} auth
 * @returns {object|null}
 */
function buildRedactedSummary(auth) {
  if (!auth) return null;
  return {
    tokenPreview: redactToken(auth.token),
    tokenType: typeof auth.tokenType === "string" ? auth.tokenType : "Bearer",
    subject: typeof auth.subject === "string" ? auth.subject : null,
    email: typeof auth.email === "string" ? auth.email : null,
    tier: typeof auth.tier === "string" ? auth.tier : "free",
    expiresAt: typeof auth.expiresAt === "string" ? auth.expiresAt : null,
  };
}

/**
 * Load the marketplace auth from the existing CLI credentials store.
 * Resolves to a structured auth object (with redacted-summary baked in)
 * OR `null` when no usable credentials are on disk.
 *
 * Tests inject `deps.readCredentials` to substitute the file backend
 * with an in-memory roster; production callers omit it and the H8.13
 * file backend is used.
 *
 * @param {object} [deps]
 * @returns {Promise<{ token: string, tokenType: string, subject: string|null, email: string|null, tier: string, expiresAt: string|null, redacted: object } | null>}
 */
async function loadMarketplaceAuth(deps) {
  const d = deps || {};
  const reader = (typeof d.readCredentials === "function")
    ? d.readCredentials
    : () => credentialsStore.readCredentials({ env: d.env, homedir: d.homedir ? () => d.homedir : undefined });
  let creds;
  try { creds = await reader(); } catch { return null; }
  if (!creds || typeof creds.access_token !== "string" || creds.access_token.length === 0) return null;
  const nowMs = (typeof d.now === "function") ? d.now() : Date.now();
  if (credentialsStore.isCredentialsExpired(creds, nowMs)) return null;

  const auth = {
    token: creds.access_token,
    tokenType: typeof creds.token_type === "string" && creds.token_type.length > 0
      ? creds.token_type : "Bearer",
    subject: typeof creds.subject === "string" ? creds.subject : null,
    email: typeof creds.email === "string" ? creds.email : null,
    tier: typeof creds.tier === "string" ? creds.tier : "free",
    expiresAt: typeof creds.expires_at === "string" ? creds.expires_at : null,
  };
  return Object.freeze({ ...auth, redacted: Object.freeze(buildRedactedSummary(auth)) });
}

module.exports = {
  redactToken,
  redactAuthHeader,
  buildAuthHeader,
  buildRedactedSummary,
  loadMarketplaceAuth,
};
