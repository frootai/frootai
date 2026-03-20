import React, { useEffect } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

// ─── Scroll-to-top on page navigation ──────────────────────────────
// Ensures clicking module cards always lands at the TOP of the page

function useScrollToTop() {
  useEffect(() => {
    // Intercept all internal link clicks to force scroll-to-top
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (link && link.href && link.href.includes("/docs/") && !link.href.includes("#")) {
        // Let Docusaurus handle navigation, but after a tick, scroll to top
        setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }), 50);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
}

// ─── FROOT Layer Data ───────────────────────────────────────────────

const layers = [
  {
    id: "F", icon: "🌱", title: "Foundations — The Roots", meta: "Tokens, parameters, models — the vocabulary of AI", color: "#f59e0b", bgColor: "rgba(245, 158, 11, 0.08)",
    modules: [
      { id: "F1", title: "GenAI Foundations", desc: "Transformers, attention, tokenization, inference, parameters, context windows, embeddings", duration: "60–90 min", link: "/docs/GenAI-Foundations" },
      { id: "F2", title: "LLM Landscape & Model Selection", desc: "GPT, Claude, Llama, Gemini, Phi — benchmarks, open vs proprietary", duration: "45–60 min", link: "/docs/LLM-Landscape" },
      { id: "F3", title: "AI Glossary A–Z", desc: "200+ terms — from ablation to zero-shot", duration: "Reference", link: "/docs/F3-AI-Glossary-AZ" },
    ],
  },
  {
    id: "R", icon: "🪵", title: "Reasoning — The Trunk", meta: "Prompts, RAG, grounding — how to make AI think well", color: "#10b981", bgColor: "rgba(16, 185, 129, 0.08)",
    modules: [
      { id: "R1", title: "Prompt Engineering & Grounding", desc: "System messages, few-shot, chain-of-thought, structured output", duration: "60–90 min", link: "/docs/Prompt-Engineering" },
      { id: "R2", title: "RAG Architecture & Retrieval", desc: "Chunking, embeddings, vector search, Azure AI Search, semantic ranking", duration: "90–120 min", link: "/docs/RAG-Architecture" },
      { id: "R3", title: "Making AI Deterministic", desc: "Hallucination reduction, grounding, temperature tuning, evaluation", duration: "60–90 min", link: "/docs/R3-Deterministic-AI" },
    ],
  },
  {
    id: "O¹", icon: "🌿", title: "Orchestration — The Branches", meta: "Semantic Kernel, agents, MCP, tools — connecting AI systems", color: "#06b6d4", bgColor: "rgba(6, 182, 212, 0.08)",
    modules: [
      { id: "O1", title: "Semantic Kernel & Orchestration", desc: "Plugins, planners, memory, connectors, LangChain comparison", duration: "60 min", link: "/docs/Semantic-Kernel" },
      { id: "O2", title: "AI Agents & Agent Framework", desc: "Agent concepts, planning, memory, tool use, multi-agent", duration: "90–120 min", link: "/docs/AI-Agents-Deep-Dive" },
      { id: "O3", title: "MCP, Tools & Function Calling", desc: "Model Context Protocol, tool schemas, A2A, MCP servers", duration: "60–90 min", link: "/docs/O3-MCP-Tools-Functions" },
    ],
  },
  {
    id: "O²", icon: "🍃", title: "Operations — The Leaves", meta: "Azure AI platform, hosting, Copilot — the canopy that shelters production", color: "#6366f1", bgColor: "rgba(99, 102, 241, 0.08)",
    modules: [
      { id: "O4", title: "Azure AI Platform & Landing Zones", desc: "AI Foundry, Model Catalog, deployments, endpoints", duration: "60–90 min", link: "/docs/Azure-AI-Foundry" },
      { id: "O5", title: "AI Infrastructure & Hosting", desc: "GPU compute, Container Apps, AKS, model serving, scaling", duration: "60–90 min", link: "/docs/AI-Infrastructure" },
      { id: "O6", title: "Copilot Ecosystem & Low-Code", desc: "M365 Copilot, Copilot Studio, Power Platform, GitHub Copilot", duration: "45–60 min", link: "/docs/Copilot-Ecosystem" },
    ],
  },
  {
    id: "T", icon: "🍎", title: "Transformation — The Fruit", meta: "Fine-tuning, safety, production — turning AI into real-world impact", color: "#7c3aed", bgColor: "rgba(124, 58, 237, 0.08)",
    modules: [
      { id: "T1", title: "Fine-Tuning & Customization", desc: "LoRA, QLoRA, RLHF, DPO, evaluation, MLOps lifecycle", duration: "60–90 min", link: "/docs/T1-Fine-Tuning-MLOps" },
      { id: "T2", title: "Responsible AI & Safety", desc: "Content safety, red teaming, guardrails, Azure AI Content Safety", duration: "45–60 min", link: "/docs/Responsible-AI-Safety" },
      { id: "T3", title: "Production Architecture", desc: "Multi-agent hosting, API gateway, cost control, monitoring", duration: "60–90 min", link: "/docs/T3-Production-Patterns" },
    ],
  },
];

