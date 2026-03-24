#!/usr/bin/env node

/**
 * FrootAI MCP Server
 * ------------------
 * Exposes the FrootAI knowledge base (17 modules, 200+ AI terms)
 * as an MCP server that any AI agent can query.
 *
 * Usage:
 *   npx frootai-mcp          # Run directly
 *   node index.js             # Run from source
 *
 * MCP Config (Claude Desktop / VS Code):
 *   {
 *     "mcpServers": {
 *       "frootai": {
 *         "command": "npx",
 *         "args": ["frootai-mcp"]
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const server = new McpServer({
  name: "frootai",
  version: "2.1.0",
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
          text: `FrootAI Knowledge Base — 18 Modules\n${"═".repeat(45)}\n\n${result.join("\n\n")}\n\n📋 Reference\n  REF: Quick Reference Cards\n  QUIZ: Quiz & Assessment\n\nUse get_module to read any module. Use search_knowledge to search across all modules.\n\n🔌 Live tools: fetch_azure_docs, fetch_external_mcp, list_community_plays, get_github_agentic_os`,
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

    return {
      content: [
        {
          type: "text",
          text: `Found ${scored.length} relevant sections for "${query}". Top ${topResults.length}:\n\n${resultText}\n\n---\nUse get_module with module_id and section to read the full content.`,
        },
      ],
    };
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
  "Get a complete overview of the FROOT framework — all 5 layers, 18 modules, what each layer covers, and how they connect. Use when asked 'what is FrootAI' or 'show me the framework'.",
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
**Website**: https://frootai.dev
**MCP v3**: 22 tools (6 static + 4 live + 3 chain + 3 AI ecosystem + 6 compute) · 200+ terms · 7 architecture patterns · 20 solution plays`;

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
          return {
            content: [{
              type: "text",
              text: `## Azure Documentation: ${service}\n*Live from Microsoft Learn*\n\n${formatted}\n\n---\n*Fetched live. For deeper architecture guidance, use get_module or get_architecture_pattern.*`,
            }],
          };
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
  "List FrootAI solution plays from the GitHub repository. Shows all 20 plays with status. Falls back to static list if offline.",
  {
    filter: z.string().optional().describe("Filter by keyword (e.g., 'rag', 'agent', 'landing-zone')"),
  },
  async ({ filter }) => {
    // Try live from GitHub API
    const apiUrl = "https://api.github.com/repos/gitpavleenbali/frootai/contents/solution-plays";
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
        `${i + 1}. **${p}**\n   🔗 https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/${p}`
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
        text: `## FrootAI Solution Plays\n*Offline — showing bundled list*\n\n${formatted}\n\n---\n**20 plays** · Each with .github Agentic OS + DevKit + TuneKit\n🌐 https://frootai.dev/solution-plays`,
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

FrootAI ships 19 files per solution play × 20 plays = 380 agentic OS files.
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
  "plugin": "frootai-enterprise-rag",
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
      ["Dev Cost/mo", ...selected.map(p => { let t=0; p.services.forEach(s => { const pr=PRICING[s]; if(pr) t+=pr.dev; }); return `$${t}`; })],
      ["Prod Cost/mo", ...selected.map(p => { let t=0; p.services.forEach(s => { const pr=PRICING[s]; if(pr) t+=pr.prod; }); return `$${t}`; })],
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

// ── Resources: Module listing ──────────────────────────────────────

server.resource(
  "frootai-overview",
  "frootai://overview",
  async () => ({
    contents: [
      {
        uri: "frootai://overview",
        mimeType: "text/plain",
        text: `FrootAI v3 — From Root to Fruit
The open glue that binds infrastructure, platform, and application.

🌱 F — Foundations: GenAI Foundations, LLM Landscape, AI Glossary A-Z, .github Agentic OS
🪵 R — Reasoning: Prompt Engineering, RAG Architecture, Deterministic AI
🌿 O — Orchestration: Semantic Kernel, AI Agents, MCP/Tools
🏗️ O — Operations: Azure AI Platform, Infrastructure, Copilot
🍎 T — Transformation: Fine-Tuning, Responsible AI, Production Patterns

18 modules | 200+ AI terms | 22 tools (6 static + 4 live + 3 chain + 3 AI ecosystem + 6 compute) | 20 solution plays
https://frootai.dev`,
      },
    ],
  })
);

// ─── Start Server ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
