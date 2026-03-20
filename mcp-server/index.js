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
    const termMatch = line.match(/^### (.+?)(\s+[🌱🪵🌿🏗️🍎])?$/);
    if (termMatch) {
      if (currentTerm) {
        glossary[currentTerm.toLowerCase()] = {
          term: currentTerm,
          definition: currentDef.join("\n").trim(),
        };
      }
      currentTerm = termMatch[1].trim();
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
  version: "1.0.0",
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
          text: `FrootAI Knowledge Base — 17 Modules\n${"═".repeat(45)}\n\n${result.join("\n\n")}\n\n📋 Reference\n  REF: Quick Reference Cards\n  QUIZ: Quiz & Assessment\n\nUse get_module to read any module. Use search_knowledge to search across all modules.`,
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
        "Module ID: F1 (GenAI Foundations), F2 (LLMs), F3 (Glossary), R1 (Prompts), R2 (RAG), R3 (Deterministic AI), O1 (Semantic Kernel), O2 (Agents), O3 (MCP/Tools), O4 (Azure AI), O5 (Infra), O6 (Copilot), T1 (Fine-Tuning), T2 (Responsible AI), T3 (Production)"
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

// ── Resources: Module listing ──────────────────────────────────────

server.resource(
  "frootai-overview",
  "frootai://overview",
  async () => ({
    contents: [
      {
        uri: "frootai://overview",
        mimeType: "text/plain",
        text: `FrootAI — From Root to Fruit
The open glue that binds infrastructure, platform, and application.
The telescope and the microscope for AI architecture.

🌱 F — Foundations (The Roots): GenAI Foundations, LLM Landscape, AI Glossary A-Z
🪵 R — Reasoning (The Trunk): Prompt Engineering, RAG Architecture, Deterministic AI
🌿 O — Orchestration (The Branches): Semantic Kernel, AI Agents, MCP/Tools
🏗️ O — Operations (The Canopy): Azure AI Platform, Infrastructure, Copilot
🍎 T — Transformation (The Fruit): Fine-Tuning, Responsible AI, Production Patterns

17 modules | 200+ AI terms | Architecture patterns for every scenario
https://gitpavleenbali.github.io/azure-wiki/froot-ai`,
      },
    ],
  })
);

// ─── Start Server ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