const learningPaths = [
  { emoji: "🚀", title: "I'm New to AI", desc: "Start from the roots, build layer by layer", duration: "6–8 hours", modules: "F1 → F3 → F2 → R1 → R2 → R3" },
  { emoji: "⚡", title: "Build an Agent NOW", desc: "Fast-track to agent development", duration: "4–5 hours", modules: "F1 → R1 → O2 → O3 → O1 → T3" },
  { emoji: "🏗️", title: "AI Infrastructure", desc: "Platform and operations for infra architects", duration: "5–6 hours", modules: "F1 → O4 → O5 → T3 → R2 → T1" },
  { emoji: "🔍", title: "Make AI Reliable", desc: "Determinism, grounding, and safety", duration: "3–4 hours", modules: "R3 → R1 → R2 → T2 → REF" },
  { emoji: "🎯", title: "The Complete Journey", desc: "Every module, roots to fruit", duration: "16–22 hours", modules: "F1 → F2 → F3 → R1 → ... → T3" },
  { emoji: "💡", title: "Pro Tip", desc: "FrootAI removes silos between infra, platform, and app teams. It's the open glue — share it across teams to speak the same AI language.", duration: "", modules: "The telescope and the microscope" },
];

// ─── FROOT Packages (inspired by awesome-copilot) ──────────────────

const frootPackages = [
  {
    icon: "🌱", name: "FROOT Foundations Pack", id: "froot-foundations",
    desc: "Tokens, parameters, transformers, model selection — everything to build AI literacy from zero",
    modules: "F1 + F2 + F3", size: "133 KB",
    github: "https://github.com/gitpavleenbali/frootai/tree/main/docs",
    includes: ["GenAI Foundations (F1)", "LLM Landscape (F2)", "AI Glossary 200+ terms (F3)"],
  },
  {
    icon: "🪵", name: "FROOT Reasoning Pack", id: "froot-reasoning",
    desc: "Prompts, RAG, determinism — make AI think well, ground it, stop hallucination",
    modules: "R1 + R2 + R3", size: "125 KB",
    github: "https://github.com/gitpavleenbali/frootai/tree/main/docs",
    includes: ["Prompt Engineering (R1)", "RAG Architecture (R2)", "Deterministic AI (R3)"],
  },
  {
    icon: "🌿", name: "FROOT Orchestration Pack", id: "froot-orchestration",
    desc: "Semantic Kernel, agents, MCP — wire AI into intelligent multi-agent systems",
    modules: "O1 + O2 + O3", size: "146 KB",
    github: "https://github.com/gitpavleenbali/frootai/tree/main/docs",
    includes: ["Semantic Kernel (O1)", "AI Agents Deep-Dive (O2)", "MCP & Tools (O3)"],
  },
  {
    icon: "🍃", name: "FROOT Operations Pack", id: "froot-operations",
    desc: "Azure AI Foundry, GPU infra, Copilot ecosystem — run AI in production at scale",
    modules: "O4 + O5 + O6", size: "136 KB",
    github: "https://github.com/gitpavleenbali/frootai/tree/main/docs",
    includes: ["Azure AI Platform (O4)", "AI Infrastructure (O5)", "Copilot Ecosystem (O6)"],
  },
  {
    icon: "🍎", name: "FROOT Transformation Pack", id: "froot-transformation",
    desc: "Fine-tuning, responsible AI, production patterns — ship AI safely and efficiently",
    modules: "T1 + T2 + T3", size: "89 KB",
    github: "https://github.com/gitpavleenbali/frootai/tree/main/docs",
    includes: ["Fine-Tuning & MLOps (T1)", "Responsible AI (T2)", "Production Patterns (T3)"],
  },
  {
    icon: "🔌", name: "FrootAI MCP Server", id: "frootai-mcp",
    desc: "The complete knowledge base as an MCP server — add to any agent, editor, or workflow",
    modules: "All 17 modules + 5 tools", size: "664 KB",
    github: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server",
    includes: ["list_modules", "get_module", "lookup_term", "search_knowledge", "get_architecture_pattern"],
  },
];

