// @ts-check
/**
 * FAI MCP CLI — `frootai mcp test <name>` (M4.10) + `--all` sweep (M4.11).
 *
 * One-shot health check: spawns the `frootai-mcp` server, attaches the
 * named area, lists its tools, detaches, then tears the subprocess down.
 * Persists a `lastHealthCheck[]` entry to `~/.frootai/mcp-state.json` so
 * subsequent `frootai mcp list` runs surface the freshness window.
 *
 * `--all` (M4.11) runs the same check for every Tier-1 area registered in
 * `cli/lib/mcp/tier1-trust.js`, persists all entries in a single atomic
 * write at the end of the sweep, and renders a markdown table (or a
 * `{ totals, rows }` JSON payload). Each area gets its OWN spawnClient
 * invocation — subprocess accounting stays per-area.
 *
 * Args:
 *   <name>            positional, required UNLESS --all is set
 *   --all             sweep every Tier-1 area; mutually exclusive with <name>
 *   --json            machine-readable output
 *   --no-color        plain text headers
 *
 * Exit codes (via dispatcher; final shape locks at M4.21):
 *   0  ok (single ok / sweep with at least one area)
 *   1  user_error (missing name + no --all, or both)
 *
 * Cleanup discipline (Doctrine #7): every spawned subprocess is disposed
 * in a `finally` regardless of outcome. The injectable `deps.spawnClient`
 * lets tests substitute a fake client so CI never spawns the real npm
 * package.
 *
 * Deps injection:
 *   homeDir       $HOME override
 *   spawnClient   async () => ({ client: { initialize?, invokeTool }, dispose })
 *   now           () => epoch ms (deterministic test clock)
 */
"use strict";

const { McpCliError } = require("../cli-error");
const { readState, writeState, upsertHealthCheck } = require("../state");
const { defaultSpawnClient } = require("../kernel-client");
const { TIER_1_AREA_NAMES } = require("../tier1-trust");
const { color, status } = require("../../orchard/output");

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Extract a JSON payload from an MCP `tools/call` response. The MCP
 * standard wraps results in `{ content: [{ type: "text", text: "<json>" }] }`;
 * the lifecycle tools always emit a single text part containing JSON.
 *
 * Returns `null` when the response shape can't be parsed. Pure.
 *
 * @param {any} mcpResult
 * @returns {any}
 */
function extractJsonResult(mcpResult) {
  if (!mcpResult || typeof mcpResult !== "object") return null;
  const content = mcpResult.content;
  if (!Array.isArray(content) || content.length === 0) return null;
  const first = content[0];
  if (!first || typeof first.text !== "string") return null;
  try { return JSON.parse(first.text); } catch { return null; }
}

/**
 * Core attach → list → detach → dispose worker. Returns a normalised
 * health-check entry. Always disposes the subprocess (Doctrine #7);
 * the caller decides whether to persist + how to render.
 *
 * @param {string} name
 * @param {object} deps
 * @returns {Promise<{ area: string, status: "ok"|"fail", attached: boolean, toolCount: number, latencyMs: number, checkedAt: string, errorCode?: string, errorMessage?: string }>}
 */
