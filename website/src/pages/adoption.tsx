import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

const stats = [
  { value: "20", label: "Solution Plays", icon: "🎯", color: "#7c3aed" },
  { value: "16", label: "MCP Tools", icon: "📦", color: "#10b981" },
  { value: "18", label: "Knowledge Modules", icon: "📖", color: "#6366f1" },
  { value: "200+", label: "AI Terms", icon: "🔍", color: "#f59e0b" },
  { value: "13", label: "VS Code Commands", icon: "💻", color: "#06b6d4" },
  { value: "730+", label: "Solution Play Files", icon: "📁", color: "#ec4899" },
];

const components = [
  { name: "MCP Server", version: "v3.0.1", pkg: "frootai-mcp", status: "✅ Live", link: "https://www.npmjs.com/package/frootai-mcp" },
  { name: "VS Code Extension", version: "v1.0.0", pkg: "pavleenbali.frootai", status: "✅ Live", link: "https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai" },
  { name: "Knowledge Base", version: "18 modules", pkg: "knowledge.json", status: "✅ Bundled", link: "/docs" },
  { name: "Website", version: "Docusaurus 3", pkg: "13 pages", status: "✅ Live", link: "/" },
  { name: "Solution Plays", version: "20 plays", pkg: "DevKit + TuneKit", status: "✅ Shipping", link: "/solution-plays" },
  { name: "Agent Card (A2A)", version: "v3.0.0", pkg: "agent-card.json", status: "✅ Published", link: "https://github.com/gitpavleenbali/frootai/blob/main/mcp-server/agent-card.json" },
];

const useCases = [
  {
    title: "Enterprise RAG Pipelines",
    desc: "AI Search + OpenAI + Container Apps — pre-tuned config, evaluation suite, Bicep infra.",
    icon: "🔎",
    color: "#7c3aed",
  },
  {
    title: "AI Agents & Multi-Agent Systems",
    desc: "Deterministic agents, build→review→tune chains, Semantic Kernel and Agent Framework patterns.",
    icon: "🤖",
    color: "#10b981",
  },
  {
    title: "AI Landing Zones",
    desc: "VNet + Private Endpoints + RBAC + GPU allocation — enterprise-grade AI infrastructure.",
    icon: "🏗️",
    color: "#6366f1",
  },
  {
    title: "Cost Optimization",
    desc: "Model comparison, pricing estimates, token budget planning for AI workloads.",
    icon: "💰",
    color: "#f59e0b",
  },
  {
    title: "AI Architecture Training",
    desc: "18 FROOT modules from tokens to production — used in workshops and onboarding.",
    icon: "🎓",
    color: "#06b6d4",
  },
  {
    title: "Agentic DevOps (.github OS)",
    desc: "19-file .github Agentic OS per play — instructions, prompts, agents, skills, hooks.",
    icon: "⚡",
    color: "#ec4899",
  },
];

const integrations = [
  { name: "VS Code / GitHub Copilot", icon: "💻", desc: "Extension + MCP server for Copilot Chat" },
  { name: "Claude Desktop", icon: "🟣", desc: "MCP server — npx frootai-mcp" },
  { name: "Cursor", icon: "🔵", desc: "MCP server in Cursor settings" },
  { name: "Windsurf", icon: "🌊", desc: "MCP server configuration" },
  { name: "Azure AI Foundry", icon: "☁️", desc: "Agent tool definition" },
  { name: "Any MCP Client", icon: "🔌", desc: "stdio transport, Node.js runtime" },
];

