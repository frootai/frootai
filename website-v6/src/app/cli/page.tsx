import type { Metadata } from "next";
import Link from "next/link";
import { Rocket, FolderOpen, Search, DollarSign, CheckCircle, Stethoscope, HelpCircle, ClipboardList, Zap, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeader } from "@/components/ui/section-header";
import { CodeBlock } from "@/components/ui/code-block";
import { Card } from "@/components/ui/card";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = {
  title: "CLI",
  description: "FrootAI CLI: scaffold projects, search knowledge, estimate costs, and validate configs from the terminal.",
};

const commands: { name: string; Icon: LucideIcon; desc: string; color: string }[] = [
  { name: "frootai init", Icon: Rocket, desc: "Interactive project scaffolding. 3 questions → complete FrootAI project with .github Agentic OS, DevKit, TuneKit, and MCP config.", color: "#10b981" },
  { name: "frootai scaffold <play>", Icon: FolderOpen, desc: "Scaffold a specific solution play (e.g., frootai scaffold 01-enterprise-rag). Creates the full project structure.", color: "#f59e0b" },
  { name: "frootai search <query>", Icon: Search, desc: "Search the FrootAI knowledge base from terminal. Returns relevant module sections.", color: "#6366f1" },
  { name: "frootai cost <play> [scale]", Icon: DollarSign, desc: "Estimate monthly Azure cost for a play. Usage: frootai cost 01 dev or frootai cost 07 prod.", color: "#06b6d4" },
  { name: "frootai validate", Icon: CheckCircle, desc: "Validate your project's FrootAI config files (.github structure, config/*.json, agent.md).", color: "#10b981" },
  { name: "frootai doctor", Icon: Stethoscope, desc: "Check your environment: Node version, MCP server status, VS Code extension, Git config.", color: "#7c3aed" },
  { name: "frootai deploy <play>", Icon: Rocket, desc: "Deploy a solution play to Azure. Walks through Bicep deployment with parameter prompts.", color: "#ef4444" },
  { name: "frootai help", Icon: HelpCircle, desc: "Show all available commands and usage examples.", color: "#f59e0b" },
];

export default function CLIPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader
        title="FrootAI CLI"
        subtitle={<>Scaffold projects, search knowledge, estimate costs, and validate configs — all from the terminal. Ships with the <Link href="/setup-guide" className="text-amber hover:underline font-medium">MCP Server package</Link>. No extra install needed.</>}
      />

      {/* Install */}
      <FadeIn>
        <div className="rounded-xl border border-border bg-bg-surface p-5 mb-10">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-dim mb-3">No install needed — runs via npx</p>
          <CodeBlock code="npx frootai <command>" label="Terminal" labelColor="#10b981" />
          <p className="mt-3 text-[13px] text-fg-muted">
            Or if you&apos;ve installed <code className="rounded bg-emerald/10 px-1.5 py-0.5 text-[12px] text-emerald font-mono">frootai-mcp</code> globally: just <code className="rounded bg-emerald/10 px-1.5 py-0.5 text-[12px] text-emerald font-mono">frootai &lt;command&gt;</code>
          </p>
        </div>
      </FadeIn>

      {/* Commands */}
      <FadeIn delay={0.05}>
        <h2 className="flex items-center gap-2 text-lg font-bold mb-5"><ClipboardList className="h-5 w-5 text-amber" /> Commands</h2>
        <div className="space-y-3 mb-10">
          {commands.map((cmd) => (
            <Card key={cmd.name} className="flex items-start gap-4">
              <cmd.Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: cmd.color }} />
              <div>
                <code className="text-[13px] font-bold font-mono text-emerald">{cmd.name}</code>
                <p className="mt-1 text-[13px] text-fg-muted leading-relaxed">{cmd.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </FadeIn>

      {/* Example: frootai init */}
      <FadeIn delay={0.1}>
        <h2 className="text-lg font-bold mb-3">Example: <code className="font-mono text-emerald">frootai init</code></h2>
        <CodeBlock label="Terminal" labelColor="#10b981" code={`$ npx frootai init

  🌳 FrootAI™ CLI v3.1.2
  From the Roots to the Fruits

  What are you building?
  1) Enterprise RAG
  2) AI Agent
  3) AI Gateway
  4) Content Moderation
  5) Multi-modal
  6) Custom (pick from 20 plays)

  Choose [1-6]: 1

  Target scale?
  1) dev   — Local development
  2) prod  — Production, HA

  Choose [1-2]: 1

  Project name [my-ai-project]: my-rag-app

  ✅ Created my-rag-app/ with:
  └── .github/ (Agentic OS — 19 files)
  └── .vscode/mcp.json
  └── config/ (openai.json, search.json, ...)
  └── infra/main.bicep
  └── evaluation/
  └── agent.md`} />
      </FadeIn>

      {/* Bottom nav */}
      <div className="mt-14 flex flex-wrap justify-center gap-2">
        <GlowPill href="/mcp-tooling" color="#10b981">MCP Server</GlowPill>
        <GlowPill href="/setup-guide" color="#f97316">Setup Guide</GlowPill>
        <GlowPill href="/ecosystem" color="#0ea5e9">Ecosystem</GlowPill>
        <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
