// @ts-check
/**
 * M5.24 — Federation command telemetry (pure core).
 *
 * Row literal: every command invocation emits to existing extension
 * telemetry sink with `(command, durationMs, error?)`.
 *
 * Pure: zero `vscode` imports + zero IO. Provides the wrapping
 * primitive `withFederationTelemetry(fullCmd, handler, emit)` that
 * times the handler's invocation + extracts the error (if any) +
 * emits via the injected `emit` function. The .ts wrapper supplies
 * the real emit (= `emitVscodeEvent` from
 * `vscode-extension/src/orchard-client/telemetry-emit.js` — the
 * EXISTING extension telemetry sink the row literal mandates).
 *
 * Decisions:
 *   - Event name pinned to `"subcommand_invoked"` (already in
 *     `cli/lib/telemetry/emitter.js#EVENT_ENUM`). NEVER add a new
 *     event — the row literal says "existing telemetry sink", and
 *     introducing a new event would skew downstream dashboards that
 *     read the EVENT_ENUM rows. Gate case 11 cross-row asserts the
 *     event is in the existing enum.
 *   - Props pinned to the existing `ALLOWED_PROP_KEYS` whitelist:
 *       cmd        → stripFederationCommand(fullCmd)  (e.g. "federation.attach")
 *       ms_elapsed → durationMs (integer string)
 *       success    → "true" | "false"
 *       error_code → optional, only when error present
 *     Any new prop key would be silently dropped by `scrubProps` in
 *     emitter.js — gate case 12 cross-row asserts each key is in
 *     ALLOWED_PROP_KEYS.
 *   - Telemetry NEVER blocks the command. `withFederationTelemetry`
 *     returns the handler's result (or re-throws the handler's
 *     error) BEFORE emitting; the emit is fire-and-forget and
 *     wrapped in try/catch so a telemetry sink failure can't fail
 *     a command. Gate case 8 exercises this with a throwing emitter.
 *   - The wrapped handler preserves the original async signature
 *     (variadic args + Promise return) so VS Code's command host
 *     can't tell the difference between wrapped + unwrapped.
 *   - When the handler throws, `error_code` is extracted via:
 *       1. err.code (if string)
 *       2. McpFederationError-style code (M5.4 taxonomy)
 *       3. fallback "unknown_error"
 *     Gate cases 6 + 7 cover both shapes.
 */
"use strict";

/** Event name pinned to existing EVENT_ENUM entry. */
const FEDERATION_TELEMETRY_EVENT = "subcommand_invoked";

/** Prefix that gets stripped to keep the `cmd` prop concise. */
const COMMAND_PREFIX = "frootai.";

/** Cap matches `cli/lib/telemetry/emitter.js#scrubProps` value max (64). */
const PROP_VALUE_MAX_LEN = 64;

/**
 * @typedef {object} TelemetryPropsInput
 * @property {string} command         Full command literal e.g. "frootai.federation.attach"
 * @property {number} durationMs      Elapsed milliseconds
 * @property {Error | { code?: string, message?: string } | null} [error]  Optional error
 *
 * @typedef {object} TelemetryProps
 * @property {string} cmd
 * @property {string} ms_elapsed
 * @property {string} success
 * @property {string} [error_code]
 */

/**
 * Pure: strip the `frootai.` prefix from the full command literal +
 * cap to PROP_VALUE_MAX_LEN. Result is shaped for the existing
 * telemetry `cmd` prop (e.g. "frootai.federation.attach" →
 * "federation.attach").
 *
 * @param {string} fullCmd
 * @returns {string}
 */
function stripFederationCommand(fullCmd) {
  if (typeof fullCmd !== "string" || fullCmd.length === 0) return "unknown";
  const stripped = fullCmd.startsWith(COMMAND_PREFIX) ? fullCmd.slice(COMMAND_PREFIX.length) : fullCmd;
  return stripped.slice(0, PROP_VALUE_MAX_LEN);
}

/**
 * Pure: extract the error code from a thrown value. Order:
 *   1. err.code (string) — McpFederationError taxonomy + Node errors
 *   2. err.name (string) — e.g. "TypeError"
 *   3. "unknown_error" fallback
 *
 * @param {unknown} err
 * @returns {string}
 */
