// @ts-check
/**
 * FAI MCP CLI — `frootai mcp publish <plugin.json>` (M4.14 ship).
 *
 * Validates the plugin's `providesMcp` block against the v1 schema and
 * prints the dry-run payload that WOULD be submitted to the FrootAI
 * marketplace API. The actual HTTP submission is pinned for Phase X3 —
 * the row spec EXPLICITLY says "for M4 ship a dry-run that prints what
 * would be submitted". Anything else here would be a doctrine-#3 violation
 * (no silent submission to a registry without operator review).
 *
 * Args:
 *   <plugin.json>     positional, required; path to a plugin manifest
 *   --submit          attempt the real submission \u2014 currently raises
 *                     `not_yet_implemented` PIN_ONE_AHEAD to X3
 *   --json            machine-readable output
 *
 * Exit codes (via dispatcher; final shape locks at M4.21):
 *   0  ok (valid plugin + dry-run printed)
 *   1  user_error (missing path, unreadable file, malformed JSON, missing
 *      providesMcp block, schema validation failure)
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { McpCliError } = require("../cli-error");
const { validateProvidesMcp } = require("../provides-mcp-validator");
const { color, status } = require("../../orchard/output");

const DRY_RUN_ENDPOINT = "https://api.frootai.dev/v1/marketplace/mcp-listings";

/**
 * Pure: load + parse a plugin manifest. Throws `McpCliError` on failure.
 *
 * @param {string} absPath
 * @param {{ readFile?: (p: string) => string }} [hooks]
 * @returns {object}
 */
function loadPluginManifest(absPath, hooks) {
  const h = hooks || {};
  const readFile = h.readFile || ((p) => fs.readFileSync(p, "utf8"));
  let raw;
  try { raw = readFile(absPath); } catch (err) {
    throw new McpCliError(
      "user_error",
      `cannot read plugin manifest at ${absPath}: ${err && err.message}`,
      { hint: "Pass an absolute path or run from the plugin directory.", path: absPath },
    );
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (err) {
    throw new McpCliError(
      "user_error",
      `plugin manifest is not valid JSON: ${absPath}`,
      { hint: (err && err.message) || "Check trailing commas / unescaped quotes.", path: absPath },
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new McpCliError(
      "user_error",
      "plugin manifest root must be an object",
      { hint: "Expected `{ name, version, providesMcp, ... }`.", path: absPath },
    );
  }
  return parsed;
}

/**
 * Pure: build the dry-run submission payload that the X3 publisher API
 * will eventually consume. Frozen now so the JSON shape lands once and
 * X3 only adds wire fields (auth, attestation, signature).
 *
 * @param {{ pluginPath: string, plugin: object, nowIso: string, cliPid: number, endpoint: string }} opts
 * @returns {object}
 */
function buildDryRunPayload(opts) {
  const { pluginPath, plugin, nowIso, cliPid, endpoint } = opts;
  return {
    apiVersion: 1,
    submittedAt: nowIso,
    submittedFromCliPid: cliPid,
    targetEndpoint: endpoint,
    plugin: {
      name: typeof plugin.name === "string" ? plugin.name : null,
      version: typeof plugin.version === "string" ? plugin.version : null,
      description: typeof plugin.description === "string" ? plugin.description : null,
      author: plugin.author && typeof plugin.author === "object" ? plugin.author : null,
      sourcePath: pluginPath,
    },
    providesMcp: plugin.providesMcp,
  };
}

/**
 * Dispatcher-compatible exec entry.
 *
 * @param {object} args
 * @param {object} [deps]
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function execPublish(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const a = args || {};
  const positional = Array.isArray(a._) ? a._ : [];
  const now = (typeof d.now === "function") ? d.now : () => Date.now();

  const pluginPathArg = positional.length > 0 ? String(positional[0]).trim() : "";
  if (!pluginPathArg) {
    throw new McpCliError(
      "user_error",
      "frootai mcp publish requires a plugin.json path",
      { hint: "Usage: frootai mcp publish ./plugin.json" },
    );
  }
  const absPath = path.isAbsolute(pluginPathArg)
    ? pluginPathArg
    : path.resolve(d.cwd || process.cwd(), pluginPathArg);

  // M4 ship is dry-run only. The actual marketplace submission endpoint
  // lands at Phase X3 (`02-marketplace-and-trust-masterplan.md`).
  if (a.submit) {
    throw new McpCliError(
      "not_yet_implemented",
      "live marketplace submission is pinned for Phase X3",
      { hint: "Run without `--submit` for the dry-run preview." },
    );
  }

  const plugin = loadPluginManifest(absPath, { readFile: d.readFile });

  if (!("providesMcp" in plugin)) {
    throw new McpCliError(
      "user_error",
      "plugin manifest does not declare a `providesMcp` block",
      {
        hint: "Add a `providesMcp: { name, transport, trust, ... }` field per https://frootai.dev/schemas/provides-mcp-v1.json",
        path: absPath,
      },
    );
  }

  const validation = validateProvidesMcp(plugin.providesMcp);
  if (!validation.valid) {
    throw new McpCliError(
      "user_error",
      `providesMcp validation failed (${validation.errors.length} error${validation.errors.length === 1 ? "" : "s"})`,
      {
        hint: validation.errors.slice(0, 5).join("; ") + (validation.errors.length > 5 ? "; …" : ""),
        path: absPath,
        errors: validation.errors,
      },
    );
  }

  const nowIso = new Date(now()).toISOString();
  const payload = buildDryRunPayload({
    pluginPath: absPath,
    plugin,
    nowIso,
    cliPid: process.pid,
    endpoint: DRY_RUN_ENDPOINT,
  });

  if (a.json) {
    const json = JSON.stringify({
      pluginPath: absPath,
      pluginName: plugin.name || null,
      pluginVersion: plugin.version || null,
      providesMcp: plugin.providesMcp,
      dryRun: true,
      submitEndpoint: DRY_RUN_ENDPOINT,
      submittedAt: nowIso,
      payload,
    });
    log(json);
    return { exitCode: 0, output: json };
  }

  const colorOpts = { color: !a["no-color"] };
  const headline = status("ok",
    `dry-run: plugin "${plugin.name || "<unnamed>"}" is publish-ready`,
    colorOpts);
  const lines = [
    "",
    headline,
    color("dim", `  Endpoint (X3 placeholder): ${DRY_RUN_ENDPOINT}`, colorOpts),
    color("dim", `  Source: ${absPath}`, colorOpts),
    color("dim", `  providesMcp:`, colorOpts),
    JSON.stringify(plugin.providesMcp, null, 2)
      .split("\n").map((l) => "    " + l).join("\n"),
    color("dim", `  Would submit (pinned for X3):`, colorOpts),
    JSON.stringify(payload, null, 2)
      .split("\n").map((l) => "    " + l).join("\n"),
    "",
  ];
  const out = lines.join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

module.exports = {
  execPublish,
  loadPluginManifest,
  buildDryRunPayload,
  DRY_RUN_ENDPOINT,
};
