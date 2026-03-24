import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

// ─── Data ──────────────────────────────────────────────────────────

const quickLinks = [
  { icon: "🛠️", title: "Admin Guide", sub: "Install, configure, maintain", to: "/docs/admin-guide", color: "#f59e0b" },
  { icon: "📖", title: "User Guide", sub: "End-to-end usage walkthrough", to: "/docs/user-guide-complete", color: "#10b981" },
  { icon: "🤝", title: "Contributor Guide", sub: "Add plays, improve tools", to: "/docs/contributor-guide", color: "#06b6d4" },
  { icon: "📡", title: "API Reference", sub: "22 MCP tools, 16 commands", to: "/docs/api-reference", color: "#6366f1" },
  { icon: "📋", title: "Changelog", sub: "Version history & releases", to: "/dev-hub-changelog", color: "#7c3aed" },
  { icon: "🏗️", title: "Architecture", sub: "System design & data flow", to: "/docs/architecture-overview", color: "#ec4899" },
];

const quickStart = [
  { step: "1", label: "Install Extension", cmd: "code --install-extension pavleenbali.frootai", color: "#10b981" },
  { step: "2", label: "Init DevKit", cmd: "FROOT: Init DevKit  (Cmd+Shift+P)", color: "#06b6d4" },
  { step: "3", label: "Deploy", cmd: "FROOT: Deploy Solution  (Cmd+Shift+P)", color: "#7c3aed" },
];

const versions = [
  { label: "VS Code Extension", version: "v1.0.0", color: "#6366f1" },
  { label: "MCP Server (npm)", version: "v3.0.1", color: "#10b981" },
  { label: "Website", version: "13 pages", color: "#f59e0b" },
];

const resources = [
  { icon: "🐛", title: "GitHub Issues", to: "https://github.com/gitpavleenbali/frootai/issues", color: "#f59e0b" },
  { icon: "📝", title: "PR Template", to: "https://github.com/gitpavleenbali/frootai/blob/main/.github/pull_request_template.md", color: "#10b981" },
  { icon: "⚙️", title: "CI Pipeline", to: "https://github.com/gitpavleenbali/frootai/actions", color: "#06b6d4" },
  { icon: "📄", title: "CONTRIBUTING.md", to: "https://github.com/gitpavleenbali/frootai/blob/main/CONTRIBUTING.md", color: "#6366f1" },
];

// ─── Styles ────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = { marginBottom: "56px" };
const h2: React.CSSProperties = { fontSize: "1.3rem", fontWeight: 700, marginBottom: "8px", textAlign: "center" };
const subText: React.CSSProperties = { fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)", textAlign: "center", marginBottom: "24px" };

const cardStyle: React.CSSProperties = {
  padding: "16px 20px", borderRadius: "14px",
  border: "1px solid var(--ifm-color-emphasis-200)",
  background: "var(--ifm-background-surface-color)",
};

const stepCard: React.CSSProperties = {
  ...cardStyle,
  textAlign: "center",
  flex: "1 1 0",
  minWidth: "220px",
};

const codeBox: React.CSSProperties = {
  display: "block", padding: "8px 12px", borderRadius: "8px",
  fontSize: "0.72rem", fontFamily: "var(--ifm-font-family-monospace)",
  background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.12)",
  marginTop: "8px", wordBreak: "break-all" as any,
};

// ─── Page ──────────────────────────────────────────────────────────

export default function DevHubPage(): JSX.Element {
  return (
    <Layout title="FAI Developer Hub" description="Your one-stop shop for building with FrootAI — guides, APIs, changelogs, and architecture.">
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* ═══ HEADER ═══ */}
        <section style={{ textAlign: "center", marginBottom: "56px" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "#10b981", marginBottom: "8px" }}>
            Developer Portal
          </p>
          <h1 style={{ fontSize: "2.6rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "8px",
            background: "linear-gradient(135deg, #10b981 0%, #06b6d4 30%, #6366f1 60%, #7c3aed 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            FAI Developer Hub
          </h1>
          <p style={{ fontSize: "1rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "550px", margin: "0 auto" }}>
            Your one-stop shop for building with FrootAI — guides, APIs, changelogs, and architecture.
          </p>
        </section>

        {/* ═══ QUICK LINKS GRID ═══ */}
        <section style={sectionStyle}>
          <h2 style={h2}>Quick Links</h2>
          <p style={subText}>Everything you need to build, extend, and deploy.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
            {quickLinks.map((card) => (
              <Link key={card.title} to={card.to} className={styles.glowCard} style={{ "--glow-color": card.color } as React.CSSProperties}>
                <div style={{ fontSize: "1.8rem", marginBottom: "4px" }}>{card.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{card.title}</div>
                <div style={{ fontSize: "0.72rem", color: card.color }}>{card.sub}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* ═══ GETTING STARTED ═══ */}
        <section style={sectionStyle}>
          <h2 style={h2}>Getting Started</h2>
          <p style={subText}>Up and running in 3 steps.</p>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
            {quickStart.map((s) => (
              <div key={s.step} style={stepCard}>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: s.color, marginBottom: "4px" }}>{s.step}</div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "4px" }}>{s.label}</div>
                <code style={codeBox}>{s.cmd}</code>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ LATEST RELEASE ═══ */}
        <section style={sectionStyle}>
          <h2 style={h2}>Latest Release</h2>
          <p style={subText}>Current versions across the ecosystem.</p>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            {versions.map((v) => (
              <div key={v.label} style={{ ...cardStyle, textAlign: "center", minWidth: "180px", flex: "1 1 0" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ifm-color-emphasis-400)", marginBottom: "4px" }}>{v.label}</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: v.color }}>{v.version}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ DEVELOPER RESOURCES ═══ */}
        <section style={sectionStyle}>
          <h2 style={h2}>Developer Resources</h2>
          <p style={subText}>Contribute, report, and collaborate.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
            {resources.map((r) => (
              <Link key={r.title} to={r.to} className={styles.glowCard} style={{ "--glow-color": r.color } as React.CSSProperties}>
                <div style={{ fontSize: "1.4rem", marginBottom: "4px" }}>{r.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{r.title}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* ═══ BOTTOM CTAs ═══ */}
        <section style={{ textAlign: "center", padding: "32px 24px", borderRadius: "16px", border: "1px solid var(--ifm-color-emphasis-200)", background: "var(--ifm-background-surface-color)" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>Ready to build?</h2>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { label: "📚 Setup Guide", to: "/setup-guide", color: "#f97316" },
              { label: "🎯 Solution Plays", to: "/solution-plays", color: "#7c3aed" },
              { label: "⭐ Star on GitHub", to: "https://github.com/gitpavleenbali/frootai", color: "#f59e0b" },
            ].map((link) => (
              <Link key={link.label} to={link.to} className={styles.glowPill} style={{ "--pill-color": link.color } as React.CSSProperties}>
                {link.label}
              </Link>
            ))}
          </div>
        </section>

      </div>
    </Layout>
  );
}
