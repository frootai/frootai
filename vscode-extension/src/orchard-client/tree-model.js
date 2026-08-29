// @ts-check
/**
 * A5.20 — Pure data model for the Orchard tree view.
 *
 * The VSCode TreeDataProvider is a thin wrapper around this module:
 *   - `buildRootNodes(authSnapshot)`         → root-level array
 *   - `buildVarietyChildren(client, variety)`→ async lazy load for a variety
 *   - `buildBushelChildren(client)`          → async lazy load for the bushel
 *
 * Every function returns plain data (kind + id + label + meta) so the
 * provider can map kind→TreeItem without ever embedding business logic in
 * the vscode layer. This module is testable in pure Node without spinning
 * up a vscode runtime.
 *
 * Doctrine:
 *   - NEVER throws. Network/IO failures collapse to a single "error" node
 *     in the tree so the UI never goes blank.
 *   - All variety listings are capped at MAX_FRUITS_PER_VARIETY to keep the
 *     tree responsive (the user can search for more via the existing
 *     search command).
 *   - Sort: fruits are sorted by ripeness rank (Mature → Bearing → Sapling →
 *     Seedling), then by name ASC. So the most-production-ready land first.
 */
"use strict";

const VARIETY_ENUM = Object.freeze(["azure", "gcp", "aws", "oss", "hybrid"]);

const VARIETY_LABELS = Object.freeze({
  azure: "Azure",
  gcp: "Google Cloud",
  aws: "AWS",
  oss: "Open-Source / OSS",
  hybrid: "Hybrid",
});

const RIPENESS_RANK = Object.freeze({
  Mature: 0,
  Bearing: 1,
  Sapling: 2,
  Seedling: 3,
});

const MAX_FRUITS_PER_VARIETY = 50;
const MAX_BUSHEL_ITEMS = 100;

// ---------------------------------------------------------------------------
// Node kinds — the data shape the provider maps to TreeItems
// ---------------------------------------------------------------------------

const NODE_KIND = Object.freeze({
  AUTH_BADGE: "auth-badge",
  VARIETY: "variety",
  BUSHEL: "bushel",
  FRUIT: "fruit",
  BUSHEL_ITEM: "bushel-item",
  EMPTY: "empty",
  ERROR: "error",
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Pure: sort fruits by ripeness rank DESC (most-mature first), then name ASC.
 *
 * @param {Array<object>} fruits
 * @returns {Array<object>}
 */
function sortFruits(fruits) {
  if (!Array.isArray(fruits)) return [];
  const arr = fruits.slice();
  arr.sort((a, b) => {
    const ra = RIPENESS_RANK[a && a.ripeness] ?? 99;
    const rb = RIPENESS_RANK[b && b.ripeness] ?? 99;
    if (ra !== rb) return ra - rb;
    const na = (a && a.name) || (a && a.id) || "";
    const nb = (b && b.name) || (b && b.id) || "";
    return String(na).localeCompare(String(nb));
  });
  return arr;
}

/**
 * Pure: derive the tier-class label for a fruit (free / paid).
 * "paid" means the user needs the upgrade-to-play entitlement to USE this
 * fruit's `--upgrade-to-play` install path (not to view it).
 *
 * @param {object} fruit
 * @returns {"free"|"paid"}
 */
function fruitTierClass(fruit) {
  if (!fruit || typeof fruit !== "object") return "free";
  // Heuristic: fruits with a `play_recipe` link OR explicitly marked
  // `requires_upgrade_to_play: true` are paid for the layered install path.
  // The base fruit (just clone) is always free.
  if (Array.isArray(fruit.pollinations) && fruit.pollinations.length > 0) return "paid";
  if (fruit.requires_upgrade_to_play === true) return "paid";
  return "free";
}

/**
 * Pure: count how many fruits in an array fall into each variety.
 *
 * @param {Array<object>} fruits
 * @returns {Record<string, number>}
 */
function countByVariety(fruits) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const v of VARIETY_ENUM) out[v] = 0;
  if (!Array.isArray(fruits)) return out;
  for (const f of fruits) {
    if (f && typeof f.variety === "string" && Object.prototype.hasOwnProperty.call(out, f.variety)) {
      out[f.variety] += 1;
    }
  }
  return out;
}

/**
 * Pure: turn a fruit into the FRUIT-kind node.
 *
 * @param {object} fruit
 * @returns {object}
 */
