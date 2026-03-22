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
            { icon: "📖", title: "FROOT Modules", desc: "17 modules grouped by layer. Click to open and read." },
            { icon: "🔌", title: "MCP Tools", desc: "See all 6 MCP tools at a glance. Know what your agent can do." },
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
            { cmd: "FrootAI: Look Up AI Term", desc: "Type any AI/ML term → jumps to definition in glossary" },
            { cmd: "FrootAI: Search Knowledge Base", desc: "Full-text search across all 17 docs → QuickPick results" },
            { cmd: "FrootAI: Initialize DevKit", desc: "Select a solution play → copies agent.md, instructions, MCP config to your project" },
            { cmd: "FrootAI: Open Solution Play", desc: "Opens a play's README. Offers to open the full folder" },
            { cmd: "FrootAI: Show Architecture Pattern", desc: "Pick from 7 patterns: RAG, agents, hosting, cost, etc." },
            { cmd: "FrootAI: Open Setup Guide", desc: "Opens the MCP setup guide on the website" },
            { cmd: "FrootAI: Browse Solution Plays", desc: "Opens the solution plays page on the website" },
          ].map((c) => (
            <div key={c.cmd} style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--ifm-color-emphasis-100)", marginBottom: "6px", display: "flex", gap: "12px", alignItems: "center" }}>
              <code style={{ fontSize: "0.78rem", fontWeight: 600, color: "#6366f1", whiteSpace: "nowrap" }}>{c.cmd}</code>
              <span style={{ fontSize: "0.78rem", color: "var(--ifm-color-emphasis-500)" }}>{c.desc}</span>
            </div>
          ))}
        </div>

        {/* How DevKit Init Works */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "12px" }}>How DevKit Init Works</h2>
        <div style={{ padding: "16px 20px", borderRadius: "12px", border: "1px solid rgba(6, 182, 212, 0.2)", background: "rgba(6, 182, 212, 0.03)", marginBottom: "32px", fontSize: "0.82rem", lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 8px" }}><strong>1.</strong> Run <code>Ctrl+Shift+P → FrootAI: Initialize DevKit</code></p>
          <p style={{ margin: "0 0 8px" }}><strong>2.</strong> Select a solution play (e.g., Enterprise RAG)</p>
          <p style={{ margin: "0 0 8px" }}><strong>3.</strong> FrootAI copies these files to your current workspace:</p>
          <ul style={{ margin: "0 0 8px", paddingLeft: "20px" }}>
            <li><code>agent.md</code> — your co-coder now understands the solution</li>
            <li><code>instructions.md</code> — system prompts and guardrails</li>
            <li><code>.github/copilot-instructions.md</code> — Copilot knows the context</li>
            <li><code>.vscode/mcp.json</code> — MCP auto-connects</li>
          </ul>
          <p style={{ margin: 0 }}><strong>4.</strong> Start coding — Copilot generates solution-aware code.</p>
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
