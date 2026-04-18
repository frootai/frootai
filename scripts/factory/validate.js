#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Validate
 * Quality gates for the factory pipeline.
 *
 * Usage:
 *   node scripts/factory/validate.js                # Standard validation
 *   node scripts/factory/validate.js --unification  # Include unification checks
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../..");

function validate(checkUnification = false) {
  console.log("🛡️  FAI Factory — Validate");
  console.log("══════════════════════════════════════");

  const catalogPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  if (!fs.existsSync(catalogPath)) {
    console.error("❌ fai-catalog.json not found. Run: npm run factory first.");
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  let errors = 0;
  let warnings = 0;

  // ── Check 1: Catalog has all required sections ──
  console.log("\n  1️⃣  Catalog structure:");
  const requiredKeys = ["stats", "agents", "skills", "instructions", "hooks", "plugins", "plays", "modules"];
  for (const key of requiredKeys) {
    if (!catalog[key]) {
      console.log(`     ❌ Missing: ${key}`);
      errors++;
    }
  }
  if (errors === 0) console.log("     ✅ All required sections present");

  // ── Check 2: Counts are positive ──
  console.log("\n  2️⃣  Count validation:");
  const minCounts = { agents: 200, skills: 300, instructions: 150, hooks: 5, plugins: 50, plays: 90 };
  for (const [key, min] of Object.entries(minCounts)) {
    const actual = catalog.stats[key] || 0;
    if (actual < min) {
      console.log(`     ❌ ${key}: ${actual} (expected ≥${min})`);
      errors++;
    }
  }
  if (errors === 0) console.log("     ✅ All counts above minimum thresholds");

  // ── Check 3: Agents have required fields ──
  console.log("\n  3️⃣  Agent quality:");
  let agentsMissingDesc = 0;
  let agentsMissingWaf = 0;
  for (const agent of catalog.agents) {
    if (!agent.description || agent.description.length < 10) agentsMissingDesc++;
    if (!agent.waf || agent.waf.length === 0) agentsMissingWaf++;
  }
  if (agentsMissingDesc > 0) {
    console.log(`     ⚠️  ${agentsMissingDesc} agents missing description (≥10 chars)`);
    warnings += agentsMissingDesc;
  }
  if (agentsMissingWaf > 0) {
    console.log(`     ⚠️  ${agentsMissingWaf} agents missing WAF alignment`);
    warnings += agentsMissingWaf;
  }
  if (agentsMissingDesc === 0 && agentsMissingWaf === 0) {
    console.log("     ✅ All agents have description + WAF");
  }

  // ── Check 4: Plays have manifests ──
  console.log("\n  4️⃣  Play integrity:");
  let playsNoManifest = 0;
  let playsNoAgent = 0;
  for (const play of catalog.plays) {
    if (!play.hasManifest) playsNoManifest++;
    if (!play.hasRootAgent) playsNoAgent++;
  }
  if (playsNoManifest > 0) {
    console.log(`     ⚠️  ${playsNoManifest} plays missing fai-manifest.json`);
    warnings += playsNoManifest;
  }
  if (playsNoAgent > 0) {
    console.log(`     ⚠️  ${playsNoAgent} plays missing root agent.md`);
    warnings += playsNoAgent;
  }
  if (playsNoManifest === 0 && playsNoAgent === 0) {
    console.log("     ✅ All plays have manifest + root agent");
  }

  // ── Check 5: Cross-channel consistency ──
  console.log("\n  5️⃣  Cross-channel consistency:");
  const npmMcpPkg = path.join(REPO_ROOT, "npm-mcp", "package.json");
  if (fs.existsSync(npmMcpPkg)) {
    const pkg = JSON.parse(fs.readFileSync(npmMcpPkg, "utf8"));
    const descMatch = pkg.description.match(/(\d+) MCP tools/);
    const descTools = descMatch ? parseInt(descMatch[1]) : 0;
    if (descTools !== catalog.stats.mcpTools) {
      console.log(`     ⚠️  npm-mcp description says ${descTools} tools, catalog has ${catalog.stats.mcpTools}`);
      warnings++;
    } else {
      console.log("     ✅ npm-mcp tool count matches catalog");
    }
  }

  // ── Check 6: Unification (optional) ──
  if (checkUnification) {
    console.log("\n  6️⃣  Unification compliance:");
    // Check embedded agents have full frontmatter
    let embeddedMissingWaf = 0;
    let embeddedMissingModel = 0;
    for (const play of catalog.plays) {
      // We check the devkit counts — actual frontmatter check requires re-scanning
      if (play.devkit && play.devkit.agents > 0 && (!play.speckit?.waf || play.speckit.waf.length === 0)) {
        embeddedMissingWaf++;
      }
    }
    if (embeddedMissingWaf > 0) {
      console.log(`     ⚠️  ${embeddedMissingWaf} plays with agents but no WAF alignment in manifest`);
      warnings += embeddedMissingWaf;
    } else {
      console.log("     ✅ All plays with agents have WAF alignment");
    }
  }

  // ── Summary ──
  console.log("\n  ─────────────────────────────────────");
  if (errors > 0) {
    console.log(`  ❌ FAILED: ${errors} error(s), ${warnings} warning(s)`);
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`  ⚠️  PASSED with ${warnings} warning(s)`);
  } else {
    console.log("  ✅ ALL CHECKS PASSED");
  }

  return { errors, warnings };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  validate(args.includes("--unification"));
}

module.exports = { validate };
