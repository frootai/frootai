// @ts-check
/**
 * FAI MCP Federation CLI dispatcher — routes `frootai mcp <subcommand>` to
 * per-command modules.
 *
 * M4.1 (THIS ship): dispatcher skeleton + 8 sub-command slots wired with
 * `not_yet_implemented` stubs. Help / unknown-subcommand / shared error
 * handling are FULLY functional. Per-command implementations land at
 * M4.3-M4.14 and replace the inline stub with a real `exec*` import.
 *
 * Subcommands (8):
 *   list      — M4.3
 *   discover  — M4.4
 *   attach    — M4.5
 *   detach    — M4.6
 *   trust     — M4.7-M4.9 (`list` / `set` / `unset` sub-actions)
 *   test      — M4.10-M4.11 (`<name>` / `--all`)
 *   invoke    — M4.12-M4.13 (`<area.tool>` / `--persist`)
 *   publish   — M4.14
 *   help      — usage (handled inline here)
 *
 * Exit codes (final shape locks at M4.21):
 *   0  success
 *   1  validation / not-found / config error (McpCliError default)
 *   2  unexpected error (uncaught)
 *
 * Dispatcher contract (mirrors orchard/dispatch.js for reviewer parity):
 *   - Returns `{ exitCode, output }` so bin.js can set process.exitCode
 *     and write to the right stream. Tests call `dispatch()` directly with
 *     injected `deps.log` / `deps.err` to avoid touching stdout/stderr.
 *   - NEVER throws — every error path resolves to a `{ exitCode, output }`
 *     pair. McpCliError → exit 1; any other thrown error → exit 2.
 */
"use strict";

const { parseArgs } = require("../orchard/arg-parser");
const { color, status } = require("../orchard/output");
const { McpCliError } = require("./cli-error");
const { generateCompletion, SUPPORTED_SHELLS } = require("./completion");
const { mapErrorToExitCode, formatErrorReport, EXIT_CODES } = require("./exit-codes");
const { createVerboseReporter, NOOP_REPORTER } = require("./verbose-reporter");
const { createNetworkPolicy, NOOP_POLICY } = require("./network-policy");
const { execList } = require("./commands/list");
const { execDiscover } = require("./commands/discover");
const { execAttach } = require("./commands/attach");
const { execDetach } = require("./commands/detach");
const { execTrust } = require("./commands/trust");
const { execTest } = require("./commands/test");
const { execInvoke } = require("./commands/invoke");
const { execPublish } = require("./commands/publish");

/**
 * Inline placeholder exec — used while a sub-command's real impl is still
 * pinned for a later M4 row. Throws `McpCliError("not_yet_implemented")`
 * so the dispatcher's catch maps it to exit 1 with the same shape the
 * real impl will use once it lands.
 *
 * @param {string} cmd
 * @param {string} pinRow
 * @returns {(args: object, deps?: object) => Promise<never>}
 */
function _notYetImplemented(cmd, pinRow) {
  return async () => {
    throw new McpCliError(
      "not_yet_implemented",
      `frootai mcp ${cmd}: implementation pending (${pinRow})`,
      { hint: `Tracked in masterplan ${pinRow} — dispatcher is wired at M4.1, command lands later.` },
    );
  };
}

const COMMANDS = Object.freeze({
  list: {
    exec: execList,
    summary: "List currently attached federated areas (table or --json)",
  },
  discover: {
    exec: execDiscover,
    summary: "Search the MCP marketplace catalog by query / tier",
  },
  attach: {
    exec: execAttach,
    summary: "Add an area to the pre-attach roster (trust-gated)",
  },
  detach: {
    exec: execDetach,
    summary: "Remove an area from the pre-attach roster",
  },
  trust: {
    exec: execTrust,
    summary: "Inspect / set / unset publisher trust overrides",
  },
  test: {
    exec: execTest,
    summary: "Probe attach + list-tools latency for an area (or --all)",
  },
  invoke: {
    exec: execInvoke,
    summary: "One-shot invoke of <area.tool> (use --persist to keep attached)",
  },
  publish: {
    exec: execPublish,
    summary: "Validate + submit a plugin.json providing an MCP server (dry-run in M4)",
  },
});

