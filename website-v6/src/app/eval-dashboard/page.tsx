import type { Metadata } from "next";
import { Target, Link2, Pen, Shield, DollarSign, Settings, BarChart3, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = { title: "Evaluation Dashboard", description: "FrootAI quality metrics — groundedness, coherence, relevance, fluency, safety, and cost." };

const metrics: { name: string; target: string; desc: string; Icon: LucideIcon; color: string }[] = [
  { name: "Groundedness", target: "≥ 0.95", desc: "% of claims backed by source documents. Measured via citation verification.", Icon: Target, color: "#10b981" },
  { name: "Coherence", target: "≥ 0.90", desc: "Logical flow and consistency of multi-turn responses.", Icon: Link2, color: "#06b6d4" },
  { name: "Relevance", target: "≥ 0.90", desc: "How well the response addresses the user's actual question.", Icon: Target, color: "#6366f1" },
  { name: "Fluency", target: "≥ 0.95", desc: "Grammatical correctness and natural language quality.", Icon: Pen, color: "#7c3aed" },
  { name: "Safety", target: "0 violations", desc: "Content safety score — harmful, hateful, sexual, violent content blocked.", Icon: Shield, color: "#ef4444" },
  { name: "Cost / Query", target: "< $0.01", desc: "Average token cost per query including retrieval + generation.", Icon: DollarSign, color: "#f59e0b" },
];

export default function EvalDashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader
        badge="Quality Metrics"
        badgeColor="#10b981"
        title="Evaluation Dashboard"
        subtitle="Automated quality scoring for every solution play. These metrics run in CI and must pass before any play ships."
      />

      <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
        {metrics.map((m) => (
          <StaggerItem key={m.name}>
            <div className="rounded-2xl border-2 p-5 h-full transition-all duration-300 hover:-translate-y-0.5"
              style={{ borderColor: `color-mix(in srgb, ${m.color} 25%, transparent)`, background: `color-mix(in srgb, ${m.color} 3%, transparent)` }}>
              <div className="mb-2"><m.Icon className="h-6 w-6" style={{ color: m.color }} /></div>
              <h3 className="font-bold text-sm mb-1">{m.name}</h3>
              <div className="text-lg font-extrabold mb-2" style={{ color: m.color }}>{m.target}</div>
              <p className="text-[12px] text-fg-muted leading-relaxed">{m.desc}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>

      {/* Pipeline description */}
      <FadeIn>
        <Card className="mb-14">
          <h2 className="flex items-center gap-2 font-bold text-sm mb-3"><Settings className="h-4 w-4 text-emerald" /> Evaluation Pipeline</h2>
          <ol className="text-[13px] text-fg-muted space-y-2 list-decimal pl-5">
            <li><strong className="text-fg">Test Set</strong> — 50+ question/answer pairs per play, covering edge cases</li>
            <li><strong className="text-fg">Run</strong> — <code className="rounded bg-emerald/10 px-1.5 py-0.5 text-[11px] text-emerald font-mono">python evaluation/eval.py</code> scores each metric</li>
            <li><strong className="text-fg">Gate</strong> — CI blocks deployment if any metric falls below threshold</li>
            <li><strong className="text-fg">Report</strong> — Results saved to <code className="rounded bg-emerald/10 px-1.5 py-0.5 text-[11px] text-emerald font-mono">evaluation/results.json</code></li>
          </ol>
        </Card>
      </FadeIn>

      <div className="flex flex-wrap justify-center gap-2">
        <GlowPill href="/solution-plays" color="#7c3aed">Solution Plays</GlowPill>
        <GlowPill href="/dev-hub" color="#6366f1">Developer Hub</GlowPill>
        <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
