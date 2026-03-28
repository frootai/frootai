"use client";

import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";

const toc = [
  { id: "platform-overview", label: "1. Platform Overview" },
  { id: "solution-plays", label: "2. Solution Plays (20)" },
  { id: "devkit", label: "3. DevKit (.github Agentic OS)" },
  { id: "tunekit", label: "4. TuneKit (AI Configuration)" },
  { id: "mcp-server", label: "5. MCP Server (22 Tools)" },
  { id: "vscode-extension", label: "6. VS Code Extension (16 Commands)" },
  { id: "knowledge-platform", label: "7. Knowledge Platform (18 Modules)" },
  { id: "ai-assistant", label: "8. AI Assistant & Configurator" },
  { id: "partner-integrations", label: "9. Partner Integrations" },
  { id: "plugin-marketplace", label: "10. Plugin Marketplace" },
  { id: "infrastructure", label: "11. Infrastructure (Bicep + AVM)" },
  { id: "evaluation-pipeline", label: "12. Evaluation Pipeline" },
  { id: "cicd-pipeline", label: "13. CI/CD Pipeline" },
  { id: "developer-hub", label: "14. Developer Hub" },
  { id: "open-source", label: "15. Open Source Community" },
  { id: "roadmap", label: "16. Roadmap" },
];

