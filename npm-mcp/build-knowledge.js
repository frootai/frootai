/**
 * Build Script — Bundle FrootAI knowledge into a single JSON file
 * Run this before publishing to npm: node build-knowledge.js
 * 
 * This creates knowledge.json which embeds all 17 module contents,
 * so the MCP server works standalone via `npx frootai-mcp`.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const KNOWLEDGE_DIR = join(__dirname, "..", "docs");

const FROOT_MAP = {
  F: {
    name: "Foundations", emoji: "🌱", metaphor: "The Roots",
    modules: {
      F1: { file: "GenAI-Foundations.md", title: "GenAI Foundations" },
      F2: { file: "LLM-Landscape.md", title: "LLM Landscape & Model Selection" },
      F3: { file: "F3-AI-Glossary-AZ.md", title: "AI Glossary A–Z" },
      F4: { file: "F4-GitHub-Agentic-OS.md", title: ".github Agentic OS — 7 Primitives" },
    },
  },
  R: {
    name: "Reasoning", emoji: "🪵", metaphor: "The Trunk",
    modules: {
      R1: { file: "Prompt-Engineering.md", title: "Prompt Engineering & Grounding" },
      R2: { file: "RAG-Architecture.md", title: "RAG Architecture & Retrieval" },
      R3: { file: "R3-Deterministic-AI.md", title: "Making AI Deterministic & Reliable" },
    },
  },
  O_ORCH: {
    name: "Orchestration", emoji: "🌿", metaphor: "The Branches",
    modules: {
      O1: { file: "Semantic-Kernel.md", title: "Semantic Kernel & Orchestration" },
      O2: { file: "AI-Agents-Deep-Dive.md", title: "AI Agents & Microsoft Agent Framework" },
      O3: { file: "O3-MCP-Tools-Functions.md", title: "MCP, Tools & Function Calling" },
    },
  },
  O_OPS: {
    name: "Operations", emoji: "🏗️", metaphor: "The Canopy",
    modules: {
      O4: { file: "Azure-AI-Foundry.md", title: "Azure AI Platform & Landing Zones" },
      O5: { file: "AI-Infrastructure.md", title: "AI Infrastructure & Hosting" },
      O6: { file: "Copilot-Ecosystem.md", title: "Copilot Ecosystem & Low-Code AI" },
    },
  },
  T: {
    name: "Transformation", emoji: "🍎", metaphor: "The Fruit",
    modules: {
      T1: { file: "T1-Fine-Tuning-MLOps.md", title: "Fine-Tuning & Model Customization" },
      T2: { file: "Responsible-AI-Safety.md", title: "Responsible AI & Safety" },
      T3: { file: "T3-Production-Patterns.md", title: "Production Architecture Patterns" },
    },
  },
};

console.log("📦 Building FrootAI knowledge bundle...\n");

const bundle = { version: "1.0.0", built: new Date().toISOString(), layers: {}, modules: {} };
let totalSize = 0;

for (const [layerKey, layer] of Object.entries(FROOT_MAP)) {
  bundle.layers[layerKey] = { name: layer.name, emoji: layer.emoji, metaphor: layer.metaphor, moduleIds: Object.keys(layer.modules) };
  
  for (const [modId, mod] of Object.entries(layer.modules)) {
    const filePath = join(KNOWLEDGE_DIR, mod.file);
    let content = "";
    if (existsSync(filePath)) {
      content = readFileSync(filePath, "utf-8");
      const sizeKB = (Buffer.byteLength(content) / 1024).toFixed(1);
      console.log(`  ✅ ${modId}: ${mod.title} (${sizeKB} KB)`);
      totalSize += Buffer.byteLength(content);
    } else {
      console.log(`  ⚠️  ${modId}: ${mod.file} NOT FOUND`);
    }
    bundle.modules[modId] = { id: modId, title: mod.title, layer: layer.name, emoji: layer.emoji, metaphor: layer.metaphor, content };
  }
}

const outPath = join(__dirname, "knowledge.json");
writeFileSync(outPath, JSON.stringify(bundle));

const bundleSizeKB = (Buffer.byteLength(JSON.stringify(bundle)) / 1024).toFixed(0);
console.log(`\n📦 Bundle created: knowledge.json (${bundleSizeKB} KB, ${Object.keys(bundle.modules).length} modules)`);
console.log("✅ Ready to publish: npm publish");
