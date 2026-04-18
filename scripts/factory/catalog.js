#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Cataloger
 * Combines harvest output into the canonical fai-catalog.json.
 *
 * Usage:
 *   node scripts/factory/catalog.js
 *
 * Input:  .factory/harvest.json (from harvest.js)
 * Output: .factory/fai-catalog.json (canonical catalog)
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REPO_ROOT = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../..");

function gitShortSha() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function readVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "npm-mcp", "package.json"), "utf8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function catalog() {
  console.log("📋 FAI Factory — Cataloger");
  console.log("══════════════════════════════════════");

  const harvestPath = path.join(REPO_ROOT, ".factory", "harvest.json");
  if (!fs.existsSync(harvestPath)) {
    console.error("❌ harvest.json not found. Run: npm run factory:harvest first.");
    process.exit(1);
  }

  const harvest = JSON.parse(fs.readFileSync(harvestPath, "utf8"));

  // Stats are computed first because they feed into the catalog header
  // and are used by the website's counts/badges. Simple length counts
  // plus a totalPrimitives rollup (excludes plays and modules — those
  // are structural, not standalone primitives).
  const stats = {
    agents: harvest.agents.length,
    skills: harvest.skills.length,
    instructions: harvest.instructions.length,
    hooks: harvest.hooks.length,
    plugins: harvest.plugins.length,
    workflows: harvest.workflows.length,
    cookbook: harvest.cookbook.length,
    plays: harvest.plays.length,
    modules: harvest.modules.length,
    mcpTools: harvest.mcpTools,
    totalPrimitives: harvest.agents.length + harvest.skills.length +
      harvest.instructions.length + harvest.hooks.length + harvest.plugins.length +
      harvest.workflows.length + harvest.cookbook.length,
  };

  // Cross-reference map: resolves which standalone primitives (from agents/,
  // skills/, etc.) are referenced by which solution plays via fai-manifest.json.
  // Paths starting with "../../" indicate a reference from a play's manifest
  // back to a standalone primitive in the repo root. This powers the "Used by"
  // badges on the website and validates that referenced primitives actually exist.
  const crossRefs = {};
  for (const play of harvest.plays) {
    if (!play.hasManifest) continue;
    const manifestPath = path.join(REPO_ROOT, "solution-plays", play.slug, "spec", "fai-manifest.json");
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const refs = [];
      const primitives = manifest.primitives || {};
      for (const type of ["agents", "instructions", "skills", "hooks"]) {
        const items = primitives[type] || [];
        for (const ref of items) {
          if (typeof ref === "string" && ref.startsWith("../../")) {
            const cleanRef = ref.replace("../../", "").replace(/\/$/, "");
            refs.push(cleanRef);
            if (!crossRefs[cleanRef]) crossRefs[cleanRef] = { usedBy: [] };
            crossRefs[cleanRef].usedBy.push(play.id);
          }
        }
      }
    } catch {
      // manifest parse failed — skip
    }
  }

  // Compute embedded primitive totals
  const embeddedStats = harvest.plays.reduce(
    (acc, p) => ({
      agents: acc.agents + (p.devkit?.agents || 0),
      skills: acc.skills + (p.devkit?.skills || 0),
      instructions: acc.instructions + (p.devkit?.instructions || 0),
      hooks: acc.hooks + (p.devkit?.hooks || 0),
    }),
    { agents: 0, skills: 0, instructions: 0, hooks: 0 }
  );

  // Catalog assembly order: metadata (version, commit, timestamp) → stats →
  // embedded stats → cross-refs → raw primitive arrays. This order ensures
  // consumers can read the header to decide if the catalog is fresh before
  // parsing the larger primitive arrays.
  const catalog = {
    version: readVersion(),
    generated: new Date().toISOString(),
    commit: gitShortSha(),
    stats,
    embeddedStats,
    crossRefCount: Object.keys(crossRefs).length,

    agents: harvest.agents,
    skills: harvest.skills,
    instructions: harvest.instructions,
    hooks: harvest.hooks,
    plugins: harvest.plugins,
    workflows: harvest.workflows,
    cookbook: harvest.cookbook,
    plays: harvest.plays,
    modules: harvest.modules,
    mcpTools: harvest.mcpTools,
    crossRefs,
  };

  // Write catalog
  const catalogPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");

  // Backup previous catalog for diff
  if (fs.existsSync(catalogPath)) {
    const prevPath = path.join(REPO_ROOT, ".factory", "fai-catalog.prev.json");
    fs.copyFileSync(catalogPath, prevPath);
    console.log("  📦 Previous catalog backed up to fai-catalog.prev.json");
  }

  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  const sizeKB = Math.round(fs.statSync(catalogPath).size / 1024);

  console.log(`\n  📊 CATALOG SUMMARY`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Version:      ${catalog.version}`);
  console.log(`  Commit:       ${catalog.commit}`);
  console.log(`  Generated:    ${catalog.generated}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Standalone Primitives:`);
  console.log(`    Agents:       ${stats.agents}`);
  console.log(`    Skills:       ${stats.skills}`);
  console.log(`    Instructions: ${stats.instructions}`);
  console.log(`    Hooks:        ${stats.hooks}`);
  console.log(`    Plugins:      ${stats.plugins}`);
  console.log(`    Workflows:    ${stats.workflows}`);
  console.log(`    Cookbook:      ${stats.cookbook}`);
  console.log(`    TOTAL:        ${stats.totalPrimitives}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Embedded (in ${stats.plays} plays):`);
  console.log(`    Agents:       ${embeddedStats.agents}`);
  console.log(`    Skills:       ${embeddedStats.skills}`);
  console.log(`    Instructions: ${embeddedStats.instructions}`);
  console.log(`    Hooks:        ${embeddedStats.hooks}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Cross-refs:   ${Object.keys(crossRefs).length} standalone primitives used by plays`);
  console.log(`  MCP Tools:    ${stats.mcpTools}`);
  console.log(`  Modules:      ${stats.modules}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  📦 Written: .factory/fai-catalog.json (${sizeKB}KB)`);

  return catalog;
}

if (require.main === module) {
  catalog();
}

module.exports = { catalog };
