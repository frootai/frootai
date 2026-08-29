// @ts-check
/**
 * [H8.13] credentials-store.js — XDG-compliant credentials store for the
 * H8.13 OAuth2 device-flow CLI.
 *
 * Contract slice (from masterplan §3 row [H8.13]):
 *   tokens cached at `~/.config/frootai/credentials.json` 0600 perm
 *
 * Path resolution (XDG Base Directory spec compliant):
 *   1. `$XDG_CONFIG_HOME/frootai/credentials.json` if XDG_CONFIG_HOME is set
 *      AND is an absolute path
 *   2. else `$HOME/.config/frootai/credentials.json`
 *   3. On Windows, still use the same `~/.config/frootai/...` path per
 *      masterplan's verbatim wording (no AppData detour). The mode-0600
 *      enforcement is a no-op on Windows (NTFS doesn't honour POSIX modes
 *      via fs.chmod the same way), but the file IS still written + read
 *      cleanly; readers MUST treat a `mode > 0o600` finding as a warning
 *      on non-Windows only.
 *
 * Stored credentials shape (`Credentials`):
 *   {
 *     v: 1,                          // schema version
 *     access_token: string,          // bearer token (REQUIRED, >=8 chars)
 *     refresh_token: string|null,    // optional per RFC 8628
 *     token_type: string,            // "Bearer" by default
 *     expires_at: string|null,       // ISO timestamp; computed from
 *                                    //   obtained_at + expires_in at write
 *     scope: string|null,            // space-separated OAuth2 scopes
 *     subject: string|null,          // user id / sub claim
 *     email: string|null,
 *     tier: string,                  // "free" / "pro" / "team" / "enterprise"
 *     obtained_at: string,           // ISO timestamp of the device-flow
 *                                    //   token-response time
 *   }
 *
 * Security:
 *   - mode 0o600 enforced on every write (chmod after rename, POSIX only)
 *   - mode 0o600 enforced on every read (warn on stderr if loose; POSIX only)
 *   - atomic write: tmp file + rename + chmod
 *   - 8 KiB hard size cap on the file (JWTs are typically 2-4 KB)
 *   - access_token + refresh_token NEVER logged via `redactCredentials()`
 *     helper (returns subject + email + tier + expires_at + has_refresh)
 *
 * Backend doctrine (parallel to A4.12 token-store):
 *   - Default: file backend (paths above).
 *   - Memory backend (`buildMemoryBackend()`) for hermetic tests.
 *   - OS keychain (future): the public API stays backend-agnostic via
 *     the injectable `backend` opt with shape `{ get, set, delete }`.
 *
 * License: CC0-1.0.
 */
"use strict";

const path = require("node:path");
const os = require("node:os");
const { parseStrictJson } = require("../../lib/agent/strict-json.js");
const { createAtomicJsonFile, LocalStoreError } = require("../../lib/agent/atomic-json-store.js");

const CREDENTIALS_VERSION = 1;
const CREDENTIALS_FILE_MAX_BYTES = 8 * 1024;
const CREDENTIALS_FILE_MODE = 0o600;

/** Error carrying a sysexits exit code so handlers return the right number. */
class CredentialsStoreError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ exitCode?: number, cause?: Error, meta?: object }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "CredentialsStoreError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : 70;
    if (opts.cause) this.cause = opts.cause;
    if (opts.meta) this.meta = opts.meta;
  }
}

/**
 * Resolve the credentials.json path per XDG Base Directory spec.
 *
 * @param {object} [opts]
 * @param {Record<string,string|undefined>} [opts.env] — defaults to process.env
 * @param {() => string} [opts.homedir] — defaults to os.homedir
 * @returns {string}
 */
function resolveCredentialsPath(opts = {}) {
  const env = opts.env || process.env;
  const homedir = opts.homedir || (() => os.homedir());
  const xdg = env.XDG_CONFIG_HOME;
  if (typeof xdg === "string" && xdg.length > 0 && path.isAbsolute(xdg)) {
    return path.join(xdg, "frootai", "credentials.json");
  }
  return path.join(homedir(), ".config", "frootai", "credentials.json");
}

/**
 * Pure — parse + validate the credentials JSON blob. Never throws (returns
 * null on garbage). Drops fields that don't match the expected type.
 *
 * @param {string|null|undefined} raw
 * @returns {object|null}
 */
