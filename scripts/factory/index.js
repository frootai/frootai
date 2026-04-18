#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Main Entry Point
 * The shipping engine that harvests, catalogs, diffs, and transforms primitives.
 *
 * Usage:
 *   node scripts/factory/index.js              # Full pipeline: harvest → catalog → diff
 *   node scripts/factory/index.js --status     # Show catalog summary
 *   node scripts/factory/index.js --help       # Show usage
 */
const fs = require("fs");
const path = require("path");
const { harvest } = require("./harvest");
const { catalog } = require("./catalog");
const { diff } = require("./diff");
const { transform } = require("./transform");
const { validate } = require("./validate");

const REPO_ROOT = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../..");
const args = process.argv.slice(2);

function showStatus() {
  const catalogPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  if (!fs.existsSync(catalogPath)) {
    console.log("❌ No catalog found. Run: npm run factory");
    process.exit(1);
  }

  const cat = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  console.log("🍊 FAI Factory — Status");
  console.log("══════════════════════════════════════");
  console.log(`  Version:   ${cat.version}`);
  console.log(`  Commit:    ${cat.commit}`);
  console.log(`  Generated: ${cat.generated}`);
  console.log("");
  console.log("  Standalone Primitives:");
  console.log(`    Agents:       ${cat.stats.agents}`);
  console.log(`    Skills:       ${cat.stats.skills}`);
  console.log(`    Instructions: ${cat.stats.instructions}`);
  console.log(`    Hooks:        ${cat.stats.hooks}`);
  console.log(`    Plugins:      ${cat.stats.plugins}`);
  console.log(`    Workflows:    ${cat.stats.workflows}`);
  console.log(`    Cookbook:      ${cat.stats.cookbook}`);
  console.log(`    TOTAL:        ${cat.stats.totalPrimitives}`);
  console.log("");
  console.log(`  Plays:        ${cat.stats.plays}`);
  console.log(`  Modules:      ${cat.stats.modules}`);
  console.log(`  MCP Tools:    ${cat.stats.mcpTools}`);
  console.log(`  Cross-refs:   ${cat.crossRefCount}`);
  console.log("");
  console.log(`  Embedded (across ${cat.stats.plays} plays):`);
  console.log(`    Agents:       ${cat.embeddedStats.agents}`);
  console.log(`    Skills:       ${cat.embeddedStats.skills}`);
  console.log(`    Instructions: ${cat.embeddedStats.instructions}`);
  console.log(`    Hooks:        ${cat.embeddedStats.hooks}`);
  console.log("");
  console.log(`  Catalog size: ${Math.round(fs.statSync(catalogPath).size / 1024)}KB`);
}

function showHelp() {
  console.log(`
🍊 FAI Factory — The Shipping Engine

Usage:
  npm run factory              Full pipeline: harvest → catalog → diff
  npm run factory:harvest      Scan all primitives
  npm run factory:catalog      Build fai-catalog.json
  npm run factory:diff         Compare to previous catalog
  npm run factory:status       Show catalog summary

Environment:
  FROOTAI_PUBLIC_REPO          Path to public repo (default: auto-detect)
  FROOTAI_WEBSITE_REPO         Path to website repo (for website adapter)
`);
}

function run() {
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  if (args.includes("--status")) {
    showStatus();
    return;
  }

  // Full pipeline
  console.log("🍊 FAI Factory — Full Pipeline");
  console.log("══════════════════════════════════════\n");

  const t0 = Date.now();

  // Step 1: Harvest
  harvest();
  console.log("");

  // Step 2: Catalog
  catalog();
  console.log("");

  // Step 3: Diff
  diff();
  console.log("");

  // Step 4: Transform (run all channel adapters)
  transform();
  console.log("");

  // Step 5: Validate
  validate();
  console.log("");

  const elapsed = Date.now() - t0;
  console.log(`\n🍊 Factory complete in ${elapsed}ms`);
}

run();
