import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, BookOpen, Plug, Monitor, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = {
  title: "VS Code Extension",
  description: "FrootAI VS Code Extension — browse solution plays, search AI terms, init DevKit, right from your editor.",
};

const features: { Icon: LucideIcon; title: string; desc: string; color: string }[] = [
  { Icon: ClipboardList, title: "Solution Plays", desc: "Browse all 20 plays in the sidebar. Click to open README or folder.", color: "#7c3aed" },
  { Icon: BookOpen, title: "FROOT Modules", desc: "18 modules grouped by layer. Click to open and read.", color: "#10b981" },
  { Icon: Plug, title: "MCP Tools", desc: "See all 22 MCP tools at a glance. Know what your agent can do.", color: "#6366f1" },
];

const commands = [
  { cmd: "FrootAI: Initialize DevKit", desc: "Full .github Agentic OS (19 files) + agent.md + MCP + plugin.json", hot: true },
  { cmd: "FrootAI: Initialize TuneKit", desc: "config/*.json + infra/main.bicep + evaluation/ — AI tuning for production", hot: true },
  { cmd: "FrootAI: Install MCP Server", desc: "Install globally, run via npx, or add .vscode/mcp.json config", hot: true },
  { cmd: "FrootAI: Start MCP Server", desc: "Launch frootai-mcp in terminal (22 tools: 6 static + 4 live + 6 new)", hot: true },
  { cmd: "FrootAI: Initialize Hooks", desc: "Copy guardrails.json (preToolUse policy gates) to your project", hot: false },
  { cmd: "FrootAI: Initialize Prompts", desc: "Copy 4 slash commands (/deploy, /test, /review, /evaluate)", hot: false },
  { cmd: "FrootAI: Look Up AI Term", desc: "200+ terms — inline popup with rich definition", hot: false },
  { cmd: "FrootAI: Search Knowledge Base", desc: "Full-text search across 18 bundled modules", hot: false },
  { cmd: "FrootAI: Open Solution Play", desc: "View play in rich webview panel (standalone)", hot: false },
  { cmd: "FrootAI: Show Architecture Pattern", desc: "7 decision guides: RAG, agents, hosting, cost", hot: false },
  { cmd: "FrootAI: Open Setup Guide", desc: "Opens the setup guide on the website", hot: false },
  { cmd: "FrootAI: Browse Solution Plays", desc: "Opens the solution plays page", hot: false },
];

const devkitSteps = [
  { num: "1", text: <>Run <code className="rounded bg-emerald/10 px-1.5 py-0.5 text-[12px] text-emerald font-mono">Ctrl+Shift+P → FrootAI: Initialize DevKit</code></> },
  { num: "2", text: "Select a solution play (e.g., Enterprise RAG)" },
  { num: "3", text: <>FrootAI copies the <strong className="text-fg">full .github Agentic OS</strong> to your workspace:</> },
  { num: "4", text: "Start coding — Copilot generates solution-aware code with full agentic OS context." },
];

const layers = [
  { label: "Layer 1:", items: "instructions/*.instructions.md — coding standards, patterns, security", color: "#10b981" },
  { label: "Layer 2:", items: "prompts/*.prompt.md — /deploy, /test, /review, /evaluate", color: "#06b6d4" },
  { label: "Layer 2:", items: "agents/*.agent.md — builder → reviewer → tuner (chained)", color: "#06b6d4" },
  { label: "Layer 2:", items: "skills/*/SKILL.md — deploy-azure, evaluate, tune", color: "#06b6d4" },
  { label: "Layer 3:", items: "hooks/guardrails.json — preToolUse policy gates", color: "#6366f1" },
  { label: "Layer 3:", items: "workflows/*.md — AI-driven CI/CD", color: "#6366f1" },
  { label: "Layer 4:", items: "plugin.json — distribution manifest", color: "#7c3aed" },
];

