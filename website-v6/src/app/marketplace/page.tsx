import type { Metadata } from "next";
import { Search, Microscope, Ticket, FileText, Bot, DollarSign, Shield, Pickaxe, Headphones, Rocket, BarChart3, ClipboardList, Users, TrendingUp, Factory, Hospital, Landmark, Scale, Megaphone, Wrench, FileEdit, Link2, Package, ListChecks, Sparkles, Handshake, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = { title: "Plugin Marketplace", description: "Discover, publish, and install community agents, skills, and prompts for FrootAI." };

const featuredPlugins: { name: string; Icon: LucideIcon; tag: string; color: string }[] = [
  { name: "Enterprise RAG Pipeline", Icon: Search, tag: "rag", color: "#10b981" }, { name: "AI-Powered Code Review", Icon: Microscope, tag: "code-review", color: "#6366f1" },
  { name: "IT Ticket Resolution", Icon: Ticket, tag: "itsm", color: "#7c3aed" }, { name: "Document Intelligence", Icon: FileText, tag: "doc-intel", color: "#06b6d4" },
  { name: "Multi-Agent Orchestrator", Icon: Bot, tag: "multi-agent", color: "#ec4899" }, { name: "AI Cost Optimizer", Icon: DollarSign, tag: "cost", color: "#f59e0b" },
  { name: "Security Copilot", Icon: Shield, tag: "security", color: "#ef4444" }, { name: "Knowledge Mining", Icon: Pickaxe, tag: "knowledge", color: "#10b981" },
  { name: "Customer Service Agent", Icon: Headphones, tag: "customer", color: "#06b6d4" }, { name: "DevOps AI Assistant", Icon: Rocket, tag: "devops", color: "#f97316" },
  { name: "Data Analytics Copilot", Icon: BarChart3, tag: "analytics", color: "#6366f1" }, { name: "Compliance Agent", Icon: ClipboardList, tag: "compliance", color: "#7c3aed" },
  { name: "HR Onboarding Assistant", Icon: Users, tag: "hr", color: "#10b981" }, { name: "Sales Intelligence", Icon: TrendingUp, tag: "sales", color: "#f59e0b" },
  { name: "Supply Chain Optimizer", Icon: Factory, tag: "supply-chain", color: "#06b6d4" }, { name: "Healthcare Data Agent", Icon: Hospital, tag: "healthcare", color: "#ef4444" },
  { name: "Financial Risk Analyzer", Icon: Landmark, tag: "finance", color: "#6366f1" }, { name: "Legal Document Reviewer", Icon: Scale, tag: "legal", color: "#7c3aed" },
  { name: "Marketing Content Copilot", Icon: Megaphone, tag: "marketing", color: "#ec4899" }, { name: "Infra Drift Detector", Icon: Wrench, tag: "infra", color: "#f97316" },
];

const howItWorks: { step: string; Icon: LucideIcon; title: string; detail: string; color: string }[] = [
  { step: "1", Icon: FileEdit, title: "Add plugin.json", detail: "Drop a manifest in your repo root describing your agent, tools, config, and evaluation.", color: "#10b981" },
  { step: "2", Icon: Link2, title: "Register Your Repo", detail: "Open a PR to the FrootAI community-plugins/ folder with your repo URL.", color: "#6366f1" },
  { step: "3", Icon: Search, title: "Discoverable", detail: "MCP tools can search and recommend your plugin to other users.", color: "#7c3aed" },
];

const exampleManifest = `{
  "name": "my-custom-agent",
  "version": "1.0.0",
  "description": "Summarizes Azure costs and suggests optimizations",
  "author": "your-github-handle",
  "repository": "https://github.com/you/my-custom-agent",
  "type": "agent",
  "tags": ["cost", "azure", "optimization"],
  "entry": "agent.md",
  "mcp_tools": ["get_cost_report", "recommend_savings"],
  "config": "config/openai.json",
  "evaluation": "evaluation/eval.yaml",
  "license": "MIT"
}`;

export default function MarketplacePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader title="Plugin Marketplace" subtitle="A decentralized marketplace where anyone can publish agents, skills, and prompts — discovered via a simple plugin.json manifest." />

      {/* How it works */}
      <FadeIn>
        <h2 className="flex items-center gap-2 text-lg font-bold mb-4"><Package className="h-5 w-5 text-violet" /> How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {howItWorks.map((s) => (
            <Card key={s.step} className="text-center">
              <div className="flex justify-center mb-2"><s.Icon className="h-6 w-6" style={{ color: s.color }} /></div>
              <div className="text-xl font-extrabold text-violet mb-1">{s.step}</div>
              <h3 className="font-bold text-[13px] mb-1">{s.title}</h3>
              <p className="text-[12px] text-fg-dim">{s.detail}</p>
            </Card>
          ))}
        </div>
      </FadeIn>

      {/* Example manifest */}
      <FadeIn delay={0.05}>
        <h2 className="flex items-center gap-2 text-lg font-bold mb-3"><ListChecks className="h-5 w-5 text-violet" /> Plugin Manifest Example</h2>
        <CodeBlock label="plugin.json" labelColor="#7c3aed" code={exampleManifest} className="mb-12" />
      </FadeIn>

      {/* Featured plugins grid */}
      <FadeIn delay={0.1}>
        <h2 className="flex items-center gap-2 text-lg font-bold mb-4"><Sparkles className="h-5 w-5 text-pink" /> Featured Plugins</h2>
      </FadeIn>
      <StaggerChildren className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
        {featuredPlugins.map((p) => (
          <StaggerItem key={p.tag}>
            <div className="rounded-xl border border-border bg-bg-surface p-3 text-center transition-all duration-200 hover:border-pink/20 hover:-translate-y-0.5">
              <div className="flex justify-center mb-1"><p.Icon className="h-5 w-5" style={{ color: p.color }} /></div>
              <div className="font-bold text-[11px]">{p.name}</div>
              <div className="text-[10px] text-fg-dim mt-0.5 font-mono">{p.tag}</div>
            </div>
          </StaggerItem>
        ))}
      </StaggerChildren>

      {/* Submit CTA */}
      <FadeIn delay={0.15}>
        <div className="rounded-2xl border-2 border-pink/20 bg-pink/[0.02] p-8 text-center">
          <h2 className="flex items-center justify-center gap-2 text-xl font-bold mb-2"><Rocket className="h-5 w-5 text-pink" /> Publish Your Plugin</h2>
          <p className="text-[13px] text-fg-muted max-w-md mx-auto mb-5">Add a plugin.json to your repo, open a PR to community-plugins/, and your agent is discoverable by the entire FrootAI ecosystem.</p>
          <GlowPill href="https://github.com/gitpavleenbali/frootai/tree/main/community-plugins" color="#ec4899" external>Submit Your Plugin →</GlowPill>
        </div>
      </FadeIn>

      <div className="mt-14 flex flex-wrap justify-center gap-2">
        <GlowPill href="/partners" color="#7c3aed">Partners</GlowPill>
        <GlowPill href="/ecosystem" color="#0ea5e9">Ecosystem</GlowPill>
        <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
