// @ts-check
/**
 * [H8.1] orchard/index.js — the `frootai orchard <subcommand>` router.
 *
 * Contract (verbatim from masterplan §3 row [H8.1]):
 *   `frootai-core/cli/commands/orchard/index.js`: subcommand router; help
 *   text; --version; --json global flag; --quiet / --verbose.
 *
 * This is the FRICTION-FREE developer entry-point that wires every harvest
 * stage (H1–H6) + the publish path (H7) into one command family. It is the
 * highest-conversion surface in the whole product: every `--customize` and
 * every non-MSFT-anchor `--as-play` import is a paid event, and the `--help`
 * banner doubles as the conversion-funnel landing for paid imports.
 *
 * Two surfaces, one module (mirroring the H1.19 discover-cli shape):
 *
 *   1. Programmatic `run(argv, deps) → Promise<number>` — pure + injectable.
 *      `deps` lets tests inject `{ stdout, stderr, resolveHandler, version }`
 *      so the router can be exercised hermetically (no real subcommand
 *      modules required, no process side effects).
 *
 *   2. CLI `main(argv) → Promise<number>` — wires real stdout/stderr +
 *      lazy on-disk handler resolution, then `process.exit()` on the code.
 *      Standalone-invokable:
 *        node cli/commands/orchard/index.js discover owner/repo
 *
 * Global flags (parsed BEFORE the subcommand; pinned by the masterplan):
 *   --json            machine-readable output mode (threaded into handler ctx
 *                     + used for the router's own error / version envelopes)
 *   --quiet  / -q     suppress prose chatter (mutually exclusive with verbose)
 *   --verbose / -v    extra human-readable trace (mutually exclusive w/ quiet)
 *   --version / -V    print the CLI version + exit 0
 *   --help    / -h    print the help banner + exit 0
 *
 * Everything AFTER the subcommand token is passed to the handler verbatim, so
 * each stage command owns its own flag grammar (`--no-cache`, `--force`, etc.).
 *
 * Handler contract: a resolved handler is `run(args, ctx) → Promise<number>`
 * where `ctx = { json, quiet, verbose, stdout, stderr, version, subcommand }`.
 * The router awaits it + returns its exit code. The 8 canonical stage
 * commands are wired one-per-sub-phase across [H8.2]–[H8.10]; until a handler
 * module exists, the router emits a clean "not yet wired" notice + exits
 * EX_UNAVAILABLE so the surface degrades honestly rather than crashing.
 *
 * Exit codes (sysexits-aligned; identical enum to the H0/H1 stages):
 *   0   EXIT_OK            — success (help / version / handler returned 0)
 *   64  EXIT_USAGE         — bad global flags / unknown subcommand
 *   65  EXIT_DATA_ERR      — handler data failure (surfaced by the handler)
 *   69  EXIT_UNAVAILABLE   — known subcommand whose handler is not yet wired
 *   70  EXIT_SOFTWARE      — unexpected internal error
 *   77  EXIT_NOPERM        — permission failure (surfaced by the handler)
 *
 * Non-goals for THIS ship (explicit):
 *   - Wiring any stage handler — `discover` ([H8.2]) … `commit` ([H8.10])
 *     each ship their own `cli/commands/orchard/<name>.js` module; this row
 *     only ships the router + global-flag grammar + help banner.
 *   - Touching `bin.js` — the existing `frootai orchard …` A-series browse
 *     surface (`lib/orchard/dispatch.js`) keeps its bin route; reconciling the
 *     two `orchard` namespaces is deferred to the bin-wiring sub-phase.
 *   - Auth / entitlement gating ([H8.13]–[H8.15]) — handlers own that.
 *
 * License: CC0-1.0.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * Sysexits-aligned exit codes — byte-identical to the harvest stage enums so
 * a caller can switch on the same numbers across `discover`, `fetch`, … here.
 */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  DATA_ERR: 65,
  UNAVAILABLE: 69,
  SOFTWARE: 70,
  NOPERM: 77,
});

