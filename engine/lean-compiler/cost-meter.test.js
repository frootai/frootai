/**
 * [Z10.5] Tests — Cost-meter (tokens saved → $).
 *
 * The meter never invents a price (missing/negative throws), consumes the real
 * catalog entry shape (unit normalisation + staleness), and turns the Full↔Lean
 * token delta into honest dollars. Pairs with [Z10.1] savedPct and [Z7] totals.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  usdPer1kFromCatalogEntry,
  isPriceStale,
  costSaved,
  meterTokens,
  meterText,
  meterWithCatalogEntry,
} from "./cost-meter.js";

// A real-shaped pricing-catalog entry (mirrors frootai-core/pricing-catalog.json).
const GPT4O_INPUT = {
  sku: "gpt-4o-input",
  unit: "1K tokens",
  unit_price_usd: 0.0025,
  priced_at: "2026-06-04T00:00:00Z",
  source: "seeded",
};

test("[Z10.5] costSaved converts tokens saved to dollars at the given price", () => {
  // 1,000,000 tokens saved @ $0.0025 / 1K = $2.50
  assert.equal(costSaved(1_000_000, 0.0025), 2.5);
});

test("[Z10.5] costSaved REQUIRES a price — missing/negative throws (never fake a cost)", () => {
  assert.throws(() => costSaved(1000), TypeError);
  assert.throws(() => costSaved(1000, -1), TypeError);
  assert.throws(() => costSaved(1000, "0.0025"), TypeError);
});

test("[Z10.5] costSaved rejects a non-finite token count", () => {
  assert.throws(() => costSaved(NaN, 0.0025), TypeError);
  assert.throws(() => costSaved(Infinity, 0.0025), TypeError);
});

test("[Z10.5] usdPer1kFromCatalogEntry normalises 1K-token unit (passthrough)", () => {
  assert.equal(usdPer1kFromCatalogEntry(GPT4O_INPUT), 0.0025);
});

test("[Z10.5] usdPer1kFromCatalogEntry normalises 1M-token and per-token units", () => {
  assert.equal(usdPer1kFromCatalogEntry({ unit: "1M tokens", unit_price_usd: 2.5 }), 0.0025);
  assert.equal(usdPer1kFromCatalogEntry({ unit: "token", unit_price_usd: 0.0000025 }), 0.0025);
});

test("[Z10.5] usdPer1kFromCatalogEntry throws on a bad unit or missing price", () => {
  assert.throws(() => usdPer1kFromCatalogEntry({ unit: "per hour", unit_price_usd: 1 }), TypeError);
  assert.throws(() => usdPer1kFromCatalogEntry({ unit: "1K tokens" }), TypeError);
  assert.throws(() => usdPer1kFromCatalogEntry(null), TypeError);
});

test("[Z10.5] isPriceStale flags fresh vs old, and fails safe on a bad date", () => {
  const now = new Date("2026-06-09T00:00:00Z");
  assert.equal(isPriceStale("2026-06-04T00:00:00Z", { now, staleAfterDays: 7 }), false); // 5 days old
  assert.equal(isPriceStale("2026-05-20T00:00:00Z", { now, staleAfterDays: 7 }), true); // 20 days old
  assert.equal(isPriceStale(undefined, { now }), true); // no date → stale (fail-safe)
  assert.equal(isPriceStale("not-a-date", { now }), true);
});

test("[Z10.5] meterTokens computes tokensSaved, savedPct and usdSaved", () => {
  const m = meterTokens(1000, 600, 0.0025);
  assert.equal(m.tokensSaved, 400);
  assert.equal(m.savedPct, 40);
  assert.equal(m.usdSaved, (400 / 1000) * 0.0025);
});

test("[Z10.5] meterTokens guards divide-by-zero when fullTokens is 0", () => {
  const m = meterTokens(0, 0, 0.0025);
  assert.equal(m.savedPct, 0);
  assert.equal(m.usdSaved, 0);
});

test("[Z10.5] meterTokens rejects negative counts", () => {
  assert.throws(() => meterTokens(-1, 0, 0.0025), TypeError);
});

test("[Z10.5] meterText uses the exact engine tokenizer and never goes negative for a compressed lean", () => {
  const full = "You MUST validate input before you run the build in order to deploy the service.";
  const lean = "You MUST validate input. Run the build. Deploy.";
  const m = meterText(full, lean, 0.0025);
  assert.ok(m.fullTokens > 0 && m.leanTokens > 0);
  assert.ok(m.tokensSaved >= 0);
  assert.equal(m.usdSaved, (m.tokensSaved / 1000) * 0.0025);
});

test("[Z10.5] meterWithCatalogEntry returns savings + a sourced, staleness-flagged price block", () => {
  const full = "You MUST validate input before you run the build in order to deploy.";
  const lean = "You MUST validate input. Run the build. Deploy.";
  const fresh = new Date("2026-06-06T00:00:00Z"); // 2 days after priced_at
  const out = meterWithCatalogEntry(full, lean, GPT4O_INPUT, { now: fresh, staleAfterDays: 7 });
  assert.equal(out.price.sku, "gpt-4o-input");
  assert.equal(out.price.source, "seeded");
  assert.equal(out.price.usdPer1kTokens, 0.0025);
  assert.equal(out.price.stale, false);
  assert.equal(out.usdSaved, (out.tokensSaved / 1000) * 0.0025);

  // Same entry, quoted long after priced_at → flagged stale, not silently current.
  const later = new Date("2026-07-01T00:00:00Z");
  assert.equal(meterWithCatalogEntry(full, lean, GPT4O_INPUT, { now: later }).price.stale, true);
});
