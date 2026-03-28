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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {/* Solution Plays */}
            <div style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(124, 58, 237, 0.25)", background: "rgba(124, 58, 237, 0.03)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "6px", textAlign: "center" }}>🎯</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, textAlign: "center", marginBottom: "4px" }}>Solution Plays</h3>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#7c3aed", textAlign: "center", marginBottom: "12px" }}>20 pre-tuned deployable AI solutions</p>
              <ul style={{ fontSize: "0.82rem", lineHeight: 1.7, paddingLeft: "16px" }}>
                <li>🛠️ <strong>DevKit</strong> — empowers your co-coder before coding</li>
                <li>🎛️ <strong>TuneKit</strong> — fine-tunes AI before shipping</li>
                <li>📐 <strong>SpecKit</strong> — architecture specs + WAF alignment</li>
                <li>Infra blueprints + agent.md + config + evaluation</li>
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {/* MCP Server */}
            <div style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(16, 185, 129, 0.25)", background: "rgba(16, 185, 129, 0.03)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "6px", textAlign: "center" }}>📦</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, textAlign: "center", marginBottom: "4px" }}>MCP Server (npm)</h3>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#10b981", textAlign: "center", marginBottom: "12px" }}>For your AI agent</p>
              <ul style={{ fontSize: "0.82rem", lineHeight: 1.7, paddingLeft: "16px" }}>
                <li>23 tools called automatically by Copilot/Claude/Cursor</li>
                <li><code>lookup_term</code> → 200+ precise definitions</li>
                <li><code>search_knowledge</code> → answers across 16 modules</li>
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
                <li>Sidebar: 20 solution plays, 16 modules, 23 MCP tools</li>
                <li>Search 200+ AI terms instantly</li>
                <li>Init DevKit → copies .github Agentic OS (19 files) to your project</li>
                <li>19 commands via Ctrl+Shift+P</li>
                <li>Cached downloads — works offline after first use</li>
              </ul>
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <Link to="/vscode-extension" className={styles.glowPill} style={{ "--pill-color": "#6366f1", display: "inline-block" } as React.CSSProperties}>
                  Install VS Code Extension →
                </Link>
              </div>
            </div>

            {/* Docker Image */}
            <div style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(6, 182, 212, 0.25)", background: "rgba(6, 182, 212, 0.03)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "6px", textAlign: "center" }}>🐳</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, textAlign: "center", marginBottom: "4px" }}>Docker Image</h3>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#06b6d4", textAlign: "center", marginBottom: "12px" }}>Run anywhere — zero install</p>
              <ul style={{ fontSize: "0.82rem", lineHeight: 1.7, paddingLeft: "16px" }}>
                <li>Multi-arch: amd64 + arm64 (Apple Silicon ready)</li>
                <li>Same 23 MCP tools, 682KB knowledge</li>
                <li>Kubernetes-ready sidecar deployment</li>
                <li>Pinnable versions for reproducibility</li>
              </ul>
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <Link to="/docker" className={styles.glowPill} style={{ "--pill-color": "#06b6d4", display: "inline-block" } as React.CSSProperties}>
                  Docker Setup →
                </Link>
              </div>
            </div>

            {/* CLI */}
            <div style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(245, 158, 11, 0.25)", background: "rgba(245, 158, 11, 0.03)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "6px", textAlign: "center" }}>⚡</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, textAlign: "center", marginBottom: "4px" }}>CLI (npx frootai)</h3>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#f59e0b", textAlign: "center", marginBottom: "12px" }}>For your terminal</p>
              <ul style={{ fontSize: "0.82rem", lineHeight: 1.7, paddingLeft: "16px" }}>
                <li>6 commands: init, search, cost, validate, doctor, help</li>
                <li><code>validate --waf</code> → WAF alignment scorecard (6 pillars)</li>
                <li>Scaffolds full project with SpecKit + WAF instructions</li>
                <li>Zero install — runs via npx</li>
              </ul>
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <Link to="/cli" className={styles.glowPill} style={{ "--pill-color": "#f59e0b", display: "inline-block" } as React.CSSProperties}>
                  CLI Docs →
                </Link>
              </div>
            </div>

            {/* REST API */}
            <div style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(236, 72, 153, 0.25)", background: "rgba(236, 72, 153, 0.03)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "6px", textAlign: "center" }}>📡</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, textAlign: "center", marginBottom: "4px" }}>REST API</h3>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#ec4899", textAlign: "center", marginBottom: "12px" }}>No SDK needed</p>
              <ul style={{ fontSize: "0.82rem", lineHeight: 1.7, paddingLeft: "16px" }}>
                <li>5 endpoints: chat, search, cost, health, openapi.json</li>
                <li>Rate-limited: 60 requests/min per IP</li>
                <li>OpenAPI 3.1 spec for auto-generation</li>
                <li>CORS-enabled for web integrations</li>
              </ul>
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <Link to="/api-docs" className={styles.glowPill} style={{ "--pill-color": "#ec4899", display: "inline-block" } as React.CSSProperties}>
                  REST API Docs →
                </Link>
              </div>
            </div>

            {/* Python SDK + MCP */}
            <div style={{ padding: "24px", borderRadius: "16px", border: "2px solid rgba(59, 130, 246, 0.25)", background: "rgba(59, 130, 246, 0.03)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "6px", textAlign: "center" }}>🐍</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, textAlign: "center", marginBottom: "4px" }}>Python SDK + MCP</h3>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#3b82f6", textAlign: "center", marginBottom: "12px" }}>pip install frootai</p>
              <ul style={{ fontSize: "0.82rem", lineHeight: 1.7, paddingLeft: "16px" }}>
                <li>Offline-first — 682KB knowledge, zero dependencies</li>
                <li>Search 16 modules, 20 plays, 159+ glossary terms</li>
                <li>Cost estimation, evaluation, A/B testing framework</li>
                <li>Python MCP server: <code>pip install frootai-mcp</code></li>
              </ul>
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <a href="https://pypi.org/project/frootai/" className={styles.glowPill} style={{ "--pill-color": "#3b82f6", display: "inline-block" } as React.CSSProperties}>
                  PyPI →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* New Platform Features */}
        <section style={{ marginBottom: "48px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "4px" }}>✨ New Platform Features</h2>
          <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "16px" }}>Growing the ecosystem with intelligence, community, and partnerships</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
            {[
              { to: "/configurator", icon: "⚙️", title: "Solution Configurator", sub: "3 questions → recommended play", color: "#f59e0b" },
              { to: "/chatbot", icon: "🤖", title: "AI Assistant", sub: "Ask which play to use", color: "#00C853" },
              { to: "/partners", icon: "🤝", title: "Partner Integrations", sub: "ServiceNow, Salesforce, SAP MCP", color: "#06b6d4" },
              { to: "/marketplace", icon: "🏪", title: "Plugin Marketplace", sub: "Discover & share .github plugins", color: "#ec4899" },
            ].map((card) => (
              <Link key={card.title} to={card.to} className={styles.glowCard} style={{ "--glow-color": card.color } as React.CSSProperties}>
                <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{card.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{card.title}</div>
                <div style={{ fontSize: "0.7rem", color: card.color }}>{card.sub}</div>
              </Link>
            ))}
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