/**
 * The 8 canonical stage subcommands the masterplan's "Done definition" pins
 * for `frootai orchard --help`. Each carries the H8 sub-phase that wires its
 * real handler + the upstream library row it bridges to, so the help banner
 * is also a live status map. Frozen — adding a subcommand is a masterplan
 * amendment (and a new `cli/commands/orchard/<name>.js` module).
 */
const SUBCOMMANDS = Object.freeze([
  Object.freeze({ name: "discover", args: "<url>", summary: "Resolve + validate an upstream repo (wraps the H1 discover library)", phase: "H8.2", wires: "H1" }),
  Object.freeze({ name: "fetch", args: "<url>", summary: "Snapshot repo files at a pinned commit (wraps the H2 fetch library)", phase: "H8.3", wires: "H2" }),
  Object.freeze({ name: "extract", args: "<url>", summary: "Extract RepoFacts from a fetched snapshot (wraps the H3 extract library)", phase: "H8.4", wires: "H3" }),
  Object.freeze({ name: "retrieve", args: "<url>", summary: "Retrieve nearest reference plays from the corpus (wraps the H4 library)", phase: "H8.5", wires: "H4" }),
  Object.freeze({ name: "scaffold", args: "<url>", summary: "Generate the play file set from RepoFacts (wraps the H5 scaffold library)", phase: "H8.6", wires: "H5" }),
  Object.freeze({ name: "compose-infra", args: "<url>", summary: "Compose deployable infra under a policy overlay (wraps the H6 library)", phase: "H8.7", wires: "H6" }),
  Object.freeze({ name: "customize", args: "<play>", summary: "Apply a policy overlay to a play; --dry-run emits a 3-way diff", phase: "H8.8", wires: "policy-overlay" }),
  Object.freeze({ name: "commit", args: "<play-dir>", summary: "Validate + bundle + publish a harvested play (runs the H7 publish path)", phase: "H8.10", wires: "H7" }),
]);

const SUBCOMMAND_NAMES = Object.freeze(SUBCOMMANDS.map((s) => s.name));
const SUBCOMMAND_NAME_SET = new Set(SUBCOMMAND_NAMES);

/**
 * Extra routable subcommands NOT listed in `--help`. Per masterplan
 * "Done-definition pins `--help` to list exactly 8 subcommands.
 *  install/re-harvest/list-pending-reviews (H8.9/H8.11/H8.12) are additional".
 * Each entry still lazy-loads via `defaultResolveHandler`. Frozen.
 */
const EXTRA_SUBCOMMANDS = Object.freeze([
  Object.freeze({ name: "install", args: "--as-play <url|slug>", summary: "End-to-end harvest pipeline: discover → fetch → extract → retrieve → scaffold → compose-infra → validate", phase: "H8.9", wires: "H1..H7" }),
  Object.freeze({ name: "re-harvest", args: "<play>", summary: "Re-run the pipeline at upstream HEAD; emit 3-way diff against published version", phase: "H8.11", wires: "H1..H6" }),
  Object.freeze({ name: "list-pending-reviews", args: "", summary: "List harvested plays not yet committed (confidence + warnings + license class)", phase: "H8.12", wires: "review-queue" }),
]);

const EXTRA_SUBCOMMAND_NAMES = Object.freeze(EXTRA_SUBCOMMANDS.map((s) => s.name));
const EXTRA_SUBCOMMAND_NAME_SET = new Set(EXTRA_SUBCOMMAND_NAMES);

/** Full set of routable subcommands (used by the dispatcher). */
const ALL_SUBCOMMAND_NAME_SET = new Set([...SUBCOMMAND_NAMES, ...EXTRA_SUBCOMMAND_NAMES]);

