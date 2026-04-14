#!/usr/bin/env node

/**
 * FrootAI MCP Server — FAI Engine Runtime Interface
 * --------------------------------------------------
 * The MCP server IS the FAI Engine's network interface.
 * Knowledge tools + FAI Engine tools + Resources + Prompts.
 *
 * Usage:
 *   npx frootai-mcp          # Run directly
 *   node index.js             # Run from source (with engine)
 *
 * MCP Config (Claude Desktop / VS Code):
 *   {
 *     "mcpServers": {
 *       "frootai": {
 *         "command": "npx",
 *         "args": ["frootai-mcp@latest"]
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync as writeFileSync_fn, statSync as statSync_fn } from "fs";
import { join, dirname, basename, resolve } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── FAI Engine Bridge (CommonJS → ESM) ───────────────────────────
// The engine is CommonJS; this server is ESM. createRequire() bridges them.
// When running from repo: engine/ is available → engine tools register.
// When running via npx: engine/ not shipped → graceful degradation.

let faiEngine = null;
try {
  const esmRequire = createRequire(import.meta.url);
  const engineBridge = esmRequire('../engine/mcp-bridge.js');
  const engineIndex = esmRequire('../engine/index.js');
  const engineEvaluator = esmRequire('../engine/evaluator.js');
  const engineManifest = esmRequire('../engine/manifest-reader.js');
  const engineContext = esmRequire('../engine/context-resolver.js');
  const engineWirer = esmRequire('../engine/primitive-wirer.js');

  faiEngine = {
    available: true,
    runPlay: engineBridge.runPlay,
    findManifest: engineBridge.findManifest,
    initEngine: engineIndex.initEngine,
    createEvaluator: engineEvaluator.createEvaluator,
    loadManifest: engineManifest.loadManifest,
    resolvePaths: engineManifest.resolvePaths,
    buildContext: engineContext.buildContext,
    wirePrimitives: engineWirer.wirePrimitives,
    loadPrimitive: engineWirer.loadPrimitive,
  };
} catch (err) {
  // Engine not available (npm distribution mode — engine/ not shipped in package)
  faiEngine = { available: false, reason: err.message };
}

// ─── Production Middleware (Phase 3) ──────────────────────────────

/** LRU Cache with TTL — avoids re-computing on repeated calls */
class LRUCache {
  constructor(maxSize = 100, defaultTTLMs = 300_000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTLMs;
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) { this.misses++; return undefined; }
    if (Date.now() > entry.expiresAt) { this.cache.delete(key); this.misses++; return undefined; }
    this.cache.delete(key); this.cache.set(key, entry); // move to end (LRU)
    this.hits++;
    return entry.value;
  }

  set(key, value, ttlMs) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.defaultTTL) });
  }

  stats() {
    const total = this.hits + this.misses;
    return { size: this.cache.size, hits: this.hits, misses: this.misses, hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : '0%' };
  }
}

/** Token bucket rate limiter — protects external APIs */
class RateLimiter {
  constructor(maxTokens = 10, refillPerSec = 1) {
    this.buckets = new Map();
    this.maxTokens = maxTokens;
    this.refillPerSec = refillPerSec;
  }

  allow(key) {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) { bucket = { tokens: this.maxTokens, lastRefill: now }; this.buckets.set(key, bucket); }
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsed * this.refillPerSec);
    bucket.lastRefill = now;
    if (bucket.tokens >= 1) { bucket.tokens -= 1; return true; }
    return false;
  }
}

/** Standardized MCP error responses */
function mcpError(message, details) {
  return { content: [{ type: "text", text: details ? `❌ ${message}\n\n${details}` : `❌ ${message}` }], isError: true };
}

function mcpNotFound(entity, id) {
  return { content: [{ type: "text", text: `❌ ${entity} "${id}" not found.` }], isError: true };
}

// Initialize middleware
const searchCache = new LRUCache(50, 5 * 60_000);       // 5 min TTL
const azureDocsCache = new LRUCache(30, 60 * 60_000);   // 1 hour TTL
const mcpRegistryCache = new LRUCache(20, 60 * 60_000); // 1 hour TTL
const githubPlaysCache = new LRUCache(5, 5 * 60_000);   // 5 min TTL

const liveLimiter = new RateLimiter(10, 1);  // 10 req burst, 1/sec refill

// ─── Knowledge Base Loader ─────────────────────────────────────────
// Two modes:
//   1. BUNDLED (npx frootai-mcp) — reads from knowledge.json shipped in the package
//   2. LOCAL (node index.js from repo) — reads .md files from ../aifroot/

const KNOWLEDGE_BUNDLE = join(__dirname, "knowledge.json");
const KNOWLEDGE_DIR = join(__dirname, "..", "docs");

/** Module metadata keyed by FROOT layer */
const FROOT_MAP = {
  F: {
    name: "Foundations",
    emoji: "🌱",
    metaphor: "The Roots",
    modules: {
      F1: { file: "GenAI-Foundations.md", title: "GenAI Foundations" },
      F2: { file: "LLM-Landscape.md", title: "LLM Landscape & Model Selection" },
      F3: { file: "F3-AI-Glossary-AZ.md", title: "AI Glossary A–Z" },
      F4: { file: "F4-GitHub-Agentic-OS.md", title: ".github Agentic OS — 7 Primitives" },
    },
  },
  R: {
    name: "Reasoning",
    emoji: "🪵",
    metaphor: "The Trunk",
    modules: {
      R1: { file: "Prompt-Engineering.md", title: "Prompt Engineering & Grounding" },
      R2: { file: "RAG-Architecture.md", title: "RAG Architecture & Retrieval" },
      R3: { file: "R3-Deterministic-AI.md", title: "Making AI Deterministic & Reliable" },
    },
  },
  O_ORCH: {
    name: "Orchestration",
    emoji: "🌿",
    metaphor: "The Branches",
    modules: {
      O1: { file: "Semantic-Kernel.md", title: "Semantic Kernel & Orchestration" },
      O2: { file: "AI-Agents-Deep-Dive.md", title: "AI Agents & Microsoft Agent Framework" },
      O3: { file: "O3-MCP-Tools-Functions.md", title: "MCP, Tools & Function Calling" },
    },
  },
  O_OPS: {
    name: "Operations",
    emoji: "🏗️",
    metaphor: "The Canopy",
    modules: {
      O4: { file: "Azure-AI-Foundry.md", title: "Azure AI Platform & Landing Zones" },
      O5: { file: "AI-Infrastructure.md", title: "AI Infrastructure & Hosting" },
      O6: { file: "Copilot-Ecosystem.md", title: "Copilot Ecosystem & Low-Code AI" },
    },
  },
  T: {
    name: "Transformation",
    emoji: "🍎",
    metaphor: "The Fruit",
    modules: {
      T1: { file: "T1-Fine-Tuning-MLOps.md", title: "Fine-Tuning & Model Customization" },
      T2: { file: "Responsible-AI-Safety.md", title: "Responsible AI & Safety" },
      T3: { file: "T3-Production-Patterns.md", title: "Production Architecture Patterns" },
    },
  },
};

/**
 * Load modules — tries bundled JSON first (for npx), falls back to local files (for repo)
 */
function loadModules() {
  // Mode 1: Bundled knowledge.json (for npm/npx distribution)
  if (existsSync(KNOWLEDGE_BUNDLE)) {
    const bundle = JSON.parse(readFileSync(KNOWLEDGE_BUNDLE, "utf-8"));
    const modules = {};
    for (const [modId, mod] of Object.entries(bundle.modules)) {
      modules[modId] = { ...mod, sections: parseSections(mod.content) };
    }
    return modules;
  }

  // Mode 2: Local markdown files (for development from repo)
  const modules = {};
  for (const [layerKey, layer] of Object.entries(FROOT_MAP)) {
    for (const [modId, mod] of Object.entries(layer.modules)) {
      const filePath = join(KNOWLEDGE_DIR, mod.file);
      let content = "";
      if (existsSync(filePath)) {
        content = readFileSync(filePath, "utf-8");
      }
      modules[modId] = {
        id: modId,
        title: mod.title,
        layer: layer.name,
        emoji: layer.emoji,
        metaphor: layer.metaphor,
        file: mod.file,
        content,
        sections: parseSections(content),
      };
    }
  }
  return modules;
}

/**
 * Parse markdown into sections by ## headings
 */
function parseSections(markdown) {
  const sections = [];
  const lines = markdown.split("\n");
  let currentTitle = "";
  let currentContent = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);
    if (h2Match) {
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
      }
      currentTitle = h2Match[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
  }
  return sections;
}

/**
 * Extract glossary terms from F3 module
 */
function loadGlossary(modules) {
  const glossary = {};
  const f3 = modules.F3;
  if (!f3) return glossary;

  const lines = f3.content.split("\n");
  let currentTerm = null;
  let currentDef = [];

  for (const line of lines) {
    // Match ### headings, strip any trailing emoji tags
    const termMatch = line.match(/^### (.+)/);
    if (termMatch) {
      if (currentTerm) {
        glossary[currentTerm.toLowerCase()] = {
          term: currentTerm,
          definition: currentDef.join("\n").trim(),
        };
      }
      // Strip emoji tags like 🌱🪵🌿🏗️🍎 from the end of the term name
      currentTerm = termMatch[1].replace(/\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]+\s*$/u, "").trim();
      currentDef = [];
    } else if (currentTerm) {
      currentDef.push(line);
    }
  }
  if (currentTerm) {
    glossary[currentTerm.toLowerCase()] = {
      term: currentTerm,
      definition: currentDef.join("\n").trim(),
    };
  }
  return glossary;
}

// ─── Initialize Knowledge Base ─────────────────────────────────────

const modules = loadModules();
const glossary = loadGlossary(modules);

// ─── MCP Server ────────────────────────────────────────────────────

const PKG_VERSION = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8")).version;

