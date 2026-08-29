// @ts-check
/**
 * FAI VS Code — Federation Explorer pure-core (M5.12 ship).
 *
 * Pure deps-injected helpers that drive the React webview at
 * `webview-ui/src/panels/FederationExplorer.tsx`. Lives in `.js` (no
 * vscode / React imports) so unit tests can `require()` it directly
 * without a build step.
 *
 * Surface:
 *   - filterMarketplaceEntries({entries, query, tiers}) → sorted slice
 *   - formatIdleTimer(idleMinutes) → human display string
 *   - buildServerCard(entry, opts?) → display-ready object for a card
 *   - buildAttachedRow(area, opts?) → display-ready object for an attached pane row
 *   - validateOutboundMessage(msg) → {valid, kind, payload?} | {valid:false, reason}
 *   - validateInboundMessage(msg) → same shape, for host→webview
 *
 * Message protocol (locked by M5.12; M5.13 layers state persistence on
 * top, M5.14/M5.15 add real attach/detach routing):
 *
 *   webview → host (outbound):
 *     { type: "attach",     slug: string }
 *     { type: "detach",     name: string }
 *     { type: "viewOnWeb",  slug: string }
 *     { type: "refresh" }
 *     { type: "stateChange", search?: string, tab?: "attached"|"catalog", tiers?: ("T1"|"T2"|"T3")[] }
 *
 *   host → webview (inbound):
 *     { type: "setActiveTab", tab: "attached"|"catalog" }
 *     { type: "focusSearch" }
 *     { type: "update", marketplace?: MarketplaceEntry[], attached?: AttachedAreaEntry[] }
 *     { type: "restoreState", search?: string, tab?: "attached"|"catalog", tiers?: ("T1"|"T2"|"T3")[] }
 *
 * Reuses the M5.11 marketplace tree-model helpers so tier resolution +
 * install-formatting stays canonical across the tree provider and the
 * webview.
 */
"use strict";

const marketplaceTree = require("../providers/federated-mcp-marketplace-tree-model");

const ALL_TIERS = Object.freeze(["T1", "T2", "T3"]);
const VALID_TAB = Object.freeze(["attached", "catalog"]);

// M5.13: persisted-state shape lives under this key inside
// `extensionContext.workspaceState`. Bumping the version field inside
// the stored value (NOT the key) is the migration path — unrecognised
// state shapes resolve to `null` so the webview falls back to defaults.
const WORKSPACE_STATE_KEY = "frootai.federation.explorerState";
/** @type {1} */
const EXPLORER_STATE_VERSION = 1;

/**
 * @typedef {object} MarketplaceEntry
 * @property {string} slug
 * @property {string} [name]
 * @property {string} [owner]
 * @property {string} [desc]
 * @property {string} [trust]
 * @property {number} [installs]
 *
 * @typedef {object} AttachedAreaEntry
 * @property {string} name
 * @property {string} [trust]
 * @property {number} [toolCount]
 * @property {number} [idleMinutes]
 * @property {string} [attachedAt]
 */

/**
 * Filter + sort marketplace entries by an operator-typed query +
 * selected tier filter. Pure. Empty/missing tiers means "all tiers".
 *
 * @param {object} opts
 * @param {MarketplaceEntry[]} [opts.entries]
 * @param {string} [opts.query]
 * @param {Array<"T1"|"T2"|"T3"|string>} [opts.tiers]
 * @returns {MarketplaceEntry[]}
 */
