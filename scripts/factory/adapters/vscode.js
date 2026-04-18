#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — VS Code Extension Adapter
 * Updates VS Code extension channel from fai-catalog.json:
 *   1. Generates data/plays.ts from catalog plays
 *   2. Updates package.json description with live counts
 *
 * Usage: node scripts/factory/adapters/vscode.js
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../../..");

/**
 * Map a catalog play entry to the SolutionPlay TypeScript interface.
 * @param {object} play - A play from fai-catalog.json
 * @returns {object}
 */
function mapPlayToTs(play) {
  return {
    id: play.id,
    name: play.name || play.slug.replace(/^\d+-/, "").replace(/-/g, " "),
    codicon: "symbol-method",
    status: "Ready",
    dir: play.slug,
    layer: inferLayer(play),
    desc: play.description ? play.description.split("—").pop()?.trim().substring(0, 120) || "" : "",
    cx: inferComplexity(play),
    infra: inferInfra(play),
    cat: inferCategory(play),
    slug: play.slug,
    tagline: play.description?.substring(0, 200) || "",
    pattern: play.speckit?.scope?.replace(/-/g, " ") || "",
    devkit: formatDevkit(play.devkit),
    tunekit: formatTunekit(play.tunekit),
    tuningParams: formatTuningParams(play.tunekit),
    costDev: "",
    costProd: "",
  };
}

function inferLayer(play) {
  const slug = play.slug.toLowerCase();
  if (slug.includes("rag") || slug.includes("search") || slug.includes("prompt")) return "R";
  if (slug.includes("landing") || slug.includes("infra") || slug.includes("aks") || slug.includes("gateway")) return "O";
  if (slug.includes("fine-tun") || slug.includes("responsible") || slug.includes("production")) return "T";
  return "O";
}

function inferComplexity(play) {
  const dk = play.devkit || {};
  const total = (dk.agents || 0) + (dk.skills || 0) + (dk.instructions || 0);
  if (total >= 10) return "High";
  if (total >= 5) return "Medium";
  return "Low";
}

function inferInfra(play) {
  const waf = play.speckit?.waf || [];
  const parts = [];
  if (play.slug.includes("openai") || play.slug.includes("rag")) parts.push("Azure OpenAI");
  if (play.slug.includes("search") || play.slug.includes("rag")) parts.push("AI Search");
  if (play.slug.includes("aks")) parts.push("AKS");
  if (play.slug.includes("container") || play.slug.includes("app")) parts.push("Container Apps");
  if (play.infrastructure?.bicep) parts.push("Bicep IaC");
  return parts.join(" · ") || "Azure Services";
}

function inferCategory(play) {
  const slug = play.slug.toLowerCase();
  if (slug.includes("rag")) return "rag";
  if (slug.includes("agent") || slug.includes("swarm") || slug.includes("multi-agent")) return "agent";
  if (slug.includes("landing") || slug.includes("infra") || slug.includes("gateway")) return "infra";
  if (slug.includes("security") || slug.includes("compliance") || slug.includes("governance")) return "security";
  if (slug.includes("voice") || slug.includes("speech") || slug.includes("call")) return "voice";
  if (slug.includes("document") || slug.includes("ocr")) return "document";
  if (slug.includes("copilot") || slug.includes("teams")) return "copilot";
  if (slug.includes("monitor") || slug.includes("observ")) return "ops";
  if (slug.includes("cost") || slug.includes("optim")) return "cost";
  if (slug.includes("fine-tun") || slug.includes("mlops")) return "ml";
  if (slug.includes("mcp") || slug.includes("tool")) return "tools";
  if (slug.includes("prompt")) return "prompt";
  if (slug.includes("edge") || slug.includes("iot")) return "edge";
  return "other";
}

function formatDevkit(dk) {
  if (!dk) return [];
  const parts = [];
  if (dk.agents) parts.push(`${dk.agents} agents (builder/reviewer/tuner)`);
  if (dk.skills) parts.push(`${dk.skills} skills (deploy/evaluate/tune)`);
  if (dk.instructions) parts.push(`${dk.instructions} instructions`);
  if (dk.hooks) parts.push(`${dk.hooks} hooks (guardrails)`);
  return parts;
}