async function _runSingleHealthCheck(name, deps) {
  const d = deps || {};
  const now = (typeof d.now === "function") ? d.now : () => Date.now();
  const spawnClient = (typeof d.spawnClient === "function") ? d.spawnClient : defaultSpawnClient;

  const startedMs = now();
  let session = null;
  let attachResult = null;
  let listResult = null;
  let failureCode = null;
  let failureMessage = null;
  try {
    session = await spawnClient(d);
    const rawAttach = await session.client.invokeTool("fai_attach_mcp", { name });
    attachResult = extractJsonResult(rawAttach);
    if (!attachResult || attachResult.attached !== true) {
      // M4.21 deterministic-exit mapping: blocked-by-trust attaches get
      // their own `trust_block` code so the dispatcher exits with 3
      // (operator action = update trust manifest), not 4 (kernel fault).
      failureCode = attachResult && attachResult.blocked === true
        ? "trust_block"
        : "attach_failed";
      failureMessage = attachResult
        ? (attachResult.humanMessage || attachResult.reason || `attach returned ${JSON.stringify(attachResult)}`)
        : "attach response had no parseable JSON body";
    } else {
      const rawList = await session.client.invokeTool("fai_list_attached", {});
      listResult = extractJsonResult(rawList);
    }
  } catch (err) {
    if (err instanceof McpCliError) {
      failureCode = err.code;
      failureMessage = err.message;
    } else {
      failureCode = "upstream_failure";
      failureMessage = err && err.message ? err.message : String(err);
    }
  } finally {
    if (session) {
      try { await session.client.invokeTool("fai_detach_mcp", { name }); } catch { /* noop */ }
      try { await session.dispose(); } catch { /* noop */ }
    }
  }

  let toolCount = null;
  if (listResult && Array.isArray(listResult.areas)) {
    const entry = listResult.areas.find((x) => x && x.name === name);
    if (entry && typeof entry.toolCount === "number") toolCount = entry.toolCount;
  }
  if (toolCount == null && attachResult && Array.isArray(attachResult.tools)) {
    toolCount = attachResult.tools.length;
  }

  const ok = !failureCode;
  const endMs = now();
  return {
    area: name,
    status: ok ? "ok" : "fail",
    attached: ok,
    toolCount: typeof toolCount === "number" ? toolCount : 0,
    latencyMs: Math.max(0, endMs - startedMs),
    checkedAt: new Date(startedMs).toISOString(),
    ...(failureCode ? { errorCode: failureCode, errorMessage: failureMessage } : {}),
  };
}

/**
 * Persist a batch of health-check entries to `~/.frootai/mcp-state.json`
 * via a single atomic write (`upsertHealthCheck` per entry, then one
 * `writeState`). Returns the state path, or `null` on write failure.
 *
 * @param {Array<object>} entries
 * @param {object} deps
 * @returns {string | null}
 */
function _persistHealthChecks(entries, deps) {
  try {
    const prior = readState(deps);
    let nextChecks = Array.isArray(prior.lastHealthCheck) ? prior.lastHealthCheck.slice() : [];
    for (const e of entries) {
      nextChecks = upsertHealthCheck(nextChecks, {
        area: e.area,
        status: e.status,
        latencyMs: e.latencyMs,
        toolCount: e.toolCount,
        checkedAt: e.checkedAt,
        ...(e.errorCode ? { errorCode: e.errorCode } : {}),
      });
    }
    return writeState({ ...prior, lastHealthCheck: nextChecks }, deps);
  } catch {
    return null;
  }
}

function _renderSingleText(entry, statePath, opts) {
  const colorOpts = opts || {};
  const ok = entry.status === "ok";
  const headline = ok
    ? status("ok",
        `"${entry.area}" attached — ${entry.toolCount} tool${entry.toolCount === 1 ? "" : "s"} (${entry.latencyMs} ms round-trip)`,
        colorOpts)
    : status("error",
        `"${entry.area}" health check FAILED (${entry.errorCode}): ${entry.errorMessage}`,
        colorOpts);
  return [
    "",
    headline,
    color("dim", `  Checked at: ${entry.checkedAt}`, colorOpts),
    color("dim", `  State file: ${statePath || "(unchanged)"}`, colorOpts),
    "",
  ].join("\n");
}

/**
 * Render a sweep result as a true Markdown table (spec literal from the
 * M4.11 row — useful for nightly-health-check Slack/GitHub posts).
 *
 * @param {Array<object>} entries
 * @param {string | null} statePath
 * @returns {string}
 */
