// @ts-check
/**
 * [H8.16] config.js — `frootai config <subcommand>` top-level handler.
 *
 * Contract (verbatim from masterplan §3 row [H8.16]):
 *   Telemetry opt-out: `frootai config set telemetry false` disables OTEL;
 *   opt-in by default with first-run consent banner; document at
 *   `docs/cli/telemetry.md`
 *
 * Top-level handler under `cli/commands/config/` (parallels H8.13 auth/).
 * Two-surface contract: `runWithDeps(args, ctx, deps)` (hermetic) +
 * `run(args, ctx)` (default deps wire real `node:fs`).
 *
 * Subcommands:
 *   - `set <key> <value>`  — write a single config field. Validates
 *     against `ALLOWED_KEYS` + `coerceConfigValue()`.
 *   - `get <key>`          — read a single field. Plain value to stdout
 *     (non-json) or `{ok, key, value}` JSON envelope (--json).
 *   - `list`               — print all fields. Table to stdout (non-json)
 *     or full Config JSON (--json). Includes EFFECTIVE telemetry state
 *     (after DO_NOT_TRACK env override).
 *   - `path`               — print the resolved config file path. Always
 *     emits exactly one line so shell scripts can `cat $(frootai config
 *     path)` cleanly.
 *
 * Subcommand argv grammar (everything AFTER `config` in `argv`):
 *   <subcommand>           one of: set, get, list, path
 *   [<key>] [<value>]      positional args for set/get
 *   --json                 machine-readable JSON to stdout
 *   --help, -h             print help + exit OK
 *
 * Exit codes (sysexits-aligned):
 *   0    OK             — read or write succeeded
 *   64   USAGE          — bad flags / unknown subcommand / unknown key /
 *                          bad coercion / wrong arity
 *   70   SOFTWARE       — unexpected internal error
 *   74   IOERR          — config file write failure
 *
 * Non-goals for THIS ship:
 *   - Interactive `config edit` (a future ship can shell out to $EDITOR).
 *   - Per-project `.frootairc` files (a future "config layering" ship).
 *   - Migration from the A4.27 `~/.frootai/config.json` (the two stores
 *     coexist per H8.13 doctrine; reconciliation is a deferred bin step).
 *
 * License: CC0-1.0.
 */
"use strict";

const configStore = require("./config-store.js");

/** Local sysexits enum. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  SOFTWARE: 70,
  IOERR: 74,
});

/** Allowed subcommands. Frozen. */
const SUBCOMMANDS = Object.freeze(["set", "get", "list", "path"]);

/** Error carrying a sysexits exit code. */
class ConfigHandlerError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "ConfigHandlerError";
    this.code = opts.code || "config_handler_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the subcommand-local argv. Recognises one positional subcommand
 * followed by 0..2 positional args (key + value for `set`, key for `get`,
 * none for `list`/`path`). Unknown long flags → USAGE.
 *
 * @param {readonly string[]} argv
 * @returns {{ subcommand: string|null, key: string|null, value: string|null, json: boolean, help: boolean }}
 */
function parseConfigArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseConfigArgs: argv must be an array");
  }
  /** @type {{ subcommand: string|null, key: string|null, value: string|null, json: boolean, help: boolean }} */
  const out = { subcommand: null, key: null, value: null, json: false, help: false };
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new ConfigHandlerError(`argv entry ${i} must be a string`, { code: "bad_args", exitCode: EXIT.USAGE });
    }
    if (arg === "--help" || arg === "-h") { out.help = true; continue; }
    if (arg === "--json") { out.json = true; continue; }
    if (arg.startsWith("--")) {
      throw new ConfigHandlerError(`unknown flag: ${arg}`, { code: "bad_args", exitCode: EXIT.USAGE });
    }
    positionals.push(arg);
  }
  if (positionals.length > 0) out.subcommand = positionals[0];
  if (positionals.length > 1) out.key = positionals[1];
  if (positionals.length > 2) out.value = positionals[2];
  if (positionals.length > 3) {
    throw new ConfigHandlerError(
      `too many positional arguments (got ${positionals.length}; expected at most 3: <subcommand> [<key>] [<value>])`,
      { code: "bad_args", exitCode: EXIT.USAGE },
    );
  }
  return out;
}