export default function AdoptionPage(): JSX.Element {
  return (
    <Layout
      title="Adoption — FrootAI"
      description="FrootAI by the Numbers — ecosystem health, adoption metrics, and integration points."
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800 }}>
            FrootAI by the Numbers
          </h1>
          <p style={{
            fontSize: "1rem",
            color: "var(--ifm-color-emphasis-600)",
            maxWidth: "640px",
            margin: "0 auto",
          }}>
            A living snapshot of the FrootAI ecosystem — what ships today,
            where teams use it, and how it connects to the AI toolchain.
          </p>
        </div>

        {/* ── Stats Grid ── */}
        <section style={{ marginBottom: "56px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "16px",
          }}>
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  textAlign: "center",
                  padding: "24px 16px",
                  borderRadius: "16px",
                  border: `2px solid ${s.color}33`,
                  background: `${s.color}08`,
                }}
              >
                <div style={{ fontSize: "1.8rem", marginBottom: "4px" }}>{s.icon}</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--ifm-color-emphasis-600)", fontWeight: 600 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Ecosystem Health ── */}
        <section style={{ marginBottom: "56px" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "16px" }}>
            🩺 Ecosystem Health
          </h2>
          <div style={{
            overflowX: "auto",
            borderRadius: "12px",
            border: "1px solid var(--ifm-color-emphasis-200)",
          }}>
            <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--ifm-color-emphasis-100)" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Component</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Version</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Package</th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {components.map((c) => (
                  <tr key={c.name} style={{ borderTop: "1px solid var(--ifm-color-emphasis-200)" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>
                      <a href={c.link} style={{ color: "inherit", textDecoration: "none" }}>
                        {c.name}
                      </a>
                    </td>
                    <td style={{ padding: "10px 16px" }}><code>{c.version}</code></td>
                    <td style={{ padding: "10px 16px" }}><code>{c.pkg}</code></td>
                    <td style={{ padding: "10px 16px" }}>{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── What Teams Use FrootAI For ── */}
        <section style={{ marginBottom: "56px" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "16px" }}>
            🎯 What Teams Use FrootAI For
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "16px",
          }}>
            {useCases.map((uc) => (
              <div
                key={uc.title}
                style={{
                  padding: "20px 24px",
                  borderRadius: "14px",
                  border: `2px solid ${uc.color}25`,
                  background: `${uc.color}05`,
                }}
              >
                <div style={{ fontSize: "1.4rem", marginBottom: "6px" }}>{uc.icon}</div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "6px" }}>
                  {uc.title}
                </h3>
                <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-600)", margin: 0 }}>
                  {uc.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Integration Points ── */}
        <section style={{ marginBottom: "56px" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "16px" }}>
            🔌 Integration Points
          </h2>
          <p style={{ fontSize: "0.88rem", color: "var(--ifm-color-emphasis-600)", marginBottom: "16px" }}>
            FrootAI plugs into the tools teams already use — no migration, no lock-in.
          </p>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "12px",
          }}>
            {integrations.map((ig) => (
              <div
                key={ig.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 18px",
                  borderRadius: "12px",
                  border: "1px solid var(--ifm-color-emphasis-200)",
                  background: "var(--ifm-color-emphasis-50)",
                }}
              >
                <span style={{ fontSize: "1.4rem" }}>{ig.icon}</span>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{ig.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-500)" }}>{ig.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Open Source ── */}
        <section style={{ marginBottom: "56px" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "16px" }}>
            📊 Open Source & Community
          </h2>
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
          }}>
            <a href="https://github.com/gitpavleenbali/frootai" target="_blank" rel="noopener noreferrer">
              <img
                alt="GitHub stars"
                src="https://img.shields.io/github/stars/gitpavleenbali/frootai?style=for-the-badge&logo=github&label=Stars"
              />
            </a>
            <a href="https://www.npmjs.com/package/frootai-mcp" target="_blank" rel="noopener noreferrer">
              <img
                alt="npm downloads"
                src="https://img.shields.io/npm/dw/frootai-mcp?style=for-the-badge&logo=npm&label=Downloads"
              />
            </a>
            <a href="https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai" target="_blank" rel="noopener noreferrer">
              <img
                alt="VS Code installs"
                src="https://img.shields.io/visual-studio-marketplace/i/pavleenbali.frootai?style=for-the-badge&logo=visualstudiocode&label=Installs"
              />
            </a>
            <img
              alt="License MIT"
              src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge"
            />
          </div>
        </section>

        {/* ── CTAs ── */}
        <section style={{
          textAlign: "center",
          padding: "40px 24px",
          borderRadius: "20px",
          background: "linear-gradient(135deg, rgba(124,58,237,0.06), rgba(16,185,129,0.06))",
          border: "2px solid rgba(124,58,237,0.15)",
        }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "8px" }}>
            Get Started with FrootAI
          </h2>
          <p style={{ fontSize: "0.9rem", color: "var(--ifm-color-emphasis-600)", marginBottom: "24px" }}>
            From zero to AI architecture knowledge in 30 seconds.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" }}>
            <a
              href="https://github.com/gitpavleenbali/frootai"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.glowPill}
              style={{ "--pill-color": "#7c3aed", display: "inline-block", textDecoration: "none" } as React.CSSProperties}
            >
              ⭐ Star on GitHub
            </a>
            <a
              href="https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.glowPill}
              style={{ "--pill-color": "#10b981", display: "inline-block", textDecoration: "none" } as React.CSSProperties}
            >
              💻 Install VS Code Extension
            </a>
            <a
              href="https://www.npmjs.com/package/frootai-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.glowPill}
              style={{ "--pill-color": "#6366f1", display: "inline-block", textDecoration: "none" } as React.CSSProperties}
            >
              📦 Try MCP Server
            </a>
            <Link
              to="/setup-guide"
              className={styles.glowPill}
              style={{ "--pill-color": "#f59e0b", display: "inline-block" } as React.CSSProperties}
            >
              📖 Setup Guide
            </Link>
          </div>
        </section>

      </div>
    </Layout>
  );
}
