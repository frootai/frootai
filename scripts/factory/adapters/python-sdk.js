#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Python SDK Adapter
 * Updates python-sdk channel from fai-catalog.json:
 *   1. Copies knowledge.json
 *   2. Updates pyproject.toml description with live counts
 *
 * Usage: node scripts/factory/adapters/python-sdk.js
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../../..");

function adapt(catalog) {
  const results = { channel: "python-sdk", updates: [] };

  // 1. Copy knowledge.json
  const srcKj = path.join(REPO_ROOT, "npm-mcp", "knowledge.json");
  const dstKj = path.join(REPO_ROOT, "python-sdk", "frootai", "knowledge.json");
  if (fs.existsSync(srcKj) && fs.existsSync(path.dirname(dstKj))) {
    fs.copyFileSync(srcKj, dstKj);
    results.updates.push("knowledge.json — copied from npm-mcp");
  }

  // 2. Copy search-index.json
  const srcSi = path.join(REPO_ROOT, "npm-mcp", "search-index.json");
  const dstSi = path.join(REPO_ROOT, "python-sdk", "frootai", "search-index.json");
  if (fs.existsSync(srcSi) && fs.existsSync(path.dirname(dstSi))) {
    fs.copyFileSync(srcSi, dstSi);
    results.updates.push("search-index.json — copied from npm-mcp");
  }

  // 3. Update pyproject.toml description
  const tomlPath = path.join(REPO_ROOT, "python-sdk", "pyproject.toml");
  if (fs.existsSync(tomlPath)) {
    let content = fs.readFileSync(tomlPath, "utf8");
    const original = content;
    const s = catalog.stats;
    content = content
      .replace(/\d+ solution plays/i, `${s.plays} solution plays`)
      .replace(/\d+\+ primitives/i, `${s.totalPrimitives}+ primitives`)
      .replace(/\d+ MCP tools/i, `${s.mcpTools} MCP tools`);
    if (content !== original) {
      fs.writeFileSync(tomlPath, content);
      results.updates.push(`pyproject.toml — description updated`);
    } else {
      results.updates.push("pyproject.toml — description unchanged");
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
