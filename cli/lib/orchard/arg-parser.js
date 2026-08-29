// @ts-check
/**
 * FAI Orchard CLI — minimal arg parser (no external dep).
 *
 * Handles:
 *   - boolean flags: `--force`
 *   - value flags:   `--variety azure` OR `--variety=azure`
 *   - positional args: collected in `_`
 *   - `--` terminator: everything after is positional
 *
 * Pure function: `parseArgs(argv)` → `{ _: string[], [flag]: string|boolean }`.
 */
"use strict";

function parseArgs(argv) {
  if (!Array.isArray(argv)) return { _: [] };
  /** @type {Record<string, string|boolean>} */
  const out = {};
  /** @type {string[]} */
  const positional = [];
  let terminator = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === undefined) continue;
    if (terminator) {
      positional.push(a);
      continue;
    }
    if (a === "--") {
      terminator = true;
      continue;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
        continue;
      }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--") || next.startsWith("-")) {
        out[key] = true;
      } else {
        out[key] = next;
        i += 1;
      }
      continue;
    }
    if (a.startsWith("-") && a.length > 1) {
      // Short flag: -v → boolean
      const key = a.slice(1);
      out[key] = true;
      continue;
    }
    positional.push(a);
  }
  out._ = positional;
  return out;
}

module.exports = { parseArgs };
