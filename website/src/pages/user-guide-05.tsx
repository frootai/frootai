import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

export default function UserGuide05Page(): JSX.Element {
  return (
    <Layout title="User Guide: IT Ticket Resolution — FrootAI" description="Step-by-step guide to deploy Solution Play 05 — IT Ticket Resolution using FrootAI DevKit, TuneKit, and MCP.">
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800 }}>🎫 Solution Play 05 — IT Ticket Resolution</h1>
          <p style={{ fontSize: "0.92rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "640px", margin: "0 auto" }}>
            Complete user guide: from zero to production. Auto-classify, route, and resolve IT tickets using Azure Logic Apps + Azure OpenAI + ServiceNow MCP.
          </p>
        </div>

        {/* Overview */}
        <div style={{ padding: "20px", borderRadius: "14px", border: "2px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.03)", marginBottom: "32px" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "8px", marginTop: 0 }}>What You'll Build</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)", margin: "0 0 8px" }}>
            An AI-powered IT ticket system that automatically classifies incoming tickets, routes them to the right team, suggests resolutions, and integrates with ServiceNow — all deployed on Azure with one-click Bicep templates.
          </p>
          <div style={{ fontSize: "0.78rem", color: "var(--ifm-color-emphasis-400)" }}>
            <strong>Infra:</strong> Logic Apps · Azure OpenAI · Container Apps · ServiceNow MCP<br/>
            <strong>Complexity:</strong> Medium · <strong>Status:</strong> Skeleton (DevKit + TuneKit ready)
          </div>
        </div>

        {/* Step 1 */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "12px" }}>Step 1: Open VS Code Extension</h2>
        <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--ifm-color-emphasis-200)", marginBottom: "24px", fontSize: "0.85rem", lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 6px" }}>Install the FrootAI VS Code Extension if you haven't:</p>
          <code style={{ display: "block", padding: "8px 12px", borderRadius: "8px", background: "rgba(16,185,129,0.06)", marginBottom: "8px" }}>code --install-extension pavleenbali.frootai</code>
          <p style={{ margin: 0 }}>Open the FrootAI sidebar (🌳 icon in activity bar). You'll see 4 panels: Solution Plays, MCP Tools, Φ Knowledge Hub, AI Glossary.</p>
        </div>

        {/* Step 2 */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "12px" }}>Step 2: Initialize DevKit</h2>
        <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid rgba(6,182,212,0.2)", background: "rgba(6,182,212,0.03)", marginBottom: "24px", fontSize: "0.85rem", lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 8px" }}><strong>Left-click</strong> on <code>🎫 05 — IT Ticket Resolution</code> in the sidebar.</p>
          <p style={{ margin: "0 0 8px" }}>Select <strong>🛠️ Init DevKit</strong> from the action picker.</p>
          <p style={{ margin: "0 0 8px" }}>FrootAI copies the <strong>full .github Agentic OS</strong> to your workspace (19 files):</p>
          <ul style={{ paddingLeft: "18px", margin: "0 0 8px" }}>
            <li><strong>Layer 1 — Instructions:</strong> azure-coding, it-ticket-resolution-patterns, security</li>
            <li><strong>Layer 2 — Prompts:</strong> /deploy, /test, /review, /evaluate (slash commands)</li>
            <li><strong>Layer 2 — Agents:</strong> builder → reviewer → tuner (chained)</li>
            <li><strong>Layer 2 — Skills:</strong> deploy-azure, evaluate, tune (self-contained runbooks)</li>
            <li><strong>Layer 3 — Hooks:</strong> guardrails.json (blocks secrets in code automatically)</li>
            <li><strong>Layer 3 — Workflows:</strong> AI-driven PR review + deployment</li>
          </ul>
          <p style={{ margin: 0 }}>+ <code>agent.md</code>, <code>.vscode/mcp.json</code>, <code>plugin.json</code></p>
        </div>

        {/* Step 3 */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "12px" }}>Step 3: Initialize TuneKit</h2>
        <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid rgba(124,58,237,0.2)", background: "rgba(124,58,237,0.03)", marginBottom: "24px", fontSize: "0.85rem", lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 8px" }}><strong>Left-click</strong> on <code>🎫 05</code> again → select <strong>⚙️ Init TuneKit</strong>.</p>
          <p style={{ margin: "0 0 8px" }}>FrootAI copies production AI configuration:</p>
          <ul style={{ paddingLeft: "18px", margin: 0 }}>
            <li><code>config/openai.json</code> — temperature, model, max_tokens, JSON schema</li>
            <li><code>config/guardrails.json</code> — blocked topics, PII filter, abstention rules</li>
            <li><code>infra/main.bicep</code> — one-click Azure deployment (Logic Apps + OpenAI + Container Apps)</li>
            <li><code>infra/parameters.json</code> — region, SKUs, model names</li>
            <li><code>evaluation/test-set.jsonl</code> — ground-truth test cases</li>
            <li><code>evaluation/eval.py</code> — automated quality scoring</li>
          </ul>
        </div>

        {/* Step 4 */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "12px" }}>Step 4: Use MCP Tools in Copilot Chat</h2>
        <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--ifm-color-emphasis-200)", marginBottom: "24px", fontSize: "0.85rem", lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 8px" }}>Open <strong>GitHub Copilot Chat</strong> (Ctrl+Shift+I). Click the <strong>🔧 tools icon</strong> → enable <strong>FrootAI</strong>.</p>
          <p style={{ margin: "0 0 8px" }}>Now try these prompts:</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "8px" }}>
            {[
              { q: "What architecture works best for IT ticket classification?", tool: "get_architecture_pattern" },
              { q: "What does temperature mean?", tool: "lookup_term" },
              { q: "Search for ServiceNow integration patterns", tool: "search_knowledge" },
              { q: "Find Azure docs for Logic Apps", tool: "fetch_azure_docs" },
            ].map(item => (
              <div key={item.q} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--ifm-color-emphasis-100)" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "2px" }}>"{item.q}"</div>
                <div style={{ fontSize: "0.72rem", color: "#10b981", fontFamily: "var(--ifm-font-family-monospace)" }}>→ {item.tool}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 5 */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "12px" }}>Step 5: Build with Your Co-Coder</h2>
        <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--ifm-color-emphasis-200)", marginBottom: "24px", fontSize: "0.85rem", lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 8px" }}>With all context loaded, ask Copilot:</p>
          <code style={{ display: "block", padding: "10px 14px", borderRadius: "8px", background: "rgba(99,102,241,0.06)", marginBottom: "8px", fontSize: "0.82rem", lineHeight: 1.6 }}>
            Build me a complete IT ticket classification and routing system.{"\n"}
            Use Azure Logic Apps + Azure OpenAI for classification.{"\n"}
            Follow the agent.md instructions and use config/openai.json parameters.{"\n"}
            Route tickets based on category: network, hardware, software, access.
          </code>
          <p style={{ margin: 0 }}>Copilot generates solution-aware code — it reads agent.md, follows .github instructions, uses config values (not hardcoded), and applies guardrails.</p>
        </div>

        {/* Step 6 */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "12px" }}>Step 6: Validate & Deploy</h2>
        <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.03)", marginBottom: "32px", fontSize: "0.85rem", lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 8px" }}>Use the slash commands:</p>
          <ul style={{ paddingLeft: "18px", margin: "0 0 8px" }}>
            <li><strong>/review</strong> — Security + quality code review (checks for secrets, error handling, RBAC)</li>
            <li><strong>/evaluate</strong> — Run evaluation pipeline against test cases</li>
            <li><strong>/deploy</strong> — Azure deployment walkthrough (Bicep validate → deploy → verify)</li>
          </ul>
          <p style={{ margin: 0 }}>Or use the <strong>tuner agent</strong>: ask Copilot <em>"Validate my TuneKit configuration for production readiness"</em></p>
        </div>

        {/* Summary */}
        <div style={{ padding: "20px", borderRadius: "14px", border: "1px solid var(--ifm-color-emphasis-200)", background: "var(--ifm-background-surface-color)", textAlign: "center", marginBottom: "32px" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "8px" }}>What You Just Did</h3>
          <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)", lineHeight: 1.7, margin: 0 }}>
            <strong>Init DevKit</strong> → .github Agentic OS (19 files, 4 layers, 7 primitives)<br/>
            <strong>Init TuneKit</strong> → config + infra + evaluation (pre-tuned)<br/>
            <strong>MCP Tools</strong> → agent queries 10 tools for architecture guidance<br/>
            <strong>Build</strong> → Copilot generates solution-aware code<br/>
            <strong>Validate</strong> → /review + /evaluate + /deploy<br/>
            <strong>Ship</strong> → Production-ready IT ticket resolution 🚀
          </p>
        </div>

        {/* Nav */}
        <div style={{ textAlign: "center", display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/solution-plays" className={styles.glowPill} style={{ "--pill-color": "#7c3aed", display: "inline-block" } as React.CSSProperties}>
            🎯 All Solution Plays
          </Link>
          <Link to="/setup-guide" className={styles.glowPill} style={{ "--pill-color": "#10b981", display: "inline-block" } as React.CSSProperties}>
            📖 Setup Guide
          </Link>
          <Link to="/" className={styles.glowPill} style={{ "--pill-color": "#f59e0b", display: "inline-block" } as React.CSSProperties}>
            🌳 Back to FrootAI
          </Link>
        </div>
      </div>
    </Layout>
  );
}