function FeatureTable({ rows }: { rows: { feature: string; desc: string; status: string; link?: string; linkLabel?: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border mb-6">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b-2 border-emerald/25 bg-bg-surface">
            <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-emerald">Feature</th>
            <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-emerald">Description</th>
            <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-emerald">Status</th>
            <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-emerald">Link</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-t border-border hover:bg-bg-elevated transition-colors ${i % 2 === 0 ? "" : "bg-bg-surface/30"}`}>
              <td className="px-4 py-2 font-mono font-semibold text-[12px] whitespace-nowrap">{r.feature}</td>
              <td className="px-4 py-2 text-fg-muted">{r.desc}</td>
              <td className="px-4 py-2 text-center whitespace-nowrap">{r.status}</td>
              <td className="px-4 py-2">{r.link ? <Link href={r.link} className="text-emerald font-semibold text-[12px] hover:underline">{r.linkLabel || "View →"}</Link> : <span className="text-fg-dim text-[11px]">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FeatureSpecClient() {
  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-6 py-12 sm:py-16">
      {/* Header */}
      <FadeIn>
        <div className="text-center mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald mb-2">Complete Feature Specification</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-gradient-froot">FrootAI — Complete Feature Specification</h1>
          <p className="mt-3 text-sm text-fg-muted max-w-xl mx-auto">Every feature, tool, command, module, and integration — documented in one place.</p>
          <div className="flex gap-2 justify-center mt-4">
            <Badge label="Version 3.0.0" color="#10b981" />
            <Badge label="March 2026" color="#6366f1" />
          </div>
        </div>
      </FadeIn>

      {/* TOC */}
      <FadeIn delay={0.05}>
        <div className="rounded-2xl border-2 border-emerald/25 bg-emerald/[0.02] p-6 mb-16">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald mb-4">Table of Contents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {toc.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="block rounded-lg px-3 py-2 text-[13px] font-semibold text-fg-muted hover:text-emerald border-b border-border-subtle transition-colors">
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* 1. Platform Overview */}
      <section id="platform-overview" className="mb-16 scroll-mt-24">
        <FadeIn><h2 className="text-xl font-extrabold mb-2">1. Platform Overview</h2>
          <p className="text-[13px] text-fg-muted mb-5 max-w-3xl">FrootAI is a full-stack AI solution platform that accelerates Azure AI development. Pre-tuned solution plays, developer tooling (MCP + VS Code), curated knowledge base, and infrastructure-as-code.</p></FadeIn>
        <FeatureTable rows={[
          { feature: "Website", desc: "25-page Next.js site (dark theme, responsive, SEO-optimized)", status: "Shipped", link: "/", linkLabel: "Home →" },
          { feature: "npm Package", desc: "frootai-mcp@3.0.0 — 22 MCP tools", status: "Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
          { feature: "VS Code Ext", desc: "pavleenbali.frootai — 16 commands, sidebar", status: "Shipped", link: "/vscode-extension", linkLabel: "Ext →" },
          { feature: "GitHub Repo", desc: "Public, MIT license, CI/CD, 380+ files", status: "Shipped", link: "https://github.com/gitpavleenbali/frootai", linkLabel: "GitHub →" },
          { feature: "Azure Integration", desc: "AI Foundry, Managed Identity, Bicep IaC", status: "Shipped", link: "/docs/admin-guide", linkLabel: "Admin →" },
          { feature: "Knowledge Base", desc: "664KB — 18 modules across 5 FROOT layers", status: "Shipped", link: "/packages", linkLabel: "Packages →" },
          { feature: "Solution Framework", desc: "20 plays with DevKit + TuneKit + Evaluation", status: "Shipped", link: "/solution-plays", linkLabel: "Plays →" },
          { feature: "AI Assistant", desc: "Chatbot for play recommendation + cost estimation", status: "Preview", link: "/chatbot", linkLabel: "Chatbot →" },
          { feature: "Marketplace", desc: "Decentralized plugin marketplace", status: "Preview", link: "/marketplace", linkLabel: "Market →" },
        ]} />
      </section>

      {/* 2. Solution Plays */}
      <section id="solution-plays" className="mb-16 scroll-mt-24">
        <FadeIn><h2 className="text-xl font-extrabold mb-2">2. Solution Plays (20)</h2>
          <p className="text-[13px] text-fg-muted mb-5 max-w-3xl">Each play ships with .github Agentic OS, DevKit, TuneKit, infrastructure blueprints, and evaluation scripts.</p></FadeIn>
        <FeatureTable rows={[
          { feature: "Play 01", desc: "Enterprise RAG Q&A — AI Search + OpenAI", status: "Ready", link: "/user-guide?play=01" },
          { feature: "Play 02", desc: "AI Landing Zone — VNet + RBAC + GPU", status: "Ready", link: "/user-guide?play=02" },
          { feature: "Play 03", desc: "Deterministic Agent — temp=0, guardrails", status: "Ready", link: "/user-guide?play=03" },
          { feature: "Play 04–20", desc: "17 skeleton plays with DevKit + TuneKit", status: "Skeleton", link: "/solution-plays", linkLabel: "All Plays →" },
        ]} />
      </section>

      {/* 3–16: abbreviated sections with headers */}
      {[
        { id: "devkit", num: 3, title: "DevKit (.github Agentic OS)", desc: "19 files, 4 layers, 7 primitives per solution play." },
        { id: "tunekit", num: 4, title: "TuneKit (AI Configuration)", desc: "config/*.json, infra/main.bicep, evaluation/ — tune AI for production." },
        { id: "mcp-server", num: 5, title: "MCP Server (22 Tools)", desc: "6 static + 4 live + 3 chain + 3 AI ecosystem + 6 compute tools." },
        { id: "vscode-extension", num: 6, title: "VS Code Extension (16 Commands)", desc: "Sidebar navigation, DevKit/TuneKit init, term lookup, knowledge search." },
        { id: "knowledge-platform", num: 7, title: "Knowledge Platform (18 Modules)", desc: "5 FROOT layers: Foundations, Reasoning, Orchestration, Operations, Transformation." },
        { id: "ai-assistant", num: 8, title: "AI Assistant & Configurator", desc: "GPT-4.1 powered chatbot + 3-step recommendation wizard." },
        { id: "partner-integrations", num: 9, title: "Partner Integrations", desc: "MCP adapters for ServiceNow, Salesforce, SAP, Datadog, PagerDuty, Jira." },
        { id: "plugin-marketplace", num: 10, title: "Plugin Marketplace", desc: "Decentralized plugin.json manifests, community publishing." },
        { id: "infrastructure", num: 11, title: "Infrastructure (Bicep + AVM)", desc: "Azure Verified Modules, Bicep templates, private endpoints, RBAC." },
        { id: "evaluation-pipeline", num: 12, title: "Evaluation Pipeline", desc: "Groundedness, coherence, relevance, fluency — automated scoring." },
        { id: "cicd-pipeline", num: 13, title: "CI/CD Pipeline", desc: "GitHub Actions, commitlint, release automation, sync + validate." },
        { id: "developer-hub", num: 14, title: "Developer Hub", desc: "Admin guide, user guide, contributor guide, API reference, architecture." },
        { id: "open-source", num: 15, title: "Open Source Community", desc: "MIT license, $0 forever, community contributions welcome." },
        { id: "roadmap", num: 16, title: "Roadmap", desc: "Certification program, advanced plays, more partner integrations." },
      ].map((s) => (
        <section key={s.id} id={s.id} className="mb-12 scroll-mt-24">
          <FadeIn>
            <h2 className="text-xl font-extrabold mb-2">{s.num}. {s.title}</h2>
            <p className="text-[13px] text-fg-muted mb-3 max-w-3xl">{s.desc}</p>
            <Link href={`/${s.id === "mcp-server" ? "mcp-tooling" : s.id === "vscode-extension" ? "vscode-extension" : s.id === "knowledge-platform" ? "packages" : s.id === "ai-assistant" ? "chatbot" : s.id === "partner-integrations" ? "partners" : s.id === "plugin-marketplace" ? "marketplace" : s.id === "developer-hub" ? "dev-hub" : s.id === "open-source" ? "community" : s.id === "evaluation-pipeline" ? "eval-dashboard" : s.id === "infrastructure" ? "setup-guide" : s.id === "roadmap" ? "dev-hub-changelog" : s.id}`}
              className="text-[12px] text-emerald font-semibold hover:underline">
              View details →
            </Link>
          </FadeIn>
        </section>
      ))}
    </div>
  );
}
