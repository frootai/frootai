// @ts-check
/**
 * FAI VS Code — built-in MCP tool tree pure-core (M5.16 ship).
 *
 * Splits the section-label + grouping logic out of `McpToolProvider.ts`
 * so the M5.16 federation extension ("Built-in (N)" + "Federated →
 * <Area> (N)" siblings at root) is unit-testable without `vscode`.
 *
 * Root layout produced by `buildRootSections`:
 *
 *   [0] { kind: "builtin",   id: "builtin",            label: "Built-in (N)",
 *         description: "Bundled FrootAI MCP tools",    toolCount: N }
 *   [1..] { kind: "federated", id: "federated:<area>", label: "Federated → <Area> (M)",
 *         description: "Tools from the attached <area> kernel area",
 *         areaName: "<area>",                          toolCount: M }
 *
 * Federated sections are sorted alphabetically by area slug (matches
 * M5.10 FederatedMcpProvider ordering doctrine — areas never reorder
 * surprisingly across refreshes). When no areas are attached, only the
 * built-in section is returned; the dedicated `FederatedMcpProvider`
 * tree is the canonical place for the "no federated areas" state.
 *
 * The `tools` argument is whatever array shape `MCP_TOOLS` exposes in
 * `data/tools.ts` (objects with `name` + `type`); the pure-core only
 * needs `.type` for the per-group counts and `.length` for the header.
 */
"use strict";

/**
 * @typedef {object} BuiltinToolEntry
 * @property {string} name
 * @property {string} type
 *
 * @typedef {object} BuiltinGroup
 * @property {string} label    // template label with placeholder count e.g. "Knowledge (6)"
 * @property {string} type     // matches BuiltinToolEntry.type
 * @property {string} icon     // VS Code ThemeIcon id
 * @property {string} desc
 *
 * @typedef {object} AttachedAreaInput
 * @property {string} name
 * @property {number} [toolCount]
 *
 * @typedef {{ kind: "builtin",   id: string, label: string, description: string,
 *             toolCount: number } |
 *           { kind: "federated", id: string, label: string, description: string,
 *             areaName: string, toolCount: number }} RootSection
 */

/**
 * Canonical built-in group definitions. The `label` fields carry a
 * template placeholder count `(N)` for backwards-compat with the
 * pre-M5.16 surface; the real count is substituted via
 * {@link buildBuiltinGroupCounts}.
 *
 * @type {ReadonlyArray<BuiltinGroup>}
 */
const BUILTIN_GROUPS = Object.freeze([
  { label: "Knowledge (6)",   type: "static",      icon: "database",      desc: "Offline knowledge lookups" },
  { label: "Live (4)",        type: "live",        icon: "cloud",         desc: "Azure + GitHub API calls" },
  { label: "Agent Chain (3)", type: "chain",       icon: "link",          desc: "Build → Review → Tune workflow" },
  { label: "Ecosystem (3)",   type: "ecosystem",   icon: "graph-scatter", desc: "Model catalog, pricing, compare" },
  { label: "Compute (10)",    type: "compute",     icon: "symbol-ruler",  desc: "Search, cost, eval, diagrams, embeddings" },
  { label: "Engine (6)",      type: "engine",      icon: "zap",           desc: "FAI Engine bridge tools" },
  { label: "Scaffold (3)",    type: "scaffold",    icon: "new-file",      desc: "Play + primitive scaffolding" },
  { label: "Marketplace (13)", type: "marketplace", icon: "extensions",   desc: "Plugin install, compose, publish" },
]);

/** @type {Readonly<Record<string, string>>} */
const TYPE_ICONS = Object.freeze({
  static: "book",
  live: "cloud-upload",
  chain: "debug-disconnect",
  ecosystem: "graph-scatter",
  compute: "symbol-ruler",
  engine: "zap",
  scaffold: "new-file",
  marketplace: "extensions",
});

const READ_ONLY_TYPES = Object.freeze(new Set(["static", "live", "ecosystem"]));

const BUILTIN_HEADER_ID = "builtin";
const FEDERATED_HEADER_PREFIX = "federated:";

