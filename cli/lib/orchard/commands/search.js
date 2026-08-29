// @ts-check
/**
 * A4.2 — `frootai orchard search <query> [--variety azure] [--limit 50] [--json]`
 *
 * Reuses the A3.26 scoreEntry algorithm so CLI search ranking MATCHES website
 * search ranking on the same entry set. Tested for byte-equal result order.
 */
"use strict";

const { fetchIndexBundle } = require("../cdn");
const { scoreEntry, tokenizeQuery } = require("../score-entry");
const { renderTable, status, color } = require("../output");
const { OrchardCliError } = require("../cli-error");
const { VARIETY_ENUM } = require("../types");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function _parseLimit(raw) {
  if (raw === undefined || raw === true) return DEFAULT_LIMIT;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

/**
 * Pure: score + filter + sort. Tested for byte-equal output vs A3.26 web version.
 */
function searchEntries(entries, query, opts) {
  if (!Array.isArray(entries)) return [];
  const o = opts || {};
  const tokens = tokenizeQuery(query);
  let pool = entries;
  if (o.variety) pool = pool.filter((e) => e.variety === o.variety);
  if (tokens.length === 0) return pool.slice(0, o.limit || DEFAULT_LIMIT);
  return pool
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, o.limit || DEFAULT_LIMIT)
    .map((r) => r.entry);
}

async function execSearch(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));

  const query = (args._ && args._[0]) || "";
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    throw new OrchardCliError("invalid_input",
      "search requires a query: frootai orchard search <query>",
      { hint: "frootai orchard search rag" });
  }
  if (args.variety !== undefined && args.variety !== true) {
    if (!VARIETY_ENUM.includes(args.variety)) {
      throw new OrchardCliError("invalid_variety",
        `--variety "${args.variety}" not in enum [${VARIETY_ENUM.join(", ")}]`,
        { received: args.variety });
    }
  }

  const fetchIndex = d.fetchIndex || fetchIndexBundle;
  const index = await fetchIndex();
  const results = searchEntries(index.entries, query, {
    variety: args.variety,
    limit: _parseLimit(args.limit),
  });

  if (args.json) {
    const out = JSON.stringify(results, null, 2);
    log(out);
    return { exitCode: 0, output: out };
  }

  if (results.length === 0) {
    const msg = status("info", `No results for "${query}". Try fewer or different terms.`);
    log(msg);
    return { exitCode: 0, output: msg };
  }

  const lines = [];
  lines.push(status("ok", `${results.length} result${results.length === 1 ? "" : "s"} for "${query}"`));
  lines.push("");
  lines.push(renderTable(
    results,
    [
      { key: "variety", label: "VARIETY", width: 8 },
      { key: "name", label: "NAME", width: 38 },
      { key: "tagline", label: "TAGLINE", width: 48 },
    ],
  ));
  lines.push("");
  lines.push(color("dim", `  Use ${color("cyan", "frootai orchard show <slug>")} ${color("dim", "for detail.")}`));

  const out = lines.join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

module.exports = { execSearch, searchEntries, DEFAULT_LIMIT, MAX_LIMIT };
