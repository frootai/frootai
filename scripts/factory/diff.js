#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Differ
 * Compares current fai-catalog.json vs previous version.
 * Detects added, removed, and modified primitives.
 *
 * Usage:
 *   node scripts/factory/diff.js
 *
 * Input:  .factory/fai-catalog.json, .factory/fai-catalog.prev.json
 * Output: .factory/changes.json + console summary
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../..");

function diff() {
  console.log("🔍 FAI Factory — Differ");
  console.log("══════════════════════════════════════");

  const catalogPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  const prevPath = path.join(REPO_ROOT, ".factory", "fai-catalog.prev.json");

  if (!fs.existsSync(catalogPath)) {
    console.error("❌ fai-catalog.json not found. Run: npm run factory:catalog first.");
    process.exit(1);
  }

  const current = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

  if (!fs.existsSync(prevPath)) {
    console.log("  ℹ️  No previous catalog found — this is the first run.");
    console.log("  All primitives treated as 'added'.\n");

    const changes = {
      isFirstRun: true,
      generated: new Date().toISOString(),
      stats: {
        current: current.stats,
        previous: null,
        delta: current.stats,
      },
      added: {
        agents: current.stats.agents,
        skills: current.stats.skills,
        instructions: current.stats.instructions,
        hooks: current.stats.hooks,
        plugins: current.stats.plugins,
        workflows: current.stats.workflows,
        cookbook: current.stats.cookbook,
        plays: current.stats.plays,
      },
      removed: {},
      modified: {},
    };

    const outPath = path.join(REPO_ROOT, ".factory", "changes.json");
    fs.writeFileSync(outPath, JSON.stringify(changes, null, 2));
    console.log(`  📦 Written: .factory/changes.json`);
    return changes;
  }

  const previous = JSON.parse(fs.readFileSync(prevPath, "utf8"));

  /**
   * Compare two arrays of objects by id field.
   * @param {Array<{id: string}>} prevArr
   * @param {Array<{id: string}>} currArr
   * @param {string} type
   */
  function compareArrays(prevArr, currArr, type) {
    const prevIds = new Set(prevArr.map((x) => x.id));
    const currIds = new Set(currArr.map((x) => x.id));

    const added = [...currIds].filter((id) => !prevIds.has(id));
    const removed = [...prevIds].filter((id) => !currIds.has(id));

    return { added, removed, addedCount: added.length, removedCount: removed.length };
  }

  const TYPES = ["agents", "skills", "instructions", "hooks", "plugins", "workflows", "cookbook", "plays"];

  const changes = {
    isFirstRun: false,
    generated: new Date().toISOString(),
    previousCommit: previous.commit,
    currentCommit: current.commit,
    stats: {
      current: current.stats,
      previous: previous.stats,
      delta: {},
    },
    details: {},
    summary: { totalAdded: 0, totalRemoved: 0 },
  };

  // Compute stat deltas
  for (const key of Object.keys(current.stats)) {
    const curr = current.stats[key] || 0;
    const prev = previous.stats?.[key] || 0;
    changes.stats.delta[key] = curr - prev;
  }

  // Compare each primitive type
  for (const type of TYPES) {
    const prev = previous[type] || [];
    const curr = current[type] || [];
    const result = compareArrays(prev, curr, type);
    changes.details[type] = result;
    changes.summary.totalAdded += result.addedCount;
    changes.summary.totalRemoved += result.removedCount;
  }

  // Print summary
  console.log(`\n  📊 CHANGE SUMMARY (${previous.commit} → ${current.commit})`);
  console.log(`  ─────────────────────────────────────`);

  let hasChanges = false;
  for (const type of TYPES) {
    const d = changes.details[type];
    if (d.addedCount > 0 || d.removedCount > 0) {
      hasChanges = true;
      const parts = [];
      if (d.addedCount > 0) parts.push(`+${d.addedCount} added`);
      if (d.removedCount > 0) parts.push(`-${d.removedCount} removed`);
      console.log(`  ${type.padEnd(15)} ${parts.join(", ")}`);
      if (d.addedCount > 0 && d.addedCount <= 5) {
        d.added.forEach((id) => console.log(`    + ${id}`));
      }
      if (d.removedCount > 0 && d.removedCount <= 5) {
        d.removed.forEach((id) => console.log(`    - ${id}`));
      }
    }
  }

  if (!hasChanges) {
    console.log("  No changes detected.");
  }

  // Stat deltas
  console.log(`\n  📈 STAT DELTAS`);
  console.log(`  ─────────────────────────────────────`);
  for (const [key, delta] of Object.entries(changes.stats.delta)) {
    if (delta !== 0) {
      const sign = delta > 0 ? "+" : "";
      console.log(`  ${key.padEnd(18)} ${sign}${delta} (${previous.stats?.[key] || 0} → ${current.stats[key]})`);
    }
  }

  const outPath = path.join(REPO_ROOT, ".factory", "changes.json");
  fs.writeFileSync(outPath, JSON.stringify(changes, null, 2));
  console.log(`\n  📦 Written: .factory/changes.json`);

  return changes;
}

if (require.main === module) {
  diff();
}

module.exports = { diff };