/** Build the `frootai config --help` banner. */
function buildHelp() {
  return [
    "Usage: frootai config <subcommand> [args] [options]",
    "",
    "Manage CLI preferences stored at ~/.config/frootai/config.json.",
    "",
    "Subcommands:",
    "  set <key> <value>     write a single field (validated)",
    "  get <key>             read a single field",
    "  list                  print all fields + effective telemetry state",
    "  path                  print the resolved config file path",
    "",
    "Keys (validated against an allow-list):",
    "  telemetry             true|false|1|0|yes|no|on|off (default: false)",
    "  anonymous_mode        true|false|... (default: true)",
    "  last_subcommand       string (1..64 chars)",
    "",
    "Options:",
    "  --json                machine-readable JSON to stdout (default off)",
    "  --help, -h            show this help and exit",
    "",
    "Environment:",
    "  DO_NOT_TRACK=1        forces telemetry OFF regardless of config",
    "  XDG_CONFIG_HOME       override config-file directory (absolute path)",
    "",
    "Exit codes:",
    "  0   success",
    "  64  bad args / unknown subcommand / unknown key / bad value",
    "  70  unexpected internal error",
    "  74  config-file write failure",
    "",
    "Examples:",
    "  frootai config set telemetry false   # opt out of anonymous telemetry",
    "  frootai config set telemetry true    # opt in",
    "  frootai config get telemetry",
    "  frootai config list --json",
    "  frootai config path",
    "",
  ].join("\n");
}

/** Emit a string to a sink that may be `(s) => void` or `{ write }`. */
function emit(sink, text) {
  const s = text.endsWith("\n") ? text : `${text}\n`;
  if (typeof sink === "function") sink(s);
  else if (sink && typeof sink.write === "function") sink.write(s);
}

/** Format the `list` table for non-json output. Pure. */
function formatList(cfg, effectiveTelemetry, configPath) {
  const lines = [];
  lines.push(`Path: ${configPath}`);
  lines.push(`v: ${cfg.v}`);
  lines.push(`telemetry: ${cfg.telemetry} (effective: ${effectiveTelemetry})`);
  lines.push(`anonymous_mode: ${cfg.anonymous_mode}`);
  lines.push(`consent_recorded_at: ${cfg.consent_recorded_at || "(not yet)"}`);
  lines.push(`first_run_at: ${cfg.first_run_at || "(not yet)"}`);
  lines.push(`last_subcommand: ${cfg.last_subcommand || "(none)"}`);
  return lines.join("\n");
}

/**
 * Programmatic surface. Hermetic via injectable deps.
 *
 * @param {readonly string[]} args
 * @param {object} ctx
 * @param {object} [deps]
 * @param {object} [deps.configStore]
 * @param {object} [deps.configBackend]
 * @param {string} [deps.configPath]
 * @param {Record<string,string|undefined>} [deps.env]
 * @param {() => string} [deps.homedir]
 * @param {string} [deps.nowIso]
 * @returns {Promise<number>}
 */
