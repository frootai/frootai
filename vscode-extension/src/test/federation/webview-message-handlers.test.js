// @ts-check
/**
 * M5.25 — Extension test suite: webview message handlers.
 *
 * Row literal: extension test suite: `src/test/federation/*` covers
 * command registration, settings → env mapping, tree provider data
 * shape, webview message handlers.
 *
 * This file covers the WEBVIEW MESSAGE HANDLERS concern. Exercises
 * the pure-core `federation-explorer-core.js` (M5.12 + M5.13)
 * message validators end-to-end.
 *
 * Run: node src/test/federation/webview-message-handlers.test.js
 */
"use strict";

const assert = require("node:assert");
const path = require("node:path");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}: ${e.message}`);
  }
}

const explorerCore = require(path.resolve(__dirname, "..", "..", "webviews", "federation-explorer-core"));

console.log("\nM5.25 — Webview Message Handlers\n");

test("explorer-core exports message validators + state helpers", () => {
  assert.strictEqual(typeof explorerCore.validateOutboundMessage, "function");
  assert.strictEqual(typeof explorerCore.validateInboundMessage, "function");
  assert.strictEqual(typeof explorerCore.normaliseExplorerState, "function");
  assert.strictEqual(typeof explorerCore.mergeExplorerState, "function");
});

test("M5.13 WORKSPACE_STATE_KEY + EXPLORER_STATE_VERSION pinned", () => {
  assert.strictEqual(explorerCore.WORKSPACE_STATE_KEY, "frootai.federation.explorerState");
  assert.strictEqual(explorerCore.EXPLORER_STATE_VERSION, 1);
});

test("validateOutboundMessage accepts a well-formed bootstrap payload", () => {
  const out = explorerCore.validateOutboundMessage({
    type: "bootstrap",
    marketplace: [],
    attached: [],
  });
  assert.ok(out !== undefined, "validateOutboundMessage must return a non-undefined result");
});

test("validateInboundMessage accepts setActiveTab + rejects unknown type", () => {
  // Happy: setActiveTab → { valid: true, ... }
  const ok = explorerCore.validateInboundMessage({ type: "setActiveTab", tab: "catalog" });
  assert.strictEqual(ok.valid, true);
  assert.strictEqual(ok.kind, "setActiveTab");
  // Unknown type → { valid: false, reason: ... }
  const bad = explorerCore.validateInboundMessage({ type: "wat", payload: 42 });
  assert.strictEqual(bad.valid, false);
  assert.ok(typeof bad.reason === "string");
});

test("normaliseExplorerState: returns null for unusable input", () => {
  assert.strictEqual(explorerCore.normaliseExplorerState(null), null);
  assert.strictEqual(explorerCore.normaliseExplorerState(undefined), null);
  // Wrong version → null
  assert.strictEqual(explorerCore.normaliseExplorerState({ version: 99 }), null);
});

test("normaliseExplorerState: produces canonical shape for valid input", () => {
  const state = explorerCore.normaliseExplorerState({
    version: explorerCore.EXPLORER_STATE_VERSION,
    search: "azure",
    tab: "catalog",
    tiers: ["T1", "T2"],
  });
  assert.ok(state && typeof state === "object");
  assert.strictEqual(state.search, "azure");
  assert.strictEqual(state.tab, "catalog");
  assert.deepStrictEqual(state.tiers, ["T1", "T2"]);
});

test("mergeExplorerState applies a partial patch (null base → default)", () => {
  const merged = explorerCore.mergeExplorerState(null, { search: "azure" });
  assert.strictEqual(merged.search, "azure");
  // Unmodified fields fall back to default
  assert.strictEqual(merged.tab, "catalog");
  assert.deepStrictEqual(merged.tiers, ["T1", "T2", "T3"]);
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
