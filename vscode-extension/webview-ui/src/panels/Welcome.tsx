import { vscode } from "../vscode";

const VERSION = "9.0.0";

const FEATURES = [
  { icon: "🏗️", title: "101 Solution Plays", desc: "Pre-architected AI solutions from Enterprise RAG to Swarm Orchestration", action: "browsePlays" },
  { icon: "🔍", title: "Unified Search", desc: "Search across plays, MCP tools, glossary terms, and modules — instantly", action: "searchAll" },
  { icon: "🧪", title: "45 MCP Tools", desc: "Architecture tools for any MCP-compatible AI assistant", action: "mcpExplorer" },
  { icon: "📊", title: "Evaluation Dashboard", desc: "Track AI quality with trend sparklines and threshold-based pass/fail", action: "evaluation" },
  { icon: "⚡", title: "One-Click Scaffolding", desc: "Init DevKit, TuneKit, SpecKit — agents, config, and manifests", action: "scaffold" },
  { icon: "🎯", title: "Solution Configurator", desc: "Answer 5 questions, get a personalized play recommendation", action: "configurator" },
];

const QUICK_LINKS = [
  { label: "📖 Documentation", url: "https://frootai.dev" },
  { label: "⭐ GitHub", url: "https://github.com/frootai/frootai" },
  { label: "📦 npm MCP", url: "https://www.npmjs.com/package/frootai-mcp" },
  { label: "🐍 PyPI MCP", url: "https://pypi.org/project/frootai-mcp" },
];

export default function Welcome() {
  const cmd = (action: string) => vscode.postMessage({ command: action });
  const openUrl = (url: string) => vscode.postMessage({ command: "openUrl", url });

  return (
    <div className="container" style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>
          Welcome to <span style={{ color: "#fff" }}>Froot</span><span style={{ color: "#10b981" }}>AI</span>
        </h1>
        <p style={{ opacity: 0.6, fontSize: 13, marginTop: 4 }}>v{VERSION} — The Open Glue for GenAI on Azure</p>
        <p style={{ fontSize: 14, marginTop: 12, opacity: 0.85 }}>
          45 MCP tools · 101 solution plays · 830+ primitives · FAI Protocol
        </p>
      </div>

      {/* Feature Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {FEATURES.map(f => (
          <button
            key={f.action}
            onClick={() => cmd(f.action)}
            className="card"
            style={{
              cursor: "pointer", border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)", padding: "16px",
              textAlign: "left", borderRadius: 8, transition: "border-color 0.2s",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>{f.desc}</div>
          </button>
        ))}
      </div>

      {/* Quick Start */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>🚀 Quick Start</h3>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 2 }}>
          <li>Browse <strong>Solution Plays</strong> in the sidebar (🌳 icon)</li>
          <li>Click a play → <strong>Init DevKit</strong> to scaffold your project</li>
          <li>Connect the <strong>MCP Server</strong> for 45 AI architecture tools</li>
          <li>Run <strong>Evaluations</strong> to validate AI quality</li>
        </ol>
      </div>

      {/* Links */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {QUICK_LINKS.map(l => (
          <button
            key={l.url}
            onClick={() => openUrl(l.url)}
            style={{
              background: "none", border: "1px solid rgba(255,255,255,0.12)",
              color: "inherit", padding: "6px 14px", borderRadius: 16,
              cursor: "pointer", fontSize: 12, opacity: 0.8,
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Footer */}
      <p style={{ textAlign: "center", fontSize: 11, opacity: 0.4, marginTop: 24 }}>
        From the Roots to the Fruits 🌳 — The industry standard for AI primitive unification
      </p>
    </div>
  );
}
