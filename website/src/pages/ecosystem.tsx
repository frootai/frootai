import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

export default function EcosystemPage(): JSX.Element {
  return (
    <Layout title="Ecosystem — FrootAI" description="How the FrootAI ecosystem works: VS Code Extension, MCP Server, Solution Plays with DevKit and TuneKit.">
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>🔗 How the Ecosystem Works</h1>
          <p style={{ fontSize: "0.95rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "600px", margin: "0 auto" }}>
            Three components, each serving a different user at a different stage. Together they cover the full journey from ideation to production.
          </p>
        </div>

        {/* 3 main pillars */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "40px" }}>
          <div style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(99, 102, 241, 0.3)", background: "rgba(99, 102, 241, 0.03)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "8px", textAlign: "center" }}>💻</div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, textAlign: "center", marginBottom: "4px" }}>VS Code Extension</h2>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6366f1", textAlign: "center", marginBottom: "12px" }}>For YOU (the human)</p>
            <ul style={{ fontSize: "0.82rem", lineHeight: 1.7, paddingLeft: "16px" }}>
              <li>Browse 20 solution plays in the sidebar</li>
              <li>Search 200+ AI terms — <code>Ctrl+Shift+P → FrootAI: Look Up Term</code></li>
              <li>Init DevKit — copies agent.md + MCP config to your project</li>
              <li>Browse FROOT modules by layer</li>
              <li>View all 6 MCP tools at a glance</li>
            </ul>
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <Link to="https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai" style={{ padding: "8px 20px", borderRadius: "8px", background: "linear-gradient(135deg, #6366f1, #7c3aed)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, textDecoration: "none" }}>
                Install from Marketplace
              </Link>
            </div>
          </div>

          <div style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(16, 185, 129, 0.3)", background: "rgba(16, 185, 129, 0.03)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "8px", textAlign: "center" }}>📦</div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, textAlign: "center", marginBottom: "4px" }}>MCP Server (npm)</h2>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#10b981", textAlign: "center", marginBottom: "12px" }}>For YOUR AGENT (the AI)</p>
            <ul style={{ fontSize: "0.82rem", lineHeight: 1.7, paddingLeft: "16px" }}>
              <li>Your Copilot/Claude/Cursor calls 6 tools automatically</li>
              <li><code>lookup_term</code> → precise definitions from 200+ glossary</li>
              <li><code>search_knowledge</code> → finds answers across 17 modules</li>
              <li><code>get_architecture_pattern</code> → 7 decision guides</li>
              <li>90% less token burn vs internet search</li>
            </ul>
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <Link to="https://www.npmjs.com/package/frootai-mcp" style={{ padding: "8px 20px", borderRadius: "8px", background: "linear-gradient(135deg, #059669, #10b981)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, textDecoration: "none" }}>
                npx frootai-mcp
              </Link>
            </div>
          </div>

          <div style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(124, 58, 237, 0.3)", background: "rgba(124, 58, 237, 0.03)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "8px", textAlign: "center" }}>🎯</div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, textAlign: "center", marginBottom: "4px" }}>Solution Plays</h2>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#7c3aed", textAlign: "center", marginBottom: "12px" }}>What you BUILD with</p>
            <ul style={{ fontSize: "0.82rem", lineHeight: 1.7, paddingLeft: "16px" }}>
              <li><strong>🛠️ DevKit</strong> — empowers your co-coder BEFORE coding</li>
              <li><strong>🎛️ TuneKit</strong> — fine-tunes AI BEFORE shipping</li>
              <li>agent.md, instructions, MCP, plugins → solution-aware IDE</li>
              <li>config/*.json → pre-tuned AI parameters</li>
              <li>evaluation/ → test set + quality scoring</li>
            </ul>
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <Link to="/solution-plays" style={{ padding: "8px 20px", borderRadius: "8px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, textDecoration: "none" }}>
                Browse 20 Solution Plays
              </Link>
            </div>
          </div>
        </div>

        {/* Flow */}
        <div style={{ textAlign: "center", padding: "20px 24px", borderRadius: "14px", border: "1px solid var(--ifm-color-emphasis-200)", background: "var(--ifm-background-surface-color)", fontSize: "0.88rem", lineHeight: 1.8, marginBottom: "40px" }}>
          <strong>The Flow:</strong><br/>
          You browse plays (Extension) → Your agent gets context (MCP) → You build with DevKit → You ship with TuneKit → Production 🚀
        </div>

        {/* Big MCP vs Solution MCP */}
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, textAlign: "center", marginBottom: "16px" }}>Big MCP vs Solution MCP</h2>
        <div className={styles.lensGrid}>
          <div className={styles.lensCard}>
            <h3 className={styles.lensTitle}>📦 FrootAI MCP (Big)</h3>
            <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)" }}>
              The knowledge base for ALL of FrootAI. Answers: "What is temperature?", "How to design RAG?", "Compare SK vs Agent Framework."
            </p>
            <code style={{ fontSize: "0.78rem" }}>npx frootai-mcp</code>
          </div>
          <div className={styles.lensCard}>
            <h3 className={styles.lensTitle}>🎯 Solution MCP (Per play)</h3>
            <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)" }}>
              Solution-specific tools for ONE play. Answers: "Is my RAG config optimal?", "Validate my chunk size", "Check my guardrails."
            </p>
            <code style={{ fontSize: "0.78rem" }}>solution-plays/01-enterprise-rag/mcp/</code>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <Link to="/" style={{ padding: "12px 32px", borderRadius: "10px", background: "linear-gradient(135deg, #10b981, #06b6d4)", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
            ← Back to FrootAI
          </Link>
        </div>
      </div>
    </Layout>
  );
}
