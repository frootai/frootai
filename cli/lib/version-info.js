// @ts-check
/**
 * A5.10 — Version info for `frootai --version`.
 *
 * Surfaces:
 *   - CLI version (from cli/package.json — read at module load, no runtime IO)
 *   - Node + platform (from process)
 *   - Backend revision (fetched from /api/version with 1h cache; null on failure)
 *
 * Doctrine:
 *   - The CLI version is the most important — must be available EVEN if the
 *     backend is unreachable. We display the backend rev as a secondary line
 *     and silently omit it when unavailable.
 *   - Cached at `~/.frootai/backend-version.json` (matches A4 file storage pattern).
 *   - Injectable fetch + cache path for tests.
 *   - Network request fire-and-forget with 2s timeout — NEVER blocks the CLI.
 *
 * Backend version response shape (from /api/version):
 *   { backend_version: "x.y.z", git_sha: "abc1234", deployed_at: ISO, region: "us-east" }
 */
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const DEFAULT_VERSION_ENDPOINT = "https://frootai.dev/api/version";
const DEFAULT_CACHE_PATH = path.join(os.homedir(), ".frootai", "backend-version.json");
const VERSION_FETCH_TIMEOUT_MS = 2_000;
const VERSION_CACHE_TTL_SEC = 60 * 60;        // 1 hour
const VERSION_RESPONSE_MAX_BYTES = 2 * 1024;

let _CACHED_CLI_VERSION = null;

/** Pure: read + cache CLI version from cli/package.json. */
function getCliVersion() {
  if (_CACHED_CLI_VERSION) return _CACHED_CLI_VERSION;
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    _CACHED_CLI_VERSION = String(pkg.version || "0.0.0");
  } catch {
    _CACHED_CLI_VERSION = "0.0.0";
  }
  return _CACHED_CLI_VERSION;
}

/** Pure: validate a backend version response shape. */
function parseBackendVersion(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (typeof raw.backend_version !== "string" || raw.backend_version.length === 0) return null;
  return {
    backend_version: String(raw.backend_version).slice(0, 32),
    git_sha: typeof raw.git_sha === "string" ? raw.git_sha.slice(0, 40) : null,
    deployed_at: typeof raw.deployed_at === "string" ? raw.deployed_at.slice(0, 32) : null,
    region: typeof raw.region === "string" ? raw.region.slice(0, 16) : null,
    fetched_at: new Date().toISOString(),
  };
}

/** Read cached backend version from disk; null if missing/stale. */
async function readCachedBackendVersion(opts) {
  const o = opts || {};
  const p = o.cachePath || DEFAULT_CACHE_PATH;
  const nowMs = (o.now || Date.now)();
  try {
    const stat = await fsP.stat(p);
    if (stat.size > VERSION_RESPONSE_MAX_BYTES) return null;
    const raw = JSON.parse(await fsP.readFile(p, "utf8"));
    if (!raw || typeof raw.fetched_at !== "string") return null;
    const ageMs = nowMs - Date.parse(raw.fetched_at);
    if (!Number.isFinite(ageMs) || ageMs > VERSION_CACHE_TTL_SEC * 1000) return null;
    return parseBackendVersion(raw);
  } catch { return null; }
}

/** Persist backend version to cache. NEVER throws. */
async function writeCachedBackendVersion(versionInfo, opts) {
  const o = opts || {};
  const p = o.cachePath || DEFAULT_CACHE_PATH;
  try {
    await fsP.mkdir(path.dirname(p), { recursive: true });
    const tmp = `${p}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await fsP.writeFile(tmp, JSON.stringify(versionInfo) + "\n", "utf8");
    await fsP.rename(tmp, p);
    return { path: p };
  } catch { return null; }
}

/**
 * Fetch backend version. NEVER throws. Returns null on any failure.
 *
 * @param {object} [opts]
 * @param {string} [opts.endpoint]
 * @param {number} [opts.timeoutMs]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {boolean} [opts.bypassCache]
 * @param {string} [opts.cachePath]
 * @param {Function} [opts.now]
 */
async function fetchBackendVersion(opts) {
  const o = opts || {};
  if (!o.bypassCache) {
    const cached = await readCachedBackendVersion({ cachePath: o.cachePath, now: o.now });
    if (cached) return cached;
  }
  const endpoint = o.endpoint || DEFAULT_VERSION_ENDPOINT;
  const fetchImpl = o.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  if (!fetchImpl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs || VERSION_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(endpoint, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": `frootai-cli/${getCliVersion()}` },
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > VERSION_RESPONSE_MAX_BYTES) return null;
    const parsed = parseBackendVersion(JSON.parse(text));
    if (parsed) await writeCachedBackendVersion(parsed, { cachePath: o.cachePath });
    return parsed;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Pure: format the `frootai --version` output line(s). */
function formatVersionLines(info) {
  if (!info || typeof info !== "object") return "";
  const lines = [];
  lines.push(`frootai CLI v${info.cli_version}`);
  if (info.backend) {
    const bits = [`backend v${info.backend.backend_version}`];
    if (info.backend.git_sha) bits.push(`sha:${info.backend.git_sha.slice(0, 7)}`);
    if (info.backend.region) bits.push(`region:${info.backend.region}`);
    lines.push(`  Linked to ${bits.join(" · ")}`);
    if (info.backend.deployed_at) lines.push(`  Backend deployed: ${info.backend.deployed_at}`);
  } else {
    lines.push("  (backend version unavailable — offline or no network)");
  }
  lines.push(`  node ${info.node_version} on ${info.platform}`);
  return lines.join("\n");
}

/**
 * Compose the full version info struct. NEVER throws — backend lookup failure
 * shows up as `backend: null` in the result.
 *
 * @param {object} [opts]
 * @returns {Promise<{cli_version: string, node_version: string, platform: string, backend: object|null}>}
 */
async function getFullVersionInfo(opts) {
  const o = opts || {};
  const backend = o.skipBackend === true ? null : await fetchBackendVersion(o);
  return {
    cli_version: getCliVersion(),
    node_version: process.version,
    platform: process.platform,
    backend,
  };
}

module.exports = {
  DEFAULT_VERSION_ENDPOINT,
  DEFAULT_CACHE_PATH,
  VERSION_FETCH_TIMEOUT_MS,
  VERSION_CACHE_TTL_SEC,
  VERSION_RESPONSE_MAX_BYTES,
  getCliVersion,
  parseBackendVersion,
  readCachedBackendVersion,
  writeCachedBackendVersion,
  fetchBackendVersion,
  formatVersionLines,
  getFullVersionInfo,
};
