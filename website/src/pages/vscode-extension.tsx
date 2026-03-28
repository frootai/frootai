import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

export default function VSCodeExtensionPage(): JSX.Element {
  return (
    <Layout title="VS Code Extension — FrootAI" description="FrootAI VS Code Extension — browse solution plays, search AI terms, init DevKit, right from your editor.">
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "8px" }}>💻</div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "4px" }}>FrootAI VS Code Extension</h1>
          <p style={{ fontSize: "0.95rem", color: "var(--ifm-color-emphasis-500)" }}>Browse, search, and build — right from your editor</p>
        </div>

        {/* Install */}
        <div style={{ padding: "20px 24px", borderRadius: "14px", border: "2px solid rgba(99, 102, 241, 0.3)", background: "rgba(99, 102, 241, 0.04)", textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "8px" }}>Install from VS Code Marketplace</div>
          <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "12px" }}>
            Open VS Code → Extensions (Ctrl+Shift+X) → Search <strong>"FrootAI"</strong> → Install
          </p>
          <p style={{ fontSize: "0.78rem", color: "var(--ifm-color-emphasis-400)", marginBottom: "12px" }}>
            Or from terminal: <code>code --install-extension pavleenbali.frootai</code>
          </p>
          <Link to="https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai" className={styles.glowPill} style={{ "--pill-color": "#6366f1", display: "inline-block" } as React.CSSProperties}>
            Open on VS Code Marketplace →
          </Link>
        </div>

        {/* What you get */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px" }}>What You Get</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px", marginBottom: "32px" }}>
          {[
            { icon: "📋", title: "Solution Plays", desc: "Browse all 20 plays in the sidebar. Click to open README or folder." },
            { icon: "📖", title: "FROOT Modules", desc: "16 modules grouped by layer. Click to open and read." },
            { icon: "🔌", title: "MCP Tools", desc: "See all 22 MCP tools at a glance. Know what your agent can do." },
          ].map((f) => (
            <div key={f.title} style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--ifm-color-emphasis-200)", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "4px" }}>{f.title}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-500)" }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Commands */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px" }}>Commands (Ctrl+Shift+P)</h2>
        <div style={{ marginBottom: "32px" }}>
          {[
            { cmd: "FrootAI: Initialize DevKit", desc: "Full .github Agentic OS (19 files) + agent.md + MCP + plugin.json", hot: true },
            { cmd: "FrootAI: Initialize TuneKit", desc: "config/*.json + infra/main.bicep + evaluation/ — AI tuning for production", hot: true },
            { cmd: "FrootAI: Install MCP Server", desc: "Install globally, run via npx, or add .vscode/mcp.json config", hot: true },
            { cmd: "FrootAI: Start MCP Server", desc: "Launch frootai-mcp in terminal (22 tools: 6 static + 4 live + 6 new)", hot: true },
            { cmd: "FrootAI: Initialize Hooks", desc: "Copy guardrails.json (preToolUse policy gates) to your project", hot: false },
            { cmd: "FrootAI: Initialize Prompts", desc: "Copy 4 slash commands (/deploy, /test, /review, /evaluate)", hot: false },
            { cmd: "FrootAI: Look Up AI Term", desc: "200+ terms — inline popup with rich definition", hot: false },
            { cmd: "FrootAI: Search Knowledge Base", desc: "Full-text search across 18 bundled modules", hot: false },
            { cmd: "FrootAI: Open Solution Play", desc: "View play in rich webview panel (standalone)", hot: false },
            { cmd: "FrootAI: Show Architecture Pattern", desc: "7 decision guides: RAG, agents, hosting, cost", hot: false },
            { cmd: "FrootAI: Open Setup Guide", desc: "Opens the setup guide on the website", hot: false },
            { cmd: "FrootAI: Browse Solution Plays", desc: "Opens the solution plays page", hot: false },
          ].map((c) => (
            <div key={c.cmd} style={{ padding: "10px 16px", borderRadius: "8px", border: c.hot ? "1px solid rgba(16,185,129,0.3)" : "1px solid var(--ifm-color-emphasis-100)", background: c.hot ? "rgba(16,185,129,0.03)" : "transparent", marginBottom: "6px", display: "flex", gap: "12px", alignItems: "center" }}>
              <code style={{ fontSize: "0.78rem", fontWeight: 600, color: c.hot ? "#10b981" : "#6366f1", whiteSpace: "nowrap" }}>{c.cmd}</code>
              <span style={{ fontSize: "0.78rem", color: "var(--ifm-color-emphasis-500)" }}>{c.desc}</span>
            </div>
          ))}
        </div>

        {/* How DevKit Init Works */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "12px" }}>How DevKit Init Works (v2)</h2>
        <div style={{ padding: "16px 20px", borderRadius: "12px", border: "1px solid rgba(6, 182, 212, 0.2)", background: "rgba(6, 182, 212, 0.03)", marginBottom: "32px", fontSize: "0.82rem", lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 8px" }}><strong>1.</strong> Run <code>Ctrl+Shift+P → FrootAI: Initialize DevKit</code></p>
          <p style={{ margin: "0 0 8px" }}><strong>2.</strong> Select a solution play (e.g., Enterprise RAG)</p>
          <p style={{ margin: "0 0 8px" }}><strong>3.</strong> FrootAI copies the <strong>full .github Agentic OS</strong> to your workspace:</p>
          <ul style={{ margin: "0 0 8px", paddingLeft: "20px" }}>
            <li><strong>Layer 1:</strong> <code>instructions/*.instructions.md</code> — coding standards, patterns, security</li>
            <li><strong>Layer 2:</strong> <code>prompts/*.prompt.md</code> — /deploy, /test, /review, /evaluate</li>
            <li><strong>Layer 2:</strong> <code>agents/*.agent.md</code> — builder → reviewer → tuner (chained)</li>
            <li><strong>Layer 2:</strong> <code>skills/*/SKILL.md</code> — deploy-azure, evaluate, tune</li>
            <li><strong>Layer 3:</strong> <code>hooks/guardrails.json</code> — preToolUse policy gates</li>
            <li><strong>Layer 3:</strong> <code>workflows/*.md</code> — AI-driven CI/CD</li>
            <li><strong>Layer 4:</strong> <code>plugin.json</code> — distribution manifest</li>
            <li><code>agent.md</code> + <code>.vscode/mcp.json</code> — co-coder + MCP</li>
          </ul>
          <p style={{ margin: 0 }}><strong>4.</strong> Start coding — Copilot generates solution-aware code with full agentic OS context.</p>
        </div>

        <div style={{ textAlign: "center" }}>
          <Link to="/setup-guide#vscode-section" className={styles.glowPill} style={{ "--pill-color": "#6366f1", display: "inline-block", marginRight: "12px" } as React.CSSProperties}>
            📖 Full Setup Guide
          </Link>
          <Link to="/ecosystem" className={styles.glowPill} style={{ "--pill-color": "#10b981", display: "inline-block", marginRight: "12px" } as React.CSSProperties}>
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
