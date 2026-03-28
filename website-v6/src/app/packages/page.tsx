"use client";

import { useState } from "react";
import Link from "next/link";
import { Sprout, TreePine, Layers, Wind, Apple, Plug, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { GlowPill } from "@/components/ui/glow-pill";

/* ═══ DATA ═══ */
const categories: { name: string; Icon: LucideIcon; count: number; color: string }[] = [
  { name: "Foundations", Icon: Sprout, count: 4, color: "#f59e0b" },
  { name: "Reasoning", Icon: TreePine, count: 3, color: "#10b981" },
  { name: "Orchestration", Icon: Layers, count: 3, color: "#06b6d4" },
  { name: "Operations", Icon: Wind, count: 3, color: "#6366f1" },
  { name: "Transformation", Icon: Apple, count: 3, color: "#7c3aed" },
  { name: "MCP Tools", Icon: Plug, count: 5, color: "#10b981" },
];

const allPackages = [
  { id: "F1", name: "GenAI Foundations", category: "Foundations", desc: "Transformers, attention, tokenization, inference, parameters, context windows, embeddings", file: "GenAI-Foundations.md", size: "55 KB", updated: "March 2026", docsLink: "/docs/GenAI-Foundations", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/GenAI-Foundations.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/GenAI-Foundations.md" },
  { id: "F2", name: "LLM Landscape & Model Selection", category: "Foundations", desc: "GPT, Claude, Llama, Gemini, Phi — benchmarks, open vs proprietary", file: "LLM-Landscape.md", size: "47 KB", updated: "March 2026", docsLink: "/docs/LLM-Landscape", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/LLM-Landscape.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/LLM-Landscape.md" },
  { id: "F3", name: "AI Glossary A–Z", category: "Foundations", desc: "200+ AI/ML terms defined — from ablation to zero-shot", file: "F3-AI-Glossary-AZ.md", size: "31 KB", updated: "March 2026", docsLink: "/docs/F3-AI-Glossary-AZ", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/F3-AI-Glossary-AZ.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/F3-AI-Glossary-AZ.md" },
  { id: "F4", name: ".github Agentic OS — 7 Primitives", category: "Foundations", desc: "The .github folder as a full agentic OS. 7 primitives, 4 layers", file: "F4-GitHub-Agentic-OS.md", size: "18 KB", updated: "March 2026", docsLink: "/docs/F4-GitHub-Agentic-OS", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/F4-GitHub-Agentic-OS.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/F4-GitHub-Agentic-OS.md" },
  { id: "R1", name: "Prompt Engineering & Grounding", category: "Reasoning", desc: "System messages, few-shot, chain-of-thought, structured output, guardrails", file: "Prompt-Engineering.md", size: "34 KB", updated: "March 2026", docsLink: "/docs/Prompt-Engineering", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/Prompt-Engineering.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/Prompt-Engineering.md" },
  { id: "R2", name: "RAG Architecture & Retrieval", category: "Reasoning", desc: "Chunking, embeddings, vector search, Azure AI Search, semantic ranking", file: "RAG-Architecture.md", size: "67 KB", updated: "March 2026", docsLink: "/docs/RAG-Architecture", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/RAG-Architecture.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/RAG-Architecture.md" },
  { id: "R3", name: "Making AI Deterministic & Reliable", category: "Reasoning", desc: "Hallucination reduction, grounding, temperature tuning, evaluation metrics", file: "R3-Deterministic-AI.md", size: "24 KB", updated: "March 2026", docsLink: "/docs/R3-Deterministic-AI", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/R3-Deterministic-AI.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/R3-Deterministic-AI.md" },
  { id: "O1", name: "Semantic Kernel & Orchestration", category: "Orchestration", desc: "Plugins, planners, memory, connectors, SK vs LangChain", file: "Semantic-Kernel.md", size: "58 KB", updated: "March 2026", docsLink: "/docs/Semantic-Kernel", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/Semantic-Kernel.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/Semantic-Kernel.md" },
  { id: "O2", name: "AI Agents & Agent Framework", category: "Orchestration", desc: "Agent concepts, planning, memory, tool use, multi-agent patterns", file: "AI-Agents-Deep-Dive.md", size: "66 KB", updated: "March 2026", docsLink: "/docs/AI-Agents-Deep-Dive", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/AI-Agents-Deep-Dive.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/AI-Agents-Deep-Dive.md" },
  { id: "O3", name: "MCP, Tools & Function Calling", category: "Orchestration", desc: "Model Context Protocol, tool schemas, function calling, A2A, registries", file: "O3-MCP-Tools-Functions.md", size: "23 KB", updated: "March 2026", docsLink: "/docs/O3-MCP-Tools-Functions", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/O3-MCP-Tools-Functions.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/O3-MCP-Tools-Functions.md" },
  { id: "O4", name: "Azure AI Platform & Landing Zones", category: "Operations", desc: "AI Foundry, Model Catalog, deployments, endpoints, enterprise patterns", file: "Azure-AI-Foundry.md", size: "48 KB", updated: "March 2026", docsLink: "/docs/Azure-AI-Foundry", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/Azure-AI-Foundry.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/Azure-AI-Foundry.md" },
  { id: "O5", name: "AI Infrastructure & Hosting", category: "Operations", desc: "GPU compute, Container Apps, AKS, App Service, model serving, scaling", file: "AI-Infrastructure.md", size: "51 KB", updated: "March 2026", docsLink: "/docs/AI-Infrastructure", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/AI-Infrastructure.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/AI-Infrastructure.md" },
  { id: "O6", name: "Copilot Ecosystem & Low-Code AI", category: "Operations", desc: "M365 Copilot, Copilot Studio, Power Platform AI, GitHub Copilot", file: "Copilot-Ecosystem.md", size: "38 KB", updated: "March 2026", docsLink: "/docs/Copilot-Ecosystem", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/Copilot-Ecosystem.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/Copilot-Ecosystem.md" },
  { id: "T1", name: "Fine-Tuning & Model Customization", category: "Transformation", desc: "When to fine-tune vs RAG, LoRA, QLoRA, RLHF, DPO, evaluation, MLOps", file: "T1-Fine-Tuning-MLOps.md", size: "20 KB", updated: "March 2026", docsLink: "/docs/T1-Fine-Tuning-MLOps", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/T1-Fine-Tuning-MLOps.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/T1-Fine-Tuning-MLOps.md" },
  { id: "T2", name: "Responsible AI & Safety", category: "Transformation", desc: "Content safety, red teaming, guardrails, Azure AI Content Safety", file: "Responsible-AI-Safety.md", size: "49 KB", updated: "March 2026", docsLink: "/docs/Responsible-AI-Safety", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/Responsible-AI-Safety.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/Responsible-AI-Safety.md" },
  { id: "T3", name: "Production Architecture Patterns", category: "Transformation", desc: "Multi-agent hosting, API gateway, latency optimization, cost control", file: "T3-Production-Patterns.md", size: "20 KB", updated: "March 2026", docsLink: "/docs/T3-Production-Patterns", githubLink: "https://github.com/gitpavleenbali/frootai/blob/main/docs/T3-Production-Patterns.md", rawLink: "https://raw.githubusercontent.com/gitpavleenbali/frootai/main/docs/T3-Production-Patterns.md" },
  { id: "MCP1", name: "list_modules", category: "MCP Tools", desc: "Browse all 18 FROOT modules organized by layer", file: "mcp-server/index.js", size: "MCP Tool", updated: "March 2026", docsLink: "/docs/O3-MCP-Tools-Functions", githubLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server", rawLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server" },
  { id: "MCP2", name: "get_module", category: "MCP Tools", desc: "Read any module by ID (F1–T3)", file: "mcp-server/index.js", size: "MCP Tool", updated: "March 2026", docsLink: "/docs/O3-MCP-Tools-Functions", githubLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server", rawLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server" },
  { id: "MCP3", name: "lookup_term", category: "MCP Tools", desc: "200+ AI/ML term definitions from curated glossary", file: "mcp-server/index.js", size: "MCP Tool", updated: "March 2026", docsLink: "/docs/F3-AI-Glossary-AZ", githubLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server", rawLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server" },
  { id: "MCP4", name: "search_knowledge", category: "MCP Tools", desc: "Full-text search across all 18 modules", file: "mcp-server/index.js", size: "MCP Tool", updated: "March 2026", docsLink: "/docs/O3-MCP-Tools-Functions", githubLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server", rawLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server" },
  { id: "MCP5", name: "get_architecture_pattern", category: "MCP Tools", desc: "7 pre-built decision guides for AI architecture", file: "mcp-server/index.js", size: "MCP Tool", updated: "March 2026", docsLink: "/docs/T3-Production-Patterns", githubLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server", rawLink: "https://github.com/gitpavleenbali/frootai/tree/main/mcp-server" },
];

const catColors: Record<string, string> = { Foundations: "#f59e0b", Reasoning: "#10b981", Orchestration: "#06b6d4", Operations: "#6366f1", Transformation: "#7c3aed", "MCP Tools": "#10b981" };

export default function PackagesPage() {
  const [filter, setFilter] = useState<string>("All");
  const filtered = filter === "All" ? allPackages : allPackages.filter(p => p.category === filter);

  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader title="FROOT Packages" subtitle="Downloadable LEGO blocks — knowledge modules and MCP tools organized by FROOT layer. Click to explore, read, or download." />

      {/* Category cards */}
      <FadeIn>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {categories.map((c) => (
            <button key={c.name} onClick={() => setFilter(c.name === filter ? "All" : c.name)}
              className={`rounded-xl border p-3 text-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${filter === c.name ? "border-indigo/40 bg-indigo/[0.06]" : "border-border bg-bg-surface"}`}>
              <div className="flex justify-center mb-1"><c.Icon className="h-5 w-5" style={{ color: c.color }} /></div>
              <div className="font-bold text-[12px]">{c.name}</div>
              <div className="text-[11px] mt-0.5" style={{ color: c.color }}>{c.count} items</div>
            </button>
          ))}
        </div>
        {filter !== "All" && (
          <div className="text-center mb-6">
            <button onClick={() => setFilter("All")} className="text-[12px] text-fg-dim hover:text-fg cursor-pointer underline">Show all packages</button>
          </div>
        )}
      </FadeIn>

      {/* Package list */}
      <div className="space-y-3">
        {filtered.map((pkg) => (
          <FadeIn key={pkg.id}>
            <div className="rounded-xl border border-border bg-bg-surface p-5 transition-all duration-200 hover:border-indigo/20 hover:shadow-lg hover:shadow-black/10">
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge label={pkg.id} color={catColors[pkg.category] || "#6366f1"} />
                    <h3 className="font-bold text-sm">{pkg.name}</h3>
                  </div>
                  <p className="text-[13px] text-fg-muted leading-relaxed mb-2">{pkg.desc}</p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-fg-dim">
                    <span className="font-mono">{pkg.file}</span>
                    <span>{pkg.size}</span>
                    <span>Updated: {pkg.updated}</span>
                  </div>
                </div>
                <div className="flex gap-2 items-start shrink-0 flex-wrap sm:flex-nowrap">
                  <Link href={pkg.docsLink} className="rounded-lg border border-emerald/25 bg-emerald/5 px-3 py-1.5 text-[11px] font-semibold text-emerald hover:bg-emerald/10 transition-colors">Docs</Link>
                  <a href={pkg.githubLink} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-indigo/25 bg-indigo/5 px-3 py-1.5 text-[11px] font-semibold text-indigo hover:bg-indigo/10 transition-colors">GitHub</a>
                  <a href={pkg.rawLink} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-amber/25 bg-amber/5 px-3 py-1.5 text-[11px] font-semibold text-amber hover:bg-amber/10 transition-colors">Raw ↓</a>
                </div>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap justify-center gap-2">
        <GlowPill href="/ecosystem" color="#0ea5e9">Ecosystem</GlowPill>
        <GlowPill href="/mcp-tooling" color="#10b981">MCP Server</GlowPill>
        <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
