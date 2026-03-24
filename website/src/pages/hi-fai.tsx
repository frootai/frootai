import React, { useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

// ─── Step Data ─────────────────────────────────────────────────────

const steps = [
  {
    num: "01",
    icon: "🌱",
    title: "Welcome to FrootAI",
    time: "30 sec",
    content: (
      <div>
        <p style={{ fontSize: "0.88rem", lineHeight: 1.8, marginBottom: "12px" }}>
          <strong>FrootAI</strong> is a <em>Build It Yourself</em> AI LEGO Kit — the open-source glue binding{" "}
          <span style={{ color: "#10b981", fontWeight: 700 }}>Infrastructure</span>,{" "}
          <span style={{ color: "#06b6d4", fontWeight: 700 }}>Platform</span> &{" "}
          <span style={{ color: "#7c3aed", fontWeight: 700 }}>Application</span> teams with the GenAI ecosystem.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px", marginBottom: "12px" }}>
          {[
            { num: "20", label: "Solution Plays", color: "#7c3aed" },
            { num: "16", label: "MCP Tools", color: "#6366f1" },
            { num: "18", label: "Knowledge Modules", color: "#10b981" },
            { num: "200+", label: "AI Glossary Terms", color: "#f59e0b" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center", padding: "10px", borderRadius: "10px", border: `1px solid ${s.color}33`, background: `${s.color}08` }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: s.color }}>{s.num}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--ifm-color-emphasis-400)" }}>{s.label}</div>
            </div>
          ))}
        </div>
        <blockquote style={{ borderLeft: "3px solid #10b981", paddingLeft: "12px", color: "var(--ifm-color-emphasis-500)", fontSize: "0.82rem", fontStyle: "italic", margin: "10px 0" }}>
          💡 <strong>FROOT</strong> = Foundations · Reasoning · Orchestration · Operations · Transformation
        </blockquote>
      </div>
    ),
  },
  {
    num: "02",
    icon: "💻",
    title: "Install VS Code Extension",
    time: "1 min",
    content: (
      <div>
        <p style={{ fontSize: "0.85rem", lineHeight: 1.8, marginBottom: "10px" }}>
          The VS Code Extension is your control center — browse plays, init DevKit, search knowledge, and chain agents.
        </p>
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "10px", padding: "14px 16px", border: "1px solid rgba(16,185,129,0.15)", marginBottom: "10px" }}>
          <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#10b981", fontWeight: 700, marginBottom: "4px" }}>Terminal</div>
          <code style={{ fontSize: "0.82rem", color: "#e0e0e0" }}>code --install-extension pavleenbali.frootai</code>
        </div>
        <p style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-400)" }}>
          Or: <strong>Ctrl+Shift+X</strong> → search <strong>"FrootAI"</strong> → Install
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
          {["📋 Solution Plays (20)", "🔧 MCP Tools (16)", "📚 Knowledge Hub (18)", "📖 AI Glossary (200+)"].map(p => (
            <span key={p} style={{ padding: "3px 10px", borderRadius: "6px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", fontSize: "0.7rem", color: "#10b981" }}>{p}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    num: "03",
    icon: "🔌",
    title: "Set Up MCP Server",
    time: "1 min",
    content: (
      <div>
        <p style={{ fontSize: "0.85rem", lineHeight: 1.8, marginBottom: "10px" }}>
          The MCP Server gives your AI agent 22 tools for live FrootAI knowledge — architecture patterns, model pricing, Azure docs, and more.
        </p>
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "10px", padding: "14px 16px", border: "1px solid rgba(16,185,129,0.15)", marginBottom: "10px" }}>
          <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#10b981", fontWeight: 700, marginBottom: "6px" }}>Add to .vscode/mcp.json</div>
          <pre style={{ margin: 0, fontSize: "0.78rem", color: "#e0e0e0", whiteSpace: "pre-wrap" }}>{`{
  "servers": {
    "frootai": {
      "command": "npx",
      "args": ["frootai-mcp"]
    }
  }
}`}</pre>
        </div>
        <p style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-400)" }}>
          Or run globally: <code style={{ background: "rgba(16,185,129,0.1)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.78rem" }}>npm install -g frootai-mcp</code>
        </p>
      </div>
    ),
  },
  {
    num: "04",
    icon: "⚙️",
    title: "Pick Your First Play",
    time: "30 sec",
    content: (
      <div>
        <p style={{ fontSize: "0.85rem", lineHeight: 1.8, marginBottom: "10px" }}>
          Use the <strong>Solution Configurator</strong> — answer 3 questions and get a personalized play recommendation.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "10px" }}>
          {[
            { q: "What's your goal?", ex: "RAG, Agent, Voice...", color: "#10b981" },
            { q: "Team experience?", ex: "Beginner → Expert", color: "#06b6d4" },
            { q: "Scale needed?", ex: "Dev, Staging, Prod", color: "#7c3aed" },
          ].map(c => (
            <div key={c.q} style={{ padding: "10px", borderRadius: "8px", border: `1px solid ${c.color}33`, textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: c.color, marginBottom: "2px" }}>{c.q}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--ifm-color-emphasis-400)" }}>{c.ex}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-400)" }}>
          🎯 <strong>Recommended first play:</strong> Play 01 (Enterprise RAG Q&A) — covers the most common AI scenario.
        </p>
      </div>
    ),
  },
  {
    num: "05",
    icon: "🚀",
    title: "Init DevKit + TuneKit",
    time: "1 min",
    content: (
      <div>
        <p style={{ fontSize: "0.85rem", lineHeight: 1.8, marginBottom: "10px" }}>
          Click your play in VS Code sidebar → <strong>Init DevKit</strong> → 19 .github Agentic OS files + Bicep infra land in your workspace.
          Then → <strong>Init TuneKit</strong> → AI config + evaluation files.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
          <div style={{ padding: "12px", borderRadius: "10px", border: "1px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.04)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#10b981", marginBottom: "4px" }}>🛠️ DevKit (19 files)</div>
            <div style={{ fontSize: "0.72rem", color: "var(--ifm-color-emphasis-400)", lineHeight: 1.6 }}>
              copilot-instructions.md<br/>
              3 instruction files<br/>
              4 prompts (/deploy, /test...)<br/>
              3 agents (builder, reviewer, tuner)<br/>
              3 skills + infra/main.bicep
            </div>
          </div>
          <div style={{ padding: "12px", borderRadius: "10px", border: "1px solid rgba(124,58,237,0.2)", background: "rgba(124,58,237,0.04)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#7c3aed", marginBottom: "4px" }}>🎛️ TuneKit (4-8 files)</div>
            <div style={{ fontSize: "0.72rem", color: "var(--ifm-color-emphasis-400)", lineHeight: 1.6 }}>
              config/openai.json<br/>
              config/guardrails.json<br/>
              config/agents.json<br/>
              evaluation/eval.py<br/>
              evaluation/test-set.jsonl
            </div>
          </div>
        </div>
        <blockquote style={{ borderLeft: "3px solid #10b981", paddingLeft: "12px", color: "var(--ifm-color-emphasis-500)", fontSize: "0.78rem", fontStyle: "italic", margin: "8px 0" }}>
          💡 Copilot automatically reads copilot-instructions.md + agent.md — your project becomes AI-native instantly.
        </blockquote>
      </div>
    ),
  },
  {
    num: "06",
    icon: "🤖",
    title: "Build with Copilot",
    time: "1 min",
    content: (
      <div>
        <p style={{ fontSize: "0.85rem", lineHeight: 1.8, marginBottom: "10px" }}>
          Open <strong>Copilot Chat</strong> (Ctrl+Shift+I) and ask it to build the solution. It reads all .github context automatically.
        </p>
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "10px", padding: "14px 16px", border: "1px solid rgba(16,185,129,0.15)", marginBottom: "10px" }}>
          <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#10b981", fontWeight: 700, marginBottom: "6px" }}>Try These Prompts</div>
          <div style={{ fontSize: "0.8rem", color: "#e0e0e0", lineHeight: 1.8 }}>
            <div>💬 <em>"Build the RAG pipeline based on agent.md"</em></div>
            <div>💬 <em>"Deploy this play to Azure using /deploy prompt"</em></div>
            <div>💬 <em>"Review this code with the reviewer agent"</em></div>
          </div>
        </div>
        <p style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-400)" }}>
          Or use: <strong>Ctrl+Shift+P → FrootAI: Auto-Chain Agents</strong> → builder → reviewer → tuner workflow.
        </p>
      </div>
    ),
  },
  {
    num: "07",
    icon: "☁️",
    title: "Deploy to Azure",
    time: "~2 min",
    content: (
      <div>
        <p style={{ fontSize: "0.85rem", lineHeight: 1.8, marginBottom: "10px" }}>
          Each play ships with real <strong>Bicep templates</strong> in <code style={{ background: "rgba(16,185,129,0.1)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.78rem" }}>infra/main.bicep</code>. Deploy with:
        </p>
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "10px", padding: "14px 16px", border: "1px solid rgba(16,185,129,0.15)", marginBottom: "10px" }}>
          <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#10b981", fontWeight: 700, marginBottom: "6px" }}>Deploy Commands</div>
          <pre style={{ margin: 0, fontSize: "0.78rem", color: "#e0e0e0", whiteSpace: "pre-wrap" }}>{`# Option 1: Azure Developer CLI
azd up

# Option 2: Bicep direct
az deployment group create \\
  --resource-group rg-frootai \\
  --template-file infra/main.bicep \\
  --parameters infra/parameters.json`}</pre>
        </div>
        <p style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-400)" }}>
          🔒 All templates use <strong>Managed Identity</strong> — no API keys, no secrets in code.
        </p>
      </div>
    ),
  },
  {
    num: "08",
    icon: "✅",
    title: "Validate & Evaluate",
    time: "1 min",
    content: (
      <div>
        <p style={{ fontSize: "0.85rem", lineHeight: 1.8, marginBottom: "10px" }}>
          Each play includes a real <code style={{ background: "rgba(16,185,129,0.1)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.78rem" }}>evaluation/eval.py</code> with automated quality scoring.
        </p>
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "10px", padding: "14px 16px", border: "1px solid rgba(16,185,129,0.15)", marginBottom: "10px" }}>
          <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#10b981", fontWeight: 700, marginBottom: "4px" }}>Terminal</div>
          <code style={{ fontSize: "0.82rem", color: "#e0e0e0" }}>python evaluation/eval.py --test-set evaluation/test-set.jsonl</code>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
          {["Faithfulness", "Relevance", "Groundedness", "Latency", "Cost/query"].map(m => (
            <span key={m} style={{ padding: "3px 10px", borderRadius: "6px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", fontSize: "0.7rem", color: "#10b981" }}>✅ {m}</span>
          ))}
        </div>
      </div>
    ),
  },
];