// ─── Components ────────────────────────────────────────────────────

function HeroBanner(): JSX.Element {
  return (
    <div className={styles.hero}>
      <div className={styles.heroInner}>
        <img src="/frootai/img/aifroot-logo.svg" alt="FrootAI" className={styles.heroLogo} />
        <p className={styles.heroLabel}>From Root to Fruit</p>
        <h1 className={styles.heroTitle}>FrootAI</h1>
        <p className={styles.heroAcronym}>
          AI{" "}
          <span className={styles.heroAcronymF}>F</span>oundations ·{" "}
          <span className={styles.heroAcronymR}>R</span>easoning ·{" "}
          <span className={styles.heroAcronymO1}>O</span>rchestration ·{" "}
          <span className={styles.heroAcronymO2}>O</span>perations ·{" "}
          <span className={styles.heroAcronymT}>T</span>ransformation
        </p>
        <p className={styles.heroSlogan}>
          From a single token to a production agent fleet
        </p>

        {/* Visual tiles instead of text blocks */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", margin: "24px auto", maxWidth: "720px" }}>
          <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid rgba(16, 185, 129, 0.2)", background: "rgba(16, 185, 129, 0.04)", textAlign: "center" }}>
            <div style={{ fontSize: "1.4rem", marginBottom: "4px" }}>🔗</div>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "2px" }}>The Open Glue</div>
            <div style={{ fontSize: "0.72rem", color: "var(--ifm-color-emphasis-500)" }}>Binds infrastructure, platform & application</div>
          </div>
          <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid rgba(99, 102, 241, 0.2)", background: "rgba(99, 102, 241, 0.04)", textAlign: "center" }}>
            <div style={{ fontSize: "1.4rem", marginBottom: "4px" }}>🔌</div>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "2px" }}>MCP Skill Set</div>
            <div style={{ fontSize: "0.72rem", color: "var(--ifm-color-emphasis-500)" }}>Agent-callable knowledge, not just docs</div>
          </div>
          <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid rgba(245, 158, 11, 0.2)", background: "rgba(245, 158, 11, 0.04)", textAlign: "center" }}>
            <div style={{ fontSize: "1.4rem", marginBottom: "4px" }}>🎓</div>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "2px" }}>Knowledge Resource</div>
            <div style={{ fontSize: "0.72rem", color: "var(--ifm-color-emphasis-500)" }}>Focused diagrams to learn AI architecture fast</div>
          </div>
        </div>

        <div className={styles.heroCta}>
          <Link className={styles.ctaPrimary} to="/docs/">
            🌱 Start from the Roots
          </Link>
          <Link className={styles.ctaSecondary} to="#mcp-tooling">
            🔌 Explore MCP Tooling
          </Link>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.stat}>
            <span className={styles.statNum} style={{ color: "#10b981" }}>17</span>
            <span className={styles.statLabel}>Modules</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum} style={{ color: "#06b6d4" }}>5</span>
            <span className={styles.statLabel}>MCP Tools</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum} style={{ color: "#6366f1" }}>200+</span>
            <span className={styles.statLabel}>AI Terms</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum} style={{ color: "#7c3aed" }}>90%</span>
            <span className={styles.statLabel}>Token Savings</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MCPTeaser(): JSX.Element {
  return (
    <section className={styles.lensSection} style={{ borderBottom: "1px solid var(--ifm-color-emphasis-200)", paddingBottom: "48px", marginBottom: "16px" }}>
      <h2 className={styles.sectionTitle}>🔌 Not Just Docs — An Agent Skill Set</h2>
      <p className={styles.sectionSub}>
        FrootAI ships as an <strong>MCP Server</strong>. Add it to any AI agent in 30 seconds.
        Concise, precise knowledge — less token burn, less compute, less cost. More grounded, more efficient, more actionable.
      </p>
      <div className={styles.lensGrid}>
        <div className={styles.lensCard} style={{ borderColor: "rgba(239, 68, 68, 0.2)" }}>
          <div className={styles.lensEmoji}>📚</div>
          <h3 className={styles.lensTitle}>Without FrootAI MCP</h3>
          <ul className={styles.lensList}>
            <li>Agent searches the internet — slow, noisy</li>
            <li>Burns 5,000+ tokens per architecture query</li>
            <li>May hallucinate design guidance</li>
            <li>Generic answers — no Azure patterns</li>
            <li>High compute cost, low confidence</li>
          </ul>
        </div>
        <div className={styles.lensCard} style={{ borderColor: "rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.03)" }}>
          <div className={styles.lensEmoji}>🌳</div>
          <h3 className={styles.lensTitle}>With FrootAI MCP</h3>
          <ul className={styles.lensList}>
            <li>Agent queries curated 664KB knowledge base</li>
            <li>Pre-written answers — 90% less token burn</li>
            <li>Zero hallucination — grounded in verified docs</li>
            <li>Azure-specific best practices & patterns</li>
            <li>Open economics — less compute, less price</li>
          </ul>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <Link className={styles.ctaButton} to="#mcp-tooling" style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>
          ↓ See Full MCP Setup Below
        </Link>
      </div>
    </section>
  );
}

