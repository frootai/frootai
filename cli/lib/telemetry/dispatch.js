// @ts-check
/**
 * A4.27 — `frootai telemetry <on|off|status|reset>` dispatcher.
 *
 * Subcommands:
 *   on      — set telemetry_opt_in:true in ~/.frootai/config.json
 *   off     — set telemetry_opt_in:false (default)
 *   status  — print current state + endpoint + anon-id + DNT env state
 *   reset   — delete anon-id file (generates a fresh id next emit)
 *
 * All output is small + human-friendly. --json supported for scripts.
 *
 * Privacy doctrine surfaced in `status` output:
 *   - We list every prop key we collect (from ALLOWED_PROP_KEYS) so users can
 *     audit exactly what's transmitted.
 *   - We show the anon-id (the user owns it — they can grep for it in our logs).
 *   - We honor DO_NOT_TRACK env even if opted in (shown in status).
 */
"use strict";

const { parseArgs } = require("../orchard/arg-parser");
const { OrchardCliError } = require("../orchard/cli-error");
const { color, status, renderKeyValue } = require("../orchard/output");
const {
  readConfigFile,
  updateConfig,
  DEFAULT_CONFIG_PATH,
} = require("../auth/config-store");
const {
  readOrCreateAnonId,
  resetAnonId,
  DEFAULT_ANON_ID_PATH,
} = require("./anon-id");
const {
  DEFAULT_TELEMETRY_ENDPOINT,
  ALLOWED_PROP_KEYS,
  EVENT_ENUM,
} = require("./emitter");
const {
  runExport,
  DEFAULT_EXPORT_ENDPOINT,
} = require("./export");

const TELEMETRY_COMMANDS = Object.freeze(["on", "off", "status", "reset", "export"]);

function renderTelemetryHelp(opts) {
  const o = opts || {};
  const lines = [];
  lines.push("");
  lines.push(color("bold", "frootai telemetry — anonymous usage opt-in", o));
  lines.push("");
  lines.push(color("dim", "  Telemetry is OPT-IN. Default is OFF.", o));
  lines.push(color("dim", "  We only collect anonymous event counts (no token, email, paths, or repo URLs).", o));
  lines.push("");
  lines.push(color("bold", "Commands:", o));
  lines.push(`  ${color("cyan", "frootai telemetry on    ", o)}${color("dim", "Enable anonymous usage events", o)}`);
  lines.push(`  ${color("cyan", "frootai telemetry off   ", o)}${color("dim", "Disable (default)", o)}`);
  lines.push(`  ${color("cyan", "frootai telemetry status", o)}${color("dim", "Show current state + what would be sent", o)}`);
  lines.push(`  ${color("cyan", "frootai telemetry reset ", o)}${color("dim", "Reset anon-id (~/.frootai/anon-id)", o)}`);
  lines.push(`  ${color("cyan", "frootai telemetry export", o)}${color("dim", "Download your own events (GDPR Article 20 — requires sign-in + Pro tier)", o)}`);
  lines.push("");
  lines.push(color("dim", `  Endpoint: ${DEFAULT_TELEMETRY_ENDPOINT}`, o));
  lines.push(color("dim", `  Override via DO_NOT_TRACK=1 env (always skips, even if opted in)`, o));
  lines.push("");
  return lines.join("\n");
}

// ─── on / off ──────────────────────────────────────────────────────

