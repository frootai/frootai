import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = { title: "Changelog", description: "FrootAI release history — version bumps, new features, fixes." };

const releases = [
  { version: "v3.1.2", date: "March 2026", tag: "Latest", changes: [
    "Added 6 AI ecosystem tools (model catalog, pricing, cost estimation, model compare, play compare, semantic search)",
    "Agent chain tools: agent_build → agent_review → agent_tune",
    "VS Code Extension: Auto-chain agents command",
    "Website: Added adoption page, eval dashboard, feature spec",
    "Docker: Multi-arch support (amd64 + arm64)",
  ]},
  { version: "v3.0.0", date: "February 2026", tag: "Major", changes: [
    "MCP Server v3: 22 tools (6 static + 4 live + 3 chain + 3 AI ecosystem + 6 compute)",
    "Solution Plays expanded to 20 with DevKit + TuneKit + SpecKit",
    ".github Agentic OS: 19 files, 4 layers, 7 primitives per play",
    "VS Code Extension v1.0.0: 16 commands, standalone sidebar",
    "Website: 25 pages, Agent FAI chatbot with GPT-4.1",
  ]},
  { version: "v2.0.0", date: "January 2026", tag: "Major", changes: [
    "MCP Server v2: Added live tools (fetch_azure_docs, fetch_external_mcp)",
    "Knowledge base expanded to 18 modules (664 KB)",
    "AI Glossary: 200+ terms",
    "Solution Plays: 3 ready + 17 skeletons",
  ]},
  { version: "v1.0.0", date: "December 2025", tag: "Initial", changes: [
    "MCP Server v1: 6 static tools",
    "10 knowledge modules (5 FROOT layers)",
    "Initial website with Docusaurus",
    "VS Code Extension: Basic sidebar",
  ]},
];

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader title="Changelog & Releases" subtitle="Version history for the FrootAI ecosystem — MCP Server, VS Code Extension, Website, and Solution Plays." />

      <div className="space-y-8">
        {releases.map((r, i) => (
          <FadeIn key={r.version} delay={i * 0.05}>
            <div className="rounded-2xl border border-border bg-bg-surface p-6 transition-all duration-300 hover:border-indigo/20">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <h2 className="text-lg font-extrabold">{r.version}</h2>
                <Badge label={r.tag} color={r.tag === "Latest" ? "#10b981" : r.tag === "Major" ? "#6366f1" : "#f59e0b"} />
                <span className="text-[12px] text-fg-dim">{r.date}</span>
              </div>
              <ul className="space-y-1.5 text-[13px] text-fg-muted list-disc pl-5">
                {r.changes.map((c, j) => <li key={j}>{c}</li>)}
              </ul>
            </div>
          </FadeIn>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap justify-center gap-2">
        <GlowPill href="/dev-hub" color="#6366f1">Developer Hub</GlowPill>
        <GlowPill href="https://github.com/gitpavleenbali/frootai/releases" color="#f59e0b" external>GitHub Releases</GlowPill>
        <GlowPill href="/" color="#10b981">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
