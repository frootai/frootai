// @ts-check
/**
 * FAI MCP CLI — `--verbose` flag reporter (M4.25 ship).
 *
 * Default-off telemetry surface: when the operator passes `--verbose`,
 * the CLI emits structured single-line JSON events to stderr (NEVER
 * stdout — that channel stays pipeable for `--json` consumers) plus
 * forwards the kernel subprocess's stderr lines verbatim with a
 * `[fai-mcp:kernel.stderr]` prefix so spawn errors / federated server
 * logs are inspectable without hand-attaching a debugger.
 *
 * Doctrine #4 stays intact: zero output change when `--verbose` is off
 * — the disabled reporter's `event()` / `kernelStderr()` are pure
 * no-ops, so per-command callers can sprinkle `deps.reporter.event(...)`
 * unconditionally without performance or visual cost.
 *
 * Event envelope shape (one JSON object per stderr line):
 *   {
 *     "ts":       "<iso-8601>",         // event timestamp
 *     "level":    "verbose",            // reserved for future levels
 *     "sub":      "<frootai-mcp-sub>",  // subcommand currently dispatched
 *     "event":    "<canonical-name>",   // e.g. "dispatch.start"
 *     "data":     { ... }               // optional structured payload
 *   }
 *
 * Canonical event names (extensible — additions append):
 *   dispatch.start   { argv }
 *   dispatch.end     { exitCode, durationMs }
 *   <sub>.result     { payload }                        // generic per-command commit
 *   <sub>.refused    { code, message }                  // user-error path
 *   kernel.spawn     { command, args }
 *   kernel.rpc.send  { method, latencyMs? }
 *   kernel.rpc.recv  { method, latencyMs }
 *   kernel.dispose   {}
 *   kernel.stderr    { line }                           // forwarded subprocess stderr
 *
 * Tests inject `deps.err` to capture the stderr stream byte-for-byte
 * without touching the real `process.stderr`.
 */
"use strict";

/**
 * @typedef {object} VerboseReporter
 * @property {boolean} enabled
 * @property {string|null} sub
 * @property {(name: string, data?: object) => void} event
 * @property {(line: string) => void} kernelStderr
 * @property {(sub: string) => VerboseReporter} forSub
 */

/**
 * No-op reporter used when `--verbose` is off. Frozen so callers can
 * cache it. All methods are pure-function no-ops.
 *
 * @type {VerboseReporter}
 */
const NOOP_REPORTER = Object.freeze({
  enabled: false,
  sub: null,
  event: () => {},
  kernelStderr: () => {},
  forSub: () => NOOP_REPORTER,
});

/**
 * Render an event line. Pure (deterministic for a given clock value).
 * Exposed for unit tests that want to validate the wire shape without
 * driving a full reporter.
 *
 * @param {{ sub: string|null, name: string, data?: object, nowIso: string }} args
 * @returns {string}
 */
function renderEventLine(args) {
  const envelope = {
    ts: args.nowIso,
    level: "verbose",
    sub: args.sub || null,
    event: args.name,
  };
  if (args.data !== undefined) envelope.data = args.data;
  return `[fai-mcp] ${JSON.stringify(envelope)}`;
}

/**
 * Render a kernel-stderr forwarded line. Pure.
 *
 * @param {string} line
 * @returns {string}
 */
function renderKernelStderr(line) {
  return `[fai-mcp:kernel.stderr] ${line}`;
}

/**
 * Build a verbose reporter. When `enabled` is false, returns the frozen
 * no-op singleton so callers can rely on a stable identity.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.enabled]   gate (typically `args.verbose`)
 * @param {string} [opts.sub]        subcommand bound to this reporter
 * @param {(s: string) => void} [opts.err]  stderr writer; defaults to process.stderr
 * @param {() => Date} [opts.now]    deterministic clock for tests
 * @returns {VerboseReporter}
 */
function createVerboseReporter(opts) {
  const o = opts || {};
  if (!o.enabled) return NOOP_REPORTER;
  const err = typeof o.err === "function"
    ? o.err
    : (s) => { try { process.stderr.write(s + "\n"); } catch { /* noop */ } };
  const now = typeof o.now === "function" ? o.now : () => new Date();
  const sub = typeof o.sub === "string" && o.sub.length > 0 ? o.sub : null;
  /** @type {VerboseReporter} */
  const reporter = {
    enabled: true,
    sub,
    event(name, data) {
      if (typeof name !== "string" || !name) return;
      const line = renderEventLine({
        sub,
        name,
        data: data && typeof data === "object" ? data : undefined,
        nowIso: now().toISOString(),
      });
      err(line);
    },
    kernelStderr(line) {
      if (typeof line !== "string" || !line) return;
      // Subprocess stderr can be multi-line in a single chunk; split so
      // every kernel line gets its own forwarded line for grep-ability.
      for (const part of line.split(/\r?\n/)) {
        const trimmed = part.replace(/[\r\n]+$/, "");
        if (!trimmed) continue;
        err(renderKernelStderr(trimmed));
      }
    },
    forSub(nextSub) {
      return createVerboseReporter({
        enabled: true,
        sub: nextSub,
        err,
        now,
      });
    },
  };
  return reporter;
}

module.exports = {
  NOOP_REPORTER,
  createVerboseReporter,
  renderEventLine,
  renderKernelStderr,
};