function parseCredentials(raw) {
  if (!raw) return null;
  let parsed;
  try { parsed = parseStrictJson(String(raw), "canonical credentials"); }
  catch { return null; }
  const keys = ["v", "access_token", "refresh_token", "token_type", "expires_at", "scope", "subject", "email", "tier", "obtained_at"];
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.getPrototypeOf(parsed) !== Object.prototype || Object.keys(parsed).sort().join("|") !== keys.sort().join("|")) return null;
  if (parsed.v !== CREDENTIALS_VERSION) return null;
  if (typeof parsed.access_token !== "string" || parsed.access_token.length < 8 || parsed.access_token.length > 8192 || !/^[\x21-\x7e]+$/u.test(parsed.access_token)) return null;
  return {
    v: CREDENTIALS_VERSION,
    access_token: parsed.access_token,
    refresh_token: typeof parsed.refresh_token === "string" ? parsed.refresh_token : null,
    token_type: typeof parsed.token_type === "string" ? parsed.token_type : "Bearer",
    expires_at: typeof parsed.expires_at === "string" ? parsed.expires_at : null,
    scope: typeof parsed.scope === "string" ? parsed.scope : null,
    subject: typeof parsed.subject === "string" ? parsed.subject : null,
    email: typeof parsed.email === "string" ? parsed.email : null,
    tier: typeof parsed.tier === "string" ? parsed.tier : "free",
    obtained_at: typeof parsed.obtained_at === "string" ? parsed.obtained_at : null,
  };
}

/**
 * Pure — redact a credentials object for safe logging. Strips access_token
 * + refresh_token. Always returns null when input is null.
 *
 * @param {object|null|undefined} creds
 * @returns {object|null}
 */
function redactCredentials(creds) {
  if (!creds) return null;
  return {
    subject: creds.subject || null,
    email: creds.email || null,
    tier: creds.tier || "free",
    token_type: creds.token_type || "Bearer",
    expires_at: creds.expires_at || null,
    scope: creds.scope || null,
    has_refresh: Boolean(creds.refresh_token),
    obtained_at: creds.obtained_at || null,
  };
}

/**
 * Pure — true if expires_at is in the past (with a 60s safety margin).
 * Returns false when expires_at is null/missing (treated as never-expires).
 *
 * @param {object|null|undefined} creds
 * @param {number} [nowMs]
 * @returns {boolean}
 */
function isCredentialsExpired(creds, nowMs) {
  if (!creds || !creds.expires_at) return false;
  const now = typeof nowMs === "number" ? nowMs : Date.now();
  const expMs = Date.parse(creds.expires_at);
  if (!Number.isFinite(expMs)) return false;
  return now >= (expMs - 60_000);
}

/**
 * Pure — compute expires_at ISO from a token response's `expires_in` (sec).
 * Returns null when expires_in is missing/0/negative.
 *
 * @param {number|undefined|null} expiresIn
 * @param {number} [nowMs]
 * @returns {string|null}
 */
function computeExpiresAt(expiresIn, nowMs) {
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) return null;
  const now = typeof nowMs === "number" ? nowMs : Date.now();
  return new Date(now + Math.floor(expiresIn) * 1000).toISOString();
}

/**
 * Pure — convert an OAuth2 device-flow token response into the on-disk
 * Credentials shape. The caller passes the parsed JSON body of the
 * `/auth/token` 200 response (per RFC 8628 §3.5) + optional userInfo bits.
 *
 * @param {object} tokenResponse — { access_token, token_type?, expires_in?, refresh_token?, scope? }
 * @param {object} [userInfo] — { subject?, email?, tier? }
 * @param {{ nowMs?: number }} [opts]
 * @returns {object} normalized Credentials object (NOT yet validated for `.set()` strictness)
 */
function fromTokenResponse(tokenResponse, userInfo = {}, opts = {}) {
  const now = typeof opts.nowMs === "number" ? opts.nowMs : Date.now();
  const t = tokenResponse || {};
  const u = userInfo || {};
  return {
    v: CREDENTIALS_VERSION,
    access_token: typeof t.access_token === "string" ? t.access_token : "",
    refresh_token: typeof t.refresh_token === "string" ? t.refresh_token : null,
    token_type: typeof t.token_type === "string" ? t.token_type : "Bearer",
    expires_at: computeExpiresAt(t.expires_in, now),
    scope: typeof t.scope === "string" ? t.scope : null,
    subject: typeof u.subject === "string" ? u.subject : null,
    email: typeof u.email === "string" ? u.email : null,
    tier: typeof u.tier === "string" ? u.tier : "free",
    obtained_at: new Date(now).toISOString(),
  };
}

/**
 * Build the default file-backed backend pinned to `credPath`. Pass an
 * `io` object to inject fs hooks for tests.
 *
 * @param {string} credPath
 * @param {object} [io] — requires genuine `lstat`; `stat` is never substituted
 */
