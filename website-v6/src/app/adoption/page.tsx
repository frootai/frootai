import type { Metadata } from "next";
import Link from "next/link";
import { Target, Package, BookOpen, Search, Monitor, FolderOpen, Stethoscope, Bot, Building2, DollarSign, GraduationCap, Zap, CircleDot, Cloud, Plug, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = { title: "Adoption", description: "FrootAI by the Numbers — ecosystem health, adoption metrics, and integration points." };

const stats: { value: string; label: string; Icon: LucideIcon; color: string }[] = [
  { value: "20", label: "Solution Plays", Icon: Target, color: "#7c3aed" },
  { value: "22", label: "MCP Tools", Icon: Package, color: "#10b981" },
  { value: "18", label: "Knowledge Modules", Icon: BookOpen, color: "#6366f1" },
  { value: "200+", label: "AI Terms", Icon: Search, color: "#f59e0b" },
  { value: "16", label: "VS Code Commands", Icon: Monitor, color: "#06b6d4" },
  { value: "730+", label: "Solution Play Files", Icon: FolderOpen, color: "#ec4899" },
];

const components = [
  { name: "MCP Server", version: "v3.0.1", pkg: "frootai-mcp", status: "Live", link: "https://www.npmjs.com/package/frootai-mcp" },
  { name: "VS Code Extension", version: "v1.0.0", pkg: "pavleenbali.frootai", status: "Live", link: "https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai" },
  { name: "Knowledge Base", version: "18 modules", pkg: "knowledge.json", status: "Bundled", link: "/docs" },
  { name: "Website", version: "v6.0", pkg: "Next.js 16", status: "Live", link: "/" },
  { name: "Solution Plays", version: "20 plays", pkg: "DevKit + TuneKit", status: "Shipping", link: "/solution-plays" },
  { name: "Agent Card (A2A)", version: "v3.0.0", pkg: "agent-card.json", status: "Published", link: "https://github.com/gitpavleenbali/frootai/blob/main/mcp-server/agent-card.json" },
];

const useCases: { title: string; desc: string; Icon: LucideIcon; color: string }[] = [
  { title: "Enterprise RAG Pipelines", desc: "AI Search + OpenAI + Container Apps — pre-tuned config, evaluation suite, Bicep infra.", Icon: Search, color: "#7c3aed" },
  { title: "AI Agents & Multi-Agent", desc: "Deterministic agents, build→review→tune chains, Semantic Kernel and Agent Framework.", Icon: Bot, color: "#10b981" },
  { title: "AI Landing Zones", desc: "VNet + Private Endpoints + RBAC + GPU allocation — enterprise-grade AI infrastructure.", Icon: Building2, color: "#6366f1" },
  { title: "Cost Optimization", desc: "Model comparison, pricing estimates, token budget planning for AI workloads.", Icon: DollarSign, color: "#f59e0b" },
  { title: "AI Architecture Training", desc: "18 FROOT modules from tokens to production — used in workshops and onboarding.", Icon: GraduationCap, color: "#06b6d4" },
  { title: "Agentic DevOps (.github OS)", desc: "19-file .github Agentic OS per play — instructions, prompts, agents, skills, hooks.", Icon: Zap, color: "#ec4899" },
];

const integrations: { name: string; Icon: LucideIcon; desc: string; color: string }[] = [
  { name: "VS Code / GitHub Copilot", Icon: Monitor, desc: "Extension + MCP server for Copilot Chat", color: "#6366f1" },
  { name: "Claude Desktop", Icon: CircleDot, desc: "MCP server — npx frootai-mcp", color: "#7c3aed" },
  { name: "Cursor", Icon: CircleDot, desc: "MCP server in Cursor settings", color: "#06b6d4" },
  { name: "Windsurf", Icon: CircleDot, desc: "MCP server configuration", color: "#06b6d4" },
  { name: "Azure AI Foundry", Icon: Cloud, desc: "Agent tool definition", color: "#0ea5e9" },
  { name: "Any MCP Client", Icon: Plug, desc: "stdio transport, Node.js runtime", color: "#10b981" },
];

export default function AdoptionPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader title="FrootAI by the Numbers" subtitle="A living snapshot of the FrootAI ecosystem — what ships today, where teams use it, and how it connects to the AI toolchain." />

      {/* Stats grid */}
      <FadeIn>
        <StaggerChildren className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-14">
          {stats.map((s) => (
            <StaggerItem key={s.label}>
              <div className="rounded-2xl border-2 p-5 text-center" style={{ borderColor: `color-mix(in srgb, ${s.color} 25%, transparent)`, background: `color-mix(in srgb, ${s.color} 4%, transparent)` }}>
                <div className="flex justify-center mb-1"><s.Icon className="h-6 w-6" style={{ color: s.color }} /></div>
                <div className="text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[11px] font-semibold text-fg-muted mt-0.5">{s.label}</div>
              </div>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </FadeIn>

      {/* Ecosystem Health */}
      <FadeIn delay={0.05}>
        <h2 className="flex items-center gap-2 text-xl font-bold mb-4"><Stethoscope className="h-5 w-5 text-emerald" /> Ecosystem Health</h2>
        <div className="overflow-x-auto rounded-xl border border-border mb-14">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b-2 border-emerald/25 bg-bg-surface">
                <th className="px-4 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-emerald">Component</th>
                <th className="px-4 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-emerald">Version</th>
                <th className="px-4 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-emerald">Package</th>
                <th className="px-4 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-emerald">Status</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <tr key={c.name} className="border-t border-border hover:bg-bg-elevated transition-colors">
                  <td className="px-4 py-2.5 font-semibold">
                    {c.link.startsWith("http") ? <a href={c.link} target="_blank" rel="noopener noreferrer" className="hover:text-amber transition-colors">{c.name}</a> : <Link href={c.link} className="hover:text-amber transition-colors">{c.name}</Link>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px]">{c.version}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-fg-muted">{c.pkg}</td>
                  <td className="px-4 py-2.5">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>

      {/* Use Cases */}
      <FadeIn delay={0.1}>
        <h2 className="flex items-center gap-2 text-xl font-bold mb-4"><Target className="h-5 w-5 text-violet" /> What Teams Use FrootAI For</h2>
      </FadeIn>
      <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
        {useCases.map((uc) => (
          <StaggerItem key={uc.title}>
            <div className="rounded-2xl border-2 p-5 h-full" style={{ borderColor: `color-mix(in srgb, ${uc.color} 20%, transparent)`, background: `color-mix(in srgb, ${uc.color} 3%, transparent)` }}>
              <div className="mb-2"><uc.Icon className="h-6 w-6" style={{ color: uc.color }} /></div>
              <h3 className="font-bold text-sm mb-1">{uc.title}</h3>
              <p className="text-[12px] text-fg-muted">{uc.desc}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>

      {/* Integration Points */}
      <FadeIn delay={0.15}>
        <h2 className="flex items-center gap-2 text-xl font-bold mb-2"><Plug className="h-5 w-5 text-emerald" /> Integration Points</h2>
        <p className="text-[13px] text-fg-muted mb-5">FrootAI plugs into the tools teams already use — no migration, no lock-in.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-14">
          {integrations.map((ig) => (
            <Card key={ig.name} className="text-center">
              <div className="flex justify-center mb-1"><ig.Icon className="h-5 w-5" style={{ color: ig.color }} /></div>
              <div className="font-bold text-[12px]">{ig.name}</div>
              <div className="text-[11px] text-fg-dim mt-0.5">{ig.desc}</div>
            </Card>
          ))}
        </div>
      </FadeIn>

      <div className="flex flex-wrap justify-center gap-2">
        <GlowPill href="/ecosystem" color="#0ea5e9">Ecosystem</GlowPill>
        <GlowPill href="/community" color="#00c853">Community</GlowPill>
        <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