export default function VSCodeExtensionPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 py-12 sm:py-16">
      <FadeIn>
        <div className="text-center mb-10">
          <div className="flex justify-center mb-3"><Monitor className="h-12 w-12 text-indigo-400" /></div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">FrootAI VS Code Extension</h1>
          <p className="mt-2 text-sm text-fg-muted">Browse, search, and build — right from your editor</p>
        </div>
      </FadeIn>

      {/* Install card */}
      <FadeIn delay={0.05}>
        <div className="rounded-2xl border-2 border-indigo/25 bg-indigo/[0.03] p-6 text-center mb-10">
          <h2 className="font-bold text-sm mb-2">Install from VS Code Marketplace</h2>
          <p className="text-[13px] text-fg-muted mb-3">
            Open VS Code → Extensions (Ctrl+Shift+X) → Search <strong className="text-fg">&quot;FrootAI&quot;</strong> → Install
          </p>
          <p className="text-[12px] text-fg-dim mb-4">
            Or from terminal: <code className="rounded bg-indigo/10 px-1.5 py-0.5 text-[12px] text-indigo font-mono">code --install-extension pavleenbali.frootai</code>
          </p>
          <GlowPill href="https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai" color="#6366f1" external>
            Open on VS Code Marketplace →
          </GlowPill>
        </div>
      </FadeIn>

      {/* What you get */}
      <FadeIn delay={0.1}>
        <h2 className="text-lg font-bold mb-4">What You Get</h2>
        <StaggerChildren className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          {features.map((f) => (
            <StaggerItem key={f.title}>
              <Card className="text-center">
                <div className="flex justify-center mb-2"><f.Icon className="h-6 w-6" style={{ color: f.color }} /></div>
                <div className="font-bold text-[13px] mb-1">{f.title}</div>
                <div className="text-[12px] text-fg-dim">{f.desc}</div>
              </Card>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </FadeIn>

      {/* Commands */}
      <FadeIn delay={0.15}>
        <h2 className="text-lg font-bold mb-4">Commands (Ctrl+Shift+P)</h2>
        <div className="space-y-1.5 mb-10">
          {commands.map((c) => (
            <div key={c.cmd} className={`flex items-start gap-3 rounded-lg px-4 py-2.5 border transition-colors ${
              c.hot ? "border-emerald/25 bg-emerald/[0.02]" : "border-border"
            }`}>
              <code className={`text-[12px] font-semibold font-mono shrink-0 ${c.hot ? "text-emerald" : "text-indigo"}`}>
                {c.cmd}
              </code>
              <span className="text-[12px] text-fg-muted">{c.desc}</span>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* How DevKit Init Works */}
      <FadeIn delay={0.2}>
        <h2 className="text-lg font-bold mb-3">How DevKit Init Works (v2)</h2>
        <div className="rounded-xl border border-cyan/20 bg-cyan/[0.02] p-5 mb-4 space-y-2.5">
          {devkitSteps.map((s) => (
            <p key={s.num} className="text-[13px] text-fg-muted leading-relaxed">
              <strong className="text-fg">{s.num}.</strong> {s.text}
            </p>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-bg-surface p-4 mb-10">
          <ul className="space-y-1.5 text-[12px] text-fg-muted">
            {layers.map((l, i) => (
              <li key={i}>
                <strong style={{ color: l.color }}>{l.label}</strong>{" "}
                <code className="text-[11px] font-mono">{l.items}</code>
              </li>
            ))}
            <li className="mt-2">+ <code className="text-[11px] font-mono">agent.md</code> + <code className="text-[11px] font-mono">.vscode/mcp.json</code> — co-coder + MCP</li>
          </ul>
        </div>
      </FadeIn>

      {/* Bottom nav */}
      <div className="flex flex-wrap justify-center gap-2">
        <GlowPill href="/setup-guide" color="#6366f1">Full Setup Guide</GlowPill>
        <GlowPill href="/ecosystem" color="#10b981">Back to Ecosystem</GlowPill>
        <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
