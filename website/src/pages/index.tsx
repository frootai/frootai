import React, { useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

// ─── Data ──────────────────────────────────────────────────────────

const layers = [
  { id: "F", icon: "🌱", title: "Foundations", color: "#f59e0b", modules: [
    { id: "F1", name: "GenAI Foundations", link: "/docs/GenAI-Foundations" },
    { id: "F2", name: "LLM Landscape", link: "/docs/LLM-Landscape" },
    { id: "F3", name: "AI Glossary A–Z", link: "/docs/F3-AI-Glossary-AZ" },
    { id: "F4", name: ".github Agentic OS", link: "/docs/F4-GitHub-Agentic-OS" },
  ]},
  { id: "R", icon: "🪵", title: "Reasoning", color: "#10b981", modules: [
    { id: "R1", name: "Prompt Engineering", link: "/docs/Prompt-Engineering" },
    { id: "R2", name: "RAG Architecture", link: "/docs/RAG-Architecture" },
    { id: "R3", name: "Deterministic AI", link: "/docs/R3-Deterministic-AI" },
  ]},
  { id: "O¹", icon: "🌿", title: "Orchestration", color: "#06b6d4", modules: [
    { id: "O1", name: "Semantic Kernel", link: "/docs/Semantic-Kernel" },
    { id: "O2", name: "AI Agents", link: "/docs/AI-Agents-Deep-Dive" },
    { id: "O3", name: "MCP & Tools", link: "/docs/O3-MCP-Tools-Functions" },
  ]},
  { id: "O²", icon: "🍃", title: "Operations", color: "#6366f1", modules: [
    { id: "O4", name: "Azure AI Platform", link: "/docs/Azure-AI-Foundry" },
    { id: "O5", name: "AI Infrastructure", link: "/docs/AI-Infrastructure" },
    { id: "O6", name: "Copilot Ecosystem", link: "/docs/Copilot-Ecosystem" },
  ]},
  { id: "T", icon: "🍎", title: "Transformation", color: "#7c3aed", modules: [
    { id: "T1", name: "Fine-Tuning", link: "/docs/T1-Fine-Tuning-MLOps" },
    { id: "T2", name: "Responsible AI", link: "/docs/Responsible-AI-Safety" },
    { id: "T3", name: "Production Patterns", link: "/docs/T3-Production-Patterns" },
  ]},
];

const outcomes = [
  { icon: "🚀", title: "New to AI?", desc: "Build AI literacy from zero" },
  { icon: "🤖", title: "Build Agents", desc: "MCP, SK, Agent Framework" },
  { icon: "🏗️", title: "AI Infra Expert", desc: "Landing zones, GPU, hosting" },
  { icon: "🏛️", title: "Solution Accelerator", desc: "Azure Verified Modules + Bicep" },
  { icon: "🎯", title: "Full-Stack Agentic", desc: ".github Agentic OS · 7 primitives" },
  { icon: "📊", title: "AI Cost Optimization", desc: "FinOps, caching, model selection" },
  { icon: "🌛", title: "Fine-Tuning Pro", desc: "LoRA, evaluation, MLOps" },
  { icon: "🛡️", title: "Reliable AI", desc: "Determinism, guardrails, safety" },
];

// ─── Components ────────────────────────────────────────────────────

function ExpandableLayer({ layer }: { layer: typeof layers[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.frootLayer} style={{ "--layer-color": layer.color } as React.CSSProperties}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", color: "var(--ifm-font-color-base)" }}>
        <span style={{ fontSize: "1.2rem" }}>{layer.icon}</span>
        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: layer.color }}>{layer.id} — {layer.title}</span>
        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--ifm-color-emphasis-400)" }}>{layer.modules.length} modules {open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div style={{ display: "flex", gap: "8px", padding: "4px 16px 12px", flexWrap: "wrap" }}>
          {layer.modules.map((m) => (
            <Link key={m.id} to={m.link} className={styles.moduleChip} style={{ borderColor: `${layer.color}44` }}
              onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }), 100)}>
              {m.id}: {m.name} →
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────

