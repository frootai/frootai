// @ts-check
/**
 * M5.17 — Orchard accelerator MCP-requires chip (pure core).
 *
 * Row literal: extend existing `OrchardTreeProvider.ts`: when an Orchard
 * accelerator's manifest declares `mcp_scope.attached`, show chip beside
 * it (`requires: azure, playwright`).
 *
 * Pure: zero `vscode` imports + zero IO. Given a fruit-shaped manifest
 * object (whatever `tree-model.js#fruitToNode` carries on `node.fruit`),
 * extracts the declared attached-area list + formats it into the chip
 * string the .ts wrapper appends to the FRUIT TreeItem's `description`
 * + tooltip.
 *
 * Manifest shape (pinned at A5.x accelerator schema):
 *   {
 *     "id": "azure-rag-quickstart",
 *     "name": "Azure RAG Quickstart",
 *     "mcp_scope": {
 *       "attached": ["azure", "playwright"]   // optional; undefined = no chip
 *     }
 *   }
 *
 * Decisions:
 *   - Only `mcp_scope.attached` drives the chip. `mcp_scope.required` /
 *     `.optional` are reserved for later rows (M5.18+) and do NOT
 *     contribute to the chip text today.
 *   - Area names are validated against the M4.5 / M5.1 area-name regex
 *     (`^[a-zA-Z0-9_-]+$`). Invalid entries are silently dropped so a
 *     malformed manifest renders the chip with the valid subset rather
 *     than disappearing entirely or crashing the tree.
 *   - Areas are deduplicated (case-sensitive — `Azure` and `azure` are
 *     different slugs by Doctrine #5) and sorted alphabetically for
 *     refresh-stability — operators see the same chip text after every
 *     refresh regardless of manifest array order.
 *   - When the resulting valid-area list is empty, returns `""` so the
 *     .ts wrapper can detect "no chip" via truthy check rather than
 *     comparing against a sentinel.
 */
"use strict";

/** Area-name regex pinned to M4.5 / M5.1 / M5.14 area-name shape. */
const AREA_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const MAX_AREA_NAME_LENGTH = 64;

/** Row-literal chip prefix. Operators grep for this exact string. */
const MCP_REQUIRES_PREFIX = "requires: ";

/**
 * Pure: pull the declared attached-area list out of a fruit/manifest.
 *
 * Returns a frozen, deduplicated, sorted, validated string[]. Never
 * throws — malformed input resolves to an empty frozen array.
 *
 * @param {object | null | undefined} fruit
 * @returns {ReadonlyArray<string>}
 */
function extractMcpRequires(fruit) {
  if (!fruit || typeof fruit !== "object") return Object.freeze([]);
  const scope = /** @type {any} */ (fruit).mcp_scope;
  if (!scope || typeof scope !== "object") return Object.freeze([]);
  const raw = /** @type {any} */ (scope).attached;
  if (!Array.isArray(raw)) return Object.freeze([]);
  /** @type {string[]} */
  const seen = [];
  /** @type {Set<string>} */
  const seenSet = new Set();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_AREA_NAME_LENGTH) continue;
    if (!AREA_NAME_RE.test(trimmed)) continue;
    if (seenSet.has(trimmed)) continue;
    seenSet.add(trimmed);
    seen.push(trimmed);
  }
  seen.sort();
  return Object.freeze(seen);
}

/**
 * Pure: format the chip text per row literal `requires: azure, playwright`.
 *
 * Returns `""` when the manifest declares no valid attached areas — the
 * .ts wrapper uses the falsy-empty-string idiom to skip chip rendering.
 *
 * @param {object | null | undefined} fruit
 * @returns {string}
 */
function formatMcpRequiresChip(fruit) {
  const areas = extractMcpRequires(fruit);
  if (areas.length === 0) return "";
  return `${MCP_REQUIRES_PREFIX}${areas.join(", ")}`;
}

/**
 * Pure: compose a fruit node's existing `description` (ripeness) with
 * the M5.17 chip via " · " separator. Used by the .ts wrapper FRUIT
 * case so the join logic stays in one place.
 *
 *   ("Mature", "requires: azure")  → "Mature · requires: azure"
 *   ("Mature", "")                 → "Mature"
 *   ("",       "requires: azure")  → "requires: azure"
 *   ("",       "")                 → ""
 *
 * @param {string | null | undefined} existing
 * @param {string | null | undefined} chip
 * @returns {string}
 */
function joinDescriptionWithChip(existing, chip) {
  const a = typeof existing === "string" ? existing.trim() : "";
  const b = typeof chip === "string" ? chip.trim() : "";
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  return `${a} \u00b7 ${b}`;
}

module.exports = {
  AREA_NAME_RE,
  MAX_AREA_NAME_LENGTH,
  MCP_REQUIRES_PREFIX,
  extractMcpRequires,
  formatMcpRequiresChip,
  joinDescriptionWithChip,
};
