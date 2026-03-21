import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

export default function MCPToolingPage(): JSX.Element {
  return (
    <Layout title="MCP Tooling — FrootAI" description="Add FrootAI to your AI agent. 6 tools, 17 modules, 200+ terms. npx frootai-mcp.">
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>🔌 MCP Tooling</h1>
          <p style={{ fontSize: "0.95rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "600px", margin: "0 auto" }}>
            Add FrootAI to any AI agent. 6 tools, 17 modules, 200+ terms. Less tokens, zero hallucination, open economics.
          </p>
        </div>

        {/* Install */}
        <div style={{ padding: "24px", borderRadius: "14px", border: "2px solid rgba(16, 185, 129, 0.3)", background: "rgba(16, 185, 129, 0.04)", textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: "8px" }}>📦 Install from npm</div>
          <code style={{ fontSize: "1rem", padding: "8px 24px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.1)" }}>npx frootai-mcp</code>
          <div style={{ fontSize: "0.78rem", color: "var(--ifm-color-emphasis-400)", marginTop: "8px" }}>
            or <code>npm install -g frootai-mcp</code> · <a href="https://www.npmjs.com/package/frootai-mcp" target="_blank" style={{ color: "#10b981" }}>npmjs.com/package/frootai-mcp</a>
          </div>
        </div>

        {/* Without vs With */}
        <div className={styles.lensGrid} style={{ marginBottom: "32px" }}>
          <div className={styles.lensCard} style={{ borderColor: "rgba(239, 68, 68, 0.2)" }}>
            <div className={styles.lensEmoji}>📚</div>
            <h3 className={styles.lensTitle}>Without FrootAI MCP</h3>
            <ul className={styles.lensList}>
              <li>Agent searches the internet — slow, noisy</li>
              <li>Burns 5,000+ tokens per architecture query</li>
              <li>May hallucinate design guidance</li>
              <li>Generic answers — no Azure patterns</li>
            </ul>
          </div>
          <div className={styles.lensCard} style={{ borderColor: "rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.03)" }}>
            <div className={styles.lensEmoji}>🌳</div>
            <h3 className={styles.lensTitle}>With FrootAI MCP</h3>
            <ul className={styles.lensList}>
              <li>Queries curated 664KB knowledge base</li>
              <li>90% less token burn</li>
              <li>Zero hallucination — grounded in verified docs</li>
              <li>Azure-specific best practices & patterns</li>
            </ul>
          </div>
        </div>

        {/* Config cards */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, textAlign: "center", marginBottom: "16px" }}>Connect to Your Client</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "32px" }}>
          {[
            { name: "Claude Desktop", icon: "💬", file: "claude_desktop_config.json", config: '{"mcpServers":{"frootai":{"command":"npx","args":["frootai-mcp"]}}}' },
            { name: "VS Code / Copilot", icon: "💻", file: ".vscode/mcp.json", config: '{"servers":{"frootai":{"command":"npx","args":["frootai-mcp"]}}}' },
            { name: "Azure AI Foundry", icon: "☁️", file: "Agent → Tools → Add MCP", config: "Point to npx frootai-mcp" },
            { name: "Cursor / Windsurf", icon: "⚡", file: "MCP settings", config: '{"mcpServers":{"frootai":{"command":"npx","args":["frootai-mcp"]}}}' },
            { name: "Copilot Studio", icon: "🤖", file: "Copilot Studio tools", config: "Add MCP connector" },
          ].map((c) => (
            <div key={c.name} style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--ifm-color-emphasis-200)" }}>
              <div style={{ fontSize: "1.2rem", marginBottom: "4px" }}>{c.icon}</div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "4px" }}>{c.name}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--ifm-color-emphasis-400)", fontFamily: "var(--ifm-font-family-monospace)", marginBottom: "6px" }}>{c.file}</div>
              <code style={{ fontSize: "0.65rem", wordBreak: "break-all" }}>{c.config}</code>
            </div>
          ))}
        </div>

        {/* 6 tools */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, textAlign: "center", marginBottom: "16px" }}>6 Tools Your Agent Receives</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "32px" }}>
          {[
            { name: "list_modules", desc: "Browse 17 modules by FROOT layer", icon: "📋" },
            { name: "get_module", desc: "Read any module content (F1–T3)", icon: "📖" },
            { name: "lookup_term", desc: "200+ AI/ML term definitions", icon: "🔍" },
            { name: "search_knowledge", desc: "Full-text search all modules", icon: "🔎" },
            { name: "get_architecture_pattern", desc: "7 pre-built decision guides", icon: "🏗️" },
            { name: "get_froot_overview", desc: "Complete FROOT framework summary", icon: "🌳" },
          ].map((t) => (
            <div key={t.name} style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--ifm-color-emphasis-200)", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{t.icon}</div>
              <div style={{ fontSize: "0.8rem", fontFamily: "var(--ifm-font-family-monospace)", fontWeight: 600, color: "#10b981" }}>{t.name}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-500)", marginTop: "4px" }}>{t.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center" }}>
          <Link to="/setup-guide" style={{ padding: "12px 32px", borderRadius: "10px", background: "linear-gradient(135deg, #059669, #10b981)", color: "#fff", fontWeight: 700, textDecoration: "none", marginRight: "12px" }}>
            📖 Full Setup Guide
          </Link>
          <Link to="/" style={{ padding: "12px 32px", borderRadius: "10px", border: "1px solid var(--ifm-color-emphasis-300)", color: "var(--ifm-font-color-base)", fontWeight: 600, textDecoration: "none" }}>
            ← Back to FrootAI
          </Link>
        </div>
      </div>
    </Layout>
  );
}