export default function FrootAIPage(): JSX.Element {
  return (
    <Layout title="FrootAI — From the Roots to the Fruits. Build It Yourself." description="The BIY AI Kit for infrastructure, platform, and application teams to master AI infra, AI platform, and AI application agent ecosystem.">

      {/* ═══ 1. HERO ═══ */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <img src="/img/frootai-logo.png" alt="FrootAI" className={styles.heroLogo} />

          <h1 className={styles.heroTitle}>FrootAI</h1>

          <p className={styles.heroLabel}>From the Roots to the Fruits</p>
          <p className={styles.heroSubLabel}>It's simply Frootful.</p>

          <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-400)", margin: "0 auto 8px", letterSpacing: "0.03em" }}>
            Infra ⇄ Platform ⇄ Apps
          </p>

          <p className={styles.heroAcronym}>
            AI <span className={styles.heroAcronymF}>F</span>oundations · <span className={styles.heroAcronymR}>R</span>easoning · <span className={styles.heroAcronymO1}>O</span>rchestration · <span className={styles.heroAcronymO2}>O</span>perations · <span className={styles.heroAcronymT}>T</span>ransformation
          </p>

          {/* Green translucent mission box */}
          <div style={{ maxWidth: "640px", margin: "16px auto 0", padding: "14px 24px", borderRadius: "14px", border: "1px solid rgba(16, 185, 129, 0.25)", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(99, 102, 241, 0.04))" }}>
            <p style={{ fontSize: "0.84rem", color: "var(--ifm-color-emphasis-600)", lineHeight: 1.6, margin: "0 0 8px", textAlign: "center" }}>
              <em>"Build It Yourself (BIY) — A power kit for infrastructure, platform, and application teams to master and bridge the gap between AI Infra, AI Platform, and the AI Application/Agentic Ecosystem."</em>
            </p>
            <p style={{ fontSize: "0.78rem", fontStyle: "italic", color: "var(--ifm-color-emphasis-400)", margin: 0, textAlign: "center" }}>
              From a single token to a production agent fleet.
            </p>
          </div>
        </div>
      </div>

      <main className={styles.main}>

        {/* ═══ 2. ECOSYSTEM (glowing cards) ═══ */}
        <section className={styles.lensSection}>
          <h2 className={styles.sectionTitle}>FAI Ecosystem</h2>
          <p style={{ fontSize: "0.75rem", fontStyle: "italic", color: "var(--ifm-color-emphasis-400)", textAlign: "center", marginBottom: "16px" }}>Click on the cards to explore more</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px", padding: "6px 0" }}>
            {[
              { to: "/configurator", icon: "⚙️", title: "Solution Configurator", sub: "3 questions → your play", color: "#f59e0b" },
              { to: "/solution-plays", icon: "🎯", title: "Solution Plays", sub: "20 plays · DevKit + TuneKit", color: "#7c3aed" },
              { to: "/vscode-extension", icon: "💻", title: "VS Code Extension", sub: "16 commands · Standalone", color: "#6366f1" },
              { to: "/mcp-tooling", icon: "📦", title: "MCP Server (npm)", sub: "22 tools for your agent", color: "#10b981" },
              { to: "/marketplace", icon: "🏪", title: "Plugin Marketplace", sub: "Discover & share plugins", color: "#ec4899" },
              { to: "/partners", icon: "🤝", title: "Partner Integrations", sub: "ServiceNow, Salesforce, SAP", color: "#06b6d4" },
              { to: "/packages", icon: "🧩", title: "FROOT Packages", sub: "Downloadable LEGO blocks", color: "#8b5cf6" },
              { to: "/learning-hub", icon: "📚", title: "FAI Learning Hub", sub: "18 modules · Glossary · Workshops", color: "#f97316" },
              { to: "/dev-hub", icon: "🛠️", title: "FAI Developer Hub", sub: "API ref · Changelog · Guides", color: "#0ea5e9" },
            ].map((card) => (
              <Link key={card.title} to={card.to} className={styles.glowCard} style={{ "--glow-color": card.color } as React.CSSProperties}>
                <div style={{ fontSize: "1.8rem", marginBottom: "4px" }}>{card.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{card.title}</div>
                <div style={{ fontSize: "0.72rem", color: card.color }}>{card.sub}</div>
              </Link>
            ))}
            {/* Open Source tile → links to /enterprise */}
            <Link to="/community" className={styles.glowCard} style={{ "--glow-color": "#00C853" } as React.CSSProperties}>
              <div style={{ fontSize: "1.8rem", marginBottom: "4px" }}>🌱</div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>100% Open Source</div>
              <div style={{ fontSize: "0.72rem", color: "#00C853" }}>MIT License — Star on GitHub</div>
            </Link>
          </div>
        </section>

        {/* ═══ 3. STATS ═══ */}
        <div style={{ display: "flex", justifyContent: "center", gap: "32px", padding: "12px 0 20px", flexWrap: "wrap" }}>
          {[
            { num: "18+", label: "Modules", color: "#10b981" },
            { num: "20", label: "Solution Plays", color: "#06b6d4" },
            { num: "22", label: "MCP Tools", color: "#6366f1" },
            { num: "200+", label: "AI Terms", color: "#7c3aed" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: s.color }}>{s.num}</div>
              <div style={{ fontSize: "0.7rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ifm-color-emphasis-400)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ═══ 4. FROOT Framework ═══ */}
        <section className={styles.lensSection}>
          <h2 className={styles.sectionTitle}>The FROOT Framework</h2>
          <p className={styles.sectionSub}>AI Knowledge Hub — 5 layers, 18 modules. Click to expand, then click modules to learn.</p>
          {layers.map((l) => <ExpandableLayer key={l.id} layer={l} />)}
        </section>

        {/* ═══ 5. OUTCOMES ═══ */}
        <section className={styles.lensSection}>
          <h2 className={styles.sectionTitle}>What These Help You Achieve</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "12px" }}>
            {outcomes.map((o) => (
              <div key={o.title} style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--ifm-color-emphasis-200)", textAlign: "center" }}>
                <div style={{ fontSize: "1.4rem", marginBottom: "4px" }}>{o.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "2px" }}>{o.title}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--ifm-color-emphasis-500)" }}>{o.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ 6. CTA ═══ */}
        <section className={styles.lensSection}>
          <h2 className={styles.sectionTitle}>
            FrootAI — The <span style={{ color: "#10b981" }}>B</span>uild <span style={{ color: "#06b6d4" }}>I</span>t <span style={{ color: "#7c3aed" }}>Y</span>ourself AI LEGO Kit
          </h2>
          <p className={styles.sectionSub}>
            An Open Glue Binding <span style={{ color: "#10b981", fontWeight: 700 }}>I</span>nfrastructure, <span style={{ color: "#06b6d4", fontWeight: 700 }}>P</span>latform, and <span style={{ color: "#7c3aed", fontWeight: 700 }}>A</span>pplication Teams
          </p>
          <div className={styles.ctaSection}>
            <p style={{ fontSize: "0.78rem", fontStyle: "italic", color: "var(--ifm-color-emphasis-400)", textAlign: "center", margin: "0 auto 16px" }}>
              <span style={{ color: "#10b981" }}>Infrastructure</span> are the roots. <span style={{ color: "#06b6d4" }}>Platform</span> is the trunk. <span style={{ color: "#7c3aed" }}>Application</span> is the fruit.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", padding: "6px 0" }}>
              {[
                { label: "⚙️ Solution Configurator", to: "/configurator", color: "#f59e0b" },
                { label: "🎯 Solution Plays", to: "/solution-plays", color: "#7c3aed" },
                { label: "🧩 FROOT Packages", to: "/packages", color: "#8b5cf6" },
                { label: "🔗 Ecosystem Overview", to: "/ecosystem", color: "#0ea5e9" },
                { label: "💻 VS Code Extension", to: "/vscode-extension", color: "#6366f1" },
                { label: "🔌 MCP Server", to: "/mcp-tooling", color: "#10b981" },
                { label: "📖 Setup Guide", to: "/setup-guide", color: "#14b8a6" },
                { label: "🏪 Plugin Marketplace", to: "/marketplace", color: "#ec4899" },
                { label: "🌱 Open Source Community", to: "/community", color: "#00C853" },
                { label: "📈 FrootAI Adoption", to: "/adoption", color: "#f43f5e" },
                { label: "📚 FAI Learning Hub", to: "/learning-hub", color: "#f97316" },
                { label: "🛠️ FAI Developer Hub", to: "/dev-hub", color: "#0ea5e9" },
                { label: "✨ Agent FAI", to: "/chatbot", color: "#f59e0b" },
                { label: "⭐ Star on GitHub", to: "https://github.com/gitpavleenbali/frootai", color: "#eab308" },
              ].map((link) => (
                <Link key={link.label} to={link.to} className={styles.glowPill} style={{ "--pill-color": link.color } as React.CSSProperties}
                  onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }), 100)}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
