"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Settings, Target, Monitor, Package, Store, Handshake, Puzzle, BookOpen, Wrench, Leaf, Sprout, TreePine, Layers, Cloud, Apple, Rocket, Bot, Building2, Landmark, Crosshair, BarChart3, Moon, Shield, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { Card } from "@/components/ui/card";
import { GlowPill } from "@/components/ui/glow-pill";

/* ═══════════════════════════════════════════════════════════════════
   DATA — extracted from production website/src/pages/index.tsx
   ═══════════════════════════════════════════════════════════════════ */

const ecosystemCards = [
  { href: "/configurator", Icon: Settings, title: "Solution Configurator", sub: "3 questions → your play", color: "#f59e0b" },
  { href: "/solution-plays", Icon: Target, title: "Solution Plays", sub: "20 plays · DevKit + TuneKit", color: "#7c3aed" },
  { href: "/vscode-extension", Icon: Monitor, title: "VS Code Extension", sub: "16 commands · Standalone", color: "#6366f1" },
  { href: "/mcp-tooling", Icon: Package, title: "MCP Server (npm)", sub: "22 tools for your agent", color: "#10b981" },
  { href: "/marketplace", Icon: Store, title: "Plugin Marketplace", sub: "Discover & share plugins", color: "#ec4899" },
  { href: "/partners", Icon: Handshake, title: "Partner Integrations", sub: "ServiceNow, Salesforce, SAP", color: "#06b6d4" },
  { href: "/packages", Icon: Puzzle, title: "FROOT Packages", sub: "Downloadable LEGO blocks", color: "#8b5cf6" },
  { href: "/learning-hub", Icon: BookOpen, title: "FAI Learning Hub", sub: "18 modules · Glossary · Workshops", color: "#f97316" },
  { href: "/dev-hub", Icon: Wrench, title: "FAI Developer Hub", sub: "API ref · Changelog · Guides", color: "#0ea5e9" },
  { href: "/community", Icon: Leaf, title: "100% Open Source", sub: "MIT License — Star on GitHub", color: "#00c853" },
];

const stats = [
  { num: "18+", label: "Modules", color: "#10b981" },
  { num: "20", label: "Solution Plays", color: "#06b6d4" },
  { num: "22", label: "MCP Tools", color: "#6366f1" },
  { num: "200+", label: "AI Terms", color: "#7c3aed" },
];

const layers = [
  { id: "F", Icon: Sprout, title: "Foundations", color: "#f59e0b", modules: [
    { id: "F1", name: "GenAI Foundations", link: "/docs/GenAI-Foundations" },
    { id: "F2", name: "LLM Landscape", link: "/docs/LLM-Landscape" },
    { id: "F3", name: "AI Glossary A–Z", link: "/docs/F3-AI-Glossary-AZ" },
    { id: "F4", name: ".github Agentic OS", link: "/docs/F4-GitHub-Agentic-OS" },
  ]},
  { id: "R", Icon: TreePine, title: "Reasoning", color: "#10b981", modules: [
    { id: "R1", name: "Prompt Engineering", link: "/docs/Prompt-Engineering" },
    { id: "R2", name: "RAG Architecture", link: "/docs/RAG-Architecture" },
    { id: "R3", name: "Deterministic AI", link: "/docs/R3-Deterministic-AI" },
  ]},
  { id: "O¹", Icon: Layers, title: "Orchestration", color: "#06b6d4", modules: [
    { id: "O1", name: "Semantic Kernel", link: "/docs/Semantic-Kernel" },
    { id: "O2", name: "AI Agents", link: "/docs/AI-Agents-Deep-Dive" },
    { id: "O3", name: "MCP & Tools", link: "/docs/O3-MCP-Tools-Functions" },
  ]},
  { id: "O²", Icon: Cloud, title: "Operations", color: "#6366f1", modules: [
    { id: "O4", name: "Azure AI Platform", link: "/docs/Azure-AI-Foundry" },
    { id: "O5", name: "AI Infrastructure", link: "/docs/AI-Infrastructure" },
    { id: "O6", name: "Copilot Ecosystem", link: "/docs/Copilot-Ecosystem" },
  ]},
  { id: "T", Icon: Apple, title: "Transformation", color: "#7c3aed", modules: [
    { id: "T1", name: "Fine-Tuning", link: "/docs/T1-Fine-Tuning-MLOps" },
    { id: "T2", name: "Responsible AI", link: "/docs/Responsible-AI-Safety" },
    { id: "T3", name: "Production Patterns", link: "/docs/T3-Production-Patterns" },
  ]},
];

