// @ts-check
/**
 * A4.28 — Anonymous telemetry emitter.
 *
 * Doctrine:
 *   - Telemetry is OPT-IN. The user must explicitly run `frootai telemetry on`
 *     (or `frootai login` consent flow in a future iteration). Default is OFF.
 *   - `DO_NOT_TRACK=1` env var overrides everything — never emit even if opted in.
 *     (Industry standard: https://consoledonottrack.com/)
 *   - Telemetry is FIRE-AND-FORGET. The CLI NEVER blocks waiting for the network.
 *     A failure to deliver telemetry is silently ignored. The CLI succeeds.
 *   - Tight timeout (2s) so even slow networks don't drag.
 *   - Bounded payload (4 KiB cap before send) so a buggy caller can't accidentally
 *     spray secrets.
 *
 * Allowed events (frozen enum):
 *   - `subcommand_invoked` (every CLI subcommand run)
 *   - `install_succeeded` (free install completed; not fired in --dry-run)
 *   - `upgrade_to_play_attempted` (paid path attempted; fired on success OR failure)
 *
 * Payload shape (sent to https://frootai.dev/api/telemetry):
 *   {
 *     event: <enum>,
 *     cli_version: "x.y.z",
 *     ts: ISO,
 *     anon_id: UUIDv4 (machine-scoped, NOT user),
 *     platform: process.platform,
 *     node_version: process.version,
 *     props: { ... }   ← enum-only fields, NO PII (see ALLOWED_PROP_KEYS for the whitelist)
 *   }
 *
 * Allow-listed props enforce the no-PII guarantee. Any prop key NOT in the
 * whitelist is silently dropped before send. Values are coerced to string and
 * capped at 64 chars (further defense against accidental PII leakage).
 *
 * Privacy floor: the emitter NEVER sees user tokens, email, subject, target_dir,
 * repo_url, fruit_id, play recipe content. Callers shape the payload — but this
 * module is the last line of defense.
 */
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { OrchardCliError } = require("../orchard/cli-error");
const { readConfigFile } = require("../auth/config-store");
const { readOrCreateAnonId } = require("./anon-id");

const DEFAULT_TELEMETRY_ENDPOINT = "https://frootai.dev/api/telemetry";
const DEFAULT_TIMEOUT_MS = 2_000;
const PAYLOAD_MAX_BYTES = 4 * 1024;
const PROP_VALUE_MAX_LEN = 64;

const EVENT_ENUM = Object.freeze([
  "subcommand_invoked",
  "install_succeeded",
  "upgrade_to_play_attempted",
  // A7.27 — MCP tool invocation event. Emitted by @frootai/mcp-orchard +
  // frootai-mcp-orchard server-side after every `tools/call` dispatch.
  // Carries `cmd: "mcp.<tool>"` + `client: cursor|claude|chatgpt|continue|cline|other`.
  "tool_invoked",
]);

/**
 * Allow-listed prop keys. Any key NOT in this set is silently dropped.
 * This is the no-PII guarantee enforcement layer.
 *
 * Allowed values (coerced to string + capped at 64 chars):
 *   - cmd          : subcommand name (e.g. "list", "install", "diff")
 *   - variety      : one of azure|gcp|aws|oss|hybrid
 *   - paid         : "true" | "false"
 *   - dry_run      : "true" | "false"
 *   - success      : "true" | "false"
 *   - exit_code    : "0" | "1" | "2"
 *   - has_json     : "true" | "false"
 *   - tier_class   : "free" | "paid"  (no fine-grained tier)
 *   - hooks_count  : integer string (e.g. "3")
 *   - error_code   : OrchardCliError code (e.g. "not_signed_in", enum from cli-error)
 *   - ms_elapsed   : integer ms (string)
 */
const ALLOWED_PROP_KEYS = Object.freeze(new Set([
  "cmd",
  "variety",
  "paid",
  "dry_run",
  "success",
  "exit_code",
  "has_json",
  "tier_class",
  "hooks_count",
  "error_code",
  "ms_elapsed",
  // A7.27 — MCP tool_invoked event props (still enum-only, no PII):
  // - client     : cursor|claude|chatgpt|continue|cline|other (detected from MCP clientInfo.name)
  // - has_args   : "true"|"false" (boolean indicator only — NEVER the arg VALUES)
  "client",
  "has_args",
]));

const _CLI_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"));
    return pkg.version || "0.0.0";
  } catch { return "0.0.0"; }
})();

/** Pure: scrub a props object to keep only allow-listed keys. */
function scrubProps(props) {
  if (!props || typeof props !== "object" || Array.isArray(props)) return {};
  const out = {};
  for (const [key, val] of Object.entries(props)) {
    if (!ALLOWED_PROP_KEYS.has(key)) continue;
    if (val === null || val === undefined) continue;
    const str = String(val);
    if (str.length === 0) continue;
    out[key] = str.length > PROP_VALUE_MAX_LEN ? str.slice(0, PROP_VALUE_MAX_LEN) : str;
  }
  return out;
}

