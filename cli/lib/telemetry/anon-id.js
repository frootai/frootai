// @ts-check
/**
 * A4.28 — Anonymous machine-scoped UUID for telemetry.
 *
 * Privacy doctrine:
 *   - The `anon_id` is a v4 UUID stored at ~/.frootai/anon-id.
 *   - It's per-MACHINE, NOT per-user — multiple users on the same box share an id.
 *     (We can't tell users apart anyway without an auth token, which telemetry
 *      never sees.)
 *   - Users can reset it any time by deleting the file (a fresh id is generated
 *     on the next telemetry call).
 *   - The id is never sent with any user-identifying field — no token, no email,
 *     no subject, no path bits. It exists solely to count "this machine fired
 *     N events" without tracking individuals.
 *
 * Generation: uses Node's built-in `crypto.randomUUID()` (RFC 4122 v4).
 * Storage: atomic tmp+rename (same pattern as config-store/token-store).
 * Read: missing file → generates + writes a fresh id, then returns it.
 *
 * Mode: 0o600 on POSIX (same as token-store) so other users on the box can't
 * read another user's anon_id.
 */
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { OrchardCliError } = require("../orchard/cli-error");

const DEFAULT_ANON_ID_PATH = path.join(os.homedir(), ".frootai", "anon-id");
const ANON_ID_MAX_BYTES = 256;
const ANON_ID_FILE_MODE = 0o600;
const IS_WINDOWS = process.platform === "win32";
// RFC 4122 v4 UUID (case-insensitive, 8-4-4-4-12 hex).
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Pure: validate that a string looks like a v4 UUID. */
function isValidAnonId(s) {
  if (typeof s !== "string") return false;
  const trimmed = s.trim();
  return UUID_V4_RE.test(trimmed);
}

/** Generate a fresh v4 UUID using Node's built-in crypto. */
function generateAnonId(rng) {
  if (typeof rng === "function") {
    // Test injection: rng returns a Buffer of 16 bytes.
    const buf = rng(16);
    if (!Buffer.isBuffer(buf) || buf.length !== 16) {
      throw new OrchardCliError("invalid_input", "anon-id rng must return a 16-byte Buffer", {});
    }
    // Set version + variant bits per RFC 4122.
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const hex = buf.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  return crypto.randomUUID();
}

async function _readAnonIdFile(p) {
  try {
    const stat = await fsP.stat(p);
    if (stat.size > ANON_ID_MAX_BYTES) return null; // garbage — regenerate
    const raw = (await fsP.readFile(p, "utf8")).trim();
    return isValidAnonId(raw) ? raw : null;
  } catch (err) {
    if (err && /** @type {any} */(err).code === "ENOENT") return null;
    throw err;
  }
}

async function _writeAnonIdFile(p, id) {
  const tempPath = `${p}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await fsP.mkdir(path.dirname(p), { recursive: true });
    await fsP.writeFile(tempPath, id + "\n", { encoding: "utf8", mode: ANON_ID_FILE_MODE });
    await fsP.rename(tempPath, p);
    if (!IS_WINDOWS) {
      try { await fsP.chmod(p, ANON_ID_FILE_MODE); } catch { /* */ }
    }
  } catch (err) {
    try { await fsP.unlink(tempPath); } catch { /* */ }
    throw err;
  }
}

/**
 * Read the existing anon-id OR generate + persist a new one.
 * NEVER throws (returns null if disk IO fails — callers treat that as "telemetry off").
 *
 * @param {object} [opts]
 * @param {string} [opts.anonIdPath]
 * @param {Function} [opts.rng]   inject for tests
 * @returns {Promise<string|null>}
 */
async function readOrCreateAnonId(opts) {
  const o = opts || {};
  const p = o.anonIdPath || DEFAULT_ANON_ID_PATH;
  try {
    let id = await _readAnonIdFile(p);
    if (id) return id;
    id = generateAnonId(o.rng);
    await _writeAnonIdFile(p, id);
    return id;
  } catch {
    return null; // can't read or write → no anon id → caller skips telemetry
  }
}

/** Reset the anon-id (deletes the file). Returns true if a file existed. */
async function resetAnonId(opts) {
  const o = opts || {};
  const p = o.anonIdPath || DEFAULT_ANON_ID_PATH;
  try {
    await fsP.unlink(p);
    return true;
  } catch (err) {
    if (err && /** @type {any} */(err).code === "ENOENT") return false;
    throw err;
  }
}

module.exports = {
  DEFAULT_ANON_ID_PATH,
  ANON_ID_MAX_BYTES,
  ANON_ID_FILE_MODE,
  UUID_V4_RE,
  isValidAnonId,
  generateAnonId,
  readOrCreateAnonId,
  resetAnonId,
};