function fruitToNode(fruit) {
  const tierClass = fruitTierClass(fruit);
  return {
    kind: NODE_KIND.FRUIT,
    id: (fruit && (fruit.slug || fruit.id)) || "(unknown)",
    label: (fruit && (fruit.name || fruit.id)) || "(unknown)",
    description: (fruit && fruit.ripeness) || "",
    tier_class: tierClass,
    variety: (fruit && fruit.variety) || null,
    fruit,
    contextValue: `frootai.orchard.fruit.${tierClass}`,
  };
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Pure: build the root-level nodes of the tree view.
 *
 * @param {object} [authSnapshot]  from shared-auth.readAuthSnapshot
 * @returns {Array<object>}
 */
function buildRootNodes(authSnapshot) {
  /** @type {Array<object>} */
  const nodes = [];
  // Always show the auth badge at top — it's the user's window into "am I
  // signed in?" without leaving the tree view.
  nodes.push({
    kind: NODE_KIND.AUTH_BADGE,
    id: "auth-badge",
    label: _authBadgeLabel(authSnapshot),
    snapshot: authSnapshot || null,
    contextValue: authSnapshot && authSnapshot.signed_in
      ? "frootai.orchard.auth.signed_in"
      : "frootai.orchard.auth.anonymous",
  });
  // 5 variety nodes — collapsed by default, populated lazily.
  for (const v of VARIETY_ENUM) {
    nodes.push({
      kind: NODE_KIND.VARIETY,
      id: `variety:${v}`,
      label: VARIETY_LABELS[v] || v,
      variety: v,
      contextValue: "frootai.orchard.variety",
    });
  }
  // Bushel section at the bottom.
  nodes.push({
    kind: NODE_KIND.BUSHEL,
    id: "bushel",
    label: "My Bushel",
    contextValue: "frootai.orchard.bushel",
  });
  return nodes;
}

function _authBadgeLabel(snapshot) {
  if (!snapshot || snapshot.anonymous) return "Anonymous — sign in for paid features";
  if (snapshot.expired) return `${snapshot.email || snapshot.subject || "Signed in"} (token expired)`;
  const who = snapshot.email || snapshot.subject || "Signed in";
  return `${who} · ${snapshot.tier || "free"}`;
}

/**
 * Lazy load: get the FRUIT-kind children for a single variety.
 *
 * @param {object} client  OrchardClient instance from buildOrchardClient
 * @param {string} variety
 * @returns {Promise<Array<object>>}
 */
async function buildVarietyChildren(client, variety) {
  if (!client || typeof client.list !== "function") {
    return [_errorNode("orchard-client missing", "variety", variety)];
  }
  if (!VARIETY_ENUM.includes(variety)) {
    return [_errorNode(`unknown variety: ${variety}`, "variety", variety)];
  }
  let result;
  try {
    result = await client.list(variety);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return [_errorNode(`list failed: ${msg}`, "variety", variety)];
  }
  if (!result || !result.ok) {
    return [_errorNode(`list failed (exit ${result && result.exitCode})`, "variety", variety)];
  }
  const fruits = _extractFruitsArray(result.parsed);
  if (fruits.length === 0) {
    return [_emptyNode(`No ${variety} accelerators found`, "variety", variety)];
  }
  return sortFruits(fruits).slice(0, MAX_FRUITS_PER_VARIETY).map(fruitToNode);
}

/**
 * Lazy load: get the BUSHEL_ITEM-kind children for the bushel.
 *
 * @param {object} client
 * @returns {Promise<Array<object>>}
 */
async function buildBushelChildren(client) {
  if (!client || typeof client.bushelList !== "function") {
    return [_errorNode("orchard-client missing", "bushel", null)];
  }
  let result;
  try {
    result = await client.bushelList();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return [_errorNode(`bushel list failed: ${msg}`, "bushel", null)];
  }
  if (!result || !result.ok) {
    return [_errorNode(`bushel list failed (exit ${result && result.exitCode})`, "bushel", null)];
  }
  const ids = _extractBushelIds(result.parsed);
  if (ids.length === 0) {
    return [_emptyNode("Bushel is empty — add a fruit from the tree above.", "bushel", null)];
  }
  return ids.slice(0, MAX_BUSHEL_ITEMS).map((id) => ({
    kind: NODE_KIND.BUSHEL_ITEM,
    id: `bushel-item:${id}`,
    label: id,
    contextValue: "frootai.orchard.bushel.item",
  }));
}

// ---------------------------------------------------------------------------
// Internal — defensive shape extractors. The CLI may evolve its output
// shapes; these helpers keep the tree robust to those changes.
// ---------------------------------------------------------------------------

function _extractFruitsArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.fruits)) return parsed.fruits;
    if (Array.isArray(parsed.results)) return parsed.results;
    if (Array.isArray(parsed.items)) return parsed.items;
  }
  return [];
}

function _extractBushelIds(parsed) {
  if (!parsed || typeof parsed !== "object") return [];
  if (Array.isArray(parsed.ids)) return parsed.ids.filter((x) => typeof x === "string");
  if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
  return [];
}

function _errorNode(msg, scope, scopeKey) {
  return {
    kind: NODE_KIND.ERROR,
    id: `error:${scope}:${scopeKey || "_"}:${msg.slice(0, 40)}`,
    label: `⚠ ${msg}`,
    scope,
    scope_key: scopeKey,
    contextValue: "frootai.orchard.error",
  };
}

function _emptyNode(msg, scope, scopeKey) {
  return {
    kind: NODE_KIND.EMPTY,
    id: `empty:${scope}:${scopeKey || "_"}`,
    label: msg,
    scope,
    scope_key: scopeKey,
    contextValue: "frootai.orchard.empty",
  };
}

module.exports = {
  // Builders
  buildRootNodes,
  buildVarietyChildren,
  buildBushelChildren,
  // Pure helpers
  sortFruits,
  fruitTierClass,
  countByVariety,
  fruitToNode,
  // Constants
  VARIETY_ENUM,
  VARIETY_LABELS,
  RIPENESS_RANK,
  NODE_KIND,
  MAX_FRUITS_PER_VARIETY,
  MAX_BUSHEL_ITEMS,
};