function filterMarketplaceEntries(opts) {
  const o = opts || {};
  const entries = Array.isArray(o.entries) ? o.entries : [];
  const q = (typeof o.query === "string" ? o.query : "").trim().toLowerCase();
  const tierSet = Array.isArray(o.tiers) && o.tiers.length > 0
    ? new Set(o.tiers.filter((t) => ALL_TIERS.includes(t)))
    : null;
  const seen = new Set();
  const matched = [];
  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    if (typeof e.slug !== "string" || e.slug.length === 0) continue;
    if (seen.has(e.slug)) continue;
    seen.add(e.slug);
    const tier = marketplaceTree.resolveTierFromTrust(e.trust);
    if (tierSet && !tierSet.has(tier)) continue;
    if (q.length > 0) {
      const haystack = [
        e.slug,
        typeof e.name === "string" ? e.name : "",
        typeof e.owner === "string" ? e.owner : "",
        typeof e.desc === "string" ? e.desc : "",
      ].join(" ").toLowerCase();
      if (!haystack.includes(q)) continue;
    }
    matched.push(e);
  }
  // Sort by installs DESC + name tie-break (same rule as M5.11 tree).
  matched.sort((a, b) => {
    const ai = typeof a.installs === "number" ? a.installs : 0;
    const bi = typeof b.installs === "number" ? b.installs : 0;
    if (ai !== bi) return bi - ai;
    const an = String(a.name || a.slug);
    const bn = String(b.name || b.slug);
    return an.localeCompare(bn);
  });
  return matched;
}

/**
 * Render the idle timer for an attached-pane row. Pure.
 *
 * @param {number | null | undefined} idleMinutes
 * @returns {string}
 */
function formatIdleTimer(idleMinutes) {
  if (typeof idleMinutes !== "number" || !Number.isFinite(idleMinutes) || idleMinutes < 0) {
    return "—";
  }
  const m = Math.floor(idleMinutes);
  if (m === 0) return "just now";
  if (m < 60) return `idle ${m}m`;
  const h = Math.floor(m / 60);
  const rem = m - h * 60;
  if (h < 24) return rem === 0 ? `idle ${h}h` : `idle ${h}h${rem}m`;
  const d = Math.floor(h / 24);
  return `idle ${d}d`;
}

/**
 * Build a display-ready server card. Pure.
 *
 * @param {MarketplaceEntry} entry
 * @returns {{ slug: string, name: string, owner: string, desc: string,
 *             trust: string, tier: "T1"|"T2"|"T3",
 *             installsRaw: number, installsDisplay: string,
 *             url: string }}
 */
function buildServerCard(entry) {
  const e = entry || /** @type {any} */ ({});
  const slug = typeof e.slug === "string" ? e.slug : "";
  const name = typeof e.name === "string" && e.name.length > 0 ? e.name : slug;
  const installs = typeof e.installs === "number" && e.installs >= 0 ? e.installs : 0;
  return {
    slug,
    name,
    owner: typeof e.owner === "string" ? e.owner : "",
    desc: typeof e.desc === "string" ? e.desc : "",
    trust: typeof e.trust === "string" && e.trust.length > 0 ? e.trust : "unknown",
    tier: marketplaceTree.resolveTierFromTrust(e.trust),
    installsRaw: installs,
    installsDisplay: marketplaceTree._formatInstalls(installs),
    url: marketplaceTree.buildMarketplaceUrl(slug),
  };
}

/**
 * Build a display-ready attached-pane row. Pure.
 *
 * @param {AttachedAreaEntry} area
 * @returns {{ name: string, trust: string, toolCount: number,
 *             idleDisplay: string, idleMinutes: number | null }}
 */
function buildAttachedRow(area) {
  const a = area || /** @type {any} */ ({});
  const idle = typeof a.idleMinutes === "number" && a.idleMinutes >= 0 ? a.idleMinutes : null;
  return {
    name: typeof a.name === "string" ? a.name : "",
    trust: typeof a.trust === "string" && a.trust.length > 0 ? a.trust : "unknown",
    toolCount: typeof a.toolCount === "number" && a.toolCount >= 0 ? a.toolCount : 0,
    idleDisplay: formatIdleTimer(idle),
    idleMinutes: idle,
  };
}

/**
 * Validate a webview → host message. Returns a discriminated result.
 *
 * @param {unknown} msg
 * @returns {{ valid: true, kind: string, payload?: object } | { valid: false, reason: string }}
 */
