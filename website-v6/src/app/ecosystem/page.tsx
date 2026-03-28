import type { Metadata } from "next";
import Link from "next/link";
import { Target, Puzzle, Package, Monitor, Container, Zap, Wrench, Sliders, Ruler, Link2, Eye, Microscope, type LucideIcon } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { GlowPill } from "@/components/ui/glow-pill";
import { FadeIn } from "@/components/motion/fade-in";

export const metadata: Metadata = {
  title: "Ecosystem",
  description: "The FrootAI Ecosystem — VS Code Extension, MCP Server, Solution Plays, FROOT Packages.",
};

/* ═══ DATA — from production ecosystem.tsx ═══ */

const telescope = [
  { Icon: Target, title: "Solution Plays", sub: "20 pre-tuned deployable AI solutions", color: "#7c3aed", href: "/solution-plays",
    features: ["DevKit — empowers your co-coder before coding", "TuneKit — fine-tunes AI before shipping", "SpecKit — architecture specs + WAF alignment", "Infra blueprints + agent.md + config + evaluation"] },
  { Icon: Puzzle, title: "FROOT Packages", sub: "Downloadable LEGO blocks", color: "#06b6d4", href: "/packages",
    features: ["Knowledge modules by FROOT layer", "MCP tools bundled in npm package", "DevKit packs per solution play", "TuneKit packs (config + eval scripts)"] },
];

const microscope = [
  { Icon: Package, title: "MCP Server (npm)", sub: "For your AI agent", color: "#10b981", href: "/mcp-tooling",
    features: ["22 tools called automatically by Copilot/Claude/Cursor", "lookup_term → 200+ precise definitions", "search_knowledge → answers across 18 modules", "get_architecture_pattern → 7 decision guides", "90% less token burn vs internet search"] },
  { Icon: Monitor, title: "VS Code Extension", sub: "For you (the human)", color: "#6366f1", href: "/vscode-extension",
    features: ["Sidebar: 20 solution plays, 18 modules, 22 MCP tools", "Search 200+ AI terms instantly", "Init DevKit → copies .github Agentic OS (19 files)", "16 commands via Ctrl+Shift+P", "Cached downloads — works offline"] },
  { Icon: Container, title: "Docker Image", sub: "Run anywhere — zero install", color: "#06b6d4", href: "/docker",
    features: ["Multi-arch: amd64 + arm64 (Apple Silicon)", "Same 22 MCP tools, 682KB knowledge", "Kubernetes-ready sidecar deployment", "Pinnable versions for reproducibility"] },
  { Icon: Zap, title: "CLI (npx frootai)", sub: "Command-line interface", color: "#f59e0b", href: "/cli",
    features: ["8 commands for scaffolding + searching", "Scaffold solution plays from terminal", "Search knowledge base inline", "Cost estimation for plays"] },
];

function EcoCard({ card }: { card: typeof telescope[0] }) {
  return (
    <div className="rounded-2xl border-2 p-6" style={{ borderColor: `color-mix(in srgb, ${card.color} 25%, transparent)`, background: `color-mix(in srgb, ${card.color} 3%, transparent)` }}>
      <div className="flex justify-center mb-2"><card.Icon className="h-8 w-8" style={{ color: card.color }} /></div>
      <h3 className="text-base font-extrabold text-center mb-1">{card.title}</h3>
      <p className="text-[12px] font-semibold text-center mb-4" style={{ color: card.color }}>{card.sub}</p>
      <ul className="text-[13px] leading-relaxed text-fg-muted space-y-1.5 mb-5">
        {card.features.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <div className="text-center">
        <GlowPill href={card.href} color={card.color}>Explore →</GlowPill>
      </div>
    </div>
  );
}

export default function EcosystemPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader
        title="The FrootAI Ecosystem"
        subtitle="Two perspectives. One ecosystem. Everything you need from the big picture to the tiny details."
      />

      {/* Telescope */}
      <FadeIn>
        <section className="mb-14">
          <h2 className="flex items-center gap-2 text-xl font-bold mb-1"><Eye className="h-5 w-5 text-amber" /> Telescope — The Big Picture</h2>
          <p className="text-[13px] text-fg-muted mb-5">Complete solutions and downloadable building blocks</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {telescope.map((c) => <EcoCard key={c.title} card={c} />)}
          </div>
        </section>
      </FadeIn>

      {/* Microscope */}
      <FadeIn delay={0.1}>
        <section className="mb-14">
          <h2 className="flex items-center gap-2 text-xl font-bold mb-1"><Microscope className="h-5 w-5 text-cyan" /> Microscope — The Tiny Details</h2>
          <p className="text-[13px] text-fg-muted mb-5">Tools that integrate into your editor and agent workflow</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {microscope.map((c) => <EcoCard key={c.title} card={c} />)}
          </div>
        </section>
      </FadeIn>

      {/* Bottom nav */}
      <div className="flex flex-wrap justify-center gap-2">
        <GlowPill href="/solution-plays" color="#7c3aed">Solution Plays</GlowPill>
        <GlowPill href="/packages" color="#06b6d4">Packages</GlowPill>
        <GlowPill href="/setup-guide" color="#f97316">Setup Guide</GlowPill>
        <GlowPill href="/chatbot" color="#f59e0b">Agent FAI</GlowPill>
        <GlowPill href="/" color="#10b981">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
