import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

/* ================================================================== */
/*  FrootAI — Complete Feature Specification                           */
/*  Single source of truth for every feature A–Z                       */
/* ================================================================== */

// ─── Shared Styles ─────────────────────────────────────────────────

const page: React.CSSProperties = { maxWidth: "1200px", margin: "0 auto", padding: "48px 24px 80px" };
const sectionStyle: React.CSSProperties = { marginBottom: "64px" };
const h2Style: React.CSSProperties = { fontSize: "1.5rem", fontWeight: 800, marginBottom: "8px", scrollMarginTop: "80px" };
const descStyle: React.CSSProperties = { fontSize: "0.88rem", color: "var(--ifm-color-emphasis-500)", lineHeight: 1.7, marginBottom: "20px", maxWidth: "800px" };

const tableWrap: React.CSSProperties = { overflowX: "auto", marginBottom: "16px" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", lineHeight: 1.6 };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", borderBottom: "2px solid rgba(16,185,129,0.3)", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#10b981", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid var(--ifm-color-emphasis-100)", verticalAlign: "top" };
const tdCode: React.CSSProperties = { ...td, fontFamily: "var(--ifm-font-family-monospace)", fontSize: "0.78rem", fontWeight: 600 };

// ─── TOC Data ──────────────────────────────────────────────────────

const tocItems = [
  { id: "platform-overview", label: "1. Platform Overview" },
  { id: "solution-plays", label: "2. Solution Plays (20)" },
  { id: "devkit", label: "3. DevKit (.github Agentic OS)" },
  { id: "tunekit", label: "4. TuneKit (AI Configuration)" },
  { id: "mcp-server", label: "5. MCP Server (23 tools)" },
  { id: "vscode-extension", label: "6. VS Code Extension (19 commands)" },
  { id: "knowledge-platform", label: "7. Knowledge Platform (16 Modules)" },
  { id: "ai-assistant", label: "8. AI Assistant & Solution Configurator" },
  { id: "partner-integrations", label: "9. Partner Integrations" },
  { id: "plugin-marketplace", label: "10. Plugin Marketplace" },
  { id: "infrastructure", label: "11. Infrastructure (Bicep + AVM)" },
  { id: "evaluation-pipeline", label: "12. Evaluation Pipeline" },
  { id: "cicd-pipeline", label: "13. CI/CD Pipeline" },
  { id: "developer-hub", label: "14. Developer Hub" },
  { id: "open-source", label: "15. Open Source Community" },
  { id: "roadmap", label: "16. Roadmap" },
];

// ─── Helper ────────────────────────────────────────────────────────

function FeatureTable({ rows }: { rows: { feature: string; desc: string; status: string; link?: string; linkLabel?: string }[] }): JSX.Element {
  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Feature</th>
            <th style={th}>Description</th>
            <th style={{ ...th, textAlign: "center" }}>Status</th>
            <th style={th}>Link</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(16,185,129,0.02)" }}>
              <td style={tdCode}>{r.feature}</td>
              <td style={td}>{r.desc}</td>
              <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{r.status}</td>
              <td style={td}>
                {r.link ? (
                  <Link to={r.link} style={{ color: "#10b981", fontWeight: 600, fontSize: "0.78rem" }}>
                    {r.linkLabel || "View →"}
                  </Link>
                ) : (
                  <span style={{ color: "var(--ifm-color-emphasis-300)", fontSize: "0.75rem" }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────

export default function FeatureSpecPage(): JSX.Element {
  return (
    <Layout title="Feature Specification — FrootAI" description="Complete feature specification for FrootAI — every feature from A to Z in a single reference page.">
      <div style={page}>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  HEADER                                                     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section style={{ textAlign: "center", marginBottom: "48px" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "#10b981", marginBottom: "8px" }}>
            Complete Feature Specification
          </p>
          <h1 style={{
            fontSize: "2.6rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "8px",
            background: "linear-gradient(135deg, #10b981 0%, #06b6d4 30%, #6366f1 60%, #7c3aed 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            FrootAI — Complete Feature Specification
          </h1>
          <p style={{ fontSize: "1rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "600px", margin: "0 auto 12px" }}>
            Every feature, tool, command, module, and integration — documented in one place.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <span style={{ padding: "4px 14px", borderRadius: "20px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", fontSize: "0.75rem", color: "#10b981", fontWeight: 600 }}>
              Version 3.0.0
            </span>
            <span style={{ padding: "4px 14px", borderRadius: "20px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", fontSize: "0.75rem", color: "#6366f1", fontWeight: 600 }}>
              March 2026
            </span>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  TABLE OF CONTENTS                                          */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section style={{
          marginBottom: "64px", padding: "28px 32px", borderRadius: "16px",
          border: "2px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.03)",
        }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#10b981", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            📋 Table of Contents
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "6px 24px" }}>
            {tocItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                style={{ color: "var(--ifm-color-emphasis-700)", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none", padding: "6px 0", borderBottom: "1px solid var(--ifm-color-emphasis-100)", display: "block", transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#10b981")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ifm-color-emphasis-700)")}
              >
                {item.label}
              </a>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  1. PLATFORM OVERVIEW                                       */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="platform-overview" style={sectionStyle}>
          <h2 style={h2Style}>1. Platform Overview</h2>
          <p style={descStyle}>
            FrootAI is a full-stack AI solution platform that accelerates Azure AI development. It provides pre-tuned solution plays, developer tooling (MCP + VS Code), a curated knowledge base, and infrastructure-as-code — all connected through the .github Agentic OS.
          </p>
          <FeatureTable rows={[
            { feature: "Website", desc: "15-page Docusaurus site (dark theme, responsive, SEO-optimized)", status: "✅ Shipped", link: "/", linkLabel: "Home →" },
            { feature: "npm Package", desc: "frootai-mcp@3.2.0 — 23 MCP tools (6 static + 4 live + 3 chain + 3 AI ecosystem + 6 new)", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP Tooling →" },
            { feature: "VS Code Extension", desc: "pavleenbali.frootai@1.3.1 — 19 commands, standalone engine, sidebar navigation", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "GitHub Repo", desc: "Public repository, MIT license, CI/CD pipeline, 380+ files", status: "✅ Shipped", link: "https://github.com/gitpavleenbali/frootai", linkLabel: "GitHub →" },
            { feature: "Azure Integration", desc: "AI Foundry-connected, Managed Identity, Bicep IaC, private endpoints", status: "✅ Shipped", link: "/docs/admin-guide", linkLabel: "Admin Guide →" },
            { feature: "Knowledge Base", desc: "664KB curated content — 16 modules across 5 FROOT layers", status: "✅ Shipped", link: "/packages", linkLabel: "Packages →" },
            { feature: "Solution Framework", desc: "20 pre-tuned solution plays with DevKit + TuneKit + Evaluation", status: "✅ Shipped", link: "/solution-plays", linkLabel: "Plays →" },
            { feature: "AI Assistant", desc: "Chatbot for play recommendation + cost estimation (preview)", status: "🔄 Preview", link: "/chatbot", linkLabel: "Chatbot →" },
            { feature: "Plugin Marketplace", desc: "Decentralized marketplace for community agents, skills, prompts", status: "🔄 Preview", link: "/marketplace", linkLabel: "Marketplace →" },
          ]} />
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  2. SOLUTION PLAYS (20)                                     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="solution-plays" style={sectionStyle}>
          <h2 style={h2Style}>2. Solution Plays (20)</h2>
          <p style={descStyle}>
            Each play ships with the full .github Agentic OS (19 files, 4 layers), DevKit (empower your coding agent),
            TuneKit (fine-tune AI for production), infrastructure blueprints, and evaluation scripts. LEGO blocks that compose into complete solutions.
          </p>
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>Play Name</th>
                  <th style={th}>Complexity</th>
                  <th style={{ ...th, textAlign: "center" }}>Status</th>
                  <th style={th}>Link</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: "01", name: "Enterprise RAG Q&A", icon: "🔍", cx: "Medium" },
                  { id: "02", name: "AI Landing Zone", icon: "⛰️", cx: "Foundation" },
                  { id: "03", name: "Deterministic Agent", icon: "🎯", cx: "Medium" },
                  { id: "04", name: "Call Center Voice AI", icon: "📞", cx: "High" },
                  { id: "05", name: "IT Ticket Resolution", icon: "🎫", cx: "Medium" },
                  { id: "06", name: "Document Intelligence", icon: "📄", cx: "Medium" },
                  { id: "07", name: "Multi-Agent Service", icon: "🤖", cx: "High" },
                  { id: "08", name: "Copilot Studio Bot", icon: "💬", cx: "Low" },
                  { id: "09", name: "AI Search Portal", icon: "🔎", cx: "Medium" },
                  { id: "10", name: "Content Moderation", icon: "🛡️", cx: "Low" },
                  { id: "11", name: "Landing Zone Advanced", icon: "🏔️", cx: "High" },
                  { id: "12", name: "Model Serving AKS", icon: "⚙️", cx: "High" },
                  { id: "13", name: "Fine-Tuning Workflow", icon: "🔬", cx: "High" },
                  { id: "14", name: "AI Gateway (APIM)", icon: "🚪", cx: "Medium" },
                  { id: "15", name: "Multi-Modal DocProc", icon: "🖼️", cx: "Medium" },
                  { id: "16", name: "Copilot Teams Extension", icon: "👥", cx: "Medium" },
                  { id: "17", name: "AI Observability", icon: "📊", cx: "Medium" },
                  { id: "18", name: "Prompt Management", icon: "📝", cx: "Medium" },
                  { id: "19", name: "Edge AI Phi-4", icon: "📱", cx: "High" },
                  { id: "20", name: "Anomaly Detection", icon: "🚨", cx: "High" },
                ].map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(16,185,129,0.02)" }}>
                    <td style={tdCode}>{p.id}</td>
                    <td style={td}>{p.icon} {p.name}</td>
                    <td style={td}>
                      <span style={{
                        padding: "2px 8px", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600,
                        background: p.cx === "Low" ? "rgba(16,185,129,0.1)" : p.cx === "Medium" ? "rgba(245,158,11,0.1)" : p.cx === "High" ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.1)",
                        color: p.cx === "Low" ? "#10b981" : p.cx === "Medium" ? "#f59e0b" : p.cx === "High" ? "#ef4444" : "#6366f1",
                      }}>{p.cx}</span>
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>✅ Ready</td>
                    <td style={td}>
                      <Link to={`/user-guide?play=${p.id}`} style={{ color: "#10b981", fontWeight: 600, fontSize: "0.78rem" }}>
                        User Guide →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  3. DEVKIT (.github Agentic OS)                             */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="devkit" style={sectionStyle}>
          <h2 style={h2Style}>3. DevKit (.github Agentic OS)</h2>
          <p style={descStyle}>
            The .github folder evolved into a full agentic operating system. 7 primitives across 4 layers give your coding agent solution-aware context, guardrails, and chained workflows — before you write a single line of code.
          </p>
          <FeatureTable rows={[
            { feature: "copilot-instructions.md", desc: "Layer 1: Always-on solution context — Copilot reads this on every request", status: "✅ Shipped", link: "/docs/admin-guide", linkLabel: "Admin Guide →" },
            { feature: "instructions/*.instructions.md", desc: "Layer 1: Modular instruction files — azure-coding, security, patterns, testing", status: "✅ Shipped", link: "/docs/api-reference", linkLabel: "API Ref →" },
            { feature: "prompts/*.prompt.md", desc: "Layer 2: 4 slash commands — /deploy, /test, /review, /evaluate", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "agents/*.agent.md", desc: "Layer 2: 3 chained specialists — builder → reviewer → tuner (auto-chain)", status: "✅ Shipped", link: "/docs/architecture-overview", linkLabel: "Architecture →" },
            { feature: "skills/*/SKILL.md", desc: "Layer 3: 3 skill folders — deploy-azure, evaluate, tune (deep expertise)", status: "✅ Shipped", link: "/docs/admin-guide", linkLabel: "Admin Guide →" },
            { feature: "hooks/guardrails.json", desc: "Layer 4: Lifecycle enforcement — preToolUse policy gates", status: "✅ Shipped", link: "/docs/api-reference", linkLabel: "API Ref →" },
            { feature: "workflows/*.md", desc: "Layer 4: Agentic CI/CD — AI-driven build, test, deploy workflows", status: "✅ Shipped", link: "/docs/architecture-overview", linkLabel: "Architecture →" },
            { feature: "infra/main.bicep", desc: "Azure infrastructure — real Bicep resources (AI Foundry, Search, Container Apps)", status: "✅ Shipped", link: "/setup-guide", linkLabel: "Setup →" },
            { feature: "agent.md", desc: "Rich play-specific personality (1500+ bytes) — shapes co-coder behavior", status: "✅ Shipped", link: "/docs/user-guide-complete", linkLabel: "User Guide →" },
            { feature: "plugin.json", desc: "Layer 4: Distribution manifest — marketplace packaging and discovery", status: "✅ Shipped", link: "/marketplace", linkLabel: "Marketplace →" },
          ]} />
          <div style={{ padding: "16px 20px", borderRadius: "12px", border: "1px solid rgba(6,182,212,0.2)", background: "rgba(6,182,212,0.03)", fontSize: "0.82rem", lineHeight: 1.7, marginTop: "12px" }}>
            <strong style={{ color: "#06b6d4" }}>How it works:</strong> Run <code>Ctrl+Shift+P → FrootAI: Initialize DevKit</code> → Select a solution play → FrootAI copies the full .github Agentic OS (19 files) to your workspace. Copilot immediately becomes solution-aware.
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  4. TUNEKIT (AI Configuration)                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="tunekit" style={sectionStyle}>
          <h2 style={h2Style}>4. TuneKit (AI Configuration)</h2>
          <p style={descStyle}>
            TuneKit provides pre-tuned configuration files so you can adjust AI behavior (temperature, top-k, models, guardrails) without being an AI specialist. Every parameter has been calibrated per solution play.
          </p>
          <FeatureTable rows={[
            { feature: "config/openai.json", desc: "Model settings — temperature, top-p, max-tokens, model selection, frequency penalty", status: "✅ Shipped", link: "/docs/api-reference", linkLabel: "API Ref →" },
            { feature: "config/search.json", desc: "Search tuning — hybrid weights, semantic config, top-k, reranking, relevance threshold", status: "✅ Shipped", link: "/docs/api-reference", linkLabel: "API Ref →" },
            { feature: "config/guardrails.json", desc: "Safety rails — content safety levels, blocklists, PII detection, topic restrictions", status: "✅ Shipped", link: "/docs/api-reference", linkLabel: "API Ref →" },
            { feature: "config/chunking.json", desc: "Document chunking — chunk size, overlap, strategy (fixed/semantic/recursive)", status: "✅ Shipped", link: "/docs/user-guide-complete", linkLabel: "User Guide →" },
            { feature: "config/routing.json", desc: "Agent routing — model fallback chains, load balancing, priority routing", status: "✅ Shipped", link: "/docs/api-reference", linkLabel: "API Ref →" },
            { feature: "config/agents.json", desc: "Agent behavior — personality, tools, memory, handoff rules, chain config", status: "✅ Shipped", link: "/docs/api-reference", linkLabel: "API Ref →" },
            { feature: "config/model-comparison.json", desc: "Cost vs quality matrix — compare models across latency, price, quality dimensions", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP Tools →" },
            { feature: "evaluation/", desc: "Evaluation scripts — eval.py, test datasets, quality targets, scoring metrics", status: "✅ Shipped", link: "/docs/api-reference", linkLabel: "API Ref →" },
            { feature: "infra/main.bicep", desc: "Infrastructure config — SKUs, regions, scaling rules, private endpoints, RBAC", status: "✅ Shipped", link: "/setup-guide", linkLabel: "Setup →" },
          ]} />
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  5. MCP SERVER (23 tools)                                   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="mcp-server" style={sectionStyle}>
          <h2 style={h2Style}>5. MCP Server (23 tools)</h2>
          <p style={descStyle}>
            The FrootAI MCP Server (<code>frootai-mcp@3.2.0</code>) gives your AI agent direct access to curated knowledge, architecture patterns, model catalog, and pricing data. Works with Copilot, Claude, Cursor, Gemini, and any MCP-compatible client.
          </p>

          {/* Static Tools */}
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#10b981", marginBottom: "12px" }}>📦 Static Tools (6) — Bundled, works offline</h3>
          <FeatureTable rows={[
            { feature: "list_modules", desc: "Browse all 16 FROOT modules organized by layer (F/R/O/O/T)", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
            { feature: "get_module", desc: "Read any module by ID (F1–T3) with optional section filtering", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
            { feature: "lookup_term", desc: "200+ AI/ML term definitions — precise, curated glossary", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
            { feature: "search_knowledge", desc: "Full-text search across all 16 modules — ranked results", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
            { feature: "get_architecture_pattern", desc: "7 pre-built decision guides (RAG, agents, hosting, cost, etc.)", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
            { feature: "get_froot_overview", desc: "Complete FROOT framework summary — layers, philosophy, structure", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
          ]} />

          {/* Live Tools */}
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#f59e0b", marginBottom: "12px", marginTop: "24px" }}>🔔 Live Tools (4) — Network-enabled, with offline fallback</h3>
          <FeatureTable rows={[
            { feature: "fetch_azure_docs", desc: "Search Microsoft Learn for Azure documentation in real-time", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
            { feature: "fetch_external_mcp", desc: "Find MCP servers from community registries", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
            { feature: "list_community_plays", desc: "List all 20 solution plays from GitHub (live metadata)", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
            { feature: "get_github_agentic_os", desc: ".github 7 primitives guide — the agentic OS reference", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
          ]} />

          {/* Chain Tools */}
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#7c3aed", marginBottom: "12px", marginTop: "24px" }}>⚡ Agent Chain Tools (3) — Build → Review → Tune</h3>
          <FeatureTable rows={[
            { feature: "agent_build", desc: "Builder agent — architecture guidance, code scaffolding, suggests review", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
            { feature: "agent_review", desc: "Reviewer agent — security + quality checklist, suggests tune", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
            { feature: "agent_tune", desc: "Tuner agent — production readiness verdict, config optimization", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
          ]} />

          {/* AI Ecosystem Tools */}
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#00C853", marginBottom: "12px", marginTop: "24px" }}>🧠 AI Ecosystem Tools (3) — NEW in v3.0</h3>
          <FeatureTable rows={[
            { feature: "get_model_catalog", desc: "Azure AI model catalog — pricing, capabilities, context windows, recommendations", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
            { feature: "get_azure_pricing", desc: "Monthly cost estimates for RAG, agent, batch, realtime scenarios (dev/staging/prod)", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
            { feature: "compare_models", desc: "Side-by-side model comparison — recommend best model for use case + priority", status: "✅ Shipped", link: "/mcp-tooling", linkLabel: "MCP →" },
          ]} />
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  6. VS CODE EXTENSION (19 commands)                         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="vscode-extension" style={sectionStyle}>
          <h2 style={h2Style}>6. VS Code Extension (19 commands)</h2>
          <p style={descStyle}>
            The FrootAI VS Code Extension (<code>pavleenbali.frootai@1.3.1</code>) puts solution plays, AI modules, and MCP tools directly in your editor sidebar. 19 commands accessible via Ctrl+Shift+P.
          </p>
          <FeatureTable rows={[
            { feature: "FrootAI: Initialize DevKit", desc: "Full .github Agentic OS (19 files) + agent.md + MCP config + plugin.json", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "FrootAI: Initialize TuneKit", desc: "config/*.json + infra/main.bicep + evaluation/ — AI tuning for production", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "FrootAI: Install MCP Server", desc: "Install globally, run via npx, or add .vscode/mcp.json config", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "FrootAI: Start MCP Server", desc: "Launch frootai-mcp in terminal (23 tools: 6 static + 4 live + 3 chain + 3 AI + 6 compute)", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "FrootAI: Initialize Hooks", desc: "Copy guardrails.json (preToolUse policy gates) to your project", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "FrootAI: Initialize Prompts", desc: "Copy 4 slash commands (/deploy, /test, /review, /evaluate)", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "FrootAI: Look Up AI Term", desc: "200+ terms — inline popup with rich definition from curated glossary", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "FrootAI: Search Knowledge Base", desc: "Full-text search across 18 bundled FROOT modules", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "FrootAI: Open Solution Play", desc: "View any play in rich webview panel (standalone, offline)", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "FrootAI: Show Architecture Pattern", desc: "7 decision guides: RAG, agents, hosting, cost, deterministic AI", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "FrootAI: Open Setup Guide", desc: "Opens the setup guide on the website", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "FrootAI: Browse Solution Plays", desc: "Opens the solution plays page on the website", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
            { feature: "FrootAI: Open User Guide", desc: "Opens the user guide documentation", status: "✅ Shipped", link: "/vscode-extension", linkLabel: "Extension →" },
          ]} />
          <div style={{ padding: "16px 20px", borderRadius: "12px", border: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.03)", fontSize: "0.82rem", lineHeight: 1.7, marginTop: "12px" }}>
            <strong style={{ color: "#6366f1" }}>Sidebar Features:</strong> 20 solution plays in TreeView, 16 FROOT modules grouped by layer, 23 MCP tools at a glance. Cached downloads — works offline after first use.
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  7. KNOWLEDGE PLATFORM (16 Modules)                         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="knowledge-platform" style={sectionStyle}>
          <h2 style={h2Style}>7. Knowledge Platform (16 Modules)</h2>
          <p style={descStyle}>
            664KB of curated AI/ML knowledge organized by the FROOT taxonomy — Foundations, Reasoning, Orchestration, Operations, Transformation. Each module is a complete reference accessible via MCP, VS Code, or the website.
          </p>
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>ID</th>
                  <th style={th}>Module Name</th>
                  <th style={{ ...th, minWidth: "80px" }}>Layer</th>
                  <th style={th}>Key Topics</th>
                  <th style={{ ...th, textAlign: "center" }}>Status</th>
                  <th style={th}>Link</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: "F1", name: "GenAI Foundations", layer: "🌱 Foundations", color: "#f59e0b", topics: "Transformers, attention, tokenization, inference, parameters, context windows", link: "/docs/GenAI-Foundations" },
                  { id: "F2", name: "LLM Landscape & Model Selection", layer: "🌱 Foundations", color: "#f59e0b", topics: "GPT, Claude, Llama, Gemini, Phi — benchmarks, open vs proprietary", link: "/docs/LLM-Landscape" },
                  { id: "F3", name: "AI Glossary A–Z", layer: "🌱 Foundations", color: "#f59e0b", topics: "200+ AI/ML terms defined — ablation to zero-shot", link: "/docs/F3-AI-Glossary-AZ" },
                  { id: "F4", name: ".github Agentic OS — 7 Primitives", layer: "🌱 Foundations", color: "#f59e0b", topics: "Instructions, prompts, agents, skills, hooks, workflows, plugins", link: "/docs/F4-GitHub-Agentic-OS" },
                  { id: "R1", name: "Prompt Engineering & Grounding", layer: "🪵 Reasoning", color: "#10b981", topics: "System messages, few-shot, chain-of-thought, structured output", link: "/docs/Prompt-Engineering" },
                  { id: "R2", name: "RAG Architecture & Retrieval", layer: "🪵 Reasoning", color: "#10b981", topics: "Chunking, embeddings, vector search, hybrid search, reranking", link: "/docs/RAG-Architecture" },
                  { id: "R3", name: "Making AI Deterministic & Reliable", layer: "🪵 Reasoning", color: "#10b981", topics: "Hallucination reduction, grounding, temperature tuning, guardrails", link: "/docs/R3-Deterministic-AI" },
                  { id: "O1", name: "Semantic Kernel & Orchestration", layer: "🌿 Orchestration", color: "#06b6d4", topics: "Plugins, planners, memory, connectors, SK vs LangChain", link: "/docs/Semantic-Kernel" },
                  { id: "O2", name: "AI Agents & Agent Framework", layer: "🌿 Orchestration", color: "#06b6d4", topics: "Planning, memory, tool use, AutoGen, multi-agent patterns", link: "/docs/AI-Agents-Deep-Dive" },
                  { id: "O3", name: "MCP, Tools & Function Calling", layer: "🌿 Orchestration", color: "#06b6d4", topics: "Model Context Protocol, tool schemas, A2A, MCP servers", link: "/docs/O3-MCP-Tools-Functions" },
                  { id: "O4", name: "Azure AI Platform & Landing Zones", layer: "🍃 Operations", color: "#6366f1", topics: "AI Foundry, Model Catalog, deployments, endpoints, enterprise patterns", link: "/docs/Azure-AI-Foundry" },
                  { id: "O5", name: "AI Infrastructure & Hosting", layer: "🍃 Operations", color: "#6366f1", topics: "GPU compute, Container Apps, AKS, App Service, scaling, cost", link: "/docs/AI-Infrastructure" },
                  { id: "O6", name: "Copilot Ecosystem & Low-Code AI", layer: "🍃 Operations", color: "#6366f1", topics: "M365 Copilot, Copilot Studio, Power Platform AI, extensibility", link: "/docs/Copilot-Ecosystem" },
                  { id: "T1", name: "Fine-Tuning & Model Customization", layer: "🍎 Transformation", color: "#7c3aed", topics: "LoRA, QLoRA, RLHF, DPO, evaluation, MLOps lifecycle", link: "/docs/T1-Fine-Tuning-MLOps" },
                  { id: "T2", name: "Responsible AI & Safety", layer: "🍎 Transformation", color: "#7c3aed", topics: "Content safety, red teaming, guardrails, evaluation frameworks", link: "/docs/Responsible-AI-Safety" },
                  { id: "T3", name: "Production Architecture Patterns", layer: "🍎 Transformation", color: "#7c3aed", topics: "Multi-agent hosting, API gateway, latency, cost control, monitoring", link: "/docs/T3-Production-Patterns" },
                  { id: "QR", name: "Quick Reference Cards", layer: "📎 Reference", color: "#ec4899", topics: "Cheat sheets, decision trees, comparison matrices, one-pagers", link: "/docs/Quick-Reference-Cards" },
                  { id: "QZ", name: "Quiz & Assessment", layer: "📎 Reference", color: "#ec4899", topics: "Knowledge checks, certification prep, self-assessment questions", link: "/docs/Quiz-Assessment" },
                ].map((m, i) => (
                  <tr key={m.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(16,185,129,0.02)" }}>
                    <td style={{ ...tdCode, color: m.color }}>{m.id}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{m.name}</td>
                    <td style={td}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: m.color }}>{m.layer}</span>
                    </td>
                    <td style={{ ...td, fontSize: "0.78rem", color: "var(--ifm-color-emphasis-500)" }}>{m.topics}</td>
                    <td style={{ ...td, textAlign: "center" }}>✅ Shipped</td>
                    <td style={td}>
                      <Link to={m.link} style={{ color: "#10b981", fontWeight: 600, fontSize: "0.78rem" }}>Read →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  8. AI ASSISTANT & SOLUTION CONFIGURATOR                    */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="ai-assistant" style={sectionStyle}>
          <h2 style={h2Style}>8. AI Assistant & Solution Configurator</h2>
          <p style={descStyle}>
            Two intelligent interfaces for exploring FrootAI. The AI Assistant is a chatbot that recommends plays, compares models, and estimates costs. The Solution Configurator is a 3-question wizard that matches you to the right play.
          </p>
          <FeatureTable rows={[
            { feature: "AI Chatbot", desc: "Conversational interface — ask about plays, models, costs, setup", status: "🔄 Preview", link: "/chatbot", linkLabel: "Try It →" },
            { feature: "Play Recommendation", desc: "Keyword-based play matching (RAG, agent, document, voice, cost)", status: "🔄 Preview", link: "/chatbot", linkLabel: "Try It →" },
            { feature: "Cost Estimation", desc: "Scenario-based pricing for dev/staging/production environments", status: "🔄 Preview", link: "/chatbot", linkLabel: "Try It →" },
            { feature: "Model Comparison", desc: "GPT-4o vs GPT-4o-mini vs Claude — side-by-side analysis", status: "🔄 Preview", link: "/chatbot", linkLabel: "Try It →" },
            { feature: "MCP Server Guidance", desc: "Setup instructions, configuration, troubleshooting in chat", status: "🔄 Preview", link: "/chatbot", linkLabel: "Try It →" },
            { feature: "Solution Configurator", desc: "3-step wizard: What are you building? → Team role? → Complexity? → Play recommendation", status: "✅ Shipped", link: "/configurator", linkLabel: "Configure →" },
            { feature: "8 Use Case Categories", desc: "Doc processing, Search/RAG, Agents, Voice, Safety, Infra, Ops, ML", status: "✅ Shipped", link: "/configurator", linkLabel: "Configure →" },
            { feature: "4 Team Roles", desc: "Platform Eng, App Dev, Data/ML, Security — influences play selection", status: "✅ Shipped", link: "/configurator", linkLabel: "Configure →" },
          ]} />
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  9. PARTNER INTEGRATIONS                                    */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="partner-integrations" style={sectionStyle}>
          <h2 style={h2Style}>9. Partner Integrations</h2>
          <p style={descStyle}>
            MCP-powered integrations with enterprise platforms. Each partner connector provides tool schemas that let your AI agent read from and write to external systems — all through the same MCP protocol.
          </p>
          <FeatureTable rows={[
            { feature: "ServiceNow (ITSM)", desc: "Incident & change management — auto-create tickets, escalate P1s, sync resolution notes", status: "🔄 Preview", link: "/partners", linkLabel: "Partners →" },
            { feature: "Salesforce (CRM)", desc: "Account lookup, case creation/routing, opportunity insights, knowledge search", status: "🔄 Preview", link: "/partners", linkLabel: "Partners →" },
            { feature: "SAP (ERP)", desc: "Purchase order lookup, invoice processing, material master data, workflow triggers", status: "🔄 Preview", link: "/partners", linkLabel: "Partners →" },
            { feature: "Datadog (Monitoring)", desc: "Metric queries, APM trace lookup, alert status, dashboard snapshots", status: "🔄 Preview", link: "/partners", linkLabel: "Partners →" },
            { feature: "PagerDuty (Incident)", desc: "On-call schedule, incident creation, escalation triggers, status page updates", status: "🔄 Preview", link: "/partners", linkLabel: "Partners →" },
            { feature: "Jira (Project)", desc: "Issue create/update, sprint board queries, backlog grooming, velocity reports", status: "🔄 Preview", link: "/partners", linkLabel: "Partners →" },
          ]} />
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  10. PLUGIN MARKETPLACE                                     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="plugin-marketplace" style={sectionStyle}>
          <h2 style={h2Style}>10. Plugin Marketplace</h2>
          <p style={descStyle}>
            A decentralized marketplace where anyone can publish agents, skills, and prompts. Each plugin is defined by a <code>plugin.json</code> manifest. The 20 built-in solution plays are the first published plugins.
          </p>
          <FeatureTable rows={[
            { feature: "plugin.json Manifest", desc: "Standard schema: name, version, type, tags, entry, mcp_tools, config, evaluation", status: "✅ Shipped", link: "/marketplace", linkLabel: "Marketplace →" },
            { feature: "20 Built-in Plugins", desc: "All solution plays published as installable plugins with full DevKit + TuneKit", status: "✅ Shipped", link: "/marketplace", linkLabel: "Marketplace →" },
            { feature: "Community Publishing", desc: "Register your GitHub repo → plugin.json discovered automatically", status: "🔄 Preview", link: "/marketplace", linkLabel: "Marketplace →" },
            { feature: "Plugin Types", desc: "Agents, skills, prompts, workflows, config packs — composable LEGO blocks", status: "🔄 Preview", link: "/marketplace", linkLabel: "Marketplace →" },
            { feature: "Category Index", desc: "RAG, ITSM, security, code-review, compliance, analytics, HR, legal, marketing, infra", status: "🔄 Preview", link: "/marketplace", linkLabel: "Marketplace →" },
            { feature: "One-Click Install", desc: "VS Code Extension will auto-install plugin files into your workspace", status: "🔜 Coming Soon", link: "/marketplace", linkLabel: "Marketplace →" },
          ]} />
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  11. INFRASTRUCTURE (Bicep + AVM)                           */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="infrastructure" style={sectionStyle}>
          <h2 style={h2Style}>11. Infrastructure (Bicep + AVM)</h2>
          <p style={descStyle}>
            Every solution play includes real Azure Bicep templates for provisioning infrastructure. Built on Azure Verified Modules (AVM) patterns — Managed Identity, private endpoints, proper RBAC, no API keys.
          </p>
          <FeatureTable rows={[
            { feature: "infra/main.bicep", desc: "Main deployment template per play — AI Foundry, AI Search, Container Apps, etc.", status: "✅ Shipped", link: "/setup-guide", linkLabel: "Setup →" },
            { feature: "Managed Identity", desc: "All services use system-assigned managed identity — zero API keys", status: "✅ Shipped", link: "/docs/admin-guide", linkLabel: "Admin Guide →" },
            { feature: "Private Endpoints", desc: "VNet integration with private endpoints for AI Search, OpenAI, Storage", status: "✅ Shipped", link: "/docs/admin-guide", linkLabel: "Admin Guide →" },
            { feature: "RBAC Assignments", desc: "Least-privilege role assignments — Cognitive Services User, Search Index Data Reader", status: "✅ Shipped", link: "/docs/admin-guide", linkLabel: "Admin Guide →" },
            { feature: "Key Vault Integration", desc: "Secrets stored in Key Vault with managed identity access", status: "✅ Shipped", link: "/docs/admin-guide", linkLabel: "Admin Guide →" },
            { feature: "Multi-Region Support", desc: "Play 11 (Advanced Landing Zone) supports multi-region with policy governance", status: "✅ Shipped", link: "/solution-plays", linkLabel: "Plays →" },
            { feature: "Azure Verified Modules", desc: "Following AVM patterns for consistent, well-architected infrastructure", status: "✅ Shipped", link: "/docs/architecture-overview", linkLabel: "Architecture →" },
            { feature: "GPU Quota Management", desc: "Landing zone includes GPU quota requests and capacity planning", status: "✅ Shipped", link: "/solution-plays", linkLabel: "Plays →" },
          ]} />
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  12. EVALUATION PIPELINE                                    */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="evaluation-pipeline" style={sectionStyle}>
          <h2 style={h2Style}>12. Evaluation Pipeline</h2>
          <p style={descStyle}>
            Every solution play includes an evaluation pipeline for measuring AI quality before shipping. Test datasets, scoring metrics, and quality gates ensure production readiness.
          </p>
          <FeatureTable rows={[
            { feature: "evaluation/eval.py", desc: "Main evaluation script — runs test suite, scores responses, generates report", status: "✅ Shipped", link: "/docs/api-reference", linkLabel: "API Ref →" },
            { feature: "Test Datasets", desc: "Curated question/answer pairs per play — ground truth for quality measurement", status: "✅ Shipped", link: "/docs/api-reference", linkLabel: "API Ref →" },
            { feature: "Groundedness Score", desc: "Measures how well responses are grounded in source documents (target: >0.95)", status: "✅ Shipped", link: "/docs/user-guide-complete", linkLabel: "User Guide →" },
            { feature: "Relevance Score", desc: "Measures response relevance to the query (target: >0.90)", status: "✅ Shipped", link: "/docs/user-guide-complete", linkLabel: "User Guide →" },
            { feature: "Coherence Score", desc: "Measures logical consistency and readability (target: >0.85)", status: "✅ Shipped", link: "/docs/user-guide-complete", linkLabel: "User Guide →" },
            { feature: "Fluency Score", desc: "Measures language quality and naturalness (target: >0.90)", status: "✅ Shipped", link: "/docs/user-guide-complete", linkLabel: "User Guide →" },
            { feature: "Consistency Check", desc: "Deterministic agent eval — same input produces same output (target: >95%)", status: "✅ Shipped", link: "/docs/user-guide-complete", linkLabel: "User Guide →" },
            { feature: "Quality Gates", desc: "CI/CD integration — block deployment if scores drop below thresholds", status: "✅ Shipped", link: "/docs/architecture-overview", linkLabel: "Architecture →" },
          ]} />
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  13. CI/CD PIPELINE                                         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="cicd-pipeline" style={sectionStyle}>
          <h2 style={h2Style}>13. CI/CD Pipeline</h2>
          <p style={descStyle}>
            GitHub Actions workflows for automated testing, evaluation, and deployment. The agentic CI/CD layer uses AI to review code, run evals, and enforce guardrails before merging.
          </p>
          <FeatureTable rows={[
            { feature: "GitHub Actions CI", desc: "Automated lint, build, test on every PR — standard quality gates", status: "✅ Shipped", link: "https://github.com/gitpavleenbali/frootai/actions", linkLabel: "Actions →" },
            { feature: "Evaluation on PR", desc: "Run eval.py on changed plays — block merge if quality drops", status: "✅ Shipped", link: "/docs/contributor-guide", linkLabel: "Contributing →" },
            { feature: "Agentic Workflows", desc: "Layer 4: AI-driven build → review → tune pipeline in .github/workflows/", status: "✅ Shipped", link: "/docs/architecture-overview", linkLabel: "Architecture →" },
            { feature: "Bicep Validation", desc: "az deployment validate on infrastructure changes — catch errors early", status: "✅ Shipped", link: "/docs/admin-guide", linkLabel: "Admin Guide →" },
            { feature: "npm Publish", desc: "Automated npm publish for frootai-mcp on version bump", status: "✅ Shipped", link: "https://www.npmjs.com/package/frootai-mcp", linkLabel: "npm →" },
            { feature: "Extension Publish", desc: "Automated VS Code Marketplace publish via vsce", status: "✅ Shipped", link: "https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai", linkLabel: "Marketplace →" },
            { feature: "Website Deploy", desc: "Docusaurus build + deploy on main branch push", status: "✅ Shipped", link: "/", linkLabel: "Website →" },
          ]} />
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  14. DEVELOPER HUB                                          */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="developer-hub" style={sectionStyle}>
          <h2 style={h2Style}>14. Developer Hub</h2>
          <p style={descStyle}>
            The central developer portal for building with FrootAI — guides, API reference, changelogs, and architecture documentation. A one-stop shop for contributors and power users.
          </p>
          <FeatureTable rows={[
            { feature: "Admin Guide", desc: "Platform setup, MCP configuration, security hardening, troubleshooting", status: "✅ Shipped", link: "/docs/admin-guide", linkLabel: "Read →" },
            { feature: "User Guide", desc: "End-to-end usage — 19 commands, 23 tools, DevKit/TuneKit deep dive, FAQ", status: "✅ Shipped", link: "/docs/user-guide-complete", linkLabel: "Read →" },
            { feature: "Contributor Guide", desc: "Dev setup, repo structure, PR process, code style, testing requirements", status: "✅ Shipped", link: "/docs/contributor-guide", linkLabel: "Read →" },
            { feature: "API Reference", desc: "All 23 MCP tools with schemas, 16 VS Code commands, config file schemas", status: "✅ Shipped", link: "/docs/api-reference", linkLabel: "Read →" },
            { feature: "Architecture Overview", desc: "System diagram, 6 architectural layers, data flow, deployment topology", status: "✅ Shipped", link: "/docs/architecture-overview", linkLabel: "Read →" },
            { feature: "Changelog", desc: "Full release history — v2.2.0, v0.9.2, v0.9.0, v2.1.1, v1.0.0", status: "✅ Shipped", link: "/dev-hub-changelog", linkLabel: "Read →" },
            { feature: "Quick Start", desc: "3-step getting started: Install Extension → Init DevKit → Deploy", status: "✅ Shipped", link: "/dev-hub", linkLabel: "Dev Hub →" },
          ]} />
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  15. OPEN SOURCE COMMUNITY                                  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="open-source" style={sectionStyle}>
          <h2 style={h2Style}>15. Open Source Community</h2>
          <p style={descStyle}>
            FrootAI is fully open-source under the MIT license. Community contributions are welcome — from new solution plays to knowledge modules to MCP tools.
          </p>
          <FeatureTable rows={[
            { feature: "MIT License", desc: "Fully permissive — use, modify, distribute freely", status: "✅ Shipped", link: "https://github.com/gitpavleenbali/frootai/blob/main/LICENSE", linkLabel: "License →" },
            { feature: "GitHub Issues", desc: "Bug reports, feature requests, and discussion", status: "✅ Shipped", link: "https://github.com/gitpavleenbali/frootai/issues", linkLabel: "Issues →" },
            { feature: "PR Template", desc: "Structured pull request template for consistent contributions", status: "✅ Shipped", link: "https://github.com/gitpavleenbali/frootai/blob/main/.github/pull_request_template.md", linkLabel: "Template →" },
            { feature: "CONTRIBUTING.md", desc: "Contribution guide — setup, conventions, review process", status: "✅ Shipped", link: "https://github.com/gitpavleenbali/frootai/blob/main/CONTRIBUTING.md", linkLabel: "Read →" },
            { feature: "Community Plays", desc: "Anyone can submit new solution plays via PR", status: "✅ Shipped", link: "/docs/contributor-guide", linkLabel: "Contributing →" },
            { feature: "Knowledge Contributions", desc: "Add new FROOT modules or improve existing ones", status: "✅ Shipped", link: "/docs/contributor-guide", linkLabel: "Contributing →" },
            { feature: "Plugin Submissions", desc: "Publish community plugins to the marketplace via plugin.json", status: "🔄 Preview", link: "/marketplace", linkLabel: "Marketplace →" },
          ]} />
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  16. ROADMAP                                                */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="roadmap" style={sectionStyle}>
          <h2 style={h2Style}>16. Roadmap</h2>
          <p style={descStyle}>
            What's next for FrootAI. The roadmap is community-driven — upvote features on GitHub Issues or submit your own ideas.
          </p>
          <FeatureTable rows={[
            { feature: "Full AI Chatbot", desc: "OpenAI-powered assistant with 682KB grounded knowledge, 20 play search, cost estimates", status: "✅ Shipped", link: "/chatbot", linkLabel: "Try Agent FAI →" },
            { feature: "Solution Play Scaffold", desc: "One-command project scaffolding: npx frootai scaffold <play> — creates 5 FROOT kits + froot.json", status: "✅ Shipped", link: "/cli", linkLabel: "CLI Docs →" },
            { feature: "Cost Estimator", desc: "CLI cost command + REST API /api/cost — estimate Azure AI costs per play and scale", status: "✅ Shipped", link: "/api-docs", linkLabel: "API Docs →" },
            { feature: "WAF Alignment Scorecard", desc: "npx frootai validate --waf — 6 pillar, 17 check WAF scorecard per project", status: "✅ Shipped", link: "/cli", linkLabel: "CLI Docs →" },
            { feature: "Docker Multi-Arch", desc: "ghcr.io/gitpavleenbali/frootai-mcp — amd64 + arm64, same 23 tools, Kubernetes-ready", status: "✅ Shipped", link: "/docker", linkLabel: "Docker →" },
            { feature: "REST API", desc: "5 HTTP endpoints: chat, search, cost, health, OpenAPI spec — 60 req/min rate limit", status: "✅ Shipped", link: "/api-docs", linkLabel: "API Docs →" },
            { feature: "One-Click Plugin Install", desc: "Install community plugins directly from Marketplace into your workspace", status: "🔜 Coming Soon", link: "/marketplace", linkLabel: "Marketplace →" },
            { feature: "Agent Evaluation Dashboard", desc: "Visual dashboard for eval scores, trends, and quality gate status", status: "🔜 Coming Soon", link: "/docs/architecture-overview", linkLabel: "Architecture →" },
            { feature: "Multi-Language MCP", desc: "Python and Go MCP server implementations alongside Node.js", status: "🔜 Coming Soon", link: "/mcp-tooling", linkLabel: "MCP →" },
            { feature: "Foundry Agent Hosting", desc: "One-click deploy solution plays as hosted Foundry agents", status: "🔜 Coming Soon", link: "/setup-guide", linkLabel: "Setup →" },
            { feature: "Prompt A/B Testing", desc: "Built-in A/B testing framework for prompt variants across environments", status: "🔜 Coming Soon", link: "/solution-plays", linkLabel: "Plays →" },
            { feature: "Enterprise SSO", desc: "Entra ID integration for team-based access control", status: "🔜 Coming Soon", link: "/enterprise", linkLabel: "Enterprise →" },
            { feature: "Telemetry & Analytics", desc: "App Insights integration for MCP usage analytics and play adoption metrics", status: "🔜 Coming Soon", link: "/docs/admin-guide", linkLabel: "Admin Guide →" },
          ]} />
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  FOOTER                                                     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <footer style={{
          textAlign: "center", padding: "32px 24px", borderRadius: "16px",
          border: "1px solid var(--ifm-color-emphasis-200)", background: "var(--ifm-background-surface-color)",
        }}>
          <p style={{ fontSize: "0.78rem", color: "var(--ifm-color-emphasis-400)", marginBottom: "16px" }}>
            Last updated: March 27, 2026 &nbsp;|&nbsp; Version 3.2.0 &nbsp;|&nbsp; FrootAI — Complete Feature Specification
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { label: "🏠 Dev Hub", to: "/dev-hub", color: "#10b981" },
              { label: "📋 Changelog", to: "/dev-hub-changelog", color: "#7c3aed" },
              { label: "🎯 Solution Plays", to: "/solution-plays", color: "#f59e0b" },
              { label: "🔌 MCP Tooling", to: "/mcp-tooling", color: "#06b6d4" },
              { label: "⭐ GitHub", to: "https://github.com/gitpavleenbali/frootai", color: "#6366f1" },
            ].map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className={styles.glowPill}
                style={{ "--pill-color": link.color, display: "inline-block" } as React.CSSProperties}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </footer>

      </div>
    </Layout>
  );
}