function FROOTLayer({ layer }: { layer: (typeof layers)[0] }): JSX.Element {
  return (
    <div className={styles.layer}>
      <div className={styles.layerHeader}>
        <div className={styles.layerIcon} style={{ background: layer.bgColor }}>{layer.icon}</div>
        <div>
          <h3 className={styles.layerTitle} style={{ color: layer.color }}>{layer.id} — {layer.title}</h3>
          <p className={styles.layerMeta}>{layer.meta}</p>
        </div>
      </div>
      <div className={styles.layerModules}>
        {layer.modules.map((mod) => (
          <Link key={mod.id} to={mod.link} className={styles.moduleCard} style={{ borderColor: `${layer.color}22` }}
            onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }), 100)}>
            <span className={styles.moduleId} style={{ color: layer.color }}>{mod.id}</span>
            <span className={styles.moduleTitle}>{mod.title}</span>
            <span className={styles.moduleDesc}>{mod.desc}</span>
            <span className={styles.moduleDuration}>{mod.duration}</span>
            <span className={styles.moduleArrow} style={{ color: layer.color }}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LensSection(): JSX.Element {
  return (
    <section className={styles.lensSection}>
      <h2 className={styles.sectionTitle}>Two Lenses, One Tree</h2>
      <p className={styles.sectionSub}>FrootAI gives you both the big picture and the tiny details</p>
      <div className={styles.lensGrid}>
        <div className={styles.lensCard}>
          <div className={styles.lensEmoji}>🔭</div>
          <h3 className={styles.lensTitle}>Telescope — Big Picture</h3>
          <ul className={styles.lensList}>
            <li>AI Landing Zone architecture</li>
            <li>Semantic Kernel vs Agent Framework</li>
            <li>Multi-agent hosting patterns</li>
            <li>10M-document RAG pipelines</li>
            <li>Enterprise copilot strategy</li>
          </ul>
        </div>
        <div className={styles.lensCard}>
          <div className={styles.lensEmoji}>🔬</div>
          <h3 className={styles.lensTitle}>Microscope — Tiny Details</h3>
          <ul className={styles.lensList}>
            <li>top_k=40 vs top_k=10</li>
            <li>BPE tokenization internals</li>
            <li>Why temperature=0 isn't truly deterministic</li>
            <li>Cosine similarity thresholds</li>
            <li>LoRA rank selection</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function MCPFullSection(): JSX.Element {
  return (
    <section id="mcp-tooling" className={styles.lensSection} style={{ scrollMarginTop: "80px" }}>
      <h2 className={styles.sectionTitle}>🔌 MCP Tooling — Add FrootAI to Your Agent</h2>
      <p className={styles.sectionSub}>
        Two paths: self-hosted for privacy, or connected for convenience. Both give your agent 5 tools, 17 modules, 200+ terms.
      </p>

      <div className={styles.lensGrid}>
        <div className={styles.lensCard}>
          <div className={styles.lensEmoji}>🏠</div>
          <h3 className={styles.lensTitle}>Self-Hosted (Private)</h3>
          <ul className={styles.lensList}>
            <li><strong>For:</strong> Enterprise, air-gapped, privacy-first</li>
            <li><code>git clone github.com/gitpavleenbali/frootai.git</code></li>
            <li><code>cd frootai/mcp-server && npm install</code></li>
            <li>Runs 100% locally — no external calls</li>
            <li>Update: <code>git pull && npm run build</code></li>
          </ul>
        </div>
        <div className={styles.lensCard}>
          <div className={styles.lensEmoji}>🌐</div>
          <h3 className={styles.lensTitle}>Connected (GitHub-Hosted)</h3>
          <ul className={styles.lensList}>
            <li><strong>For:</strong> Quick setup, always latest content</li>
            <li><strong>AI Foundry:</strong> Add as MCP tool in agent config</li>
            <li><strong>VS Code:</strong> <code>.vscode/mcp.json</code> auto-detects</li>
            <li><strong>Copilot Studio:</strong> Add as MCP connector</li>
            <li>Point to GitHub repo — always current</li>
          </ul>
        </div>
      </div>

      {/* 3 config cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px", marginTop: "24px" }}>
        <div style={{ padding: "14px 18px", borderRadius: "12px", fontSize: "0.75rem", fontFamily: "var(--ifm-font-family-monospace)", background: "rgba(16, 185, 129, 0.04)", border: "1px solid rgba(16, 185, 129, 0.12)", lineHeight: "1.7" }}>
          <div style={{ fontWeight: 700, marginBottom: "6px", fontSize: "0.8rem", fontFamily: "var(--ifm-font-family-base)" }}>Claude Desktop / Cursor</div>
          <div style={{ color: "var(--ifm-color-emphasis-400)", fontSize: "0.7rem" }}>// claude_desktop_config.json</div>
          <div>{`{ "mcpServers": {`}</div>
          <div>{`  "frootai": {`}</div>
          <div>{`    "command": "node",`}</div>
          <div>{`    "args": ["mcp-server/index.js"]`}</div>
          <div>{`} } }`}</div>
        </div>
        <div style={{ padding: "14px 18px", borderRadius: "12px", fontSize: "0.75rem", fontFamily: "var(--ifm-font-family-monospace)", background: "rgba(99, 102, 241, 0.04)", border: "1px solid rgba(99, 102, 241, 0.12)", lineHeight: "1.7" }}>
          <div style={{ fontWeight: 700, marginBottom: "6px", fontSize: "0.8rem", fontFamily: "var(--ifm-font-family-base)" }}>VS Code / GitHub Copilot</div>
          <div style={{ color: "var(--ifm-color-emphasis-400)", fontSize: "0.7rem" }}>// .vscode/mcp.json (in repo!)</div>
          <div>{`{ "servers": {`}</div>
          <div>{`  "frootai": {`}</div>
          <div>{`    "command": "node",`}</div>
          <div>{`    "args": ["mcp-server/index.js"]`}</div>
          <div>{`} } }`}</div>
        </div>
        <div style={{ padding: "14px 18px", borderRadius: "12px", fontSize: "0.75rem", fontFamily: "var(--ifm-font-family-monospace)", background: "rgba(124, 58, 237, 0.04)", border: "1px solid rgba(124, 58, 237, 0.12)", lineHeight: "1.7" }}>
          <div style={{ fontWeight: 700, marginBottom: "6px", fontSize: "0.8rem", fontFamily: "var(--ifm-font-family-base)" }}>Azure AI Foundry</div>
          <div style={{ color: "var(--ifm-color-emphasis-400)", fontSize: "0.7rem" }}>// Agent Tools → Add MCP</div>
          <div>1. Open Agent in Foundry</div>
          <div>2. Tools → Add Tool → MCP</div>
          <div>3. Point to server endpoint</div>
          <div style={{ color: "#7c3aed", fontStyle: "italic" }}>or run locally in VS Code</div>
        </div>
      </div>

      {/* 5 tools */}
      <h3 className={styles.sectionTitle} style={{ marginTop: "40px", fontSize: "1.15rem" }}>5 Tools Your Agent Receives</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginTop: "16px" }}>
        {[
          { name: "list_modules", desc: "Browse 17 modules by FROOT layer", icon: "📋" },
          { name: "get_module", desc: "Read any module content (F1–T3)", icon: "📖" },
          { name: "lookup_term", desc: "200+ AI/ML term definitions", icon: "🔍" },
          { name: "search_knowledge", desc: "Full-text search all modules", icon: "🔎" },
          { name: "get_architecture_pattern", desc: "7 pre-built decision guides", icon: "🏗️" },
        ].map((tool) => (
          <div key={tool.name} style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--ifm-color-emphasis-200)", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "6px" }}>{tool.icon}</div>
            <div style={{ fontSize: "0.78rem", fontFamily: "var(--ifm-font-family-monospace)", fontWeight: 600, color: "#10b981" }}>{tool.name}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-500)", marginTop: "4px" }}>{tool.desc}</div>
          </div>
        ))}
      </div>

      {/* Advantages */}
      <h3 className={styles.sectionTitle} style={{ marginTop: "40px", fontSize: "1.15rem" }}>Why MCP? The Open Economics of AI Knowledge</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px", marginTop: "16px" }}>
        {[
          { icon: "🎯", title: "Agent Skill Set", desc: "Like adding a senior architect to your agent's team. Curated knowledge becomes a callable skill — not static reading material" },
          { icon: "💰", title: "Open Economics", desc: "664KB pre-written knowledge vs 50K+ tokens generated per query. Less compute, less price, less LLM consumption. 90% cost reduction" },
          { icon: "🛡️", title: "Zero Hallucination", desc: "Concise, precise information extracted in efficient attempts. Answers from verified docs, not model imagination" },
          { icon: "🔄", title: "Always Current", desc: "git pull to update. No model retraining, no re-deployment. The knowledge grows with the community" },
          { icon: "🔒", title: "Privacy-First", desc: "Runs 100% locally. No data leaves your machine. Air-gap compatible. Enterprise-ready from day one" },
          { icon: "🌐", title: "Breaks Team Silos", desc: "Infrastructure teams → platform teams → application teams. FrootAI is the open glue that gives all teams the same AI vocabulary" },
        ].map((item) => (
          <div key={item.title} style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--ifm-color-emphasis-200)" }}>
            <div style={{ fontSize: "1.3rem", marginBottom: "6px" }}>{item.icon}</div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "4px" }}>{item.title}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-500)", lineHeight: 1.5 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: "28px" }}>
        <Link className={styles.ctaButton} to="https://github.com/gitpavleenbali/frootai/tree/main/mcp-server" style={{ background: "linear-gradient(135deg, #6366f1, #7c3aed)" }}>
          🔌 Get the MCP Server on GitHub
        </Link>
      </div>
    </section>
  );
}