const SUBCOMMAND_NAMES = Object.freeze(Object.keys(COMMANDS));

function renderHelp(opts) {
  const o = opts || {};
  const lines = [];
  lines.push("");
  lines.push(color("bold", "frootai mcp — FAI MCP Federation CLI", o));
  lines.push("");
  lines.push(color("dim", "  Drive the FrootAI federation kernel from a shell — attach external MCP", o));
  lines.push(color("dim", "  servers, inspect trust posture, invoke federated tools, and publish plugins.", o));
  lines.push("");
  lines.push(color("bold", "Usage:", o));
  lines.push(`  ${color("cyan", "frootai mcp <subcommand> [args...]", o)}`);
  lines.push("");
  lines.push(color("bold", "Subcommands:", o));
  const labelWidth = Math.max(...SUBCOMMAND_NAMES.map((n) => n.length)) + 2;
  for (const name of SUBCOMMAND_NAMES) {
    const summary = COMMANDS[name].summary;
    lines.push(`  ${color("cyan", name.padEnd(labelWidth), o)}${color("dim", summary, o)}`);
  }
  lines.push("");
  lines.push(color("dim", "  State persisted at ~/.frootai/mcp-state.json. Trust overrides at ~/.frootai/trust.json.", o));
  lines.push(color("dim", "  Marketplace cache at ~/.frootai/cache/mcp-marketplace.json (weekly refresh; offline-friendly).", o));
  lines.push(color("dim", "  Pass --verbose to any subcommand for structured stderr telemetry + forwarded kernel logs.", o));
  lines.push(color("dim", "  Pass --no-network to block npx downloads + remote registry fetches (air-gapped envs).", o));
  lines.push("");
  return lines.join("\n");
}