async function runWithDeps(args, ctx, deps = {}) {
  const stdout = (ctx && ctx.stdout) || ((s) => process.stdout.write(s));
  const stderr = (ctx && ctx.stderr) || ((s) => process.stderr.write(s));
  const store = deps.configStore || configStore;
  const env = deps.env || process.env;

  /** @type {ReturnType<typeof parseConfigArgs>} */
  let parsed;
  try {
    parsed = parseConfigArgs(args || []);
  } catch (err) {
    if (err instanceof ConfigHandlerError) {
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

  if (parsed.subcommand === null) {
    if (json) {
      emit(stdout, JSON.stringify({ ok: false, error: { code: "no_subcommand", message: "no subcommand provided", exit_code: EXIT.USAGE } }));
    } else {
      emit(stderr, "error: no subcommand provided");
      emit(stderr, buildHelp());
    }
    return EXIT.USAGE;
  }

  if (!SUBCOMMANDS.includes(parsed.subcommand)) {
    const message = `unknown subcommand "${parsed.subcommand}" (one of: ${SUBCOMMANDS.join(", ")})`;
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "unknown_subcommand", message, exit_code: EXIT.USAGE } }));
    else { emit(stderr, `error: ${message}`); emit(stderr, buildHelp()); }
    return EXIT.USAGE;
  }

  const configPath = deps.configPath
    || (deps.configBackend && deps.configBackend.path)
    || store.resolveCredentialsPath ? null : null; // intentional placeholder; see below

  // Resolve actual config path (for surface output + the "path" subcommand).
  const resolvedPath = deps.configPath
    || (deps.configBackend && deps.configBackend.path)
    || store.resolveConfigPath({ env, homedir: deps.homedir });

  // ── path subcommand: pure, never reads the file ──
  if (parsed.subcommand === "path") {
    if (parsed.key !== null) {
      const message = `'config path' takes no arguments (got "${parsed.key}")`;
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_args", message, exit_code: EXIT.USAGE } }));
      else emit(stderr, `error: ${message}`);
      return EXIT.USAGE;
    }
    if (json) emit(stdout, JSON.stringify({ ok: true, path: resolvedPath }));
    else emit(stdout, resolvedPath);
    return EXIT.OK;
  }

  // ── For set/get/list: load (or seed) the config ──
  /** @type {object} */
  let cfg;
  try {
    cfg = await store.readConfig({
      backend: deps.configBackend,
      path: deps.configPath,
      env, homedir: deps.homedir, nowIso: deps.nowIso,
      // Skip the first-run-stamp write for `get`/`list` so we don't
      // accidentally create the file just by reading it. The `set`
      // subcommand will write anyway.
      stampFirstRun: parsed.subcommand === "set",
    });
  } catch (err) {
    const code = (err && err.code) || "read_failed";
    const exitCode = Number.isInteger(err && err.exitCode) ? err.exitCode : EXIT.SOFTWARE;
    const message = err instanceof Error ? err.message : String(err);
    if (json) emit(stdout, JSON.stringify({ ok: false, error: { code, message, exit_code: exitCode } }));
    else emit(stderr, `error: ${message}`);
    return exitCode;
  }

  if (parsed.subcommand === "get") {
    if (parsed.key === null) {
      const message = "'config get' requires a key argument";
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_args", message, exit_code: EXIT.USAGE } }));
      else { emit(stderr, `error: ${message}`); emit(stderr, buildHelp()); }
      return EXIT.USAGE;
    }
    if (parsed.value !== null) {
      const message = `'config get' takes only a key (got value "${parsed.value}"; did you mean \`config set\`?)`;
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_args", message, exit_code: EXIT.USAGE } }));
      else emit(stderr, `error: ${message}`);
      return EXIT.USAGE;
    }
    if (!store.ALLOWED_KEYS.includes(parsed.key)) {
      const message = `unknown config key "${parsed.key}" (allowed: ${store.ALLOWED_KEYS.join(", ")})`;
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "unknown_key", message, exit_code: EXIT.USAGE } }));
      else emit(stderr, `error: ${message}`);
      return EXIT.USAGE;
    }
    const value = cfg[parsed.key];
    if (json) {
      emit(stdout, JSON.stringify({ ok: true, key: parsed.key, value: value === undefined ? null : value }));
    } else {
      emit(stdout, String(value === undefined ? "" : value));
    }
    return EXIT.OK;
  }

  if (parsed.subcommand === "list") {
    if (parsed.key !== null) {
      const message = `'config list' takes no arguments (got "${parsed.key}")`;
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_args", message, exit_code: EXIT.USAGE } }));
      else emit(stderr, `error: ${message}`);
      return EXIT.USAGE;
    }
    const effectiveTelemetry = store.isTelemetryEnabled(cfg, env);
    if (json) {
      const summary = {
        ok: true, path: resolvedPath,
        config: cfg,
        effective: {
          telemetry: effectiveTelemetry,
          do_not_track_env: store.isDoNotTrackEnv(env),
        },
      };
      const body = verbose ? JSON.stringify(summary, null, 2) : JSON.stringify(summary);
      emit(stdout, body);
    } else {
      emit(stdout, formatList(cfg, effectiveTelemetry, resolvedPath));
    }
    return EXIT.OK;
  }

  // ── set subcommand ──
  if (parsed.subcommand === "set") {
    if (parsed.key === null) {
      const message = "'config set' requires a key argument";
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_args", message, exit_code: EXIT.USAGE } }));
      else { emit(stderr, `error: ${message}`); emit(stderr, buildHelp()); }
      return EXIT.USAGE;
    }
    if (parsed.value === null) {
      const message = `'config set ${parsed.key}' requires a value argument`;
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_args", message, exit_code: EXIT.USAGE } }));
      else { emit(stderr, `error: ${message}`); emit(stderr, buildHelp()); }
      return EXIT.USAGE;
    }
    const coerce = store.coerceConfigValue(parsed.key, parsed.value);
    if (!coerce.ok) {
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code: "bad_value", message: coerce.error, exit_code: EXIT.USAGE } }));
      else emit(stderr, `error: ${coerce.error}`);
      return EXIT.USAGE;
    }
    // Setting telemetry explicitly also records consent so the banner
    // doesn't fire later. Other keys leave consent untouched.
    /** @type {Record<string, any>} */
    const patch = { [parsed.key]: coerce.value };
    if (parsed.key === "telemetry") {
      patch.consent_recorded_at = deps.nowIso || new Date().toISOString();
    }
    let writeResult;
    try {
      writeResult = await store.writeConfig(patch, {
        backend: deps.configBackend,
        path: deps.configPath,
        env, homedir: deps.homedir, nowIso: deps.nowIso,
      });
    } catch (err) {
      const code = (err && err.code) || "write_failed";
      const exitCode = Number.isInteger(err && err.exitCode) ? err.exitCode : EXIT.IOERR;
      const message = err instanceof Error ? err.message : String(err);
      if (json) emit(stdout, JSON.stringify({ ok: false, error: { code, message, exit_code: exitCode } }));
      else emit(stderr, `error: ${message}`);
      return exitCode;
    }
    if (json) {
      emit(stdout, JSON.stringify({
        ok: true,
        path: writeResult.path,
        bytes: writeResult.bytes,
        key: parsed.key,
        value: coerce.value,
        effective_telemetry: store.isTelemetryEnabled(writeResult.config, env),
      }));
    } else {
      emit(stdout, `set ${parsed.key} = ${coerce.value} (${writeResult.path})`);
      if (parsed.key === "telemetry") {
        const eff = store.isTelemetryEnabled(writeResult.config, env);
        if (coerce.value === true && eff === false) {
          emit(stdout, "Note: DO_NOT_TRACK env is set — telemetry remains OFF until you unset it.");
        }
      }
    }
    return EXIT.OK;
  }

  // Should be unreachable due to subcommand allow-list check above.
  return EXIT.SOFTWARE;
}

/** Router-facing entry. */
function run(args, ctx) { return runWithDeps(args, ctx, {}); }

module.exports = {
  EXIT,
  SUBCOMMANDS,
  ConfigHandlerError,
  parseConfigArgs,
  buildHelp,
  formatList,
  runWithDeps,
  run,
};
