// @ts-check
/**
 * FAI CLI auth — A4.10 login flow.
 *
 * Device-code-style flow:
 *   1. Generate a state token (32-char random hex)
 *   2. Build URL: https://frootai.dev/login?source=cli&device=<hostname>&state=<token>
 *   3. Open user's default browser to that URL (best-effort; print URL for manual paste if browser open fails)
 *   4. Poll https://frootai.dev/api/cli-auth/poll?state=<token> every 2s until:
 *      - 200 with {access_token, ...} → success
 *      - 400/410 → state expired or invalid → error
 *      - 408 / pending → continue polling
 *      - Timeout after 5 minutes
 *
 * Browser open: cross-platform `open` / `start` / `xdg-open` via child_process.
 *   - If browser open fails, prints URL for manual paste — flow still works.
 *
 * Pure helpers (generateState / buildLoginUrl / buildPollUrl) exported for tests.
 */
"use strict";

const crypto = require("node:crypto");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { OrchardCliError } = require("../orchard/cli-error");

const DEFAULT_LOGIN_BASE_URL = "https://frootai.dev/login";
const DEFAULT_POLL_BASE_URL = "https://frootai.dev/api/cli-auth/poll";
const DEFAULT_STATE_LENGTH = 32;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_LOGIN_TIMEOUT_MS = 5 * 60_000; // 5 minutes
const DEFAULT_POLL_TIMEOUT_MS = 10_000;

/** Pure — generate a cryptographically-random state token. */
function generateState(length, rngImpl) {
  const n = typeof length === "number" && length > 0 ? length : DEFAULT_STATE_LENGTH;
  const rng = rngImpl || crypto.randomBytes;
  const buf = rng(Math.ceil(n / 2));
  return buf.toString("hex").slice(0, n);
}

/** Pure — build the browser login URL. */
function buildLoginUrl(opts) {
  const o = opts || {};
  const base = o.baseUrl || DEFAULT_LOGIN_BASE_URL;
  const device = o.device || os.hostname() || "unknown";
  const state = o.state;
  if (!state || typeof state !== "string" || state.length === 0) {
    throw new OrchardCliError("invalid_input", "buildLoginUrl requires opts.state", {});
  }
  const params = new URLSearchParams({
    source: "cli",
    device,
    state,
  });
  return `${base}?${params.toString()}`;
}

/** Pure — build the poll URL for a given state token. */
function buildPollUrl(opts) {
  const o = opts || {};
  const base = o.baseUrl || DEFAULT_POLL_BASE_URL;
  const state = o.state;
  if (!state || typeof state !== "string" || state.length === 0) {
    throw new OrchardCliError("invalid_input", "buildPollUrl requires opts.state", {});
  }
  const params = new URLSearchParams({ state });
  return `${base}?${params.toString()}`;
}

/**
 * Pure — pick the platform-appropriate browser-open command + args.
 * Returns null if no opener known (caller falls back to manual paste).
 */
function pickBrowserOpener(platform) {
  const p = platform || process.platform;
  if (p === "darwin") return { command: "open", args: [] };
  if (p === "win32") return { command: "cmd", args: ["/c", "start", '""'] }; // empty title is required
  if (p === "linux") return { command: "xdg-open", args: [] };
  return null;
}

/**
 * Open URL in the user's default browser.
 * Returns { opened: boolean, error?: string }. Never throws.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {string} [opts.platform]
 * @param {Function} [opts.spawnImpl]  inject for tests
 */
