import type { Metadata } from "next";
import { SectionHeader } from "@/components/ui/section-header";
import { GlowPill } from "@/components/ui/glow-pill";
import { FadeIn } from "@/components/motion/fade-in";

export const metadata: Metadata = { title: "Enterprise", description: "FrootAI for enterprise teams — open source, free forever." };

export default function EnterprisePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 py-12 sm:py-16">
      <div className="text-center mb-3">
        <GlowPill href="https://github.com/gitpavleenbali/frootai" color="#eab308" external>Star on GitHub</GlowPill>
      </div>
      <SectionHeader title="Open Source Community" subtitle="Come build the community. Empower each other. Be the open glue for infrastructure, platform, and application teams." />

      <FadeIn>
        <div className="rounded-2xl border-2 border-emerald/25 bg-emerald/[0.02] p-6 sm:p-8 mb-10">
          <h3 className="text-lg font-extrabold text-emerald mb-1">Everything is Free</h3>
          <div className="text-2xl font-extrabold text-emerald mb-4">$0 — Forever</div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-[13px] text-fg-muted list-disc pl-5">
            {["20 Solution Plays", "MCP Server — 22 tools", "VS Code Extension — 16 commands", ".github Agentic OS", "18 Knowledge Modules", "200+ AI Glossary", "Solution Configurator", "Agent FAI", "Workshop Materials", "Community Support"].map(i => <li key={i}>{i}</li>)}
          </ul>
          <div className="text-center mt-5">
            <GlowPill href="/setup-guide" color="#10b981">Get Started Free →</GlowPill>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="text-center">
          <p className="text-sm text-fg-muted mb-4">FrootAI is open source and free for everyone — individuals, startups, and enterprise teams alike.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <GlowPill href="/community" color="#00c853">Community →</GlowPill>
            <GlowPill href="/solution-plays" color="#7c3aed">Solution Plays →</GlowPill>
            <GlowPill href="/" color="#f59e0b">Back to FrootAI →</GlowPill>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
