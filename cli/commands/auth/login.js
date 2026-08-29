// @ts-check
/**
 * [H8.13] login.js — `frootai login` handler. RFC 8628 OAuth2 Device
 * Authorization Grant flow against `frootai.dev/auth`.
 *
 * Contract (verbatim from masterplan §3 row [H8.13]):
 *   `frootai login` / `frootai logout` OAuth2 device-flow against
 *   `frootai.dev/auth`; tokens cached at
 *   `~/.config/frootai/credentials.json` 0600 perm
 *
 * Top-level handler (NOT under `orchard`). Mirrors the orchard-handler
 * surface contract: two surfaces (`runWithDeps` + `run`), hermetic via
 * injectable deps, returns sysexits-aligned exit codes.
 *
 * Pipeline (per invocation; RFC 8628):
 *   1. parse argv (`--json`, `--no-browser`, `--client-id <id>`,
 *      `--auth-base <url>`, `--scope <s>`, `--timeout <sec>`, `--help`)
 *   2. POST `<auth-base>/device` with `{client_id, scope?}` →
 *      DeviceAuthorizationResponse `{device_code, user_code,
 *      verification_uri, verification_uri_complete?, expires_in, interval}`
 *   3. display user_code + verification_uri to user (always to stderr so
 *      stdout stays clean for --json mode); optionally open browser
 *      (best-effort; skipped under --no-browser)
 *   4. POLL POST `<auth-base>/token` with
 *      `grant_type=urn:ietf:params:oauth:grant-type:device_code,
 *       device_code, client_id` at `interval` seconds until:
 *        - 200 + access_token → success
 *        - 400 + error=authorization_pending → keep polling
 *        - 400 + error=slow_down → bump interval by 5s (per RFC 8628 §3.5)
 *        - 400 + error=expired_token → fatal (USAGE 64)
 *        - 400 + error=access_denied → fatal (NOPERM 77)
 *        - any other → fatal (UNAVAILABLE 69)
 *      OR until handler-level `--timeout` is reached (TEMPFAIL 75)
 *   5. extract `subject`/`email`/`tier` from JWT payload (if access_token
 *      decodes as a JWT — falls back to nulls otherwise; H8.14
 *      entitlements check will fetch the canonical user info)
 *   6. write `Credentials` to `~/.config/frootai/credentials.json` mode 0600
 *   7. emit summary (LoginResult): success + redacted subject/email/tier
 *
 * Two surfaces:
 *
 *   1. Programmatic `runWithDeps(args, ctx, deps) → Promise<number>` —
 *      pure + injectable: `{fetchImpl, openBrowserImpl, credentialsStore,
 *      env, hostname, sleepImpl, now, spawnImpl}`.
 *
 *   2. Router-facing `run(args, ctx)` — default deps wire real `fetch`,
 *      real `node:child_process` browser opener, and the file-backed
 *      credentials store at the XDG-default path.
 *
 * Subcommand argv grammar (everything AFTER `login` in `argv`):
 *   --client-id <id>     OAuth2 client_id (default: "frootai-cli")
 *   --auth-base <url>    auth server base URL (default:
 *                        "https://frootai.dev/auth")
 *   --scope <scope>      space-separated OAuth2 scopes (default: "openid profile email")
 *   --no-browser         don't try to open the browser; print URL only
 *   --timeout <sec>      overall login timeout in seconds (default: 600 = 10 min)
 *   --json               machine-readable single-line JSON to stdout
 *   --help, -h           print help + exit OK
 *
 * Exit codes (sysexits-aligned):
 *   0    OK             — token stored at credentials.json
 *   64   USAGE          — bad flags / OAuth2 expired_token / invalid response
 *   69   UNAVAILABLE    — device endpoint 5xx / unknown token error code
 *   70   SOFTWARE       — unexpected internal error
 *   74   IOERR          — credentials.json write failure
 *   75   TEMPFAIL       — login timeout (user didn't authorize in time)
 *   77   NOPERM         — user explicitly denied authorization
 *
 * Non-goals for THIS ship:
 *   - Refresh-token flow (a future ship).
 *   - Browser-based PKCE flow (Web SDK territory, not CLI).
 *   - PKCE for device flow (RFC 8628 doesn't require it; we send client_id only).
 *   - User info endpoint call (H8.14 entitlements will do that).
 *
 * License: CC0-1.0.
 */
