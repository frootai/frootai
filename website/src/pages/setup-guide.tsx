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
    <Layout title="Setup Guide — FrootAI MCP Server" description="Step-by-step guide to add FrootAI MCP Server to your AI agent, VS Code, Claude Desktop, or Azure AI Foundry.">
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px 80px" }}>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "8px" }}>🔌 FrootAI MCP Setup Guide</h1>
        <p style={{ fontSize: "0.95rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "32px" }}>
          Add AI architecture knowledge to any agent in under 2 minutes. Works with Claude Desktop, VS Code, Cursor, Windsurf, Azure AI Foundry, and any MCP-compatible client.
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
npx frootai-mcp

# OR install globally
npm install -g frootai-mcp
frootai-mcp`}
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)" }}>
          Published on <a href="https://www.npmjs.com/package/frootai-mcp" target="_blank">npmjs.com/package/frootai-mcp</a> — 664KB knowledge base bundled inside. Works from anywhere.
        </p>

        <h3 style={h3Style}>Option B: From GitHub (for development)</h3>
        <div style={codeStyle}>
{`# Clone the repository
git clone https://github.com/gitpavleenbali/frootai.git

# Navigate to MCP server
cd frootai/mcp-server

# Install dependencies
npm install`}
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)" }}>
          That's it — the MCP server is ready. The <code>knowledge.json</code> (664 KB) contains all 17 modules bundled. No additional setup needed.
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
              <li>The 5 FrootAI tools will appear in your agent's tool list</li>
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
            { q: '"List all FrootAI modules"', tool: "list_modules", result: "Shows 5 FROOT layers with 17 modules" },
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
              { name: "list_modules", params: "none", returns: "All 17 modules organized by FROOT layer" },
              { name: "get_module", params: "module_id (F1–T3), section? (optional)", returns: "Full module content or specific section" },
              { name: "lookup_term", params: "term (string)", returns: "Glossary definition from 200+ terms" },
              { name: "search_knowledge", params: "query (string), max_results? (1–10)", returns: "Ranked matching sections across modules" },
              { name: "get_architecture_pattern", params: "scenario (enum)", returns: "Pre-built decision guide with recommendations" },
              { name: "get_froot_overview", params: "none", returns: "Complete FROOT framework summary" },
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

        {/* ── Troubleshooting ── */}
        <h2 style={h2Style}>Troubleshooting</h2>
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

        {/* ── CTA ── */}
        <div style={{ textAlign: "center", marginTop: "40px" }}>
          <Link to="/packages" style={{ display: "inline-block", padding: "14px 36px", borderRadius: "12px", background: "linear-gradient(135deg, #10b981, #06b6d4)", color: "#fff", fontWeight: 700, textDecoration: "none", marginRight: "12px" }}>
            📦 Browse FROOT Packages
          </Link>
          <Link to="https://github.com/gitpavleenbali/frootai" style={{ display: "inline-block", padding: "14px 36px", borderRadius: "12px", background: "linear-gradient(135deg, #6366f1, #7c3aed)", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
            ⭐ Star on GitHub
          </Link>
        </div>
      </div>
    </Layout>
  );
}
