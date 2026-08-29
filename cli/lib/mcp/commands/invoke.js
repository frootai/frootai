// @ts-check
/**
 * FAI MCP CLI — `frootai mcp invoke <area.tool> --args '{json}'` (M4.12 ship).
 *
 * One-shot scripting helper: spawns the `frootai-mcp` server, attaches the
 * named federated area, invokes the namespaced tool, prints the response,
 * then detaches + tears the subprocess down. Mirrors the M4.10 spawn
 * discipline (Doctrine #7 — always dispose in `finally`) and re-uses the
 * `cli/lib/mcp/kernel-client.js` stdio transport.
 *
 * `--persist` (the M4.13 row) will skip the detach + write a session lock
 * so follow-up invokes can re-use the same kernel; this row implements the
 * always-detach default only.
 *
 * Args:
 *   <area.tool>       positional, required; split on the FIRST dot
 *                     (Doctrine #5 namespace shape).
 *   --args '{json}'   JSON-encoded arguments forwarded as the MCP tool's
 *                     `arguments` payload. Defaults to `{}`.
 *   --json            machine-readable output (raw MCP `result` object).
 *   --no-color        plain text.
 *
 * Exit codes (via dispatcher; final shape locks at M4.21):
 *   0  ok
 *   1  user_error (missing or invalid name; malformed --args JSON)
 *   1  attach_failed / upstream_failure (kernel-side problems)
 *
 * Deps injection:
 *   homeDir       $HOME override (currently unused; reserved for M4.13 lock)
 *   spawnClient   async () => ({ client: { initialize?, invokeTool }, dispose })
 *   now           () => epoch ms (deterministic test clock)
 */
"use strict";

const { McpCliError } = require("../cli-error");
const { defaultSpawnClient } = require("../kernel-client");
const { readState, writeState } = require("../state");
const { writeSessionLock, resolveSessionLockPath } = require("../session-lock");
const { insertName } = require("./attach");
const { extractJsonResult } = require("./test");
const { color, status } = require("../../orchard/output");

const AREA_PATTERN = /^[a-zA-Z0-9_-]+$/;
const TOOL_PATTERN = /^[a-zA-Z0-9_.-]+$/;

/**
 * Split a `<area>.<tool>` spec on the FIRST dot. Pure.
 *
 * @param {string} spec
 * @returns {{ area: string, tool: string }}
 */
function parseAreaTool(spec) {
  if (typeof spec !== "string" || !spec) {
    throw new McpCliError(
      "user_error",
      "frootai mcp invoke requires an <area.tool> positional",
      { hint: "Example: frootai mcp invoke azure.tools_list --args '{}'" },
    );
  }
  const dot = spec.indexOf(".");
  if (dot < 1 || dot === spec.length - 1) {
    throw new McpCliError(
      "user_error",
      `invalid <area.tool> spec "${spec}"`,
      { hint: "Use the form `<area>.<tool>` (Doctrine #5 namespace). Example: github.list_commits" },
    );
  }
  const area = spec.slice(0, dot);
  const tool = spec.slice(dot + 1);
  if (!AREA_PATTERN.test(area)) {
    throw new McpCliError(
      "user_error",
      `invalid area name "${area}"`,
      { hint: "Allowed: letters, digits, underscore, hyphen (no dots or spaces)." },
    );
  }
  if (!TOOL_PATTERN.test(tool)) {
    throw new McpCliError(
      "user_error",
      `invalid tool name "${tool}"`,
      { hint: "Allowed: letters, digits, underscore, hyphen, dot." },
    );
  }
  return { area, tool };
}

/**
 * Parse the `--args` flag value into the arguments object. Pure.
 *
 * @param {unknown} raw
 * @returns {object}
 */
