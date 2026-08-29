// @ts-check
/**
 * M5.25 — Extension test suite: tree provider data shape.
 *
 * Row literal: extension test suite: `src/test/federation/*` covers
 * command registration, settings → env mapping, tree provider data
 * shape, webview message handlers.
 *
 * This file covers the TREE PROVIDER DATA SHAPE concern. Exercises
 * the pure-core tree builders for `McpToolProvider` (M5.16) and the
 * Orchard MCP-requires chip (M5.17) where pure cores exist.
 *
 * Run: node src/test/federation/tree-provider-data-shape.test.js
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

const toolProviderCore = require(path.resolve(__dirname, "..", "..", "providers", "mcp-tool-provider-core"));
const chipCore = require(path.resolve(__dirname, "..", "..", "providers", "orchard-mcp-chip-core"));

console.log("\nM5.25 — Tree Provider Data Shape\n");

test("M5.16 buildRootSections empty → Built-in only", () => {
  const sections = toolProviderCore.buildRootSections({ builtinToolCount: 48, attachedAreas: [] });
  assert.strictEqual(sections.length, 1);
  assert.strictEqual(sections[0].kind, "builtin");
  assert.strictEqual(sections[0].label, "Built-in (48)");
});

test("M5.16 buildRootSections with attached → Built-in + sorted Federated", () => {
  const sections = toolProviderCore.buildRootSections({
    builtinToolCount: 48,
    attachedAreas: [
      { name: "playwright", toolCount: 5 },
      { name: "azure", toolCount: 12 },
    ],
  });
  assert.strictEqual(sections.length, 3);
  assert.strictEqual(sections[1].areaName, "azure", "federated areas must sort alphabetically");
  assert.strictEqual(sections[2].areaName, "playwright");
  assert.strictEqual(sections[1].label, "Federated \u2192 Azure (12)");
});

test("M5.16 buildBuiltinGroupCounts substitutes 8 group counts", () => {
  const groups = toolProviderCore.buildBuiltinGroupCounts([
    { name: "a", type: "static" }, { name: "b", type: "static" },
    { name: "c", type: "live" },
  ]);
  assert.strictEqual(groups.length, 8);
  const byType = Object.fromEntries(groups.map((g) => [g.type, g]));
  assert.strictEqual(byType.static.count, 2);
  assert.strictEqual(byType.static.label, "Knowledge (2)");
  assert.strictEqual(byType.live.count, 1);
});

test("M5.16 root sections are FROZEN", () => {
  const sections = toolProviderCore.buildRootSections({ builtinToolCount: 1, attachedAreas: [] });
  assert.ok(Object.isFrozen(sections));
});

test("M5.17 chip extracts attached areas (sorted, deduped, validated)", () => {
  const areas = chipCore.extractMcpRequires({
    mcp_scope: { attached: ["playwright", "azure", "playwright", "bad.name", "context7"] },
  });
  assert.deepStrictEqual([...areas], ["azure", "context7", "playwright"]);
});

test("M5.17 chip text matches row literal", () => {
  const chip = chipCore.formatMcpRequiresChip({ mcp_scope: { attached: ["azure", "playwright"] } });
  assert.strictEqual(chip, "requires: azure, playwright");
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
