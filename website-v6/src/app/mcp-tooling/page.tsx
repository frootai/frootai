import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Monitor, Cloud, Zap, Bot, Gem, ClipboardList, BookOpen, Search, Building2, TreePine, Plug, Target, Brain, Wrench, Sliders, BarChart3, DollarSign, Calculator, Scale, Globe, Bell, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { SectionHeader } from "@/components/ui/section-header";
import { CodeBlock } from "@/components/ui/code-block";
import { Card } from "@/components/ui/card";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = {
  title: "MCP Tooling",
  description: "Add FrootAI to your AI agent. 22 tools, 18 modules, 200+ terms. npx frootai-mcp.",
};

/* ═══ DATA ═══ */

const installMethods = [
  { label: "Quick Run", color: "#10b981", code: "npx frootai-mcp" },
  { label: "Install Global", color: "#6366f1", code: "npm i -g frootai-mcp" },
  { label: "npm Registry", color: "#7c3aed", link: "https://www.npmjs.com/package/frootai-mcp", linkLabel: "npmjs.com/package/frootai-mcp →" },
];

const clients: { name: string; Icon: LucideIcon; file: string; config: string }[] = [
  { name: "Claude Desktop", Icon: MessageCircle, file: "claude_desktop_config.json", config: '{"mcpServers":{"frootai":{"command":"npx","args":["frootai-mcp"]}}}' },
  { name: "VS Code / Copilot", Icon: Monitor, file: ".vscode/mcp.json", config: '{"servers":{"frootai":{"command":"npx","args":["frootai-mcp"]}}}' },
  { name: "Azure AI Foundry", Icon: Cloud, file: "Agent → Tools → Add MCP", config: "Point to npx frootai-mcp" },
  { name: "Cursor / Windsurf", Icon: Zap, file: "MCP settings", config: '{"mcpServers":{"frootai":{"command":"npx","args":["frootai-mcp"]}}}' },
  { name: "Copilot Studio", Icon: Bot, file: "Copilot Studio tools", config: "Add MCP connector" },
  { name: "Gemini / Codex", Icon: Gem, file: "MCP config", config: '{"mcpServers":{"frootai":{"command":"npx","args":["frootai-mcp"]}}}' },
];

const staticTools: { name: string; desc: string; Icon: LucideIcon }[] = [
  { name: "list_modules", desc: "Browse 18 modules by FROOT layer", Icon: ClipboardList },
  { name: "get_module", desc: "Read any module content (F1–T3)", Icon: BookOpen },
  { name: "lookup_term", desc: "200+ AI/ML term definitions", Icon: Search },
  { name: "search_knowledge", desc: "Full-text search all modules", Icon: Search },
  { name: "get_architecture_pattern", desc: "7 pre-built decision guides", Icon: Building2 },
  { name: "get_froot_overview", desc: "Complete FROOT framework summary", Icon: TreePine },
];

const liveTools: { name: string; desc: string; Icon: LucideIcon }[] = [
  { name: "fetch_azure_docs", desc: "Search Microsoft Learn for Azure docs", Icon: Cloud },
  { name: "fetch_external_mcp", desc: "Find MCP servers from registries", Icon: Plug },
  { name: "list_community_plays", desc: "List 20 solution plays from GitHub", Icon: Target },
  { name: "get_github_agentic_os", desc: ".github 7 primitives guide", Icon: Brain },
];

const chainTools: { name: string; desc: string; Icon: LucideIcon }[] = [
  { name: "agent_build", desc: "Builder — architecture guidance, suggests review", Icon: Wrench },
  { name: "agent_review", desc: "Reviewer — security + quality checklist, suggests tune", Icon: Search },
  { name: "agent_tune", desc: "Tuner — production readiness verdict", Icon: Sliders },
];

const aiEcoTools: { name: string; desc: string; Icon: LucideIcon }[] = [
  { name: "get_model_catalog", desc: "Compare GPT-4o, Claude, Llama, Phi models", Icon: BarChart3 },
  { name: "get_azure_pricing", desc: "Token pricing for Azure OpenAI models", Icon: DollarSign },
  { name: "estimate_cost", desc: "Estimate monthly cost for a solution play", Icon: Calculator },
  { name: "compare_models", desc: "Side-by-side model comparison", Icon: Scale },
  { name: "compare_plays", desc: "Compare two solution plays", Icon: Target },
  { name: "semantic_search_plays", desc: "Natural language play search", Icon: Search },
];

function ToolGrid({ tools, color }: { tools: typeof staticTools; color: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {tools.map((t) => (
        <div key={t.name} className="rounded-xl border border-border bg-bg-surface p-4 text-center transition-all duration-200 hover:border-indigo/20 hover:-translate-y-0.5">
          <div className="flex justify-center mb-1.5"><t.Icon className="h-6 w-6" style={{ color }} /></div>
          <div className="text-[12px] font-mono font-semibold" style={{ color }}>{t.name}</div>
          <div className="text-[11px] text-fg-dim mt-1">{t.desc}</div>
        </div>
      ))}
    </div>
  );
}

