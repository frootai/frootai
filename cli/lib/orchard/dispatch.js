// @ts-check
/**
 * FAI Orchard CLI dispatcher — routes `frootai orchard <subcommand>` to per-command modules.
 *
 * Subcommands (8):
 *   list      — A4.1
 *   search    — A4.2
 *   show      — A4.3
 *   install   — A4.4 (+ A4.5 via --upgrade-to-play)
 *   diff      — A4.6
 *   pollinate — A4.7
 *   bushel    — A4.8
 *   help      — usage
 *
 * Exit codes:
 *   0  success
 *   1  validation / not-found / config error (OrchardCliError)
 *   2  unexpected error
 */
"use strict";

const { parseArgs } = require("./arg-parser");
const { OrchardCliError } = require("./cli-error");
const { color, status } = require("./output");
const { execList } = require("./commands/list");
const { execSearch } = require("./commands/search");
const { execShow } = require("./commands/show");
const { execInstall } = require("./commands/install");
const { execDiff } = require("./commands/diff");
const { execPollinate } = require("./commands/pollinate");
const { execBushel } = require("./commands/bushel");
const { emitEvent } = require("../telemetry/emitter");

const COMMANDS = Object.freeze({
  list: { exec: execList,
    summary: "Browse accelerators (with --variety, --ripeness, --category, --limit filters)" },
  search: { exec: execSearch,
    summary: "Fuzzy search across name/tagline/tech/category" },
  show: { exec: execShow,
    summary: "Pretty-print full manifest for a slug or id" },
  install: { exec: execInstall,
    summary: "Plan + scaffold a free install (use --upgrade-to-play <id> for paid Play layer)" },
  diff: { exec: execDiff,
    summary: "Preview the diff between a free install + a paid Play layer" },
  pollinate: { exec: execPollinate,
    summary: "Produce a community PR pollinations.json edge for a fruit ↔ play pairing" },
  bushel: { exec: execBushel,
    summary: "Manage saved accelerators at ~/.frootai/bushels.json (add | remove | list | clear)" },
});

const SUBCOMMAND_NAMES = Object.freeze(Object.keys(COMMANDS));

function renderHelp(opts) {
  const o = opts || {};
  const lines = [];
  lines.push("");
  lines.push(color("bold", "frootai orchard — FAI Orchard CLI", o));
  lines.push("");
  lines.push(color("dim", "  Browse, install, and contribute to the cross-cloud Solution Accelerator catalog.", o));
  lines.push("");
  lines.push(color("bold", "Usage:", o));
  lines.push(`  ${color("cyan", "frootai orchard <subcommand> [args...]", o)}`);
  lines.push("");
  lines.push(color("bold", "Subcommands:", o));
  const labelWidth = Math.max(...SUBCOMMAND_NAMES.map((n) => n.length)) + 2;
  for (const name of SUBCOMMAND_NAMES) {
    const summary = COMMANDS[name].summary;
    lines.push(`  ${color("cyan", name.padEnd(labelWidth), o)}${color("dim", summary, o)}`);
  }
  lines.push("");
  lines.push(color("dim", "  Free invocations work without sign-in. --upgrade-to-play requires Pro at https://frootai.dev/upgrade", o));
  lines.push(color("dim", "  CDN cache at ~/.frootai/cache/orchard/ (1-hour TTL). Bushels at ~/.frootai/bushels.json.", o));
  lines.push("");
  return lines.join("\n");
}

/**
 * Main dispatcher. Returns `{exitCode, output}` so the bin.js wrapper can
 * write to stdout/stderr + set exit code. Tests call this directly with
 * injected `deps` to avoid network + IO.
 *
 * @param {string[]} argv  argv[0] should be the subcommand (e.g. "list")
 * @param {object} [deps]  injection hooks for tests
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function dispatch(argv, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const err = d.err || ((s) => process.stderr.write(s + "\n"));

  const args = parseArgs(argv);
  const sub = (args._ && args._.shift()) || (args.help || args.h ? "help" : "help");

  if (sub === "help" || sub === "--help" || sub === "-h" || args.help || args.h) {
    const out = renderHelp({ color: !args["no-color"] });
    log(out);
    return { exitCode: 0, output: out };
  }

  if (!COMMANDS[sub]) {
    const msg = status("error", `Unknown subcommand: "${sub}"`) + "\n\n" + renderHelp({ color: !args["no-color"] });
    err(msg);
    return { exitCode: 1, output: msg };
  }

  const startedAt = Date.now();
  // A4.27/A4.28 telemetry — fire-and-forget after every command. Injectable
  // `emitEvent` for tests so we don't accidentally hit the network in regression.
  // `disableTelemetry: true` in deps suppresses entirely (used by self-tests).
  const emitImpl = d.emitEvent || emitEvent;
  const _fireTelemetry = async (success, exitCode, errorCode) => {
    if (d.disableTelemetry === true) return;
    try {
      await emitImpl("subcommand_invoked", {
        cmd: sub,
        success: success ? "true" : "false",
        exit_code: String(exitCode),
        has_json: args.json ? "true" : "false",
        dry_run: args["dry-run"] ? "true" : "false",
        ms_elapsed: String(Date.now() - startedAt),
        ...(args.variety && args.variety !== true ? { variety: String(args.variety) } : {}),
        ...(errorCode ? { error_code: errorCode } : {}),
      }, d.telemetryDeps || {});
    } catch { /* fire-and-forget — telemetry NEVER breaks the CLI */ }
  };

  try {
    const result = await COMMANDS[sub].exec(args, d);
    void _fireTelemetry(result.exitCode === 0, result.exitCode || 0, null);
    return result;
  } catch (e) {
    if (e instanceof OrchardCliError) {
      const lines = [];
      lines.push(status("error", `${e.code}: ${e.message}`));
      if (e.context && typeof e.context === "object" && e.context.hint) {
        lines.push(`  ${color("dim", "Hint:")} ${e.context.hint}`);
      }
      const msg = lines.join("\n");
      err(msg);
      void _fireTelemetry(false, 1, e.code);
      return { exitCode: 1, output: msg };
    }
    const stack = (e && e.stack) ? e.stack : String(e);
    const msg = status("error", `Unexpected error: ${e instanceof Error ? e.message : String(e)}`) +
      (process.env.DEBUG ? "\n" + stack : "");
    err(msg);
    void _fireTelemetry(false, 2, "unexpected_error");
    return { exitCode: 2, output: msg };
  }
}

module.exports = { dispatch, renderHelp, COMMANDS, SUBCOMMAND_NAMES };
