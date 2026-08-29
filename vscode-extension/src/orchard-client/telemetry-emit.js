// @ts-check
/**
 * A5.24 — VSCode extension telemetry emit.
 *
 * Thin wrapper around `cli/lib/telemetry/emitter.js` so events from the
 * extension surface (e.g. "user clicked Install in tree view") land in the
 * SAME server-side event stream as `frootai orchard install` from terminal.
 *
 * Doctrine:
 *   - SAME anon-id (~/.frootai/anon-id) — extension never generates its own.
 *   - SAME opt-in setting (~/.frootai/config.json telemetry_opt_in) — toggling
 *     via `frootai telemetry on|off` in terminal affects extension immediately.
 *   - SAME EVENT_ENUM (validated by emitter — invalid event → no-op).
 *   - Surface marker — extension emissions prefix `cmd` prop with `vscode:`
 *     so backend aggregations can split surfaces without adding new fields
 *     to the schema (which would require an A5.13 EVENT_SHAPE_VERSION bump).
 *   - NEVER throws. Telemetry NEVER blocks or fails a command.
 *
 * Wire-up sites in orchard-real.ts:
 *   - install command           → subcommand_invoked + install_succeeded (or error_code)
 *   - installWithPlay command   → subcommand_invoked + upgrade_to_play_attempted
 *   - diffWithPlay command      → subcommand_invoked + (when apply: upgrade_to_play_attempted)
 *   - addToBushel command       → subcommand_invoked
 *   - show command              → subcommand_invoked
 *   - browse command            → subcommand_invoked (with cmd: vscode:browse)
 */
"use strict";

const path = require("node:path");
const os = require("node:os");

const {
  emitEvent,
  EVENT_ENUM,
  ALLOWED_PROP_KEYS,
} = require("../../../cli/lib/telemetry/emitter");
const {
  readOrCreateAnonId,
  DEFAULT_ANON_ID_PATH,
} = require("../../../cli/lib/telemetry/anon-id");
const {
  readConfigFile,
  DEFAULT_CONFIG_PATH,
} = require("../../../cli/lib/auth/config-store");

const VSCODE_CMD_PREFIX = "vscode:";
const VSCODE_CMD_MAX_LEN = 40;

const SUPPORTED_VSCODE_CMDS = Object.freeze([
  "browse",
  "signIn",
  "install",
  "installWithPlay",
  "diffWithPlay",
  "diff",
  "diffApply",
  "addToBushel",
  "show",
  "treeRefresh",
  "syncPull",
  "syncPush",
]);

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Pure: format the `cmd` prop for an extension-emitted event.
 *
 * @param {string} subcommand
 * @returns {string}
 */
function formatVscodeCmd(subcommand) {
  if (typeof subcommand !== "string" || subcommand.length === 0) return `${VSCODE_CMD_PREFIX}unknown`;
  // Defense-in-depth: cap length + strip whitespace
  const safe = subcommand.replace(/\s+/g, "").slice(0, VSCODE_CMD_MAX_LEN);
  return `${VSCODE_CMD_PREFIX}${safe}`;
}

/**
 * Pure: build the canonical props object for an extension-emitted event.
 * Anything not in ALLOWED_PROP_KEYS gets dropped server-side anyway (A5.2
 * scrubServerProps), but we pre-scrub here so the network round-trip is
 * minimal + the local telemetry log shows the actual payload.
 *
 * @param {string} vscodeSubcommand
 * @param {object} [extra]
 * @returns {Record<string, string>}
 */
function buildVscodeProps(vscodeSubcommand, extra) {
  /** @type {Record<string, string>} */
  const props = {};
  if (extra && typeof extra === "object") {
    for (const [k, v] of Object.entries(extra)) {
      if (!ALLOWED_PROP_KEYS.has(k)) continue;
      if (v === undefined || v === null) continue;
      const s = String(v);
      if (s.length === 0) continue;
      props[k] = s;
    }
  }
  // Force cmd AFTER the extras loop so caller can't override it with their own
  // (which would let a buggy caller emit raw command strings without the vscode: prefix).
  props.cmd = formatVscodeCmd(vscodeSubcommand);
  return props;
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

/**
 * Emit a telemetry event from the VSCode extension. Fire-and-forget — NEVER
 * throws and NEVER blocks a command.
 *
 * @param {string} eventName  must be in EVENT_ENUM
 * @param {string} vscodeSubcommand  e.g. "install", "browse"
 * @param {object} [extra]            additional whitelisted props
 * @param {object} [deps]
 * @param {string} [deps.frootaiDir]
 * @param {string} [deps.endpoint]
 * @param {Function} [deps.fetchImpl]
 * @param {Function} [deps.emitImpl]        override emitEvent (tests)
 * @param {Function} [deps.readConfig]      override config reader (tests)
 * @param {Function} [deps.readOrCreateAnonId]  override anon-id reader (tests)
 * @returns {Promise<{sent: boolean, decision?: string, surface: string, props: Record<string, string>}>}
 */
async function emitVscodeEvent(eventName, vscodeSubcommand, extra, deps) {
  const d = deps || {};
  const surface = formatVscodeCmd(vscodeSubcommand);
  const props = buildVscodeProps(vscodeSubcommand, extra);

  try {
    // Validate event up front; invalid → no-op (matches CLI A4.27 behavior).
    if (!EVENT_ENUM.includes(eventName)) {
      return { sent: false, decision: "invalid_event", surface, props };
    }

    const _emitImpl = d.emitImpl || emitEvent;
    const _readConfig = d.readConfig || readConfigFile;
    const _readAnonId = d.readOrCreateAnonId || readOrCreateAnonId;
    const frootaiDir = d.frootaiDir || path.join(os.homedir(), ".frootai");

    const result = await _emitImpl(eventName, props, {
      endpoint: d.endpoint,
      fetchImpl: d.fetchImpl,
      configPath: d.configPath || path.join(frootaiDir, "config.json"),
      anonIdPath: d.anonIdPath || path.join(frootaiDir, "anon-id"),
      readConfigFile: _readConfig,
      readOrCreateAnonId: _readAnonId,
    });
    return {
      sent: !!(result && result.sent),
      decision: result && result.decision,
      surface,
      props,
    };
  } catch {
    // Telemetry must NEVER throw — last-resort catch.
    return { sent: false, decision: "internal_error", surface, props };
  }
}

module.exports = {
  emitVscodeEvent,
  formatVscodeCmd,
  buildVscodeProps,
  VSCODE_CMD_PREFIX,
  VSCODE_CMD_MAX_LEN,
  SUPPORTED_VSCODE_CMDS,
  // Re-exports for callers
  EVENT_ENUM,
  ALLOWED_PROP_KEYS,
  DEFAULT_ANON_ID_PATH,
  DEFAULT_CONFIG_PATH,
};
