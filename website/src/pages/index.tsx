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

const paths = [
  { emoji: "🚀", title: "New to AI", modules: "F1 → F3 → F2 → R1 → R2 → R3", duration: "6–8h" },
  { emoji: "⚡", title: "Build an Agent", modules: "F1 → R1 → O2 → O3 → O1 → T3", duration: "4–5h" },
  { emoji: "🏗️", title: "AI Infra", modules: "F1 → O4 → O5 → T3 → R2 → T1", duration: "5–6h" },
  { emoji: "🔍", title: "Reliable AI", modules: "R3 → R1 → R2 → T2", duration: "3–4h" },
  { emoji: "🎯", title: "Complete", modules: "F1 → F2 → ... → T3", duration: "16–22h" },
  { emoji: "💡", title: "Pro Tip", modules: "Share across teams — the open glue", duration: "" },
];

// ─── Components ────────────────────────────────────────────────────

function ExpandableLayer({ layer }: { layer: typeof layers[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${layer.color}33`, borderRadius: "12px", overflow: "hidden", marginBottom: "8px" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", color: "var(--ifm-font-color-base)" }}>
        <span style={{ fontSize: "1.2rem" }}>{layer.icon}</span>
        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: layer.color }}>{layer.id} — {layer.title}</span>
        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--ifm-color-emphasis-400)" }}>{layer.modules.length} modules {open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div style={{ display: "flex", gap: "8px", padding: "0 16px 12px", flexWrap: "wrap" }}>
          {layer.modules.map((m) => (
            <Link key={m.id} to={m.link} style={{ padding: "6px 14px", borderRadius: "8px", border: `1px solid ${layer.color}33`, fontSize: "0.78rem", fontWeight: 600, textDecoration: "none", color: "var(--ifm-font-color-base)" }}
              onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }), 100)}>
              {m.id}: {m.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpandablePath({ path }: { path: typeof paths[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.pathCard} onClick={() => setOpen(!open)} style={{ cursor: "pointer" }}>
      <div className={styles.pathEmoji}>{path.emoji}</div>
      <h3 className={styles.pathTitle}>{path.title}</h3>
      {path.duration && <p className={styles.pathDuration}>{path.duration}</p>}
      {open && <p className={styles.pathModules}>{path.modules}</p>}
      {!open && <p style={{ fontSize: "0.7rem", color: "var(--ifm-color-emphasis-400)" }}>Click to expand</p>}
    </div>
  );
}

// ─── Main Page (LEAN — 6 sections) ────────────────────────────────

export default function FrootAIPage(): JSX.Element {
  return (
    <Layout title="FrootAI — Know the Roots. Ship the Fruit." description="The open glue for AI architecture. 17 modules, 200+ AI terms, MCP server, 20 solution plays.">
      {/* ── 1. Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <img src="/frootai/img/aifroot-logo.svg" alt="FrootAI" className={styles.heroLogo} />
          <p className={styles.heroLabel}>Know the roots. Ship the fruit.</p>
          <h1 className={styles.heroTitle}>FrootAI</h1>
          <p className={styles.heroAcronym}>
            AI <span className={styles.heroAcronymF}>F</span>oundations · <span className={styles.heroAcronymR}>R</span>easoning · <span className={styles.heroAcronymO1}>O</span>rchestration · <span className={styles.heroAcronymO2}>O</span>perations · <span className={styles.heroAcronymT}>T</span>ransformation
          </p>
          <div style={{ maxWidth: "600px", margin: "16px auto 12px", padding: "12px 24px", borderRadius: "14px", border: "1px solid rgba(16, 185, 129, 0.15)", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.03), rgba(99, 102, 241, 0.03))" }}>
            <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-600)", lineHeight: 1.55, margin: 0, textAlign: "center" }}>
              A power kit for infrastructure and platform people to master and bridge the gap with AI applications, agents, and the agentic ecosystem.
            </p>
          </div>
          <div className={styles.heroCta}>
            <Link className={styles.ctaPrimary} to="/docs/" onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }), 100)}>🌱 Start from the Roots</Link>
            <Link className={styles.ctaSecondary} to="/ecosystem">🔗 Ecosystem</Link>
            <Link className={styles.ctaSecondary} to="/solution-plays">🎯 Solution Plays</Link>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.stat}><span className={styles.statNum} style={{ color: "#10b981" }}>17</span><span className={styles.statLabel}>Modules</span></div>
            <div className={styles.stat}><span className={styles.statNum} style={{ color: "#06b6d4" }}>20</span><span className={styles.statLabel}>Solutions</span></div>
            <div className={styles.stat}><span className={styles.statNum} style={{ color: "#6366f1" }}>6</span><span className={styles.statLabel}>MCP Tools</span></div>
            <div className={styles.stat}><span className={styles.statNum} style={{ color: "#7c3aed" }}>200+</span><span className={styles.statLabel}>AI Terms</span></div>
          </div>
        </div>
      </div>

      <main className={styles.main}>
        {/* ── 2. Ecosystem Overview (clickable cards → sub-pages) ── */}
        <section className={styles.lensSection}>
          <h2 className={styles.sectionTitle}>The Ecosystem</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
            <Link to="/ecosystem" style={{ padding: "18px", borderRadius: "14px", border: "2px solid rgba(99, 102, 241, 0.2)", textDecoration: "none", color: "var(--ifm-font-color-base)", textAlign: "center", transition: "all 0.2s" }} className={styles.lensCard}>
              <div style={{ fontSize: "1.8rem", marginBottom: "4px" }}>💻</div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>VS Code Extension</div>
              <div style={{ fontSize: "0.72rem", color: "#6366f1" }}>For you (the human)</div>
            </Link>
            <Link to="/mcp-tooling" style={{ padding: "18px", borderRadius: "14px", border: "2px solid rgba(16, 185, 129, 0.2)", textDecoration: "none", color: "var(--ifm-font-color-base)", textAlign: "center", transition: "all 0.2s" }} className={styles.lensCard}>
              <div style={{ fontSize: "1.8rem", marginBottom: "4px" }}>📦</div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>MCP Server (npm)</div>
              <div style={{ fontSize: "0.72rem", color: "#10b981" }}>For your agent (the AI)</div>
            </Link>
            <Link to="/solution-plays" style={{ padding: "18px", borderRadius: "14px", border: "2px solid rgba(124, 58, 237, 0.2)", textDecoration: "none", color: "var(--ifm-font-color-base)", textAlign: "center", transition: "all 0.2s" }} className={styles.lensCard}>
              <div style={{ fontSize: "1.8rem", marginBottom: "4px" }}>🎯</div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>Solution Plays</div>
              <div style={{ fontSize: "0.72rem", color: "#7c3aed" }}>DevKit + TuneKit</div>
            </Link>
          </div>
        </section>

        {/* ── 3. FROOT Framework (expandable) ── */}
        <section className={styles.lensSection}>
          <h2 className={styles.sectionTitle}>The FROOT Framework</h2>
          <p className={styles.sectionSub}>5 layers, 17 modules — click to expand</p>
          {layers.map((l) => <ExpandableLayer key={l.id} layer={l} />)}
        </section>

        {/* ── 4. Get FrootAI (compact) ── */}
        <section className={styles.lensSection}>
          <h2 className={styles.sectionTitle}>Get FrootAI</h2>
          <div className={styles.lensGrid}>
            <Link to="https://www.npmjs.com/package/frootai-mcp" className={styles.lensCard} style={{ textDecoration: "none", color: "var(--ifm-font-color-base)", cursor: "pointer" }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "4px" }}>📦 npm: MCP Server</div>
              <code style={{ fontSize: "0.82rem", color: "#10b981" }}>npx frootai-mcp</code>
              <p style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-400)", marginTop: "6px" }}>6 tools · 17 modules · 200+ terms</p>
            </Link>
            <Link to="https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai" className={styles.lensCard} style={{ textDecoration: "none", color: "var(--ifm-font-color-base)", cursor: "pointer" }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "4px" }}>💻 VS Code Extension</div>
              <code style={{ fontSize: "0.82rem", color: "#6366f1" }}>Search "FrootAI"</code>
              <p style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-400)", marginTop: "6px" }}>Sidebar · Commands · DevKit Init</p>
            </Link>
          </div>
        </section>

        {/* ── 5. Learning Paths (clickable/expandable) ── */}
        <section className={styles.paths}>
          <h2 className={styles.sectionTitle}>Learning Paths</h2>
          <p className={styles.sectionSub}>Click a path to see the module sequence</p>
          <div className={styles.pathGrid}>
            {paths.map((p) => <ExpandablePath key={p.title} path={p} />)}
          </div>
        </section>

        {/* ── 6. CTA ── */}
        <section className={styles.ctaSection}>
          <h2 className={styles.sectionTitle}>The Open Glue for AI Architecture</h2>
          <p className={styles.ctaDesc}>
            Infrastructure is the bedrock. Platform is the trunk. Application is the fruit.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link className={styles.ctaButton} to="/docs/" onClick={() => setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }), 100)}>🌱 Start from the Roots</Link>
            <Link className={styles.ctaButton} to="/mcp-tooling" style={{ background: "linear-gradient(135deg, #6366f1, #7c3aed)" }}>🔌 MCP Tooling</Link>
            <Link className={styles.ctaButton} to="https://github.com/gitpavleenbali/frootai" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>⭐ Star on GitHub</Link>
          </div>
        </section>
      </main>
    </Layout>
  );
}
