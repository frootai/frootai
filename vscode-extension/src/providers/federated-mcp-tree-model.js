// @ts-check
/**
 * FAI VS Code — federated MCP attached-tree pure model (M5.10 ship).
 *
 * Deterministic transformation from `{attachedAreas, toolsByArea}` state
 * into the node tree the `FederatedMcpProvider` renders. Pure (no
 * vscode imports), so unit tests can `require()` it directly and assert
 * the node shape + ordering without driving VS Code.
 *
 * Node shape (a discriminated union):
 *   { kind: "empty",   id: "empty",         label, description? }
 *   { kind: "area",    id: "area:<slug>",   label, description, areaName, toolCount, idleMinutes? }
 *   { kind: "tool",    id: "tool:<area>.<tool>", label, description, areaName, toolName }
 *   { kind: "no-tools", id: "no-tools:<area>", label, areaName }
 *
 * Ordering doctrine:
 *   - Areas sorted alphabetically by slug (deterministic, no surprise reorders).
 *   - Tools sorted alphabetically by name within each area.
 *   - Idle minutes shown in the area description ONLY when defined +
 *     >= 0 (the kernel returns null for never-active).
 *
 * Cross-row reuse: M5.16 will reuse `buildAttachedTreeRoot` to build the
 * "Federated → <area> (N)" section labels in the existing `McpToolProvider`.
 */
"use strict";

/**
 * @typedef {object} AttachedAreaEntry
 * @property {string} name
 * @property {string} [trust]
 * @property {number} [toolCount]
 * @property {number} [idleMinutes]
 * @property {string} [attachedAt]
 *
 * @typedef {object} ToolEntry
 * @property {string} name
 * @property {string} [description]
 *
 * @typedef {object} AttachedTreeState
 * @property {AttachedAreaEntry[]} [attachedAreas]
 * @property {Record<string, ToolEntry[]>} [toolsByArea]
 *
 * @typedef {{ kind: "empty",    id: string, label: string, description?: string } |
 *           { kind: "area",     id: string, label: string, description: string,
 *             areaName: string, toolCount: number, idleMinutes: number | null, trust: string | null } |
 *           { kind: "tool",     id: string, label: string, description?: string,
 *             areaName: string, toolName: string } |
 *           { kind: "no-tools", id: string, label: string, areaName: string }} TreeNode
 */

/**
 * Build the top-level area nodes from the current state.
 *
 * @param {AttachedTreeState | null | undefined} state
 * @returns {TreeNode[]}
 */
function buildAttachedTreeRoot(state) {
  const areas = (state && Array.isArray(state.attachedAreas)) ? state.attachedAreas : [];
  if (areas.length === 0) {
    return [{
      kind: "empty",
      id: "empty",
      label: "No federated areas attached",
      description: "Run \"FrootAI: Federation — Attach MCP Area\" to add one.",
    }];
  }
  /** @type {TreeNode[]} */
  const nodes = [];
  const seen = new Set();
  // Sort areas alphabetically — drop any without a valid name to avoid
  // crashes downstream from kernel responses with partial shapes.
  const sorted = areas
    .filter((a) => a && typeof a.name === "string" && a.name.length > 0)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const area of sorted) {
    if (seen.has(area.name)) continue;
    seen.add(area.name);
    const toolCount = typeof area.toolCount === "number" && area.toolCount >= 0
      ? area.toolCount
      : 0;
    const idleMinutes = typeof area.idleMinutes === "number" && area.idleMinutes >= 0
      ? area.idleMinutes
      : null;
    const trust = typeof area.trust === "string" && area.trust.length > 0
      ? area.trust
      : null;
    const descParts = [`${toolCount} tool${toolCount === 1 ? "" : "s"}`];
    if (idleMinutes !== null) descParts.push(`idle ${idleMinutes}m`);
    if (trust !== null) descParts.push(`[${trust}]`);
    nodes.push({
      kind: "area",
      id: `area:${area.name}`,
      label: area.name,
      description: descParts.join(" • "),
      areaName: area.name,
      toolCount,
      idleMinutes,
      trust,
    });
  }
  return nodes;
}

/**
 * Build the tool-leaf nodes for a single area. Returns a `no-tools`
 * placeholder when the area has no tools mapped.
 *
 * @param {string} areaName
 * @param {AttachedTreeState | null | undefined} state
 * @returns {TreeNode[]}
 */
function buildAttachedTreeChildren(areaName, state) {
  if (typeof areaName !== "string" || areaName.length === 0) return [];
  const map = (state && state.toolsByArea && typeof state.toolsByArea === "object")
    ? state.toolsByArea : {};
  const tools = Array.isArray(map[areaName]) ? map[areaName] : [];
  if (tools.length === 0) {
    return [{
      kind: "no-tools",
      id: `no-tools:${areaName}`,
      label: "(no tools — area may still be initialising)",
      areaName,
    }];
  }
  /** @type {TreeNode[]} */
  const nodes = [];
  const seen = new Set();
  const sorted = tools
    .filter((t) => t && typeof t.name === "string" && t.name.length > 0)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const tool of sorted) {
    if (seen.has(tool.name)) continue;
    seen.add(tool.name);
    nodes.push({
      kind: "tool",
      id: `tool:${areaName}.${tool.name}`,
      label: tool.name,
      description: typeof tool.description === "string" ? tool.description : undefined,
      areaName,
      toolName: tool.name,
    });
  }
  return nodes;
}

/**
 * Format a `<area>.<tool>` invocation string. Pure helper used by the
 * TreeItem mapper + the M5.16 invoke command. Mirrors the M4.12
 * Doctrine #5 namespace shape.
 *
 * @param {string} areaName
 * @param {string} toolName
 * @returns {string}
 */
function formatToolInvocation(areaName, toolName) {
  return `${areaName}.${toolName}`;
}

module.exports = {
  buildAttachedTreeRoot,
  buildAttachedTreeChildren,
  formatToolInvocation,
};