/** Pure: build the canonical payload object. */
function buildPayload(event, props, ctx) {
  if (!EVENT_ENUM.includes(event)) {
    throw new OrchardCliError("invalid_input",
      `unknown telemetry event "${event}"; allowed: ${EVENT_ENUM.join(", ")}`,
      { event });
  }
  const c = ctx || {};
  return {
    event,
    cli_version: c.cli_version || _CLI_VERSION,
    ts: c.ts || new Date().toISOString(),
    anon_id: c.anon_id,
    platform: c.platform || process.platform,
    node_version: c.node_version || process.version,
    props: scrubProps(props),
  };
}

/**
 * Decide whether to emit. Returns one of:
 *   - "ok"             — proceed (opted in + DNT not set + anon_id available)
 *   - "do_not_track"   — DNT=1, override skips
 *   - "opted_out"      — config.telemetry_opt_in is false (default)
 *   - "no_anon_id"     — couldn't read/write anon-id file (disk failure)
 *   - "anonymous_mode" — config.anonymous_mode is true AND not explicitly opted in
 *
 * Caller treats anything other than "ok" as a silent no-op.
 */
async function decideEmit(deps) {
  const d = deps || {};
  if (d.dntOverride === true || process.env.DO_NOT_TRACK === "1") return { decision: "do_not_track" };
  let config;
  try {
    config = await (d.readConfig || readConfigFile)({ configPath: d.configPath });
  } catch { return { decision: "opted_out" }; }
  if (!config || config.telemetry_opt_in !== true) return { decision: "opted_out" };
  const anonId = await (d.readOrCreateAnonId || readOrCreateAnonId)({ anonIdPath: d.anonIdPath });
  if (!anonId) return { decision: "no_anon_id" };
  return { decision: "ok", anon_id: anonId, config };
}

/**
 * Emit one telemetry event. NEVER throws.
 *
 * @param {string} event   one of EVENT_ENUM
 * @param {object} [props] allow-listed props (others silently dropped)
 * @param {object} [deps]
 * @param {string} [deps.endpoint]
 * @param {number} [deps.timeoutMs]
 * @param {typeof fetch} [deps.fetchImpl]
 * @param {string} [deps.configPath]
 * @param {string} [deps.anonIdPath]
 * @param {Function} [deps.readConfig]
 * @param {Function} [deps.readOrCreateAnonId]
 * @param {boolean} [deps.dntOverride]
 * @returns {Promise<{sent: boolean, decision: string, status?: number, error?: string}>}
 */
async function emitEvent(event, props, deps) {
  const d = deps || {};
  try {
    if (!EVENT_ENUM.includes(event)) {
      // Don't throw — callers run this fire-and-forget.
      return { sent: false, decision: "invalid_event" };
    }

    const decision = await decideEmit(d);
    if (decision.decision !== "ok") {
      return { sent: false, decision: decision.decision };
    }

    const payload = buildPayload(event, props, {
      anon_id: decision.anon_id,
      ts: d.nowIso,
      cli_version: d.cliVersion,
    });
    const body = JSON.stringify(payload);
    if (Buffer.byteLength(body, "utf8") > PAYLOAD_MAX_BYTES) {
      // Defensive cap — caller bug. Don't send oversized telemetry.
      return { sent: false, decision: "payload_too_large" };
    }

    const endpoint = d.endpoint || DEFAULT_TELEMETRY_ENDPOINT;
    const timeoutMs = d.timeoutMs || DEFAULT_TIMEOUT_MS;
    const fetchImpl = d.fetchImpl || fetch;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": `frootai-cli/${payload.cli_version}`,
        },
        body,
      });
      clearTimeout(timer);
      return { sent: true, decision: "ok", status: response.status };
    } catch (err) {
      clearTimeout(timer);
      return { sent: false, decision: "network_error", error: err instanceof Error ? err.message : String(err) };
    }
  } catch (err) {
    // Last-resort safety net — telemetry must NEVER break the CLI.
    return { sent: false, decision: "unexpected_error", error: err instanceof Error ? err.message : String(err) };
  }
}

module.exports = {
  DEFAULT_TELEMETRY_ENDPOINT,
  DEFAULT_TIMEOUT_MS,
  PAYLOAD_MAX_BYTES,
  PROP_VALUE_MAX_LEN,
  EVENT_ENUM,
  ALLOWED_PROP_KEYS,
  scrubProps,
  buildPayload,
  decideEmit,
  emitEvent,
};