function renderMarkdownTable(entries, statePath) {
  const okCount = entries.filter((e) => e.status === "ok").length;
  const failCount = entries.length - okCount;
  const totalMs = entries.reduce((acc, e) => acc + (e.latencyMs || 0), 0);
  const lines = [];
  lines.push("");
  lines.push("# Tier-1 federation health check");
  lines.push("");
  lines.push(`- Areas: ${entries.length}`);
  lines.push(`- ok: ${okCount}`);
  lines.push(`- fail: ${failCount}`);
  lines.push(`- Total elapsed: ${totalMs} ms`);
  if (statePath) lines.push(`- State file: ${statePath}`);
  lines.push("");
  lines.push("| AREA | STATUS | TOOLS | LATENCY | CHECKED AT | ERROR |");
  lines.push("|------|--------|-------|---------|------------|-------|");
  for (const e of entries) {
    const err = e.errorCode
      ? `${e.errorCode}: ${String(e.errorMessage || "").replace(/\|/g, "\\|").slice(0, 120)}`
      : "";
    lines.push(
      `| ${e.area} | ${e.status} | ${e.toolCount} | ${e.latencyMs} ms | ${e.checkedAt} | ${err} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Dispatcher-compatible exec entry.
 *
 * @param {object} args
 * @param {object} [deps]
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function execTest(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const a = args || {};
  const positional = Array.isArray(a._) ? a._ : [];
  const allFlag = Boolean(a.all);
  const name = positional.length > 0 ? String(positional[0]).trim() : "";

  if (allFlag && name) {
    throw new McpCliError(
      "user_error",
      "`<name>` and `--all` are mutually exclusive",
      { hint: "Run `frootai mcp test <name>` OR `frootai mcp test --all`, not both." },
    );
  }

  // ── single-area mode (M4.10) ────────────────────────────────────
  if (!allFlag) {
    if (!name) {
      throw new McpCliError(
        "user_error",
        "frootai mcp test requires an area name",
        { hint: "Usage: frootai mcp test <name>   OR   frootai mcp test --all" },
      );
    }
    if (!NAME_PATTERN.test(name)) {
      throw new McpCliError(
        "user_error",
        `invalid area name "${name}"`,
        { hint: "Allowed: letters, digits, underscore, hyphen (no dots or spaces)." },
      );
    }

    const entry = await _runSingleHealthCheck(name, d);
    const statePath = _persistHealthChecks([entry], d);

    const payload = {
      name: entry.area,
      status: entry.status,
      attached: entry.attached,
      toolCount: entry.toolCount,
      latencyMs: entry.latencyMs,
      checkedAt: entry.checkedAt,
      statePath,
      ...(entry.errorCode ? { errorCode: entry.errorCode, errorMessage: entry.errorMessage } : {}),
    };

    if (a.json) {
      const json = JSON.stringify(payload);
      log(json);
      return { exitCode: 0, output: json };
    }
    const out = _renderSingleText(entry, statePath, { color: !a["no-color"] });
    log(out);
    return { exitCode: 0, output: out };
  }

  // ── sweep mode (M4.11) ──────────────────────────────────────────
  /** @type {Array<object>} */
  const entries = [];
  for (const areaName of TIER_1_AREA_NAMES) {
    // eslint-disable-next-line no-await-in-loop
    const entry = await _runSingleHealthCheck(areaName, d);
    entries.push(entry);
  }
  const statePath = _persistHealthChecks(entries, d);

  if (a.json) {
    const okCount = entries.filter((e) => e.status === "ok").length;
    const failCount = entries.length - okCount;
    const totalMs = entries.reduce((acc, e) => acc + (e.latencyMs || 0), 0);
    const payload = {
      totals: { count: entries.length, ok: okCount, fail: failCount, totalMs },
      rows: entries.map((e) => ({
        name: e.area,
        status: e.status,
        attached: e.attached,
        toolCount: e.toolCount,
        latencyMs: e.latencyMs,
        checkedAt: e.checkedAt,
        ...(e.errorCode ? { errorCode: e.errorCode, errorMessage: e.errorMessage } : {}),
      })),
      statePath,
    };
    const json = JSON.stringify(payload);
    log(json);
    return { exitCode: 0, output: json };
  }

  const out = renderMarkdownTable(entries, statePath);
  log(out);
  return { exitCode: 0, output: out };
}

module.exports = {
  execTest,
  extractJsonResult,
  renderMarkdownTable,
  _runSingleHealthCheck,
  _persistHealthChecks,
};