/** Recognized leading global flags (and their short aliases). */
const GLOBAL_FLAGS = Object.freeze({
  "--json": "json",
  "--quiet": "quiet",
  "-q": "quiet",
  "--verbose": "verbose",
  "-v": "verbose",
  "--version": "version",
  "-V": "version",
  "--help": "help",
  "-h": "help",
});

/**
 * Canonical router error. Carries a deterministic `.code` + a sysexits
 * `.exitCode` so `run()` can translate any throw into a clean exit + (in
 * `--json` mode) a structured envelope.
 */
class OrchardCliError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, exitCode?: number, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "OrchardCliError";
    this.code = opts.code || "orchard_cli_failed";
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse the leading global flags + split off the subcommand and its verbatim
 * argument tail. Global flags must precede the subcommand; the first token
 * that is not a recognized global flag is treated as the subcommand and
 * everything after it is the handler's `rest`.
 *
 * @param {readonly string[]} argv
 * @returns {{ json: boolean, quiet: boolean, verbose: boolean, version: boolean, help: boolean, subcommand: string | null, rest: string[] }}
 */
function parseGlobalArgs(argv) {
  if (!Array.isArray(argv)) {
    throw new TypeError("parseGlobalArgs: argv must be an array");
  }
  const out = {
    json: false,
    quiet: false,
    verbose: false,
    version: false,
    help: false,
    /** @type {string | null} */
    subcommand: null,
    /** @type {string[]} */
    rest: [],
  };
  let i = 0;
  for (; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== "string") {
      throw new OrchardCliError(`global argv entry ${i} must be a string`, {
        code: "bad_args",
        exitCode: EXIT.USAGE,
      });
    }
    if (Object.prototype.hasOwnProperty.call(GLOBAL_FLAGS, arg)) {
      const key = GLOBAL_FLAGS[arg];
      out[key] = true;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new OrchardCliError(`unknown global flag: ${arg}`, {
        code: "bad_args",
        exitCode: EXIT.USAGE,
      });
    }
    // First non-flag token = the subcommand. Tail passes through untouched.
    out.subcommand = arg;
    out.rest = argv.slice(i + 1).map(String);
    break;
  }
  if (out.quiet && out.verbose) {
    throw new OrchardCliError("--quiet and --verbose are mutually exclusive", {
      code: "bad_args",
      exitCode: EXIT.USAGE,
    });
  }
  return out;
}

/**
 * Read the CLI version from `cli/package.json`. Never throws — falls back to
 * "0.0.0" so `--version` always produces a line.
 *
 * @param {(p: string) => string} [readFile]
 * @returns {string}
 */