function PackagesSection(): JSX.Element {
  return (
    <section className={styles.lensSection}>
      <h2 className={styles.sectionTitle}>📦 FROOT Packages — Download & Use</h2>
      <p className={styles.sectionSub}>
        Pick the layer you need. Each package is a self-contained knowledge bundle — use it as documentation, feed it to your agent, or share it with your team.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px", marginTop: "20px" }}>
        {frootPackages.map((pkg) => (
          <div key={pkg.id} style={{ padding: "20px", borderRadius: "14px", border: "1px solid var(--ifm-color-emphasis-200)", display: "flex", flexDirection: "column", transition: "border-color 0.2s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span style={{ fontSize: "1.4rem" }}>{pkg.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>{pkg.name}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--ifm-color-emphasis-400)" }}>{pkg.modules} · {pkg.size}</div>
              </div>
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)", lineHeight: 1.5, marginBottom: "10px", flexGrow: 1 }}>{pkg.desc}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-400)", marginBottom: "12px" }}>
              {pkg.includes.map((item, i) => (
                <span key={i}>• {item}{i < pkg.includes.length - 1 ? " " : ""}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Link to={pkg.github} style={{ flex: 1, textAlign: "center", padding: "8px", borderRadius: "8px", border: "1px solid var(--ifm-color-emphasis-200)", fontSize: "0.78rem", fontWeight: 600, textDecoration: "none", color: "var(--ifm-font-color-base)", transition: "all 0.2s" }}>
                Open on GitHub
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PathSection(): JSX.Element {
  return (
    <section className={styles.paths}>
      <h2 className={styles.sectionTitle}>Learning Paths</h2>
      <p className={styles.sectionSub}>Not sure where to start? Pick your path</p>
      <div className={styles.pathGrid}>
        {learningPaths.map((path) => (
          <div key={path.title} className={styles.pathCard} style={path.title === "Pro Tip" ? { borderColor: "rgba(99, 102, 241, 0.3)", background: "rgba(99, 102, 241, 0.03)" } : {}}>
            <div className={styles.pathEmoji}>{path.emoji}</div>
            <h3 className={styles.pathTitle}>{path.title}</h3>
            <p className={styles.pathDesc}>{path.desc}</p>
            {path.duration && <p className={styles.pathDuration}>{path.duration}</p>}
            <p className={styles.pathModules}>{path.modules}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Main Page — Section Order ─────────────────────────────────────
// 1. Hero (Start from Roots → /docs/ AI Hub page)
// 2. MCP Teaser (first impression: skill set, not just docs)
// 3. FROOT Framework (5 layers, 17 modules)
// 4. Two Lenses (telescope / microscope)
// 5. MCP Full (setup, tools, advantages, open economics)
// 6. FROOT Packages (downloadable bundles like awesome-copilot)
// 7. Learning Paths (6 cards including Pro Tip)
// 8. CTA

export default function FrootAIPage(): JSX.Element {
  useScrollToTop();

  return (
    <Layout
      title="FrootAI — The Open Glue for AI Architecture"
      description="The open glue that binds infrastructure, platform, and application. 17 modules, 200+ AI terms, MCP server, FROOT packages. From root to fruit."
    >
      <HeroBanner />
      <main className={styles.main}>
        <MCPTeaser />

        <section>
          <h2 className={styles.sectionTitle}>The FROOT Framework</h2>
          <p className={styles.sectionSub}>
            Five layers — from the bedrock of infrastructure to the fruit of production AI
          </p>
          <div className={styles.layers}>
            {layers.map((layer) => (
              <FROOTLayer key={layer.id} layer={layer} />
            ))}
          </div>
        </section>

        <LensSection />
        <MCPFullSection />
        <PackagesSection />
        <PathSection />

        <section className={styles.ctaSection}>
          <h2 className={styles.sectionTitle}>The Open Glue for AI Architecture</h2>
          <p className={styles.ctaDesc}>
            Infrastructure is the bedrock. Platform is the trunk. Application is the fruit.
            FrootAI removes silos between teams — it's the open glue. Read it, query it via MCP, download the packs, build with it.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link className={styles.ctaButton} to="/docs/"
              onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }), 100)}>
              🌱 Start from the Roots
            </Link>
            <Link className={styles.ctaButton} to="#mcp-tooling" style={{ background: "linear-gradient(135deg, #6366f1, #7c3aed)" }}>
              🔌 Add MCP to Your Agent
            </Link>
            <Link className={styles.ctaButton} to="https://github.com/gitpavleenbali/azure-wiki" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
              ⭐ Star on GitHub
            </Link>
          </div>
        </section>
      </main>
    </Layout>
  );
}