function buildFileBackend(credPath, io = {}) {
  const p = credPath;
  const warnLooseMode = () => {
    const stderr = io.stderr || process.stderr;
    const message = "warning: credential file permissions are broader than 0600\n";
    if (typeof stderr === "function") stderr(message);
    else if (stderr && typeof stderr.write === "function") stderr.write(message);
  };
  const file = createAtomicJsonFile(p, { maximumBytes: CREDENTIALS_FILE_MAX_BYTES, mode: CREDENTIALS_FILE_MODE, io: Object.keys(io).length === 0 ? undefined : io, onLooseMode: warnLooseMode });

  function parseStored(value) {
    if (value === null) return null;
    const parsed = parseCredentials(JSON.stringify(value));
    if (!parsed) throw new CredentialsStoreError("invalid_credentials", "stored canonical credentials are malformed", { exitCode: 74 });
    return parsed;
  }

  function normalize(creds) {
    const parsed = parseCredentials(serializeCredentials(creds));
    if (!parsed) throw new CredentialsStoreError("invalid_input", "canonical credentials are malformed", { exitCode: 64 });
    return parsed;
  }

  function matches(left, right) {
    return left !== null && right !== null && serializeCredentials(left) === serializeCredentials(right);
  }

  function guard(current, conditions = {}) {
    if (conditions.expectedAbsent === true && current !== null) {
      throw new CredentialsStoreError("credential_conflict", "canonical credentials already exist", { exitCode: 75 });
    }
    if (conditions.expected !== undefined && !matches(current, normalize(conditions.expected))) {
      throw new CredentialsStoreError("credential_conflict", "canonical credentials changed", { exitCode: 75 });
    }
  }

  function lockedBackend(controls) {
    let current = parseStored(controls.current);
    return Object.freeze({
      name: "file",
      path: p,
      get: async () => current === null ? null : { ...current },
      set: async (creds, conditions = {}) => {
        guard(current, conditions);
        const normalized = normalize(creds);
        await controls.write(normalized);
        current = normalized;
        return { path: p, bytes: Buffer.byteLength(serializeCredentials(normalized), "utf8") };
      },
      delete: async (conditions = {}) => {
        guard(current, conditions);
        if (current === null) return false;
        await controls.clear();
        current = null;
        return true;
      },
    });
  }

  const backend = {
    name: "file",
    path: p,
    get: async () => parseStored(await file.read()),
    set: async (creds, conditions = {}) => file.transaction((controls) => lockedBackend(controls).set(creds, conditions)),
    delete: async (conditions = {}) => file.transaction((controls) => lockedBackend(controls).delete(conditions)),
    transaction: async (operation) => file.transaction((controls) => operation(lockedBackend(controls))),
  };
  return Object.freeze(backend);
}

/** Build an in-memory backend (for hermetic tests). */
function buildMemoryBackend(initial = null) {
  let stored = initial ? { ...initial } : null;
  let queue = Promise.resolve();
  function serialize(operation) {
    const next = queue.then(operation, operation);
    queue = next.then(() => undefined, () => undefined);
    return next;
  }
  function matches(left, right) {
    return left !== null && right !== null && serializeCredentials(left) === serializeCredentials(right);
  }
  function lockedBackend() {
    return Object.freeze({
      name: "memory",
      path: ":memory:",
      get: async () => (stored ? { ...stored } : null),
      set: async (creds, conditions = {}) => {
        if (conditions.expectedAbsent === true && stored !== null) throw new CredentialsStoreError("credential_conflict", "canonical credentials already exist", { exitCode: 75 });
        if (conditions.expected !== undefined && !matches(stored, conditions.expected)) throw new CredentialsStoreError("credential_conflict", "canonical credentials changed", { exitCode: 75 });
        stored = { ...creds, v: CREDENTIALS_VERSION };
        return { path: ":memory:", bytes: 0 };
      },
      delete: async (conditions = {}) => {
        if (conditions.expected !== undefined && !matches(stored, conditions.expected)) throw new CredentialsStoreError("credential_conflict", "canonical credentials changed", { exitCode: 75 });
        const had = !!stored;
        stored = null;
        return had;
      },
    });
  }
  const backend = {
    name: "memory",
    path: ":memory:",
    get: async () => (stored ? { ...stored } : null),
    set: async (creds, conditions = {}) => serialize(() => lockedBackend().set(creds, conditions)),
    delete: async (conditions = {}) => serialize(() => lockedBackend().delete(conditions)),
    transaction: async (operation) => serialize(() => operation(lockedBackend())),
  };
  return Object.freeze(backend);
}

