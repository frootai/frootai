// @ts-check
/**
 * FAI VS Code — federated MCP marketplace-tree pure model (M5.11 ship).
 *
 * Deterministic transformation from `{entries}` state (from
 * `client.discover()`) into the `tier → server` node tree the
 * `FederatedMcpMarketplaceProvider` renders. Pure — no vscode imports
 * — so the unit test can drive every branch without VS Code.
 *
 * Node shape:
 *   { kind: "empty",  id: "empty",       label, description? }
 *   { kind: "tier",   id: "tier:<T1|T2|T3>", label, description, tier, serverCount }
 *   { kind: "server", id: "server:<slug>",    label, description,
 *     slug, owner, name, desc, trust, tier, installs }
 *
 * Tier resolution:
 *   - `first-party-ms`                              → "T1"
 *   - `verified-publisher`                          → "T2"
 *   - `community` / `unknown` / anything else / "" → "T3"
 *
 * Ordering doctrine:
 *   - Tier groups always rendered T1 → T2 → T3 (curated > verified > community).
 *   - Tier groups with 0 servers are HIDDEN (no empty tier headings).
 *   - Servers within a tier sorted by installs DESCENDING (popular first),
 *     with name as the deterministic tie-break for entries that share an
 *     install count (or have no install count at all).
 */
"use strict";

/** @type {readonly ["T1", "T2", "T3"]} */
const TIER_ORDER = Object.freeze(["T1", "T2", "T3"]);
const TIER_LABELS = Object.freeze({
  T1: "T1 — First-party Microsoft",
  T2: "T2 — Verified publishers",
  T3: "T3 — Community",
});

/**
 * @typedef {object} MarketplaceEntry
 * @property {string} slug        Area / package slug (used as ID).
 * @property {string} [name]      Display name; falls back to slug.
 * @property {string} [owner]     Publisher.
 * @property {string} [desc]      One-line description.
 * @property {string} [trust]     Resolved trust tier (sets the bucket).
 * @property {number} [installs]  Parsed install count.
 *
 * @typedef {object} MarketplaceTreeState
 * @property {MarketplaceEntry[]} [entries]
 *
 * @typedef {{ kind: "empty",  id: string, label: string, description?: string } |
 *           { kind: "tier",   id: string, label: string, description: string,
 *             tier: "T1" | "T2" | "T3", serverCount: number } |
 *           { kind: "server", id: string, label: string, description: string,
 *             slug: string, owner: string | null, name: string,
 *             desc: string | null, trust: string, tier: "T1" | "T2" | "T3",
 *             installs: number }} TreeNode
 */

/**
 * Resolve the curated tier bucket from a raw trust string. Pure.
 *
 * @param {string | undefined | null} trust
 * @returns {"T1" | "T2" | "T3"}
 */
function resolveTierFromTrust(trust) {
  if (typeof trust !== "string") return "T3";
  const lower = trust.toLowerCase();
  if (lower === "first-party-ms") return "T1";
  if (lower === "verified-publisher") return "T2";
  return "T3";
}

/**
 * Group + count entries per tier. Pure.
 *
 * @param {MarketplaceEntry[]} entries
 * @returns {Map<"T1" | "T2" | "T3", MarketplaceEntry[]>}
 */
function _groupByTier(entries) {
  /** @type {Map<"T1" | "T2" | "T3", MarketplaceEntry[]>} */
  const map = new Map();
  for (const tier of TIER_ORDER) map.set(tier, []);
  const seen = new Set();
  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    if (typeof e.slug !== "string" || e.slug.length === 0) continue;
    if (seen.has(e.slug)) continue;
    seen.add(e.slug);
    const tier = resolveTierFromTrust(e.trust);
    map.get(tier)?.push(e);
  }
  return map;
}

/**
 * Build the top-level tier nodes from the current state. Empty tiers
 * are HIDDEN (no zero-row group headings).
 *
 * @param {MarketplaceTreeState | null | undefined} state
 * @returns {TreeNode[]}
 */