"use strict";

const os = require("node:os");
const childProcess = require("node:child_process");

const credentialsStore = require("./credentials-store.js");

/** Local sysexits enum. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  UNAVAILABLE: 69,
  SOFTWARE: 70,
  IOERR: 74,
  TEMPFAIL: 75,
  NOPERM: 77,
});

/** Defaults. */
const DEFAULT_CLIENT_ID = "frootai-cli";
const DEFAULT_AUTH_BASE = "https://frootai.dev/auth";
const DEFAULT_SCOPE = "openid profile email";
const DEFAULT_TIMEOUT_SEC = 600;
const DEFAULT_INTERVAL_SEC = 5;
const SLOW_DOWN_BUMP_SEC = 5; // per RFC 8628 §3.5
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEVICE_FLOW_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

/** Flags taking a value. */
const VALUE_FLAGS = new Set([
  "--client-id", "--auth-base", "--scope", "--timeout",
]);

/** Error carrying a sysexits exit code. */
class LoginHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error, meta?: object }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "LoginHandlerError";
    this.code = opts.code || "login_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
    if (opts.meta) this.meta = opts.meta;
  }
}

/**
 * Parse the subcommand-local argv. NO positionals. Unknown long flags → USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ clientId: string, authBase: string, scope: string, noBrowser: boolean, timeoutSec: number, json: boolean, help: boolean }}
 */
function parseLoginArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseLoginArgs: argv must be an array");
  }
  /** @type {{ clientId: string, authBase: string, scope: string, noBrowser: boolean, timeoutSec: number, json: boolean, help: boolean }} */
  const out = {
    clientId: DEFAULT_CLIENT_ID,
    authBase: DEFAULT_AUTH_BASE,
    scope: DEFAULT_SCOPE,
    noBrowser: false,
    timeoutSec: DEFAULT_TIMEOUT_SEC,
    json: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new LoginHandlerError(`argv entry ${i} must be a string`, { code: "bad_args", exitCode: EXIT.USAGE });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--no-browser") { out.noBrowser = true; continue; }
    if (arg === "--json") { out.json = true; continue; }

    let handled = false;
    for (const vf of VALUE_FLAGS) {
      if (arg === vf) {
        const v = argv[++i];
        if (typeof v !== "string" || v.length === 0) {
          throw new LoginHandlerError(`${vf} requires a value`, { code: "bad_args", exitCode: EXIT.USAGE });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
      if (arg.startsWith(`${vf}=`)) {
        const v = arg.slice(vf.length + 1);
        if (v.length === 0) {
          throw new LoginHandlerError(`${vf}= requires a non-empty value`, { code: "bad_args", exitCode: EXIT.USAGE });
        }
        applyValueFlag(out, vf, v);
        handled = true; break;
      }
    }
    if (handled) continue;

    if (arg.startsWith("-")) {
      throw new LoginHandlerError(`unknown flag: ${arg}`, { code: "bad_args", exitCode: EXIT.USAGE });
    }
    throw new LoginHandlerError(
      `unexpected positional argument: ${arg} (frootai login takes no positionals)`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  if (!Number.isInteger(out.timeoutSec) || out.timeoutSec < 10) {
    throw new LoginHandlerError(`--timeout must be a positive integer >= 10 (got ${out.timeoutSec})`, { code: "bad_args", exitCode: EXIT.USAGE });
  }
  return out;
}

function applyValueFlag(out, vf, v) {
  if (vf === "--client-id") out.clientId = v;
  else if (vf === "--auth-base") out.authBase = v;
  else if (vf === "--scope") out.scope = v;
  else if (vf === "--timeout") out.timeoutSec = parseInt(v, 10);
}

/** Build the `frootai login --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai login [options]",
    "",
    "OAuth2 device-flow login against frootai.dev/auth. Stores credentials at",
    "~/.config/frootai/credentials.json (mode 600).",
    "",
    "Options:",
    "  --client-id <id>      OAuth2 client_id (default: " + DEFAULT_CLIENT_ID + ")",
    "  --auth-base <url>     auth server base URL (default: " + DEFAULT_AUTH_BASE + ")",
    "  --scope <s>           OAuth2 scopes (default: \"" + DEFAULT_SCOPE + "\")",
    "  --no-browser          don't try to open the browser; print URL only",
    "  --timeout <sec>       overall login timeout in seconds (default: " + DEFAULT_TIMEOUT_SEC + ")",
    "  --json                machine-readable single-line JSON to stdout",
    "  --help, -h            show this help and exit",
    "",
    "Exit codes:",
    "  0   success (token stored)",
    "  64  bad args / OAuth2 expired_token / invalid response",
    "  69  device-endpoint 5xx / unknown token error",
    "  70  unexpected internal error",
    "  74  credentials.json write failure",
    "  75  login timeout (user didn't authorize in time)",
    "  77  user explicitly denied authorization",
    "",
    "Examples:",
    "  frootai login",
    "  frootai login --no-browser",
    "  frootai login --json --timeout 300",
    "",
  ].join("\n");
}

/** Emit a string to a sink that may be `(s) => void` or `{ write }`. */
function emit(sink, text) {
  const s = text.endsWith("\n") ? text : `${text}\n`;
  if (typeof sink === "function") sink(s);
  else if (sink && typeof sink.write === "function") sink.write(s);
}

/**
 * POST `application/x-www-form-urlencoded` to a URL. Returns
 * `{ status: number, body: object|null, raw: string }` on any HTTP response;
 * throws LoginHandlerError on network failure.
 *
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {Record<string,string>} form
 * @param {number} [reqTimeoutMs]
 */
async function postForm(fetchImpl, url, form, reqTimeoutMs) {
  const controller = new AbortController();
  const reqTimer = setTimeout(() => controller.abort(), reqTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "User-Agent": "frootai-cli/1.0 (+https://frootai.dev)",
      },
      body: new URLSearchParams(form).toString(),
    });
  } catch (err) {
    clearTimeout(reqTimer);
    throw new LoginHandlerError(`network error posting to ${url}: ${err instanceof Error ? err.message : String(err)}`, { code: "network_error", exitCode: EXIT.UNAVAILABLE });
  }
  clearTimeout(reqTimer);
  let raw = "";
  try { raw = await res.text(); }
  catch (err) {
    throw new LoginHandlerError(`failed to read body from ${url}: ${err instanceof Error ? err.message : String(err)}`, { code: "network_error", exitCode: EXIT.UNAVAILABLE });
  }
  let body = null;
  if (raw && raw.length > 0) {
    try { body = JSON.parse(raw); }
    catch { body = null; }
  }
  return { status: res.status, body, raw };
}

