#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — npm-mcp Adapter
 * Updates npm-mcp channel from fai-catalog.json:
 *   1. Injects ecosystem section into knowledge.json
 *   2. Updates package.json description with live counts
 *
 * Usage: node scripts/factory/adapters/npm-mcp.js
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../../..");

function adapt(catalog) {
  const results = { channel: "npm-mcp", updates: [] };

  // 1. Inject ecosystem stats into knowledge.json
  const kjPath = path.join(REPO_ROOT, "npm-mcp", "knowledge.json");
  if (fs.existsSync(kjPath)) {
    const kj = JSON.parse(fs.readFileSync(kjPath, "utf8"));
    kj.ecosystem = {
      generated: catalog.generated,
      commit: catalog.commit,
      stats: catalog.stats,
      embeddedStats: catalog.embeddedStats,
      crossRefCount: catalog.crossRefCount,
    };
    fs.writeFileSync(kjPath, JSON.stringify(kj));
    results.updates.push("knowledge.json — ecosystem section injected");
  }

  // 2. Update package.json description with live counts
  const pkgPath = path.join(REPO_ROOT, "npm-mcp", "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const s = catalog.stats;
    pkg.description = `FrootAI™ MCP Server — The open glue for the GenAI ecosystem. ${s.mcpTools} MCP tools, ${s.plays} solution plays, ${s.totalPrimitives}+ primitives. HTTP/stdio transport, Node.js 18+. For CLI commands use the \`frootai\` package.`;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    results.updates.push(`package.json — description updated (${s.mcpTools} tools, ${s.plays} plays, ${s.totalPrimitives}+ primitives)`);
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
