// @ts-check
/**
 * FAI MCP CLI — `frootai mcp attach <name> [--trust-override]` (M4.5 ship).
 *
 * Mutates the operator's `~/.frootai/mcp-state.json` `preAttach[]` roster
 * so the next kernel boot will eagerly attach `<name>` (Doctrine #4 opt-in
 * pre-attach path). Trust posture is read locally via the Tier-1 trust map
 * shipped at M4.3 (`tier1-trust.js`); a `community`-equivalent resolution
 * (currently any unknown area name) gates the write behind a confirmation
 * prompt unless `--trust-override` is passed.
 *
 * The CLI does NOT spawn the kernel here \u2014 attach lives at runtime
 * (`fai_attach_mcp`). M4.5 is the CONFIG mutation only; the trust gate at
 * actual attach time is M2 territory and is NEVER bypassed by this command.
 *
 * Args:
 *   <name>                positional, required
 *   --trust-override      skip the confirmation prompt for community-tier
 *                         areas (writes the entry unconditionally)
 *   --json                machine-readable output
 *
 * Exit codes (via dispatcher):
 *   0  ok (added / already-present)
 *   1  user_error (missing name, refused at prompt, unknown name without
 *      --trust-override unless prompt agrees)
 *
 * Idempotency: re-attaching an already-present name is a no-op success
 *              with `alreadyAttached: true` in the JSON payload.
 *
 * Deps injection (for tests):
 *   homeDir   $HOME override (re-used from state.js)
 *   confirm   async (prompt: string) => boolean   prompt replacement
 *   log/err   stdout/stderr captures (from dispatch.js)
 */
"use strict";

const readline = require("node:readline");

const { readState, writeState } = require("../state");
const { resolveTier1Trust, TIER_1_AREA_TRUST } = require("../tier1-trust");
const { McpCliError } = require("../cli-error");
const { color, status } = require("../../orchard/output");

const PROMPT_TRUST_TIERS = Object.freeze(new Set(["community", "unknown"]));

/**
 * Default interactive confirmation. Returns a Promise<boolean>.
 * Replaced in tests via `deps.confirm`.
 *
 * @param {string} prompt
 * @returns {Promise<boolean>}
 */
function _defaultConfirm(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${prompt} [y/N] `, (answer) => {
      rl.close();
      const a = String(answer || "").trim().toLowerCase();
      resolve(a === "y" || a === "yes");
    });
  });
}

/**
 * Insert a name into a preAttach roster preserving append order +
 * idempotency. Pure.
 *
 * @param {string[]} roster
 * @param {string} name
 * @returns {{ next: string[], added: boolean }}
 */
function insertName(roster, name) {
  const list = Array.isArray(roster) ? roster.slice() : [];
  if (list.includes(name)) return { next: list, added: false };
  list.push(name);
  return { next: list, added: true };
}

/**
 * Dispatcher-compatible exec entry.
 *
 * @param {object} args
 * @param {object} [deps]
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function execAttach(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const confirm = typeof d.confirm === "function" ? d.confirm : _defaultConfirm;
  const a = args || {};

  const positional = Array.isArray(a._) ? a._ : [];
  const name = positional.length > 0 ? String(positional[0]).trim() : "";

  if (!name) {
    throw new McpCliError(
      "user_error",
      "frootai mcp attach requires an area name",
      { hint: "Usage: frootai mcp attach <name> [--trust-override]" },
    );
  }
  // Reserve dotted / spaced names \u2014 mirrors Doctrine #5 (no dots in
  // attached area names; per-tool `<area>.<tool>` namespace is built FROM
  // the area name, so dots in the name itself would break collision audit).
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new McpCliError(
      "user_error",
      `invalid area name "${name}"`,
      { hint: "Allowed: letters, digits, underscore, hyphen (no dots or spaces)." },
    );
  }

  const trust = resolveTier1Trust(name);
  const needsPrompt = PROMPT_TRUST_TIERS.has(trust) && !a["trust-override"];
  const colorOpts = { color: !a["no-color"] };

  if (needsPrompt) {
    const prompt = trust === "unknown"
      ? `Area "${name}" is NOT in the Tier-1 trust map (treat as community/unknown). Add to pre-attach roster anyway?`
      : `Area "${name}" resolves to trust tier "${trust}". Add to pre-attach roster anyway?`;
    const ok = await confirm(prompt);
    if (!ok) {
      throw new McpCliError(
        "user_error",
        `attach refused at trust prompt for "${name}"`,
        { hint: "Re-run with --trust-override to skip the prompt." },
      );
    }
  }

  const state = readState(d);
  const { next, added } = insertName(state.preAttach || [], name);
  const newState = {
    ...state,
    preAttach: next,
  };
  let writtenPath = null;
  if (added) {
    writtenPath = writeState(newState, d);
  }

  const payload = {
    name,
    added,
    alreadyAttached: !added,
    trust,
    trustOverride: Boolean(a["trust-override"]),
    preAttachCount: next.length,
    statePath: writtenPath,
  };

  if (a.json) {
    const json = JSON.stringify(payload);
    log(json);
    return { exitCode: 0, output: json };
  }

  const headline = added
    ? status("ok", `attached "${name}" (trust: ${trust})`, colorOpts)
    : status("info", `"${name}" was already in the pre-attach roster (trust: ${trust})`, colorOpts);
  const lines = [
    "",
    headline,
    color("dim", `  Roster now: ${next.length} area${next.length === 1 ? "" : "s"} (${next.join(", ")})`, colorOpts),
    color("dim", `  State file: ${writtenPath || "(unchanged)"}`, colorOpts),
    "",
  ];
  if (a["trust-override"]) {
    lines.splice(2, 0, color("dim", "  --trust-override: trust prompt skipped.", colorOpts));
  }
  const out = lines.join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

module.exports = {
  execAttach,
  insertName,
  PROMPT_TRUST_TIERS,
  TIER_1_AREA_TRUST,
};