const outcomes = [
  { Icon: Rocket, title: "New to AI?", desc: "Build AI literacy from zero" },
  { Icon: Bot, title: "Build Agents", desc: "MCP, SK, Agent Framework" },
  { Icon: Building2, title: "AI Infra Expert", desc: "Landing zones, GPU, hosting" },
  { Icon: Landmark, title: "Solution Accelerator", desc: "Azure Verified Modules + Bicep" },
  { Icon: Crosshair, title: "Full-Stack Agentic", desc: ".github Agentic OS · 7 primitives" },
  { Icon: BarChart3, title: "AI Cost Optimization", desc: "FinOps, caching, model selection" },
  { Icon: Moon, title: "Fine-Tuning Pro", desc: "LoRA, evaluation, MLOps" },
  { Icon: Shield, title: "Reliable AI", desc: "Determinism, guardrails, safety" },
];

const ctaLinks = [
  { label: "Solution Configurator", href: "/configurator", color: "#f59e0b" },
  { label: "Solution Plays", href: "/solution-plays", color: "#7c3aed" },
  { label: "FROOT Packages", href: "/packages", color: "#8b5cf6" },
  { label: "Ecosystem Overview", href: "/ecosystem", color: "#0ea5e9" },
  { label: "VS Code Extension", href: "/vscode-extension", color: "#6366f1" },
  { label: "MCP Server", href: "/mcp-tooling", color: "#10b981" },
  { label: "Setup Guide", href: "/setup-guide", color: "#14b8a6" },
  { label: "Plugin Marketplace", href: "/marketplace", color: "#ec4899" },
  { label: "Open Source Community", href: "/community", color: "#00c853" },
  { label: "FrootAI Adoption", href: "/adoption", color: "#f43f5e" },
  { label: "FAI Learning Hub", href: "/learning-hub", color: "#f97316" },
  { label: "FAI Developer Hub", href: "/dev-hub", color: "#0ea5e9" },
  { label: "Agent FAI", href: "/chatbot", color: "#f59e0b" },
  { label: "Star on GitHub", href: "https://github.com/gitpavleenbali/frootai", color: "#eab308" },
];

/* ═══ EXPANDABLE LAYER ═══ */

