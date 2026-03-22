import React, { useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./packages.module.css";

// ─── Category Data (like awesome-copilot's grid) ───────────────────

const categories = [
  {
    icon: "🌱",
    name: "Foundations",
    count: 3,
    desc: "Tokens, models, vocabulary — the roots of AI literacy",
    color: "#f59e0b",
  },
  {
    icon: "🪵",
    name: "Reasoning",
    count: 3,
    desc: "Prompts, RAG, grounding — making AI think well",
    color: "#10b981",
  },
  {
    icon: "🌿",
    name: "Orchestration",
    count: 3,
    desc: "Semantic Kernel, agents, MCP — connecting AI systems",
    color: "#06b6d4",
  },
  {
    icon: "🍃",
    name: "Operations",
    count: 3,
    desc: "Azure AI, hosting, Copilot — running AI in production",
    color: "#6366f1",
  },
  {
    icon: "🍎",
    name: "Transformation",
    count: 3,
    desc: "Fine-tuning, safety, production — shipping AI safely",
    color: "#7c3aed",
  },
  {
    icon: "🔌",
    name: "MCP Tools",
    count: 5,
    desc: "MCP server tools for agent integration",
    color: "#10b981",
  },
];

// ─── All Packages ──────────────────────────────────────────────────

const allPackages = [
  // Foundations
  {
    id: "F1", name: "GenAI Foundations", category: "Foundations",
    desc: "Transformers, attention, tokenization, inference, parameters, context windows, embeddings — how LLMs actually work",
    file: "GenAI-Foundations.md", size: "55 KB", updated: "March 2026",
    tags: ["foundation", "tokens", "transformers", "parameters"],
    docsLink: "/docs/GenAI-Foundations",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/GenAI-Foundations.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/GenAI-Foundations.md",
  },
  {
    id: "F2", name: "LLM Landscape & Model Selection", category: "Foundations",
    desc: "GPT, Claude, Llama, Gemini, Phi — benchmarks, open vs proprietary, when to use what",
    file: "LLM-Landscape.md", size: "47 KB", updated: "March 2026",
    tags: ["foundation", "models", "benchmarks", "selection"],
    docsLink: "/docs/LLM-Landscape",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/LLM-Landscape.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/LLM-Landscape.md",
  },
  {
    id: "F3", name: "AI Glossary A–Z", category: "Foundations",
    desc: "200+ AI/ML terms defined — from ablation to zero-shot. The reference you keep open in another tab",
    file: "F3-AI-Glossary-AZ.md", size: "31 KB", updated: "March 2026",
    tags: ["foundation", "glossary", "reference", "terms"],
    docsLink: "/docs/F3-AI-Glossary-AZ",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/F3-AI-Glossary-AZ.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/F3-AI-Glossary-AZ.md",
  },
  // Reasoning
  {
    id: "R1", name: "Prompt Engineering & Grounding", category: "Reasoning",
    desc: "System messages, few-shot, chain-of-thought, structured output, guardrails, function calling",
    file: "Prompt-Engineering.md", size: "34 KB", updated: "March 2026",
    tags: ["reasoning", "prompts", "grounding", "few-shot"],
    docsLink: "/docs/Prompt-Engineering",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/Prompt-Engineering.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/Prompt-Engineering.md",
  },
  {
    id: "R2", name: "RAG Architecture & Retrieval", category: "Reasoning",
    desc: "Chunking, embeddings, vector search, Azure AI Search, semantic ranking, reranking, hybrid search",
    file: "RAG-Architecture.md", size: "67 KB", updated: "March 2026",
    tags: ["reasoning", "rag", "retrieval", "embeddings", "search"],
    docsLink: "/docs/RAG-Architecture",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/RAG-Architecture.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/RAG-Architecture.md",
  },
  {
    id: "R3", name: "Making AI Deterministic & Reliable", category: "Reasoning",
    desc: "Hallucination reduction, grounding techniques, temperature tuning, evaluation metrics, guardrails",
    file: "R3-Deterministic-AI.md", size: "24 KB", updated: "March 2026",
    tags: ["reasoning", "determinism", "hallucination", "grounding"],
    docsLink: "/docs/R3-Deterministic-AI",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/R3-Deterministic-AI.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/R3-Deterministic-AI.md",
  },
  // Orchestration
  {
    id: "O1", name: "Semantic Kernel & Orchestration", category: "Orchestration",
    desc: "Plugins, planners, memory, connectors, comparison with LangChain, when to use SK",
    file: "Semantic-Kernel.md", size: "58 KB", updated: "March 2026",
    tags: ["orchestration", "semantic-kernel", "plugins", "planners"],
    docsLink: "/docs/Semantic-Kernel",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/Semantic-Kernel.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/Semantic-Kernel.md",
  },
  {
    id: "O2", name: "AI Agents & Agent Framework", category: "Orchestration",
    desc: "Agent concepts, planning, memory, tool use, AutoGen, multi-agent patterns, deterministic agents",
    file: "AI-Agents-Deep-Dive.md", size: "66 KB", updated: "March 2026",
    tags: ["orchestration", "agents", "multi-agent", "autogen"],
    docsLink: "/docs/AI-Agents-Deep-Dive",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/AI-Agents-Deep-Dive.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/AI-Agents-Deep-Dive.md",
  },
  {
    id: "O3", name: "MCP, Tools & Function Calling", category: "Orchestration",
    desc: "Model Context Protocol, tool schemas, function calling patterns, A2A, MCP servers, registry",
    file: "O3-MCP-Tools-Functions.md", size: "23 KB", updated: "March 2026",
    tags: ["orchestration", "mcp", "tools", "function-calling"],
    docsLink: "/docs/O3-MCP-Tools-Functions",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/O3-MCP-Tools-Functions.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/O3-MCP-Tools-Functions.md",
  },
  // Operations
  {
    id: "O4", name: "Azure AI Platform & Landing Zones", category: "Operations",
    desc: "AI Foundry, Model Catalog, deployments, endpoints, AI Landing Zone, enterprise patterns",
    file: "Azure-AI-Foundry.md", size: "48 KB", updated: "March 2026",
    tags: ["operations", "azure", "ai-foundry", "landing-zone"],
    docsLink: "/docs/Azure-AI-Foundry",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/Azure-AI-Foundry.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/Azure-AI-Foundry.md",
  },
  {
    id: "O5", name: "AI Infrastructure & Hosting", category: "Operations",
    desc: "GPU compute, Container Apps, AKS, App Service, model serving, scaling, cost optimization",
    file: "AI-Infrastructure.md", size: "51 KB", updated: "March 2026",
    tags: ["operations", "gpu", "container-apps", "aks", "hosting"],
    docsLink: "/docs/AI-Infrastructure",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/AI-Infrastructure.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/AI-Infrastructure.md",
  },
  {
    id: "O6", name: "Copilot Ecosystem & Low-Code AI", category: "Operations",
    desc: "M365 Copilot, Copilot Studio, Power Platform AI, GitHub Copilot, extensibility",
    file: "Copilot-Ecosystem.md", size: "38 KB", updated: "March 2026",
    tags: ["operations", "copilot", "low-code", "power-platform"],
    docsLink: "/docs/Copilot-Ecosystem",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/Copilot-Ecosystem.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/Copilot-Ecosystem.md",
  },
  // Transformation
  {
    id: "T1", name: "Fine-Tuning & Model Customization", category: "Transformation",
    desc: "When to fine-tune vs RAG, LoRA, QLoRA, RLHF, DPO, evaluation, MLOps lifecycle",
    file: "T1-Fine-Tuning-MLOps.md", size: "20 KB", updated: "March 2026",
    tags: ["transformation", "fine-tuning", "lora", "mlops"],
    docsLink: "/docs/T1-Fine-Tuning-MLOps",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/T1-Fine-Tuning-MLOps.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/T1-Fine-Tuning-MLOps.md",
  },
  {
    id: "T2", name: "Responsible AI & Safety", category: "Transformation",
    desc: "Content safety, red teaming, guardrails, Azure AI Content Safety, evaluation frameworks",
    file: "Responsible-AI-Safety.md", size: "49 KB", updated: "March 2026",
    tags: ["transformation", "responsible-ai", "safety", "guardrails"],
    docsLink: "/docs/Responsible-AI-Safety",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/Responsible-AI-Safety.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/Responsible-AI-Safety.md",
  },
  {
    id: "T3", name: "Production Architecture Patterns", category: "Transformation",
    desc: "Multi-agent hosting, API gateway for AI, latency optimization, cost control, monitoring, resilience",
    file: "T3-Production-Patterns.md", size: "20 KB", updated: "March 2026",
    tags: ["transformation", "production", "architecture", "monitoring"],
    docsLink: "/docs/T3-Production-Patterns",
    githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/T3-Production-Patterns.md",
    rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/T3-Production-Patterns.md",
  },
  // MCP Tools
  {
    id: "MCP1", name: "list_modules", category: "MCP Tools",
    desc: "Browse all 17 FROOT modules organized by layer — Foundations, Reasoning, Orchestration, Operations, Transformation",
    file: "mcp-server/index.js", size: "MCP Tool", updated: "March 2026",
    tags: ["mcp", "tool", "browse", "modules"],
    docsLink: "/docs/O3-MCP-Tools-Functions",
    githubLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server",
    rawLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server",
  },
  {
    id: "MCP2", name: "get_module", category: "MCP Tools",
    desc: "Read any module by ID (F1–T3). Optionally retrieve a specific section for targeted knowledge extraction",
    file: "mcp-server/index.js", size: "MCP Tool", updated: "March 2026",
    tags: ["mcp", "tool", "read", "content"],
    docsLink: "/docs/O3-MCP-Tools-Functions",
    githubLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server",
    rawLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server",
  },
  {
    id: "MCP3", name: "lookup_term", category: "MCP Tools",
    desc: "Look up any of 200+ AI/ML terms from the curated glossary. Returns precise definitions with context",
    file: "mcp-server/index.js", size: "MCP Tool", updated: "March 2026",
    tags: ["mcp", "tool", "glossary", "lookup"],
    docsLink: "/docs/F3-AI-Glossary-AZ",
    githubLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server",
    rawLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server",
  },
  {
    id: "MCP4", name: "search_knowledge", category: "MCP Tools",
    desc: "Full-text search across all 17 modules. Returns ranked sections matching your query with module references",
    file: "mcp-server/index.js", size: "MCP Tool", updated: "March 2026",
    tags: ["mcp", "tool", "search", "knowledge"],
    docsLink: "/docs/O3-MCP-Tools-Functions",
    githubLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server",
    rawLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server",
  },
  {
    id: "MCP5", name: "get_architecture_pattern", category: "MCP Tools",
    desc: "7 pre-built decision guides: RAG pipeline, agent hosting, model selection, cost optimization, deterministic AI, multi-agent, fine-tuning",
    file: "mcp-server/index.js", size: "MCP Tool", updated: "March 2026",
    tags: ["mcp", "tool", "architecture", "patterns"],
    docsLink: "/docs/T3-Production-Patterns",
    githubLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server",
    rawLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server",
  },
];

// ─── Components ────────────────────────────────────────────────────

function CategoryGrid({
  onSelect,
  activeCategory,
}: {
  onSelect: (cat: string | null) => void;
  activeCategory: string | null;
}): JSX.Element {
  return (
    <div className={styles.categoryGrid}>
      {categories.map((cat) => (
        <button
          key={cat.name}
          className={`${styles.categoryCard} ${activeCategory === cat.name ? styles.categoryActive : ""}`}
          onClick={() => onSelect(activeCategory === cat.name ? null : cat.name)}
          style={{ borderColor: activeCategory === cat.name ? cat.color : undefined }}
        >
          <div className={styles.categoryIcon}>{cat.icon}</div>
          <div className={styles.categoryInfo}>
            <div className={styles.categoryName}>{cat.name}</div>
            <div className={styles.categoryDesc}>{cat.desc}</div>
          </div>
          <div className={styles.categoryCount} style={{ color: cat.color }}>
            {cat.count}
          </div>
        </button>
      ))}
    </div>
  );
}

function PackageCard({ pkg }: { pkg: (typeof allPackages)[0] }): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(pkg.rawLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.packageCard}>
      <div className={styles.packageMain}>
        <div>
          <h3 className={styles.packageName}>{pkg.name}</h3>
          <p className={styles.packageDesc}>{pkg.desc}</p>
          <div className={styles.packageTags}>
            {pkg.tags.map((tag) => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
          <div className={styles.packageMeta}>
            <span>{pkg.size}</span>
            <span>·</span>
            <span>Updated {pkg.updated}</span>
          </div>
        </div>
        <div className={styles.packageActions}>
          <Link to={pkg.docsLink} className={styles.btnPrimary}>
            Read
          </Link>
          <button onClick={copyLink} className={styles.btnIcon} title="Copy raw link">
            {copied ? "✓" : "🔗"}
          </button>
          <a href={pkg.rawLink} className={styles.btnIcon} title="Download" download>
            ⬇
          </a>
          <a href={pkg.githubLink} className={styles.btnIcon} title="View on GitHub">
            📂
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────

export default function PackagesPage(): JSX.Element {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = allPackages.filter((pkg) => {
    const matchesCategory = !activeCategory || pkg.category === activeCategory;
    const matchesSearch =
      !search ||
      pkg.name.toLowerCase().includes(search.toLowerCase()) ||
      pkg.desc.toLowerCase().includes(search.toLowerCase()) ||
      pkg.tags.some((t) => t.includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const activeCategoryData = activeCategory
    ? categories.find((c) => c.name === activeCategory)
    : null;

  return (
    <Layout
      title="FROOT Packages — FrootAI"
      description="Browse, search, and download FrootAI knowledge modules and MCP tools. The FROOT framework for AI architecture."
    >
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>
            {activeCategoryData ? (
              <>
                <span style={{ marginRight: "12px" }}>{activeCategoryData.icon}</span>
                {activeCategoryData.name}
              </>
            ) : (
              "📦 FROOT Packages"
            )}
          </h1>
          <p className={styles.pageDesc}>
            {activeCategoryData
              ? activeCategoryData.desc
              : "Browse, search, and use FrootAI knowledge modules — as documentation, agent skills, or team resources"}
          </p>
        </div>

        {/* Category Grid (like awesome-copilot) */}
        {!activeCategory && (
          <CategoryGrid onSelect={setActiveCategory} activeCategory={activeCategory} />
        )}

        {/* Search & Filter Bar */}
        <div className={styles.filterBar}>
          <input
            type="text"
            placeholder={`Search ${activeCategory || "all"} packages...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          {activeCategory && (
            <button
              className={styles.filterChip}
              onClick={() => setActiveCategory(null)}
            >
              {activeCategoryData?.icon} {activeCategory} ✕
            </button>
          )}
          {!activeCategory &&
            categories.map((cat) => (
              <button
                key={cat.name}
                className={styles.filterChip}
                onClick={() => setActiveCategory(cat.name)}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
        </div>

        {/* Count */}
        <p className={styles.resultCount}>
          {filtered.length} of {allPackages.length} packages
        </p>

        {/* Package List */}
        <div className={styles.packageList}>
          {filtered.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className={styles.emptyState}>
            <p>No packages match your search. Try a different term.</p>
          </div>
        )}

        {/* Navigation */}
        <div style={{ textAlign: "center", marginTop: "32px", display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", padding: "6px 0" }}>
          <Link to="/ecosystem" style={{ padding: "8px 18px", borderRadius: "10px", border: "1px solid rgba(16,185,129,0.3)", fontSize: "0.78rem", fontWeight: 600, textDecoration: "none", color: "var(--ifm-font-color-base)", transition: "all 0.25s" }}>
            🔗 Back to Ecosystem
          </Link>
          <Link to="/" style={{ padding: "8px 18px", borderRadius: "10px", border: "1px solid rgba(245,158,11,0.3)", fontSize: "0.78rem", fontWeight: 600, textDecoration: "none", color: "var(--ifm-font-color-base)", transition: "all 0.25s" }}>
            🌳 Back to FrootAI
          </Link>
        </div>
      </div>
    </Layout>
  );
}