/**
 * Capitalise a federation area slug for display.
 *
 *   "azure"     → "Azure"
 *   "ms-learn"  → "Ms-Learn"
 *   "fake_mcp"  → "Fake_Mcp"
 *   "context7"  → "Context7"
 *
 * Preserves separators (`-`, `_`) verbatim so the result round-trips
 * back to the kernel-side slug via `.toLowerCase()`. No I18N — the M4
 * area-name regex `^[a-zA-Z0-9_-]+$` (Doctrine #5) makes ASCII title-case
 * sufficient.
 *
 * @param {string} areaName
 * @returns {string}
 */
function formatAreaDisplayName(areaName) {
  if (typeof areaName !== "string" || areaName.length === 0) return "";
  return areaName.replace(/(^|[-_])([a-z0-9])/g, (_m, sep, ch) => sep + ch.toUpperCase());
}

/**
 * Format the root "Built-in (N)" header label.
 * @param {number} toolCount
 * @returns {string}
 */
function formatBuiltinHeader(toolCount) {
  const n = Number.isFinite(toolCount) && toolCount >= 0 ? Math.floor(toolCount) : 0;
  return `Built-in (${n})`;
}

/**
 * Format a "Federated → <Area> (M)" section label.
 * @param {string} areaName
 * @param {number} toolCount
 * @returns {string}
 */
function formatFederatedSectionLabel(areaName, toolCount) {
  const n = Number.isFinite(toolCount) && toolCount >= 0 ? Math.floor(toolCount) : 0;
  return `Federated \u2192 ${formatAreaDisplayName(areaName)} (${n})`;
}

/**
 * Substitute real per-group counts into the {@link BUILTIN_GROUPS}
 * template labels.
 *
 * @param {ReadonlyArray<BuiltinToolEntry>} tools
 * @returns {ReadonlyArray<{ label: string, type: string, icon: string, desc: string, count: number }>}
 */
function buildBuiltinGroupCounts(tools) {
  const safe = Array.isArray(tools) ? tools : [];
  return Object.freeze(BUILTIN_GROUPS.map((g) => {
    const count = safe.filter((t) => t && t.type === g.type).length;
    const label = g.label.replace(/\(\d+\)/, `(${count})`);
    return Object.freeze({ label, type: g.type, icon: g.icon, desc: g.desc, count });
  }));
}

/**
 * Build the root-level section list — the M5.16 row deliverable.
 *
 * The built-in section is ALWAYS first. Federated sections follow in
 * alphabetical order by area slug. Areas with missing/empty/non-string
 * names are dropped (matches the M5.10 attached-tree filter). Tool
 * count defaults to 0 when the kernel response omits or invalidates it.
 *
 * @param {object} input
 * @param {number} input.builtinToolCount
 * @param {AttachedAreaInput[] | null | undefined} input.attachedAreas
 * @returns {ReadonlyArray<RootSection>}
 */
function buildRootSections(input) {
  const builtinToolCount = (input && Number.isFinite(input.builtinToolCount) && input.builtinToolCount >= 0)
    ? Math.floor(input.builtinToolCount) : 0;
  /** @type {RootSection[]} */
  const sections = [
    {
      kind: "builtin",
      id: BUILTIN_HEADER_ID,
      label: formatBuiltinHeader(builtinToolCount),
      description: "Bundled FrootAI MCP tools",
      toolCount: builtinToolCount,
    },
  ];
  const areas = (input && Array.isArray(input.attachedAreas)) ? input.attachedAreas : [];
  const seen = new Set();
  const sorted = areas
    .filter((a) => a && typeof a.name === "string" && a.name.length > 0)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const area of sorted) {
    if (seen.has(area.name)) continue;
    seen.add(area.name);
    const tc = (typeof area.toolCount === "number" && Number.isFinite(area.toolCount) && area.toolCount >= 0)
      ? Math.floor(area.toolCount) : 0;
    sections.push({
      kind: "federated",
      id: `${FEDERATED_HEADER_PREFIX}${area.name}`,
      label: formatFederatedSectionLabel(area.name, tc),
      description: `Tools from the attached ${area.name} kernel area`,
      areaName: area.name,
      toolCount: tc,
    });
  }
  return Object.freeze(sections);
}

module.exports = {
  BUILTIN_GROUPS,
  TYPE_ICONS,
  READ_ONLY_TYPES,
  BUILTIN_HEADER_ID,
  FEDERATED_HEADER_PREFIX,
  formatAreaDisplayName,
  formatBuiltinHeader,
  formatFederatedSectionLabel,
  buildBuiltinGroupCounts,
  buildRootSections,
};