function readVersion(readFile) {
  const read = readFile || ((p) => fs.readFileSync(p, "utf-8"));
  try {
    const pkgPath = path.resolve(__dirname, "..", "..", "package.json");
    const pkg = JSON.parse(read(pkgPath));
    return typeof pkg.version === "string" && pkg.version.length > 0 ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Build the `frootai orchard --help` banner. Lists the 8 canonical stage
 * subcommands + the global flags + a couple of conversion-oriented examples.
 *
 * @param {{ version?: string }} [opts]
 * @returns {string}
 */
function buildHelp(opts = {}) {
  const version = opts.version || readVersion();
  const lines = [];
  lines.push(`frootai orchard — harvest any repo into a deployable Solution Play (v${version})`);
  lines.push("");
  lines.push("Usage:");
  lines.push("  frootai orchard [--json] [--quiet|--verbose] <subcommand> [args...]");
  lines.push("  frootai orchard --version");
  lines.push("  frootai orchard --help");
  lines.push("");
  lines.push("Subcommands:");
  const width = Math.max(...SUBCOMMANDS.map((s) => `${s.name} ${s.args}`.length));
  for (const s of SUBCOMMANDS) {
    const sig = `${s.name} ${s.args}`.padEnd(width);
    lines.push(`  ${sig}   ${s.summary}`);
  }
  lines.push("");
  lines.push("Global flags:");
  lines.push("  --json            Machine-readable JSON output");
  lines.push("  --quiet, -q       Suppress prose chatter");
  lines.push("  --verbose, -v     Extra human-readable trace");
  lines.push("  --version, -V     Print version + exit");
  lines.push("  --help, -h        Print this help + exit");
  lines.push("");
  lines.push("Examples:");
  lines.push("  frootai orchard discover Azure-Samples/azure-search-openai-demo");
  lines.push("  frootai orchard scaffold https://github.com/Azure-Samples/azure-search-openai-demo");
  lines.push("  frootai orchard customize my-play --policy company-policy.yaml --dry-run");
  lines.push("");
  return lines.join("\n");
}

/**
 * Default on-disk handler resolver. Lazy-requires `./<name>.js` and returns
 * its `run` function (or a bare-function export). Returns `null` when the
 * module does not exist yet (a known-but-not-yet-wired subcommand) so the
 * router can degrade honestly. Re-throws any other require error (e.g. a
 * syntax error inside a real handler) so it surfaces as EXIT_SOFTWARE.
 *
 * @param {string} name
 * @returns {((args: string[], ctx: object) => number | Promise<number>) | null}
 */
function defaultResolveHandler(name) {
  let mod;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    mod = require(path.join(__dirname, `${name}.js`));
  } catch (err) {
    if (err && /** @type {any} */ (err).code === "MODULE_NOT_FOUND") {
      // Only swallow when it's THIS module that's missing, not a transitive dep.
      const msg = String(/** @type {any} */ (err).message || "");
      if (msg.includes(`${name}.js`) || msg.includes(path.join("orchard", name))) {
        return null;
      }
    }
    throw err;
  }
  if (typeof mod === "function") return mod;
  if (mod && typeof mod.run === "function") return mod.run;
  return null;
}

/**
 * Write a line to a sink that may be a function (`process.stdout.write`-style)
 * or `{ write }`. Always terminates with a newline if absent.
 *
 * @param {((s: string) => void) | { write: (s: string) => void }} sink
 * @param {string} text
 */
function emit(sink, text) {
  const s = text.endsWith("\n") ? text : `${text}\n`;
  if (typeof sink === "function") sink(s);
  else if (sink && typeof sink.write === "function") sink.write(s);
}

/**
 * Run the orchard router.
 *
 * @param {readonly string[]} argv  argv AFTER `frootai orchard` (i.e. the
 *   subcommand + flags), e.g. `["--json", "discover", "owner/repo"]`.
 * @param {object} [deps]
 * @param {((s: string) => void) | { write: (s: string) => void }} [deps.stdout]
 * @param {((s: string) => void) | { write: (s: string) => void }} [deps.stderr]
 * @param {(name: string) => ((args: string[], ctx: object) => number | Promise<number>) | null} [deps.resolveHandler]
 * @param {string} [deps.version]
 * @returns {Promise<number>} the exit code
 */
async function run(argv, deps = {}) {
  const stdout = deps.stdout || ((s) => process.stdout.write(s));
  const stderr = deps.stderr || ((s) => process.stderr.write(s));
  const resolveHandler = deps.resolveHandler || defaultResolveHandler;
  const version = deps.version || readVersion();

  let parsed;
  try {
    parsed = parseGlobalArgs(argv);
  } catch (err) {
    return handleTopLevelError(err, { json: false, stdout, stderr });
  }

  // --version wins over everything except a parse error.
  if (parsed.version) {
    if (parsed.json) emit(stdout, JSON.stringify({ name: "frootai-orchard", version }));
    else emit(stdout, `frootai orchard v${version}`);
    return EXIT.OK;
  }

  // --help, or no subcommand at all, prints the banner.
  if (parsed.help || parsed.subcommand === null) {
    if (parsed.json) {
      emit(stdout, JSON.stringify({
        name: "frootai-orchard",
        version,
        subcommands: SUBCOMMANDS.map((s) => ({ name: s.name, args: s.args, summary: s.summary })),
      }));
    } else {
      emit(stdout, buildHelp({ version }));
    }
    return EXIT.OK;
  }

  const subcommand = parsed.subcommand;
  if (!ALL_SUBCOMMAND_NAME_SET.has(subcommand)) {
    const message = `unknown subcommand: ${subcommand}`;
    if (parsed.json) {
      emit(stdout, JSON.stringify({ ok: false, error: { code: "unknown_subcommand", message } }));
    } else {
      emit(stderr, `error: ${message}`);
      emit(stderr, `run 'frootai orchard --help' to see the ${SUBCOMMAND_NAMES.length} available subcommands`);
    }
    return EXIT.USAGE;
  }

  // Resolve the stage handler. A known-but-unwired subcommand degrades to a
  // clean EX_UNAVAILABLE notice rather than crashing.
  let handler;
  try {
    handler = resolveHandler(subcommand);
  } catch (err) {
    return handleTopLevelError(err, { json: parsed.json, stdout, stderr });
  }
  if (typeof handler !== "function") {
    const meta = SUBCOMMANDS.find((s) => s.name === subcommand)
      || EXTRA_SUBCOMMANDS.find((s) => s.name === subcommand);
    const phase = meta ? meta.phase : "a later sub-phase";
    const message = `subcommand '${subcommand}' is not yet wired (ships in ${phase})`;
    if (parsed.json) {
      emit(stdout, JSON.stringify({ ok: false, error: { code: "not_implemented", message, subcommand, phase } }));
    } else {
      emit(stderr, `notice: ${message}`);
    }
    return EXIT.UNAVAILABLE;
  }

  const ctx = Object.freeze({
    json: parsed.json,
    quiet: parsed.quiet,
    verbose: parsed.verbose,
    stdout,
    stderr,
    version,
    subcommand,
  });

  try {
    const code = await handler(parsed.rest, ctx);
    return Number.isInteger(code) ? code : EXIT.OK;
  } catch (err) {
    return handleTopLevelError(err, { json: parsed.json, stdout, stderr });
  }
}

/**
 * Translate any thrown error into an exit code + a clean message / JSON
 * envelope. OrchardCliError keeps its `.code` + `.exitCode`; anything else
 * becomes EX_SOFTWARE.
 *
 * @param {unknown} err
 * @param {{ json: boolean, stdout: any, stderr: any }} io
 * @returns {number}
 */
function handleTopLevelError(err, io) {
  const isCli = err instanceof OrchardCliError;
  const code = isCli ? /** @type {OrchardCliError} */ (err).code : "internal_error";
  const exitCode = isCli ? /** @type {OrchardCliError} */ (err).exitCode : EXIT.SOFTWARE;
  const message = err instanceof Error ? err.message : String(err);
  if (io.json) {
    emit(io.stdout, JSON.stringify({ ok: false, error: { code, message } }));
  } else {
    emit(io.stderr, `error: ${message}`);
  }
  return exitCode;
}

/**
 * CLI entry-point. Wires real process stdout/stderr + lazy on-disk handler
 * resolution, then resolves to the exit code.
 *
 * @param {readonly string[]} argv  argv AFTER `frootai orchard`
 * @returns {Promise<number>}
 */
async function main(argv) {
  return run(argv, {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
    resolveHandler: defaultResolveHandler,
  });
}

module.exports = {
  EXIT,
  SUBCOMMANDS,
  SUBCOMMAND_NAMES,
  EXTRA_SUBCOMMANDS,
  EXTRA_SUBCOMMAND_NAMES,
  ALL_SUBCOMMAND_NAME_SET,
  GLOBAL_FLAGS,
  OrchardCliError,
  parseGlobalArgs,
  readVersion,
  buildHelp,
  defaultResolveHandler,
  run,
  main,
};

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`fatal: ${err && err.stack ? err.stack : err}\n`);
      process.exit(EXIT.SOFTWARE);
    },
  );
}
