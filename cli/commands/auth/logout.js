// @ts-check
/**
 * [H8.13] logout.js — `frootai logout` handler. Removes the
 * `~/.config/frootai/credentials.json` file (no server round-trip — the
 * server-side token revocation is a future ship; logout today is purely
 * local cache eviction).
 *
 * Contract slice (from masterplan §3 row [H8.13]):
 *   `frootai login` / `frootai logout` OAuth2 device-flow against
 *   `frootai.dev/auth`; tokens cached at
 *   `~/.config/frootai/credentials.json` 0600 perm
 *
 * Pipeline (per invocation):
 *   1. parse argv (`--json`, `--help`)
 *   2. delete credentials.json (no-op if absent)
 *   3. emit summary
 *
 * Two surfaces (mirrors login.js + the orchard handlers):
 *
 *   1. Programmatic `runWithDeps(args, ctx, deps) → Promise<number>` —
 *      pure + injectable: `{credentialsStore, credentialsBackend,
 *      credentialsPath, env}`.
 *
 *   2. Router-facing `run(args, ctx)` — default deps use the file-backed
 *      credentials store at the XDG-default path.
 *
 * Subcommand argv grammar:
 *   --json               machine-readable single-line JSON to stdout
 *   --help, -h           print help + exit OK
 *
 * Exit codes (sysexits-aligned):
 *   0    OK             — file removed (or was already absent)
 *   64   USAGE          — bad flags
 *   70   SOFTWARE       — unexpected internal error
 *   74   IOERR          — file existed but unlink failed (permissions, etc.)
 *
 * Non-goals for THIS ship:
 *   - Server-side token revocation (a future ship will POST /auth/revoke).
 *   - Clearing OS keychain entries (when the keychain backend ships).
 *   - Logging-out all devices (server-side).
 *
 * License: CC0-1.0.
 */
"use strict";

const credentialsStore = require("./credentials-store.js");

/** Local sysexits enum. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  SOFTWARE: 70,
  IOERR: 74,
});

/** Error carrying a sysexits exit code. */
class LogoutHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "LogoutHandlerError";
    this.code = opts.code || "logout_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the subcommand-local argv. NO positionals. Unknown long flags → USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ json: boolean, help: boolean }}
 */
function parseLogoutArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseLogoutArgs: argv must be an array");
  }
  /** @type {{ json: boolean, help: boolean }} */
  const out = { json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new LogoutHandlerError(`argv entry ${i} must be a string`, { code: "bad_args", exitCode: EXIT.USAGE });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--json") { out.json = true; continue; }
    if (arg.startsWith("-")) {
      throw new LogoutHandlerError(`unknown flag: ${arg}`, { code: "bad_args", exitCode: EXIT.USAGE });
    }
    throw new LogoutHandlerError(
      `unexpected positional argument: ${arg} (frootai logout takes no positionals)`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  return out;
}

/** Build the `frootai logout --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai logout [options]",
    "",
    "Clear cached credentials at ~/.config/frootai/credentials.json.",
    "Local-only — does not revoke the token server-side (a future ship will).",
    "",
    "Options:",
    "  --json               machine-readable single-line JSON to stdout",
    "  --help, -h           show this help and exit",
    "",
    "Exit codes:",
    "  0   success (file removed or was already absent)",
    "  64  bad args",
    "  70  unexpected internal error",
    "  74  file existed but unlink failed (permissions, etc.)",
    "",
    "Examples:",
    "  frootai logout",
    "  frootai logout --json",
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
 * Programmatic surface. Pure + injectable.
 *
 * @param {readonly string[]} args
 * @param {object} ctx
 * @param {object} [deps]
 * @param {object} [deps.credentialsStore]
 * @param {object} [deps.credentialsBackend]
 * @param {string} [deps.credentialsPath]
 * @param {Record<string,string|undefined>} [deps.env]
 * @returns {Promise<number>}
 */
async function runWithDeps(args, ctx, deps = {}) {
  const stdout = (ctx && ctx.stdout) || ((s) => process.stdout.write(s));
  const stderr = (ctx && ctx.stderr) || ((s) => process.stderr.write(s));
  const store = deps.credentialsStore || credentialsStore;
  const env = deps.env || process.env;

  /** @type {ReturnType<typeof parseLogoutArgs>} */
  let parsed;
  try {
    parsed = parseLogoutArgs(args || []);
  } catch (err) {
    if (err instanceof LogoutHandlerError) {
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

  // Resolve the path FIRST so we can include it in the summary regardless of
  // whether the file existed.
  const credPath = deps.credentialsPath
    || (deps.credentialsBackend && deps.credentialsBackend.path)
    || store.resolveCredentialsPath({ env });

  /** @type {boolean} */
  let removed;
  try {
    removed = await store.deleteCredentials({
      backend: deps.credentialsBackend,
      path: deps.credentialsPath,
      env,
    });
  } catch (err) {
    const code = (err && err.code) || "delete_failed";
    const exitCode = Number.isInteger(err && err.exitCode) ? err.exitCode : EXIT.IOERR;
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code, message, exit_code: exitCode } }));
    else emit(stderr, `error: ${message}`);
    return exitCode;
  }

  const summary = {
    ok: true,
    removed,
    credentials_path: credPath,
    message: removed
      ? "credentials removed"
      : "no credentials were stored (nothing to remove)",
  };
  if (json) {
    const body = verbose ? JSON.stringify(summary, null, 2) : JSON.stringify(summary);
    emit(stdout, body);
  } else {
    emit(stdout, removed
      ? `Logged out. Removed ${credPath}.`
      : `Already logged out (no credentials at ${credPath}).`);
  }
  return EXIT.OK;
}

/** Router-facing entry. */
function run(args, ctx) { return runWithDeps(args, ctx, {}); }

module.exports = {
  EXIT,
  LogoutHandlerError,
  parseLogoutArgs,
  buildHelp,
  runWithDeps,
  run,
};
