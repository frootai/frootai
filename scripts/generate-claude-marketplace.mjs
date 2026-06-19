#!/usr/bin/env node
/**
 * Generate a Claude Code plugin marketplace manifest exposing every FrootAI
 * skill, grouped into themed category plugins.
 *
 * Output: frootai/.claude-plugin/marketplace.json (the convention Claude Code
 * reads for `/plugin marketplace add frootai/frootai`).
 *
 * Additive + idempotent: reads skill folders only, never edits SKILL.md.
 * Re-run whenever skills change:
 *
 *   node scripts/generate-claude-marketplace.mjs
 */
import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, ".."); // frootai/
const OUT_DIR = join(ROOT, ".claude-plugin");
const OUT = join(OUT_DIR, "marketplace.json");

const SKILL_ROOTS = [join(ROOT, "skills"), join(ROOT, "solution-plays")];

/** Category buckets — first keyword match wins; `general` is the fallback. */
const CATEGORIES = [
  {
    id: "deploy-infra",
    name: "frootai-deploy-infra-skills",
    description:
      "FrootAI deploy & infrastructure skills — Bicep, containers, canary rollout, SSL, backup, and Azure provisioning.",
    keywords: ["deploy", "bicep", "docker", "container", "ssl", "canary", "backup", "infra", "terraform", "kubernetes", "aks", "helm", "registry"],
  },
  {
    id: "evaluation",
    name: "frootai-evaluation-skills",
    description: "FrootAI evaluation skills — benchmarking, test generation, load testing, SLA checks, and quality gates.",
    keywords: ["evaluat", "benchmark", "test", "load-test", "sla", "eval", "coverage", "groundedness", "quality"],
  },
  {
    id: "security",
    name: "frootai-security-skills",
    description: "FrootAI security skills — PII, RBAC, audit logging, compliance, content safety, threat modeling, and secrets.",
    keywords: ["security", "pii", "rbac", "audit", "complian", "content-safety", "threat", "secret", "guardrail", "managed-identity", "key-vault", "gdpr"],
  },
  {
    id: "mcp",
    name: "frootai-mcp-skills",
    description: "FrootAI MCP development skills — scaffold and generate Model Context Protocol servers across languages.",
    keywords: ["mcp"],
  },
  {
    id: "config",
    name: "frootai-configuration-skills",
    description: "FrootAI configuration skills — model selection, prompt management, feature flags, rate limits, and token budgets.",
    keywords: ["config", "model", "prompt", "feature-flag", "rate-limit", "token", "circuit-breaker", "structured-output", "streaming"],
  },
  {
    id: "data-search",
    name: "frootai-data-search-skills",
    description: "FrootAI data & search skills — vector indexes, chunking, embeddings, semantic cache, Cosmos, and webhooks.",
    keywords: ["vector", "chunk", "embedding", "cache", "semantic", "cosmos", "database", "sql", "webhook", "search", "index", "lakehouse", "etl", "data"],
  },
  {
    id: "observability",
    name: "frootai-observability-skills",
    description: "FrootAI observability skills — dashboards, health checks, incident runbooks, monitoring, and alerting.",
    keywords: ["observ", "dashboard", "health", "incident", "monitor", "alert", "app-insights", "telemetry", "log"],
  },
  {
    id: "agent-ops",
    name: "frootai-agent-ops-skills",
    description: "FrootAI agent-ops skills — agent chains, governance, evaluation loops, and multi-agent orchestration.",
    keywords: ["agent", "chain", "governance", "orchestrat", "swarm", "manifest", "human-in-the-loop"],
  },
  {
    id: "tuning",
    name: "frootai-tuning-optimization-skills",
    description: "FrootAI tuning & optimization skills — solution-play tuning, prompt optimization, cost and inference tuning.",
    keywords: ["tune", "optimiz", "fine-tun", "boost", "refactor", "inference"],
  },
  {
    id: "design-frontend",
    name: "frootai-design-frontend-skills",
    description: "FrootAI design & frontend skills — UI components, design systems, responsive layouts, and web scaffolding.",
    keywords: ["design", "frontend", "ui", "component", "react", "nextjs", "premium", "web-coder", "accessibility", "animation", "layout", "theme"],
  },
  {
    id: "docs-architecture",
    name: "frootai-docs-architecture-skills",
    description: "FrootAI documentation & architecture skills — ADRs, blueprints, diagrams, READMEs, and technical specs.",
    keywords: ["doc", "architecture", "adr", "blueprint", "diagram", "mermaid", "drawio", "plantuml", "readme", "tutorial", "spec", "changelog"],
  },
  {
    id: "general",
    name: "frootai-general-skills",
    description: "FrootAI general-purpose skills that complement the themed bundles.",
    keywords: [],
  },
];

/** Recursively find skill directories (dirs containing SKILL.md). */
function findSkillDirs(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  if (entries.includes("SKILL.md")) {
    out.push(dir);
    // A skill dir does not nest other skills; stop descending.
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory() && name !== "agents" && name !== "references" && name !== "assets" && name !== "scripts") {
      findSkillDirs(full, out);
    }
  }
  return out;
}

function categorize(name) {
  const n = name.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((k) => n.includes(k))) return cat.id;
  }
  return "general";
}

// Collect all skill dirs and bucket them.
const buckets = new Map(CATEGORIES.map((c) => [c.id, []]));
let total = 0;
for (const root of SKILL_ROOTS) {
  for (const dir of findSkillDirs(root)) {
    const name = basename(dir);
    const relPath = "./" + relative(ROOT, dir).split(/[\\/]/).join("/");
    buckets.get(categorize(name)).push({ name, relPath });
    total++;
  }
}

// Build plugin entries (skip empty categories), skills sorted for determinism.
const plugins = [];
for (const cat of CATEGORIES) {
  const items = buckets.get(cat.id).sort((a, b) => a.name.localeCompare(b.name));
  if (items.length === 0) continue;
  plugins.push({
    name: cat.name,
    description: `${cat.description} (${items.length} skills)`,
    source: "./",
    strict: false,
    skills: items.map((s) => s.relPath),
  });
}

const marketplace = {
  name: "frootai-skills",
  owner: { name: "FrootAI", email: "info@frootai.dev", url: "https://frootai.dev" },
  metadata: {
    description: `FrootAI Agent Skills — ${total} Azure/AI-native skills installable in Claude Code, grouped by domain.`,
    version: "1.0.0",
  },
  plugins,
};

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(marketplace, null, 2) + "\n", "utf8");
console.log(`Wrote ${OUT}`);
console.log(`  ${total} skills across ${plugins.length} plugins:`);
for (const p of plugins) console.log(`   - ${p.name}: ${p.skills.length}`);
