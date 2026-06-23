/**
 * [Z10.5] Enterprise — Cost-meter (tokens saved → $).
 *
 * Turns the Lean savings the gate already measures (Full↔Lean token delta) into
 * a dollar figure, so the enterprise console can show "this fetch saved $X" and
 * the ecosystem benchmark ([Z7]) can show aggregate spend avoided. It pairs with
 * the [Z10.1] fetch audit (`savedPct`) and the [Z10.2] governance decision.
 *
 * HONESTY CONTRACT (inherited from the pricing catalog, which states
 * "NEVER FAKE A COST BAND — every entry carries a priced_at + source"):
 *   - This module BAKES NO PRICES. Every $ figure requires a price the caller
 *     sourced from the real catalog (`frootai-core/pricing-catalog.json`). A
 *     missing / negative price throws — we never invent a number.
 *   - Prices carry a `priced_at`; `isPriceStale` flags any quote older than the
 *     catalog's `stale_after_days` (fail-safe: an unparizable date is stale), so
 *     a stale price is surfaced, never silently quoted as current.
 *
 * Lean reclaims INPUT (prompt-load) tokens, so the relevant unit price is the
 * model's input-token price. Callers pass the input SKU's price.
 */

import { countTokens } from "./tokens.js";

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Normalize a pricing-catalog entry's unit price to USD per 1K tokens, so the
 * meter consumes the real catalog regardless of its `unit` convention.
 *
 * @param {{unit_price_usd:number, unit?:string}} entry  a catalog entry
 * @returns {number} USD per 1,000 tokens
 */
function usdPer1kFromCatalogEntry(entry) {
  if (!entry || typeof entry.unit_price_usd !== "number" || !Number.isFinite(entry.unit_price_usd)) {
    throw new TypeError("usdPer1kFromCatalogEntry: entry.unit_price_usd must be a finite number (source it from the pricing catalog — never fake a cost).");
  }
  const unit = String(entry.unit ?? "1K tokens").toLowerCase().replace(/\s+/g, "");
  if (unit === "1ktokens" || unit === "1ktoken") return entry.unit_price_usd;
  if (unit === "1mtokens" || unit === "1mtoken") return entry.unit_price_usd / 1000;
  if (unit === "token" || unit === "1token") return entry.unit_price_usd * 1000;
  throw new TypeError(`usdPer1kFromCatalogEntry: unsupported unit "${entry.unit}" (expected "1K tokens" / "1M tokens" / "token").`);
}

/**
 * Is a quoted price stale? Fail-safe: an absent or unparseable `priced_at` is
 * treated as stale, so a price we can't date is never quoted as current.
 *
 * @param {string} pricedAt  ISO timestamp from the catalog entry
 * @param {{now?:Date, staleAfterDays?:number}} [opts]
 * @returns {boolean}
 */
function isPriceStale(pricedAt, { now = new Date(), staleAfterDays = 7 } = {}) {
  const t = Date.parse(pricedAt);
  if (Number.isNaN(t)) return true;
  const ageDays = (now.getTime() - t) / 86_400_000;
  return ageDays > staleAfterDays;
}

/**
 * Convert tokens-saved → dollars. The price is REQUIRED — never invented.
 *
 * @param {number} tokensSaved
 * @param {number} usdPer1kTokens
 * @returns {number} USD saved
 */
function costSaved(tokensSaved, usdPer1kTokens) {
  if (typeof tokensSaved !== "number" || !Number.isFinite(tokensSaved)) {
    throw new TypeError("costSaved: tokensSaved must be a finite number.");
  }
  if (typeof usdPer1kTokens !== "number" || !Number.isFinite(usdPer1kTokens) || usdPer1kTokens < 0) {
    throw new TypeError("costSaved: usdPer1kTokens must be a non-negative finite number (source it from the pricing catalog — never fake a cost).");
  }
  return (tokensSaved / 1000) * usdPer1kTokens;
}

/**
 * Meter a Full↔Lean pair given token COUNTS.
 *
 * @param {number} fullTokens
 * @param {number} leanTokens
 * @param {number} usdPer1kTokens
 * @returns {{fullTokens:number, leanTokens:number, tokensSaved:number, savedPct:number, usdSaved:number}}
 */
function meterTokens(fullTokens, leanTokens, usdPer1kTokens) {
  for (const [name, v] of [["fullTokens", fullTokens], ["leanTokens", leanTokens]]) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      throw new TypeError(`meterTokens: ${name} must be a non-negative finite number.`);
    }
  }
  const tokensSaved = fullTokens - leanTokens;
  const savedPct = fullTokens > 0 ? round1((tokensSaved / fullTokens) * 100) : 0;
  return { fullTokens, leanTokens, tokensSaved, savedPct, usdSaved: costSaved(tokensSaved, usdPer1kTokens) };
}

/**
 * Meter a Full↔Lean pair from raw TEXT, counting with the exact engine
 * tokenizer (the same o200k basis the gate and benchmark use).
 *
 * @param {string} full
 * @param {string} lean
 * @param {number} usdPer1kTokens
 * @returns {ReturnType<typeof meterTokens>}
 */
function meterText(full, lean, usdPer1kTokens) {
  return meterTokens(countTokens(full), countTokens(lean), usdPer1kTokens);
}

/**
 * Integration helper: meter a Full↔Lean pair against a real pricing-catalog
 * entry, returning the savings plus a price block that surfaces the source and
 * staleness — so the caller can render "$X saved (gpt-4o-input, priced 2026-06-04)"
 * and flag a stale quote rather than passing it off as current.
 *
 * @param {string} full
 * @param {string} lean
 * @param {{unit_price_usd:number, unit?:string, priced_at?:string, sku?:string, source?:string}} entry
 * @param {{now?:Date, staleAfterDays?:number}} [opts]
 * @returns {{
 *   fullTokens:number, leanTokens:number, tokensSaved:number, savedPct:number, usdSaved:number,
 *   price:{usdPer1kTokens:number, sku:string|null, pricedAt:string|null, source:string|null, stale:boolean}
 * }}
 */
function meterWithCatalogEntry(full, lean, entry, { now = new Date(), staleAfterDays = 7 } = {}) {
  const usdPer1kTokens = usdPer1kFromCatalogEntry(entry);
  const metered = meterText(full, lean, usdPer1kTokens);
  return {
    ...metered,
    price: {
      usdPer1kTokens,
      sku: entry.sku ?? null,
      pricedAt: entry.priced_at ?? null,
      source: entry.source ?? null,
      stale: isPriceStale(entry.priced_at, { now, staleAfterDays }),
    },
  };
}

export {
  usdPer1kFromCatalogEntry,
  isPriceStale,
  costSaved,
  meterTokens,
  meterText,
  meterWithCatalogEntry,
};
