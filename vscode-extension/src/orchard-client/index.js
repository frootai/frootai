// @ts-check
/**
 * A5.19 — Orchard client: in-process wrapper around the CLI `cli/lib/orchard/dispatch.js`.
 *
 * Why in-process (not subprocess):
 *   - Subprocess spawn cost on Windows is ~200ms — unacceptable for a UI that
 *     re-fetches on every variety filter change in the tree view.
 *   - Subprocess output parsing (capturing stdout/stderr, parsing JSON,
 *     reattaching to log channels) is fragile + duplicates work the CLI
 *     already does internally.
 *   - The CLI dispatcher is already designed for dependency injection
 *     (deps.log/err/fetchImpl/etc.), so we just hand it our injected hooks.
 *
 * What this module does NOT do:
 *   - Touch `vscode` API directly. All vscode-aware glue (OutputChannel,
 *     StatusBar, ProgressNotification) lives in the consumer that wraps
 *     `buildOrchardClient`.
 *   - Hard-depend on `process.cwd` or `process.env` for paths. Every path
 *     is either passed in via opts or computed from `os.homedir()`.
 *
 * Doctrine:
 *   - Every call returns `{ ok, output, exitCode, parsed? }` — NEVER throws.
 *   - Output is captured into a buffer + parsed when `--json` is true.
 *   - Telemetry from the CLI dispatcher is suppressed by default (the VSCode
 *     extension emits its own telemetry via the existing extension telemetry
 *     surface). Override with `enableCliTelemetry: true`.
 *   - All file-IO paths (token, anon-id, config, bushel) default to ~/.frootai/*
 *     matching A4.9-A4.12 CLI conventions so a `frootai login` in terminal
 *     transparently signs in the VSCode extension (A5.22 contract).
 */
"use strict";

const path = require("node:path");
const os = require("node:os");

const { dispatch, SUBCOMMAND_NAMES } = require("../../../cli/lib/orchard/dispatch");

const DEFAULT_FROOTAI_DIR = path.join(os.homedir(), ".frootai");

const ALLOWED_SUBCOMMANDS = Object.freeze([
  "list", "search", "show", "install", "diff", "pollinate", "bushel",
]);

const RESERVED_VSCODE_FLAGS = Object.freeze([
  "no-color",      // we force --no-color since OutputChannel has no ANSI support
  "json",          // we force --json when caller wants parsed
]);

const OUTPUT_BUFFER_MAX_LINES = 10_000;   // safety cap — UI can't display more

// ---------------------------------------------------------------------------
// Pure helpers — exported for tests
// ---------------------------------------------------------------------------

/**
 * Pure: build the argv array for dispatch from a structured request.
 *
 * @param {object} req
 * @param {string} req.subcommand
 * @param {string[]} [req.positional]
 * @param {Record<string, string|number|boolean|null|undefined>} [req.flags]
 * @returns {string[]}
 */
function buildArgv(req) {
  if (!req || typeof req !== "object") throw new Error("buildArgv requires {subcommand}");
  const sub = req.subcommand;
  if (typeof sub !== "string" || sub.length === 0) {
    throw new Error("buildArgv requires a non-empty subcommand string");
  }
  if (!ALLOWED_SUBCOMMANDS.includes(sub)) {
    throw new Error(`subcommand "${sub}" not in ALLOWED_SUBCOMMANDS [${ALLOWED_SUBCOMMANDS.join(", ")}]`);
  }
  /** @type {string[]} */
  const argv = [sub];
  if (Array.isArray(req.positional)) {
    for (const p of req.positional) {
      if (typeof p !== "string" || p.length === 0) {
        throw new Error("buildArgv positional args must be non-empty strings");
      }
      argv.push(p);
    }
  }
  if (req.flags && typeof req.flags === "object") {
    for (const [k, v] of Object.entries(req.flags)) {
      if (v === undefined || v === null || v === false) continue;
      if (typeof k !== "string" || k.length === 0) continue;
      // Defensive: never let caller smuggle a positional disguised as a flag
      if (k.includes(" ")) throw new Error(`flag name "${k}" contains whitespace`);
      if (v === true) argv.push(`--${k}`);
      else argv.push(`--${k}`, String(v));
    }
  }
  return argv;
}

/**
 * Pure: build an output sink that buffers lines (capped) + forwards to an
 * optional secondary sink (e.g. VSCode OutputChannel.appendLine).
 *
 * @param {(line: string) => void} [forward]
 * @returns {{ buffer: string[], sink: (line: string) => void, joined: () => string }}
 */
function buildOutputSink(forward) {
  /** @type {string[]} */
  const buffer = [];
  let truncated = false;
  return {
    buffer,
    sink: (line) => {
      if (buffer.length >= OUTPUT_BUFFER_MAX_LINES) {
        if (!truncated) {
          truncated = true;
          buffer.push(`[orchard-client: output truncated at ${OUTPUT_BUFFER_MAX_LINES} lines]`);
        }
        return;
      }
      buffer.push(line);
      if (typeof forward === "function") {
        try { forward(line); } catch { /* never let UI sink kill the call */ }
      }
    },
    joined: () => buffer.join("\n"),
  };
}

/**
 * Pure: try to parse a string as JSON; return null on any failure.
 *
 * @param {string} text
 * @returns {unknown}
 */
