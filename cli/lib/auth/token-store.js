// @ts-check
/**
 * FAI CLI auth — token store at ~/.frootai/.token (mode 600).
 *
 * Stores: { v: 1, access_token, refresh_token, expires_at, subject, email, tier }
 *
 * Backend doctrine (A4.12):
 *   - Default: file-backed at ~/.frootai/.token with mode 0o600 (owner-only read/write)
 *   - Future: OS keychain via keytar (macOS Keychain / Windows Credential Manager / Linux Secret Service)
 *   - A4.12 ships the SHAPE + interface; keytar plugs in via the injectable
 *     `backend` opt with shape { get(), set(token), delete() }
 *
 * Security guards:
 *   - mode 0o600 enforced on every write (chmod after rename)
 *   - mode check on read — if file mode > 0o600 → warning to stderr (not blocking)
 *     because file mode is often loose on Windows (FAT/NTFS don't enforce POSIX modes)
 *   - Token NEVER logged — only subject + email + tier surface in CLI output
 *   - File written atomically (tmp + rename + chmod)
 */
"use strict";

const path = require("node:path");
const os = require("node:os");
const { OrchardCliError } = require("../orchard/cli-error");
const { parseStrictJson } = require("../agent/strict-json.js");
const { createAtomicJsonFile, LocalStoreError } = require("../agent/atomic-json-store.js");

const DEFAULT_TOKEN_PATH = path.join(os.homedir(), ".frootai", ".token");
const TOKEN_VERSION = 1;
const TOKEN_FILE_MAX_BYTES = 8 * 1024; // 8 KiB — JWTs are typically 2-4 KB
const TOKEN_FILE_MODE = 0o600;

/** Pure — parse + validate the token blob. Never throws (returns null on garbage). */
function parseToken(raw) {
  if (!raw) return null;
  try {
    const parsed = parseStrictJson(String(raw), "legacy credentials");
    const allowed = ["v", "access_token", "refresh_token", "expires_at", "subject", "email", "tier"];
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.getPrototypeOf(parsed) !== Object.prototype || Object.keys(parsed).some((key) => !allowed.includes(key))) return null;
    if (parsed.v !== TOKEN_VERSION) return null;
    if (typeof parsed.access_token !== "string" || parsed.access_token.length < 8 || parsed.access_token.length > 8192 || !/^[\x21-\x7e]+$/u.test(parsed.access_token)) return null;
    return {
      v: TOKEN_VERSION,
      access_token: parsed.access_token,
      refresh_token: typeof parsed.refresh_token === "string" ? parsed.refresh_token : null,
      expires_at: typeof parsed.expires_at === "string" ? parsed.expires_at : null,
      subject: typeof parsed.subject === "string" ? parsed.subject : null,
      email: typeof parsed.email === "string" ? parsed.email : null,
      tier: typeof parsed.tier === "string" ? parsed.tier : "free",
    };
  } catch { return null; }
}

/** Pure — redact for safe logging. Returns shape without secrets. */
function redactToken(token) {
  if (!token) return null;
  return {
    subject: token.subject,
    email: token.email,
    tier: token.tier,
    expires_at: token.expires_at,
    has_refresh: Boolean(token.refresh_token),
    // access_token deliberately omitted from this shape — caller must NOT log raw.
  };
}

/** Pure — return true if expires_at is in the past (with 60s safety margin). */
function isTokenExpired(token, nowMs) {
  if (!token || !token.expires_at) return false; // no expiry = doesn't expire
  const now = typeof nowMs === "number" ? nowMs : Date.now();
  const expMs = Date.parse(token.expires_at);
  if (!Number.isFinite(expMs)) return false;
  return now >= (expMs - 60_000); // 60s safety margin
}