/**
 * Initiate the device flow: POST /device, validate the response shape.
 *
 * @param {object} opts — `{ fetchImpl, authBase, clientId, scope, reqTimeoutMs }`
 * @returns {Promise<{ device_code: string, user_code: string, verification_uri: string, verification_uri_complete?: string, expires_in: number, interval: number }>}
 */
async function startDeviceFlow(opts) {
  const url = `${opts.authBase.replace(/\/+$/, "")}/device`;
  const { status, body } = await postForm(opts.fetchImpl, url, {
    client_id: opts.clientId,
    scope: opts.scope,
  }, opts.reqTimeoutMs);
  if (status === 0 || status >= 500) {
    throw new LoginHandlerError(`device endpoint ${url} returned ${status}`, { code: "device_unavailable", exitCode: EXIT.UNAVAILABLE, meta: { status } });
  }
  if (status !== 200 || !body || typeof body !== "object") {
    throw new LoginHandlerError(`device endpoint ${url} returned ${status}${body && body.error ? ` (${body.error})` : ""}`, { code: "device_failed", exitCode: EXIT.USAGE, meta: { status, body } });
  }
  if (typeof body.device_code !== "string" || typeof body.user_code !== "string" || typeof body.verification_uri !== "string") {
    throw new LoginHandlerError("device endpoint returned malformed response (missing device_code/user_code/verification_uri)", { code: "device_malformed", exitCode: EXIT.USAGE, meta: { body_keys: Object.keys(body) } });
  }
  return {
    device_code: body.device_code,
    user_code: body.user_code,
    verification_uri: body.verification_uri,
    verification_uri_complete: typeof body.verification_uri_complete === "string" ? body.verification_uri_complete : undefined,
    expires_in: Number.isFinite(body.expires_in) ? body.expires_in : opts.timeoutSec || DEFAULT_TIMEOUT_SEC,
    interval: Number.isFinite(body.interval) && body.interval > 0 ? body.interval : DEFAULT_INTERVAL_SEC,
  };
}