function tryParseJson(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  // CLI commands emit only JSON when --json is set; nothing else on stdout.
  // But the dispatcher's error path may also append prose. We try the last
  // contiguous JSON-looking block to be robust.
  try {
    return JSON.parse(text);
  } catch {
    // Try to find a trailing { ... } block (last JSON object)
    const last = text.lastIndexOf("{");
    if (last === -1) return null;
    try { return JSON.parse(text.slice(last)); } catch { return null; }
  }
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Build an in-process Orchard CLI client.
 *
 * @param {object} [opts]
 * @param {string} [opts.frootaiDir]          base dir for ~/.frootai/* state files
 * @param {(line: string) => void} [opts.onLog]   forward CLI stdout lines (e.g. to OutputChannel)
 * @param {(line: string) => void} [opts.onErr]   forward CLI stderr lines
 * @param {Function} [opts.fetchImpl]         injected fetch (for tests / offline)
 * @param {Function} [opts.dispatchImpl]      override the CLI dispatcher (tests)
 * @param {boolean} [opts.enableCliTelemetry=false]   let the CLI emit its own events
 * @param {Record<string,unknown>} [opts.extraDeps]   pass-through to dispatch deps
 * @returns {{
 *   call: (req: object) => Promise<{ok: boolean, exitCode: number, output: string, parsed: unknown}>,
 *   list: (variety?: string, opts?: object) => Promise<object>,
 *   search: (query: string, opts?: object) => Promise<object>,
 *   show: (id: string, opts?: object) => Promise<object>,
 *   bushelList: () => Promise<object>,
 *   bushelAdd: (id: string) => Promise<object>,
 *   bushelRemove: (id: string) => Promise<object>,
 * }}
 */
function buildOrchardClient(opts) {
  const o = opts || {};
  const frootaiDir = o.frootaiDir || DEFAULT_FROOTAI_DIR;
  const dispatchImpl = typeof o.dispatchImpl === "function" ? o.dispatchImpl : dispatch;

  async function call(req) {
    // Validate + build argv (may throw — wrap so we NEVER propagate)
    /** @type {string[]} */
    let argv;
    try {
      argv = buildArgv(req);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, exitCode: 1, output: msg, parsed: null };
    }

    // Force --no-color (UI sinks don't render ANSI) + force --json when caller asked for parsed
    const wantJson = req && req.json === true;
    if (wantJson && !argv.includes("--json")) argv.push("--json");
    if (!argv.includes("--no-color")) argv.push("--no-color");

    const stdoutSink = buildOutputSink(o.onLog);
    const stderrSink = buildOutputSink(o.onErr);

    const deps = {
      log: stdoutSink.sink,
      err: stderrSink.sink,
      // Auth/state paths defaulted to the shared ~/.frootai dir per A5.22 contract.
      configPath: path.join(frootaiDir, "config.json"),
      tokenPath: path.join(frootaiDir, ".token"),
      anonIdPath: path.join(frootaiDir, "anon-id"),
      bushelPath: path.join(frootaiDir, "bushels.json"),
      entitlementsCachePath: path.join(frootaiDir, "entitlements.json"),
      // Network: forward injected fetch when provided (tests use a mock)
      fetchImpl: o.fetchImpl,
      // Telemetry: suppressed by default — the extension owns its own telemetry
      // surface. Operators who want CLI telemetry events from extension calls
      // can flip enableCliTelemetry:true.
      disableTelemetry: !o.enableCliTelemetry,
      ...(o.extraDeps || {}),
    };

    let result;
    try {
      result = await dispatchImpl(argv, deps);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, exitCode: 2, output: msg, parsed: null };
    }
    const text = stdoutSink.joined();
    const parsed = wantJson ? tryParseJson(text) : null;
    return {
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      output: text,
      parsed,
    };
  }

  // ───── Convenience wrappers — typed by intent ─────

  async function list(variety, listOpts) {
    /** @type {Record<string, unknown>} */
    const flags = { ...(listOpts || {}) };
    if (variety) flags.variety = variety;
    return call({ subcommand: "list", flags, json: true });
  }

  async function search(query, searchOpts) {
    if (!query || typeof query !== "string") {
      return { ok: false, exitCode: 1, output: "search query required", parsed: null };
    }
    return call({ subcommand: "search", positional: [query], flags: { ...(searchOpts || {}) }, json: true });
  }

  async function show(id, showOpts) {
    if (!id || typeof id !== "string") {
      return { ok: false, exitCode: 1, output: "fruit id required", parsed: null };
    }
    return call({ subcommand: "show", positional: [id], flags: { ...(showOpts || {}) }, json: true });
  }

  async function bushelList() {
    return call({ subcommand: "bushel", positional: ["list"], json: true });
  }

  async function bushelAdd(id) {
    if (!id) return { ok: false, exitCode: 1, output: "fruit id required", parsed: null };
    return call({ subcommand: "bushel", positional: ["add", id], json: true });
  }

  async function bushelRemove(id) {
    if (!id) return { ok: false, exitCode: 1, output: "fruit id required", parsed: null };
    return call({ subcommand: "bushel", positional: ["remove", id], json: true });
  }

  return { call, list, search, show, bushelList, bushelAdd, bushelRemove };
}

module.exports = {
  // Pure helpers
  buildArgv,
  buildOutputSink,
  tryParseJson,
  // Factory
  buildOrchardClient,
  // Constants
  DEFAULT_FROOTAI_DIR,
  ALLOWED_SUBCOMMANDS,
  RESERVED_VSCODE_FLAGS,
  OUTPUT_BUFFER_MAX_LINES,
  // Re-export for consumers
  SUBCOMMAND_NAMES,
};
