import type { Metadata } from "next";
import { Target, BookOpen, Plug, Star, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = { title: "Open Source Community", description: "FrootAI is 100% open source. Free forever. MIT License." };

const freeItems = ["20 Solution Plays (open-source)", "MCP Server (npm) — 22 tools", "VS Code Extension — 16 commands", ".github Agentic OS templates", "18 Knowledge Modules", "200+ AI Glossary Terms", "Solution Configurator", "Agent FAI", "Workshop Materials", "Community Support"];

const contributeCards: { Icon: LucideIcon; title: string; detail: string; color: string }[] = [
  { Icon: Target, title: "Add a Solution Play", detail: "Create a new play following the DevKit + TuneKit structure. CI validates automatically.", color: "#7c3aed" },
  { Icon: BookOpen, title: "Improve Knowledge", detail: "Fix errors, add glossary terms, deepen existing modules. Every contribution matters.", color: "#10b981" },
  { Icon: Plug, title: "Build MCP Tools", detail: "Extend the MCP server with new capabilities. Partner integrations welcome.", color: "#6366f1" },
  { Icon: Star, title: "Star and Share", detail: "Star the repo, share with your team. Community grows the ecosystem.", color: "#f59e0b" },
];

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      <div className="text-center mb-3">
        <GlowPill href="https://github.com/gitpavleenbali/frootai" color="#eab308" external>Star on GitHub</GlowPill>
      </div>
      <SectionHeader
        title="Open Source Community"
        subtitle={<>Come build the community. Empower each other. Be the open glue for infrastructure, platform, and application teams.<br /><span className="text-green font-semibold">Open Source · Free Forever · MIT License · Built by the community, for the community.</span></>}
      />

      {/* Everything is Free */}
      <FadeIn>
        <div className="rounded-2xl border-2 border-emerald/25 bg-emerald/[0.02] p-6 sm:p-8 mb-12">
          <h3 className="text-lg font-extrabold text-emerald mb-1">Everything is Free</h3>
          <div className="text-2xl font-extrabold text-emerald mb-4">$0 — Forever</div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-[13px] text-fg-muted list-disc pl-5">
            {freeItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <div className="text-center mt-5">
            <GlowPill href="/setup-guide" color="#10b981">Get Started Free →</GlowPill>
          </div>
        </div>
      </FadeIn>

      {/* How to Contribute */}
      <FadeIn delay={0.05}>
        <h2 className="text-xl font-bold text-center mb-5">How to Contribute</h2>
      </FadeIn>
      <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
        {contributeCards.map((c) => (
          <StaggerItem key={c.title}>
            <Card className="text-center">
              <div className="flex justify-center mb-2"><c.Icon className="h-8 w-8" style={{ color: c.color }} /></div>
              <h4 className="font-bold text-sm mb-1">{c.title}</h4>
              <p className="text-[12px] text-fg-dim">{c.detail}</p>
            </Card>
          </StaggerItem>
        ))}
      </StaggerChildren>

      {/* Ready to Join */}
      <FadeIn delay={0.1}>
        <div className="rounded-2xl border-2 border-green/20 bg-green/[0.02] p-8 text-center">
          <h2 className="text-lg font-bold mb-5">Ready to Join?</h2>
          <div className="flex flex-wrap justify-center gap-2">
            <GlowPill href="/setup-guide" color="#10b981">Get Started Free →</GlowPill>
            <GlowPill href="/solution-plays" color="#7c3aed">Solution Plays →</GlowPill>
            <GlowPill href="https://github.com/gitpavleenbali/frootai" color="#eab308" external>Star on GitHub →</GlowPill>
            <GlowPill href="/learning-hub" color="#f59e0b">FAI Learning Hub →</GlowPill>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