async function openBrowser(url, opts) {
  const o = opts || {};
  const opener = pickBrowserOpener(o.platform);
  if (!opener) return { opened: false, error: `unsupported platform ${o.platform || process.platform}` };
  const spawnImpl = o.spawnImpl || spawn;
  return new Promise((resolve) => {
    try {
      const child = spawnImpl(opener.command, [...opener.args, url], { stdio: "ignore", detached: true });
      child.on("error", (err) => {
        resolve({ opened: false, error: err && err.message ? err.message : String(err) });
      });
      child.unref();
      // Resolve optimistically — `child.on("error")` is async, but if it fires we'll have already resolved.
      // The caller's polling loop will tell them whether the user actually completed sign-in.
      setTimeout(() => resolve({ opened: true }), 100);
    } catch (err) {
      resolve({ opened: false, error: err && /** @type {any} */ (err).message ? /** @type {any} */ (err).message : String(err) });
    }
  });
}

/**
 * Poll the server until login completes (or times out).
 *
 * @param {object} opts
 * @param {string} opts.state
 * @param {string} [opts.pollUrlBase]
 * @param {number} [opts.intervalMs]
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.requestTimeoutMs]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {(ms: number) => Promise<void>} [opts.sleepImpl]
 * @param {() => number} [opts.now]
 * @returns {Promise<{token: object}>}
 */
async function pollForToken(opts) {
  const o = opts || {};
  if (!o.state) throw new OrchardCliError("invalid_input", "pollForToken requires state", {});
  const fetchImpl = o.fetchImpl || fetch;
  const intervalMs = o.intervalMs || DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = o.timeoutMs || DEFAULT_LOGIN_TIMEOUT_MS;
  const requestTimeoutMs = o.requestTimeoutMs || DEFAULT_POLL_TIMEOUT_MS;
  const sleep = o.sleepImpl || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = o.now || Date.now;
  const url = buildPollUrl({ state: o.state, baseUrl: o.pollUrlBase });

  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const controller = new AbortController();
    const reqTimer = setTimeout(() => controller.abort(), requestTimeoutMs);
    let response;
    try {
      response = await fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": "frootai-orchard-cli/1.0" },
      });
    } catch (err) {
      clearTimeout(reqTimer);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("abort")) {
        // Single poll-request timeout is fine — try again next interval.
        await sleep(intervalMs);
        continue;
      }
      // Transient network error — try again.
      await sleep(intervalMs);
      continue;
    }
    clearTimeout(reqTimer);

    if (response.status === 200) {
      let body;
      try { body = await response.json(); }
      catch (err) {
        throw new OrchardCliError("login_failed",
          `Server returned 200 but body did not parse as JSON: ${err instanceof Error ? err.message : String(err)}`, {});
      }
      if (!body || typeof body.access_token !== "string" || body.access_token.length < 8) {
        throw new OrchardCliError("login_failed", "Server returned 200 but body missing access_token", { body_keys: Object.keys(body || {}) });
      }
      return { token: body };
    }

    if (response.status === 408 || response.status === 425 || response.status === 102) {
      // Pending — keep polling.
      await sleep(intervalMs);
      continue;
    }

    if (response.status === 410 || response.status === 400) {
      throw new OrchardCliError("login_state_invalid",
        `Login state expired or invalid (server returned ${response.status}). Run \`frootai login\` again.`,
        { status: response.status });
    }

    if (response.status >= 500) {
      // Transient server error — retry.
      await sleep(intervalMs);
      continue;
    }

    // Other 4xx — treat as fatal.
    throw new OrchardCliError("login_failed",
      `Unexpected status ${response.status} polling login endpoint`,
      { status: response.status });
  }

  throw new OrchardCliError("login_timeout",
    `Login timed out after ${Math.round(timeoutMs / 1000)}s. Run \`frootai login\` again.`,
    { timeoutMs });
}

module.exports = {
  DEFAULT_LOGIN_BASE_URL,
  DEFAULT_POLL_BASE_URL,
  DEFAULT_STATE_LENGTH,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_LOGIN_TIMEOUT_MS,
  DEFAULT_POLL_TIMEOUT_MS,
  generateState,
  buildLoginUrl,
  buildPollUrl,
  pickBrowserOpener,
  openBrowser,
  pollForToken,
};