function buildMarketplaceTreeRoot(state) {
  const entries = (state && Array.isArray(state.entries)) ? state.entries : [];
  if (entries.length === 0) {
    return [{
      kind: "empty",
      id: "empty",
      label: "Marketplace catalog is empty",
      description: "Run \"FrootAI: Federation — Discover MCP Marketplace\" to refresh.",
    }];
  }
  const grouped = _groupByTier(entries);
  /** @type {TreeNode[]} */
  const nodes = [];
  for (const tier of TIER_ORDER) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const bucket = grouped.get(tier);
    if (!bucket || bucket.length === 0) continue;
    nodes.push({
      kind: "tier",
      id: `tier:${tier}`,
      label: TIER_LABELS[tier],
      description: `${bucket.length} server${bucket.length === 1 ? "" : "s"}`,
      tier,
      serverCount: bucket.length,
    });
  }
  return nodes;
}

/**
 * Build the server-leaf nodes for a single tier. Servers sorted by
 * installs descending, name ascending as deterministic tie-break.
 *
 * @param {"T1" | "T2" | "T3"} tier
 * @param {MarketplaceTreeState | null | undefined} state
 * @returns {TreeNode[]}
 */
function buildMarketplaceTreeChildren(tier, state) {
  if (tier !== "T1" && tier !== "T2" && tier !== "T3") return [];
  const entries = (state && Array.isArray(state.entries)) ? state.entries : [];
  if (entries.length === 0) return [];
  const grouped = _groupByTier(entries);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const bucket = grouped.get(tier);
  if (!bucket || bucket.length === 0) return [];
  const sorted = bucket.slice().sort((a, b) => {
    const ai = typeof a.installs === "number" ? a.installs : 0;
    const bi = typeof b.installs === "number" ? b.installs : 0;
    if (ai !== bi) return bi - ai;  // installs DESC
    const an = String(a.name || a.slug);
    const bn = String(b.name || b.slug);
    return an.localeCompare(bn);
  });
  /** @type {TreeNode[]} */
  const nodes = [];
  for (const e of sorted) {
    const installs = typeof e.installs === "number" && e.installs >= 0 ? e.installs : 0;
    const name = typeof e.name === "string" && e.name.length > 0 ? e.name : e.slug;
    const owner = typeof e.owner === "string" && e.owner.length > 0 ? e.owner : null;
    const desc = typeof e.desc === "string" && e.desc.length > 0 ? e.desc : null;
    const trust = typeof e.trust === "string" && e.trust.length > 0 ? e.trust : "unknown";
    const descParts = [];
    if (owner) descParts.push(owner);
    if (installs > 0) descParts.push(`${_formatInstalls(installs)} installs`);
    descParts.push(`[${trust}]`);
    nodes.push({
      kind: "server",
      id: `server:${e.slug}`,
      label: name,
      description: descParts.join(" • "),
      slug: e.slug,
      owner,
      name,
      desc,
      trust,
      tier,
      installs,
    });
  }
  return nodes;
}

/**
 * Render install counts with thousands separators. Pure.
 *
 * @param {number} n
 * @returns {string}
 */
function _formatInstalls(n) {
  if (!Number.isFinite(n) || n < 0) return "0";
  return Math.floor(n).toLocaleString("en-US");
}

/**
 * Build the marketplace web URL for a server slug. Pure.
 * Mirrors `MARKETPLACE_URL_BASE` from `frootai-core/cli/lib/mcp/commands/discover.js`.
 *
 * @param {string} slug
 * @returns {string}
 */
function buildMarketplaceUrl(slug) {
  const safe = encodeURIComponent(String(slug || ""));
  return `https://frootai.dev/ecosystem/mcp/marketplace/${safe}`;
}

module.exports = {
  TIER_ORDER,
  TIER_LABELS,
  resolveTierFromTrust,
  buildMarketplaceTreeRoot,
  buildMarketplaceTreeChildren,
  buildMarketplaceUrl,
  _formatInstalls,
  _groupByTier,
};
