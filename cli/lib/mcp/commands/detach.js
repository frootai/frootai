// @ts-check
/**
 * FAI MCP CLI — `frootai mcp detach <name>` (M4.6 ship).
 *
 * Counterpart to M4.5 `attach`. Removes `<name>` from
 * `~/.frootai/mcp-state.json` `preAttach[]` so the next kernel boot will
 * not eagerly attach it. Idempotent: detaching a name that is not in the
 * roster is a no-op success (`alreadyDetached: true`), never an error.
 *
 * Does NOT touch a live kernel — runtime detach lives at `fai_detach_mcp`
 * (M2.7). M4.6 is config mutation only.
 *
 * Args:
 *   <name>   positional, required
 *   --json   machine-readable output
 *
 * Exit codes (via dispatcher):
 *   0  ok (removed / already-absent)
 *   1  user_error (missing or invalid name)
 *
 * Deps injection (for tests):
 *   homeDir   $HOME override
 *   log/err   stdout/stderr captures (from dispatch.js)
 */
"use strict";

const { readState, writeState } = require("../state");
const { resolveTier1Trust } = require("../tier1-trust");
const { McpCliError } = require("../cli-error");
const { color, status } = require("../../orchard/output");

/**
 * Remove a name from a preAttach roster preserving append order +
 * idempotency on miss. Pure.
 *
 * @param {string[]} roster
 * @param {string} name
 * @returns {{ next: string[], removed: boolean }}
 */
function removeName(roster, name) {
  const list = Array.isArray(roster) ? roster.slice() : [];
  const idx = list.indexOf(name);
  if (idx === -1) return { next: list, removed: false };
  list.splice(idx, 1);
  return { next: list, removed: true };
}

/**
 * Dispatcher-compatible exec entry.
 *
 * @param {object} args
 * @param {object} [deps]
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function execDetach(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const a = args || {};

  const positional = Array.isArray(a._) ? a._ : [];
  const name = positional.length > 0 ? String(positional[0]).trim() : "";

  if (!name) {
    throw new McpCliError(
      "user_error",
      "frootai mcp detach requires an area name",
      { hint: "Usage: frootai mcp detach <name>" },
    );
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new McpCliError(
      "user_error",
      `invalid area name "${name}"`,
      { hint: "Allowed: letters, digits, underscore, hyphen (no dots or spaces)." },
    );
  }

  const state = readState(d);
  const { next, removed } = removeName(state.preAttach || [], name);
  let writtenPath = null;
  if (removed) {
    writtenPath = writeState({ ...state, preAttach: next }, d);
  }

  const colorOpts = { color: !a["no-color"] };
  const payload = {
    name,
    removed,
    alreadyDetached: !removed,
    trust: resolveTier1Trust(name),
    preAttachCount: next.length,
    statePath: writtenPath,
  };

  if (a.json) {
    const json = JSON.stringify(payload);
    log(json);
    return { exitCode: 0, output: json };
  }

  const headline = removed
    ? status("ok", `detached "${name}" from pre-attach roster`, colorOpts)
    : status("info", `"${name}" was not in the pre-attach roster (no-op)`, colorOpts);
  const rosterLine = next.length === 0
    ? "  Roster now: 0 areas"
    : `  Roster now: ${next.length} area${next.length === 1 ? "" : "s"} (${next.join(", ")})`;
  const out = [
    "",
    headline,
    color("dim", rosterLine, colorOpts),
    color("dim", `  State file: ${writtenPath || "(unchanged)"}`, colorOpts),
    "",
  ].join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

module.exports = {
  execDetach,
  removeName,
};
