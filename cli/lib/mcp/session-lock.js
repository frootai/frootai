// @ts-check
/**
 * FAI MCP CLI — `~/.frootai/mcp-session.lock` writer/reader (M4.13 ship).
 *
 * The session lock records the most recent `frootai mcp invoke … --persist`
 * — which area the operator asked the kernel to keep pre-attached, the
 * last tool invoked, and the CLI PID that owned the persisted session.
 * It is an OPERATOR-FACING hint file, NOT a live IPC handle: stdio MCP
 * dies with the parent process, so the "persisted attach" actually
 * lives in `mcp-state.json` `preAttach[]` (the next kernel boot re-attaches);
 * the lock just lets follow-up CLI invocations / VS Code surfaces see
 * which area is the active session focus.
 *
 * Schema (frozen at M4.13):
 *   {
 *     version:           1,
 *     area:              string,
 *     lastTool:          string,
 *     lastArgs:          object,
 *     lastInvokedAt:     string,           // ISO-8601
 *     cliPid:            number,           // CLI process that wrote the lock
 *     persistedToPreAttach: boolean        // mirrors the state-file mutation
 *   }
 */
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { McpCliError } = require("./cli-error");

const SESSION_LOCK_RELPATH = path.join(".frootai", "mcp-session.lock");
const SESSION_LOCK_VERSION = 1;

/**
 * @param {object} [deps]
 * @returns {string}
 */
function resolveSessionLockPath(deps) {
  const d = deps || {};
  const home = d.homeDir || os.homedir();
  return path.join(home, SESSION_LOCK_RELPATH);
}

/**
 * Atomically write the session lock. Mirrors `state.js writeState` shape:
 * `.tmp` → rename so concurrent readers see either old or new bytes only.
 *
 * @param {{ area: string, lastTool: string, lastArgs?: object, lastInvokedAt: string, cliPid?: number, persistedToPreAttach?: boolean }} body
 * @param {object} [deps]
 * @returns {string} absolute path of the written file
 */
function writeSessionLock(body, deps) {
  const abs = resolveSessionLockPath(deps);
  const dir = path.dirname(abs);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (err) {
    throw new McpCliError("session_lock_write_failed", `cannot create ${dir}: ${err && err.message}`, {
      hint: "Check filesystem permissions on your home directory.", path: dir,
    });
  }
  const payload = {
    version: SESSION_LOCK_VERSION,
    area: String((body && body.area) || ""),
    lastTool: String((body && body.lastTool) || ""),
    lastArgs: (body && body.lastArgs && typeof body.lastArgs === "object" && !Array.isArray(body.lastArgs))
      ? body.lastArgs : {},
    lastInvokedAt: String((body && body.lastInvokedAt) || new Date().toISOString()),
    cliPid: typeof (body && body.cliPid) === "number" ? body.cliPid : process.pid,
    persistedToPreAttach: Boolean(body && body.persistedToPreAttach),
  };
  const tmp = `${abs}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n", "utf8");
    fs.renameSync(tmp, abs);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* noop */ }
    throw new McpCliError("session_lock_write_failed", `cannot write ${abs}: ${err && err.message}`, {
      hint: "Check disk space + permissions on ~/.frootai/.", path: abs,
    });
  }
  return abs;
}

/**
 * Read the session lock. Returns `null` when the file is absent (the
 * normal first-run state). Throws `McpCliError('session_lock_read_failed')`
 * on malformed JSON / bad shape.
 *
 * @param {object} [deps]
 * @returns {{ version: number, area: string, lastTool: string, lastArgs: object, lastInvokedAt: string, cliPid: number, persistedToPreAttach: boolean } | null}
 */
function readSessionLock(deps) {
  const abs = resolveSessionLockPath(deps);
  let raw;
  try { raw = fs.readFileSync(abs, "utf8"); } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw new McpCliError("session_lock_read_failed", `cannot read ${abs}: ${err && err.message}`, {
      hint: `Check permissions on ${path.dirname(abs)}.`, path: abs,
    });
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    throw new McpCliError("session_lock_read_failed", `session lock is not valid JSON: ${abs}`, {
      hint: "Delete the file to clear the persisted session.", path: abs,
    });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new McpCliError("session_lock_read_failed", `session lock root is not an object: ${abs}`, {
      hint: "Delete the file to clear the persisted session.", path: abs,
    });
  }
  return {
    version: typeof parsed.version === "number" ? parsed.version : SESSION_LOCK_VERSION,
    area: typeof parsed.area === "string" ? parsed.area : "",
    lastTool: typeof parsed.lastTool === "string" ? parsed.lastTool : "",
    lastArgs: (parsed.lastArgs && typeof parsed.lastArgs === "object" && !Array.isArray(parsed.lastArgs))
      ? parsed.lastArgs : {},
    lastInvokedAt: typeof parsed.lastInvokedAt === "string" ? parsed.lastInvokedAt : "",
    cliPid: typeof parsed.cliPid === "number" ? parsed.cliPid : 0,
    persistedToPreAttach: Boolean(parsed.persistedToPreAttach),
  };
}

/**
 * Delete the session lock if present. Idempotent — silently succeeds
 * when the file is already absent.
 *
 * @param {object} [deps]
 * @returns {{ cleared: boolean, path: string }}
 */
function clearSessionLock(deps) {
  const abs = resolveSessionLockPath(deps);
  try { fs.unlinkSync(abs); return { cleared: true, path: abs }; }
  catch (err) {
    if (err && err.code === "ENOENT") return { cleared: false, path: abs };
    throw new McpCliError("session_lock_clear_failed", `cannot delete ${abs}: ${err && err.message}`, {
      hint: `Check permissions on ${path.dirname(abs)}.`, path: abs,
    });
  }
}

module.exports = {
  SESSION_LOCK_RELPATH,
  SESSION_LOCK_VERSION,
  resolveSessionLockPath,
  writeSessionLock,
  readSessionLock,
  clearSessionLock,
};
