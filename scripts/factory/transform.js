#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Transform
 * Runs all channel adapters against fai-catalog.json.
 *
 * Usage:
 *   node scripts/factory/transform.js              # Run all adapters
 *   node scripts/factory/transform.js --channel X   # Run specific adapter
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../..");

// Import all adapters
const adapters = {
  "npm-mcp": require("./adapters/npm-mcp"),
  "vscode": require("./adapters/vscode"),
  "python-mcp": require("./adapters/python-mcp"),
  "npm-sdk": require("./adapters/npm-sdk"),
  "python-sdk": require("./adapters/python-sdk"),
};

function transform(specificChannel) {
  console.log("🔄 FAI Factory — Transform");
  console.log("══════════════════════════════════════");

  const catalogPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  if (!fs.existsSync(catalogPath)) {
    console.error("❌ fai-catalog.json not found. Run: npm run factory:catalog first.");
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const t0 = Date.now();

  const channelsToRun = specificChannel
    ? { [specificChannel]: adapters[specificChannel] }
    : adapters;

  if (specificChannel && !adapters[specificChannel]) {
    console.error(`❌ Unknown channel: ${specificChannel}. Available: ${Object.keys(adapters).join(", ")}`);
    process.exit(1);
  }

  const allResults = [];
  let errors = 0;

  for (const [name, adapter] of Object.entries(channelsToRun)) {
    try {
      const result = adapter.adapt(catalog);
      allResults.push(result);
      console.log(`\n  📦 ${result.channel}:`);
      result.updates.forEach((u) => console.log(`     ✅ ${u}`));
    } catch (err) {
      errors++;
      console.log(`\n  📦 ${name}:`);
      console.log(`     ❌ ERROR: ${err.message}`);
    }
  }

  const elapsed = Date.now() - t0;
  console.log(`\n  ─────────────────────────────────────`);
  console.log(`  Transformed ${allResults.length} channels in ${elapsed}ms`);
  if (errors > 0) console.log(`  ⚠️  ${errors} channel(s) had errors`);

  return { results: allResults, errors, elapsed };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const channelIdx = args.indexOf("--channel");
  const channel = channelIdx >= 0 ? args[channelIdx + 1] : null;
  transform(channel);
}

module.exports = { transform };