/**
 * Main dispatcher. Returns `{exitCode, output}`; never throws.
 *
 * @param {string[]} argv  argv[0] should be the subcommand (e.g. "list")
 * @param {object} [deps]  injection hooks (log / err / per-command overrides)
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function dispatch(argv, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const err = d.err || ((s) => process.stderr.write(s + "\n"));

  const args = parseArgs(argv);
  const sub = (args._ && args._.shift()) || (args.help || args.h ? "help" : "help");

  // M4.18 fast-path: `--completion <shell>` emits the shell completion
  // script and exits 0. Must run BEFORE help-routing so operators can
  // `eval "$(frootai mcp --completion bash)"` without seeing the help body.
  if (args.completion !== undefined) {
    try {
      const shell = (args.completion === true || args.completion === "")
        ? "bash" : String(args.completion);
      const script = generateCompletion(shell);
      log(script);
      return { exitCode: EXIT_CODES.OK, output: script };
    } catch (e) {
      const msg = formatErrorReport(e);
      err(msg);
      return { exitCode: mapErrorToExitCode(e), output: msg };
    }
  }

  if (sub === "help" || sub === "--help" || sub === "-h" || args.help || args.h) {
    const out = renderHelp({ color: !args["no-color"] });
    log(out);
    return { exitCode: 0, output: out };
  }

  if (!COMMANDS[sub]) {
    const msg = status("error", `Unknown subcommand: "${sub}"`) +
      "\n\n" + renderHelp({ color: !args["no-color"] });
    err(msg);
    return { exitCode: 1, output: msg };
  }

  // Allow tests / future rows to override a specific command's exec via deps.
  const execImpl =
    (d.commands && typeof d.commands[sub] === "function" && d.commands[sub]) ||
    COMMANDS[sub].exec;

  // M4.25: build a verbose reporter from `--verbose`. Default-off makes
  // this a frozen no-op singleton so per-command callers can sprinkle
  // `deps.reporter.event(...)` unconditionally without performance or
  // visual cost. When enabled, structured events + forwarded kernel
  // stderr go to `err` (NEVER `log` — stdout stays pipeable for `--json`).
  const verboseEnabled = Boolean(args.verbose) || Boolean(d.verbose);
  const reporter = (d.reporter && typeof d.reporter === "object")
    ? d.reporter
    : createVerboseReporter({
        enabled: verboseEnabled,
        sub,
        err,
        now: typeof d.now === "function" ? () => new Date(d.now()) : undefined,
      });
  // M4.26: build a no-network policy from `--no-network`. Default-permissive
  // returns the frozen no-op singleton. When enabled, network-touching
  // surfaces (kernel-client npx spawn, marketplace-cache fetch) call
  // `policy.assertAllowed(label, hint)` which throws a structured
  // `network_blocked` error mapped to exit 2 (NETWORK).
  const noNetworkEnabled = Boolean(args["no-network"]) || Boolean(d.noNetwork);
  const networkPolicy = (d.networkPolicy && typeof d.networkPolicy === "object")
    ? d.networkPolicy
    : createNetworkPolicy({ enabled: noNetworkEnabled });
  // M4.27: thread `deps.auth` through to per-command exec impls. The
  // dispatcher does NOT eagerly read the H8.13 credentials store on
  // every dispatch call — per-command code (`discover --refresh`,
  // future `publish --submit`) calls `loadMarketplaceAuth(deps)` lazily
  // only when an authenticated marketplace request is actually needed.
  // When `deps.auth` IS provided (test injection or upstream pre-
  // resolution), we forward it AS-IS and — if verbose is enabled —
  // emit an `auth.loaded` event with `auth.redacted` only (the bearer
  // token is NEVER logged anywhere).
  const auth = (d.auth !== undefined) ? d.auth : null;
  if (auth && verboseEnabled) {
    reporter.event("auth.loaded", { redacted: auth.redacted || null });
  }
  const startMs = (typeof d.now === "function" ? d.now() : Date.now());
  reporter.event("dispatch.start", { argv });

  try {
    const result = await execImpl(args, { ...d, reporter, networkPolicy, auth });
    const finalResult = (result && typeof result === "object" && "exitCode" in result)
      ? result
      : { exitCode: EXIT_CODES.OK, output: "" };
    if (verboseEnabled) {
      // Emit a generic `<sub>.result` envelope. The payload mirrors what
      // the operator would see on stdout in `--json` mode (when present).
      let payload = null;
      if (finalResult.output && typeof finalResult.output === "string") {
        const trimmed = finalResult.output.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try { payload = JSON.parse(trimmed); } catch { /* not JSON */ }
        }
      }
      reporter.event(`${sub}.result`, {
        exitCode: finalResult.exitCode,
        ...(payload !== null ? { payload } : {}),
      });
    }
    const endMs = (typeof d.now === "function" ? d.now() : Date.now());
    reporter.event("dispatch.end", { exitCode: finalResult.exitCode, durationMs: Math.max(0, endMs - startMs) });
    return finalResult;
  } catch (e) {
    const msg = formatErrorReport(e);
    err(msg);
    if (e && !(e instanceof McpCliError) && process.env.DEBUG && e.stack) {
      err(e.stack);
    }
    const exitCode = mapErrorToExitCode(e);
    reporter.event("dispatch.error", {
      code: e && e.code ? e.code : null,
      message: e && e.message ? e.message : String(e),
    });
    const endMs = (typeof d.now === "function" ? d.now() : Date.now());
    reporter.event("dispatch.end", { exitCode, durationMs: Math.max(0, endMs - startMs) });
    return { exitCode, output: msg };
  }
}

module.exports = {
  dispatch,
  renderHelp,
  COMMANDS,
  SUBCOMMAND_NAMES,
  McpCliError,
  NOOP_REPORTER,
  NOOP_POLICY,
};