async function execOn(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const colorOpts = { color: !args["no-color"] };
  await (d.updateConfig || updateConfig)({ telemetry_opt_in: true }, { configPath: d.configPath });
  // Ensure anon-id exists.
  const anonId = await (d.readOrCreateAnonId || readOrCreateAnonId)({ anonIdPath: d.anonIdPath });
  if (args.json) {
    const j = JSON.stringify({ ok: true, telemetry_opt_in: true, anon_id: anonId, endpoint: DEFAULT_TELEMETRY_ENDPOINT }, null, 2);
    log(j);
    return { exitCode: 0, output: j };
  }
  const lines = [];
  lines.push(status("ok", `Telemetry ${color("green", "ENABLED", colorOpts)}.`, colorOpts));
  lines.push("");
  lines.push(color("dim", `  Anonymous id: ${anonId || "(not generated)"}`, colorOpts));
  lines.push(color("dim", `  Endpoint:     ${DEFAULT_TELEMETRY_ENDPOINT}`, colorOpts));
  lines.push("");
  lines.push(color("dim", "  Run `frootai telemetry status` to see what we collect.", colorOpts));
  lines.push(color("dim", "  Run `frootai telemetry off` to disable.", colorOpts));
  const out = lines.join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

async function execOff(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const colorOpts = { color: !args["no-color"] };
  await (d.updateConfig || updateConfig)({ telemetry_opt_in: false }, { configPath: d.configPath });
  if (args.json) {
    const j = JSON.stringify({ ok: true, telemetry_opt_in: false }, null, 2);
    log(j);
    return { exitCode: 0, output: j };
  }
  const out = [
    status("ok", `Telemetry ${color("yellow", "DISABLED", colorOpts)}.`, colorOpts),
    "",
    color("dim", "  No anonymous events will be sent. Your anon-id remains at ~/.frootai/anon-id.", colorOpts),
    color("dim", "  Run `frootai telemetry reset` to wipe the anon-id entirely.", colorOpts),
  ].join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

// ─── status ────────────────────────────────────────────────────────

async function execStatus(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const colorOpts = { color: !args["no-color"] };
  const config = await (d.readConfig || readConfigFile)({ configPath: d.configPath });
  const optedIn = config.telemetry_opt_in === true;
  const dnt = (d.dntOverride === true) || process.env.DO_NOT_TRACK === "1";
  const willEmit = optedIn && !dnt;

  // Only generate/read anon-id if opted in (don't create a file just to print status).
  let anonId = null;
  if (optedIn) {
    anonId = await (d.readOrCreateAnonId || readOrCreateAnonId)({ anonIdPath: d.anonIdPath });
  }

  if (args.json) {
    const j = JSON.stringify({
      telemetry_opt_in: optedIn,
      do_not_track_env: dnt,
      will_emit: willEmit,
      anon_id: anonId,
      endpoint: DEFAULT_TELEMETRY_ENDPOINT,
      events_collected: [...EVENT_ENUM],
      props_collected: [...ALLOWED_PROP_KEYS].sort(),
      config_path: d.configPath || DEFAULT_CONFIG_PATH,
      anon_id_path: d.anonIdPath || DEFAULT_ANON_ID_PATH,
    }, null, 2);
    log(j);
    return { exitCode: 0, output: j };
  }

  const lines = [];
  lines.push("");
  lines.push(color("bold", "frootai telemetry — status", colorOpts));
  lines.push("");
  lines.push(renderKeyValue([
    { label: "Opted in", value: optedIn ? color("green", "yes", colorOpts) : color("dim", "no (default)", colorOpts) },
    { label: "DO_NOT_TRACK env", value: dnt ? color("yellow", "yes (overrides opt-in)", colorOpts) : color("dim", "no", colorOpts) },
    { label: "Will emit", value: willEmit ? color("green", "yes", colorOpts) : color("dim", "no", colorOpts) },
    { label: "Anon id", value: anonId || color("dim", "(not generated)", colorOpts) },
    { label: "Endpoint", value: DEFAULT_TELEMETRY_ENDPOINT },
  ], colorOpts));
  lines.push("");
  lines.push(color("bold", "Events collected:", colorOpts));
  for (const e of EVENT_ENUM) lines.push(`  ${color("cyan", "·", colorOpts)} ${e}`);
  lines.push("");
  lines.push(color("bold", "Props collected (whitelist):", colorOpts));
  for (const k of [...ALLOWED_PROP_KEYS].sort()) lines.push(`  ${color("cyan", "·", colorOpts)} ${k}`);
  lines.push("");
  lines.push(color("dim", "  We NEVER send: tokens, email, subject, target_dir, repo_url, fruit_id, Play recipe content.", colorOpts));
  lines.push(color("dim", `  Files: config at ${d.configPath || DEFAULT_CONFIG_PATH}`, colorOpts));
  lines.push(color("dim", `         anon-id at ${d.anonIdPath || DEFAULT_ANON_ID_PATH}`, colorOpts));
  lines.push("");
  const out = lines.join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

// ─── reset ─────────────────────────────────────────────────────────

async function execReset(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const colorOpts = { color: !args["no-color"] };
  const existed = await (d.resetAnonId || resetAnonId)({ anonIdPath: d.anonIdPath });
  if (args.json) {
    const j = JSON.stringify({ ok: true, anon_id_deleted: existed }, null, 2);
    log(j);
    return { exitCode: 0, output: j };
  }
  const out = existed
    ? status("ok", `Anonymous id reset. A fresh id will be generated on the next telemetry event.`, colorOpts)
    : status("info", `No anonymous id to reset (file did not exist).`, colorOpts);
  log(out);
  return { exitCode: 0, output: out };
}

// ─── export ────────────────────────────────────────────────────────

async function execExport(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const err = d.err || ((s) => process.stderr.write(s + "\n"));
  const colorOpts = { color: !args["no-color"] };

  const result = await (d.runExport || runExport)({
    endpoint: d.exportEndpoint || DEFAULT_EXPORT_ENDPOINT,
    tokenPath: d.tokenPath,
    anonIdPath: d.anonIdPath,
    outDir: d.outDir,
    start: args.start,
    end: args.end,
    fetchImpl: d.fetchImpl,
    readToken: d.readToken,
    readOrCreateAnonId: d.readOrCreateAnonId,
    now: d.now,
  });

  if (args.json) {
    const j = JSON.stringify(result, null, 2);
    log(j);
    return { exitCode: result.ok ? 0 : 1, output: j };
  }

  if (!result.ok) {
    const lines = [
      status("error", `Export failed: ${result.error_code}`, colorOpts),
      color("dim", `  ${result.hint || ""}`, colorOpts),
    ];
    const msg = lines.join("\n");
    err(msg);
    return { exitCode: 1, output: msg };
  }
  const lines = [
    status("ok", `Telemetry export complete.`, colorOpts),
    "",
    color("dim", `  File:       ${result.path}`, colorOpts),
    color("dim", `  Events:     ${result.event_count}`, colorOpts),
    color("dim", `  Range:      ${result.range && result.range.start} → ${result.range && result.range.end}`, colorOpts),
    color("dim", `  Schema:     ${result.schema_id}`, colorOpts),
    "",
    color("dim", `  Format:     JSONL (one event per line). Use \`jq -s\` to convert to a JSON array.`, colorOpts),
  ];
  const out = lines.join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

const TELEMETRY_EXECS = Object.freeze({
  on: execOn,
  off: execOff,
  status: execStatus,
  reset: execReset,
  export: execExport,
});

/**
 * Dispatch `frootai telemetry <subcommand>`.
 *
 * @param {string[]} argv
 * @param {object} [deps]
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function dispatchTelemetry(argv, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const err = d.err || ((s) => process.stderr.write(s + "\n"));
  const args = parseArgs(argv || []);
  const sub = (args._ && args._.shift()) || (args.help || args.h ? "help" : "");
  if (!sub || sub === "help" || sub === "--help" || sub === "-h" || args.help || args.h) {
    const out = renderTelemetryHelp({ color: !args["no-color"] });
    log(out);
    return { exitCode: 0, output: out };
  }
  const exec = TELEMETRY_EXECS[sub];
  if (!exec) {
    const msg = status("error", `Unknown telemetry subcommand: "${sub}"`) + "\n" + renderTelemetryHelp({ color: !args["no-color"] });
    err(msg);
    return { exitCode: 1, output: msg };
  }
  try {
    return await exec(args, d);
  } catch (e) {
    if (e instanceof OrchardCliError) {
      const lines = [];
      lines.push(status("error", `${e.code}: ${e.message}`));
      if (e.context && typeof e.context === "object" && e.context.hint) {
        lines.push(`  ${color("dim", "Hint:")} ${e.context.hint}`);
      }
      const msg = lines.join("\n");
      err(msg);
      return { exitCode: 1, output: msg };
    }
    const stack = (e && e.stack) ? e.stack : String(e);
    const msg = status("error", `Unexpected error: ${e instanceof Error ? e.message : String(e)}`) +
      (process.env.DEBUG ? "\n" + stack : "");
    err(msg);
    return { exitCode: 2, output: msg };
  }
}

module.exports = {
  TELEMETRY_COMMANDS,
  TELEMETRY_EXECS,
  dispatchTelemetry,
  renderTelemetryHelp,
  execOn,
  execOff,
  execStatus,
  execReset,
  execExport,
};
