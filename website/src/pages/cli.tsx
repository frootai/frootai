import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";

const codeStyle: React.CSSProperties = {
  display: "block", padding: "14px 18px", borderRadius: "12px", fontSize: "0.82rem",
  fontFamily: "var(--ifm-font-family-monospace)", background: "rgba(16, 185, 129, 0.04)",
  border: "1px solid rgba(16, 185, 129, 0.12)", lineHeight: "1.7", marginBottom: "16px",
  overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" as any, maxWidth: "100%",
};

const cardStyle: React.CSSProperties = {
  padding: "24px", borderRadius: "14px", border: "1px solid var(--ifm-color-emphasis-200)",
  background: "var(--ifm-background-surface-color)", marginBottom: "20px",
};

const h2Style: React.CSSProperties = { fontSize: "1.3rem", fontWeight: 700, marginBottom: "12px", marginTop: "40px" };
const h3Style: React.CSSProperties = { fontSize: "1.05rem", fontWeight: 700, marginBottom: "8px", marginTop: "24px" };
const labelStyle: React.CSSProperties = { fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" as any, color: "var(--ifm-color-emphasis-500)", marginBottom: "6px" };

export default function CLIPage(): JSX.Element {
  return (
    <Layout title="CLI — FrootAI" description="FrootAI CLI: scaffold projects, search knowledge, estimate costs, and validate configs from the terminal.">
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px 80px" }}>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "8px" }}>⚡ FrootAI CLI</h1>
        <p style={{ fontSize: "0.95rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "32px" }}>
          Scaffold projects, search knowledge, estimate costs, and validate configs — all from the terminal.<br />
          Ships with the <Link to="/setup-guide">MCP Server package</Link>. No extra install needed.
        </p>

        {/* ══ INSTALL ══ */}
        <div style={cardStyle}>
          <p style={labelStyle}>No install needed — runs via npx</p>
          <pre style={codeStyle}>{`npx frootai <command>`}</pre>
          <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-600)" }}>
            Or if you've installed <code>frootai-mcp</code> globally: just <code>frootai &lt;command&gt;</code>
          </p>
        </div>

        {/* ══ COMMANDS ══ */}
        <h2 style={h2Style}>📋 Commands</h2>

        {/* --- init --- */}
        <div style={cardStyle}>
          <h3 style={h3Style}>🚀 <code>frootai init</code></h3>
          <p style={{ fontSize: "0.88rem" }}>Interactive project scaffolding. 3 questions → complete FrootAI project.</p>
          <pre style={codeStyle}>{`$ npx frootai init

  🌳 FrootAI™ CLI v3.1.2
  From the Roots to the Fruits

  Let's set up your FrootAI-powered project!

  What are you building?
  1) Enterprise RAG (document Q&A, knowledge base)
  2) AI Agent (multi-step reasoning, tool calling)
  3) AI Gateway (API management, cost control)
  4) Content Moderation (safety, compliance)
  5) Multi-modal (vision, document intelligence)
  6) Custom (pick from 20 solution plays)

  Choose [1-6]: 1

  Target scale?
  1) dev   — Local development, minimal cost
  2) prod  — Production, high availability

  Choose [1-2]: 1

  Project name [my-ai-project]: my-rag-app`}</pre>
          <p style={labelStyle}>What gets created</p>
          <pre style={codeStyle}>{`my-rag-app/
├── .vscode/mcp.json          ← MCP server auto-connects in VS Code
├── .github/
│   ├── agents/               ← Builder, Reviewer, Tuner agent definitions
│   ├── copilot-instructions.md
│   └── instructions/
├── config/
│   ├── openai.json           ← Model, temperature, max_tokens
│   ├── search.json           ← Azure AI Search settings
│   └── guardrails.json       ← Safety + PII + grounding rules
├── evaluation/
│   └── eval-config.json      ← Groundedness, relevance thresholds
├── infra/                    ← Infrastructure templates
└── README.md`}</pre>
          <p style={{ fontSize: "0.82rem" }}>
            Then: <code>cd my-rag-app && code .</code> — FrootAI MCP auto-connects, agents are ready.
          </p>
        </div>

        {/* --- scaffold --- */}
        <div style={cardStyle}>
          <h3 style={h3Style}>📐 <code>frootai scaffold &lt;play&gt;</code></h3>
          <p style={{ fontSize: "0.88rem" }}>One-command play scaffold. Creates all 5 FROOT kits + froot.json manifest.</p>
          <pre style={codeStyle}>{`$ npx frootai scaffold 01-enterprise-rag
# or shorthand:
$ npx frootai scaffold play-01

  🌳 FrootAI™ CLI v3.1.2

  Scaffolding play: 01-enterprise-rag

  ✅ Play scaffolded: 01-enterprise-rag

  Files created:
  .vscode/mcp.json             ← MCP auto-connect
  .github/agents/              ← Builder + Reviewer + Tuner
  .github/instructions/        ← 5 WAF instruction files
  config/                      ← OpenAI + Search + Guardrails
  evaluation/                  ← Eval config + thresholds
  spec/play-spec.json          ← SpecKit (WAF alignment)
  froot.json                   ← Play manifest (5 kits)`}</pre>
          <p style={{ fontSize: "0.82rem" }}>
            Auto-detects existing projects and merges files. Includes <strong>froot.json</strong> manifest linking all 5 kits.
          </p>
        </div>

        {/* --- search --- */}
        <div style={cardStyle}>
          <h3 style={h3Style}>🔍 <code>frootai search &lt;query&gt;</code></h3>
          <p style={{ fontSize: "0.88rem" }}>Search the FrootAI knowledge base (16 FROOT modules) from the terminal.</p>
          <pre style={codeStyle}>{`$ npx frootai search "RAG architecture"

  Searching: "RAG architecture"

  Found 3 result(s):

  📖 R2 — RAG Architecture & Retrieval
     Layer: Reasoning
  📖 O4 — Azure AI Platform & Landing Zones
     Layer: Orchestration
  📖 T3 — Production Architecture Patterns
     Layer: Transformation`}</pre>
        </div>

        {/* --- cost --- */}
        <div style={cardStyle}>
          <h3 style={h3Style}>💰 <code>frootai cost [play] --scale &lt;dev|prod&gt;</code></h3>
          <p style={{ fontSize: "0.88rem" }}>Estimate Azure infrastructure costs for any solution play at dev or prod scale.</p>
          <pre style={codeStyle}>{`$ npx frootai cost enterprise-rag --scale prod

  Cost Estimate: enterprise-rag (prod)

  Service                        | Cost
  ───────────────────────────────┼─────────────────────────
  AI Search                      | $250/mo (S1)
  OpenAI (GPT-4o)                | ~$150/mo (moderate)
  App Service                    | $55/mo (B1)
  Storage                        | $0.02/GB/mo
  Cosmos DB                      | $25/mo (400 RU/s)
  Total estimate                 | ~$500-800/mo`}</pre>
        </div>

        {/* --- validate --- */}
        <div style={cardStyle}>
          <h3 style={h3Style}>✅ <code>frootai validate</code></h3>
          <p style={{ fontSize: "0.88rem" }}>Check that your project has the right structure, configs, and MCP setup.</p>
          <pre style={codeStyle}>{`$ npx frootai validate

  ✅ MCP config — .vscode/mcp.json
  ✅ Copilot instructions — .github/copilot-instructions.md
  ✅ Builder agent — .github/agents/builder.agent.md
  ✅ Reviewer agent — .github/agents/reviewer.agent.md
  ✅ Tuner agent — .github/agents/tuner.agent.md
  ✅ OpenAI config — config/openai.json
  ✅ Guardrails config — config/guardrails.json
  ✅ MCP server configured: frootai

  8/8 checks passed`}</pre>
        </div>

        {/* --- doctor --- */}
        <div style={cardStyle}>
          <h3 style={h3Style}>🩺 <code>frootai doctor</code></h3>
          <p style={{ fontSize: "0.88rem" }}>Health check for your development environment — verifies Node.js, npm, git, VS Code, and MCP connectivity.</p>
          <pre style={codeStyle}>{`$ npx frootai doctor

  ✅ Node.js v22.0.0 (>= 18 required)
  ✅ npm 10.8.0
  ✅ git version 2.45.0
  ✅ VS Code 1.96.0
  ✅ .vscode/mcp.json found
  ✅ .github/agents/ found
  ✅ frootai-mcp available on npm`}</pre>
        </div>

        {/* --- version --- */}
        <div style={cardStyle}>
          <h3 style={h3Style}>📌 <code>frootai version</code></h3>
          <pre style={codeStyle}>{`$ npx frootai version
frootai-mcp v3.1.2`}</pre>
        </div>

        {/* ══ HOW IT WORKS ══ */}
        <h2 style={h2Style}>🔗 How It Connects</h2>
        <div style={cardStyle}>
          <pre style={{ ...codeStyle, fontSize: "0.75rem" }}>{`┌──────────────────────────────────────────────┐
│  npx frootai init                            │
│  ├── Scaffolds project structure             │
│  ├── Creates .vscode/mcp.json               │
│  ├── Creates .github/agents/ (3 agents)      │
│  └── Creates config/ (3 config files)        │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  code .                                      │
│  └── VS Code reads .vscode/mcp.json         │
│      └── Auto-starts frootai-mcp server      │
│          └── 23 tools available to Copilot   │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  @builder / @reviewer / @tuner               │
│  └── Copilot agents use MCP tools            │
│      └── Architecture patterns, cost est,    │
│          config validation, play search      │
└──────────────────────────────────────────────┘`}</pre>
        </div>

        {/* ══ LINKS ══ */}
        <h2 style={h2Style}>📎 Related</h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link to="/setup-guide" style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.04)", color: "var(--ifm-font-color-base)", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none" }}>📦 Setup Guide</Link>
          <Link to="/mcp-tooling" style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.04)", color: "var(--ifm-font-color-base)", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none" }}>🔌 23 MCP tools</Link>
          <Link to="/solution-plays" style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid rgba(249,115,22,0.3)", background: "rgba(249,115,22,0.04)", color: "var(--ifm-font-color-base)", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none" }}>🎯 Solution Plays</Link>
        </div>

      </div>
    </Layout>
  );
}
