// @ts-check
/**
 * FAI MCP CLI — `frootai mcp discover` (M4.4 ship).
 *
 * Reads the local marketplace cache (`~/.frootai/cache/mcp-marketplace.json`),
 * applies optional query + tier filters, sorts by `installs` descending,
 * and renders the top-N (default 20). First-run UX (cache absent) returns
 * an empty roster with a remediation hint — never errors. M4.16/M4.17 will
 * add `--refresh` + the bundled offline-first snapshot.
 *
 * Args:
 *   [query]            optional positional; case-insensitive substring
 *                      across name / slug / owner / desc.
 *   --tier T1|T2|T3    filter by curated tier (see below)
 *   --limit N          cap result rows; default 20
 *   --json             machine-readable output (entry array)
 *   --no-color         disable ANSI colour + OSC-8 hyperlinks
 *
 * Tier resolution (M4.4 baseline; X2 will replace with a manifest-driven map):
 *   T1  →  owner ∈ Tier-1 publisher set from `tier1-trust.js` (microsoft,
 *          github, upstash) → 6 M3 areas + sibling Microsoft repos
 *   T2  →  curated verified-publisher roster (intentionally empty until X2)
 *   T3  →  everything else (community / unknown)
 *
 * Output rows: `{ name, slug, owner, description, installs, tier, path, url }`
 * — `url` always points at `https://frootai.dev/ecosystem/mcp/marketplace/<slug>`.
 */
"use strict";

const { readMarketplaceCache, refreshMarketplaceCache, parseInstalls, WEEKLY_REFRESH_AGE_MS } = require("../marketplace-cache");
const { loadMarketplaceAuth } = require("../auth-token");
const { TIER_1_AREA_TRUST } = require("../tier1-trust");
const { McpCliError } = require("../cli-error");
const { color, renderTable } = require("../../orchard/output");

const VALID_TIERS = Object.freeze(["T1", "T2", "T3"]);
const DEFAULT_LIMIT = 20;
const MARKETPLACE_URL_BASE = "https://frootai.dev/ecosystem/mcp/marketplace";

// Owners that correspond to the M3 Tier-1 area set. Lower-cased for matching.
// PIN_ONE_AHEAD: this list is the minimum that covers the 6 M3 areas; X2 will
// replace with the trust-manifest-derived verified roster.
const TIER_1_OWNERS = Object.freeze(new Set(
  Object.keys(TIER_1_AREA_TRUST).reduce((acc, slug) => {
    // Map the area name → its canonical publisher owner.
    const map = {
      "azure": "microsoft",
      "playwright": "microsoft",
      "github": "github",
      "markitdown": "microsoft",
      "context7": "upstash",
      "ms-learn": "microsoft",
    };
    if (map[slug]) acc.push(map[slug].toLowerCase());
    return acc;
  }, []),
));

// Reserved for X2 verified-publisher roster — currently empty by design.
const TIER_2_OWNERS = Object.freeze(new Set());

/**
 * Resolve a marketplace entry's owner string to one of `"T1" | "T2" | "T3"`.
 * Pure; safe to call on partial entries.
 *
 * @param {string | undefined | null} owner
 * @returns {"T1" | "T2" | "T3"}
 */
function resolveTier(owner) {
  if (typeof owner !== "string") return "T3";
  const lower = owner.toLowerCase();
  if (TIER_1_OWNERS.has(lower)) return "T1";
  if (TIER_2_OWNERS.has(lower)) return "T2";
  return "T3";
}

/**
 * Filter + sort + cap. Pure — no IO.
 *
 * @param {Array<object>} entries
 * @param {object} opts
 * @param {string} [opts.query]
 * @param {"T1" | "T2" | "T3" | undefined} [opts.tier]
 * @param {number} [opts.limit]
 * @returns {Array<{ name: string, slug: string, owner: string, description: string, installs: number, tier: "T1"|"T2"|"T3", path: string, url: string }>}
 */
