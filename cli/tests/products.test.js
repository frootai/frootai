// @ts-check
"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { PRODUCTS, productCoverage, renderProducts } = require("../lib/products/catalog");
const { inspectCapabilities } = require("../lib/capabilities/inspect");

test("catalog assigns every product a supported coverage mode", () => {
  const expectedIds = [
    "account", "agent-fai", "configurator", "docker", "engine", "factory",
    "hosted-mcp", "lab", "lean", "marketplace", "mcp", "npm-sdk", "orchard",
    "plays", "primitives", "protocol", "python", "solution-accelerator", "studio", "vscode",
  ];
  assert.deepEqual(PRODUCTS.map((product) => product.id).sort(), expectedIds);
  assert.equal(new Set(PRODUCTS.map((product) => product.id)).size, PRODUCTS.length);

  for (const product of PRODUCTS) {
    assert.match(product.id, /^[a-z0-9-]+$/);
    assert.ok(["native", "bridge", "web"].includes(product.coverage));
    assert.match(product.url, /^https:\/\/frootai\.dev\//);
    if (product.coverage === "native") assert.ok(product.commands.length > 0);
  }
});

test("coverage counts account for the entire catalog", () => {
  const { schemaVersion, counts } = productCoverage();
  assert.equal(schemaVersion, 1);
  assert.equal(counts.native + counts.bridge + counts.web, PRODUCTS.length);
  assert.deepEqual(counts, { native: 7, bridge: 6, web: 7 });
});

test("JSON output is stable and machine-readable", () => {
  const rendered = JSON.parse(renderProducts({ json: true }));
  assert.deepEqual(rendered, productCoverage());
});

test("human output explains representative product entry points", () => {
  const rendered = renderProducts();
  assert.match(rendered, /\[NATIVE\] Orchard/);
  assert.match(rendered, /\[NATIVE\] Lean/);
  assert.match(rendered, /\[WEB\] Agent FAI/);
  assert.match(rendered, /Coverage labels describe the CLI surface, not product maturity\./);
});

test("capability inspection derives executable backend evidence", () => {
  const report = inspectCapabilities();
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.cliVersion, "6.2.0");
  assert.ok(report.capabilities.length >= 13);
  assert.equal(report.summary.unavailable || 0, 0);
  assert.equal(report.summary.invalid || 0, 0);
  for (const capability of report.capabilities) {
    assert.ok(["ready", "partial"].includes(capability.status));
    assert.ok(capability.commands.length > 0);
    assert.ok(capability.evidence.length > 0);
  }
});