function validateOutboundMessage(msg) {
  if (!msg || typeof msg !== "object") return { valid: false, reason: "not an object" };
  const m = /** @type {any} */ (msg);
  const type = m.type;
  if (typeof type !== "string" || type.length === 0) return { valid: false, reason: "missing type" };
  switch (type) {
    case "attach": {
      if (typeof m.slug !== "string" || !/^[a-zA-Z0-9_-]+$/.test(m.slug)) {
        return { valid: false, reason: "attach: invalid slug" };
      }
      return { valid: true, kind: "attach", payload: { slug: m.slug } };
    }
    case "detach": {
      if (typeof m.name !== "string" || !/^[a-zA-Z0-9_-]+$/.test(m.name)) {
        return { valid: false, reason: "detach: invalid name" };
      }
      return { valid: true, kind: "detach", payload: { name: m.name } };
    }
    case "viewOnWeb": {
      if (typeof m.slug !== "string" || !/^[a-zA-Z0-9_-]+$/.test(m.slug)) {
        return { valid: false, reason: "viewOnWeb: invalid slug" };
      }
      return { valid: true, kind: "viewOnWeb", payload: { slug: m.slug } };
    }
    case "refresh":
      return { valid: true, kind: "refresh" };
    case "stateChange": {
      /** @type {any} */
      const payload = {};
      if ("search" in m) {
        if (typeof m.search !== "string" || m.search.length > 256) {
          return { valid: false, reason: "stateChange: invalid search" };
        }
        payload.search = m.search;
      }
      if ("tab" in m) {
        if (!VALID_TAB.includes(m.tab)) return { valid: false, reason: "stateChange: invalid tab" };
        payload.tab = m.tab;
      }
      if ("tiers" in m) {
        if (!Array.isArray(m.tiers)) return { valid: false, reason: "stateChange: tiers must be array" };
        const filtered = m.tiers.filter((/** @type {string} */ t) => ALL_TIERS.includes(t));
        if (filtered.length !== m.tiers.length) {
          return { valid: false, reason: "stateChange: invalid tier value" };
        }
        payload.tiers = filtered;
      }
      return { valid: true, kind: "stateChange", payload };
    }
    default:
      return { valid: false, reason: `unknown outbound type: ${type}` };
  }
}

/**
 * Validate a host → webview message. Returns a discriminated result.
 *
 * @param {unknown} msg
 * @returns {{ valid: true, kind: string, payload?: object } | { valid: false, reason: string }}
 */
function validateInboundMessage(msg) {
  if (!msg || typeof msg !== "object") return { valid: false, reason: "not an object" };
  const m = /** @type {any} */ (msg);
  const type = m.type;
  if (typeof type !== "string" || type.length === 0) return { valid: false, reason: "missing type" };
  switch (type) {
    case "setActiveTab": {
      if (!VALID_TAB.includes(m.tab)) return { valid: false, reason: "setActiveTab: invalid tab" };
      return { valid: true, kind: "setActiveTab", payload: { tab: m.tab } };
    }
    case "focusSearch":
      return { valid: true, kind: "focusSearch" };
    case "update": {
      /** @type {any} */
      const payload = {};
      if ("marketplace" in m) {
        if (!Array.isArray(m.marketplace)) return { valid: false, reason: "update: marketplace not array" };
        payload.marketplace = m.marketplace;
      }
      if ("attached" in m) {
        if (!Array.isArray(m.attached)) return { valid: false, reason: "update: attached not array" };
        payload.attached = m.attached;
      }
      return { valid: true, kind: "update", payload };
    }
    case "restoreState": {
      /** @type {any} */
      const payload = {};
      if ("search" in m && typeof m.search === "string") payload.search = m.search;
      if ("tab" in m && VALID_TAB.includes(m.tab)) payload.tab = m.tab;
      if ("tiers" in m && Array.isArray(m.tiers)) {
        payload.tiers = m.tiers.filter((/** @type {string} */ t) => ALL_TIERS.includes(t));
      }
      return { valid: true, kind: "restoreState", payload };
    }
    default:
      return { valid: false, reason: `unknown inbound type: ${type}` };
  }
}

