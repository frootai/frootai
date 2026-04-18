#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — npm SDK Adapter
 * Updates npm-sdk channel from fai-catalog.json:
 *   1. Updates package.json description with live counts
 *
 * Usage: node scripts/factory/adapters/npm-sdk.js
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../../..");

function adapt(catalog) {
  const results = { channel: "npm-sdk", updates: [] };

  const pkgPath = path.join(REPO_ROOT, "npm-sdk", "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const s = catalog.stats;
    const oldDesc = pkg.description;
    pkg.description = pkg.description
      .replace(/\d+ solution plays/i, `${s.plays} solution plays`)
      .replace(/\d+\+ primitives/i, `${s.totalPrimitives}+ primitives`)
      .replace(/\d+ MCP tools/i, `${s.mcpTools} MCP tools`);
    if (pkg.description !== oldDesc) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
      results.updates.push(`package.json — description updated (${s.plays} plays, ${s.totalPrimitives}+ primitives)`);
    } else {
      results.updates.push("package.json — description unchanged");
    }
  }

  return results;
}

if (require.main === module) {
  const catalogPath = path.join(REPO_ROOT, ".factory", "fai-catalog.json");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const r = adapt(catalog);
  console.log(`  📦 ${r.channel}:`);
  r.updates.forEach((u) => console.log(`     ✅ ${u}`));
}

module.exports = { adapt };