function buildResults(entries, opts) {
  const o = opts || {};
  const limit = Number.isFinite(o.limit) && o.limit > 0 ? Math.floor(o.limit) : DEFAULT_LIMIT;
  const queryLower = (o.query && typeof o.query === "string") ? o.query.toLowerCase().trim() : "";
  const tierFilter = (typeof o.tier === "string" && VALID_TIERS.includes(o.tier)) ? o.tier : null;

  const rows = [];
  for (const e of entries || []) {
    if (!e || typeof e !== "object") continue;
    const slug = typeof e.slug === "string" ? e.slug : "";
    if (!slug) continue;
    const owner = typeof e.owner === "string" ? e.owner : "";
    const name = typeof e.name === "string" ? e.name : slug;
    const desc = typeof e.desc === "string" ? e.desc : "";
    const tier = resolveTier(owner);

    if (tierFilter && tier !== tierFilter) continue;
    if (queryLower) {
      const blob = `${name}\n${slug}\n${owner}\n${desc}`.toLowerCase();
      if (!blob.includes(queryLower)) continue;
    }

    rows.push({
      name,
      slug,
      owner,
      description: desc,
      installs: parseInstalls(e.installs),
      tier,
      path: typeof e.path === "string" ? e.path : `/mcp/${owner}/${slug}`,
      url: `${MARKETPLACE_URL_BASE}/${slug}`,
    });
  }
  rows.sort((a, b) => {
    if (b.installs !== a.installs) return b.installs - a.installs;
    return a.name.localeCompare(b.name);
  });
  return rows.slice(0, limit);
}

/**
 * Wrap text in an OSC-8 terminal hyperlink. Falls back to bare text when
 * colour is disabled (NO_COLOR / piped output / --no-color).
 *
 * @param {string} text
 * @param {string} url
 * @param {object} [opts]
 * @returns {string}
 */
function _hyperlink(text, url, opts) {
  const enabled = !(opts && opts.color === false);
  if (!enabled) return `${text} (${url})`;
  return `\u001b]8;;${url}\u0007${text}\u001b]8;;\u0007`;
}

function _renderTextTable(rows, totalCacheSize, query, tier, opts) {
  const o = opts || {};
  if (rows.length === 0) {
    if (totalCacheSize === 0) {
      return [
        "",
        color("dim", "  Marketplace cache is empty.", o),
        color("dim", `  M4.17 will bundle an offline snapshot; M4.16 wires \`--refresh\`.`, o),
        color("dim", `  Until then, browse https://frootai.dev/ecosystem/mcp/marketplace directly.`, o),
        "",
      ].join("\n");
    }
    const why = [];
    if (query) why.push(`query "${query}"`);
    if (tier) why.push(`tier ${tier}`);
    return [
      "",
      color("dim", `  No matches for ${why.join(" + ")} (cache has ${totalCacheSize} entries).`, o),
      "",
    ].join("\n");
  }
  const tableRows = rows.map((r) => ({
    rank: "",
    name: r.name,
    owner: r.owner || "—",
    tier: r.tier,
    installs: r.installs.toLocaleString("en-US"),
    link: _hyperlink(r.slug, r.url, o),
  }));
  const header = `  Showing ${rows.length} of ${totalCacheSize} marketplace entries` +
    (query ? ` (query "${query}")` : "") +
    (tier ? ` (tier ${tier})` : "");
  return [
    "",
    color("bold", header, o),
    "",
    renderTable(tableRows, [
      { key: "name",     label: "NAME",     width: 22 },
      { key: "owner",    label: "OWNER",    width: 16 },
      { key: "tier",     label: "TIER",     width: 5 },
      { key: "installs", label: "INSTALLS", width: 12 },
      { key: "link",     label: "DETAIL",   width: 40 },
    ], o),
    "",
  ].join("\n");
}

