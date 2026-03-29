"use client";

import Link from "next/link";
import { ChevronLeft, ExternalLink, Wrench, Sliders, DollarSign, GitBranch, Layers, Cpu } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { GlowPill } from "@/components/ui/glow-pill";
import { getPlayBySlug } from "./play-data";

export function PlayPageClient({ slug }: { slug: string }) {
  const play = getPlayBySlug(slug)!;
  const Icon = play.Icon;
  return (
    <div className="mx-auto max-w-3xl px-4 lg:px-6 py-12 sm:py-16">
      {/* Back link */}
      <FadeIn>
        <Link href="/solution-plays" className="inline-flex items-center gap-1 text-[12px] text-fg-dim hover:text-emerald transition-colors mb-8">
          <ChevronLeft className="h-3.5 w-3.5" /> All Solution Plays
        </Link>
      </FadeIn>

      {/* Header */}
      <FadeIn delay={0.05}>
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl border border-border" style={{ background: `${play.color}10` }}>
            <Icon className="h-6 w-6" style={{ color: play.color }} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-fg-dim">Play {play.id}</p>
            <h1 className="text-2xl font-extrabold tracking-tight">{play.name}</h1>
          </div>
        </div>
      </FadeIn>

      {/* Meta pills */}
      <FadeIn delay={0.1}>
        <div className="flex flex-wrap gap-2 mt-4 mb-6">
          <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold border border-border bg-bg-surface">
            <Layers className="h-3 w-3" style={{ color: play.color }} /> {play.complexity}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold border border-border bg-bg-surface">
            {play.status === "Ready" ? "✅" : "🔧"} {play.status}
          </span>
        </div>
      </FadeIn>

      {/* Tagline */}
      <FadeIn delay={0.12}>
        <p className="text-[15px] font-semibold text-fg mb-2">{play.tagline}</p>
        <p className="text-[13px] text-fg-muted leading-relaxed mb-8">{play.description}</p>
      </FadeIn>

      {/* Architecture Pattern */}
      <FadeIn delay={0.15}>
        <div className="rounded-xl border border-border bg-bg-surface/50 p-5 mb-6">
          <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-fg-dim mb-3">
            <Cpu className="h-4 w-4" style={{ color: play.color }} /> Architecture Pattern
          </h2>
          <p className="text-[13px] text-fg-muted">{play.pattern}</p>
        </div>
      </FadeIn>

      {/* Azure Services */}
      <FadeIn delay={0.18}>
        <div className="rounded-xl border border-border bg-bg-surface/50 p-5 mb-6">
          <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-fg-dim mb-3">
            <Layers className="h-4 w-4 text-cyan" /> Azure Services
          </h2>
          <div className="flex flex-wrap gap-2">
            {play.services.map((s) => (
              <span key={s} className="glow-chip px-3 py-1.5 text-[12px] text-fg-muted" style={{ "--glow": play.color } as React.CSSProperties}>{s}</span>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* DevKit */}
      <FadeIn delay={0.2}>
        <div className="rounded-xl border border-border bg-bg-surface/50 p-5 mb-6">
          <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-fg-dim mb-3">
            <Wrench className="h-4 w-4 text-emerald" /> DevKit (.github Agentic OS)
          </h2>
          <ul className="space-y-1.5">
            {play.devkit.map((d) => (
              <li key={d} className="text-[12px] text-fg-muted pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-emerald before:font-bold">{d}</li>
            ))}
          </ul>
        </div>
      </FadeIn>

      {/* TuneKit */}
      <FadeIn delay={0.22}>
        <div className="rounded-xl border border-border bg-bg-surface/50 p-5 mb-6">
          <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-fg-dim mb-3">
            <Sliders className="h-4 w-4 text-amber" /> TuneKit (AI Config)
          </h2>
          <ul className="space-y-1.5">
            {play.tunekit.map((t) => (
              <li key={t} className="text-[12px] text-fg-muted pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-amber before:font-bold">{t}</li>
            ))}
          </ul>
        </div>
      </FadeIn>

      {/* Tuning Parameters */}
      <FadeIn delay={0.24}>
        <div className="rounded-xl border border-border bg-bg-surface/50 p-5 mb-6">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-fg-dim mb-3">Tuning Parameters</h2>
          <div className="flex flex-wrap gap-2">
            {play.tuningParams.map((p) => (
              <span key={p} className="rounded-lg bg-bg-elevated px-3 py-1 text-[11px] text-fg-muted border border-border">{p}</span>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Cost */}
      <FadeIn delay={0.26}>
        <div className="rounded-xl border border-border bg-bg-surface/50 p-5 mb-8">
          <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-fg-dim mb-3">
            <DollarSign className="h-4 w-4 text-green" /> Estimated Cost
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-fg-dim uppercase tracking-wider">Dev/Test</p>
              <p className="text-[15px] font-bold text-emerald">{play.costDev}</p>
            </div>
            <div>
              <p className="text-[10px] text-fg-dim uppercase tracking-wider">Production</p>
              <p className="text-[15px] font-bold text-fg">{play.costProd}</p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Bottom CTAs */}
      <FadeIn delay={0.28}>
        <div className="flex flex-wrap justify-center gap-2">
          <GlowPill href={`/user-guide?play=${play.id}`} color="#10b981">User Guide</GlowPill>
          <GlowPill href="/setup-guide" color="#f59e0b">Setup Guide</GlowPill>
          <GlowPill href={`https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/${play.github}`} color="#6366f1">
            <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" /> GitHub</span>
          </GlowPill>
          <GlowPill href="/configurator" color="#7c3aed">Configurator</GlowPill>
          <GlowPill href="/chatbot" color="#d4a853">Ask Agent FAI</GlowPill>
          <GlowPill href="/" color="#10b981">Back to FrootAI</GlowPill>
        </div>
      </FadeIn>
    </div>
  );
}
