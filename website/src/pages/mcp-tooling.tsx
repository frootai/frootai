import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

export default function MCPToolingPage(): JSX.Element {
  return (
    <Layout title="MCP Tooling — FrootAI" description="Add FrootAI to your AI agent. 23 tools (6 static + 4 live + 3 chain + 3 AI ecosystem + 6 new), 16 modules, 200+ terms. npx frootai-mcp.">
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>🔌 FrootAI MCP Server</h1>
          <p style={{ fontSize: "0.95rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "640px", margin: "0 auto" }}>
            Add AI <span style={{ color: "#10b981", fontWeight: 600 }}>Infra</span>, <span style={{ color: "#06b6d4", fontWeight: 600 }}>Platform</span>, and <span style={{ color: "#7c3aed", fontWeight: 600 }}>Application</span> Knowledge to Your Agent
          </p>
        </div>

        {/* Install — compact modern card */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "32px", flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ flex: "1 1 220px", maxWidth: "320px", padding: "16px 20px", borderRadius: "14px", border: "2px solid rgba(16, 185, 129, 0.3)", background: "rgba(16, 185, 129, 0.04)", textAlign: "center" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#10b981", marginBottom: "6px" }}>Quick Run</div>
            <code style={{ fontSize: "0.9rem", padding: "6px 16px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)" }}>npx frootai-mcp</code>
          </div>
          <div style={{ flex: "1 1 220px", maxWidth: "320px", padding: "16px 20px", borderRadius: "14px", border: "2px solid rgba(99, 102, 241, 0.3)", background: "rgba(99, 102, 241, 0.04)", textAlign: "center" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6366f1", marginBottom: "6px" }}>Install Global</div>
            <code style={{ fontSize: "0.9rem", padding: "6px 16px", borderRadius: "8px", background: "rgba(99, 102, 241, 0.1)" }}>npm i -g frootai-mcp</code>
          </div>
          <div style={{ flex: "1 1 220px", maxWidth: "320px", padding: "16px 20px", borderRadius: "14px", border: "2px solid rgba(124, 58, 237, 0.3)", background: "rgba(124, 58, 237, 0.04)", textAlign: "center" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#7c3aed", marginBottom: "6px" }}>npm Registry</div>
            <Link to="https://www.npmjs.com/package/frootai-mcp" className={styles.glowPill} style={{ "--pill-color": "#7c3aed", display: "inline-block", fontSize: "0.78rem" } as React.CSSProperties}>
              npmjs.com/package/frootai-mcp →
            </Link>
          </div>
          <div style={{ flex: "1 1 220px", maxWidth: "320px", padding: "16px 20px", borderRadius: "14px", border: "2px solid rgba(59, 130, 246, 0.3)", background: "rgba(59, 130, 246, 0.04)", textAlign: "center" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#3b82f6", marginBottom: "6px" }}>Python</div>
            <code style={{ fontSize: "0.9rem", padding: "6px 16px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.1)" }}>pip install frootai-mcp</code>
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
            { name: "Azure MS Foundry", icon: "☁️", file: "Agent → Tools → Add MCP", config: "Point to npx frootai-mcp" },
            { name: "Cursor / Windsurf", icon: "⚡", file: "MCP settings", config: '{"mcpServers":{"frootai":{"command":"npx","args":["frootai-mcp"]}}}' },
            { name: "Copilot Studio", icon: "🤖", file: "Copilot Studio tools", config: "Add MCP connector" },
            { name: "Gemini / Codex", icon: "💎", file: "MCP config", config: '{"mcpServers":{"frootai":{"command":"npx","args":["frootai-mcp"]}}}' },
          ].map((c) => (
            <div key={c.name} style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--ifm-color-emphasis-200)" }}>
              <div style={{ fontSize: "1.2rem", marginBottom: "4px" }}>{c.icon}</div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "4px" }}>{c.name}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--ifm-color-emphasis-400)", fontFamily: "var(--ifm-font-family-monospace)", marginBottom: "6px" }}>{c.file}</div>
              <code style={{ fontSize: "0.65rem", wordBreak: "break-all" }}>{c.config}</code>
            </div>
          ))}
        </div>

        {/* Tools */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, textAlign: "center", marginBottom: "4px" }}>Tools Agent Receives</h2>
        <p style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-400)", textAlign: "center", marginBottom: "16px" }}>6 static (bundled) + 4 live (network) + 3 agent chain (Build → Review → Tune)</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          {[
            { name: "list_modules", desc: "Browse 16 modules by FROOT layer", icon: "📋", kind: "static" },
            { name: "get_module", desc: "Read any module content (F1–T3)", icon: "📖", kind: "static" },
            { name: "lookup_term", desc: "200+ AI/ML term definitions", icon: "🔍", kind: "static" },
            { name: "search_knowledge", desc: "Full-text search all modules", icon: "🔎", kind: "static" },
            { name: "get_architecture_pattern", desc: "7 pre-built decision guides", icon: "🏗️", kind: "static" },
            { name: "get_froot_overview", desc: "Complete FROOT framework summary", icon: "🌳", kind: "static" },
          ].map((t) => (
            <div key={t.name} style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--ifm-color-emphasis-200)", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{t.icon}</div>
              <div style={{ fontSize: "0.8rem", fontFamily: "var(--ifm-font-family-monospace)", fontWeight: 600, color: "#10b981" }}>{t.name}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-500)", marginTop: "4px" }}>{t.desc}</div>
            </div>
          ))}
        </div>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, textAlign: "center", marginBottom: "12px", color: "#f59e0b" }}>🔔 Live Tools (v2 — network-enabled)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", marginBottom: "32px" }}>
          {[
            { name: "fetch_azure_docs", desc: "Search Microsoft Learn for Azure docs", icon: "☁️" },
            { name: "fetch_external_mcp", desc: "Find MCP servers from registries", icon: "🔌" },
            { name: "list_community_plays", desc: "List 20 solution plays from GitHub", icon: "🎯" },
            { name: "get_github_agentic_os", desc: ".github 7 primitives guide", icon: "🧠" },
          ].map((t) => (
            <div key={t.name} style={{ padding: "16px", borderRadius: "12px", border: "1px solid rgba(245, 158, 11, 0.25)", background: "rgba(245, 158, 11, 0.03)", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{t.icon}</div>
              <div style={{ fontSize: "0.8rem", fontFamily: "var(--ifm-font-family-monospace)", fontWeight: 600, color: "#f59e0b" }}>{t.name}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-500)", marginTop: "4px" }}>{t.desc}</div>
              <div style={{ fontSize: "0.62rem", color: "var(--ifm-color-emphasis-400)", marginTop: "2px", fontStyle: "italic" }}>Falls back to static if offline</div>
            </div>
          ))}
        </div>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, textAlign: "center", marginBottom: "12px", color: "#7c3aed" }}>⚡ Agent Chain Tools (Build → Review → Tune)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          {[
            { name: "agent_build", desc: "🛠️ Builder — architecture guidance, suggests review", icon: "🛠️" },
            { name: "agent_review", desc: "🔍 Reviewer — security + quality checklist, suggests tune", icon: "🔍" },
            { name: "agent_tune", desc: "🎛️ Tuner — production readiness verdict", icon: "🎛️" },
          ].map((t) => (
            <div key={t.name} style={{ padding: "16px", borderRadius: "12px", border: "1px solid rgba(124, 58, 237, 0.25)", background: "rgba(124, 58, 237, 0.03)", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{t.icon}</div>
              <div style={{ fontSize: "0.8rem", fontFamily: "var(--ifm-font-family-monospace)", fontWeight: 600, color: "#7c3aed" }}>{t.name}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-500)", marginTop: "4px" }}>{t.desc}</div>
              <div style={{ fontSize: "0.62rem", color: "var(--ifm-color-emphasis-400)", marginTop: "2px", fontStyle: "italic" }}>Just talk in chat — auto-chains</div>
            </div>
          ))}
        </div>

        {/* AI Ecosystem Tools (NEW in v3.0) */}
        <h2 style={{ marginTop: "32px", fontSize: "1.2rem", fontWeight: 700 }}>🧠 AI Ecosystem Tools <span style={{ fontSize: "0.7rem", color: "#00C853", fontWeight: 400, marginLeft: "8px" }}>NEW in v3.0</span></h2>
        <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "12px" }}>
          Real-time AI decision tools — model catalog, cost estimation, and comparison engine.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          {[
            { name: "get_model_catalog", desc: "📋 Azure AI model catalog — pricing, capabilities, context windows, recommendations", icon: "📋" },
            { name: "get_azure_pricing", desc: "💰 Monthly cost estimates for RAG, agent, batch, realtime scenarios (dev/staging/prod)", icon: "💰" },
            { name: "compare_models", desc: "🔄 Side-by-side model comparison — recommend best model for your use case + priority", icon: "🔄" },
          ].map((t) => (
            <div key={t.name} style={{ padding: "16px", borderRadius: "12px", border: "1px solid rgba(0, 200, 83, 0.25)", background: "rgba(0, 200, 83, 0.03)", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{t.icon}</div>
              <div style={{ fontSize: "0.8rem", fontFamily: "var(--ifm-font-family-monospace)", fontWeight: 600, color: "#00C853" }}>{t.name}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-500)", marginTop: "4px" }}>{t.desc}</div>
              <div style={{ fontSize: "0.62rem", color: "var(--ifm-color-emphasis-400)", marginTop: "2px", fontStyle: "italic" }}>Ask: "Which model should I use for RAG?"</div>
            </div>
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{ textAlign: "center", display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", padding: "6px 0" }}>
          <Link to="/setup-guide" className={styles.glowPill} style={{ "--pill-color": "#10b981", display: "inline-block" } as React.CSSProperties}>
            📖 Full Setup Guide
          </Link>
          <Link to="/ecosystem" className={styles.glowPill} style={{ "--pill-color": "#6366f1", display: "inline-block" } as React.CSSProperties}>
            🔗 Back to Ecosystem
          </Link>
          <Link to="/" className={styles.glowPill} style={{ "--pill-color": "#f59e0b", display: "inline-block" } as React.CSSProperties}>
            🌳 Back to FrootAI
          </Link>
        </div>
      </div>
    </Layout>
  );
}