/**
 * Pick the platform-appropriate browser-open command. Returns null when
 * the platform is unknown (caller falls back to manual paste).
 *
 * @param {string} [platform]
 */
function pickBrowserOpener(platform) {
  const p = platform || process.platform;
  if (p === "darwin") return { command: "open", args: [] };
  if (p === "win32") return { command: "cmd", args: ["/c", "start", '""'] };
  if (p === "linux") return { command: "xdg-open", args: [] };
  return null;
}

/**
 * Best-effort open URL in the user's default browser. Never throws.
 *
 * @param {string} url
 * @param {object} [opts] — `{ platform, spawnImpl }`
 * @returns {Promise<{ opened: boolean, error?: string }>}
 */
async function openBrowser(url, opts = {}) {
  const opener = pickBrowserOpener(opts.platform);
  if (!opener) return { opened: false, error: `unsupported platform ${opts.platform || process.platform}` };
  const spawnImpl = opts.spawnImpl || childProcess.spawn;
  return new Promise((resolve) => {
    try {
      const child = spawnImpl(opener.command, [...opener.args, url], { stdio: "ignore", detached: true });
      child.on("error", (err) => resolve({ opened: false, error: err && err.message ? err.message : String(err) }));
      if (typeof child.unref === "function") child.unref();
      setTimeout(() => resolve({ opened: true }), 50);
    } catch (err) {
      resolve({ opened: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}

/**
 * Poll /token until success or fatal error. Honors RFC 8628 §3.5
 * back-off semantics: `authorization_pending` → continue; `slow_down` →
 * bump interval; `expired_token` / `access_denied` / other → throw.
 *
 * @param {object} opts — `{ fetchImpl, authBase, clientId, deviceCode, intervalSec, timeoutMs, reqTimeoutMs, sleepImpl, now }`
 * @returns {Promise<object>} the OAuth2 token response (200 body)
 */
async function pollDeviceToken(opts) {
  const url = `${opts.authBase.replace(/\/+$/, "")}/token`;
  const sleep = opts.sleepImpl || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = opts.now || Date.now;
  const deadline = now() + opts.timeoutMs;
  let intervalMs = (opts.intervalSec || DEFAULT_INTERVAL_SEC) * 1000;

  while (now() < deadline) {
    await sleep(intervalMs);
    if (now() >= deadline) break;
    const { status, body } = await postForm(opts.fetchImpl, url, {
      grant_type: DEVICE_FLOW_GRANT_TYPE,
      device_code: opts.deviceCode,
      client_id: opts.clientId,
    }, opts.reqTimeoutMs);

    if (status === 200 && body && typeof body.access_token === "string" && body.access_token.length >= 8) {
      return body;
    }

    if (status === 400 && body && typeof body.error === "string") {
      const err = body.error;
      if (err === "authorization_pending") continue;
      if (err === "slow_down") { intervalMs += SLOW_DOWN_BUMP_SEC * 1000; continue; }
      if (err === "expired_token") {
        throw new LoginHandlerError("device code expired before user authorized — run `frootai login` again", { code: "expired_token", exitCode: EXIT.USAGE, meta: { status } });
      }
      if (err === "access_denied") {
        throw new LoginHandlerError("user denied the authorization request", { code: "access_denied", exitCode: EXIT.NOPERM, meta: { status } });
      }
      throw new LoginHandlerError(`device-token error: ${err}`, { code: err, exitCode: EXIT.UNAVAILABLE, meta: { status } });
    }

    if (status >= 500) {
      // Transient server error — back off one interval and try again.
      continue;
    }

    throw new LoginHandlerError(`unexpected /token response status ${status}`, { code: "token_unexpected_status", exitCode: EXIT.UNAVAILABLE, meta: { status } });
  }

  throw new LoginHandlerError(`login timed out after ${Math.round(opts.timeoutMs / 1000)}s — run \`frootai login\` again`, { code: "timeout", exitCode: EXIT.TEMPFAIL, meta: { timeoutMs: opts.timeoutMs } });
}

/**
 * Best-effort: decode JWT payload (no signature verification — H8.14 will
 * call the userinfo endpoint for the canonical version). Returns null on
 * any decode failure. Pure.
 *
 * @param {string|null|undefined} jwt
 * @returns {object|null}
 */
function decodeJwtPayloadUnsafe(jwt) {
  if (typeof jwt !== "string") return null;
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const buf = Buffer.from(b64 + pad, "base64");
    const obj = JSON.parse(buf.toString("utf8"));
    if (!obj || typeof obj !== "object") return null;
    return obj;
  } catch { return null; }
}

/** Extract `{ subject, email, tier }` from a JWT payload (or {}). */
function userInfoFromJwt(payload) {
  if (!payload || typeof payload !== "object") return {};
  return {
    subject: typeof payload.sub === "string" ? payload.sub : null,
    email: typeof payload.email === "string" ? payload.email : null,
    tier: typeof payload.tier === "string" ? payload.tier
      : typeof payload.frootai_tier === "string" ? payload.frootai_tier
      : "free",
  };
}

/**
 * Programmatic surface. Pure + injectable.
 *
 * @param {readonly string[]} args
 * @param {object} ctx
 * @param {object} [deps]
 * @param {typeof fetch} [deps.fetchImpl]
 * @param {(url: string, opts?: object) => Promise<{ opened: boolean, error?: string }>} [deps.openBrowserImpl]
 * @param {object} [deps.credentialsStore]
 * @param {object} [deps.credentialsBackend] — if provided, passed to writeCredentials
 * @param {string} [deps.credentialsPath]
 * @param {Record<string,string|undefined>} [deps.env]
 * @param {() => string} [deps.hostname]
 * @param {(ms: number) => Promise<void>} [deps.sleepImpl]
 * @param {() => number} [deps.now]
 * @param {Function} [deps.spawnImpl]
 * @param {number} [deps.requestTimeoutMs]
 * @returns {Promise<number>}
 */
async function runWithDeps(args, ctx, deps = {}) {
  const stdout = (ctx && ctx.stdout) || ((s) => process.stdout.write(s));
  const stderr = (ctx && ctx.stderr) || ((s) => process.stderr.write(s));
  const fetchImpl = deps.fetchImpl || (typeof fetch === "function" ? fetch : null);
  const openBrowserImpl = deps.openBrowserImpl || openBrowser;
  const store = deps.credentialsStore || credentialsStore;
  const env = deps.env || process.env;
  const now = deps.now || Date.now;

  /** @type {ReturnType<typeof parseLoginArgs>} */
  let parsed;
  try {
    parsed = parseLoginArgs(args || []);
  } catch (err) {
    if (err instanceof LoginHandlerError) {
      emit(stderr, `error: ${err.message}`);
      emit(stderr, buildHelp());
      return err.exitCode;
    }
    emit(stderr, `error: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT.SOFTWARE;
  }

  if (parsed.help) {
    emit(stdout, buildHelp());
    return EXIT.OK;
  }

  const json = !!(parsed.json || (ctx && ctx.json));
  const verbose = !!(ctx && ctx.verbose);

  if (typeof fetchImpl !== "function") {
    const message = "no fetch implementation available (require Node 18+ or pass deps.fetchImpl)";
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "no_fetch", message, exit_code: EXIT.SOFTWARE } }));
    else emit(stderr, `error: ${message}`);
    return EXIT.SOFTWARE;
  }

  // 1. POST /device
  /** @type {Awaited<ReturnType<typeof startDeviceFlow>>} */
  let device;
  try {
    device = await startDeviceFlow({
      fetchImpl, authBase: parsed.authBase, clientId: parsed.clientId,
      scope: parsed.scope, timeoutSec: parsed.timeoutSec,
      reqTimeoutMs: deps.requestTimeoutMs,
    });
  } catch (err) {
    return handleErrToExit(err, { json, stdout, stderr, stage: "device" });
  }

  // 2. Display user_code + verification_uri to stderr (so --json stdout stays clean).
  const displayUrl = device.verification_uri_complete || device.verification_uri;
  emit(stderr, "");
  emit(stderr, "  ┌─ FrootAI sign-in ──");
  emit(stderr, `  │ Open: ${displayUrl}`);
  if (!device.verification_uri_complete) {
    emit(stderr, `  │ Code: ${device.user_code}`);
  }
  emit(stderr, `  │ This code expires in ${device.expires_in}s.`);
  emit(stderr, "  └─");
  emit(stderr, "");

  // 3. Best-effort browser open (unless --no-browser).
  if (!parsed.noBrowser) {
    try {
      const r = await openBrowserImpl(displayUrl, { spawnImpl: deps.spawnImpl });
      if (r && r.opened === false && verbose) {
        emit(stderr, `(could not open browser: ${r.error || "unknown"}; please open the URL above manually)`);
      }
    } catch { /* never let browser failure block login */ }
  }

  // 4. Poll /token (handler-level timeout dominates the server-reported expires_in).
  const overallTimeoutMs = Math.min(parsed.timeoutSec, device.expires_in) * 1000;
  /** @type {object} */
  let tokenResponse;
  try {
    tokenResponse = await pollDeviceToken({
      fetchImpl, authBase: parsed.authBase, clientId: parsed.clientId,
      deviceCode: device.device_code, intervalSec: device.interval,
      timeoutMs: overallTimeoutMs, reqTimeoutMs: deps.requestTimeoutMs,
      sleepImpl: deps.sleepImpl, now,
    });
  } catch (err) {
    return handleErrToExit(err, { json, stdout, stderr, stage: "token" });
  }

  // 5. Build Credentials + persist.
  const userInfo = userInfoFromJwt(decodeJwtPayloadUnsafe(tokenResponse.access_token));
  const creds = store.fromTokenResponse(tokenResponse, userInfo, { nowMs: now() });
  let written;
  try {
    written = await store.writeCredentials(creds, {
      backend: deps.credentialsBackend,
      path: deps.credentialsPath,
      env, homedir: deps.hostname ? undefined : undefined,
    });
  } catch (err) {
    if (json) emit(stdout, JSON.stringify({ ok: false, stage: "write", error: { code: (err && err.code) || "write_failed", message: err instanceof Error ? err.message : String(err), exit_code: EXIT.IOERR } }));
    else emit(stderr, `error[write]: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT.IOERR;
  }

  // 6. Emit summary.
  const summary = {
    ok: true,
    stage: "complete",
    credentials_path: written.path,
    credentials_bytes: written.bytes,
    auth_base: parsed.authBase,
    client_id: parsed.clientId,
    scope: parsed.scope,
    user: store.redactCredentials(creds),
  };
  if (json) {
    const body = verbose ? JSON.stringify(summary, null, 2) : JSON.stringify(summary);
    emit(stdout, body);
  } else {
    emit(stdout, `Signed in as ${creds.email || creds.subject || "(unknown user)"} (${creds.tier || "free"} tier).`);
    emit(stdout, `Credentials cached at ${written.path}.`);
  }
  return EXIT.OK;
}

function handleErrToExit(err, opts) {
  const { json, stdout, stderr, stage } = opts;
  if (err instanceof LoginHandlerError) {
    if (json) emit(stdout, JSON.stringify({ ok: false, stage, error: { code: err.code, message: err.message, exit_code: err.exitCode, ...(err.meta ? { meta: err.meta } : {}) } }));
    else emit(stderr, `error[${stage}/${err.code}]: ${err.message}`);
    return err.exitCode;
  }
  const message = err instanceof Error ? err.message : String(err);
  if (json) emit(stdout, JSON.stringify({ ok: false, stage, error: { code: "unexpected", message, exit_code: EXIT.SOFTWARE } }));
  else emit(stderr, `error[${stage}]: ${message}`);
  return EXIT.SOFTWARE;
}

/** Router-facing entry. */
function run(args, ctx) { return runWithDeps(args, ctx, {}); }

module.exports = {
  EXIT,
  VALUE_FLAGS,
  DEFAULT_CLIENT_ID,
  DEFAULT_AUTH_BASE,
  DEFAULT_SCOPE,
  DEFAULT_TIMEOUT_SEC,
  DEFAULT_INTERVAL_SEC,
  SLOW_DOWN_BUMP_SEC,
  DEVICE_FLOW_GRANT_TYPE,
  LoginHandlerError,
  parseLoginArgs,
  buildHelp,
  pickBrowserOpener,
  openBrowser,
  postForm,
  startDeviceFlow,
  pollDeviceToken,
  decodeJwtPayloadUnsafe,
  userInfoFromJwt,
  runWithDeps,
  run,
};
