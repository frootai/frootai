"use client";

import Link from "next/link";
import { Monitor, Package, Zap, Container, Puzzle, Terminal, Download, ArrowRight, Check, Layers, Box, Wrench, Sliders, Ruler, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { GlowPill } from "@/components/ui/glow-pill";

/* ═══ PACKAGE CHANNELS ═══ */
const packages: { Icon: LucideIcon; title: string; sub: string; install: string; color: string; href: string; features: string[] }[] = [
  {
    Icon: Monitor, title: "VS Code Extension", sub: "Rich sidebar UI with 16 commands",
    install: "Install from VS Code Marketplace", color: "#6366f1", href: "/vscode-extension",
    features: ["Sidebar panels for all 20 plays", "Inline knowledge search", "Offline-capable", "Solution Configurator wizard"],
  },
  {
    Icon: Package, title: "MCP Server (npm)", sub: "AI agent tools via Model Context Protocol",
    install: "npx @anthropic/mcp install frootai-mcp", color: "#10b981", href: "/mcp-tooling",
    features: ["22 tools for any MCP-compatible agent", "Knowledge search & retrieval", "Architecture pattern advisor", "Works with Claude, GPT, Gemini"],
  },
  {
    Icon: Container, title: "Docker Image", sub: "Multi-arch container, Kubernetes-ready",
    install: "docker pull ghcr.io/gitpavleenbali/frootai-mcp", color: "#06b6d4", href: "/docker",
    features: ["Linux/ARM64/AMD64", "Kubernetes & ACA deployments", "Health endpoint included", "Auto-updates via CI/CD"],
  },
  {
    Icon: Terminal, title: "CLI (npx frootai)", sub: "Terminal-first scaffolding & search",
    install: "npx frootai", color: "#f59e0b", href: "/cli",
    features: ["8 commands for scaffolding", "Full knowledge search", "Play initialization", "Works offline after first run"],
  },
  {
    Icon: Puzzle, title: "Plugin Marketplace", sub: "Community extensions & integrations",
    install: "Browse marketplace", color: "#ec4899", href: "/marketplace",
    features: ["ServiceNow connector", "Salesforce integration", "SAP adapter", "Community-contributed plugins"],
  },
];

/* ═══ TOOLKIT KITS ═══ */
const kits = [
  { Icon: Wrench, title: "DevKit", sub: "Architecture templates, Bicep modules, deployment scripts", color: "#6366f1", label: "Box 1" },
  { Icon: Sliders, title: "TuneKit", sub: "Evaluation configs, prompt templates, tuning parameters", color: "#7c3aed", label: "Box 2" },
  { Icon: Ruler, title: "SpecKit", sub: "Feature specs, architecture decision records, compliance checklists", color: "#06b6d4", label: "Box 3" },
];

export default function PackagesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      {/* ═══ HERO ═══ */}
      <FadeIn>
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald/25 bg-emerald/[0.04] mb-4">
            <Package className="h-4 w-4 text-emerald" />
            <span className="text-[11px] font-bold text-emerald uppercase tracking-wider">Layer 2 — Distribution</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
            <span className="text-white">FAI</span> <span className="text-emerald">Packages</span>
          </h1>
          <p className="text-[14px] text-fg-muted max-w-2xl mx-auto leading-relaxed">
            Install once, get everything. Every FAI Package delivers the complete <strong className="text-fg">FAI Toolkit</strong> — DevKit, TuneKit, and SpecKit — through the channel you prefer.
          </p>
        </div>
      </FadeIn>

      {/* ═══ HOW IT WORKS ═══ */}
      <FadeIn delay={0.05}>
        <div className="rounded-2xl border border-border-subtle bg-bg-surface/40 p-6 mb-10">
          <h2 className="text-lg font-bold text-center mb-4">How FAI Packages Work</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald/10 border border-emerald/20 flex items-center justify-center">
                <Download className="h-5 w-5 text-emerald" />
              </div>
              <div className="text-left">
                <div className="text-[12px] font-bold text-fg">1. Pick a Channel</div>
                <div className="text-[11px] text-fg-muted">VS Code, npm, Docker, CLI</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-fg-dim hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-indigo/10 border border-indigo/20 flex items-center justify-center">
                <Layers className="h-5 w-5 text-indigo" />
              </div>
              <div className="text-left">
                <div className="text-[12px] font-bold text-fg">2. Get Full Toolkit</div>
                <div className="text-[11px] text-fg-muted">DevKit + TuneKit + SpecKit</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-fg-dim hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-violet/10 border border-violet/20 flex items-center justify-center">
                <Box className="h-5 w-5 text-violet" />
              </div>
              <div className="text-left">
                <div className="text-[12px] font-bold text-fg">3. Build with Plays</div>
                <div className="text-[11px] text-fg-muted">20 solution accelerators</div>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* ═══ PACKAGE CARDS ═══ */}
      <FadeIn delay={0.1}>
        <h2 className="text-xl font-bold text-center mb-6">Distribution Channels</h2>
      </FadeIn>
      <StaggerChildren className="space-y-4 mb-12">
        {packages.map((pkg) => (
          <StaggerItem key={pkg.title}>
            <div className="glow-card rounded-2xl p-5 sm:p-6" style={{ "--glow": pkg.color } as React.CSSProperties}>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${pkg.color}15`, border: `1px solid ${pkg.color}30` }}>
                    <pkg.Icon className="h-5 w-5" style={{ color: pkg.color }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-[15px] text-fg">{pkg.title}</h3>
                    <p className="text-[12px] text-fg-muted mt-0.5">{pkg.sub}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {pkg.features.map((f) => (
                        <div key={f} className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                          <Check className="h-3 w-3 shrink-0" style={{ color: pkg.color }} />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start sm:items-end justify-between gap-2 shrink-0">
                  <code className="text-[10px] text-fg-dim bg-bg/60 px-2 py-1 rounded font-mono">{pkg.install}</code>
                  <Link href={pkg.href} className="text-[12px] font-semibold hover:underline" style={{ color: pkg.color }}>
                    Learn more →
                  </Link>
                </div>
              </div>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>

      {/* ═══ WHAT'S INSIDE ═══ */}
      <FadeIn delay={0.15}>
        <div className="rounded-2xl border border-indigo/15 bg-gradient-to-br from-indigo/[0.03] to-violet/[0.02] p-6 mb-10">
          <h2 className="text-lg font-bold text-center mb-1">What Ships Inside Every Package</h2>
          <p className="text-[12px] text-fg-dim text-center mb-5">The FAI Toolkit — three composable kits that power every solution play</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {kits.map((kit) => (
              <div key={kit.title} className="glow-card rounded-xl p-4 text-center" style={{ "--glow": kit.color } as React.CSSProperties}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: kit.color }}>{kit.label}</div>
                <kit.Icon className="h-6 w-6 mx-auto mb-2" style={{ color: kit.color }} />
                <div className="font-bold text-[13px] text-fg">{kit.title}</div>
                <div className="text-[11px] text-fg-muted mt-1 leading-relaxed">{kit.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* ═══ CTA ═══ */}
      <FadeIn delay={0.2}>
        <div className="text-center">
          <p className="text-[13px] text-fg-muted mb-4">Ready to get started?</p>
          <div className="flex flex-wrap justify-center gap-2">
            <GlowPill href="/setup-guide" color="#10b981">Setup Guide</GlowPill>
            <GlowPill href="/ecosystem" color="#6366f1">FAI Ecosystem</GlowPill>
            <GlowPill href="/solution-plays" color="#7c3aed">Solution Plays</GlowPill>
            <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