function _extractErrorCode(err) {
  if (!err || typeof err !== "object") return "unknown_error";
  const e = /** @type {{ code?: unknown, name?: unknown }} */ (err);
  if (typeof e.code === "string" && e.code.length > 0) {
    return e.code.slice(0, PROP_VALUE_MAX_LEN);
  }
  if (typeof e.name === "string" && e.name.length > 0 && e.name !== "Error") {
    return e.name.slice(0, PROP_VALUE_MAX_LEN);
  }
  return "unknown_error";
}

/**
 * Pure: build the telemetry props record. Only whitelisted keys (cmd,
 * ms_elapsed, success, error_code). Values are strings + capped to
 * PROP_VALUE_MAX_LEN per emitter.js scrubProps contract.
 *
 * @param {TelemetryPropsInput} input
 * @returns {Readonly<TelemetryProps>}
 */
function buildFederationTelemetryProps(input) {
  const cmd = stripFederationCommand(input && input.command);
  const ms = (input && Number.isFinite(input.durationMs) && input.durationMs >= 0)
    ? Math.round(input.durationMs)
    : 0;
  /** @type {TelemetryProps} */
  const props = {
    cmd,
    ms_elapsed: String(ms),
    success: input && input.error ? "false" : "true",
  };
  if (input && input.error) {
    props.error_code = _extractErrorCode(input.error);
  }
  return Object.freeze(props);
}

/**
 * Pure: wrap an async command handler so each invocation times itself
 * + emits a `(command, durationMs, error?)` telemetry event via the
 * injected `emit` function.
 *
 *   const wrapped = withFederationTelemetry("frootai.federation.attach",
 *                                            innerHandler, emitImpl);
 *   vscode.commands.registerCommand("frootai.federation.attach", wrapped);
 *
 * Telemetry NEVER blocks or fails the command:
 *   - The handler's result is returned BEFORE emit fires.
 *   - The handler's error is re-thrown AFTER emit fires.
 *   - The emit call is wrapped in try/catch so a sink failure can't
 *     fail a command.
 *
 * @template {(...args: any[]) => Promise<any>} F
 * @param {string} fullCmd
 * @param {F} handler
 * @param {(eventName: string, subcommand: string, extra: TelemetryProps) => void | Promise<void>} emit
 * @param {() => number} [nowMs]   Injectable clock for gate determinism
 * @returns {F}
 */
function withFederationTelemetry(fullCmd, handler, emit, nowMs) {
  if (typeof handler !== "function") {
    throw new TypeError("withFederationTelemetry: handler must be a function");
  }
  if (typeof emit !== "function") {
    throw new TypeError("withFederationTelemetry: emit must be a function");
  }
  const clock = typeof nowMs === "function" ? nowMs : () => Date.now();
  /** @type {any} */
  const wrapped = async function (...args) {
    const start = clock();
    let caught = null;
    try {
      return await handler.apply(this, args);
    } catch (err) {
      caught = err;
      throw err;
    } finally {
      const durationMs = clock() - start;
      const props = buildFederationTelemetryProps({
        command: fullCmd,
        durationMs,
        error: caught,
      });
      try {
        // Use the stripped command as the `vscodeSubcommand` arg the
        // existing emitVscodeEvent contract expects (it prefixes with
        // `vscode:` + caps at 40 chars — we feed the already-stripped
        // form so the resulting `cmd` prop reads cleanly).
        const r = emit(FEDERATION_TELEMETRY_EVENT, props.cmd, props);
        if (r && typeof r.then === "function") {
          r.catch(() => { /* fire-and-forget */ });
        }
      } catch {
        // Telemetry sink failure MUST NOT fail the command.
      }
    }
  };
  return wrapped;
}

module.exports = {
  FEDERATION_TELEMETRY_EVENT,
  COMMAND_PREFIX,
  PROP_VALUE_MAX_LEN,
  stripFederationCommand,
  buildFederationTelemetryProps,
  withFederationTelemetry,
  _extractErrorCode,
};
