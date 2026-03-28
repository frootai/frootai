import type { Metadata } from "next";
import Link from "next/link";
import { Sprout, TreePine, Layers, Wind, Apple, ClipboardList, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeader } from "@/components/ui/section-header";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = { title: "Knowledge Modules", description: "18 FROOT knowledge modules — AI Foundations, Reasoning, Orchestration, Operations, Transformation." };

const layers: { id: string; Icon: LucideIcon; title: string; color: string; modules: { id: string; name: string; slug: string; size: string }[] }[] = [
  { id: "F", Icon: Sprout, title: "Foundations", color: "#f59e0b", modules: [
    { id: "F1", name: "GenAI Foundations", slug: "GenAI-Foundations", size: "55 KB" },
    { id: "F2", name: "LLM Landscape", slug: "LLM-Landscape", size: "47 KB" },
    { id: "F3", name: "AI Glossary A–Z", slug: "F3-AI-Glossary-AZ", size: "31 KB" },
    { id: "F4", name: ".github Agentic OS", slug: "F4-GitHub-Agentic-OS", size: "18 KB" },
  ]},
  { id: "R", Icon: TreePine, title: "Reasoning", color: "#10b981", modules: [
    { id: "R1", name: "Prompt Engineering", slug: "Prompt-Engineering", size: "34 KB" },
    { id: "R2", name: "RAG Architecture", slug: "RAG-Architecture", size: "67 KB" },
    { id: "R3", name: "Deterministic AI", slug: "R3-Deterministic-AI", size: "24 KB" },
  ]},
  { id: "O¹", Icon: Layers, title: "Orchestration", color: "#06b6d4", modules: [
    { id: "O1", name: "Semantic Kernel", slug: "Semantic-Kernel", size: "58 KB" },
    { id: "O2", name: "AI Agents Deep Dive", slug: "AI-Agents-Deep-Dive", size: "66 KB" },
    { id: "O3", name: "MCP, Tools & Functions", slug: "O3-MCP-Tools-Functions", size: "23 KB" },
  ]},
  { id: "O²", Icon: Wind, title: "Operations", color: "#6366f1", modules: [
    { id: "O4", name: "Azure AI Foundry", slug: "Azure-AI-Foundry", size: "48 KB" },
    { id: "O5", name: "AI Infrastructure", slug: "AI-Infrastructure", size: "51 KB" },
    { id: "O6", name: "Copilot Ecosystem", slug: "Copilot-Ecosystem", size: "38 KB" },
  ]},
  { id: "T", Icon: Apple, title: "Transformation", color: "#7c3aed", modules: [
    { id: "T1", name: "Fine-Tuning & MLOps", slug: "T1-Fine-Tuning-MLOps", size: "20 KB" },
    { id: "T2", name: "Responsible AI & Safety", slug: "Responsible-AI-Safety", size: "49 KB" },
    { id: "T3", name: "Production Patterns", slug: "T3-Production-Patterns", size: "20 KB" },
  ]},
];

const extras = [
  { name: "Admin Guide", slug: "admin-guide" },
  { name: "User Guide (Complete)", slug: "user-guide-complete" },
  { name: "Contributor Guide", slug: "contributor-guide" },
  { name: "API Reference", slug: "api-reference" },
  { name: "Architecture Overview", slug: "architecture-overview" },
  { name: "Quick Reference Cards", slug: "Quick-Reference-Cards" },
  { name: "Quiz & Assessment", slug: "Quiz-Assessment" },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader title="Knowledge Modules" subtitle="18 FROOT modules across 5 layers — from tokens to production agents. Click any module to read." />

      {/* FROOT layers */}
      <div className="space-y-6 mb-14">
        {layers.map((layer) => (
          <FadeIn key={layer.id}>
            <div className="rounded-xl border border-border bg-bg-surface overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border-subtle">
                <layer.Icon className="h-5 w-5" style={{ color: layer.color }} />
                <span className="font-bold text-[14px]" style={{ color: layer.color }}>{layer.id} — {layer.title}</span>
                <span className="ml-auto text-[11px] text-fg-dim">{layer.modules.length} modules</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border-subtle">
                {layer.modules.map((m) => (
                  <Link key={m.id} href={`/docs/${m.slug}`}
                    className="flex items-center justify-between px-5 py-3 bg-bg-surface hover:bg-bg-elevated transition-colors group">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider mr-2" style={{ color: layer.color }}>{m.id}</span>
                      <span className="text-[13px] font-medium text-fg group-hover:text-fg">{m.name}</span>
                    </div>
                    <span className="text-[11px] text-fg-dim">{m.size}</span>
                  </Link>
                ))}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* Extra docs */}
      <FadeIn>
        <h2 className="flex items-center gap-2 text-lg font-bold mb-4"><ClipboardList className="h-5 w-5 text-indigo" /> Guides & References</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-14">
          {extras.map((e) => (
            <Link key={e.slug} href={`/docs/${e.slug}`}
              className="rounded-xl border border-border bg-bg-surface px-4 py-3 text-[13px] font-medium text-fg-muted hover:text-fg hover:bg-bg-elevated hover:border-indigo/20 transition-all">
              {e.name} →
            </Link>
          ))}
        </div>
      </FadeIn>

      <div className="flex flex-wrap justify-center gap-2">
        <GlowPill href="/packages" color="#8b5cf6">Download Packages</GlowPill>
        <GlowPill href="/learning-hub" color="#f97316">Learning Hub</GlowPill>
        <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
