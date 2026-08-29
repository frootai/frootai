// @ts-check
/**
 * M5.22 — Federation keybindings (pure core).
 *
 * Row literal: keybindings: add `Ctrl+Shift+F12` / `Cmd+Shift+F12` →
 * `frootai.federation.discoverMcp`.
 *
 * Pure: zero `vscode` imports + zero IO. Hosts the canonical
 * keybinding-contribution shape + a validator the gate uses to drift-
 * detect the package.json declaration.
 *
 * Decisions:
 *   - The chord is pinned per-platform: `ctrl+shift+f12` on Win/Linux,
 *     `cmd+shift+f12` on Mac. This matches the existing F9 / F10 / F11
 *     keybindings the extension already ships (they all use `ctrl` on
 *     Win/Linux + `cmd` on Mac for the same gesture). Operators muscle-
 *     memorise the F-row + ctrl/cmd combo as the FrootAI surface.
 *   - F12 was chosen over F11+1 / F8 / etc. because the existing
 *     contributions stop at F11 and the F-row + 1 step is the obvious
 *     next slot in a numbered series; gate case 9 statically asserts
 *     the F9..F12 contiguity to catch a future ship that breaks the
 *     pattern.
 *   - No `when` clause is set — `frootai.federation.discoverMcp`
 *     opens the federation explorer anywhere; gating it on a tree-
 *     view focus would surprise operators who hit F12 from the
 *     editor expecting the same behaviour as F9/F10/F11 (which also
 *     have no `when`).
 */
"use strict";

/** Row-literal command target. NEVER paraphrase. */
const DISCOVER_MCP_COMMAND = "frootai.federation.discoverMcp";

/** Row-literal chords. */
const DISCOVER_MCP_KEY = "ctrl+shift+f12";
const DISCOVER_MCP_KEY_MAC = "cmd+shift+f12";

/**
 * @typedef {object} KeybindingEntry
 * @property {string} command
 * @property {string} key      Win/Linux chord
 * @property {string} mac      Mac chord
 * @property {string} [when]   Optional context guard
 */

/**
 * Pure: build the M5.22 keybinding entry shape.
 *
 * @returns {Readonly<KeybindingEntry>}
 */
function buildDiscoverMcpKeybinding() {
  return Object.freeze({
    command: DISCOVER_MCP_COMMAND,
    key: DISCOVER_MCP_KEY,
    mac: DISCOVER_MCP_KEY_MAC,
  });
}

/**
 * Pure: check that a package.json `keybindings` array contains the
 * M5.22 keybinding with the EXACT row-literal command + chord shape.
 * Used by the gate to detect drift / typo / missing contribution.
 *
 * @param {Array<{command?: string, key?: string, mac?: string}> | null | undefined} declared
 * @returns {{ ok: boolean, present: boolean, keyMatches: boolean, macMatches: boolean }}
 */
function checkDiscoverMcpKeybinding(declared) {
  const arr = Array.isArray(declared) ? declared : [];
  const entry = arr.find((k) => k && k.command === DISCOVER_MCP_COMMAND);
  if (!entry) {
    return { ok: false, present: false, keyMatches: false, macMatches: false };
  }
  const keyMatches = entry.key === DISCOVER_MCP_KEY;
  const macMatches = entry.mac === DISCOVER_MCP_KEY_MAC;
  return {
    ok: keyMatches && macMatches,
    present: true,
    keyMatches,
    macMatches,
  };
}

/**
 * Pure: validate the F-row + ctrl/cmd contiguity invariant for the
 * existing federation surface — F9..F12 must each map to a registered
 * `frootai.*` command on both Win/Linux + Mac. Returns the per-Fn
 * status so the gate can report exactly which slot is missing.
 *
 * @param {Array<{command?: string, key?: string, mac?: string}> | null | undefined} declared
 * @returns {{ ok: boolean, byFn: Record<string, { command?: string, keyMatches: boolean, macMatches: boolean }> }}
 */
function checkFRowContiguity(declared) {
  const arr = Array.isArray(declared) ? declared : [];
  /** @type {Record<string, {command?: string, keyMatches: boolean, macMatches: boolean}>} */
  const byFn = {};
  for (const fn of [9, 10, 11, 12]) {
    const k = `ctrl+shift+f${fn}`;
    const m = `cmd+shift+f${fn}`;
    const entry = arr.find((e) => e && e.key === k);
    if (entry) {
      byFn[`f${fn}`] = {
        command: entry.command,
        keyMatches: entry.key === k,
        macMatches: entry.mac === m,
      };
    } else {
      byFn[`f${fn}`] = { keyMatches: false, macMatches: false };
    }
  }
  const ok = Object.values(byFn).every((v) => v.keyMatches && v.macMatches);
  return { ok, byFn };
}

module.exports = {
  DISCOVER_MCP_COMMAND,
  DISCOVER_MCP_KEY,
  DISCOVER_MCP_KEY_MAC,
  buildDiscoverMcpKeybinding,
  checkDiscoverMcpKeybinding,
  checkFRowContiguity,
};