function formatTunekit(tk) {
  if (!tk) return [];
  const parts = [];
  if (tk.model) parts.push(`model: ${tk.model}`);
  if (tk.temperature !== null && tk.temperature !== undefined) parts.push(`temperature: ${tk.temperature}`);
  if (tk.maxTokens) parts.push(`max_tokens: ${tk.maxTokens}`);
  return parts;
}

function formatTuningParams(tk) {
  if (!tk) return [];
  const parts = [];
  if (tk.temperature !== null && tk.temperature !== undefined) parts.push(`temperature (${tk.temperature})`);
  if (tk.maxTokens) parts.push(`max_tokens (${tk.maxTokens})`);
  return parts;
}

function adapt(catalog) {
  const results = { channel: "vscode", updates: [] };

  // 1. Generate data/plays.ts
  const playsPath = path.join(REPO_ROOT, "vscode-extension", "src", "data", "plays.ts");
  if (fs.existsSync(path.dirname(playsPath))) {
    // Read existing file to preserve any manually-curated fields
    let existingPlays = {};
    if (fs.existsSync(playsPath)) {
      try {
        const content = fs.readFileSync(playsPath, "utf8");
        // Extract play objects by ID from existing file for field preservation
        const matches = content.matchAll(/id:\s*"(\d+)"/g);
        for (const m of matches) existingPlays[m[1]] = true;
      } catch { /* ignore parse errors */ }
    }

    const catalogPlays = catalog.plays.map(mapPlayToTs);

    // Read existing plays.ts to merge — we want to KEEP manually curated data
    // but UPDATE counts and add new plays
    if (Object.keys(existingPlays).length > 0) {
      // Existing file has plays — we'll add new ones that don't exist yet
      const existingIds = new Set(Object.keys(existingPlays));
      const newPlays = catalogPlays.filter((p) => !existingIds.has(p.id));
      if (newPlays.length > 0) {
        results.updates.push(`plays.ts — ${newPlays.length} new plays detected (manual merge needed)`);
      } else {
        results.updates.push(`plays.ts — all ${catalogPlays.length} plays already present`);
      }
    } else {
      // No existing plays — generate fresh
      const tsContent = `// @generated — This file is auto-generated by FAI Factory (scripts/factory/adapters/vscode.js)
// Do not edit manually. Run: npm run factory
// Generated: ${catalog.generated} | Commit: ${catalog.commit}

import type { SolutionPlay } from "../types";

export const SOLUTION_PLAYS: SolutionPlay[] = ${JSON.stringify(catalogPlays, null, 2)};
`;
      fs.writeFileSync(playsPath, tsContent);
      results.updates.push(`plays.ts — generated ${catalogPlays.length} plays`);
    }
  }

  // 2. Generate data/stats.ts
  const statsPath = path.join(REPO_ROOT, "vscode-extension", "src", "data", "stats.ts");
  if (fs.existsSync(path.dirname(statsPath))) {
    const statsTs = `// @generated — This file is auto-generated by FAI Factory
// Do not edit manually. Run: npm run factory
// Generated: ${catalog.generated}

export const STATS = ${JSON.stringify(catalog.stats, null, 2)} as const;

export const EMBEDDED_STATS = ${JSON.stringify(catalog.embeddedStats, null, 2)} as const;
`;
    fs.writeFileSync(statsPath, statsTs);
    results.updates.push(`stats.ts — generated (${catalog.stats.totalPrimitives} total primitives)`);
  }

  // 3. Update package.json description
  const pkgPath = path.join(REPO_ROOT, "vscode-extension", "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const s = catalog.stats;
    const oldDesc = pkg.description;
    // Update counts in description using regex
    pkg.description = pkg.description
      .replace(/\d+ solution plays/i, `${s.plays} solution plays`)
      .replace(/\d+\+ primitives/i, `${s.totalPrimitives}+ primitives`)
      .replace(/\d+ MCP tools/i, `${s.mcpTools} MCP tools`);
    if (pkg.description !== oldDesc) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
      results.updates.push(`package.json — description updated`);
    } else {
      results.updates.push(`package.json — description unchanged`);
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
