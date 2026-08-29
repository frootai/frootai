// @ts-check
/**
 * A4.1 — `frootai orchard list [--variety azure] [--ripeness Mature] [--category rag] [--limit 50] [--json]`
 *
 * Reads slim index from CDN (build-time-cached at ~/.frootai/cache/), applies filters,
 * renders a column-aligned table. Free, no sign-in, no network on cache hit.
 */
"use strict";

const { fetchIndexBundle } = require("../cdn");
const { renderTable, status, color } = require("../output");
const { OrchardCliError } = require("../cli-error");
const {
  VARIETY_ENUM, RIPENESS_ENUM, CATEGORY_ENUM,
} = require("../types");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function _parseLimit(raw) {
  if (raw === undefined || raw === true) return DEFAULT_LIMIT;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

/**
 * Pure: apply filters + sort + cap. Tested independently.
 *
 * @param {Array<object>} entries
 * @param {object} opts
 * @returns {Array<object>}
 */
function filterEntries(entries, opts) {
  if (!Array.isArray(entries)) return [];
  const o = opts || {};
  let out = entries;
  if (o.variety) out = out.filter((e) => e.variety === o.variety);
  if (o.ripeness) out = out.filter((e) => e.ripeness === o.ripeness);
  if (o.category) out = out.filter((e) => Array.isArray(e.categories) && e.categories.includes(o.category));
  // Sort: stars DESC then name ASC for stable, scannable output.
  out = out.slice().sort((a, b) => {
    const sa = Number(a.stars || 0);
    const sb = Number(b.stars || 0);
    if (sa !== sb) return sb - sa;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
  const limit = o.limit || DEFAULT_LIMIT;
  return out.slice(0, limit);
}

/**
 * Execute the `list` command.
 *
 * @param {object} args  parsed flags
 * @param {object} [deps]  injection hooks for tests
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function execList(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));

  // Validate filter values up-front so we don't fetch then fail.
  if (args.variety !== undefined && args.variety !== true) {
    if (!VARIETY_ENUM.includes(args.variety)) {
      throw new OrchardCliError("invalid_variety",
        `--variety "${args.variety}" not in enum [${VARIETY_ENUM.join(", ")}]`,
        { received: args.variety });
    }
  }
  if (args.ripeness !== undefined && args.ripeness !== true) {
    if (!RIPENESS_ENUM.includes(args.ripeness)) {
      throw new OrchardCliError("invalid_ripeness",
        `--ripeness "${args.ripeness}" not in enum [${RIPENESS_ENUM.join(", ")}]`,
        { received: args.ripeness });
    }
  }
  if (args.category !== undefined && args.category !== true) {
    if (!CATEGORY_ENUM.includes(args.category)) {
      throw new OrchardCliError("invalid_category",
        `--category "${args.category}" not in enum`,
        { received: args.category });
    }
  }

  const fetchIndex = d.fetchIndex || fetchIndexBundle;
  const index = await fetchIndex();
  const filtered = filterEntries(index.entries, {
    variety: args.variety,
    ripeness: args.ripeness,
    category: args.category,
    limit: _parseLimit(args.limit),
  });

  if (args.json) {
    const out = JSON.stringify(filtered, null, 2);
    log(out);
    return { exitCode: 0, output: out };
  }

  if (filtered.length === 0) {
    const msg = status("info", "No accelerators match the given filters.");
    log(msg);
    return { exitCode: 0, output: msg };
  }

  const lines = [];
  lines.push(status("ok", `${filtered.length} of ${index.total_count} accelerators`));
  lines.push("");
  lines.push(renderTable(
    filtered,
    [
      { key: "variety", label: "VARIETY", width: 8 },
      { key: "name", label: "NAME", width: 38 },
      { key: "ripeness", label: "RIPENESS", width: 10 },
      { key: "stars", label: "STARS", width: 8 },
      { key: "cost_band", label: "COST", width: 24 },
    ],
  ));
  lines.push("");
  lines.push(color("dim", `  Use ${color("cyan", "frootai orchard show <slug>")} ${color("dim", "for detail.")}`));

  const out = lines.join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

module.exports = { execList, filterEntries, DEFAULT_LIMIT, MAX_LIMIT };