export default function MCPToolingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader
        title="FrootAI MCP Server"
        subtitle={<>Add AI <span className="font-bold text-emerald">Infra</span>, <span className="font-bold text-cyan">Platform</span>, and <span className="font-bold text-violet">App</span> Knowledge to Your Agent</>}
      />

      {/* Install methods */}
      <FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12">
          {installMethods.map((m) => (
            <div key={m.label} className="rounded-xl border-2 p-4 text-center"
              style={{ borderColor: `color-mix(in srgb, ${m.color} 30%, transparent)`, background: `color-mix(in srgb, ${m.color} 3%, transparent)` }}>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: m.color }}>{m.label}</div>
              {m.code ? (
                <code className="text-sm font-mono rounded-lg px-3 py-1.5 inline-block" style={{ background: `color-mix(in srgb, ${m.color} 10%, transparent)` }}>{m.code}</code>
              ) : (
                <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline" style={{ color: m.color }}>{m.linkLabel}</a>
              )}
            </div>
          ))}
        </div>
      </FadeIn>

      {/* Without vs With */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          <Card className="border-red/20">
            <div className="flex justify-center mb-2"><BookOpen className="h-6 w-6 text-red-400" /></div>
            <h3 className="font-bold text-sm text-center mb-3">Without FrootAI MCP</h3>
            <ul className="text-[13px] text-fg-muted space-y-1.5 list-disc pl-4">
              <li>Agent searches the internet — slow, noisy</li>
              <li>Burns 5,000+ tokens per architecture query</li>
              <li>May hallucinate design guidance</li>
              <li>Generic answers — no Azure patterns</li>
            </ul>
          </Card>
          <Card className="border-emerald/30 bg-emerald/[0.02]">
            <div className="flex justify-center mb-2"><TreePine className="h-6 w-6 text-emerald-400" /></div>
            <h3 className="font-bold text-sm text-center mb-3">With FrootAI MCP</h3>
            <ul className="text-[13px] text-fg-muted space-y-1.5 list-disc pl-4">
              <li>Queries curated 664KB knowledge base</li>
              <li>90% less token burn</li>
              <li>Zero hallucination — grounded in verified docs</li>
              <li>Azure-specific best practices & patterns</li>
            </ul>
          </Card>
        </div>
      </FadeIn>

      {/* Client configs */}
      <FadeIn delay={0.1}>
        <h2 className="text-lg font-bold text-center mb-4">Connect to Your Client</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-12">
          {clients.map((c) => (
            <div key={c.name} className="rounded-xl border border-border bg-bg-surface p-4">
              <c.Icon className="h-5 w-5 text-fg-muted mb-1" />
              <div className="font-bold text-[13px] mb-1">{c.name}</div>
              <div className="text-[11px] text-fg-dim font-mono mb-2">{c.file}</div>
              <code className="text-[10px] text-fg-muted break-all leading-relaxed">{c.config}</code>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* Static tools */}
      <FadeIn delay={0.15}>
        <h2 className="text-lg font-bold text-center mb-1">Tools Agent Receives</h2>
        <p className="text-[12px] text-fg-dim text-center mb-5">6 static (bundled) + 4 live (network) + 3 agent chain (Build → Review → Tune)</p>
        <ToolGrid tools={staticTools} color="#10b981" />
      </FadeIn>

      {/* Live tools */}
      <FadeIn delay={0.2}>
        <h3 className="flex items-center justify-center gap-2 text-base font-bold text-center mt-10 mb-4 text-amber"><Bell className="h-4 w-4" /> Live Tools (v2 — network-enabled)</h3>
        <ToolGrid tools={liveTools} color="#f59e0b" />
      </FadeIn>

      {/* Chain tools */}
      <FadeIn delay={0.25}>
        <h3 className="flex items-center justify-center gap-2 text-base font-bold text-center mt-10 mb-4 text-violet"><Zap className="h-4 w-4" /> Agent Chain Tools (Build → Review → Tune)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {chainTools.map((t) => (
            <div key={t.name} className="rounded-xl border border-violet/20 bg-violet/[0.02] p-4 text-center">
              <div className="flex justify-center mb-1.5"><t.Icon className="h-6 w-6 text-violet-400" /></div>
              <div className="text-[12px] font-mono font-semibold text-violet">{t.name}</div>
              <div className="text-[11px] text-fg-muted mt-1">{t.desc}</div>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* AI Ecosystem tools */}
      <FadeIn delay={0.3}>
        <h3 className="flex items-center justify-center gap-2 text-base font-bold text-center mt-10 mb-4 text-cyan"><Globe className="h-4 w-4" /> AI Ecosystem Tools (v3)</h3>
        <ToolGrid tools={aiEcoTools} color="#06b6d4" />
      </FadeIn>

      {/* Bottom nav */}
      <div className="mt-14 flex flex-wrap justify-center gap-2">
        <GlowPill href="/setup-guide" color="#f97316">Setup Guide</GlowPill>
        <GlowPill href="/vscode-extension" color="#6366f1">VS Code Extension</GlowPill>
        <GlowPill href="/ecosystem" color="#10b981">Ecosystem</GlowPill>
        <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