/**
 * Normalise a raw `workspaceState.get(WORKSPACE_STATE_KEY)` payload into
 * the canonical persisted-state shape, OR return `null` when the input
 * is unusable (wrong version, malformed, missing). Pure. M5.13 callers
 * use this to validate the previously-persisted state before sending
 * it to the webview as `restoreState`.
 *
 * Canonical shape:
 *   {
 *     version: 1,                             // bump on breaking shape changes
 *     search:  string  (<= 256 chars),        // empty string allowed
 *     tab:     "attached" | "catalog",
 *     tiers:   ("T1" | "T2" | "T3")[]         // non-empty; deduped + sorted
 *   }
 *
 * @param {unknown} raw
 * @returns {{ version: 1, search: string, tab: "attached" | "catalog",
 *             tiers: ("T1"|"T2"|"T3")[] } | null}
 */
function normaliseExplorerState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = /** @type {any} */ (raw);
  if (r.version !== EXPLORER_STATE_VERSION) return null;

  let search = "";
  if (typeof r.search === "string" && r.search.length <= 256) {
    search = r.search;
  }

  let tab = "catalog";
  if (VALID_TAB.includes(r.tab)) tab = r.tab;

  let tiers = ["T1", "T2", "T3"];
  if (Array.isArray(r.tiers)) {
    const seen = new Set();
    const filtered = [];
    for (const t of r.tiers) {
      if (!ALL_TIERS.includes(t)) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      filtered.push(t);
    }
    // Defensive: never persist an empty tier roster (would render nothing
    // on restore). When the operator deselected every tier somehow, snap
    // back to the all-tiers default.
    if (filtered.length > 0) {
      filtered.sort();
      tiers = filtered;
    }
  }

  return /** @type {{ version: 1, search: string, tab: "attached"|"catalog", tiers: ("T1"|"T2"|"T3")[] }} */ (
    { version: EXPLORER_STATE_VERSION, search, tab, tiers }
  );
}

/**
 * Merge an incoming `stateChange` postMessage payload into the current
 * persisted state. Only the keys present in `delta` are updated; absent
 * keys retain their prior value. Pure. Returns the merged state object
 * the caller writes back to `workspaceState`.
 *
 * @param {ReturnType<typeof normaliseExplorerState>} current
 * @param {{ search?: string, tab?: "attached"|"catalog", tiers?: ("T1"|"T2"|"T3")[] }} delta
 * @returns {{ version: 1, search: string, tab: "attached"|"catalog", tiers: ("T1"|"T2"|"T3")[] }}
 */
function mergeExplorerState(current, delta) {
  const base = current || { version: EXPLORER_STATE_VERSION, search: "", tab: "catalog", tiers: ["T1", "T2", "T3"] };
  const d = delta || {};
  const merged = {
    version: EXPLORER_STATE_VERSION,
    search: base.search,
    tab: base.tab,
    tiers: base.tiers,
  };
  if (typeof d.search === "string" && d.search.length <= 256) {
    merged.search = d.search;
  }
  if (d.tab && VALID_TAB.includes(d.tab)) {
    merged.tab = d.tab;
  }
  if (Array.isArray(d.tiers)) {
    const seen = new Set();
    const filtered = [];
    for (const t of d.tiers) {
      if (!ALL_TIERS.includes(t)) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      filtered.push(t);
    }
    if (filtered.length > 0) {
      filtered.sort();
      merged.tiers = /** @type {("T1"|"T2"|"T3")[]} */ (filtered);
    }
  }
  return merged;
}

module.exports = {
  ALL_TIERS,
  VALID_TAB,
  WORKSPACE_STATE_KEY,
  EXPLORER_STATE_VERSION,
  filterMarketplaceEntries,
  formatIdleTimer,
  buildServerCard,
  buildAttachedRow,
  validateOutboundMessage,
  validateInboundMessage,
  normaliseExplorerState,
  mergeExplorerState,
};