/**
 * Dispatcher-compatible exec entry.
 *
 * @param {object} args
 * @param {object} [deps]
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function execDiscover(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const a = args || {};

  // Validate --tier early; orchard CLI convention is `user_error` → exit 1.
  let tier = null;
  if (typeof a.tier === "string" && a.tier.length > 0) {
    const upper = a.tier.toUpperCase();
    if (!VALID_TIERS.includes(upper)) {
      throw new McpCliError(
        "user_error",
        `invalid --tier "${a.tier}"`,
        { hint: `Allowed: ${VALID_TIERS.join(" | ")} (case-insensitive).` },
      );
    }
    tier = upper;
  }

  let limit = DEFAULT_LIMIT;
  if (a.limit !== undefined) {
    const parsed = Number(a.limit);
    if (!Number.isFinite(parsed) || parsed <= 0 || Math.floor(parsed) !== parsed) {
      throw new McpCliError(
        "user_error",
        `invalid --limit "${a.limit}"`,
        { hint: "Must be a positive integer." },
      );
    }
    limit = parsed;
  }

  const positional = Array.isArray(a._) ? a._ : [];
  const query = positional.length > 0 ? String(positional[0]) : (typeof a.query === "string" ? a.query : "");

  // --refresh (M4.16): fetch a fresh snapshot from the published URL
  // and write it to ~/.frootai/cache/mcp-marketplace.json BEFORE reading.
  // Network failures are graceful (warn + fall back to existing cache /
  // bundle) per the spec contract: "falls back to bundled snapshot on offline".
  // M4.27: lazy auth load for the marketplace fetch. The H8.13
  // credentials store is read ONLY when --refresh is on; the bearer
  // token is forwarded to refreshMarketplaceCache via `deps.auth` and
  // NEVER appears in the discover output (only `refresh.authPresent`
  // surfaces whether the request was authenticated).
  let refreshReport = null;
  if (a.refresh) {
    let refreshAuth = (d.auth !== undefined) ? d.auth : null;
    if (refreshAuth === null) {
      try {
        refreshAuth = await loadMarketplaceAuth({
          readCredentials: d.readCredentials,
          env: d.env,
          homedir: d.homeDir,
          now: typeof d.now === "function" ? d.now : undefined,
        });
      } catch { refreshAuth = null; }
    }
    refreshReport = await refreshMarketplaceCache({ ...d, auth: refreshAuth });
  }

  const cache = readMarketplaceCache(d);
  const stale = typeof cache.ageMs === "number" && cache.ageMs > WEEKLY_REFRESH_AGE_MS && cache.source === "cache";
  const rows = buildResults(cache.items, { query, tier, limit });
  const cacheMeta = {
    source: cache.source,
    path: cache.path,
    ageMs: cache.ageMs,
    stale,
    totalEntries: cache.total,
  };

  if (a.json) {
    const payload = {
      rows,
      cache: cacheMeta,
      ...(refreshReport ? { refresh: refreshReport } : {}),
    };
    const json = JSON.stringify(payload);
    log(json);
    return { exitCode: 0, output: json };
  }

  const colorOpts = { color: !a["no-color"] };
  const lines = [];
  if (refreshReport) {
    if (refreshReport.ok) {
      lines.push(color("dim",
        `  Refreshed marketplace cache from ${refreshReport.fetchedFrom} — ${refreshReport.totalEntries} entries.`,
        colorOpts));
    } else {
      lines.push(color("dim",
        `  --refresh failed (${refreshReport.error.code}): ${refreshReport.error.message}. Falling back to existing ${cache.source}.`,
        colorOpts));
    }
  }
  if (stale) {
    lines.push(color("dim",
      `  Cache is ${Math.floor(cache.ageMs / (24 * 60 * 60 * 1000))} days old (>7); consider \`frootai mcp discover --refresh\`.`,
      colorOpts));
  }
  lines.push(_renderTextTable(rows, cache.total, query, tier, colorOpts, cacheMeta));
  const out = lines.join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

module.exports = {
  execDiscover,
  buildResults,
  resolveTier,
  VALID_TIERS,
  DEFAULT_LIMIT,
  MARKETPLACE_URL_BASE,
  TIER_1_OWNERS,
};
