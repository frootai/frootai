import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

export default function EcosystemPage(): JSX.Element {
  return (
    <Layout title="Ecosystem — FrootAI" description="The FrootAI Ecosystem — VS Code Extension, MCP Server, Solution Plays, FROOT Packages.">
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>🔗 The FrootAI Ecosystem</h1>
          <p style={{ fontSize: "0.95rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "600px", margin: "0 auto" }}>
            Two perspectives. One ecosystem. Everything you need from the big picture to the tiny details.
          </p>
        </div>

        {/* ── Telescope: Big Picture ── */}
        <section style={{ marginBottom: "48px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "4px" }}>🔭 Telescope — The Big Picture</h2>
          <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "16px" }}>Complete solutions and downloadable building blocks</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
            {/* Solution Plays */}
            <div style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(124, 58, 237, 0.25)", background: "rgba(124, 58, 237, 0.03)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "6px", textAlign: "center" }}>🎯</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, textAlign: "center", marginBottom: "4px" }}>Solution Plays</h3>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#7c3aed", textAlign: "center", marginBottom: "12px" }}>20 pre-tuned deployable AI solutions</p>
              <ul style={{ fontSize: "0.82rem", lineHeight: 1.7, paddingLeft: "16px" }}>
                <li>🛠️ <strong>DevKit</strong> — empowers your co-coder before coding</li>
                <li>🎛️ <strong>TuneKit</strong> — fine-tunes AI before shipping</li>
                <li>Infra blueprints + agent.md + config + evaluation</li>
                <li>LEGO blocks that compose into full solutions</li>
              </ul>
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <Link to="/solution-plays" className={styles.glowPill} style={{ "--pill-color": "#7c3aed", display: "inline-block" } as React.CSSProperties}>
                  Browse 20 Solution Plays →
                </Link>
              </div>
            </div>

            {/* FROOT Packages */}
            <div style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(6, 182, 212, 0.25)", background: "rgba(6, 182, 212, 0.03)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "6px", textAlign: "center" }}>🧩</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, textAlign: "center", marginBottom: "4px" }}>FROOT Packages</h3>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#06b6d4", textAlign: "center", marginBottom: "12px" }}>Downloadable LEGO blocks</p>
              <ul style={{ fontSize: "0.82rem", lineHeight: 1.7, paddingLeft: "16px" }}>
                <li>Knowledge modules by FROOT layer</li>
                <li>MCP tools bundled in npm package</li>
                <li>DevKit packs per solution play</li>
                <li>TuneKit packs (config + eval scripts)</li>
              </ul>
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <Link to="/packages" className={styles.glowPill} style={{ "--pill-color": "#06b6d4", display: "inline-block" } as React.CSSProperties}>
                  Browse FROOT Packages →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Microscope: Tiny Details ── */}
        <section style={{ marginBottom: "48px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "4px" }}>🔬 Microscope — The Tiny Details</h2>
          <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "16px" }}>Tools that integrate into your editor and agent workflow</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
            {/* MCP Server */}
            <div style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(16, 185, 129, 0.25)", background: "rgba(16, 185, 129, 0.03)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "6px", textAlign: "center" }}>📦</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, textAlign: "center", marginBottom: "4px" }}>MCP Server (npm)</h3>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#10b981", textAlign: "center", marginBottom: "12px" }}>For your AI agent</p>
              <ul style={{ fontSize: "0.82rem", lineHeight: 1.7, paddingLeft: "16px" }}>
                <li>6 tools called automatically by Copilot/Claude/Cursor</li>
                <li><code>lookup_term</code> → 200+ precise definitions</li>
                <li><code>search_knowledge</code> → answers across 17 modules</li>
                <li><code>get_architecture_pattern</code> → 7 decision guides</li>
                <li>90% less token burn vs internet search</li>
              </ul>
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <Link to="/mcp-tooling" className={styles.glowPill} style={{ "--pill-color": "#10b981", display: "inline-block" } as React.CSSProperties}>
                  Install FrootAI MCP Package →
                </Link>
              </div>
            </div>

            {/* VS Code Extension */}
            <div style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(99, 102, 241, 0.25)", background: "rgba(99, 102, 241, 0.03)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "6px", textAlign: "center" }}>💻</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, textAlign: "center", marginBottom: "4px" }}>VS Code Extension</h3>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6366f1", textAlign: "center", marginBottom: "12px" }}>For you (the human)</p>
              <ul style={{ fontSize: "0.82rem", lineHeight: 1.7, paddingLeft: "16px" }}>
                <li>Sidebar: 20 solution plays, 17 modules, 6 MCP tools</li>
                <li>Search 200+ AI terms instantly</li>
                <li>Init DevKit → copies agent.md + MCP to your project</li>
                <li>7 commands via Ctrl+Shift+P</li>
              </ul>
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <Link to="/vscode-extension" className={styles.glowPill} style={{ "--pill-color": "#6366f1", display: "inline-block" } as React.CSSProperties}>
                  Install VS Code Extension →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Flow */}
        <div style={{ textAlign: "center", padding: "20px 24px", borderRadius: "14px", border: "1px solid var(--ifm-color-emphasis-200)", background: "var(--ifm-background-surface-color)", fontSize: "0.85rem", lineHeight: 1.8, marginBottom: "32px" }}>
          <strong>The Flow:</strong><br/>
          You browse plays (Extension) → Your agent gets context (MCP) → You build with DevKit → You ship with TuneKit → Production 🚀
        </div>

        <div style={{ textAlign: "center" }}>
          <Link to="/" className={styles.glowPill} style={{ "--pill-color": "#10b981", display: "inline-block" } as React.CSSProperties}>
            ← Back to FrootAI
          </Link>
        </div>
      </div>
    </Layout>
  );
}