/** Build the default file backend pinned to `tokenPath`. */
function buildFileBackend(tokenPath, io = {}) {
  const p = tokenPath || DEFAULT_TOKEN_PATH;
  const warnLooseMode = () => {
    const stderr = io.stderr || process.stderr;
    const message = "warning: legacy token file permissions are broader than 0600\n";
    if (typeof stderr === "function") stderr(message);
    else if (stderr && typeof stderr.write === "function") stderr.write(message);
  };
  const file = createAtomicJsonFile(p, { maximumBytes: TOKEN_FILE_MAX_BYTES, mode: TOKEN_FILE_MODE, io: Object.keys(io).length === 0 ? undefined : io, onLooseMode: warnLooseMode });
  return {
    name: "file",
    get: async () => {
      const stored = await file.read();
      if (stored === null) return null;
      const parsed = parseToken(JSON.stringify(stored));
      if (!parsed) throw new OrchardCliError("invalid_token", "stored legacy credentials are malformed");
      return parsed;
    },
    set: async (token) => {
      const raw = JSON.stringify({
        v: TOKEN_VERSION,
        access_token: token.access_token,
        refresh_token: token.refresh_token || null,
        expires_at: token.expires_at || null,
        subject: token.subject || null,
        email: token.email || null,
        tier: token.tier || "free",
      }, null, 0) + "\n";
      if (Buffer.byteLength(raw, "utf8") > TOKEN_FILE_MAX_BYTES) {
        throw new OrchardCliError("file_too_large", `would-be token exceeds cap ${TOKEN_FILE_MAX_BYTES}`, { path: p });
      }
      const stored = parseToken(raw);
      if (!stored) throw new OrchardCliError("invalid_token", "legacy credentials are malformed");
      await file.write(stored);
      return { path: p, bytes: Buffer.byteLength(raw, "utf8") };
    },
    delete: async () => file.clear(),
  };
}

/** Build an in-memory backend (for tests). */
function buildMemoryBackend(initial) {
  let stored = initial ? { ...initial } : null;
  return {
    name: "memory",
    get: async () => (stored ? { ...stored } : null),
    set: async (token) => { stored = { ...token, v: TOKEN_VERSION }; return { path: ":memory:", bytes: 0 }; },
    delete: async () => { const had = !!stored; stored = null; return had; },
  };
}

// ─── Public API (backend-agnostic) ─────────────────────────────────

/**
 * Read the current token. Returns parsed + validated object OR null.
 * @param {object} [opts]
 * @param {object} [opts.backend]  injectable backend (defaults to file backend)
 * @param {string} [opts.tokenPath]  for file backend
 */
async function readToken(opts) {
  const o = opts || {};
  const backend = o.backend || buildFileBackend(o.tokenPath, o.io || {});
  try { return await backend.get(); }
  catch (error) {
    if (error instanceof LocalStoreError) throw new OrchardCliError("token_read_failed", "legacy credential read failed");
    throw error;
  }
}

/**
 * Write a token. Validates shape first.
 * @param {object} token
 * @param {object} [opts]
 */
async function writeToken(token, opts) {
  if (!token || typeof token !== "object" || typeof token.access_token !== "string" || token.access_token.length < 8) {
    throw new OrchardCliError("invalid_input", "writeToken requires {access_token (>=8 chars), ...}", { hint: "Token must have access_token field" });
  }
  const o = opts || {};
  const backend = o.backend || buildFileBackend(o.tokenPath, o.io || {});
  try { return await backend.set(token); }
  catch (error) {
    if (error instanceof LocalStoreError) throw new OrchardCliError("token_write_failed", "legacy credential write failed");
    throw error;
  }
}

/** Delete the token. Returns true if a token existed and was removed. */
async function deleteToken(opts) {
  const o = opts || {};
  const backend = o.backend || buildFileBackend(o.tokenPath, o.io || {});
  try { return await backend.delete(); }
  catch (error) {
    if (error instanceof LocalStoreError) throw new OrchardCliError("token_delete_failed", "legacy credential delete failed");
    throw error;
  }
}

/** Check whether any token is stored (and not expired). */
async function hasValidToken(opts) {
  const t = await readToken(opts);
  if (!t) return false;
  return !isTokenExpired(t);
}

module.exports = {
  DEFAULT_TOKEN_PATH,
  TOKEN_VERSION,
  TOKEN_FILE_MAX_BYTES,
  TOKEN_FILE_MODE,
  parseToken,
  redactToken,
  isTokenExpired,
  buildFileBackend,
  buildMemoryBackend,
  readToken,
  writeToken,
  deleteToken,
  hasValidToken,
};
