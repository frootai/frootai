import React, { useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";

const codeStyle: React.CSSProperties = {
  display: "block", padding: "12px 16px", borderRadius: "12px", fontSize: "0.78rem",
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

export default function SetupGuidePage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<"clone" | "vscode" | "foundry">("clone");

  return (
    <Layout title="Setup Guide — FrootAI" description="Step-by-step guide to set up FrootAI MCP Server and VS Code Extension for your development ecosystem.">
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px 80px" }}>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "8px" }}>📖 FrootAI Setup Guide</h1>
        <p style={{ fontSize: "0.95rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "32px" }}>
          Two tools, one setup page. Get FrootAI's <strong>MCP Server</strong> (for your AI agent) and <strong>VS Code Extension</strong> (for you) up and running in minutes. Plus <strong>CLI</strong>, <strong>Docker</strong>, and <strong>Python</strong> options.
        </p>

        {/* ══ SECTION SELECTOR ══ */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "32px", justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => { document.getElementById('mcp-section')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ padding: "10px 24px", borderRadius: "10px", border: "2px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.04)", color: "var(--ifm-font-color-base)", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer" }}>
            📦 MCP Server Setup
          </button>
          <button onClick={() => { document.getElementById('vscode-section')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ padding: "10px 24px", borderRadius: "10px", border: "2px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.04)", color: "var(--ifm-font-color-base)", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer" }}>
            💻 VS Code Extension Setup
          </button>
          <button onClick={() => { document.getElementById('cli-section')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ padding: "10px 24px", borderRadius: "10px", border: "2px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.04)", color: "var(--ifm-font-color-base)", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer" }}>
            ⚡ CLI Setup
          </button>
          <button onClick={() => { document.getElementById('docker-section')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ padding: "10px 24px", borderRadius: "10px", border: "2px solid rgba(6,182,212,0.3)", background: "rgba(6,182,212,0.04)", color: "var(--ifm-font-color-base)", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer" }}>
            🐳 Docker Setup
          </button>
          <button onClick={() => { document.getElementById('python-section')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ padding: "10px 24px", borderRadius: "10px", border: "2px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.04)", color: "var(--ifm-font-color-base)", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer" }}>
            🐍 Python Setup
          </button>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* PART 1: MCP SERVER                                     */}
        {/* ═══════════════════════════════════════════ */}
        <div id="mcp-section" style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.02)", marginBottom: "48px" }}>
          <h2 style={{ ...h2Style, marginTop: 0, color: "#10b981" }}>📦 Part 1: MCP Server Setup</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "20px" }}>
            Add AI architecture knowledge to any agent. Works with Claude Desktop, VS Code Copilot, Cursor, Windsurf, Azure MS Foundry, and any MCP-compatible client.
          </p>

        {/* ── Prerequisites ── */}
        <div style={cardStyle}>
          <h2 style={{ ...h2Style, marginTop: 0 }}>Prerequisites</h2>
          <ul style={{ fontSize: "0.88rem", lineHeight: 1.8 }}>
            <li><strong>Node.js 18+</strong> — <a href="https://nodejs.org/">Download here</a></li>
            <li><strong>Git</strong> — <a href="https://git-scm.com/">Download here</a></li>
            <li><strong>An MCP client</strong> — VS Code, Claude Desktop, Cursor, Windsurf, or Azure AI Foundry</li>
          </ul>
        </div>

        {/* ── Step 1 ── */}
        <h2 style={h2Style}>Step 1: Install</h2>

        <h3 style={h3Style}>Option A: npm (Recommended — zero clone)</h3>
        <div style={codeStyle}>
{`# Run directly (no install needed)
npx frootai-mcp@latest

# OR install globally
npm install -g frootai-mcp@latest
frootai-mcp`}
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)" }}>
          Published on <a href="https://www.npmjs.com/package/frootai-mcp" target="_blank">npmjs.com/package/frootai-mcp</a> — 682KB knowledge base bundled inside. Works from anywhere.
        </p>

        <h3 style={h3Style}>Option B: Docker (no Node.js needed)</h3>
        <div style={codeStyle}>
{`docker run -i ghcr.io/gitpavleenbali/frootai-mcp`}
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)" }}>
          Published on <a href="https://github.com/gitpavleenbali/frootai/pkgs/container/frootai-mcp" target="_blank">GitHub Container Registry</a> — same 22 tools, runs anywhere Docker runs.
        </p>

        <h3 style={h3Style}>Option C: From GitHub (for development)</h3>
        <div style={codeStyle}>
{`# Clone the repository
git clone https://github.com/gitpavleenbali/frootai.git

# Navigate to MCP server
cd frootai/mcp-server

# Install dependencies
npm install`}
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)" }}>
          That's it — the MCP server is ready. The <code>knowledge.json</code> (664 KB) contains all 16 modules bundled. No additional setup needed.
        </p>

        {/* ── Step 2: Configure ── */}
        <h2 style={h2Style}>Step 2: Connect to Your Client</h2>
        <p style={{ fontSize: "0.88rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "16px" }}>
          Choose your client and add the FrootAI server to its MCP configuration:
        </p>

        {/* Tab selector */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          {[
            { id: "clone" as const, label: "Claude Desktop / Cursor" },
            { id: "vscode" as const, label: "VS Code / GitHub Copilot" },
            { id: "foundry" as const, label: "Azure AI Foundry" },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--ifm-color-emphasis-200)",
              background: activeTab === tab.id ? "rgba(99, 102, 241, 0.1)" : "transparent",
              borderColor: activeTab === tab.id ? "#6366f1" : undefined,
              color: "var(--ifm-font-color-base)", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "clone" && (
          <div style={cardStyle}>
            <h3 style={{ ...h3Style, marginTop: 0 }}>Claude Desktop / Cursor / Windsurf</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)" }}>
              Open your config file and add the FrootAI server:
            </p>
            <p style={{ fontSize: "0.78rem", color: "var(--ifm-color-emphasis-400)" }}>
              <strong>Config file location:</strong><br />
              macOS: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code><br />
              Windows: <code>%APPDATA%\Claude\claude_desktop_config.json</code><br />
              Cursor: Settings → MCP Servers → Add
            </p>
            <div style={codeStyle}>
{`{
  "mcpServers": {
    "frootai": {
      "command": "node",
      "args": ["/absolute/path/to/frootai/mcp-server/index.js"]
    }
  }
}`}
            </div>
            <p style={{ fontSize: "0.82rem", color: "#10b981" }}>
              ✅ Restart Claude Desktop / Cursor. FrootAI will appear in your tools list.
            </p>
          </div>
        )}

        {activeTab === "vscode" && (
          <div style={cardStyle}>
            <h3 style={{ ...h3Style, marginTop: 0 }}>VS Code / GitHub Copilot</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)" }}>
              <strong>Option A (Auto):</strong> Open the <code>frootai</code> folder in VS Code. The <code>.vscode/mcp.json</code> auto-connects the MCP server.
            </p>
            <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)" }}>
              <strong>Option B (Manual):</strong> Create <code>.vscode/mcp.json</code> in your project:
            </p>
            <div style={codeStyle}>
{`{
  "servers": {
    "frootai": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/frootai/mcp-server/index.js"]
    }
  }
}`}
            </div>
            <p style={{ fontSize: "0.82rem", color: "#10b981" }}>
              ✅ Reload VS Code. Type <code>@frootai</code> in Copilot Chat to query the knowledge base.
            </p>
          </div>
        )}

        {activeTab === "foundry" && (
          <div style={cardStyle}>
            <h3 style={{ ...h3Style, marginTop: 0 }}>Azure AI Foundry (Microsoft Foundry)</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)" }}>
              In Azure AI Foundry, you can add FrootAI as an MCP tool to your agent:
            </p>
            <ol style={{ fontSize: "0.85rem", lineHeight: 1.8 }}>
              <li>Open your Agent in Azure AI Foundry</li>
              <li>Below the agent instructions, click <strong>Tools → Add Tool</strong></li>
              <li>Select <strong>MCP</strong> from the tool type dropdown</li>
              <li>Point to the FrootAI MCP server (run locally via VS Code terminal or expose as endpoint)</li>
              <li>The 10 FrootAI tools will appear in your agent's tool list</li>
            </ol>
            <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-400)" }}>
              <strong>Tip:</strong> Run the MCP server in your VS Code terminal (<code>cd mcp-server && node index.js</code>), then connect from Foundry. VS Code acts as the bridge.
            </p>
          </div>
        )}

        {/* ── Step 3: Verify ── */}
        <h2 style={h2Style}>Step 3: Verify It Works</h2>
        <p style={{ fontSize: "0.88rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "16px" }}>
          Ask your agent any of these to confirm FrootAI is connected:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {[
            { q: '"What is temperature in LLMs?"', tool: "lookup_term", result: "Returns precise glossary definition" },
            { q: '"List all FrootAI modules"', tool: "list_modules", result: "Shows 5 FROOT layers with 16 modules" },
            { q: '"How do I design a RAG pipeline?"', tool: "get_architecture_pattern", result: "Returns complete RAG design guide" },
            { q: '"Search for hallucination reduction"', tool: "search_knowledge", result: "Returns top sections across modules" },
          ].map((item) => (
            <div key={item.q} style={{ ...cardStyle, marginBottom: 0 }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: "4px" }}>{item.q}</div>
              <div style={{ fontSize: "0.75rem", color: "#10b981", fontFamily: "var(--ifm-font-family-monospace)" }}>→ {item.tool}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--ifm-color-emphasis-500)", marginTop: "4px" }}>{item.result}</div>
            </div>
          ))}
        </div>

        {/* ── 5 Tools Reference ── */}
        <h2 style={h2Style}>Available Tools</h2>
        <div className="table-scroll-wrapper">
        <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse", minWidth: "600px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--ifm-color-emphasis-200)" }}>
              <th style={{ padding: "10px 12px", textAlign: "left" }}>Tool</th>
              <th style={{ padding: "10px 12px", textAlign: "left" }}>Parameters</th>
              <th style={{ padding: "10px 12px", textAlign: "left" }}>Returns</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: "list_modules", params: "none", returns: "All 16 modules organized by FROOT layer" },
              { name: "get_module", params: "module_id (F1–T3), section? (optional)", returns: "Full module content or specific section" },
              { name: "lookup_term", params: "term (string)", returns: "Glossary definition from 200+ terms" },
              { name: "search_knowledge", params: "query (string), max_results? (1–10)", returns: "Ranked matching sections across modules" },
              { name: "get_architecture_pattern", params: "scenario (enum)", returns: "Pre-built decision guide with recommendations" },
              { name: "get_froot_overview", params: "none", returns: "Complete FROOT framework summary" },
              { name: "fetch_azure_docs", params: "service (string)", returns: "Live Azure docs from Microsoft Learn (falls back to static)" },
              { name: "fetch_external_mcp", params: "query (string)", returns: "MCP servers from registries (falls back to curated list)" },
              { name: "list_community_plays", params: "filter? (string)", returns: "20 solution plays from GitHub (falls back to bundled list)" },
              { name: "get_github_agentic_os", params: "primitive? (enum)", returns: ".github agentic OS guide per primitive" },
            ].map((tool) => (
              <tr key={tool.name} style={{ borderBottom: "1px solid var(--ifm-color-emphasis-100)" }}>
                <td style={{ padding: "10px 12px", fontFamily: "var(--ifm-font-family-monospace)", color: "#10b981", fontWeight: 600 }}>{tool.name}</td>
                <td style={{ padding: "10px 12px" }}>{tool.params}</td>
                <td style={{ padding: "10px 12px" }}>{tool.returns}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* ── Architecture Patterns ── */}
        <h2 style={h2Style}>Architecture Pattern Scenarios</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
          {[
            { scenario: "rag_pipeline", label: "RAG Pipeline" },
            { scenario: "agent_hosting", label: "Agent Hosting" },
            { scenario: "model_selection", label: "Model Selection" },
            { scenario: "cost_optimization", label: "Cost Optimization" },
            { scenario: "deterministic_ai", label: "Deterministic AI" },
            { scenario: "multi_agent", label: "Multi-Agent" },
            { scenario: "fine_tuning_decision", label: "Fine-Tuning Decision" },
          ].map((p) => (
            <div key={p.scenario} style={{ padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--ifm-color-emphasis-200)", fontSize: "0.82rem" }}>
              <code style={{ color: "#6366f1" }}>{p.scenario}</code><br />
              <span style={{ color: "var(--ifm-color-emphasis-500)" }}>{p.label}</span>
            </div>
          ))}
        </div>
        </div>{/* end MCP section */}

        {/* ═══════════════════════════════════════════ */}
        {/* PART 2: VS CODE EXTENSION                  */}
        {/* ═══════════════════════════════════════════ */}
        <div id="vscode-section" style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.02)", marginBottom: "48px" }}>
          <h2 style={{ ...h2Style, marginTop: 0, color: "#6366f1" }}>💻 Part 2: VS Code Extension Setup</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "20px" }}>
            Browse solution plays, search 200+ AI terms, initialize DevKit — right from your editor sidebar.
          </p>

          <h3 style={h3Style}>Step 1: Install</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)" }}>
            <strong>Option A (Marketplace):</strong> Open VS Code → Extensions (<code>Ctrl+Shift+X</code>) → Search <strong>"FrootAI"</strong> → Install
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)" }}>
            <strong>Option B (Terminal):</strong>
          </p>
          <div style={codeStyle}>{`code --install-extension pavleenbali.frootai`}</div>
          <p style={{ fontSize: "0.82rem", color: "#6366f1" }}>
            ✅ Reload VS Code. FrootAI panels appear in your sidebar.
          </p>

          <h3 style={h3Style}>Step 2: Explore the Sidebar</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "12px" }}>
            After install, you'll see 3 panels in the sidebar:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px", marginBottom: "20px" }}>
            {[
              { icon: "📋", title: "Solution Plays", desc: "Browse all 20 plays. Click to open README or folder." },
              { icon: "📖", title: "FROOT Modules", desc: "16 modules grouped by FROOT layer." },
              { icon: "🔌", title: "MCP Tools", desc: "See all 22 MCP tools at a glance." },
            ].map(p => (
              <div key={p.title} style={{ padding: "12px", borderRadius: "10px", border: "1px solid var(--ifm-color-emphasis-200)", textAlign: "center" }}>
                <div style={{ fontSize: "1.2rem", marginBottom: "4px" }}>{p.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "2px" }}>{p.title}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--ifm-color-emphasis-500)" }}>{p.desc}</div>
              </div>
            ))}
          </div>

          <h3 style={h3Style}>Step 3: Use Commands (Ctrl+Shift+P)</h3>
          <div style={{ marginBottom: "20px" }}>
            {[
              { cmd: "FrootAI: Look Up AI Term", desc: "Type any AI/ML term → jumps to definition" },
              { cmd: "FrootAI: Search Knowledge Base", desc: "Full-text search across all 18 docs" },
              { cmd: "FrootAI: Initialize DevKit", desc: "Full .github Agentic OS (19 files) + agent.md + MCP + plugin.json" },
              { cmd: "FrootAI: Initialize Hooks", desc: "Copy guardrails.json (preToolUse policy gates)" },
              { cmd: "FrootAI: Initialize Prompts", desc: "Copy 4 slash commands (/deploy, /test, /review, /evaluate)" },
              { cmd: "FrootAI: Open Solution Play", desc: "Opens a play's README with option to open folder" },
              { cmd: "FrootAI: Show Architecture Pattern", desc: "Pick from 7 patterns: RAG, agents, hosting, cost" },
              { cmd: "FrootAI: Open Setup Guide", desc: "Opens this setup guide page" },
              { cmd: "FrootAI: Browse Solution Plays", desc: "Opens solution plays page on the website" },
            ].map(c => (
              <div key={c.cmd} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--ifm-color-emphasis-100)", marginBottom: "4px", display: "flex", gap: "10px", alignItems: "center" }}>
                <code style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6366f1", whiteSpace: "nowrap" }}>{c.cmd}</code>
                <span style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-500)" }}>{c.desc}</span>
              </div>
            ))}
          </div>

          <h3 style={h3Style}>Step 4: Initialize DevKit for a Solution Play</h3>
          <div style={{ padding: "14px 18px", borderRadius: "12px", border: "1px solid rgba(6,182,212,0.2)", background: "rgba(6,182,212,0.03)", fontSize: "0.82rem", lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 6px" }}><strong>1.</strong> Run <code>Ctrl+Shift+P → FrootAI: Initialize DevKit</code></p>
            <p style={{ margin: "0 0 6px" }}><strong>2.</strong> Select a solution play (e.g., Enterprise RAG)</p>
            <p style={{ margin: "0 0 6px" }}><strong>3.</strong> FrootAI copies the <strong>full .github Agentic OS</strong> (19 files) + agent.md + .vscode/mcp.json + plugin.json to your workspace</p>
            <p style={{ margin: 0 }}><strong>4.</strong> Start coding — Copilot has full agentic context: instructions, prompts, agents, skills, hooks, workflows.</p>
          </div>

          <h3 style={h3Style}>Troubleshooting</h3>
          <div style={cardStyle}>
            {[
              { q: "Extension not showing in sidebar", a: "Reload VS Code (Ctrl+Shift+P → 'Reload Window'). Ensure v0.2.0+ is installed." },
              { q: "Commands not appearing", a: "Check that FrootAI is enabled in Extensions. Try reinstalling: code --install-extension pavleenbali.frootai" },
              { q: "DevKit Init copies nothing", a: "Ensure you have a workspace folder open. FrootAI copies files to the root of your active workspace." },
              { q: "MCP tools panel empty", a: "This is informational — it shows what tools the MCP server exposes. Install the MCP server separately (see Part 1)." },
            ].map(item => (
              <details key={item.q} style={{ marginBottom: "8px" }}>
                <summary style={{ fontWeight: 600, fontSize: "0.88rem", cursor: "pointer" }}>{item.q}</summary>
                <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)", marginTop: "6px" }}>{item.a}</p>
              </details>
            ))}
          </div>
        </div>{/* end VS Code section */}

        {/* ── General Troubleshooting ── */}
        <h2 style={h2Style}>General Troubleshooting</h2>
        <div style={cardStyle}>
          {[
            { q: "Server not appearing in tool list", a: "Restart your MCP client after adding the config. Ensure the path to index.js is absolute." },
            { q: "Module not found", a: "Run `npm run build` in mcp-server/ to regenerate knowledge.json from the docs/ folder." },
            { q: "Node.js version error", a: "FrootAI requires Node.js 18+. Check with `node --version`." },
            { q: "Permission denied on macOS/Linux", a: "Run `chmod +x mcp-server/index.js` to make the entry point executable." },
          ].map((item) => (
            <details key={item.q} style={{ marginBottom: "8px" }}>
              <summary style={{ fontWeight: 600, fontSize: "0.88rem", cursor: "pointer" }}>{item.q}</summary>
              <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)", marginTop: "6px" }}>{item.a}</p>
            </details>
          ))}
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* PART 3: CLI                                            */}
        {/* ═══════════════════════════════════════════ */}
        <div id="cli-section" style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.02)", marginBottom: "48px" }}>
          <h2 style={{ ...h2Style, marginTop: 0, color: "#f59e0b" }}>⚡ Part 3: CLI Setup</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "20px" }}>
            Scaffold projects, search knowledge, estimate costs, and validate configs — all from the terminal. No install needed.
          </p>
          <div style={cardStyle}>
            <h3 style={{ ...h3Style, marginTop: 0 }}>Quick Start</h3>
            <pre style={codeStyle}>{`# Run any command directly via npx
npx frootai help

# Interactive project scaffolding
npx frootai init

# One-command play scaffold
npx frootai scaffold 01-enterprise-rag

# Search knowledge
npx frootai search "RAG architecture"

# WAF alignment scorecard
npx frootai validate --waf

# Health check
npx frootai doctor`}</pre>
          </div>
          <div style={cardStyle}>
            <h3 style={{ ...h3Style, marginTop: 0 }}>All 8 Commands</h3>
            <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: "1px solid var(--ifm-color-emphasis-200)" }}><th style={{ textAlign: "left", padding: "8px" }}>Command</th><th style={{ textAlign: "left", padding: "8px" }}>What it does</th></tr></thead>
              <tbody>
                {[
                  ["init", "Interactive project scaffolding (auto-detects existing projects)"],
                  ["scaffold <play>", "One-command play setup with all 5 FROOT kits"],
                  ["search <query>", "Search 16 knowledge modules"],
                  ["cost <play>", "Estimate Azure AI costs (--scale dev|prod)"],
                  ["validate", "Check project structure + configs"],
                  ["validate --waf", "WAF alignment scorecard (6 pillars, 17 checks)"],
                  ["doctor", "Health check: Node.js, npm, VS Code, MCP"],
                  ["help", "Show all commands"],
                ].map(([cmd, desc]) => (
                  <tr key={cmd} style={{ borderBottom: "1px solid var(--ifm-color-emphasis-100)" }}>
                    <td style={{ padding: "8px", fontFamily: "var(--ifm-font-family-monospace)", fontWeight: 600 }}>{cmd}</td>
                    <td style={{ padding: "8px" }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: "0.82rem", textAlign: "center" }}>
            <Link to="/cli" style={{ color: "#f59e0b", fontWeight: 600 }}>Full CLI Documentation →</Link>
          </p>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* PART 4: DOCKER                                         */}
        {/* ═══════════════════════════════════════════ */}
        <div id="docker-section" style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(6,182,212,0.2)", background: "rgba(6,182,212,0.02)", marginBottom: "48px" }}>
          <h2 style={{ ...h2Style, marginTop: 0, color: "#06b6d4" }}>🐳 Part 4: Docker Setup</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "20px" }}>
            Run FrootAI anywhere — no Node.js required. Multi-arch (amd64 + arm64). Same 22 tools, 682KB knowledge.
          </p>
          <div style={cardStyle}>
            <h3 style={{ ...h3Style, marginTop: 0 }}>Quick Start</h3>
            <pre style={codeStyle}>{`# Pull and run (auto-selects architecture)
docker run -i --rm ghcr.io/gitpavleenbali/frootai-mcp:latest

# Pin a specific version
docker run -i --rm ghcr.io/gitpavleenbali/frootai-mcp:3.1.2`}</pre>
          </div>
          <div style={cardStyle}>
            <h3 style={{ ...h3Style, marginTop: 0 }}>Claude Desktop / Cursor</h3>
            <pre style={codeStyle}>{`{
  "mcpServers": {
    "frootai": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/gitpavleenbali/frootai-mcp:latest"]
    }
  }
}`}</pre>
          </div>
          <div style={cardStyle}>
            <h3 style={{ ...h3Style, marginTop: 0 }}>VS Code Copilot (.vscode/mcp.json)</h3>
            <pre style={codeStyle}>{`{
  "servers": {
    "frootai": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/gitpavleenbali/frootai-mcp:latest"],
      "type": "stdio"
    }
  }
}`}</pre>
          </div>
          <p style={{ fontSize: "0.82rem", textAlign: "center" }}>
            <Link to="/docker" style={{ color: "#06b6d4", fontWeight: 600 }}>Full Docker Documentation →</Link>
          </p>
        </div>

        {/* PART 5: PYTHON                                       */}
        {/* ═══════════════════════════════════════════ */}
        <div id="python-section" style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.02)", marginBottom: "48px" }}>
          <h2 style={{ ...h2Style, marginTop: 0, color: "#3b82f6" }}>🐍 Part 5: Python SDK + MCP Server</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "20px" }}>
            Offline-first Python access to FrootAI's 16 knowledge modules, 20 solution plays, cost estimation, evaluation, and A/B testing. Zero external dependencies.
          </p>
          <div style={cardStyle}>
            <h3 style={{ ...h3Style, marginTop: 0 }}>Install</h3>
            <pre style={codeStyle}>{`# Python SDK — offline knowledge access
pip install frootai

# Python MCP Server — runs as stdio MCP server
pip install frootai-mcp`}</pre>
          </div>
          <div style={cardStyle}>
            <h3 style={{ ...h3Style, marginTop: 0 }}>Python CLI</h3>
            <pre style={codeStyle}>{`frootai plays                   # List all 20 solution plays
frootai search "RAG architecture"  # Search knowledge base
frootai modules                 # List all 16 modules
frootai glossary embeddings     # Look up a term
frootai cost 01-enterprise-rag --scale prod  # Azure cost estimate`}</pre>
          </div>
          <div style={cardStyle}>
            <h3 style={{ ...h3Style, marginTop: 0 }}>Python API</h3>
            <pre style={codeStyle}>{`from frootai import FrootAI, SolutionPlay, Evaluator

client = FrootAI()
results = client.search("RAG architecture")
cost = client.estimate_cost("01-enterprise-rag", scale="prod")
plays = SolutionPlay.ready()  # 20 production-ready plays

evaluator = Evaluator()
evaluator.check_thresholds({"groundedness": 4.5, "relevance": 3.8})`}</pre>
          </div>
          <p style={{ fontSize: "0.82rem", textAlign: "center" }}>
            <a href="https://pypi.org/project/frootai/" target="_blank" style={{ color: "#3b82f6", fontWeight: 600 }}>PyPI: frootai</a>
            {" · "}
            <a href="https://pypi.org/project/frootai-mcp/" target="_blank" style={{ color: "#3b82f6", fontWeight: 600 }}>PyPI: frootai-mcp</a>
          </p>
        </div>

        {/* ── CTA ── */}
        <div style={{ textAlign: "center", marginTop: "40px", display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", padding: "6px 0" }}>
          <Link to="/ecosystem" className="glow-btn glow-btn-devkit" style={{ padding: "10px 24px", fontSize: "0.85rem" }}>
            🔗 Back to Ecosystem
          </Link>
          <Link to="/mcp-tooling" className="glow-btn glow-btn-github" style={{ padding: "10px 24px", fontSize: "0.85rem" }}>
            📦 MCP Server
          </Link>
          <Link to="/vscode-extension" className="glow-btn glow-btn-github" style={{ padding: "10px 24px", fontSize: "0.85rem" }}>
            💻 VS Code Extension
          </Link>
          <Link to="/" className="glow-btn glow-btn-tunekit" style={{ padding: "10px 24px", fontSize: "0.85rem" }}>
            🌳 Back to FrootAI
          </Link>
        </div>
      </div>
    </Layout>
  );
}