function ExpandableLayer({ layer }: { layer: typeof layers[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glow-card overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left cursor-pointer">
        <layer.Icon className="h-5 w-5" style={{ color: layer.color }} />
        <span className="font-bold text-[13px]" style={{ color: layer.color }}>
          {layer.id} — {layer.title}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-fg-muted">
          {layer.modules.length} modules
          <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="flex gap-2 px-5 pb-4 flex-wrap">
              {layer.modules.map((m) => (
                <Link key={m.id} href={m.link}
                  className="glow-chip px-3 py-1.5 text-[12px] font-medium"
                  style={{ color: layer.color }}>
                  {m.id}: {m.name} →
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══ PAGE ═══ */

export default function Home() {
  return (
    <>
      {/* ═══ 1. HERO ═══ */}
      <section className="relative flex min-h-[60vh] items-center justify-center overflow-hidden pt-4 pb-4">
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(var(--fg) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <FadeIn>
            <div className="animate-float mx-auto mb-[-48px]">
              <Image src="/img/frootai-logo.png" alt="FrootAI" width={300} height={300} priority
                className="mx-auto" />
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 className="text-5xl font-extrabold tracking-tighter sm:text-6xl lg:text-7xl text-gradient-froot">FrootAI</h1>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.15em] text-emerald">From the Roots to the Fruits</p>
            <p className="mt-1 text-sm italic text-gold">It&apos;s simply Frootful.</p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="mt-4 text-[12px] tracking-[0.2em] text-fg-muted">Infra ⇄ Platform ⇄ Apps</p>
          </FadeIn>
          <FadeIn delay={0.25}>
            <p className="mt-3 text-[14px] font-semibold text-fg-muted">
              AI <span className="font-bold text-amber">F</span>oundations · <span className="font-bold text-emerald">R</span>easoning · <span className="font-bold text-cyan">O</span>rchestration · <span className="font-bold text-indigo">O</span>perations · <span className="font-bold text-violet">T</span>ransformation
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-emerald/20 bg-gradient-to-br from-emerald/[0.04] to-indigo/[0.02] px-6 py-4">
              <p className="text-[13px] leading-relaxed text-fg-muted italic text-center">
                &ldquo;An open ecosystem where Infra, Platform, and App teams converge to build AI Frootfully.&rdquo;
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ DIVIDER ═══ */}
      <div className="relative py-2">
        <div className="mx-auto max-w-4xl px-8">
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 lg:px-6 pb-24 space-y-10">
        {/* ═══ 2. ECOSYSTEM GRID ═══ */}
        <section>
          <FadeIn><h2 className="text-2xl font-bold text-center tracking-tight mb-1">FAI Ecosystem</h2>
            <p className="text-[12px] text-fg-dim text-center italic mb-8">Click on the cards to explore more</p></FadeIn>
          <StaggerChildren className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {ecosystemCards.map((c) => (
              <StaggerItem key={c.title}>
                <Link href={c.href} className="glow-card group block p-4 text-center h-full" style={{ "--glow": c.color } as React.CSSProperties}>
                  <c.Icon className="h-6 w-6 mx-auto mb-2 transition-transform duration-200 group-hover:scale-110" style={{ color: c.color }} />
                  <div className="font-bold text-[13px] text-fg">{c.title}</div>
                  <div className="text-[11px] mt-1" style={{ color: c.color }}>{c.sub}</div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerChildren>
        </section>

        {/* ═══ 3. STATS BAR ═══ */}
        <FadeIn>
          <div className="flex justify-center gap-10 sm:gap-16 flex-wrap">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-extrabold tabular-nums" style={{ color: s.color }}>{s.num}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-fg-dim">{s.label}</div>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* ═══ 4. FROOT FRAMEWORK ═══ */}
        <div className="mx-auto max-w-4xl px-8"><div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" /></div>
        <section>
          <FadeIn><h2 className="text-2xl font-bold text-center tracking-tight mb-1">The FROOT Framework</h2>
            <p className="text-[12px] text-fg-dim text-center italic mb-8">Click to expand, then click modules to learn</p></FadeIn>
          <div className="space-y-2.5 max-w-2xl mx-auto">
            {layers.map((l, i) => (<FadeIn key={l.id} delay={i * 0.06}><ExpandableLayer layer={l} /></FadeIn>))}
          </div>
        </section>

        {/* ═══ 5. OUTCOMES GRID ═══ */}
        <div className="mx-auto max-w-4xl px-8"><div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" /></div>
        <section>
          <FadeIn><h2 className="text-2xl font-bold text-center tracking-tight mb-8">What These Help You Achieve</h2></FadeIn>
          <StaggerChildren className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {outcomes.map((o) => (
              <StaggerItem key={o.title}>
                <div className="rounded-2xl border border-border bg-bg-surface p-5 text-center">
                  <o.Icon className="h-6 w-6 mx-auto mb-2 text-indigo" />
                  <div className="font-bold text-[13px]">{o.title}</div>
                  <div className="text-[11px] text-fg-muted mt-0.5">{o.desc}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerChildren>
        </section>

        {/* ═══ 6. CTA SECTION ═══ */}
        <div className="mx-auto max-w-4xl px-8"><div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" /></div>
        <section>
          <FadeIn>
            <h2 className="text-2xl font-bold text-center tracking-tight mb-2">
              FAI Universe
            </h2>
            <p className="text-[13px] text-fg-muted text-center max-w-2xl mx-auto mb-6">
              The open glue that binds Infra, Platform, and App teams into one Agentic AI ecosystem.
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="mx-auto max-w-3xl rounded-2xl border border-emerald/20 bg-gradient-to-br from-emerald/[0.04] to-indigo/[0.02] px-6 py-6">
              <div className="flex flex-wrap justify-center gap-2">
                {ctaLinks.map((l) => (
                  <GlowPill key={l.href} href={l.href} color={l.color} external={l.href.startsWith("http")}>{l.label}</GlowPill>
                ))}
              </div>
            </div>
          </FadeIn>
        </section>
      </div>
    </>
  );
}
