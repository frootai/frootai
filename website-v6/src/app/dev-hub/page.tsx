import type { Metadata } from "next";
import Link from "next/link";
import { Wrench, BookOpen, Handshake, Radio, ClipboardList, Building2, Bug, FileText, Settings, FileCode, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = { title: "FAI Developer Hub", description: "Your one-stop shop for building with FrootAI — guides, APIs, changelogs, and architecture." };

const quickLinks: { Icon: LucideIcon; title: string; sub: string; href: string; color: string }[] = [
  { Icon: Wrench, title: "Admin Guide", sub: "Install, configure, maintain", href: "/docs/admin-guide", color: "#f59e0b" },
  { Icon: BookOpen, title: "User Guide", sub: "End-to-end usage walkthrough", href: "/docs/user-guide-complete", color: "#10b981" },
  { Icon: Handshake, title: "Contributor Guide", sub: "Add plays, improve tools", href: "/docs/contributor-guide", color: "#06b6d4" },
  { Icon: Radio, title: "API Reference", sub: "22 MCP tools, 16 commands", href: "/docs/api-reference", color: "#6366f1" },
  { Icon: ClipboardList, title: "Changelog", sub: "Version history & releases", href: "/dev-hub-changelog", color: "#7c3aed" },
  { Icon: Building2, title: "Architecture", sub: "System design & data flow", href: "/docs/architecture-overview", color: "#ec4899" },
];

const quickStart = [
  { step: "1", label: "Install Extension", cmd: "code --install-extension pavleenbali.frootai", color: "#10b981" },
  { step: "2", label: "Init DevKit", cmd: "FROOT: Init DevKit (Cmd+Shift+P)", color: "#06b6d4" },
  { step: "3", label: "Deploy", cmd: "FROOT: Deploy Solution (Cmd+Shift+P)", color: "#7c3aed" },
];

const versions = [
  { label: "VS Code Extension", version: "v1.0.0", color: "#6366f1" },
  { label: "MCP Server (npm)", version: "v3.0.1", color: "#10b981" },
  { label: "Website", version: "v6.0", color: "#f59e0b" },
];

const resources: { Icon: LucideIcon; title: string; href: string; color: string }[] = [
  { Icon: Bug, title: "GitHub Issues", href: "https://github.com/gitpavleenbali/frootai/issues", color: "#f59e0b" },
  { Icon: FileText, title: "PR Template", href: "https://github.com/gitpavleenbali/frootai/blob/main/.github/pull_request_template.md", color: "#10b981" },
  { Icon: Settings, title: "CI Pipeline", href: "https://github.com/gitpavleenbali/frootai/actions", color: "#06b6d4" },
  { Icon: FileCode, title: "CONTRIBUTING.md", href: "https://github.com/gitpavleenbali/frootai/blob/main/CONTRIBUTING.md", color: "#6366f1" },
];

export default function DevHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      <FadeIn>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald text-center mb-2">Developer Portal</p>
      </FadeIn>
      <SectionHeader title="FAI Developer Hub" subtitle="Your one-stop shop for building with FrootAI — guides, APIs, changelogs, and architecture." />

      {/* Quick links */}
      <FadeIn>
        <h2 className="text-lg font-bold text-center mb-4">Quick Links</h2>
      </FadeIn>
      <StaggerChildren className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-14">
        {quickLinks.map((l) => (
          <StaggerItem key={l.title}>
            <Link href={l.href} className="glow-card group block p-4 text-center h-full" style={{ "--glow": l.color } as React.CSSProperties}>
              <div className="flex justify-center mb-2 transition-transform duration-200 group-hover:scale-110"><l.Icon className="h-6 w-6" style={{ color: l.color }} /></div>
              <div className="font-bold text-[13px] text-fg">{l.title}</div>
              <div className="text-[11px] mt-1" style={{ color: l.color }}>{l.sub}</div>
            </Link>
          </StaggerItem>
        ))}
      </StaggerChildren>

      {/* Getting Started */}
      <FadeIn delay={0.05}>
        <h2 className="text-lg font-bold text-center mb-4">Getting Started</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
          {quickStart.map((s) => (
            <Card key={s.step} className="text-center">
              <div className="text-2xl font-extrabold mb-1" style={{ color: s.color }}>{s.step}</div>
              <div className="font-bold text-[13px] mb-2">{s.label}</div>
              <code className="block rounded-lg bg-bg/60 border border-border-subtle px-3 py-2 text-[11px] font-mono text-fg-muted">{s.cmd}</code>
            </Card>
          ))}
        </div>
      </FadeIn>

      {/* Latest Release */}
      <FadeIn delay={0.1}>
        <h2 className="text-lg font-bold text-center mb-4">Latest Release</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
          {versions.map((v) => (
            <Card key={v.label} className="text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-dim mb-1">{v.label}</div>
              <div className="text-xl font-extrabold" style={{ color: v.color }}>{v.version}</div>
            </Card>
          ))}
        </div>
      </FadeIn>

      {/* Developer Resources */}
      <FadeIn delay={0.15}>
        <h2 className="text-lg font-bold text-center mb-4">Developer Resources</h2>
        <StaggerChildren className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-14">
          {resources.map((r) => (
            <StaggerItem key={r.title}>
              <a href={r.href} target="_blank" rel="noopener noreferrer"
                className="glow-card group block p-4 text-center h-full" style={{ "--glow": r.color } as React.CSSProperties}>
                <div className="flex justify-center mb-1 transition-transform group-hover:scale-110"><r.Icon className="h-5 w-5" style={{ color: r.color }} /></div>
                <div className="font-bold text-[12px] text-fg">{r.title}</div>
              </a>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </FadeIn>

      {/* Ready to build */}
      <FadeIn delay={0.2}>
        <Card className="text-center">
          <h2 className="text-lg font-bold mb-4">Ready to build?</h2>
          <div className="flex flex-wrap justify-center gap-2">
            <GlowPill href="/setup-guide" color="#f97316">Setup Guide</GlowPill>
            <GlowPill href="/solution-plays" color="#7c3aed">Solution Plays</GlowPill>
            <GlowPill href="https://github.com/gitpavleenbali/frootai" color="#f59e0b" external>Star on GitHub</GlowPill>
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}