// ─── MAIN PAGE ─────────────────────────────────────────────────────

export default function HiFaiPage(): JSX.Element {
  const [active, setActive] = useState(0);

  return (
    <Layout title="🖐️ Hi FAI — 5-Minute Quickstart" description="From zero to your first AI solution in 5 minutes. The fastest way to get started with FrootAI.">
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 24px 80px", width: "100%" }}>

        {/* ═══ HERO ═══ */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ display: "inline-block", padding: "3px 14px", borderRadius: "20px", background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.08))", border: "1px solid rgba(16,185,129,0.3)", fontSize: "0.65rem", color: "#10b981", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "12px" }}>
            5-Minute Quickstart
          </div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 800, margin: "0 0 8px", background: "linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            🖐️ Hi FAI
          </h1>
          <p style={{ color: "var(--ifm-color-emphasis-500)", fontSize: "0.92rem", margin: "0 0 6px", fontWeight: 500 }}>
            From <span style={{ color: "#10b981", fontWeight: 700 }}>zero</span> to your first <span style={{ color: "#7c3aed", fontWeight: 700 }}>AI solution</span> — in 5 minutes
          </p>
          <p style={{ color: "var(--ifm-color-emphasis-400)", fontSize: "0.76rem", margin: 0, fontStyle: "italic" }}>
            Install → Configure → Build → Deploy → Evaluate. Let's go!
          </p>
        </div>

        {/* ═══ PROGRESS BAR ═══ */}
        <div style={{ display: "flex", justifyContent: "center", gap: "4px", marginBottom: "32px", flexWrap: "wrap" }}>
          {steps.map((s, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              padding: "6px 14px", borderRadius: "20px", border: `1px solid ${i === active ? "rgba(16,185,129,0.5)" : i < active ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)"}`,
              background: i === active ? "rgba(16,185,129,0.15)" : i < active ? "rgba(16,185,129,0.05)" : "transparent",
              color: i === active ? "#10b981" : i < active ? "#10b981" : "var(--ifm-color-emphasis-400)",
              fontSize: "0.68rem", fontWeight: i === active ? 700 : 500, cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap"
            }}>
              {i < active ? "✅" : s.icon} {s.num}
            </button>
          ))}
        </div>

        {/* ═══ ACTIVE STEP CARD ═══ */}
        <div style={{ border: "1px solid rgba(16,185,129,0.25)", borderRadius: "20px", background: "linear-gradient(180deg, rgba(26,26,46,0.7) 0%, rgba(15,15,30,0.8) 100%)", padding: "32px", boxShadow: "0 8px 32px rgba(16,185,129,0.06)", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.1))", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
              {steps[active].icon}
            </div>
            <div>
              <div style={{ fontSize: "0.65rem", color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Step {steps[active].num} of 08 · {steps[active].time}
              </div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>{steps[active].title}</h2>
            </div>
          </div>
          {steps[active].content}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <button onClick={() => setActive(Math.max(0, active - 1))} disabled={active === 0}
              style={{ padding: "8px 20px", borderRadius: "10px", border: "1px solid rgba(16,185,129,0.2)", background: "transparent", color: active === 0 ? "#444" : "#10b981", fontSize: "0.8rem", cursor: active === 0 ? "default" : "pointer", fontWeight: 600 }}>
              ← Previous
            </button>
            {active < steps.length - 1 ? (
              <button onClick={() => setActive(active + 1)}
                style={{ padding: "8px 24px", borderRadius: "10px", background: "linear-gradient(135deg, #10b981, #06b6d4)", color: "#000", border: "none", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.2)" }}>
                Next Step →
              </button>
            ) : (
              <Link to="/chatbot"
                style={{ padding: "8px 24px", borderRadius: "10px", background: "linear-gradient(135deg, #f59e0b, #eab308)", color: "#000", border: "none", fontSize: "0.8rem", fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 12px rgba(245,158,11,0.2)" }}>
                ✨ Ask FAI Agent →
              </Link>
            )}
          </div>
        </div>

        {/* ═══ COMPLETE GUIDES ═══ */}
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ textAlign: "center", fontSize: "1rem", fontWeight: 700, marginBottom: "14px", color: "var(--ifm-color-emphasis-600)" }}>
            📚 Ready to go deeper? Explore the complete guides
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
            {[
              { to: "/learning-hub", icon: "📚", title: "FAI Learning Hub", sub: "18 modules · Glossary · Workshops", color: "#f97316" },
              { to: "/dev-hub", icon: "🛠️", title: "FAI Developer Hub", sub: "API ref · Changelog · Architecture", color: "#0ea5e9" },
              { to: "/solution-plays", icon: "🎯", title: "All 20 Solution Plays", sub: "Browse plays with user guides", color: "#7c3aed" },
              { to: "/setup-guide", icon: "📖", title: "Complete Setup Guide", sub: "VS Code + MCP + DevKit details", color: "#10b981" },
              { to: "/ecosystem", icon: "🔗", title: "FAI Ecosystem", sub: "Partners · Marketplace · Packages", color: "#6366f1" },
              { to: "/configurator", icon: "⚙️", title: "Solution Configurator", sub: "3 questions → your play", color: "#f59e0b" },
            ].map(card => (
              <Link key={card.title} to={card.to} className={styles.glowCard} style={{ "--glow-color": card.color } as React.CSSProperties}>
                <div style={{ fontSize: "1.4rem", marginBottom: "4px" }}>{card.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{card.title}</div>
                <div style={{ fontSize: "0.7rem", color: card.color }}>{card.sub}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* ═══ BOTTOM ═══ */}
        <div style={{ textAlign: "center", display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/" className={styles.glowPill} style={{ "--pill-color": "#10b981" } as React.CSSProperties}>🌳 Back to FrootAI</Link>
          <Link to="/chatbot" className={styles.glowPill} style={{ "--pill-color": "#f59e0b" } as React.CSSProperties}>✨ FAI Agent</Link>
          <Link to="https://github.com/gitpavleenbali/frootai" className={styles.glowPill} style={{ "--pill-color": "#eab308" } as React.CSSProperties}>⭐ Star on GitHub</Link>
        </div>
      </div>
    </Layout>
  );
}
