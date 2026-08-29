// @ts-check
/**
 * FAI MCP CLI — Tier-1 area trust map (M4.3 ship).
 *
 * Static mirror of the trust tiers declared by the M3 area descriptors in
 * `frootai-core/npm-mcp/src/federation/areas/*.ts`. Used by the CLI to
 * render the `trust` column in `frootai mcp list` (M4.3) and to gate the
 * `community`-tier confirmation prompt in `frootai mcp attach` (M4.5).
 *
 * Drift discipline: this constant is asserted byte-for-byte against the
 * shipped trust tiers in M3 by the M4.3 gate. If a Tier-1 area's trust tier
 * changes upstream, the gate fails loudly and this map updates in the same
 * ship. PIN_ONE_AHEAD: extending to Tier-2/3 areas is the marketplace
 * dynamic-roster job (Phase X3), not this map.
 */
"use strict";

const TIER_1_AREA_TRUST = Object.freeze({
  "azure": "first-party-ms",
  "playwright": "first-party-ms",
  "github": "first-party-ms",
  "markitdown": "first-party-ms",
  "context7": "verified-publisher",
  "ms-learn": "first-party-ms",
});

/**
 * Resolve the trust tier for an area name. Returns `"unknown"` for any
 * non-Tier-1 area (intentional — the CLI must render SOMETHING in the table
 * even before M4.4 discovery + M4.7 trust query land their richer resolvers).
 *
 * @param {string} name
 * @returns {string}
 */
function resolveTier1Trust(name) {
  if (typeof name !== "string") return "unknown";
  const tier = TIER_1_AREA_TRUST[name];
  return typeof tier === "string" ? tier : "unknown";
}

const TIER_1_AREA_NAMES = Object.freeze(Object.keys(TIER_1_AREA_TRUST));

module.exports = {
  TIER_1_AREA_TRUST,
  TIER_1_AREA_NAMES,
  resolveTier1Trust,
};
