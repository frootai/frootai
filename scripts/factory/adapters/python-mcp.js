#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Python MCP Adapter
 * Updates python-mcp channel from fai-catalog.json:
 *   1. Copies updated knowledge.json
 *   2. Updates pyproject.toml description with live counts
 *
 * Usage: node scripts/factory/adapters/python-mcp.js
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../../..");

function updateTomlDescription(tomlPath, stats) {
  if (!fs.existsSync(tomlPath)) return false;
  let content = fs.readFileSync(tomlPath, "utf8");
  const original = content;
  content = content
    .replace(/\d+ tools/i, `${stats.mcpTools} tools`)
    .replace(/\d+ plays/i, `${stats.plays} plays`)
    .replace(/\d+\+ primitives/i, `${stats.totalPrimitives}+ primitives`);
  if (content !== original) {
    fs.writeFileSync(tomlPath, content);
    return true;
  }
  return false;
}

function adapt(catalog) {
  const results = { channel: "python-mcp", updates: [] };

  // 1. Copy knowledge.json (with ecosystem section injected by npm-mcp adapter)
  const srcKj = path.join(REPO_ROOT, "npm-mcp", "knowledge.json");
  const dstKj = path.join(REPO_ROOT, "python-mcp", "frootai_mcp", "knowledge.json");
  if (fs.existsSync(srcKj) && fs.existsSync(path.dirname(dstKj))) {
    fs.copyFileSync(srcKj, dstKj);
    results.updates.push("knowledge.json — copied from npm-mcp");
  }

  // 2. Copy search-index.json
  const srcSi = path.join(REPO_ROOT, "npm-mcp", "search-index.json");
  const dstSi = path.join(REPO_ROOT, "python-mcp", "frootai_mcp", "search-index.json");
  if (fs.existsSync(srcSi) && fs.existsSync(path.dirname(dstSi))) {
    fs.copyFileSync(srcSi, dstSi);
    results.updates.push("search-index.json — copied from npm-mcp");
  }

  // 3. Update pyproject.toml description
  const tomlPath = path.join(REPO_ROOT, "python-mcp", "pyproject.toml");
  if (updateTomlDescription(tomlPath, catalog.stats)) {
    results.updates.push(`pyproject.toml — description updated (${catalog.stats.mcpTools} tools, ${catalog.stats.plays} plays)`);
  } else {
    results.updates.push("pyproject.toml — description unchanged");
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