function parseArgsFlag(raw) {
  if (raw === undefined || raw === true || raw === "") return {};
  if (typeof raw !== "string") {
    throw new McpCliError(
      "user_error",
      "--args must be a JSON string",
      { hint: "Example: --args '{\"query\":\"hello\"}'" },
    );
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (err) {
    throw new McpCliError(
      "user_error",
      `--args is not valid JSON: ${err && err.message}`,
      { hint: "Wrap the value in single quotes to preserve double-quoted JSON." },
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new McpCliError(
      "user_error",
      "--args must be a JSON object",
      { hint: "Example: --args '{\"query\":\"hello\"}'" },
    );
  }
  return parsed;
}

/**
 * Render the MCP `result.content[]` array as a string for text-mode
 * output. Concatenates text parts; describes non-text parts inline.
 *
 * @param {any} result
 * @returns {string}
 */
function renderContent(result) {
  if (!result || typeof result !== "object" || !Array.isArray(result.content)) {
    return "";
  }
  const parts = [];
  for (const c of result.content) {
    if (!c || typeof c !== "object") continue;
    if (c.type === "text" && typeof c.text === "string") parts.push(c.text);
    else if (typeof c.type === "string") parts.push(`[${c.type} content omitted]`);
  }
  return parts.join("\n");
}

/**
 * Dispatcher-compatible exec entry.
 *
 * @param {object} args
 * @param {object} [deps]
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function execInvoke(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const a = args || {};
  const positional = Array.isArray(a._) ? a._ : [];
  const now = (typeof d.now === "function") ? d.now : () => Date.now();
  const spawnClient = (typeof d.spawnClient === "function") ? d.spawnClient : defaultSpawnClient;

  const spec = positional.length > 0 ? String(positional[0]).trim() : "";
  const { area, tool } = parseAreaTool(spec);
  const toolArgs = parseArgsFlag(a.args);

  if (a.persist) {
    if (!/^[a-zA-Z0-9_-]+$/.test(area)) {
      // Area validation already done by parseAreaTool, but guard the
      // state-file writer against any future relaxation of that regex.
      throw new McpCliError(
        "user_error",
        `cannot persist invalid area name "${area}"`,
        { hint: "--persist requires a name that is safe for the preAttach roster." },
      );
    }
  }

  const startedMs = now();
  let session = null;
  let attachResult = null;
  let invokeResult = null;
  let failureCode = null;
  let failureMessage = null;
  let attachSucceeded = false;
  try {
    session = await spawnClient(d);
    const rawAttach = await session.client.invokeTool("fai_attach_mcp", { name: area });
    attachResult = extractJsonResult(rawAttach);
    if (!attachResult || attachResult.attached !== true) {
      // M4.21: trust-blocked attaches surface as `trust_block` (exit 3)
      // instead of the generic `attach_failed` (exit 4).
      failureCode = attachResult && attachResult.blocked === true
        ? "trust_block"
        : "attach_failed";
      failureMessage = attachResult
        ? (attachResult.humanMessage || attachResult.reason || `attach returned ${JSON.stringify(attachResult)}`)
        : "attach response had no parseable JSON body";
    } else {
      attachSucceeded = true;
      // Federated tools surface as `<area>.<tool>` per M3.26.
      invokeResult = await session.client.invokeTool(`${area}.${tool}`, toolArgs);
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
      // --persist + invoke succeeded: skip the detach RPC so the area
      // stays in the kernel's notion of "attached" for the (tiny) tail
      // of this CLI process. The DURABLE persistence is via preAttach[]
      // in `~/.frootai/mcp-state.json` so the NEXT kernel boot eagerly
      // re-attaches. Doctrine #7 still applies — dispose runs no matter
      // what.
      const shouldDetach = !(a.persist && !failureCode);
      if (shouldDetach) {
        try { await session.client.invokeTool("fai_detach_mcp", { name: area }); } catch { /* noop */ }
      }
      try { await session.dispose(); } catch { /* noop */ }
    }
  }
  const endMs = now();
  const latencyMs = Math.max(0, endMs - startedMs);
  const ok = !failureCode;
  const checkedAt = new Date(startedMs).toISOString();

  // --persist side-effects: only on success (no half-state lock).
  let persisted = false;
  let sessionLockPath = null;
  let statePath = null;
  if (ok && a.persist && attachSucceeded) {
    try {
      const prior = readState(d);
      const { next, added } = insertName(prior.preAttach || [], area);
      if (added) {
        statePath = writeState({ ...prior, preAttach: next }, d);
      } else {
        // Already in preAttach: nothing to write, but surface the path
        // so the JSON payload still tells the operator where the durable
        // roster lives.
        statePath = resolveSessionLockPath(d).replace(
          /mcp-session\.lock$/, "mcp-state.json",
        );
      }
      sessionLockPath = writeSessionLock({
        area,
        lastTool: tool,
        lastArgs: toolArgs,
        lastInvokedAt: checkedAt,
        cliPid: process.pid,
        persistedToPreAttach: true,
      }, d);
      persisted = true;
    } catch (err) {
      // Persistence failure must NOT mask the successful invoke result
      // — surface as a secondary error in the JSON payload.
      persisted = false;
      sessionLockPath = null;
      failureCode = (err instanceof McpCliError) ? err.code : "session_lock_write_failed";
      failureMessage = (err && err.message) ? err.message : String(err);
    }
  }

  const payload = {
    areaTool: spec,
    area,
    tool,
    args: toolArgs,
    status: ok && !failureCode ? "ok" : (ok ? "ok-with-persist-error" : "fail"),
    latencyMs,
    result: invokeResult || null,
    persisted,
    sessionLockPath,
    statePath,
    ...(failureCode ? { errorCode: failureCode, errorMessage: failureMessage } : {}),
  };

  if (a.json) {
    const json = JSON.stringify(payload);
    log(json);
    return { exitCode: 0, output: json };
  }

  const colorOpts = { color: !a["no-color"] };
  if (ok && !failureCode) {
    const persistLine = persisted
      ? color("dim", `  Persisted: "${area}" added to preAttach — next kernel boot re-attaches; lock at ${sessionLockPath}`, colorOpts)
      : null;
    const headline = status("ok",
      `${spec} — ${latencyMs} ms round-trip`,
      colorOpts);
    const body = renderContent(invokeResult);
    const out = [
      "",
      headline,
      body ? body : color("dim", "  (no text content in response)", colorOpts),
      ...(persistLine ? [persistLine] : []),
      "",
    ].join("\n");
    log(out);
    return { exitCode: 0, output: out };
  }
  const out = [
    "",
    status("error", `${spec} FAILED (${failureCode}): ${failureMessage}`, colorOpts),
    "",
  ].join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

module.exports = {
  execInvoke,
  parseAreaTool,
  parseArgsFlag,
  renderContent,
};
