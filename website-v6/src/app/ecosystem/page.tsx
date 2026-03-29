"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Puzzle, Package, Monitor, Zap, Wrench, Sliders, Ruler, Link2, Eye, Microscope, Box, Factory, Brain, Layers, ChevronRight, type LucideIcon } from "lucide-react";
import { GlowPill } from "@/components/ui/glow-pill";
import { FadeIn } from "@/components/motion/fade-in";

/* ═══ DATA ═══ */

const channels = [
  { Icon: Monitor, title: "VS Code Extension", sub: "Sidebar panels, 16 commands, offline", color: "#6366f1", href: "/vscode-extension" },
  { Icon: Package, title: "MCP Server (npm)", sub: "22 tools for your AI agent", color: "#10b981", href: "/mcp-tooling" },
  { Icon: Zap, title: "Docker Image", sub: "Multi-arch, Kubernetes-ready", color: "#06b6d4", href: "/docker" },
  { Icon: Zap, title: "CLI (npx frootai)", sub: "8 commands, scaffolding, search", color: "#f59e0b", href: "/cli" },
  { Icon: Puzzle, title: "Marketplace", sub: "Discover & share plugins", color: "#ec4899", href: "/marketplace" },
];

export default function EcosystemPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      {/* ═══ HEADER ═══ */}
      <FadeIn>
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img src="/img/frootai-mark.svg" alt="" className="h-7 w-7" />
            <h1 className="text-3xl font-extrabold tracking-tight">
              F<span className="text-emerald">AI</span> Ecosystem
            </h1>
          </div>
          <div className="mx-auto max-w-xl rounded-2xl border border-emerald/20 bg-gradient-to-br from-emerald/[0.04] to-indigo/[0.02] px-6 py-4">
            <p className="text-[13px] text-fg/60 leading-relaxed italic text-center">
              &ldquo;The living system behind every play — Factory builds, Toolkit equips, Packages deliver.&rdquo;
            </p>
          </div>
        </div>
      </FadeIn>

      {/* ═══ FROOT TOOLKIT ═══ */}
      <FadeIn delay={0.1}>
        <div className="mb-6 rounded-2xl border-2 border-indigo/20 p-6" style={{ background: "#6366f108" }}>
          <div className="flex items-center gap-2 justify-center mb-4">
            <Box className="h-5 w-5 text-indigo" />
            <h2 className="font-extrabold text-[16px] text-fg">FROOT Toolkit</h2>
            <span className="text-[11px] text-fg/55 italic ml-1">Layer 3 — composable kits: build, tune, architect</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="rounded-xl border border-cyan/20 bg-cyan/[0.03] p-5 text-center">
              <div className="text-[9px] font-bold text-cyan mb-2">Box 1</div>
              <Wrench className="h-6 w-6 mx-auto mb-2 text-cyan" />
              <div className="font-bold text-[14px] text-fg mb-2">DevKit</div>
              <div className="text-[11px] text-fg/55 leading-relaxed text-left">
                Your AI co-coder. <span className="font-semibold text-fg/70">agent.md</span> gives Copilot solution context, <span className="font-semibold text-fg/70">infra/</span> deploys Bicep, <span className="font-semibold text-fg/70">MCP tools</span> extend your agent, <span className="font-semibold text-fg/70">plugins</span> add custom functions.
              </div>
            </div>
            <div className="rounded-xl border border-violet/20 bg-violet/[0.03] p-5 text-center">
              <div className="text-[9px] font-bold text-violet mb-2">Box 2</div>
              <Sliders className="h-6 w-6 mx-auto mb-2 text-violet" />
              <div className="font-bold text-[14px] text-fg mb-2">TuneKit</div>
              <div className="text-[11px] text-fg/55 leading-relaxed text-left">
                AI config without being a specialist. <span className="font-semibold text-fg/70">config/*.json</span> controls temperature, top-k, models. <span className="font-semibold text-fg/70">evaluation/</span> scores quality. Ship with confidence.
              </div>
            </div>
            <div className="rounded-xl border border-amber/20 bg-amber/[0.03] p-5 text-center">
              <div className="text-[9px] font-bold text-amber mb-2">Box 3</div>
              <Ruler className="h-6 w-6 mx-auto mb-2 text-amber" />
              <div className="font-bold text-[14px] text-fg mb-2">SpecKit</div>
              <div className="text-[11px] text-fg/55 leading-relaxed text-left">
                Architecture blueprint. <span className="font-semibold text-fg/70">play-spec.json</span> defines components, WAF alignment across all 6 pillars, and evaluation thresholds for production.
              </div>
            </div>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-fg/50 italic"><Brain className="h-3 w-3 inline mr-0.5 text-indigo/60" />Agentic OS (.github) — instructions · agents · skills · hooks · workflows — woven into every kit</span>
          </div>
        </div>
      </FadeIn>

      {/* ═══ FROOT PACKAGES ═══ */}
      <FadeIn delay={0.15}>
        <div className="mb-6 rounded-2xl border-2 border-emerald/20 p-6" style={{ background: "#10b98108" }}>
          <div className="flex items-center gap-2 justify-center mb-3">
            <Package className="h-5 w-5 text-emerald" />
            <h2 className="font-extrabold text-[16px] text-fg">FROOT Packages</h2>
            <span className="text-[11px] text-fg/55 italic ml-1">Layer 2 — install once, every kit arrives</span>
          </div>
          <p className="text-[11px] text-fg/55 text-center mb-4 leading-relaxed max-w-lg mx-auto">
            Every FROOT Package delivers the full Toolkit — DevKit, TuneKit, and SpecKit — through the channel you prefer. Install one package, get all three kits.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {channels.map((c) => (
              <Link key={c.title} href={c.href} className="glow-card rounded-xl p-3 text-center" style={{ "--glow": c.color } as React.CSSProperties}>
                <c.Icon className="h-5 w-5 mx-auto mb-1.5" style={{ color: c.color }} />
                <div className="font-bold text-[11px] text-fg">{c.title}</div>
                <div className="text-[9px] text-fg/45 mt-0.5">{c.sub}</div>
              </Link>
            ))}
          </div>
          <div className="text-center">
            <Link href="/setup-guide" className="glow-card inline-block rounded-lg px-4 py-1.5 text-[11px] text-emerald font-semibold" style={{ "--glow": "#10b981" } as React.CSSProperties}>Setup Guide →</Link>
          </div>
        </div>
      </FadeIn>

      {/* ═══ FROOT FACTORY ═══ */}
      <FadeIn delay={0.2}>
        <div className="mb-10 rounded-2xl border-2 border-amber/20 p-6" style={{ background: "#f59e0b08" }}>
          <div className="flex items-center gap-2 justify-center mb-3">
            <Factory className="h-5 w-5 text-amber" />
            <h2 className="font-extrabold text-[16px] text-fg">FROOT Factory</h2>
            <span className="text-[11px] text-fg/55 italic ml-1">Layer 1 — the production engine</span>
          </div>
          <p className="text-[11px] text-fg/55 text-center leading-relaxed max-w-lg mx-auto">
            Where raw ideas become production AI — assembles Agentic OS primitives into a coherent system. You don&apos;t just get templates. You get the machine that makes them.
          </p>
        </div>
      </FadeIn>

      {/* ═══ SOLUTION PLAYS CTA ═══ */}
      <FadeIn delay={0.25}>
        <div className="mb-10 rounded-2xl border border-emerald/15 bg-gradient-to-br from-emerald/[0.03] to-indigo/[0.02] p-6 text-center">
          <Layers className="h-6 w-6 mx-auto mb-2 text-emerald" />
          <h2 className="font-extrabold text-[15px] text-fg mb-2">Solution Plays</h2>
          <p className="text-[11px] text-fg/50 mb-4 max-w-md mx-auto">
            Production-ready blueprints assembled by the FAI Ecosystem. Each play ships with the full FROOT stack — or pick any kit individually.
          </p>
          <GlowPill href="/solution-plays" color="#10b981">Explore Solution Plays →</GlowPill>
        </div>
      </FadeIn>

      {/* ═══ CLOSING ═══ */}
      <div className="text-center mb-8">
        <p className="text-[10px] text-fg/50">Powered by the <span className="font-bold text-emerald/70">FAI Ecosystem</span></p>
        <p className="text-[10px] text-fg/40 mt-1 leading-relaxed max-w-md mx-auto">
          These plays are examples — not limits. The same Toolkit, Packages, and Factory that built them are yours to remix, extend, or use to create entirely new solutions.
        </p>
      </div>

      {/* Bottom nav */}
      <div className="flex flex-wrap justify-center gap-2">
        <GlowPill href="/solution-plays" color="#7c3aed">Solution Plays</GlowPill>
        <GlowPill href="/configurator" color="#f59e0b">Configurator</GlowPill>
        <GlowPill href="/setup-guide" color="#f97316">Setup Guide</GlowPill>
        <GlowPill href="/chatbot" color="#d4a853">Ask Agent FAI</GlowPill>
        <GlowPill href="/" color="#10b981">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