/** Pure — serialize Credentials to the on-disk JSON string (newline-terminated). */
function serializeCredentials(creds) {
  if (!creds || typeof creds.access_token !== "string" || creds.access_token.length < 8) {
    throw new CredentialsStoreError("invalid_input", "serializeCredentials requires {access_token (>=8 chars), ...}", { exitCode: 64 });
  }
  return JSON.stringify({
    v: CREDENTIALS_VERSION,
    access_token: creds.access_token,
    refresh_token: typeof creds.refresh_token === "string" ? creds.refresh_token : null,
    token_type: typeof creds.token_type === "string" ? creds.token_type : "Bearer",
    expires_at: typeof creds.expires_at === "string" ? creds.expires_at : null,
    scope: typeof creds.scope === "string" ? creds.scope : null,
    subject: typeof creds.subject === "string" ? creds.subject : null,
    email: typeof creds.email === "string" ? creds.email : null,
    tier: typeof creds.tier === "string" ? creds.tier : "free",
    obtained_at: typeof creds.obtained_at === "string" ? creds.obtained_at : new Date().toISOString(),
  }, null, 0) + "\n";
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Read the stored credentials. Returns parsed + validated object OR null.
 *
 * @param {object} [opts]
 * @param {object} [opts.backend] — injectable; defaults to file backend at default path
 * @param {string} [opts.path] — overrides default file path
 * @param {Record<string,string|undefined>} [opts.env]
 * @param {() => string} [opts.homedir]
 * @param {object} [opts.io] — fs injection for file backend
 * @returns {Promise<object|null>}
 */
async function readCredentials(opts = {}) {
  try {
    if (opts.backend) return await opts.backend.get();
    const credPath = opts.path || resolveCredentialsPath({ env: opts.env, homedir: opts.homedir });
    return await buildFileBackend(credPath, opts.io || {}).get();
  } catch (error) {
    if (error instanceof LocalStoreError) throw new CredentialsStoreError("credentials_read_failed", "credential read failed", { exitCode: 74 });
    throw error;
  }
}

/**
 * Write credentials atomically with mode 0600.
 *
 * @param {object} creds
 * @param {object} [opts]
 * @returns {Promise<{ path: string, bytes: number }>}
 */
async function writeCredentials(creds, opts = {}) {
  const conditions = { expectedAbsent: opts.expectedAbsent === true, ...(opts.expected === undefined ? {} : { expected: opts.expected }) };
  try {
    if (opts.backend) return await opts.backend.set(creds, conditions);
    const credPath = opts.path || resolveCredentialsPath({ env: opts.env, homedir: opts.homedir });
    return await buildFileBackend(credPath, opts.io || {}).set(creds, conditions);
  } catch (error) {
    if (error instanceof LocalStoreError) throw new CredentialsStoreError("credentials_write_failed", "credential write failed", { exitCode: 75 });
    throw error;
  }
}

/**
 * Delete the credentials file. Returns true if a file existed and was removed.
 *
 * @param {object} [opts]
 * @returns {Promise<boolean>}
 */
async function deleteCredentials(opts = {}) {
  const conditions = opts.expected === undefined ? {} : { expected: opts.expected };
  try {
    if (opts.backend) return await opts.backend.delete(conditions);
    const credPath = opts.path || resolveCredentialsPath({ env: opts.env, homedir: opts.homedir });
    return await buildFileBackend(credPath, opts.io || {}).delete(conditions);
  } catch (error) {
    if (error instanceof LocalStoreError) throw new CredentialsStoreError("credentials_delete_failed", "credential delete failed", { exitCode: 75 });
    throw error;
  }
}

async function withCredentialsTransaction(opts = {}, operation) {
  const backend = opts.backend || buildFileBackend(opts.path || resolveCredentialsPath({ env: opts.env, homedir: opts.homedir }), opts.io || {});
  try {
    if (typeof backend.transaction === "function") return await backend.transaction(operation);
    return await operation(backend);
  } catch (error) {
    if (error instanceof LocalStoreError) throw new CredentialsStoreError("credentials_transaction_failed", "credential transaction failed", { exitCode: 75 });
    throw error;
  }
}

/** Check whether any non-expired credentials are stored. */
async function hasValidCredentials(opts = {}) {
  const c = await readCredentials(opts);
  if (!c) return false;
  return !isCredentialsExpired(c);
}

module.exports = {
  CREDENTIALS_VERSION,
  CREDENTIALS_FILE_MAX_BYTES,
  CREDENTIALS_FILE_MODE,
  CredentialsStoreError,
  resolveCredentialsPath,
  parseCredentials,
  redactCredentials,
  isCredentialsExpired,
  computeExpiresAt,
  fromTokenResponse,
  serializeCredentials,
  buildFileBackend,
  buildMemoryBackend,
  readCredentials,
  writeCredentials,
  deleteCredentials,
  withCredentialsTransaction,
  hasValidCredentials,
};