/** Create and register all tools/resources/prompts on a McpServer instance */
function createConfiguredServer() {
  const server = new McpServer({
    name: "frootai",
    version: PKG_VERSION,
  });

// ── Tool: list_modules ─────────────────────────────────────────────

server.tool(
  "list_modules",
  "List all FrootAI modules organized by FROOT layer (Foundations, Reasoning, Orchestration, Operations, Transformation). Use this to explore the knowledge base structure.",
  {},
  async () => {
    const result = [];
    for (const [layerKey, layer] of Object.entries(FROOT_MAP)) {
      const mods = Object.entries(layer.modules).map(([id, m]) => `  ${id}: ${m.title}`);
      result.push(`${layer.emoji} ${layer.name} — ${layer.metaphor}\n${mods.join("\n")}`);
    }
    return {
      content: [
        {
          type: "text",
          text: `FrootAI Knowledge Base — 16 Modules\n${"═".repeat(45)}\n\n${result.join("\n\n")}\n\n📋 Reference\n  REF: Quick Reference Cards\n  QUIZ: Quiz & Assessment\n\nUse get_module to read any module. Use search_knowledge to search across all modules.\n\n🔌 Live tools: fetch_azure_docs, fetch_external_mcp, list_community_plays, get_github_agentic_os`,
        },
      ],
    };
  }
);

// ── Tool: get_module ───────────────────────────────────────────────

server.tool(
  "get_module",
  "Get the full content of a FrootAI module by its ID (F1, F2, F3, R1, R2, R3, O1, O2, O3, O4, O5, O6, T1, T2, T3). Returns the complete module with all sections.",
  {
    module_id: z
      .string()
      .describe(
        "Module ID: F1 (GenAI Foundations), F2 (LLMs), F3 (Glossary), F4 (.github Agentic OS), R1 (Prompts), R2 (RAG), R3 (Deterministic AI), O1 (Semantic Kernel), O2 (Agents), O3 (MCP/Tools), O4 (Azure AI), O5 (Infra), O6 (Copilot), T1 (Fine-Tuning), T2 (Responsible AI), T3 (Production)"
      ),
    section: z
      .string()
      .optional()
      .describe("Optional: specific section title to retrieve (e.g., 'Key Takeaways')"),
  },
  async ({ module_id, section }) => {
    const id = module_id.toUpperCase();
    const mod = modules[id];

    if (!mod) {
      return {
        content: [
          {
            type: "text",
            text: `Module "${module_id}" not found. Valid IDs: ${Object.keys(modules).join(", ")}`,
          },
        ],
      };
    }

    if (section) {
      const sec = mod.sections.find(
        (s) => s.title.toLowerCase().includes(section.toLowerCase())
      );
      if (sec) {
        return {
          content: [
            {
              type: "text",
              text: `## ${sec.title}\n*From ${mod.emoji} ${mod.title} (${mod.layer})*\n\n${sec.content}`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Section "${section}" not found in ${mod.title}. Available sections:\n${mod.sections.map((s) => `  - ${s.title}`).join("\n")}`,
          },
        ],
      };
    }

    // Return full module (may be long, truncate if needed)
    const content = mod.content.length > 15000
      ? mod.content.substring(0, 15000) + "\n\n... [truncated — use section parameter to get specific parts]"
      : mod.content;

    return {
      content: [{ type: "text", text: content }],
    };
  }
);

// ── Tool: lookup_term ──────────────────────────────────────────────

server.tool(
  "lookup_term",
  "Look up an AI/ML term in the FrootAI Glossary (200+ terms). Returns the definition with context. Examples: 'token', 'RAG', 'temperature', 'LoRA', 'MCP', 'hallucination', 'embeddings'.",
  {
    term: z.string().describe("The AI/ML term to look up (e.g., 'transformer', 'top-k', 'fine-tuning')"),
  },
  async ({ term }) => {
    const key = term.toLowerCase().trim();

    // Direct match
    if (glossary[key]) {
      const g = glossary[key];
      return {
        content: [
          {
            type: "text",
            text: `### ${g.term}\n\n${g.definition}\n\n---\n*Source: FrootAI Glossary A–Z (Module F3)*`,
          },
        ],
      };
    }

    // Fuzzy match — find terms containing the search string
    const matches = Object.entries(glossary)
      .filter(([k, v]) => k.includes(key) || v.term.toLowerCase().includes(key))
      .slice(0, 5);

    if (matches.length > 0) {
      const results = matches
        .map(([k, v]) => `### ${v.term}\n\n${v.definition}`)
        .join("\n\n---\n\n");
      return {
        content: [
          {
            type: "text",
            text: `Found ${matches.length} matching term(s) for "${term}":\n\n${results}\n\n---\n*Source: FrootAI Glossary A–Z (Module F3)*`,
          },
        ],
      };
    }

    // No match — suggest searching modules
    return {
      content: [
        {
          type: "text",
          text: `Term "${term}" not found in glossary. Try search_knowledge for a full-text search across all modules, or browse available terms with get_module module_id=F3.`,
        },
      ],
    };
  }
);

// ── Tool: search_knowledge ─────────────────────────────────────────

server.tool(
  "search_knowledge",
  "Search across all 17 FrootAI modules for a topic. Returns relevant sections matching the query. Use for questions like 'how to reduce hallucination', 'GPU sizing for AI', 'when to use Semantic Kernel vs Agent Framework'.",
  {
    query: z.string().describe("Natural language search query about AI architecture, patterns, or concepts"),
    max_results: z
      .number()
      .optional()
      .default(5)
      .describe("Maximum number of matching sections to return (default: 5)"),
  },
  async ({ query, max_results = 5 }) => {
    // Check cache first
    const cacheKey = `search:${query}:${max_results}`;
    const cached = searchCache.get(cacheKey);
    if (cached) return cached;

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

    // Score each section across all modules
    const scored = [];
    for (const mod of Object.values(modules)) {
      for (const section of mod.sections) {
        const text = (section.title + " " + section.content).toLowerCase();
        let score = 0;

        // Exact phrase match (highest value)
        if (text.includes(queryLower)) score += 10;

        // Individual word matches
        for (const word of queryWords) {
          const regex = new RegExp(word, "gi");
          const matches = text.match(regex);
          if (matches) score += matches.length;
        }

        // Title match bonus
        if (section.title.toLowerCase().includes(queryLower)) score += 20;
        for (const word of queryWords) {
          if (section.title.toLowerCase().includes(word)) score += 5;
        }

        if (score > 0) {
          scored.push({
            moduleId: mod.id,
            moduleTitle: mod.title,
            layer: `${mod.emoji} ${mod.layer}`,
            sectionTitle: section.title,
            score,
            preview: section.content.substring(0, 500) + (section.content.length > 500 ? "..." : ""),
          });
        }
      }
    }

    // Sort by score, take top N
    scored.sort((a, b) => b.score - a.score);
    const topResults = scored.slice(0, max_results);

    if (topResults.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No results found for "${query}". Try broader terms or use list_modules to browse available topics.`,
          },
        ],
      };
    }

    const resultText = topResults
      .map(
        (r, i) =>
          `### ${i + 1}. ${r.sectionTitle}\n*${r.layer} → ${r.moduleTitle} (${r.moduleId})*\n\n${r.preview}`
      )
      .join("\n\n---\n\n");

    const response = {
      content: [
        {
          type: "text",
          text: `Found ${scored.length} relevant sections for "${query}". Top ${topResults.length}:\n\n${resultText}\n\n---\nUse get_module with module_id and section to read the full content.`,
        },
      ],
    };

    // Cache the result
    searchCache.set(cacheKey, response);
    return response;
  }
);

// ── Tool: get_architecture_pattern ─────────────────────────────────

server.tool(
  "get_architecture_pattern",
  "Get AI architecture guidance for a specific scenario. Combines knowledge from multiple modules to give actionable recommendations. Scenarios: 'rag_pipeline', 'agent_hosting', 'model_selection', 'cost_optimization', 'deterministic_ai', 'multi_agent', 'fine_tuning_decision'.",
  {
    scenario: z
      .enum([
        "rag_pipeline",
        "agent_hosting",
        "model_selection",
        "cost_optimization",
        "deterministic_ai",
        "multi_agent",
        "fine_tuning_decision",
      ])
      .describe("The architecture scenario to get guidance for"),
  },
  async ({ scenario }) => {
    const patterns = {
      rag_pipeline: {
        title: "RAG Pipeline Architecture",
        modules: ["R2", "R1", "R3"],
        guidance: `## RAG Pipeline — Architecture Decision Guide

**When to use RAG:** When your AI needs to answer questions about YOUR data (not general knowledge).

### Pipeline Flow
Query → Embed → Search (Vector + Keyword) → Rerank → Augment Prompt → Generate → Validate

### Key Design Decisions
| Decision | Recommendation | Why |
|----------|---------------|-----|
| Chunk size | 512 tokens | Balances specificity and context |
| Overlap | 10-20% | Prevents information loss at boundaries |
| Search type | Hybrid (vector + BM25) | Outperforms either alone |
| Reranking | Always use it | 20-40% quality improvement |
| Top-K | 5-10 chunks | Enough context without noise |
| Relevance threshold | 0.8+ cosine | Filters irrelevant matches |

### Azure Services
- **Azure AI Search**: Hybrid search, semantic ranking, vector index
- **Azure OpenAI**: Embedding model (text-embedding-3-large) + completion model
- **Azure Blob Storage**: Document storage
- **Azure AI Document Intelligence**: PDF/image extraction

📖 Deep-dive: Modules R2, R1, R3`,
      },
      agent_hosting: {
        title: "Agent Hosting Patterns",
        modules: ["T3", "O2", "O5"],
        guidance: `## Agent Hosting — Where Should Your Agents Live?

### Decision Matrix
| Criterion | Container Apps | AKS | App Service | Functions |
|-----------|---------------|-----|-------------|-----------|
| Complexity | Low-Medium | High | Low | Low |
| Auto-scale 0→N | ✅ | ✅ | ⚠️ | ✅ |
| GPU | ✅ Preview | ✅ | ❌ | ❌ |
| Long-running | ✅ | ✅ | ✅ | ⚠️ 10min max |
| WebSocket/SSE | ✅ | ✅ | ✅ | ❌ |
| Best for | AI APIs, agents | ML serving | Simple APIs | Event-driven |

### Recommendation
**Container Apps** is the sweet spot for most AI agent workloads:
- Auto-scaling (including scale-to-zero)
- Dapr sidecar for state/pubsub
- Built-in ingress with SSL
- GPU support (preview)

📖 Deep-dive: Modules T3, O2, O5`,
      },
      model_selection: {
        title: "Model Selection Guide",
        modules: ["F2", "F1"],
        guidance: `## Model Selection — Which Model for Your Use Case?

### Quick Decision
| Use Case | Recommended | Why |
|----------|------------|-----|
| General chat/QA | GPT-4o | Best quality/speed balance |
| Simple classification | GPT-4o-mini | 6-17x cheaper, good enough |
| Code generation | GPT-4o / Claude Opus 4 | Best at code |
| Document analysis | GPT-4o (multimodal) | Image + text understanding |
| On-device/edge | Phi-4 (14B) | Small, fast, private |
| Open-source hosting | Llama 3.1 70B | Best open model |
| Cost-sensitive batch | GPT-4o-mini | $0.15/1M input tokens |
| Maximum quality | Claude Opus 4 / GPT-4o | Frontier models |

### Key Parameters
- **Temperature**: 0.0 for factual, 0.7 for creative
- **Top-p**: 0.9-0.95 for most tasks
- **Max tokens**: Set explicitly to control cost

📖 Deep-dive: Modules F2, F1`,
      },
      cost_optimization: {
        title: "AI Cost Optimization",
        modules: ["T3", "F1"],
        guidance: `## AI Cost Optimization — Token Economics

### Cost Formula
Cost = (input_tokens × input_rate) + (output_tokens × output_rate)

### Optimization Strategies (in priority order)
1. **Use smaller models** — GPT-4o-mini is 6-17x cheaper than GPT-4o
2. **Semantic caching** — Cache similar queries (30-50% savings)
3. **Shorten prompts** — Fine-tune to embed instructions (remove system message)
4. **PTU for predictable workloads** — Reserved throughput = predictable cost
5. **Rate limiting** — Token budgets per user/team
6. **Prompt compression** — Remove redundant context

### Example (GPT-4o, 100K requests/day)
System: 800 tokens + User: 200 + RAG: 2,000 + Output: 500
= $0.0125/request × 100K = $1,250/day = $37,500/month

With optimization (mini + cache): ~$3,500/month (90% savings)

📖 Deep-dive: Modules T3, F1`,
      },
      deterministic_ai: {
        title: "Making AI Deterministic",
        modules: ["R3", "R1"],
        guidance: `## Deterministic AI — Making AI Reliable

### The 5-Layer Defense
1. **Generation Controls**: temperature=0, seed parameter, max_tokens
2. **Output Constraints**: JSON schema, function calling, enum fields
3. **Prompt Engineering**: System message rules, few-shot, CoT
4. **Grounding**: RAG with verified docs, citation requirements
5. **Post-Processing**: Schema validation, LLM-as-judge, confidence scoring

### Golden Rules
- temperature=0 is necessary but NOT sufficient
- Ground everything with RAG + citations
- Constrain output with JSON schemas
- Measure reliability (faithfulness >0.90, groundedness >0.95)
- Defense in depth — no single technique works alone

📖 Deep-dive: Modules R3, R1`,
      },
      multi_agent: {
        title: "Multi-Agent Patterns",
        modules: ["O2", "O3", "T3"],
        guidance: `## Multi-Agent Production Patterns

### Pattern 1: Supervisor (Most Common)
One agent routes to specialized agents based on user intent.
Best for: Customer support, domain-specific Q&A

### Pattern 2: Pipeline (Sequential)
Agents hand off in sequence: Extract → Validate → Enrich → Store
Best for: Document processing, data pipelines

### Pattern 3: Swarm (Peer-to-Peer)
Agents negotiate without a central controller.
Best for: Creative tasks, complex reasoning

### Framework Decision
| Criterion | Semantic Kernel | Agent Framework |
|-----------|----------------|-----------------|
| Best for | Plugin orchestration | Multi-agent systems |
| Language | C#, Python | C#, Python |
| Multi-agent | Limited | ✅ Native |
| Tool calling | Via plugins | Via tools |
| Production ready | ✅ Mature | ✅ Growing |

📖 Deep-dive: Modules O2, O3, T3`,
      },
      fine_tuning_decision: {
        title: "Fine-Tuning Decision Framework",
        modules: ["T1"],
        guidance: `## Should You Fine-Tune?

### Decision Flow
1. Does the model understand your task? → If yes and works well → DON'T fine-tune
2. Have you tried detailed prompting + RAG? → If no → Try that first
3. Have you tried few-shot examples? → If no → Try that first
4. Still poor quality? → Fine-tune

### Method Selection
| Data Available | Recommended Method | Cost |
|---------------|-------------------|------|
| <100 examples | Don't fine-tune yet | - |
| 100-1,000 | LoRA / QLoRA | $50-$500 |
| 1,000-10,000 | LoRA or Full FT | $500-$5K |
| 10,000+ | Full Fine-Tuning | $1K-$50K |

### Key Insight
Fine-tuning teaches HOW to respond, not WHAT to know.
- New knowledge → Use RAG
- New behavior/style → Use fine-tuning
- Both → RAG + fine-tuning

📖 Deep-dive: Module T1`,
      },
    };

    const pattern = patterns[scenario];
    return {
      content: [
        {
          type: "text",
          text: `${pattern.guidance}\n\n---\n*FrootAI — The open glue for AI architecture*`,
        },
      ],
    };
  }
);

// ── Tool: get_froot_overview ───────────────────────────────────────

server.tool(
  "get_froot_overview",
  "Get a complete overview of the FROOT framework — all 5 layers, 16 modules, what each layer covers, and how they connect. Use when asked 'what is FrootAI' or 'show me the framework'.",
  {},
  async () => {
    const overview = `# FrootAI — The FROOT Framework Overview

## From Root to Fruit: 5 Layers of AI Architecture Knowledge

### ⛰️ BEDROCK — Infrastructure
AI Landing Zones · GPU Compute · Networking · Security · Identity
*The foundation everything grows from*

### 🌱 F — FOUNDATIONS (The Roots)
- **F1**: GenAI Foundations — Transformers, tokens, parameters, attention
- **F2**: LLM Landscape — GPT, Claude, Llama, model selection
- **F3**: AI Glossary A–Z — 200+ terms defined
- **F4**: .github Agentic OS — 7 primitives, 4 layers, agent-native repos
*The vocabulary of AI*

### 🪵 R — REASONING (The Trunk)
- **R1**: Prompt Engineering — System messages, few-shot, CoT, grounding
- **R2**: RAG Architecture — Chunking, embeddings, vector search, reranking
- **R3**: Deterministic AI — Hallucination reduction, evaluation, guardrails
*How to make AI think well*

### 🌿 O — ORCHESTRATION (The Branches)
- **O1**: Semantic Kernel — Plugins, planners, memory, SK vs LangChain
- **O2**: AI Agents — Planning, tool use, multi-agent, Agent Framework
- **O3**: MCP & Tools — Model Context Protocol, function calling, A2A
*Connecting AI into intelligent systems*

### 🍃 O — OPERATIONS (The Leaves)
- **O4**: Azure AI Platform — AI Foundry, Model Catalog, Landing Zones
- **O5**: AI Infrastructure — GPU compute, Container Apps, AKS, serving
- **O6**: Copilot Ecosystem — M365 Copilot, Copilot Studio, low-code
*Running AI in production at scale*

### 🍎 T — TRANSFORMATION (The Fruit)
- **T1**: Fine-Tuning — LoRA, QLoRA, RLHF, DPO, MLOps
- **T2**: Responsible AI — Content safety, red teaming, guardrails
- **T3**: Production Patterns — Multi-agent hosting, API gateway, cost control
*Turning AI into real-world impact*

---
**The Open Glue**: FrootAI removes silos between infrastructure, platform, and application teams.

## FAI Ecosystem — By The Numbers
- **101 Solution Plays** — Pre-tuned Azure AI blueprints (DevKit + TuneKit + SpecKit)
- **830+ FAI Primitives** — 238 agents, 176 instructions, 322 skills, 10 hooks
- **77 Plugins** — Composable packages (1,008 bundled items) via \`npx frootai install\`
- **25 MCP Tools** — 6 static + 4 live + 3 chain + 7 ecosystem + 2 dev tools
- **16 Cookbook Recipes** — Step-by-step guides from init to production
- **12 Agentic Workflows** — CI/CD with safe-outputs
- **18 Knowledge Modules** — 200+ terms, 7 architecture patterns
- **7 JSON Schemas** — agent, instruction, skill, hook, plugin, manifest, context

## FAI Protocol — The Binding Glue
- **fai-manifest.json** — Full play wiring (context + primitives + infra + toolkit)
- **fai-context.json** — Lightweight LEGO block context (WAF + compatible plays)
- **FAI Engine** — Runtime: manifest-reader → context-resolver → primitive-wirer → hook-runner → evaluator → mcp-bridge
- **FAI Layer** — The conceptual glue that auto-wires standalone primitives into solution plays

**Website**: https://frootai.dev`;

    // Add ecosystem data from knowledge.json if available
    const eco = KNOWLEDGE.ecosystem;
    if (eco) {
      const primLines = Object.entries(eco.primitives || {}).map(([k, v]) => `- **${k}**: ${v.count} (${v.desc})`).join("\n");
      overview += `\n\n## Primitives Catalog\n${primLines}`;
    }

    return {
      content: [{ type: "text", text: overview }],
    };
  }
);

// ════════════════════════════════════════════════════════════════════
// LIVE TOOLS (v3) — Network-enabled, graceful degradation
// ════════════════════════════════════════════════════════════════════

/**
 * Helper: fetch with timeout and graceful degradation
 */
async function safeFetch(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    clearTimeout(timeout);
    return null; // graceful degradation — caller handles null
  }
}

// ── Tool: fetch_azure_docs ─────────────────────────────────────────

server.tool(
  "fetch_azure_docs",
  "Fetch latest Azure documentation for a specific service or topic. Uses Microsoft Learn REST API. Returns curated summary. Falls back to static knowledge if offline.",
  {
    service: z.string().describe("Azure service name or topic (e.g., 'azure-openai', 'ai-search', 'container-apps', 'ai-foundry', 'content-safety')"),
  },
  async ({ service }) => {
    // Rate limiting + caching for live tools
    if (!liveLimiter.allow('fetch_azure_docs')) {
      const cached = azureDocsCache.get(`azure:${service}`);
      if (cached) return cached;
      return mcpError("Rate limited", "Too many requests to Azure docs API. Try again in a few seconds.");
    }

    const cachedResult = azureDocsCache.get(`azure:${service}`);
    if (cachedResult) return cachedResult;

    const searchTerm = encodeURIComponent(`Azure ${service} documentation`);
    const url = `https://learn.microsoft.com/api/search?search=${searchTerm}&locale=en-us&%24top=5&facet=category`;

    const body = await safeFetch(url);
    if (body) {
      try {
        const data = JSON.parse(body);
        const results = (data.results || []).slice(0, 5);
        if (results.length > 0) {
          const formatted = results.map((r, i) =>
            `${i + 1}. **${r.title}**\n   ${r.description || 'No description'}\n   🔗 ${r.url}`
          ).join("\n\n");
          const response = {
            content: [{
              type: "text",
              text: `## Azure Documentation: ${service}\n*Live from Microsoft Learn*\n\n${formatted}\n\n---\n*Fetched live. For deeper architecture guidance, use get_module or get_architecture_pattern.*`,
            }],
          };
          azureDocsCache.set(`azure:${service}`, response);
          return response;
        }
      } catch { /* fall through to static */ }
    }

    // Graceful degradation: suggest static modules
    const relevant = Object.values(modules)
      .filter(m => m.content.toLowerCase().includes(service.toLowerCase()))
      .slice(0, 3)
      .map(m => `  - ${m.id}: ${m.title}`)
      .join("\n");

    return {
      content: [{
        type: "text",
        text: `## Azure Documentation: ${service}\n*Offline — using static knowledge*\n\n⚠️ Could not reach Microsoft Learn API. Here are relevant FrootAI modules:\n\n${relevant || "  No matching modules. Try search_knowledge."}\n\nUse search_knowledge query="${service}" for detailed content from the bundled knowledge base.`,
      }],
    };
  }
);

// ── Tool: fetch_external_mcp ───────────────────────────────────────

server.tool(
  "fetch_external_mcp",
  "Search for external MCP servers from public registries. Find MCP servers for specific tools, services, or capabilities. Falls back to curated list if offline.",
  {
    query: z.string().describe("What kind of MCP server you're looking for (e.g., 'github', 'database', 'slack', 'jira', 'azure')"),
  },
  async ({ query }) => {
    // Rate limiting + caching
    if (!liveLimiter.allow('fetch_external_mcp')) {
      const cached = mcpRegistryCache.get(`mcp:${query}`);
      if (cached) return cached;
      return mcpError("Rate limited", "Too many requests to MCP registry. Try again in a few seconds.");
    }

    const cachedResult = mcpRegistryCache.get(`mcp:${query}`);
    if (cachedResult) return cachedResult;

    // Try mcp.so registry
    const searchUrl = `https://api.mcp.so/api/servers?q=${encodeURIComponent(query)}&limit=8`;
    const body = await safeFetch(searchUrl);

    if (body) {
      try {
        const data = JSON.parse(body);
        const servers = (data.servers || data.data || data || []).slice(0, 8);
        if (Array.isArray(servers) && servers.length > 0) {
          const formatted = servers.map((s, i) =>
            `${i + 1}. **${s.name || s.title || 'Unknown'}**\n   ${s.description || ''}\n   ${s.url || s.homepage || ''}`
          ).join("\n\n");
          return {
            content: [{
              type: "text",
              text: `## External MCP Servers: "${query}"\n*Live from MCP registry*\n\n${formatted}\n\n---\n*Install with: npx <package-name> or add to your mcp.json*`,
            }],
          };
        }
      } catch { /* fall through */ }
    }

    // Curated fallback list
    const curatedServers = {
      github: { name: "@modelcontextprotocol/server-github", desc: "GitHub repos, issues, PRs" },
      filesystem: { name: "@modelcontextprotocol/server-filesystem", desc: "Local file system access" },
      postgres: { name: "@modelcontextprotocol/server-postgres", desc: "PostgreSQL database queries" },
      slack: { name: "@modelcontextprotocol/server-slack", desc: "Slack channels and messages" },
      memory: { name: "@modelcontextprotocol/server-memory", desc: "Persistent memory for agents" },
      puppeteer: { name: "@modelcontextprotocol/server-puppeteer", desc: "Browser automation" },
      azure: { name: "frootai-mcp", desc: "AI architecture knowledge for Azure (this server!)" },
      brave: { name: "@modelcontextprotocol/server-brave-search", desc: "Web search via Brave" },
    };

    const matches = Object.entries(curatedServers)
      .filter(([k, v]) => k.includes(query.toLowerCase()) || v.desc.toLowerCase().includes(query.toLowerCase()))
      .map(([k, v]) => `- **${v.name}** — ${v.desc}`)
      .join("\n");

    return {
      content: [{
        type: "text",
        text: `## External MCP Servers: "${query}"\n*Offline — showing curated list*\n\n${matches || "No curated servers match. Try a broader search."}\n\n🔗 Browse more at: https://mcp.so · https://smithery.ai\n\nFor FrootAI's own MCP: npx frootai-mcp`,
      }],
    };
  }
);

// ── Tool: list_community_plays ─────────────────────────────────────

server.tool(
  "list_community_plays",
  "List FrootAI solution plays from the GitHub repository. Shows all 101 plays with status. Falls back to static list if offline.",
  {
    filter: z.string().optional().describe("Filter by keyword (e.g., 'rag', 'agent', 'landing-zone')"),
  },
  async ({ filter }) => {
    // Try live from GitHub API
    const apiUrl = "https://api.github.com/repos/frootai/frootai/contents/solution-plays";
    const body = await safeFetch(apiUrl);

    let plays = [];
    if (body) {
      try {
        const data = JSON.parse(body);
        plays = data
          .filter(d => d.type === "dir")
          .map(d => d.name)
          .filter(name => !filter || name.toLowerCase().includes(filter.toLowerCase()));
      } catch { /* fall through */ }
    }

    if (plays.length > 0) {
      const formatted = plays.map((p, i) =>
        `${i + 1}. **${p}**\n   🔗 https://github.com/frootai/frootai/tree/main/solution-plays/${p}`
      ).join("\n");
      return {
        content: [{
          type: "text",
          text: `## FrootAI Solution Plays\n*Live from GitHub*\n\n${formatted}\n\n---\n**Each play ships with:** .github Agentic OS (19 files) + DevKit + TuneKit\n🌐 https://frootai.dev/solution-plays`,
        }],
      };
    }

    // Static fallback
    const staticPlays = [
      "01-enterprise-rag", "02-ai-landing-zone", "03-deterministic-agent",
      "04-call-center-voice-ai", "05-it-ticket-resolution", "06-document-intelligence",
      "07-multi-agent-service", "08-copilot-studio-bot", "09-ai-search-portal",
      "10-content-moderation", "11-ai-landing-zone-advanced", "12-model-serving-aks",
      "13-fine-tuning-workflow", "14-cost-optimized-ai-gateway", "15-multi-modal-docproc",
      "16-copilot-teams-extension", "17-ai-observability", "18-prompt-management",
      "19-edge-ai-phi4", "20-anomaly-detection",
    ].filter(p => !filter || p.includes(filter?.toLowerCase() || ""));

    const formatted = staticPlays.map((p, i) => `${i + 1}. **${p}**`).join("\n");
    return {
      content: [{
        type: "text",
        text: `## FrootAI Solution Plays\n*Offline — showing bundled list*\n\n${formatted}\n\n---\n**101 plays** · Each with .github Agentic OS + DevKit + TuneKit\n🌐 https://frootai.dev/solution-plays`,
      }],
    };
  }
);

// ── Tool: get_github_agentic_os ────────────────────────────────────

server.tool(
  "get_github_agentic_os",
  "Get guidance on GitHub Copilot's .github folder agentic OS — the 7 primitives across 4 layers. Returns the FrootAI-authored reference guide. Use for questions about instructions, prompts, agents, skills, hooks, workflows, or plugins.",
  {
    primitive: z.enum([
      "overview", "instructions", "prompts", "agents", "skills", "hooks", "workflows", "plugins"
    ]).optional().default("overview").describe("Which primitive to explain (or 'overview' for all)"),
  },
  async ({ primitive = "overview" }) => {
    const guides = {
      overview: `## .github Agentic OS — Overview

7 primitives across 4 layers:

**Layer 1 — Always-On Context**
  1. Instructions (.github/copilot-instructions.md + instructions/*.instructions.md)
     → Passive memory, applies to every prompt

**Layer 2 — On-Demand Capabilities**
  2. Prompt Files (.github/prompts/*.prompt.md) → Slash commands
  3. Custom Agents (.github/agents/*.agent.md) → Specialist personas with MCP
  4. Skills (.github/skills/<name>/SKILL.md) → Self-contained folded logic

**Layer 3 — Enforcement & Automation**
  5. Hooks (.github/hooks/*.json) → preToolUse/postToolUse/errorOccurred
  6. Agentic Workflows (.github/workflows/*.md) → AI-driven CI/CD

**Layer 4 — Distribution**
  7. Plugins → Bundle agents + skills + commands for marketplace

FrootAI ships 19 files per solution play × 101 plays = 1,919 agentic OS files.
📖 Full module: get_module module_id=F4`,

      instructions: `## Primitive 1: Instructions
**Files:** .github/copilot-instructions.md + .github/instructions/*.instructions.md
**Layer:** 1 — Always-On Context
**Trigger:** Every prompt (automatic)

Passive memory that applies to every Copilot interaction. Use modular files for domain separation:
- azure-coding.instructions.md — Azure SDK patterns, managed identity
- <play>-patterns.instructions.md — Solution-specific rules
- security.instructions.md — Secrets, PII, access control

Best practice: keep short, specific, use bullet points, reference real files.`,

      prompts: `## Primitive 2: Prompt Files
**Files:** .github/prompts/*.prompt.md
**Layer:** 2 — On-Demand
**Trigger:** User types slash command (e.g., /deploy)

Slash commands for specific tasks:
- /deploy — deployment runbook with pre-flight checks
- /test — run test suite with quality thresholds
- /review — code review checklist with severity levels
- /evaluate — RAG quality evaluation pipeline

Each prompt defines: Steps, Prerequisites, Expected Output, Rollback.`,

      agents: `## Primitive 3: Custom Agents
**Files:** .github/agents/*.agent.md
**Layer:** 2 — On-Demand
**Trigger:** Agent invocation or handoff

Specialist personas with own tools and MCP servers. Agent chain:
  builder.agent.md → reviewer.agent.md → tuner.agent.md

Each agent defines: Role, Tools, MCP Servers, Rules, Handoff target.
Key: agents have MCP server bindings — they can query external knowledge.`,

      skills: `## Primitive 4: Skills
**Files:** .github/skills/<name>/SKILL.md + scripts
**Layer:** 2 — On-Demand
**Trigger:** Progressively loaded when relevant

Self-contained folders with instructions + scripts + references.
Copilot reads SKILL.md description first, loads full content only when relevant.
- deploy-azure/ — Bicep validation + az deployment
- evaluate/ — RAG quality scoring pipeline
- tune/ — TuneKit config validation`,

      hooks: `## Primitive 5: Hooks
**Files:** .github/hooks/*.json
**Layer:** 3 — Enforcement
**Trigger:** Lifecycle events (preToolUse, postToolUse, errorOccurred)

Deterministic policy gates:
- preToolUse: Block secrets in code, warn on guardrail changes
- postToolUse: Audit logging to .github/audit.log
- errorOccurred: Suggest troubleshooting on deployment failure

No LLM judgment — pure deterministic enforcement.`,

      workflows: `## Primitive 6: Agentic Workflows
**Files:** .github/workflows/*.md → compiled to YAML GitHub Actions
**Layer:** 3 — Automation
**Trigger:** PR events, pushes, schedules

Natural language automation compiled to GitHub Actions:
- ai-review.md — PR review: validate configs + run eval + post findings
- ai-deploy.md — Deployment: staging → smoke test → production (approval gate)

Permissions: read-only unless explicitly elevated.`,

      plugins: `## Primitive 7: Plugins
**Files:** plugin.json manifest
**Layer:** 4 — Distribution
**Trigger:** Install from repo or marketplace

Bundle agents + skills + commands into distributable packages:
{
  "plugin": "fai-enterprise-rag",
  "agents": ["builder", "reviewer", "tuner"],
  "skills": ["deploy-azure", "evaluate", "tune"],
  "prompts": ["deploy", "test", "review", "evaluate"]
}

Two modes: self-hosted (your repo) or marketplace (public).`,
    };

    const guide = guides[primitive] || guides.overview;
    return {
      content: [{
        type: "text",
        text: `${guide}\n\n---\n*Source: FrootAI Module F4 — .github Agentic OS*\n📖 Full module: get_module module_id=F4`,
      }],
    };
  }
);

// ════════════════════════════════════════════════════════════════════
// AGENT TOOLS — Auto-chain: Build → Review → Tune (in-chat flow)
// ════════════════════════════════════════════════════════════════════

server.tool(
  "agent_build",
  "BUILDER AGENT — Use when the user wants to BUILD or CREATE something. Returns building guidelines based on FrootAI best practices, then suggests review. Triggers the Build → Review → Tune chain.",
  {
    task: z.string().describe("What the user wants to build (e.g., 'IT ticket classification API', 'RAG pipeline', 'agent hosting')"),
  },
  async ({ task }) => {
    // Search knowledge for relevant patterns
    const queryLower = task.toLowerCase();
    const relevant = [];
    for (const mod of Object.values(modules)) {
      for (const section of mod.sections) {
        const text = (section.title + " " + section.content).toLowerCase();
        if (queryLower.split(/\s+/).some(w => w.length > 3 && text.includes(w))) {
          relevant.push({ title: section.title, module: mod.title, preview: section.content.substring(0, 300) });
          if (relevant.length >= 3) break;
        }
      }
      if (relevant.length >= 3) break;
    }

    const patterns = relevant.map(r => `**${r.title}** (${r.module})\n${r.preview}`).join("\n\n");

    return {
      content: [{
        type: "text",
        text: `## 🛠️ Builder Agent — ${task}

### Architecture Guidance
${patterns || "No specific patterns found. Following general Azure + AI best practices."}

### Building Rules (from FrootAI DevKit)
1. **Use config/*.json** for all AI parameters — never hardcode temperature, thresholds, etc.
2. **Use Managed Identity** for Azure authentication — no API keys in code
3. **Include error handling** with retry + exponential backoff + Application Insights logging
4. **Follow .github/instructions/*.instructions.md** for coding standards
5. **Output structured JSON** where applicable (use schemas from config/openai.json)
6. **Apply guardrails** from config/guardrails.json (PII, toxicity, off-topic)

### Recommended Azure Services
Based on "${task}": ${relevant.length > 0 ? "See patterns above for specific service recommendations." : "Use Container Apps for hosting, Azure OpenAI for AI, AI Search for retrieval, Key Vault for secrets."}

---

💡 **Next step:** After building, ask me to **review your code** — I'll check for security, quality, and Azure best practices.
Say: *"Review this code"* or *"Check my implementation for issues"*`,
      }],
    };
  }
);

server.tool(
  "agent_review",
  "REVIEWER AGENT — Use when the user wants to REVIEW or CHECK code. Provides a security + quality review checklist, then suggests tuning. Part of the Build → Review → Tune chain.",
  {
    context: z.string().optional().describe("Optional: what was built or what to review (e.g., 'the IT ticket classification API')"),
  },
  async ({ context }) => {
    return {
      content: [{
        type: "text",
        text: `## 🔍 Reviewer Agent${context ? ` — ${context}` : ""}

### Security Checklist
- [ ] **No secrets in code** — API keys, connection strings must be in Key Vault
- [ ] **Managed Identity** for all Azure service-to-service auth
- [ ] **Input validation** — sanitize user inputs for injection (SQL, prompt, command)
- [ ] **Content Safety** — Azure Content Safety applied to inputs AND outputs
- [ ] **PII handling** — mask/redact before logging or storing

### Quality Checklist
- [ ] **Error handling** — try/catch with retry + exponential backoff on all Azure calls
- [ ] **Logging** — Application Insights with correlation IDs
- [ ] **Config from files** — temperature, thresholds, prompts from config/*.json (not hardcoded)
- [ ] **Temperature ≤ 0.3** for factual responses (check config/openai.json)
- [ ] **Evaluation** — test cases exist in evaluation/test-set.jsonl

### Azure Best Practices
- [ ] **Private endpoints** on all data services (Storage, AI Search, OpenAI, Cosmos)
- [ ] **Resource tags** — environment, project, owner, cost-center on all resources
- [ ] **Bicep idempotent** — infra/main.bicep can be re-run safely

### Severity Guide
🔴 **Critical** — security vulnerability or data leak → must fix before merge
🟡 **Warning** — missing best practice or performance issue → should fix
🟢 **Suggestion** — code style or minor improvement → nice to have

---

💡 **Next step:** After reviewing, ask me to **tune your configuration** for production.
Say: *"Validate my config for production"* or *"Is my TuneKit ready?"*`,
      }],
    };
  }
);

server.tool(
  "agent_tune",
  "TUNER AGENT — Use when the user wants to TUNE, VALIDATE, or check PRODUCTION READINESS. Validates TuneKit configuration. Final step in Build → Review → Tune chain.",
  {
    context: z.string().optional().describe("Optional: what solution or config to validate"),
  },
  async ({ context }) => {
    return {
      content: [{
        type: "text",
        text: `## 🎛️ Tuner Agent — Production Readiness${context ? ` for ${context}` : ""}

### Config Validation Checklist
| File | Check | Expected |
|------|-------|----------|
| config/openai.json | temperature | ≤ 0.3 for factual, ≤ 0.7 for conversational |
| config/openai.json | max_tokens | 500–4000 (not unlimited) |
| config/openai.json | model | Specific model name (not "latest") |
| config/guardrails.json | blocked_topics | Non-empty array |
| config/guardrails.json | pii_filter | true |
| config/guardrails.json | abstention | "I don't know" response configured |
| infra/main.bicep | Valid | az bicep build passes |
| infra/main.bicep | Tags | environment + project + owner on all resources |
| infra/parameters.json | Region set | Production region (not "eastus" default) |
| evaluation/test-set.jsonl | Has cases | ≥ 10 test cases with ground truth |
| evaluation/eval.py | Runnable | python eval.py --test-set test-set.jsonl works |

### Production Readiness Verdict
Review the checklist above against your actual files. If all checks pass:

✅ **READY FOR PRODUCTION** — Deploy with confidence.

If any checks fail:
⚠️ **NEEDS TUNING** — Fix the failing items, then re-validate.

### Tuning Knobs (in order of impact)
1. **temperature** → Lower = more deterministic, higher = more creative
2. **top_k / threshold** → Retrieval quality for RAG pipelines
3. **guardrails** → Safety net for production
4. **evaluation** → Quality gate before shipping

---

🚀 **Ready to deploy?** Use the **/deploy** slash command or ask: *"Deploy this to Azure"*
📖 The deploy skill in .github/skills/deploy-azure/ has the full runbook.`,
      }],
    };
  }
);

// ── C4: AI Ecosystem Live Tools (v3) ─────────────────────────────

server.tool(
  "get_model_catalog",
  "AI MODEL CATALOG — Lists available Azure OpenAI models with capabilities, pricing tiers, context windows, and recommended use cases. Helps pick the right model for the job.",
  {
    category: z.enum(["all", "gpt", "embedding", "image", "speech"]).optional().describe("Filter by model category (default: all)"),
  },
  async ({ category = "all" }) => {
    const models = [
      { name: "gpt-4o", category: "gpt", context: "128K", pricing: "$2.50/1M input, $10/1M output", speed: "Fast", quality: "Highest", bestFor: "Complex reasoning, multi-modal, production agents" },
      { name: "gpt-4o-mini", category: "gpt", context: "128K", pricing: "$0.15/1M input, $0.60/1M output", speed: "Very Fast", quality: "Good", bestFor: "High-volume, cost-sensitive, simple tasks" },
      { name: "gpt-4.1", category: "gpt", context: "1M", pricing: "$2.00/1M input, $8.00/1M output", speed: "Fast", quality: "Highest", bestFor: "Long-context analysis, coding, complex instructions" },
      { name: "gpt-4.1-mini", category: "gpt", context: "1M", pricing: "$0.40/1M input, $1.60/1M output", speed: "Very Fast", quality: "Good", bestFor: "Long-context at lower cost, balanced workloads" },
      { name: "gpt-4.1-nano", category: "gpt", context: "1M", pricing: "$0.10/1M input, $0.40/1M output", speed: "Fastest", quality: "Basic", bestFor: "Classification, extraction, high-throughput" },
      { name: "o3", category: "gpt", context: "200K", pricing: "$10/1M input, $40/1M output", speed: "Slower (thinks)", quality: "Exceptional", bestFor: "Hard reasoning, math, science, code review" },
      { name: "o4-mini", category: "gpt", context: "200K", pricing: "$1.10/1M input, $4.40/1M output", speed: "Medium", quality: "Very Good", bestFor: "Reasoning at scale, STEM, analysis" },
      { name: "text-embedding-3-large", category: "embedding", context: "8K", pricing: "$0.13/1M tokens", speed: "Fast", quality: "Best", bestFor: "RAG, semantic search, document similarity" },
      { name: "text-embedding-3-small", category: "embedding", context: "8K", pricing: "$0.02/1M tokens", speed: "Fast", quality: "Good", bestFor: "Cost-effective embeddings, basic search" },
      { name: "dall-e-3", category: "image", context: "N/A", pricing: "$0.04-0.12/image", speed: "Medium", quality: "High", bestFor: "Image generation, creative content" },
      { name: "whisper", category: "speech", context: "N/A", pricing: "$0.006/minute", speed: "Fast", quality: "High", bestFor: "Speech-to-text, transcription" },
      { name: "tts-1-hd", category: "speech", context: "N/A", pricing: "$0.03/1K chars", speed: "Fast", quality: "High", bestFor: "Text-to-speech, voice assistants" },
    ];

    const filtered = category === "all" ? models : models.filter(m => m.category === category);
    const table = filtered.map(m =>
      `| ${m.name} | ${m.context} | ${m.pricing} | ${m.speed} | ${m.quality} | ${m.bestFor} |`
    ).join("\n");

    return {
      content: [{
        type: "text",
        text: `## 📋 Azure AI Model Catalog${category !== "all" ? ` (${category})` : ""}

| Model | Context | Pricing | Speed | Quality | Best For |
|-------|---------|---------|-------|---------|----------|
${table}

> **Pricing** is approximate and may vary by region and commitment tier.
> **Recommendation**: Use gpt-4o-mini for 80% of workloads, gpt-4o or gpt-4.1 for complex tasks, o3/o4-mini for hard reasoning.
> 
> 🔗 Latest: https://learn.microsoft.com/azure/ai-services/openai/concepts/models`,
      }],
    };
  }
);

server.tool(
  "get_azure_pricing",
  "AZURE AI PRICING — Estimates monthly cost for common AI solution architectures. Helps with FinOps planning and cost optimization for AI workloads.",
  {
    scenario: z.enum(["rag", "agent", "batch", "realtime", "custom"]).describe("Solution scenario type"),
    scale: z.enum(["dev", "staging", "production"]).optional().describe("Scale tier (default: production)"),
  },
  async ({ scenario, scale = "production" }) => {
    const estimates = {
      rag: {
        dev: { monthly: "$150-300", breakdown: "OpenAI: $50, AI Search: $75 (Basic), Container App: $25, Storage: $5" },
        staging: { monthly: "$500-1,200", breakdown: "OpenAI: $200, AI Search: $250 (Standard), Container App: $100, Storage: $20, App Insights: $30" },
        production: { monthly: "$2,000-8,000", breakdown: "OpenAI: $1,000-5,000, AI Search: $500 (Standard S2+), Container App: $200, Storage: $50, App Insights: $100, Front Door: $100" },
      },
      agent: {
        dev: { monthly: "$100-250", breakdown: "OpenAI: $80, Container App: $25, Cosmos DB: $25 (serverless)" },
        staging: { monthly: "$400-1,000", breakdown: "OpenAI: $300, Container App: $100, Cosmos DB: $100, Service Bus: $25" },
        production: { monthly: "$1,500-6,000", breakdown: "OpenAI: $1,000-4,000, Container App: $300, Cosmos DB: $300, Service Bus: $50, App Insights: $100" },
      },
      batch: {
        dev: { monthly: "$50-150", breakdown: "OpenAI (batch API -50%): $30, Storage: $10, Functions: $5" },
        staging: { monthly: "$200-500", breakdown: "OpenAI (batch): $150, Storage: $30, Functions: $20" },
        production: { monthly: "$500-3,000", breakdown: "OpenAI (batch -50%): $300-2,000, Storage: $100, Functions: $50, Data Factory: $50" },
      },
      realtime: {
        dev: { monthly: "$200-400", breakdown: "OpenAI: $100, Communication Services: $50, Speech: $30, Container App: $25" },
        staging: { monthly: "$600-1,500", breakdown: "OpenAI: $400, Communication Services: $150, Speech: $100, Container App: $100" },
        production: { monthly: "$2,500-10,000", breakdown: "OpenAI: $1,500-6,000, Communication Services: $500, Speech: $300, Container App: $300, Front Door: $100" },
      },
      custom: {
        dev: { monthly: "$100-300", breakdown: "Varies by architecture. Use Azure Pricing Calculator for specifics." },
        staging: { monthly: "$300-1,000", breakdown: "Varies. Key drivers: model choice, request volume, storage." },
        production: { monthly: "$1,000-10,000+", breakdown: "Varies. Optimize with: PTU commitments, batch API, caching, model downsizing." },
      },
    };

    const est = estimates[scenario]?.[scale] || estimates.custom[scale];

    return {
      content: [{
        type: "text",
        text: `## 💰 Azure AI Cost Estimate — ${scenario.toUpperCase()} (${scale})

**Estimated Monthly Cost:** ${est.monthly}

### Breakdown
${est.breakdown}

### Cost Optimization Tips
| Strategy | Savings | When to Use |
|----------|---------|-------------|
| Use gpt-4o-mini instead of gpt-4o | 80-90% | Simple classification, extraction, routing |
| Batch API (async) | 50% | Non-real-time processing, nightly jobs |
| Provisioned Throughput (PTU) | 30-60% | Predictable, high-volume production |
| Semantic caching (APIM) | 20-40% | Repeated similar queries |
| Prompt compression | 10-30% | Reduce input tokens with summarization |
| Regional pricing | 5-15% | West US 2, Sweden Central often cheaper |

> 🔗 Azure Pricing Calculator: https://azure.microsoft.com/pricing/calculator/
> 🔗 FrootAI Play 14 (Cost-Optimized AI Gateway) covers advanced FinOps patterns.`,
      }],
    };
  }
);

server.tool(
  "compare_models",
  "MODEL COMPARISON — Side-by-side comparison of AI models for a specific use case. Recommends the best model based on requirements.",
  {
    useCase: z.string().describe("What you're building (e.g., 'RAG chatbot', 'code review agent', 'document extraction')"),
    priority: z.enum(["cost", "quality", "speed", "context"]).optional().describe("What matters most (default: quality)"),
  },
  async ({ useCase, priority = "quality" }) => {
    const recommendations = {
      cost: { primary: "gpt-4o-mini", secondary: "gpt-4.1-nano", reasoning: "Lowest cost per token while maintaining acceptable quality. Use mini for most tasks, nano for high-throughput classification." },
      quality: { primary: "gpt-4o", secondary: "gpt-4.1", reasoning: "Highest quality output. Use 4o for multi-modal, 4.1 for long-context. Add o3 for tasks requiring deep reasoning." },
      speed: { primary: "gpt-4o-mini", secondary: "gpt-4.1-nano", reasoning: "Fastest response times. Mini has best latency-to-quality ratio. Nano for sub-100ms responses." },
      context: { primary: "gpt-4.1", secondary: "gpt-4.1-mini", reasoning: "1M token context window. Process entire codebases, long documents, or complex multi-turn conversations." },
    };

    const rec = recommendations[priority];

    return {
      content: [{
        type: "text",
        text: `## 🔄 Model Comparison for: "${useCase}"
**Priority:** ${priority.toUpperCase()}

### Recommendation
| Aspect | Primary: ${rec.primary} | Alternative: ${rec.secondary} |
|--------|----------------------|--------------------------|
| **Why** | Best for ${priority} | Backup option |
| **Cost** | See model catalog | See model catalog |

**Reasoning:** ${rec.reasoning}

### Decision Matrix
| Model | Cost | Quality | Speed | Context | Best For |
|-------|------|---------|-------|---------|----------|
| gpt-4o | $$$ | ⭐⭐⭐⭐⭐ | Fast | 128K | Complex tasks, multi-modal |
| gpt-4o-mini | $ | ⭐⭐⭐⭐ | Very Fast | 128K | High-volume, cost-sensitive |
| gpt-4.1 | $$$ | ⭐⭐⭐⭐⭐ | Fast | 1M | Long-context, coding |
| gpt-4.1-mini | $$ | ⭐⭐⭐⭐ | Very Fast | 1M | Balanced cost + context |
| gpt-4.1-nano | $ | ⭐⭐⭐ | Fastest | 1M | Classification, extraction |
| o3 | $$$$ | ⭐⭐⭐⭐⭐+ | Slow | 200K | Hard reasoning, math |
| o4-mini | $$ | ⭐⭐⭐⭐⭐ | Medium | 200K | Reasoning at scale |

### Quick Decision
- **"I need it cheap"** → gpt-4o-mini
- **"I need the best"** → gpt-4o or gpt-4.1
- **"I need to think hard"** → o3 or o4-mini
- **"I have huge documents"** → gpt-4.1 (1M context)
- **"I need sub-second latency"** → gpt-4.1-nano

> 💡 Use \`get_model_catalog\` for full pricing details.
> 💡 Use \`get_azure_pricing\` to estimate monthly costs.`,
      }],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════
// COMPUTE TOOLS (Phase 8A) — Real computation, not just knowledge
// ═══════════════════════════════════════════════════════════════════

// ── Play metadata for compute tools ────────────────────────────────

const PLAY_DATA = [
  { id: "01", name: "Enterprise RAG Q&A", services: ["AI Search", "OpenAI (gpt-4o)", "Container App", "Blob Storage"], pattern: "RAG hybrid search chunking semantic reranking retrieval augmented generation document qa question answering knowledge base", cx: "Medium" },
  { id: "02", name: "AI Landing Zone", services: ["VNet + PE", "Key Vault"], pattern: "landing zone infrastructure network security private endpoints rbac governance hub spoke foundation baseline", cx: "Foundation" },
  { id: "03", name: "Deterministic Agent", services: ["Container App", "OpenAI (gpt-4o)", "Content Safety"], pattern: "deterministic agent zero temperature reliable reproducible content safety guardrails filtering consistent", cx: "Medium" },
  { id: "04", name: "Call Center Voice AI", services: ["Communication Services", "Speech Service", "OpenAI (gpt-4o)", "App Service (B1)"], pattern: "voice call center speech to text text to speech stt tts real time audio phone ivr customer service", cx: "High" },
  { id: "05", name: "IT Ticket Resolution", services: ["OpenAI (gpt-4o-mini)", "App Service (B1)"], pattern: "ticket resolution automation helpdesk it service management event driven async message queue workflow", cx: "Medium" },
  { id: "06", name: "Document Intelligence", services: ["Document Intelligence", "OpenAI (gpt-4o)", "Blob Storage"], pattern: "document extraction ocr form recognizer invoice receipt structured output pdf image processing", cx: "Medium" },
  { id: "07", name: "Multi-Agent Service", services: ["OpenAI (gpt-4o)", "Container App", "Cosmos DB"], pattern: "multi agent collaboration handoff orchestration coordinator specialist a2a agent to agent supervisor", cx: "High" },
  { id: "08", name: "Copilot Studio Bot", services: ["AI Search", "OpenAI (gpt-4o-mini)", "Blob Storage"], pattern: "copilot studio low code bot chatbot generative answers knowledge grounding power platform", cx: "Low" },
  { id: "09", name: "AI Search Portal", services: ["AI Search", "OpenAI (gpt-4o)", "App Service (B1)"], pattern: "search portal semantic hybrid keyword vector enterprise search faceted filtering web application", cx: "Medium" },
  { id: "10", name: "Content Moderation", services: ["Content Safety", "OpenAI (gpt-4o-mini)", "APIM"], pattern: "content moderation safety filtering toxic harmful block severity scoring content policy gateway", cx: "Low" },
  { id: "11", name: "Landing Zone Advanced", services: ["VNet + PE", "Firewall", "Key Vault", "NAT Gateway"], pattern: "advanced landing zone enterprise network segmentation firewall nsg nat gateway dns private dns zone", cx: "High" },
  { id: "12", name: "Model Serving AKS", services: ["AKS (GPU)", "ACR", "OpenAI (gpt-4o)"], pattern: "model serving kubernetes aks gpu cluster custom model hosting autoscale container registry inference", cx: "High" },
  { id: "13", name: "Fine-Tuning Workflow", services: ["ML Workspace", "OpenAI (gpt-4o)", "Blob Storage"], pattern: "fine tuning lora qlora training dataset preparation model versioning mlops evaluation custom model", cx: "High" },
  { id: "14", name: "Cost-Optimized AI Gateway", services: ["APIM", "OpenAI (gpt-4o)", "Redis Cache"], pattern: "cost optimization finops gateway caching semantic cache token metering rate limiting api management budget", cx: "Medium" },
  { id: "15", name: "Multi-Modal DocProc", services: ["Document Intelligence", "OpenAI (gpt-4o)", "Cosmos DB"], pattern: "multi modal document processing images tables text extraction structured data vision ocr", cx: "Medium" },
  { id: "16", name: "Copilot Teams Extension", services: ["OpenAI (gpt-4o)", "App Service (B1)"], pattern: "teams bot copilot extension adaptive cards microsoft teams messaging collaboration enterprise chat", cx: "Medium" },
  { id: "17", name: "AI Observability", services: ["Log Analytics", "App Insights"], pattern: "observability monitoring telemetry kql dashboards alerts application insights log analytics metrics", cx: "Medium" },
  { id: "18", name: "Prompt Management", services: ["OpenAI (gpt-4o)", "Cosmos DB", "App Service (B1)"], pattern: "prompt management versioning ab testing rollback template registry prompt engineering lifecycle", cx: "Medium" },
  { id: "19", name: "Edge AI Phi-4", services: ["IoT Hub", "ACR", "Blob Storage"], pattern: "edge ai phi small language model iot offline inference device deployment lightweight mobile embedded", cx: "High" },
  { id: "20", name: "Anomaly Detection", services: ["Event Hub", "Stream Analytics", "OpenAI (gpt-4o)", "Cosmos DB"], pattern: "anomaly detection streaming real time event processing alert iot sensor time series", cx: "High" },
  { id: "21", name: "Agentic RAG", services: ["OpenAI (gpt-4o)", "AI Search", "Container Apps", "Key Vault"], pattern: "agentic rag autonomous retrieval multi-source semantic caching citation self-evaluation", cx: "High" },
  { id: "22", name: "Multi-Agent Swarm", services: ["OpenAI (gpt-4o)", "Container Apps", "Service Bus", "Cosmos DB"], pattern: "multi agent swarm supervisor pipeline debate collaboration handoff state", cx: "Very High" },
  { id: "23", name: "Browser Automation", services: ["OpenAI (gpt-4o)", "Container Apps", "Playwright"], pattern: "browser automation playwright vision web navigation form filling screenshot", cx: "High" },
  { id: "24", name: "AI Code Review", services: ["OpenAI (gpt-4o)", "GitHub Actions", "CodeQL"], pattern: "code review codeql owasp pr pipeline ci cd security audit inline suggestions", cx: "Medium" },
  { id: "25", name: "Conversation Memory", services: ["OpenAI (gpt-4o)", "Cosmos DB", "AI Search", "Redis"], pattern: "conversation memory short long episodic recall session persistence personalization", cx: "High" },
  { id: "26", name: "Semantic Search Engine", services: ["AI Search", "OpenAI (gpt-4o)", "Blob Storage"], pattern: "semantic search hybrid vector bm25 reranking query expansion personalization answer generation", cx: "Medium" },
  { id: "27", name: "AI Data Pipeline", services: ["OpenAI (gpt-4o-mini)", "Data Factory", "Cosmos DB", "Event Hubs"], pattern: "data pipeline etl llm augmented classify extract pii redaction quality score lakehouse", cx: "High" },
  { id: "28", name: "Knowledge Graph RAG", services: ["OpenAI (gpt-4o)", "Cosmos DB Gremlin", "AI Search"], pattern: "knowledge graph rag entity extraction relationship mapping gremlin vector fusion contextual", cx: "High" },
  { id: "29", name: "MCP Gateway", services: ["APIM", "Container Apps", "Monitor", "Key Vault"], pattern: "mcp gateway proxy rate limit tool discovery authentication analytics governance", cx: "Medium" },
  { id: "30", name: "AI Security Hardening", services: ["Content Safety", "OpenAI (gpt-4o)", "Container Apps", "Monitor"], pattern: "security hardening prompt injection jailbreak owasp llm top 10 red teaming content safety defense", cx: "High" },
  { id: "31", name: "Low-Code AI Builder", services: ["OpenAI (gpt-4o)", "Container Apps", "Cosmos DB", "Static Web Apps"], pattern: "low code visual builder drag drop pipeline template one click deploy citizen developer", cx: "Medium" },
  { id: "32", name: "AI-Powered Testing", services: ["OpenAI (gpt-4o)", "GitHub Actions", "Container Apps"], pattern: "ai testing autonomous test generation unit integration e2e mutation coverage polyglot", cx: "Medium" },
  { id: "33", name: "Voice AI Agent", services: ["AI Speech", "OpenAI (gpt-4o)", "Communication Services", "Container Apps"], pattern: "voice ai agent stt tts speech intent recognition real time streaming ivr customer service", cx: "High" },
  { id: "34", name: "Edge AI Deployment", services: ["IoT Hub", "ONNX Runtime", "Container Instances", "Monitor"], pattern: "edge ai deployment onnx quantization offline inference fleet management cloud sync disconnected", cx: "High" },
  { id: "35", name: "AI Compliance Engine", services: ["OpenAI (gpt-4o)", "Azure Policy", "Key Vault", "Cosmos DB"], pattern: "compliance engine gdpr hipaa soc2 eu ai act audit trail regulatory risk assessment", cx: "High" },
  { id: "36", name: "Multimodal Agent", services: ["OpenAI (gpt-4o Vision)", "AI Vision", "Blob Storage", "Container Apps"], pattern: "multimodal agent vision text code image screenshot diagram cross modal understanding", cx: "Medium" },
  { id: "37", name: "AI-Powered DevOps", services: ["OpenAI (gpt-4o)", "Monitor", "DevOps", "GitHub Actions"], pattern: "devops sre incident triage runbook automation risk scoring predictive scaling deployment", cx: "Medium" },
  { id: "38", name: "Document Understanding v2", services: ["Document Intelligence", "OpenAI (gpt-4o)", "Cosmos DB"], pattern: "document understanding v2 multi page table relationship handwriting entity linking structured", cx: "High" },
  { id: "39", name: "AI Meeting Assistant", services: ["AI Speech", "OpenAI (gpt-4o)", "Graph", "Container Apps"], pattern: "meeting assistant transcription diarization action items decision tracking followup scheduling", cx: "Medium" },
  { id: "40", name: "Copilot Studio Advanced", services: ["Copilot Studio", "OpenAI (gpt-4o)", "Dataverse", "Graph"], pattern: "copilot studio advanced typespec declarative agents api plugins m365 sso adaptive cards", cx: "High" },
  { id: "41", name: "AI Red Teaming", services: ["AI Foundry", "Content Safety", "OpenAI (gpt-4o)", "Monitor"], pattern: "red teaming adversarial testing prompt injection jailbreak safety scorecard eu ai act nist", cx: "High" },
  { id: "42", name: "Computer Use Agent", services: ["OpenAI (gpt-4o Vision)", "Container Apps", "Blob Storage"], pattern: "computer use agent vision desktop web automation rpa screenshot mouse keyboard legacy", cx: "Very High" },
  { id: "43", name: "AI Video Generation", services: ["OpenAI", "Blob Storage", "Content Safety", "Service Bus", "CDN"], pattern: "video generation text to video content safety batch processing watermark brand media", cx: "Very High" },
  { id: "44", name: "Foundry Local On-Device", services: ["OpenAI", "IoT Hub", "Monitor", "Key Vault"], pattern: "foundry local on device air gapped inference cloud escalation offline queue fleet sync", cx: "High" },
  { id: "45", name: "Real-Time Event AI", services: ["Event Hubs", "Functions", "OpenAI", "Cosmos DB", "SignalR"], pattern: "real time event streaming fraud iot anomaly sentiment supply chain sub second websocket dashboard", cx: "Very High" },
  { id: "46", name: "Healthcare Clinical AI", services: ["OpenAI (gpt-4o)", "Health Data Services", "AI Search", "Content Safety"], pattern: "healthcare clinical hipaa medical coding drug interaction triage fhir audit human in the loop", cx: "Very High" },
  { id: "47", name: "Synthetic Data Factory", services: ["OpenAI", "Machine Learning", "Blob Storage", "Key Vault"], pattern: "synthetic data generation privacy differential tabular text pii zero gdpr ccpa statistical fidelity", cx: "High" },
  { id: "48", name: "AI Model Governance", services: ["Machine Learning", "AI Foundry", "DevOps", "Cosmos DB", "Policy"], pattern: "model governance registry approval gates ab testing audit trail sox eu ai act lineage mlops", cx: "High" },
  { id: "49", name: "Creative AI Studio", services: ["OpenAI", "Blob Storage", "Content Safety", "Functions", "CDN"], pattern: "creative ai studio multi modal text image audio campaign brand voice content marketing", cx: "High" },
  { id: "50", name: "Financial Risk Intelligence", services: ["OpenAI (gpt-4o)", "AI Search", "Cosmos DB", "Event Hubs"], pattern: "financial risk market analysis credit fraud detection sec basel explainable ai regulatory audit", cx: "Very High" },
  { id: "51", name: "Autonomous Coding Agent", services: ["OpenAI (gpt-4o)", "GitHub Actions", "Container Apps"], pattern: "autonomous coding agent issue pr multi file test generation human approval code review", cx: "Very High" },
  { id: "52", name: "AI API Gateway v2", services: ["APIM", "OpenAI", "Redis", "Monitor", "Key Vault"], pattern: "api gateway v2 semantic caching model routing token budget rate limiting cost attribution", cx: "High" },
  { id: "53", name: "Legal Document AI", services: ["OpenAI (gpt-4o)", "AI Search", "Blob Storage", "Cosmos DB"], pattern: "legal document contract clause extraction risk identification privilege redline audit compliance", cx: "Very High" },
  { id: "54", name: "AI Customer Support v2", services: ["OpenAI", "AI Search", "Communication Services", "Cosmos DB"], pattern: "customer support multi channel sentiment routing knowledge base csat escalation omnichannel", cx: "High" },
  { id: "55", name: "Supply Chain AI", services: ["OpenAI", "Cosmos DB", "Event Hubs", "Functions", "ML"], pattern: "supply chain demand forecast inventory optimization supplier risk disruption route alert", cx: "Very High" },
  { id: "56", name: "Semantic Code Search", services: ["OpenAI", "AI Search", "Blob Storage", "Container Apps"], pattern: "semantic code search natural language function discovery cross repo dependency mapping intent", cx: "Medium" },
  { id: "57", name: "AI Translation Engine", services: ["OpenAI", "AI Translator", "Cosmos DB", "Container Apps", "CDN"], pattern: "translation multilingual 100 languages glossary cultural adaptation quality scoring batch", cx: "High" },
  { id: "58", name: "Digital Twin Agent", services: ["IoT Hub", "Digital Twins", "OpenAI", "Functions", "Cosmos DB"], pattern: "digital twin iot simulation predictive modeling anomaly detection manufacturing energy infrastructure", cx: "Very High" },
  { id: "59", name: "AI Recruiter Agent", services: ["OpenAI", "AI Search", "Cosmos DB", "Functions", "Graph"], pattern: "recruiter screening matching bias detection skills assessment diversity explainability fair hiring", cx: "High" },
  { id: "60", name: "Responsible AI Dashboard", services: ["OpenAI", "ML", "Monitor", "Cosmos DB", "Static Web Apps"], pattern: "responsible ai dashboard fairness metrics bias detection transparency eu ai act compliance report", cx: "High" },
  { id: "61", name: "Content Moderation v2", services: ["Content Safety", "OpenAI", "Cosmos DB", "Functions", "Service Bus"], pattern: "content moderation v2 multi modal cultural context human appeal false positive severity", cx: "High" },
  { id: "62", name: "Federated Learning Pipeline", services: ["ML", "Confidential Computing", "Blob Storage", "Key Vault"], pattern: "federated learning privacy distributed training aggregation differential noise convergence", cx: "Very High" },
  { id: "63", name: "Fraud Detection Agent", services: ["OpenAI", "Event Hubs", "Stream Analytics", "Cosmos DB"], pattern: "fraud detection real time transaction behavioral anomaly velocity fingerprint explainable sub 100ms", cx: "High" },
  { id: "64", name: "AI Sales Assistant", services: ["OpenAI", "Cosmos DB", "Graph", "AI Search", "Functions"], pattern: "sales assistant crm lead scoring email personalization pipeline forecast deal risk next action", cx: "Medium" },
  { id: "65", name: "AI Training Curriculum", services: ["OpenAI", "Cosmos DB", "Static Web Apps", "Functions"], pattern: "training curriculum adaptive learning assessment exercise personalization micro certification", cx: "Medium" },
  { id: "66", name: "AI Infrastructure Optimizer", services: ["OpenAI", "Monitor", "Advisor", "Cost Management"], pattern: "infrastructure optimizer finops right sizing gpu utilization idle resource reserved scaling anomaly", cx: "High" },
  { id: "67", name: "AI Knowledge Management", services: ["OpenAI", "AI Search", "Cosmos DB", "Blob Storage", "Graph"], pattern: "knowledge management freshness detection gap analysis expert identification contextual qa semantic", cx: "High" },
  { id: "68", name: "Predictive Maintenance AI", services: ["IoT Hub", "OpenAI", "ML", "Stream Analytics", "Cosmos DB"], pattern: "predictive maintenance iot sensor rul remaining useful life anomaly scheduling spare parts dispatch", cx: "High" },
  { id: "69", name: "Carbon Footprint Tracker", services: ["Azure Monitor", "OpenAI", "Cosmos DB", "Event Hubs"], pattern: "carbon footprint tracker accounting emission scope ghg esg supply chain cloud sustainability", cx: "High" },
  { id: "70", name: "ESG Compliance Agent", services: ["OpenAI", "Document Intelligence", "Cosmos DB", "AI Search"], pattern: "esg compliance environmental social governance gri sasb tcfd csrd regulatory reporting", cx: "High" },
  { id: "71", name: "Smart Energy Grid AI", services: ["IoT Hub", "OpenAI", "Stream Analytics", "Digital Twins"], pattern: "smart energy grid renewable solar wind battery demand prediction balancing optimization", cx: "Very High" },
  { id: "72", name: "Climate Risk Assessor", services: ["OpenAI", "ML", "Cosmos DB", "AI Search"], pattern: "climate risk physical transition liability scenario modeling insurance financial rcp", cx: "High" },
  { id: "73", name: "Waste & Recycling Optimizer", services: ["AI Vision", "OpenAI", "IoT Hub", "Container Apps"], pattern: "waste recycling material classification route optimization contamination detection", cx: "Medium" },
  { id: "74", name: "AI Tutoring Agent", services: ["OpenAI", "Cosmos DB", "AI Search", "Static Web Apps", "Functions"], pattern: "tutoring agent socratic method knowledge gap adaptive difficulty personalized learning progress tracking", cx: "Medium" },
  { id: "75", name: "Exam Generation Engine", services: ["OpenAI", "Blob Storage", "Cosmos DB", "Functions"], pattern: "exam generation curriculum difficulty calibration rubric answer key anti cheating question variation bloom taxonomy", cx: "Medium" },
  { id: "76", name: "Accessibility Learning Agent", services: ["AI Speech", "OpenAI", "AI Vision", "Container Apps", "Cosmos DB"], pattern: "accessibility learning screen reader dyslexia multi modal text to speech wcag content adaptation inclusive", cx: "High" },
  { id: "77", name: "Research Paper AI", services: ["OpenAI", "AI Search", "Cosmos DB", "Graph", "Functions"], pattern: "research paper academic literature review citation network methodology critique gap identification summarization", cx: "High" },
  { id: "78", name: "Precision Agriculture Agent", services: ["IoT Hub", "AI Vision", "OpenAI", "Digital Twins", "ML"], pattern: "precision agriculture satellite imagery IoT sensor crop health irrigation fertilization yield prediction digital twin farmland", cx: "Very High" },
  { id: "79", name: "Food Safety Inspector AI", services: ["Document Intelligence", "OpenAI", "Cosmos DB", "Event Hubs", "IoT Hub"], pattern: "food safety HACCP contamination supply chain traceability temperature pathogen risk audit regulatory compliance", cx: "High" },
  { id: "80", name: "Biodiversity Monitor", services: ["AI Vision", "OpenAI", "IoT Hub", "Cosmos DB", "Functions"], pattern: "biodiversity species identification camera trap drone acoustic sensor ecosystem health population conservation", cx: "High" },
  { id: "81", name: "Property Valuation AI", services: ["OpenAI", "AI Search", "Cosmos DB", "Machine Learning", "Functions"], pattern: "property valuation appraisal comparable sales market trend neighborhood scoring satellite imagery real estate mortgage underwriting", cx: "High" },
  { id: "82", name: "Construction Safety AI", services: ["AI Vision", "IoT Hub", "OpenAI", "Container Apps", "Cosmos DB"], pattern: "construction safety PPE compliance hazard detection unauthorized zone entry incident reporting camera monitoring site", cx: "High" },
  { id: "83", name: "Building Energy Optimizer", services: ["Digital Twins", "IoT Hub", "OpenAI", "Functions", "Cosmos DB"], pattern: "building energy HVAC lighting occupancy optimization digital twin scheduling predictive maintenance renewable commercial", cx: "Very High" },
  { id: "84", name: "Citizen Services Chatbot", services: ["OpenAI", "AI Translator", "Communication Services", "AI Search", "Cosmos DB"], pattern: "citizen services municipal chatbot multi-language form filling appointment scheduling permit status FAQ escalation government", cx: "Medium" },
  { id: "85", name: "Policy Impact Analyzer", services: ["OpenAI", "AI Search", "Document Intelligence", "Cosmos DB", "Functions"], pattern: "policy impact regulatory change detection stakeholder mapping public comment analysis briefing generation legislative executive", cx: "High" },
  { id: "86", name: "Public Safety Analytics", services: ["OpenAI", "Machine Learning", "Event Hubs", "Cosmos DB", "Stream Analytics"], pattern: "public safety crime pattern prediction resource allocation community sentiment 311 calls incident dashboard law enforcement emergency", cx: "Very High" },
  { id: "87", name: "Dynamic Pricing Engine", services: ["OpenAI", "Event Hubs", "Cosmos DB", "Redis Cache", "Machine Learning"], pattern: "dynamic pricing real-time price optimization demand signals competitor pricing inventory seasonality customer segments revenue fairness retail", cx: "High" },
  { id: "88", name: "Visual Product Search", services: ["AI Vision", "OpenAI", "AI Search", "Container Apps", "Cosmos DB"], pattern: "visual product search reverse image similarity matching style recommendation virtual try-on fashion furniture home decor retail", cx: "High" },
  { id: "89", name: "Retail Inventory Predictor", services: ["OpenAI", "Machine Learning", "Cosmos DB", "Event Hubs", "Functions"], pattern: "retail inventory demand forecasting sales data weather social trends economic indicators stock prediction reorder supplier automation", cx: "High" },
  { id: "90", name: "Network Optimization Agent", services: ["IoT Hub", "Stream Analytics", "OpenAI", "Digital Twins", "Cosmos DB"], pattern: "5G LTE network capacity planning anomaly detection self-healing automation traffic prediction cell tower load balancing digital twin topology telecom", cx: "Very High" },
  { id: "91", name: "Customer Churn Predictor", services: ["OpenAI", "Machine Learning", "Cosmos DB", "Communication Services", "Functions"], pattern: "customer churn prediction usage patterns billing history support interactions network quality retention campaigns telecom subscriber", cx: "High" },
  { id: "92", name: "Telecom Fraud Shield", services: ["Event Hubs", "Stream Analytics", "OpenAI", "Cosmos DB", "Functions"], pattern: "telecom fraud detection SIM swap international revenue share subscription fraud Wangiri callback toll fraud real-time blocking explainable alerts", cx: "High" },
  { id: "93", name: "Continual Learning Agent", services: ["OpenAI", "Cosmos DB", "AI Search", "Redis Cache", "Functions"], pattern: "continual learning memory persistence session reflection failure analysis pattern detection knowledge distillation ever-improving agent", cx: "Very High" },
  { id: "94", name: "AI Podcast Generator", services: ["AI Speech", "OpenAI", "Blob Storage", "CDN", "Functions"], pattern: "text to podcast multi-speaker voice synthesis music transitions chapter markers content safety audio narration blog research meeting notes", cx: "High" },
  { id: "95", name: "Multimodal Search Engine v2", services: ["AI Search", "AI Vision", "AI Speech", "OpenAI", "Container Apps"], pattern: "multimodal search images text code audio cross-modal reasoning vector index fusion query expansion relevance feedback unified", cx: "Very High" },
  { id: "96", name: "Real-Time Voice Agent v2", services: ["AI Voice Live", "OpenAI", "Container Apps", "Functions", "Cosmos DB"], pattern: "real-time voice agent bidirectional websocket VAD voice activity detection function calling avatar rendering transcription sub-200ms latency conversational", cx: "Very High" },
  { id: "97", name: "AI Data Marketplace", services: ["Machine Learning", "Blob Storage", "API Management", "Cosmos DB", "Functions"], pattern: "data marketplace synthetic anonymized datasets differential privacy statistical fidelity usage billing API access training testing monetization", cx: "High" },
  { id: "98", name: "Agent Evaluation Platform", services: ["OpenAI", "Container Apps", "Cosmos DB", "Machine Learning", "Functions"], pattern: "agent evaluation benchmarks regression testing A/B experimentation human preference scoring leaderboard quality safety speed cost satisfaction", cx: "High" },
  { id: "99", name: "Enterprise AI Governance Hub", services: ["API Management", "Policy", "Monitor", "Cosmos DB", "Machine Learning", "Key Vault"], pattern: "enterprise AI governance model registry approval gates policy enforcement cost attribution safety monitoring regulatory compliance SOX EU AI Act ISO 42001", cx: "Very High" },
  { id: "100", name: "FAI Meta-Agent", services: ["OpenAI", "MCP Server", "Container Apps", "Cosmos DB", "AI Search", "Key Vault"], pattern: "meta-agent self-orchestrating super-agent play selection chain assembly infrastructure provisioning primitive configuration evaluation delivery autonomous", cx: "Very High" },
];

const PRICING = {
  "AI Search": { dev: 75, prod: 500, unit: "Basic/Standard S1" },
  "OpenAI (gpt-4o)": { dev: 50, prod: 2000, unit: "~100K/1M req/mo" },
  "OpenAI (gpt-4o-mini)": { dev: 10, prod: 200, unit: "~100K/1M req/mo" },
  "Container App": { dev: 15, prod: 150, unit: "1vCPU/4vCPU" },
  "App Service (B1)": { dev: 13, prod: 55, unit: "B1/S1" },
  "Cosmos DB": { dev: 25, prod: 300, unit: "400/4000 RU/s" },
  "AKS (GPU)": { dev: 200, prod: 2000, unit: "NC6s/NC12s" },
  "ML Workspace": { dev: 50, prod: 500, unit: "Compute+storage" },
  "VNet + PE": { dev: 10, prod: 50, unit: "PE+NSG" },
  "Firewall": { dev: 0, prod: 500, unit: "Premium" },
  "Key Vault": { dev: 1, prod: 5, unit: "Standard" },
  "APIM": { dev: 50, prod: 300, unit: "Dev/Standard" },
  "Redis Cache": { dev: 15, prod: 100, unit: "C1/C3" },
  "Event Hub": { dev: 10, prod: 150, unit: "Basic/Standard" },
  "Stream Analytics": { dev: 50, prod: 300, unit: "1/6 SU" },
  "Log Analytics": { dev: 10, prod: 100, unit: "5/50 GB/day" },
  "App Insights": { dev: 5, prod: 50, unit: "Basic" },
  "Blob Storage": { dev: 5, prod: 50, unit: "LRS Hot" },
  "Communication Services": { dev: 20, prod: 500, unit: "Voice+SMS" },
  "Speech Service": { dev: 15, prod: 200, unit: "S0" },
  "Document Intelligence": { dev: 15, prod: 150, unit: "S0" },
  "Content Safety": { dev: 10, prod: 50, unit: "S0" },
  "IoT Hub": { dev: 10, prod: 100, unit: "S1" },
  "ACR": { dev: 5, prod: 50, unit: "Basic/Standard" },
  "NAT Gateway": { dev: 0, prod: 30, unit: "Standard" },
};

// ── Tool: semantic_search_plays ────────────────────────────────────

function computeSimilarity(query, text) {
  const qt = query.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
  const tt = text.toLowerCase().split(/\s+/);
  if (qt.length === 0) return 0;
  let hits = 0;
  for (const q of qt) { for (const t of tt) { if (t.includes(q) || q.includes(t)) { hits++; break; } } }
  return hits / qt.length;
}

server.tool(
  "semantic_search_plays",
  "SMART PLAY SEARCH — Describe what you want to build in natural language, get top matching solution plays ranked by relevance with confidence scores.",
  {
    query: z.string().describe("Describe what you want to build (e.g., 'process invoices', 'RAG chatbot', 'edge AI on IoT')"),
    top_k: z.number().optional().describe("Number of results (default: 3, max: 5)"),
  },
  async ({ query, top_k = 3 }) => {
    const k = Math.min(Math.max(top_k, 1), 5);
    const scored = PLAY_DATA.map(p => ({
      ...p, score: computeSimilarity(query, `${p.name} ${p.pattern} ${p.services.join(" ")}`)
    })).sort((a, b) => b.score - a.score).slice(0, k);

    const results = scored.map((p, i) => {
      const conf = p.score > 0.5 ? "🟢 High" : p.score > 0.25 ? "🟡 Medium" : "🔴 Low";
      return `### ${i + 1}. Play ${p.id}: ${p.name}\n- **Confidence**: ${conf} (${(p.score * 100).toFixed(0)}%)\n- **Complexity**: ${p.cx}\n- **Services**: ${p.services.join(", ")}\n- **Guide**: /user-guide?play=${p.id}`;
    }).join("\n\n");

    return { content: [{ type: "text", text: `## 🔍 Smart Play Search\n**Query**: "${query}"\n\n${results}\n\n---\n> 💡 Use the [Configurator](https://frootai.dev/configurator) for guided selection.` }] };
  }
);

// ── Tool: estimate_cost ────────────────────────────────────────────

server.tool(
  "estimate_cost",
  "AZURE COST ESTIMATOR — Calculate itemized monthly Azure costs for any solution play at dev or production scale.",
  {
    play: z.string().describe("Play number: 01-20"),
    scale: z.enum(["dev", "prod"]).optional().describe("Scale: 'dev' (default) or 'prod'"),
  },
  async ({ play, scale = "dev" }) => {
    const num = play.padStart(2, "0");
    const pd = PLAY_DATA.find(p => p.id === num);
    if (!pd) return { content: [{ type: "text", text: `❌ Play ${play} not found. Use 01-20.` }] };

    let total = 0;
    const rows = pd.services.map(svc => {
      const pr = PRICING[svc] || { dev: 0, prod: 0, unit: "?" };
      const cost = scale === "prod" ? pr.prod : pr.dev;
      total += cost;
      return `| ${svc} | $${cost}/mo | ${pr.unit} |`;
    });

    return { content: [{ type: "text", text: `## 💰 Cost Estimate: Play ${num} — ${pd.name}\n**Scale**: ${scale === "prod" ? "🏭 Production" : "🧪 Dev/Test"}\n\n| Service | Cost | Tier |\n|---------|------|------|\n${rows.join("\n")}\n| **TOTAL** | **$${total}/mo** | |\n\n### 💡 Tips\n${scale === "prod" ? "- Use Play 14 (AI Gateway) for caching — saves 30-50%\n- Use gpt-4o-mini for classification ($0.15/M vs $2.50/M)\n- Consider reserved capacity for 20-40% savings" : "- Use free tiers where available\n- Use gpt-4o-mini during dev\n- Use serverless Container Apps"}\n\n> ⚠️ Estimates based on Azure retail pricing. Actual costs vary.` }] };
  }
);

// ── Tool: validate_config ──────────────────────────────────────────

server.tool(
  "validate_config",
  "CONFIG VALIDATOR — Validate TuneKit config files (openai.json, guardrails.json) against best practices and play-specific rules.",
  {
    config_type: z.enum(["openai.json", "guardrails.json", "agents.json"]).describe("Config file type"),
    config_content: z.string().describe("JSON content of the config file"),
    play: z.string().optional().describe("Play number for play-specific rules"),
  },
  async ({ config_type, config_content, play }) => {
    let config;
    try { config = JSON.parse(config_content); }
    catch (e) { return { content: [{ type: "text", text: `## 🔴 Invalid JSON\n\`\`\`\n${e.message}\n\`\`\`` }] }; }

    const issues = [], passes = [];
    const rules = {
      "openai.json": [
        ["model", true, (v) => !v ? "🔴 Missing model" : null],
        ["temperature", true, (v) => v === undefined ? "🔴 Missing temperature" : v > 1 ? "🔴 temperature > 1.0 — too random" : v < 0 ? "🔴 Negative temperature" : play === "03" && v > 0 ? "⚠️ Play 03 should use temperature=0" : null],
        ["max_tokens", true, (v) => v === undefined ? "🔴 Missing max_tokens" : v > 4096 ? "⚠️ max_tokens > 4096 — may increase costs" : v < 50 ? "⚠️ max_tokens < 50 — responses will truncate" : null],
      ],
      "guardrails.json": [
        ["blockedTopics", true, (v) => !v ? "🔴 Missing blockedTopics" : Array.isArray(v) && v.length === 0 ? "⚠️ No blocked topics for production" : null],
        ["maxTokensPerRequest", false, (v) => v > 10000 ? "⚠️ Very high token limit" : null],
        ["piiFilter", false, (v) => v === false ? "⚠️ PII filter disabled" : null],
      ],
      "agents.json": [
        ["agents", true, (v) => !v ? "🔴 Missing agents array" : Array.isArray(v) && v.length === 0 ? "⚠️ No agents defined" : null],
      ],
    };

    for (const [field, required, check] of (rules[config_type] || [])) {
      const val = config[field];
      const issue = check(val);
      if (issue) issues.push(issue);
      else if (val !== undefined) passes.push(`✅ \`${field}\` OK`);
      else if (required) issues.push(`🔴 Missing \`${field}\``);
    }

    return { content: [{ type: "text", text: `## 🔧 Validate: ${config_type}${play ? ` (Play ${play})` : ""}\n**Status**: ${issues.length === 0 ? "✅ All good" : `⚠️ ${issues.length} issue(s)`}\n\n${passes.join("\n")}\n${issues.length > 0 ? "\n### Issues\n" + issues.join("\n") : ""}\n\n> Use \`get_architecture_pattern\` for design guidance.` }] };
  }
);

// ═══════════════════════════════════════════════════════════════════
// Phase 8B — compare_plays + generate_architecture_diagram
// ═══════════════════════════════════════════════════════════════════

// ── Tool: compare_plays ────────────────────────────────────────────

server.tool(
  "compare_plays",
  "PLAY COMPARISON — Side-by-side comparison of 2-3 solution plays showing services, cost, complexity, team size, deployment time, and pros/cons.",
  {
    plays: z.string().describe("Comma-separated play numbers to compare (e.g., '01,03' or '01,07,14')"),
  },
  async ({ plays }) => {
    const nums = plays.split(",").map(p => p.trim().padStart(2, "0")).slice(0, 3);
    const selected = nums.map(n => PLAY_DATA.find(p => p.id === n)).filter(Boolean);
    if (selected.length < 2) return { content: [{ type: "text", text: "❌ Need at least 2 valid play numbers (01-20), comma-separated." }] };

    const teamSize = { Low: "1 dev", Medium: "1-2 devs", High: "2-3 devs", Foundation: "1 infra eng" };
    const deployTime = { Low: "1 day", Medium: "2-3 days", High: "1-2 weeks", Foundation: "1-2 days" };
    const headers = ["Aspect", ...selected.map(p => `**Play ${p.id}**`)];
    const rows = [
      ["Name", ...selected.map(p => p.name)],
      ["Complexity", ...selected.map(p => p.cx)],
      ["Azure Services", ...selected.map(p => p.services.join(", "))],
      ["Dev Cost/mo", ...selected.map(p => { let t = 0; p.services.forEach(s => { const pr = PRICING[s]; if (pr) t += pr.dev; }); return `$${t}`; })],
      ["Prod Cost/mo", ...selected.map(p => { let t = 0; p.services.forEach(s => { const pr = PRICING[s]; if (pr) t += pr.prod; }); return `$${t}`; })],
      ["Team Size", ...selected.map(p => teamSize[p.cx] || "1-2 devs")],
      ["Deploy Time", ...selected.map(p => deployTime[p.cx] || "2-3 days")],
      ["Best For", ...selected.map(p => p.pattern.split(" ").slice(0, 5).join(", "))],
    ];
    const table = `| ${headers.join(" | ")} |\n|${headers.map(() => "---").join("|")}|\n${rows.map(r => `| ${r.join(" | ")} |`).join("\n")}`;

    return { content: [{ type: "text", text: `## 🔄 Play Comparison\n\n${table}\n\n### 💡 Recommendation\n${selected.length === 2 ? `- Choose **Play ${selected[0].id}** if you prioritize ${selected[0].cx === "Low" || selected[0].cx === "Medium" ? "simplicity and fast deployment" : "advanced capabilities"}\n- Choose **Play ${selected[1].id}** if you prioritize ${selected[1].cx === "Low" || selected[1].cx === "Medium" ? "simplicity and fast deployment" : "scalability and enterprise features"}` : "Compare the complexity vs. cost tradeoff for your team's capacity."}\n\n> Use \`estimate_cost\` for detailed per-service pricing.\n> Use \`semantic_search_plays\` to find plays by scenario.` }] };
  }
);

// ── Tool: generate_architecture_diagram ────────────────────────────

const PLAY_DIAGRAMS = {
  "01": "graph LR\\n  User[User] -->|Query| App[Container App]\\n  App -->|Search| AIS[AI Search]\\n  App -->|Generate| OAI[Azure OpenAI]\\n  AIS -->|Index| Blob[Blob Storage]\\n  App -->|Chunks| AIS\\n  style OAI fill:#f59e0b22,stroke:#f59e0b\\n  style AIS fill:#10b98122,stroke:#10b981\\n  style App fill:#6366f122,stroke:#6366f1",
  "02": "graph TB\\n  subgraph Hub[Hub VNet]\\n    FW[Firewall]\\n    KV[Key Vault]\\n  end\\n  subgraph Spoke[Spoke VNet]\\n    PE[Private Endpoints]\\n    AI[AI Services]\\n  end\\n  Hub --> Spoke\\n  style Hub fill:#f59e0b22,stroke:#f59e0b\\n  style Spoke fill:#10b98122,stroke:#10b981",
  "03": "graph LR\\n  User -->|Request| Agent[Container App]\\n  Agent -->|temp=0| OAI[OpenAI]\\n  Agent -->|Check| CS[Content Safety]\\n  OAI -->|Deterministic| Agent\\n  style Agent fill:#6366f122,stroke:#6366f1\\n  style CS fill:#f43f5e22,stroke:#f43f5e",
  "04": "graph LR\\n  Phone[Phone Call] -->|Audio| ACS[Comm Services]\\n  ACS -->|Stream| STT[Speech-to-Text]\\n  STT -->|Text| OAI[OpenAI]\\n  OAI -->|Response| TTS[Text-to-Speech]\\n  TTS -->|Audio| ACS\\n  style STT fill:#06b6d422,stroke:#06b6d4\\n  style OAI fill:#f59e0b22,stroke:#f59e0b",
  "05": "graph LR\\n  Ticket[IT Ticket] -->|Event| SB[Service Bus]\\n  SB -->|Trigger| LA[Logic App]\\n  LA -->|Analyze| OAI[OpenAI]\\n  LA -->|Resolve| Ticket\\n  style LA fill:#10b98122,stroke:#10b981\\n  style OAI fill:#f59e0b22,stroke:#f59e0b",
  "06": "graph LR\\n  Doc[Documents] -->|Upload| Blob[Blob Storage]\\n  Blob -->|Extract| DI[Doc Intelligence]\\n  DI -->|Structured| OAI[OpenAI]\\n  OAI -->|JSON| Output[Structured Output]\\n  style DI fill:#7c3aed22,stroke:#7c3aed",
  "07": "graph TB\\n  User -->|Request| Coord[Coordinator Agent]\\n  Coord -->|Delegate| Builder[Builder Agent]\\n  Coord -->|Delegate| Reviewer[Reviewer Agent]\\n  Builder -->|State| DB[(Cosmos DB)]\\n  Reviewer -->|State| DB\\n  Builder -->|Generate| OAI[OpenAI]\\n  style Coord fill:#f59e0b22,stroke:#f59e0b",
  "14": "graph LR\\n  Clients -->|API| APIM[API Management]\\n  APIM -->|Cache Hit| Redis[Redis Cache]\\n  APIM -->|Cache Miss| OAI[OpenAI]\\n  APIM -->|Meter| Logs[Token Metrics]\\n  style APIM fill:#10b98122,stroke:#10b981\\n  style Redis fill:#06b6d422,stroke:#06b6d4",
  "17": "graph TB\\n  Apps[Applications] -->|Telemetry| AI[App Insights]\\n  AI -->|Logs| LA[Log Analytics]\\n  LA -->|KQL| Dash[Dashboard]\\n  LA -->|Rules| Alerts[Alert Rules]\\n  style AI fill:#6366f122,stroke:#6366f1\\n  style Dash fill:#10b98122,stroke:#10b981",
  "19": "graph LR\\n  Cloud[Cloud] -->|Deploy| IoT[IoT Hub]\\n  IoT -->|Model| Device[Edge Device]\\n  Device -->|Phi-4| Inference[Local Inference]\\n  Inference -->|Results| IoT\\n  style Device fill:#7c3aed22,stroke:#7c3aed\\n  style Inference fill:#10b98122,stroke:#10b981",
  "20": "graph LR\\n  Sensors -->|Events| EH[Event Hub]\\n  EH -->|Stream| SA[Stream Analytics]\\n  SA -->|Anomaly| OAI[OpenAI]\\n  SA -->|Store| DB[(Cosmos DB)]\\n  OAI -->|Alert| Alert[Notification]\\n  style SA fill:#06b6d422,stroke:#06b6d4\\n  style EH fill:#f59e0b22,stroke:#f59e0b",
};

server.tool(
  "generate_architecture_diagram",
  "ARCHITECTURE DIAGRAM — Generate a Mermaid.js architecture diagram for any solution play. Paste the output into any Mermaid renderer to visualize.",
  {
    play: z.string().describe("Play number: 01-20"),
  },
  async ({ play }) => {
    const num = play.padStart(2, "0");
    const pd = PLAY_DATA.find(p => p.id === num);
    if (!pd) return { content: [{ type: "text", text: "❌ Play not found. Use 01-20." }] };

    const diagram = PLAY_DIAGRAMS[num];
    if (!diagram) {
      // Generate a generic diagram for plays without a custom template
      const svcs = pd.services.map((s, i) => `  S${i}[${s}]`).join("\\n");
      const flows = pd.services.map((_, i) => i > 0 ? `  S0 --> S${i}` : "").filter(Boolean).join("\\n");
      const generic = `graph LR\\n  User[User] --> S0[${pd.services[0]}]\\n${svcs}\\n${flows}`;
      return { content: [{ type: "text", text: `## 🏗️ Architecture: Play ${num} — ${pd.name}\n\n\`\`\`mermaid\n${generic.replace(/\\n/g, "\n")}\n\`\`\`\n\n**Services**: ${pd.services.join(", ")}\n\n> 📋 Generic diagram. Paste into [Mermaid Live Editor](https://mermaid.live) to visualize.` }] };
    }

    return { content: [{ type: "text", text: `## 🏗️ Architecture: Play ${num} — ${pd.name}\n\n\`\`\`mermaid\n${diagram.replace(/\\n/g, "\n")}\n\`\`\`\n\n**Services**: ${pd.services.join(", ")}\n**Complexity**: ${pd.cx}\n\n> 📋 Paste into [Mermaid Live Editor](https://mermaid.live) or any Markdown renderer that supports Mermaid.\n> Use \`estimate_cost\` for pricing details.` }] };
  }
);

// ═══════════════════════════════════════════════════════════════════
// Phase 8C — run_evaluation (local threshold-based evaluation)
// ═══════════════════════════════════════════════════════════════════

server.tool(
  "run_evaluation",
  "RUN EVALUATION — Check AI quality scores against thresholds. Input actual scores from your evaluation run, get pass/fail per metric. Supports: groundedness, relevance, coherence, fluency, safety.",
  {
    scores: z.record(z.number()).describe("Metric scores e.g. {groundedness: 4.5, relevance: 3.8, coherence: 4.1, fluency: 4.6}"),
    thresholds: z.record(z.number()).optional().describe("Custom thresholds (default: 4.0 for all). e.g. {groundedness: 4.5, relevance: 3.5}"),
    play: z.string().optional().describe("Solution play number for context (e.g. '01')"),
  },
  async ({ scores, thresholds, play }) => {
    const defaultThresholds = { groundedness: 4.0, relevance: 4.0, coherence: 4.0, fluency: 4.0, safety: 4.0 };
    const t = { ...defaultThresholds, ...thresholds };
    const results = [];
    let passCount = 0;
    let totalCount = 0;

    for (const [metric, score] of Object.entries(scores)) {
      const threshold = t[metric] || 4.0;
      const passed = score >= threshold;
      if (passed) passCount++;
      totalCount++;
      results.push(`| ${metric} | ${score.toFixed(1)} | ${threshold.toFixed(1)} | ${passed ? "✅ PASS" : "❌ FAIL"} |`);
    }

    const allPassed = passCount === totalCount;
    const playCtx = play ? ` (Play ${play})` : "";
    const verdict = allPassed
      ? `✅ **ALL CHECKS PASSED**${playCtx} — ${passCount}/${totalCount} metrics meet thresholds. Ready for production.`
      : `❌ **${totalCount - passCount} CHECK(S) FAILED**${playCtx} — ${passCount}/${totalCount} passed. Review failing metrics before deploying.`;

    const recommendations = [];
    for (const [metric, score] of Object.entries(scores)) {
      const threshold = t[metric] || 4.0;
      if (score < threshold) {
        if (metric === "groundedness") recommendations.push("- **Groundedness**: Add more citations, increase context window, reduce chunk overlap");
        if (metric === "relevance") recommendations.push("- **Relevance**: Improve system prompt specificity, tune top-k, add query rewriting");
        if (metric === "coherence") recommendations.push("- **Coherence**: Reduce temperature, add response structure requirements");
        if (metric === "fluency") recommendations.push("- **Fluency**: Switch to larger model (gpt-4o), increase max_tokens");
        if (metric === "safety") recommendations.push("- **Safety**: Enable Content Safety API, tighten guardrails.json severity thresholds");
      }
    }

    return { content: [{ type: "text", text: `## 📊 Evaluation Results${playCtx}\n\n| Metric | Score | Threshold | Result |\n|--------|-------|-----------|--------|\n${results.join("\n")}\n\n${verdict}${recommendations.length > 0 ? "\n\n### 💡 Recommendations\n" + recommendations.join("\n") : ""}` }] };
  }
);

// ═══════════════════════════════════════════════════════════════════
// Phase 8C — embedding_playground (lite — no Azure OpenAI required)
// ═══════════════════════════════════════════════════════════════════

server.tool(
  "embedding_playground",
  "EMBEDDING EXPLORER — Compare two texts for semantic similarity using keyword-based approximation. Educational tool for learning about embeddings and RAG concepts.",
  {
    text1: z.string().describe("First text to compare"),
    text2: z.string().describe("Second text to compare"),
  },
  async ({ text1, text2 }) => {
    // Tokenize and compute Jaccard-like similarity
    const tokenize = (t) => [...new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length >= 3))];
    const t1 = tokenize(text1);
    const t2 = tokenize(text2);
    const intersection = t1.filter(w => t2.includes(w));
    const union = [...new Set([...t1, ...t2])];
    const similarity = union.length > 0 ? intersection.length / union.length : 0;

    const simLabel = similarity > 0.5 ? "🟢 High" : similarity > 0.2 ? "🟡 Medium" : "🔴 Low";

    return { content: [{ type: "text", text: `## 🔬 Embedding Playground\n\n| Metric | Value |\n|--------|-------|\n| **Similarity** | ${simLabel} (${(similarity * 100).toFixed(1)}%) |\n| **Text 1 tokens** | ${t1.length} unique words |\n| **Text 2 tokens** | ${t2.length} unique words |\n| **Overlap** | ${intersection.length} shared words |\n| **Union** | ${union.length} total unique words |\n\n### 🔍 Shared Terms\n${intersection.length > 0 ? intersection.map(w => `\`${w}\``).join(", ") : "_No shared terms_"}\n\n### 💡 What This Means for RAG\n- **High similarity** (>50%): Documents would cluster together in vector search\n- **Medium** (20-50%): Partial overlap — may appear in broader searches\n- **Low** (<20%): Different topics — unlikely to match in semantic search\n\n> ⚠️ This uses keyword overlap (Jaccard similarity). Real embeddings use 1536-dimensional vectors for richer semantic understanding.\n> For production RAG, use Azure OpenAI text-embedding-3-small.` }] };
  }
);

// ── T24: List Primitives ──────────────────────────────────────────

server.tool(
  "list_primitives",
  "PRIMITIVES CATALOG — Browse all 830+ FrootAI primitives by type: agents (238), instructions (176), skills (282), hooks (10), plugins (77), workflows (13), cookbook (17). Returns name, description, WAF alignment, and compatible plays for each primitive.",
  {
    type: z.enum(["agents", "instructions", "skills", "hooks", "plugins", "workflows", "cookbook"]).describe("Primitive type to list"),
    limit: z.number().optional().default(20).describe("Max results to return (default 20)"),
  },
  async ({ type, limit }) => {
    const fs = await import("fs");
    const path = await import("path");
    const counts = { agents: 201, instructions: 176, skills: 282, hooks: 10, plugins: 77, workflows: 13, cookbook: 17 };
    const dirs = {
      agents: "agents", instructions: "instructions", skills: "skills",
      hooks: "hooks", plugins: "plugins", workflows: "workflows", cookbook: "cookbook"
    };
    const dirPath = path.default.join(process.cwd(), dirs[type] || type);
    let items = [];
    try {
      const entries = fs.default.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries.slice(0, limit)) {
        const name = entry.name.replace(/\.(agent|instructions)\.md$/, "").replace(/\.md$/, "");
        let desc = "";
        const filePath = entry.isDirectory()
          ? path.default.join(dirPath, entry.name, "SKILL.md")
          : path.default.join(dirPath, entry.name);
        if (fs.default.existsSync(filePath)) {
          const content = fs.default.readFileSync(filePath, "utf8").substring(0, 500);
          const descMatch = content.match(/description:\s*["'](.+?)["']/);
          if (descMatch) desc = descMatch[1];
          else {
            const firstLine = content.split("\n").find(l => l.startsWith("#"));
            if (firstLine) desc = firstLine.replace(/^#+\s*/, "");
          }
        }
        items.push({ name, description: desc || name });
      }
    } catch (e) {
      items = [{ name: "Directory not found", description: `${type} directory not accessible from current working directory` }];
    }
    const total = counts[type] || items.length;
    const listing = items.map((it, i) => `${i + 1}. **${it.name}** — ${it.description}`).join("\n");
    return { content: [{ type: "text", text: `## ${type.charAt(0).toUpperCase() + type.slice(1)} Catalog (${Math.min(limit, total)} of ${total})\n\n${listing}\n\n---\n📊 **Total ${type}**: ${total} | 🌐 [Browse all on frootai.dev](https://frootai.dev/primitives/${type})` }] };
  }
);

// ── T25: Get Play Detail ──────────────────────────────────────────

server.tool(
  "get_play_detail",
  "PLAY DEEP DIVE — Get detailed architecture, services, config, evaluation metrics, and file structure for a specific solution play (01-100). Returns everything needed to implement or customize the play.",
  {
    play_number: z.string().describe("Play number (01-100) or partial name to search for"),
  },
  async ({ play_number }) => {
    const fs = await import("fs");
    const path = await import("path");
    const playsDir = path.default.join(process.cwd(), "solution-plays");
    let playDir = null;
    let playFolder = null;
    try {
      const dirs = fs.default.readdirSync(playsDir).filter(d => {
        return fs.default.statSync(path.default.join(playsDir, d)).isDirectory();
      });
      playFolder = dirs.find(d => d.startsWith(play_number.padStart(2, "0") + "-")) ||
        dirs.find(d => d.toLowerCase().includes(play_number.toLowerCase()));
      if (playFolder) playDir = path.default.join(playsDir, playFolder);
    } catch (e) { /* ignore */ }

    if (!playDir || !playFolder) {
      return { content: [{ type: "text", text: `Play "${play_number}" not found. Use list_community_plays to browse all 101 plays.` }] };
    }

    const readFile = (rel) => {
      const fp = path.default.join(playDir, rel);
      try { return fs.default.readFileSync(fp, "utf8"); } catch { return null; }
    };

    // Gather play data
    const readme = readFile("README.md");
    const manifest = readFile("fai-manifest.json");
    const openaiConfig = readFile("config/openai.json");
    const guardrails = readFile("config/guardrails.json");

    // Count files
    let fileCount = 0;
    const countFiles = (dir) => {
      try {
        for (const e of fs.default.readdirSync(dir, { withFileTypes: true })) {
          if (e.isFile()) fileCount++;
          else if (e.isDirectory()) countFiles(path.default.join(dir, e.name));
        }
      } catch { /* ignore */ }
    };
    countFiles(playDir);

    const playName = playFolder.replace(/^\d+-/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const playId = playFolder.split("-")[0];

    let output = `## Play ${playId}: ${playName}\n\n`;
    output += `📁 **Files**: ${fileCount} | 📂 **Folder**: solution-plays/${playFolder}\n\n`;

    // README excerpt (first 30 lines)
    if (readme) {
      const excerpt = readme.split("\n").slice(0, 30).join("\n");
      output += `### Overview\n${excerpt}\n\n`;
    }

    // Config summary
    if (openaiConfig) {
      try {
        const cfg = JSON.parse(openaiConfig);
        output += `### Model Configuration\n| Setting | Value |\n|---------|-------|\n`;
        output += `| Model | ${cfg.model || "gpt-4o"} |\n`;
        output += `| Temperature | ${cfg.temperature ?? 0.1} |\n`;
        output += `| Max Tokens | ${cfg.max_tokens ?? 4096} |\n`;
        output += `| API Version | ${cfg.api_version || "2024-12-01-preview"} |\n\n`;
      } catch { /* skip */ }
    }

    // Manifest summary
    if (manifest) {
      try {
        const m = JSON.parse(manifest);
        output += `### FAI Manifest\n`;
        output += `- **Play**: ${m.play || playFolder}\n`;
        output += `- **Version**: ${m.version || "1.0.0"}\n`;
        if (m.context?.waf) output += `- **WAF Pillars**: ${m.context.waf.join(", ")}\n`;
        if (m.primitives) output += `- **Primitives**: ${Object.keys(m.primitives).join(", ")}\n`;
        output += "\n";
      } catch { /* skip */ }
    }

    // DevKit structure
    output += `### DevKit Structure\n`;
    output += `- \`.github/agents/\` — builder, reviewer, tuner (chained workflow)\n`;
    output += `- \`.github/instructions/\` — coding standards, security, Azure patterns\n`;
    output += `- \`.github/prompts/\` — /deploy, /evaluate, /review, /test\n`;
    output += `- \`.github/skills/\` — deploy-azure, evaluate, tune\n`;
    output += `- \`config/\` — openai.json, guardrails.json, agents.json\n`;
    output += `- \`evaluation/\` — eval.py, test-set.jsonl\n`;
    output += `- \`infra/\` — main.bicep, parameters.json\n\n`;

    output += `🔗 [View on website](https://frootai.dev/solution-plays/${playFolder}) | [User Guide](https://frootai.dev/user-guide?play=${playId})`;

    return { content: [{ type: "text", text: output }] };
  }
);

// ════════════════════════════════════════════════════════════════════
// MCP RESOURCES — Protocol-native content discovery (Phase 1, T6)
// ════════════════════════════════════════════════════════════════════

// ── Resource: Overview ─────────────────────────────────────────────

server.resource(
  "frootai-overview",
  "frootai://overview",
  { mimeType: "text/plain" },
  async () => ({
    contents: [{
      uri: "frootai://overview",
      mimeType: "text/plain",
      text: `FrootAI — FAI Engine Runtime Interface
The open glue that binds infrastructure, platform, and application.

🌱 F — Foundations: GenAI Foundations, LLM Landscape, AI Glossary A-Z, .github Agentic OS
🪵 R — Reasoning: Prompt Engineering, RAG Architecture, Deterministic AI
🌿 O — Orchestration: Semantic Kernel, AI Agents, MCP/Tools
🏗️ O — Operations: Azure AI Platform, Infrastructure, Copilot
🍎 T — Transformation: Fine-Tuning, Responsible AI, Production Patterns

18 modules | 200+ AI terms | 29 tools | 100 solution plays | FAI Engine
Engine: ${faiEngine?.available ? 'connected' : 'not available (npm mode)'}
https://frootai.dev`,
    }],
  })
);

// ── Resources: FROOT Knowledge Modules ─────────────────────────────

for (const [modId, mod] of Object.entries(modules)) {
  server.resource(
    `fai-module-${modId.toLowerCase()}`,
    `fai://module/${modId}`,
    { mimeType: "text/markdown" },
    async () => ({
      contents: [{
        uri: `fai://module/${modId}`,
        mimeType: "text/markdown",
        text: mod.content.length > 15000
          ? mod.content.substring(0, 15000) + "\n\n[truncated — use get_module with section parameter for specific parts]"
          : mod.content,
      }],
    })
  );
}

// ── Resources: FAI Protocol Schemas ────────────────────────────────

const SCHEMA_DIR = join(__dirname, "..", "schemas");
const SCHEMA_NAMES = ["agent", "instruction", "skill", "hook", "plugin", "fai-manifest", "fai-context"];

for (const name of SCHEMA_NAMES) {
  const schemaPath = join(SCHEMA_DIR, `${name}.schema.json`);
  if (existsSync(schemaPath)) {
    server.resource(
      `fai-schema-${name}`,
      `fai://schema/${name}`,
      { mimeType: "application/json" },
      async () => ({
        contents: [{
          uri: `fai://schema/${name}`,
          mimeType: "application/json",
          text: readFileSync(schemaPath, "utf-8"),
        }],
      })
    );
  }
}

// ════════════════════════════════════════════════════════════════════
// MCP PROMPTS — Protocol-native templates (Phase 1, T7)
// ════════════════════════════════════════════════════════════════════

server.prompt(
  "build",
  "Start the FAI Builder workflow — get architecture guidance and building rules for a task.",
  [{ name: "task", description: "What to build (e.g., 'RAG pipeline', 'voice AI agent', 'content moderation')", required: true }],
  async ({ task }) => ({
    messages: [{
      role: "user",
      content: { type: "text", text: `I want to build: ${task}\n\nPlease use the agent_build tool to get architecture guidance from the FrootAI knowledge base, then help me implement it following FAI DevKit patterns.` },
    }],
  })
);

server.prompt(
  "review",
  "Start the FAI Reviewer workflow — security, quality, and compliance audit.",
  [{ name: "context", description: "What to review (optional — e.g., 'the RAG API I just built')", required: false }],
  async ({ context }) => ({
    messages: [{
      role: "user",
      content: { type: "text", text: `Review ${context || 'my implementation'} using the agent_review tool. Check for security issues (OWASP LLM Top 10), Azure best practices, config compliance, and WAF alignment.` },
    }],
  })
);

server.prompt(
  "tune",
  "Start the FAI Tuner workflow — validate production readiness.",
  [{ name: "context", description: "What to validate for production (optional)", required: false }],
  async ({ context }) => ({
    messages: [{
      role: "user",
      content: { type: "text", text: `Validate ${context || 'my project'} for production readiness using the agent_tune tool. Check TuneKit configs (openai.json, guardrails.json), evaluation thresholds, and infrastructure templates.` },
    }],
  })
);

if (faiEngine?.available) {
  server.prompt(
    "wire",
    "Wire a solution play — load the FAI Protocol manifest and inspect how primitives connect.",
    [{ name: "playId", description: "Play ID (e.g., '01', '21-agentic-rag')", required: true }],
    async ({ playId }) => ({
      messages: [{
        role: "user",
        content: { type: "text", text: `Wire solution play ${playId} using the wire_play tool to load its FAI Protocol manifest and see the wiring status. Then use inspect_wiring to show the detailed primitive graph — which agents, skills, instructions, and hooks are connected through the FAI Layer.` },
      }],
    })
  );
}

// ════════════════════════════════════════════════════════════════════
// FAI ENGINE TOOLS — The Differentiator (Phase 1)
// These tools are what no other MCP server in the world can do.
// They only register when the FAI Engine is available (repo mode).
// ════════════════════════════════════════════════════════════════════

if (faiEngine && faiEngine.available) {

  // ── Tool: wire_play ────────────────────────────────────────────────

  server.tool(
    "wire_play",
    "FAI ENGINE — Wire a solution play using the FAI Protocol. Reads fai-manifest.json, resolves FROOT knowledge context, wires all primitives (agents, instructions, skills, hooks) with shared context, and checks quality gates. This is the FAI Layer in action — no other MCP server can do this.",
    {
      playId: z.string().optional().describe("Play ID (e.g., '01', '01-enterprise-rag'). Searches solution-plays/ for the manifest."),
      manifestPath: z.string().optional().describe("Direct path to fai-manifest.json (for custom locations)."),
    },
    { annotations: { readOnlyHint: true, openWorldHint: false } },
    async ({ playId, manifestPath }) => {
      if (!playId && !manifestPath) {
        return { content: [{ type: "text", text: "❌ Provide either playId or manifestPath." }], isError: true };
      }

      const result = faiEngine.runPlay({ playId, manifestPath });

      if (!result.success && result.error) {
        return { content: [{ type: "text", text: `❌ ${result.error}` }], isError: true };
      }

      const report = [
        `## 🍊 FAI Engine — Wiring Report`,
        ``,
        `| Aspect | Value |`,
        `|--------|-------|`,
        `| **Play** | ${result.play || 'unknown'} |`,
        `| **Version** | ${result.version || '?'} |`,
        `| **Status** | ${result.errors?.length === 0 ? '✅ All primitives wired' : `⚠️ Wired with ${result.errors?.length || 0} issue(s)`} |`,
        `| **Duration** | ${result.duration}ms |`,
        ``,
        `### Context (FAI Layer)`,
        `- **Scope**: ${result.context?.scope || 'default'}`,
        `- **Knowledge Modules**: ${result.context?.modules?.join(', ') || 'none'}`,
        `- **WAF Pillars**: ${result.context?.wafCount || 0} enforced`,
        ``,
        `### Primitives Wired`,
        `| Type | Count |`,
        `|------|-------|`,
        `| Agents | ${result.wiring?.agents || 0} |`,
        `| Instructions | ${result.wiring?.instructions || 0} |`,
        `| Skills | ${result.wiring?.skills || 0} |`,
        `| Hooks | ${result.wiring?.hooks || 0} |`,
        `| Workflows | ${result.wiring?.workflows || 0} |`,
        `| **Total** | **${result.wiring?.total || 0}** |`,
        ``,
        `### Quality Gates`,
        `| Metric | Threshold | Action if Failed |`,
        `|--------|-----------|-----------------|`,
        `| Groundedness | ≥ ${((result.guardrails?.groundedness || 0.95) * 100).toFixed(0)}% | retry |`,
        `| Coherence | ≥ ${((result.guardrails?.coherence || 0.90) * 100).toFixed(0)}% | retry |`,
        `| Relevance | ≥ ${((result.guardrails?.relevance || 0.85) * 100).toFixed(0)}% | warn |`,
        `| Safety | = 0 violations | block |`,
        `| Cost | ≤ $${result.guardrails?.costPerQuery || 0.01}/query | alert |`,
      ];

      if (result.errors?.length > 0) {
        report.push(``, `### ⚠️ Issues (${result.errors.length})`);
        result.errors.forEach(e => report.push(`- ${e}`));
      }

      report.push(``, `---`, `*FAI Protocol — the binding glue for AI primitives*`);
      return { content: [{ type: "text", text: report.join('\n') }] };
    }
  );

  // ── Tool: validate_manifest ────────────────────────────────────────

  server.tool(
    "validate_manifest",
    "FAI PROTOCOL VALIDATOR — Validate a fai-manifest.json file against the FAI Protocol specification. Checks play ID format, semantic versioning, knowledge module references, WAF pillar names, guardrail ranges, and primitive path existence.",
    {
      playId: z.string().describe("Play ID to validate (e.g., '01', '21-agentic-rag')"),
    },
    { annotations: { readOnlyHint: true, openWorldHint: false } },
    async ({ playId }) => {
      const mfPath = faiEngine.findManifest(playId);
      if (!mfPath) {
        return { content: [{ type: "text", text: `❌ Play "${playId}" not found in solution-plays/.` }], isError: true };
      }

      const { manifest, playDir, errors } = faiEngine.loadManifest(mfPath);
      if (!manifest) {
        return { content: [{ type: "text", text: `❌ Failed to load manifest:\n${errors.join('\n')}` }], isError: true };
      }

      const { resolved, missing } = faiEngine.resolvePaths(manifest, playDir);
      const allErrors = [...errors, ...missing.map(m => `Missing file: ${m}`)];

      const checks = [
        `✅ play: "${manifest.play}" (valid NN-kebab-case)`,
        `✅ version: "${manifest.version}" (valid semver)`,
        `${manifest.context?.knowledge?.length > 0 ? '✅' : '❌'} knowledge: ${manifest.context?.knowledge?.length || 0} module(s) — ${(manifest.context?.knowledge || []).join(', ')}`,
        `${manifest.context?.waf?.length > 0 ? '✅' : '❌'} waf: ${(manifest.context?.waf || []).join(', ') || 'none'}`,
        `${manifest.primitives?.agents ? '✅' : '⚠️'} agents: ${manifest.primitives?.agents?.length || 0} declared`,
        `${manifest.primitives?.instructions ? '✅' : '⚠️'} instructions: ${manifest.primitives?.instructions?.length || 0} declared`,
        `${manifest.primitives?.skills ? '✅' : '⚠️'} skills: ${manifest.primitives?.skills?.length || 0} declared`,
        `${manifest.primitives?.hooks ? '✅' : '⚠️'} hooks: ${manifest.primitives?.hooks?.length || 0} declared`,
        `${manifest.primitives?.guardrails ? '✅' : '⚠️'} guardrails: ${manifest.primitives?.guardrails ? 'defined' : 'missing'}`,
        `${missing.length === 0 ? '✅' : '❌'} paths: ${missing.length === 0 ? 'all resolved' : `${missing.length} missing`}`,
      ];

      const verdict = allErrors.length === 0
        ? '✅ **VALID** — Manifest passes all FAI Protocol checks.'
        : `⚠️ **${allErrors.length} ISSUE(S)** — Review before deploying.`;

      return {
        content: [{
          type: "text",
          text: `## 📋 FAI Manifest Validation — ${manifest.play}\n\n${checks.join('\n')}\n\n${verdict}${allErrors.length > 0 ? '\n\n### Issues\n' + allErrors.map(e => `- ${e}`).join('\n') : ''}`
        }]
      };
    }
  );

  // ── Tool: evaluate_quality ─────────────────────────────────────────

  server.tool(
    "evaluate_quality",
    "FAI QUALITY GATES — Evaluate AI output quality against guardrail thresholds from the FAI Protocol manifest. When a playId is provided, loads play-specific thresholds instead of defaults. Supports: groundedness, coherence, relevance, safety, cost.",
    {
      scores: z.record(z.number()).describe("Metric scores e.g. {groundedness: 0.97, coherence: 0.93, relevance: 0.88, safety: 0, cost: 0.008}"),
      playId: z.string().optional().describe("Play ID to load play-specific guardrail thresholds from fai-manifest.json"),
    },
    { annotations: { readOnlyHint: true, idempotentHint: true } },
    async ({ scores, playId }) => {
      let guardrails = {};

      if (playId) {
        const mfPath = faiEngine.findManifest(playId);
        if (mfPath) {
          const { manifest } = faiEngine.loadManifest(mfPath);
          if (manifest?.primitives?.guardrails) {
            guardrails = manifest.primitives.guardrails;
          }
        }
      }

      const evaluator = faiEngine.createEvaluator(guardrails);
      const result = evaluator.evaluate(scores);
      return { content: [{ type: "text", text: evaluator.formatReport(result) }] };
    }
  );

  // ── Tool: inspect_wiring ───────────────────────────────────────────

  server.tool(
    "inspect_wiring",
    "FAI LAYER X-RAY — Inspect how primitives are wired inside a solution play. Shows each agent, its skills, constraining instructions, guarding hooks, shared knowledge context, and WAF alignment. The visual proof that the FAI Protocol works.",
    {
      playId: z.string().describe("Play ID to inspect (e.g., '01', '21-agentic-rag')"),
    },
    { annotations: { readOnlyHint: true, openWorldHint: false } },
    async ({ playId }) => {
      const mfPath = faiEngine.findManifest(playId);
      if (!mfPath) {
        return { content: [{ type: "text", text: `❌ Play "${playId}" not found.` }], isError: true };
      }

      const engine = faiEngine.initEngine(mfPath);

      const lines = [
        `## 🔬 FAI Layer X-Ray — ${engine.manifest?.play || playId}`,
        ``,
        `### Shared Context (injected into every primitive)`,
        `- **Scope**: ${engine.context?.scope || 'default'}`,
        `- **Knowledge**: ${engine.context?.modules?.join(', ') || 'none'} (${engine.context?.knowledgeCount || 0} module(s))`,
        `- **WAF**: ${engine.context?.wafCount || 0} pillar(s) enforced`,
        ``,
        `### Primitive Graph`,
      ];

      const w = engine.wiring;
      if (w?.primitives) {
        for (const [type, items] of Object.entries(w.primitives)) {
          if (!Array.isArray(items) || items.length === 0) continue;
          lines.push(``, `#### ${type.charAt(0).toUpperCase() + type.slice(1)} (${items.length})`);
          for (const p of items) {
            const name = p.name || p.path?.split(/[/\\]/).pop() || 'unknown';
            lines.push(`- **${name}**`);
            if (p.description) lines.push(`  - Description: ${p.description}`);
            if (p.waf && Array.isArray(p.waf) && p.waf.length > 0) {
              lines.push(`  - WAF: ${p.waf.join(', ')}`);
            }
            if (p.sharedContext) {
              lines.push(`  - Context: scope=${p.sharedContext.scope}, ${p.sharedContext.knowledgeModules?.length || 0} modules, ${p.sharedContext.wafPillars?.length || 0} WAF pillars`);
            }
          }
        }
      }

      const s = w?.stats || {};
      lines.push(``, `### Wiring Summary`);
      lines.push('```');
      lines.push(`Agents (${s.agents || 0}) ──→ constrained by ──→ Instructions (${s.instructions || 0})`);
      lines.push(`  │`);
      lines.push(`  ├── invoke ──→ Skills (${s.skills || 0})`);
      lines.push(`  ├── guarded by ──→ Hooks (${s.hooks || 0})`);
      lines.push(`  └── automated by ──→ Workflows (${s.workflows || 0})`);
      lines.push(`  │`);
      lines.push(`  └── ALL share ──→ FAI Context (${engine.context?.knowledgeCount || 0} knowledge + ${engine.context?.wafCount || 0} WAF)`);
      lines.push('```');

      // Quality gates
      if (engine.evaluator?.thresholds) {
        const t = engine.evaluator.thresholds;
        lines.push(``, `### Quality Gates (from manifest)`);
        lines.push(`| Metric | Threshold |`);
        lines.push(`|--------|-----------|`);
        lines.push(`| Groundedness | ≥ ${(t.groundedness * 100).toFixed(0)}% |`);
        lines.push(`| Coherence | ≥ ${(t.coherence * 100).toFixed(0)}% |`);
        lines.push(`| Relevance | ≥ ${(t.relevance * 100).toFixed(0)}% |`);
        lines.push(`| Safety | ${t.safety} violations max |`);
        lines.push(`| Cost | ≤ $${t.costPerQuery}/query |`);
      }

      if (engine.errors?.length > 0) {
        lines.push(``, `### ⚠️ Issues (${engine.errors.length})`);
        engine.errors.forEach(e => lines.push(`- ${e}`));
      }

      lines.push(``, `---`, `*This is the FAI Layer — shared context that makes standalone primitives work as one system.*`);
      return { content: [{ type: "text", text: lines.join('\n') }] };
    }
  );

  // ════════════════════════════════════════════════════════════════════
  // SCAFFOLD & CREATE TOOLS — Phase 2
  // Empowerment: people create plays and primitives through MCP.
  // What they create auto-wires through the FAI Protocol.
  // ════════════════════════════════════════════════════════════════════

  // ── Helper: generate play name + number ──────────────────────────

  function nextPlayNumber() {
    const playsDir = join(process.cwd(), "solution-plays");
    if (!existsSync(playsDir)) return "101";
    const dirs = readdirSync(playsDir).filter(d => /^\d{2,3}-/.test(d)).map(d => parseInt(d.split("-")[0]));
    const max = dirs.length > 0 ? Math.max(...dirs) : 100;
    return String(max + 1).padStart(2, "0");
  }

  function kebabCase(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function safeMkdir(dir) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  function safeWrite(filePath, content) {
    safeMkdir(dirname(filePath));
    writeFileSync_fn(filePath, content, "utf-8");
  }

  // ── Tool: scaffold_play ──────────────────────────────────────────

  server.tool(
    "scaffold_play",
    "FAI SCAFFOLD — Generate a complete solution play with DevKit (.github/ Agentic OS), TuneKit (config/ + evaluation/), SpecKit (spec/ + fai-manifest.json), and infrastructure (infra/). Everything auto-wires through the FAI Protocol.",
    {
      name: z.string().describe("Play name in plain English (e.g., 'Customer Support Chatbot', 'Invoice Processor')"),
      description: z.string().optional().describe("What this play does (1-2 sentences)"),
      model: z.enum(["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3", "o4-mini"]).optional().default("gpt-4o"),
      wafPillars: z.array(z.string()).optional().default(["security", "reliability", "cost-optimization"]),
      temperature: z.number().optional().default(0.1),
      generateInfra: z.boolean().optional().default(true).describe("Generate Bicep infrastructure (infra/)"),
      dryRun: z.boolean().optional().default(false).describe("Preview file list without creating"),
    },
    { annotations: { destructiveHint: true, idempotentHint: false } },
    async ({ name, description, model, wafPillars, temperature, generateInfra, dryRun }) => {
      const slug = kebabCase(name);
      const playNum = nextPlayNumber();
      const playId = `${playNum}-${slug}`;
      const desc = description || `${name} — AI-powered solution built with the FAI Protocol.`;
      const playsDir = join(process.cwd(), "solution-plays");
      const playDir = join(playsDir, playId);

      if (existsSync(playDir)) {
        return { content: [{ type: "text", text: `❌ Directory already exists: solution-plays/${playId}` }], isError: true };
      }

      const files = [];

      // ── agent.md (root orchestrator) ────────────────────────
      files.push({ path: "agent.md", content: `---
description: "${desc}"
tools: ["terminal", "file", "search"]
model: ["${model}", "gpt-4o-mini"]
waf: ${JSON.stringify(wafPillars)}
plays: ["${playId}"]
handoffs:
  - agent: "builder"
    prompt: "Build features for ${name}"
  - agent: "reviewer"
    prompt: "Review implementation for ${name}"
  - agent: "tuner"
    prompt: "Validate production readiness for ${name}"
---

# ${name}

Production agent for ${name} (Play ${playNum}). Orchestrates builder → reviewer → tuner workflow.

## How to Use
1. Describe what you want to build
2. I'll delegate to the Builder agent for implementation
3. Then to the Reviewer for security + quality audit
4. Then to the Tuner for production readiness validation
` });

      // ── .github/copilot-instructions.md ─────────────────────
      files.push({ path: ".github/copilot-instructions.md", content: `---
description: "${name} domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# ${name} — Domain Knowledge

This workspace implements ${desc}

## Key Architecture Decisions
- **Model**: ${model} (temperature: ${temperature})
- **WAF Pillars**: ${wafPillars.join(", ")}

## Project Conventions
- Use config/*.json for all AI parameters — never hardcode
- Use Azure Managed Identity for authentication — no API keys in code
- All responses must include citations when using retrieved context
- Follow the FAI Protocol: every primitive is wired through fai-manifest.json
` });

      // ── .github/agents/ ─────────────────────────────────────
      for (const role of ["builder", "reviewer", "tuner"]) {
        const roleDesc = {
          builder: `Implements features for ${name} — coding, API integration, pipeline setup`,
          reviewer: `Reviews ${name} implementation — security (OWASP LLM Top 10), quality, Azure best practices`,
          tuner: `Validates ${name} for production — config tuning, evaluation thresholds, infrastructure readiness`,
        }[role];

        files.push({ path: `.github/agents/${role}.agent.md`, content: `---
description: "${roleDesc}"
tools: ["read", "edit", "search", "execute"]
model: ["${model}", "gpt-4o-mini"]
waf: ${JSON.stringify(wafPillars)}
plays: ["${playId}"]
---

# ${role.charAt(0).toUpperCase() + role.slice(1)} Agent — ${name}

You are the **${role.charAt(0).toUpperCase() + role.slice(1)} Agent** for ${name} (Play ${playNum}).

## File Discovery
Always use \`list_dir\` to discover files, then \`read_file\` with exact paths.

## Read Config Before Acting
- \`read_file config/openai.json\` for model parameters
- \`read_file config/guardrails.json\` for safety rules
` });
      }

      // ── .github/instructions/ ───────────────────────────────
      files.push({ path: `.github/instructions/${slug}-patterns.instructions.md`, content: `---
description: "${name} implementation patterns and coding standards"
applyTo: "**/*.{py,ts,js,bicep}"
---

# ${name} — Implementation Patterns

## Architecture
- Use Azure Managed Identity for all service-to-service authentication
- Store secrets in Azure Key Vault — never in code or environment variables
- Implement retry logic with exponential backoff for all Azure SDK calls

## Error Handling
- Wrap all Azure SDK calls in try/catch with structured logging
- Return meaningful error messages — never expose raw exceptions to users
- Log correlation IDs for distributed tracing
` });

      // ── .github/prompts/ ────────────────────────────────────
      for (const [cmd, purpose] of [["deploy", "Deploy to Azure"], ["test", "Run test suite"], ["review", "Code review"], ["evaluate", "Run evaluation pipeline"]]) {
        files.push({ path: `.github/prompts/${cmd}.prompt.md`, content: `---
description: "${purpose} for ${name}"
---

# /${cmd}

${purpose} for ${name} (Play ${playNum}).

## Steps
1. Read the relevant config files in config/
2. Execute the ${cmd} workflow
3. Report results with pass/fail status
` });
      }

      // ── .github/skills/ ─────────────────────────────────────
      for (const skill of ["deploy", "evaluate", "tune"]) {
        files.push({ path: `.github/skills/${skill}-${slug}/SKILL.md`, content: `---
name: "${skill}-${slug}"
description: "${skill.charAt(0).toUpperCase() + skill.slice(1)} skill for ${name}"
---

# ${skill.charAt(0).toUpperCase() + skill.slice(1)} — ${name}

This skill handles the ${skill} workflow for ${name} (Play ${playNum}).

## Prerequisites
- Azure CLI authenticated (\`az login\`)
- Config files in config/ validated

## Steps
1. Read config from \`config/openai.json\` and \`config/guardrails.json\`
2. ${skill === "deploy" ? "Run Bicep deployment via `az deployment group create`" : skill === "evaluate" ? "Run `python evaluation/eval.py --ci-gate`" : "Validate all config thresholds against best practices"}
3. Report results
` });
      }

      // ── .github/hooks/ ──────────────────────────────────────
      files.push({ path: ".github/hooks/guardrails.json", content: JSON.stringify({
        version: 1,
        hooks: {
          SessionStart: [{ type: "command", bash: "echo 'FAI guardrails active for " + name + "'" }]
        }
      }, null, 2) });

      // ── .vscode/ ────────────────────────────────────────────
      files.push({ path: ".vscode/mcp.json", content: JSON.stringify({
        servers: { frootai: { type: "stdio", command: "npx", args: ["frootai-mcp@latest"] } }
      }, null, 2) });

      files.push({ path: ".vscode/settings.json", content: JSON.stringify({
        "chat.agent.enabled": true,
        "github.copilot.chat.agent.thinkingTool": true
      }, null, 2) });

      // ── config/ (TuneKit) ───────────────────────────────────
      files.push({ path: "config/openai.json", content: JSON.stringify({
        model, api_version: "2024-12-01-preview",
        temperature, top_p: 0.9, max_tokens: 1000,
        frequency_penalty: 0, presence_penalty: 0, seed: 42,
        _comments: {
          temperature: `${temperature} for ${temperature <= 0.3 ? 'factual/deterministic' : 'creative'} tasks`,
          model: `Switch to gpt-4o-mini for cost reduction`
        }
      }, null, 2) });

      files.push({ path: "config/guardrails.json", content: JSON.stringify({
        content_safety: { enabled: true, categories: ["hate", "self_harm", "sexual", "violence"], severity_threshold: 2, action: "block" },
        pii_detection: { enabled: true, categories: ["email", "phone", "ssn", "credit_card"], action: "redact" },
        prompt_injection: { enabled: true, action: "block" },
        business_rules: { max_response_tokens: 1000, require_citations: true, min_confidence_to_answer: 0.7, abstention_message: "I don't have enough verified information to answer this accurately." }
      }, null, 2) });

      // ── evaluation/ ─────────────────────────────────────────
      files.push({ path: "evaluation/eval.py", content: `"""
Evaluation Pipeline for ${name} (Play ${playNum})
FrootAI Solution Play — Azure AI Evaluation SDK

Usage:
    python evaluation/eval.py
    python evaluation/eval.py --test-set evaluation/test-set.jsonl
    python evaluation/eval.py --ci-gate --config config/guardrails.json
"""

import json
import sys
from pathlib import Path

def load_test_set(path="evaluation/test-set.jsonl"):
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]

def evaluate(test_cases):
    results = {"groundedness": 0.0, "relevance": 0.0, "coherence": 0.0, "fluency": 0.0, "safety": 0}
    # TODO: Implement evaluation using Azure AI Evaluation SDK
    print(f"Evaluated {len(test_cases)} test cases")
    return results

if __name__ == "__main__":
    test_set = load_test_set()
    scores = evaluate(test_set)
    print(json.dumps(scores, indent=2))
` });

      files.push({ path: "evaluation/test-set.jsonl", content: `{"question": "What does ${name} do?", "ground_truth": "${desc}", "context": ""}
{"question": "How is ${name} deployed?", "ground_truth": "Deployed on Azure using Bicep IaC templates.", "context": ""}
` });

      // ── infra/ (optional) ───────────────────────────────────
      if (generateInfra) {
        files.push({ path: "infra/main.bicep", content: `// ${name} — Azure Infrastructure
// Generated by FrootAI scaffold_play

targetScope = 'resourceGroup'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Project name used for resource naming')
param projectName string = '${slug}'

// TODO: Add Azure resources for ${name}
// Common services: Azure OpenAI, AI Search, Container Apps, Key Vault
` });

        files.push({ path: "infra/parameters.json", content: JSON.stringify({
          "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
          contentVersion: "1.0.0.0",
          parameters: { location: { value: "eastus2" }, environment: { value: "dev" }, projectName: { value: slug } }
        }, null, 2) });
      }

      // ── spec/ (SpecKit + fai-manifest.json) ─────────────────
      const manifestContent = {
        play: playId, version: "1.0.0",
        context: {
          knowledge: ["F1-GenAI-Foundations", "R1-Prompt-Engineering", "T3-Production-Patterns"],
          waf: wafPillars, scope: slug
        },
        primitives: {
          agents: ["./agent.md"],
          instructions: [`./.github/instructions/${slug}-patterns.instructions.md`],
          skills: [`./.github/skills/deploy-${slug}/`, `./.github/skills/evaluate-${slug}/`, `./.github/skills/tune-${slug}/`],
          hooks: ["./.github/hooks/"],
          guardrails: { groundedness: 0.95, coherence: 0.90, relevance: 0.85, safety: 0, costPerQuery: 0.01 }
        },
        infrastructure: generateInfra ? { bicep: "./infra/main.bicep", parameters: "./infra/parameters.json" } : undefined,
        toolkit: { devkit: "./.github/", tunekit: "./config/", speckit: "./spec/" }
      };

      files.push({ path: "spec/fai-manifest.json", content: JSON.stringify(manifestContent, null, 2) });

      files.push({ path: "spec/play-spec.json", content: JSON.stringify({
        name, playId, description: desc, version: "1.0.0",
        services: ["Azure OpenAI", "Azure AI Search", "Azure Container Apps", "Azure Key Vault"],
        complexity: "Medium", waf: wafPillars
      }, null, 2) });

      files.push({ path: "spec/CHANGELOG.md", content: `# ${name} — Changelog\n\n## 1.0.0 (${new Date().toISOString().slice(0, 10)})\n- Initial scaffold generated by FrootAI\n` });

      // ── README.md ───────────────────────────────────────────
      files.push({ path: "README.md", content: `# ${name}\n\n> Play ${playNum} — ${desc}\n\n## Quick Start\n\n\`\`\`bash\ncd solution-plays/${playId}\nnpx frootai-mcp  # Start MCP server\n\`\`\`\n\n## Architecture\n\n- **Model**: ${model} (temperature: ${temperature})\n- **WAF**: ${wafPillars.join(", ")}\n- **DevKit**: .github/ Agentic OS (3 agents, 4 prompts, 3 skills)\n- **TuneKit**: config/ (openai.json, guardrails.json)\n- **SpecKit**: spec/ (fai-manifest.json)\n\n## FAI Protocol\n\nThis play is wired through the FAI Protocol. Run \`wire_play("${playId}")\` to verify.\n` });

      // ── Dry run or create ───────────────────────────────────
      if (dryRun) {
        const listing = files.map((f, i) => `  ${i + 1}. ${f.path}`).join("\n");
        return { content: [{ type: "text", text: `## 📋 Scaffold Preview: ${playId}\n\n**${files.length} files** would be created:\n\n${listing}\n\n💡 Remove dryRun to create for real.` }] };
      }

      // Create all files
      for (const f of files) {
        safeWrite(join(playDir, f.path), f.content);
      }

      // Wire the play to verify
      let wiringStatus = "not verified";
      try {
        const result = faiEngine.runPlay({ manifestPath: join(playDir, "spec", "fai-manifest.json") });
        wiringStatus = result.errors?.length === 0
          ? `✅ All primitives wired (${result.wiring?.total || 0} items, ${result.duration}ms)`
          : `⚠️ Wired with ${result.errors.length} issue(s): ${result.errors.slice(0, 3).join("; ")}`;
      } catch { wiringStatus = "⚠️ Could not verify (engine error)"; }

      return {
        content: [{
          type: "text",
          text: `## 🍊 Scaffolded: ${playId}\n\n**${files.length} files** created in \`solution-plays/${playId}/\`\n\n### Structure\n- 📁 .github/ — DevKit (3 agents, 4 prompts, 3 skills, 1 hook)\n- 📁 config/ — TuneKit (openai.json, guardrails.json)\n- 📁 evaluation/ — eval.py + test-set.jsonl\n${generateInfra ? "- 📁 infra/ — main.bicep + parameters.json\n" : ""}- 📁 spec/ — fai-manifest.json + play-spec.json\n- 📄 agent.md — Root orchestrator\n- 📄 README.md\n\n### FAI Protocol Wiring\n${wiringStatus}\n\n### Next Steps\n1. Customize \`config/openai.json\` for your model preferences\n2. Add domain-specific instructions in \`.github/instructions/\`\n3. Run \`wire_play("${playId}")\` to inspect the wiring\n4. Run \`validate_manifest("${playId}")\` to check protocol compliance`
        }]
      };
    }
  );

  // ── Tool: create_primitive ───────────────────────────────────────

  server.tool(
    "create_primitive",
    "FAI CREATE — Create a single FAI primitive (agent, instruction, or skill) with proper frontmatter, naming convention, and FAI context.",
    {
      type: z.enum(["agent", "instruction", "skill"]).describe("Primitive type to create"),
      name: z.string().describe("Primitive name in kebab-case (e.g., 'rag-evaluator', 'python-azure')"),
      description: z.string().describe("What this primitive does (10-200 chars)"),
      waf: z.array(z.string()).optional().default([]),
      plays: z.array(z.string()).optional().default([]),
      targetDir: z.string().optional().describe("Target directory (default: repo-level agents/, instructions/, or skills/)"),
      dryRun: z.boolean().optional().default(false),
    },
    { annotations: { destructiveHint: true } },
    async ({ type, name, description, waf, plays, targetDir, dryRun }) => {
      const slug = kebabCase(name);
      const faiName = slug.startsWith("fai-") ? slug : `fai-${slug}`;

      let filePath, content;

      if (type === "agent") {
        const dir = targetDir || join(process.cwd(), "agents");
        filePath = join(dir, `${faiName}.agent.md`);
        content = `---
description: "${description}"
tools: ["read", "edit", "search", "execute"]
model: ["gpt-4o", "gpt-4o-mini"]
waf: ${JSON.stringify(waf)}
plays: ${JSON.stringify(plays)}
---

# ${name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}

${description}

## Responsibilities
- Implement features related to ${name}
- Follow WAF pillars: ${waf.join(", ") || "none specified"}
- Read config files before making changes

## File Discovery
Always use \`list_dir\` to discover files, then \`read_file\` with exact paths.
`;
      } else if (type === "instruction") {
        const dir = targetDir || join(process.cwd(), "instructions");
        filePath = join(dir, `${slug}.instructions.md`);
        content = `---
description: "${description}"
applyTo: "**/*.{py,ts,js,bicep,json}"
waf: ${JSON.stringify(waf)}
---

# ${name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}

${description}

## Patterns
- Follow Azure best practices for all service integrations
- Use Managed Identity for authentication
- Implement retry logic with exponential backoff
`;
      } else {
        const dir = targetDir || join(process.cwd(), "skills");
        const skillDir = join(dir, faiName);
        filePath = join(skillDir, "SKILL.md");
        content = `---
name: "${faiName}"
description: "${description}"
---

# ${name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}

${description}

## Prerequisites
- Azure CLI authenticated
- Required config files present

## Steps
1. Read configuration from config/
2. Execute the ${name} workflow
3. Report results with pass/fail status
`;
      }

      if (existsSync(filePath)) {
        return { content: [{ type: "text", text: `❌ File already exists: ${filePath}` }], isError: true };
      }

      if (dryRun) {
        return { content: [{ type: "text", text: `## 📋 Preview: ${type} "${faiName}"\n\nWould create: \`${filePath}\`\n\n\`\`\`markdown\n${content}\n\`\`\`\n\n💡 Remove dryRun to create.` }] };
      }

      safeWrite(filePath, content);

      return {
        content: [{
          type: "text",
          text: `## ✅ Created: ${type} "${faiName}"\n\n📄 \`${filePath}\`\n\n- **Type**: ${type}\n- **WAF**: ${waf.join(", ") || "none"}\n- **Plays**: ${plays.join(", ") || "universal"}\n\n💡 Add to a play's fai-manifest.json to wire it into the FAI Protocol.`
        }]
      };
    }
  );

  // ── Tool: smart_scaffold ─────────────────────────────────────────

  server.tool(
    "smart_scaffold",
    "FAI SMART SCAFFOLD — Describe what you want to build in natural language, and get the best-matching solution play as a template. Then optionally scaffold a new play based on that template.",
    {
      description: z.string().describe("What you want to build (e.g., 'process invoices and extract structured data', 'customer support chatbot with knowledge base')"),
      topK: z.number().optional().default(3).describe("Number of template matches to return (default: 3)"),
      scaffoldFromTop: z.boolean().optional().default(false).describe("Auto-scaffold a new play using the top match as template"),
      playName: z.string().optional().describe("Name for the new play (required if scaffoldFromTop=true)"),
    },
    { annotations: { readOnlyHint: false } },
    async ({ description, topK, scaffoldFromTop, playName }) => {
      // Semantic search across all 100 plays
      const scored = PLAY_DATA
        .map(play => ({
          play,
          score: computeSimilarity(description, `${play.name} ${play.pattern}`),
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      if (scored.length === 0) {
        return { content: [{ type: "text", text: `No matching plays for "${description}". Try broader terms or use scaffold_play to create from scratch.` }] };
      }

      const matches = scored.map(({ play, score }, i) =>
        `### ${i + 1}. Play ${play.id} — ${play.name} (${(score * 100).toFixed(0)}% match)\n- **Services**: ${play.services.join(", ")}\n- **Complexity**: ${play.cx}\n- **Keywords**: ${play.pattern.split(" ").slice(0, 10).join(", ")}`
      ).join("\n\n");

      let scaffoldResult = "";
      if (scaffoldFromTop && playName) {
        const topMatch = scored[0].play;
        scaffoldResult = `\n\n---\n\n💡 To scaffold from this template, run:\n\`scaffold_play name="${playName}" description="${description}" model="gpt-4o"\``;
      }

      return {
        content: [{
          type: "text",
          text: `## 🎯 Smart Scaffold — "${description}"\n*${scored.length} matches from ${PLAY_DATA.length} plays*\n\n${matches}${scaffoldResult}\n\n---\n💡 Use \`scaffold_play\` to create a new play, or \`get_play_detail\` to explore a match.`
        }]
      };
    }
  );

} // end if (faiEngine.available)

  return server;
} // end createConfiguredServer()

// ════════════════════════════════════════════════════════════════════
// TRANSPORT & STARTUP — Phase 4: stdio + Streamable HTTP
// ════════════════════════════════════════════════════════════════════

import { randomUUID } from "crypto";
import http from "http";

// ── MCP Logging ───────────────────────────────────────────────────

const LOG_LEVELS = ["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"];
let minLogLevel = "info";

function mcpLog(level, logger, data) {
  if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(minLogLevel)) return;
  // Logging is emitted to stderr in HTTP mode (no single server to send to)
  if (LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf("warning")) {
    console.error(`[${level}] ${logger}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
}

// ── Session Manager (for HTTP transport) ──────────────────────────

class SessionManager {
  constructor(maxSessions = 100, ttlMs = 3600_000) {
    this.sessions = new Map();
    this.maxSessions = maxSessions;
    this.ttl = ttlMs;
    this.cleanupTimer = setInterval(() => this._cleanup(), 60_000);
  }

  create(clientName, clientVersion) {
    if (this.sessions.size >= this.maxSessions) this._evictOldest();
    const session = {
      id: randomUUID(),
      createdAt: new Date(),
      lastActiveAt: new Date(),
      clientName, clientVersion,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  touch(id) {
    const s = this.sessions.get(id);
    if (!s) return null;
    if (Date.now() - s.lastActiveAt.getTime() > this.ttl) { this.sessions.delete(id); return null; }
    s.lastActiveAt = new Date();
    return s;
  }

  terminate(id) { return this.sessions.delete(id); }

  stats() {
    return { active: this.sessions.size, max: this.maxSessions, ttlMin: Math.round(this.ttl / 60_000) };
  }

  _cleanup() {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (now - s.lastActiveAt.getTime() > this.ttl) this.sessions.delete(id);
    }
  }

  _evictOldest() {
    let oldest = null;
    for (const s of this.sessions.values()) {
      if (!oldest || s.lastActiveAt < oldest.lastActiveAt) oldest = s;
    }
    if (oldest) this.sessions.delete(oldest.id);
  }

  destroy() { clearInterval(this.cleanupTimer); }
}

// ── Authentication Middleware ─────────────────────────────────────

function createAuthMiddleware() {
  const mode = process.env.FAI_AUTH_MODE || "none";
  const validKeys = new Set((process.env.FAI_API_KEYS || "").split(",").filter(Boolean));

  return (req) => {
    if (mode === "none") return { allowed: true, identity: "anonymous" };

    const authHeader = req.headers.authorization;
    if (!authHeader) return { allowed: false, reason: "Missing Authorization header" };

    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return { allowed: false, reason: "Use: Authorization: Bearer <api-key>" };
    }

    if (mode === "apikey" && validKeys.size > 0) {
      if (validKeys.has(token)) return { allowed: true, identity: `apikey:${token.substring(0, 8)}...` };
      return { allowed: false, reason: "Invalid API key" };
    }

    return { allowed: true, identity: "default" };
  };
}

// ── Transport Selection ───────────────────────────────────────────

const transportMode = process.argv[2] || "stdio";

if (transportMode === "http" || transportMode === "streamableHttp") {
  // ── Streamable HTTP Transport (multi-client) ──────────────────
  // Each session gets its own McpServer instance with all tools registered.
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");

  const PORT = parseInt(process.env.PORT || "3000");
  const HOST = process.env.HOST || "127.0.0.1";
  const MCP_PATH = process.env.MCP_PATH || "/mcp";
  const sessionMgr = new SessionManager();
  const authCheck = createAuthMiddleware();

  // Track transports per session for multi-client
  const sessionTransports = new Map();

  // For HTTP mode, we need to create fresh server+transport pairs per session
  // because McpServer binds to one transport at a time.
  // We re-use the same `server` instance but manage transport lifecycle.

  const httpServer = http.createServer(async (req, res) => {
    // ── CORS ────────────────────────────────────────────────
    const origin = req.headers.origin || "";
    const allowedOrigins = (process.env.CORS_ORIGINS || "*").split(",");
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, Authorization, MCP-Protocol-Version");
    }
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    // ── Health endpoints ────────────────────────────────────
    if (req.url === "/healthz" || req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "healthy",
        version: PKG_VERSION,
        uptime: Math.round(process.uptime()),
        transport: "http",
        engine: faiEngine?.available ? "connected" : "unavailable",
      }));
      return;
    }

    if (req.url === "/readyz" || req.url === "/ready") {
      const ready = Object.keys(modules).length > 0;
      res.writeHead(ready ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: ready ? "ready" : "not ready",
        knowledge: { modules: Object.keys(modules).length, terms: Object.keys(glossary).length },
        engine: { available: faiEngine?.available || false },
        sessions: sessionMgr.stats(),
        cache: { search: searchCache.stats(), azureDocs: azureDocsCache.stats() },
      }));
      return;
    }

    // ── Only MCP path below ─────────────────────────────────
    if (!req.url?.startsWith(MCP_PATH)) { res.writeHead(404); res.end("Not found"); return; }

    // ── DNS rebinding protection (MCP spec) ─────────────────
    if (origin && !allowedOrigins.includes("*") && !allowedOrigins.includes(origin)) {
      res.writeHead(403); res.end("Origin not allowed"); return;
    }

    // ── Authentication ──────────────────────────────────────
    const authResult = authCheck(req);
    if (!authResult.allowed) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: authResult.reason }));
      return;
    }

    // ── Session handling ────────────────────────────────────
    const sessionId = req.headers["mcp-session-id"];

    if (req.method === "DELETE") {
      if (sessionId && sessionTransports.has(sessionId)) {
        const { transport: t } = sessionTransports.get(sessionId);
        await t.close();
        sessionTransports.delete(sessionId);
        sessionMgr.terminate(sessionId);
      }
      res.writeHead(200); res.end(); return;
    }

    // Existing session — route to its transport
    if (sessionId && sessionTransports.has(sessionId)) {
      sessionMgr.touch(sessionId);
      await sessionTransports.get(sessionId).transport.handleRequest(req, res);
      return;
    }

    // New connection — must be an initialize request (no session ID)
    if (sessionId && !sessionTransports.has(sessionId)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session expired. Send new InitializeRequest without Mcp-Session-Id." }));
      return;
    }

    // Create new transport + fresh server for this session
    const sessionServer = createConfiguredServer();
    const sessionTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => {
        const session = sessionMgr.create(authResult.identity);
        sessionTransports.set(session.id, { transport: sessionTransport, server: sessionServer });
        return session.id;
      },
    });

    sessionTransport.onclose = () => {
      const sid = sessionTransport.sessionId;
      if (sid) { sessionTransports.delete(sid); sessionMgr.terminate(sid); }
    };

    await sessionServer.connect(sessionTransport);
    await sessionTransport.handleRequest(req, res);
  });

  httpServer.listen(PORT, HOST, () => {
    console.error(`🍊 FrootAI MCP Server v${PKG_VERSION}`);
    console.error(`   Transport:  Streamable HTTP`);
    console.error(`   Endpoint:   http://${HOST}:${PORT}${MCP_PATH}`);
    console.error(`   Health:     http://${HOST}:${PORT}/healthz`);
    console.error(`   Readiness:  http://${HOST}:${PORT}/readyz`);
    console.error(`   Auth:       ${process.env.FAI_AUTH_MODE || "none"}`);
    console.error(`   Engine:     ${faiEngine?.available ? "connected" : "not available"}`);
    console.error(`   Tools:      ${Object.keys(modules).length > 0 ? "ready" : "loading..."}`);
  });

} else {
  // ── stdio transport (default — backward compatible) ───────────
  const server = createConfiguredServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
