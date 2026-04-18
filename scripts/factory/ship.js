#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Ship
 * Factory-gated publish to a specific distribution channel.
 *
 * Flow:
 *   1. Run factory pipeline (harvest → catalog → validate)
 *   2. Run transform for the target channel
 *   3. Delegate to release-channel.js for version bump + tag + push
 *
 * Usage:
 *   node scripts/factory/ship.js mcp patch       # Ship npm MCP server (patch bump)
 *   node scripts/factory/ship.js ext minor        # Ship VS Code extension (minor bump)
 *   node scripts/factory/ship.js all patch        # Ship all channels
 *   node scripts/factory/ship.js --dry-run mcp    # Preview only
 *   npm run factory:ship -- mcp patch             # Via npm script
 *
 * This wraps release-channel.js with factory pre-flight validation,
 * ensuring consistency before any release.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { harvest } = require("./harvest");
const { catalog } = require("./catalog");
const { transform } = require("./transform");
const { validate } = require("./validate");

const REPO_ROOT =
  process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../..");

const CHANNELS = ["mcp", "cli", "ext", "sdk", "pymcp", "all"];
const BUMPS = ["patch", "minor", "major"];

function showHelp() {
  console.log(`
🍊 FAI Factory — Ship
═══════════════════════════════════════

Factory-gated release: validates consistency before publishing.

Usage:
  npm run factory:ship -- <channel> [bump]
  npm run factory:ship -- --dry-run <channel> [bump]

Channels:
  mcp     npm MCP Server + Docker        (tag: mcp-vX.Y.Z)
  cli     npm CLI (frootai)              (tag: cli-vX.Y.Z)
  ext     VS Code Extension              (tag: ext-vX.Y.Z)
  sdk     Python SDK (PyPI)              (tag: sdk-vX.Y.Z)
  pymcp   Python MCP (PyPI)              (tag: pymcp-vX.Y.Z)
  all     ALL channels at once           (tag: rel-vYYYY.MM.DD)

Bump types:
  patch   Bug fixes (default)
  minor   New features
  major   Breaking changes

Options:
  --dry-run   Preview only, no publish
  --skip-transform   Skip transform step (faster if already run)

Flow:
  1. 🌾 Harvest primitives
  2. 📦 Build catalog
  3. 🔄 Transform channel files
  4. 🛡️ Validate quality gates
  5. 🚀 Delegate to release-channel.js
`);
}

function suppressOutput(fn) {
  const orig = console.log;
  const origErr = console.error;
  const lines = [];
  console.log = (...a) => lines.push(a.join(" "));
  console.error = (...a) => lines.push(a.join(" "));
  try {
    fn();
    return lines;
  } finally {
    console.log = orig;
    console.error = origErr;
  }
}

function run() {
  const rawArgs = process.argv.slice(2);
  const dryRun = rawArgs.includes("--dry-run");
  const skipTransform = rawArgs.includes("--skip-transform");
  const filtered = rawArgs.filter(
    (a) => a !== "--dry-run" && a !== "--skip-transform",
  );

  if (
    filtered.length === 0 ||
    filtered.includes("--help") ||
    filtered.includes("-h")
  ) {
    showHelp();
    return;
  }

  const channel = filtered[0];
  const bump = filtered[1] || "patch";

  if (!CHANNELS.includes(channel)) {
    console.error(
      `❌ Unknown channel: ${channel}. Options: ${CHANNELS.join(", ")}`,
    );
    process.exit(1);
  }
  if (!BUMPS.includes(bump)) {
    console.error(
      `❌ Unknown bump type: ${bump}. Options: ${BUMPS.join(", ")}`,
    );
    process.exit(1);
  }

  console.log("");
  console.log("🍊 FAI Factory — Ship");
  console.log("══════════════════════════════════════════════════════");
  console.log(`  Channel:   ${channel}`);
  console.log(`  Bump:      ${bump}`);
  console.log(`  Dry run:   ${dryRun}`);
  console.log("");

  const t0 = Date.now();

  // Step 1: Factory pre-flight
  console.log("  ── Pre-flight Checks ──");
  console.log("");

  process.stdout.write("  🌾 Harvesting... ");
  suppressOutput(() => harvest());
  console.log("\x1b[32m✓\x1b[0m");

  process.stdout.write("  📦 Cataloging... ");
  suppressOutput(() => catalog());
  console.log("\x1b[32m✓\x1b[0m");

  if (!skipTransform) {
    process.stdout.write("  🔄 Transforming... ");
    suppressOutput(() => transform(channel === "all" ? undefined : channel));
    console.log("\x1b[32m✓\x1b[0m");
  }

  // Step 2: Validate
  process.stdout.write("  🛡️ Validating... ");
  const valOutput = suppressOutput(() => validate());
  const hasErrors = valOutput.some((l) => l.includes("❌"));
  if (hasErrors) {
    console.log("\x1b[31m✗ FAILED\x1b[0m");
    console.log("");
    console.log("  Quality gate failed. Fix issues before shipping:");
    valOutput.filter((l) => l.includes("❌") || l.includes("⚠️")).forEach((l) => {
      console.log(`    ${l}`);
    });
    console.log("");
    process.exit(1);
  }
  console.log("\x1b[32m✓\x1b[0m");

  // Step 3: Show catalog stats before release
  const catalogPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  const cat = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  console.log("");
  console.log("  📊 Releasing with:");
  console.log(
    `     ${cat.stats.totalPrimitives} primitives | ${cat.stats.plays} plays | ${cat.stats.mcpTools} MCP tools`,
  );
  console.log(`     Catalog: v${cat.version} @ ${cat.commit}`);
  console.log("");

  // Step 4: Delegate to release-channel.js
  console.log("  ── Release ──");
  console.log("");
  const releaseScript = path.join(REPO_ROOT, "scripts", "release-channel.js");

  const dryFlag = dryRun ? "--dry-run" : "";
  const cmd = `node "${releaseScript}" ${dryFlag} ${channel} ${bump}`.trim();

  try {
    console.log(`  🚀 Running: ${cmd}`);
    console.log("");
    execSync(cmd, {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: { ...process.env },
    });
  } catch (err) {
    console.error("");
    console.error(`  ❌ Release failed: ${err.message}`);
    process.exit(1);
  }

  const elapsed = Date.now() - t0;
  console.log("");
  console.log(
    `  \x1b[32m✅ Ship complete in ${(elapsed / 1000).toFixed(1)}s\x1b[0m`,
  );
  if (!dryRun) {
    console.log(
      "  Tags pushed — per-channel workflows will handle publishing.",
    );
  }
  console.log("");
}

// CLI entry point
if (require.main === module) {
  run();
}

module.exports = { ship: run };
