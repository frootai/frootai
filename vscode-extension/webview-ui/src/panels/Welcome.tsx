import { vscode } from "../vscode";
import { Rocket, Search, BarChart3, Zap, Target, BookOpen, ExternalLink, Package, Bot } from "lucide-react";

const VERSION = "9.2.0";

const FEATURES = [
  { Icon: Bot, title: "Agent FAI", desc: "AI assistant — ask about plays, architecture, costs", action: "openAgentFai", color: "#06b6d4" },
  { Icon: Target, title: "Solution Configurator", desc: "Answer questions, get the right play for your needs", action: "configurator", color: "#f59e0b" },
  { Icon: Rocket, title: "101 Solution Plays", desc: "Intelligent engines built from primitives — ready to deploy", action: "browsePlays", color: "#10b981" },
  { Icon: Search, title: "Primitives Catalog", desc: "Standalone LEGO blocks — agents, skills, instructions, hooks", action: "openPrimitives", color: "#3b82f6" },
  { Icon: BarChart3, title: "Evaluation & Cost", desc: "Quality scoring, Azure cost estimates", action: "evaluation", color: "#ec4899" },
  { Icon: Zap, title: "One-Click Scaffold", desc: "DevKit, TuneKit, SpecKit — agents, config, IaC", action: "scaffold", color: "#f97316" },
  { Icon: Package, title: "FAI Ecosystem", desc: "Factory · Packages · Toolkit · Engine · Protocol · Layer", action: "openProtocol", color: "#6366f1" },
  { Icon: BookOpen, title: "Setup Guide", desc: "Install MCP, configure your IDE, start building", action: "openSetup", color: "#7c3aed" },
];

const QUICK_LINKS = [
  { label: "frootai.dev", url: "https://frootai.dev", Icon: ExternalLink },
  { label: "Documentation", url: "https://frootai.dev/learning-hub/quick-start", Icon: BookOpen },
  { label: "GitHub", url: "https://github.com/frootai/frootai", Icon: ExternalLink },
  { label: "npm", url: "https://www.npmjs.com/package/frootai-mcp", Icon: Package },
];

export default function Welcome() {
  const logoUri = (window as any).panelData?.logoUri;
  const cmd = (action: string) => vscode.postMessage({ command: action });
  const openUrl = (url: string) => vscode.postMessage({ command: "openUrl", url });

  return (
    <div className="container" style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
      {/* Hero */}
      <div className="hero">
        {logoUri && <img src={logoUri} alt="FrootAI" style={{ width: 56, height: 56, marginBottom: 10 }} />}
        <h1>Welcome to <span style={{ color: "#fff" }}>Froot</span><span style={{ color: "#10b981" }}>AI</span></h1>
        <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>
          <em>From the Roots to the Fruits. It's connected, it's simply Frootful.</em>
        </p>
        <p style={{ color: "#85859d", fontSize: 11, marginTop: 4 }}>
          The open glue for GenAI ecosystem · The tooling layer for AI primitives
        </p>
        <p style={{ fontSize: 13, marginTop: 10, color: "#c4c4d4", lineHeight: 1.5 }}>
          45 MCP tools · 101 solution plays · 860+ primitives · FAI Protocol
        </p>
        <p style={{ color: "#64748b", fontSize: 10, marginTop: 4 }}>v{VERSION}</p>
      </div>

      {/* Feature Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {FEATURES.map(f => (
          <button
            key={f.action}
            onClick={() => cmd(f.action)}
            className="card"
            style={{ cursor: "pointer", textAlign: "left", padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${f.color}40`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ""; }}
          >
            <div className="icon-box icon-box-sm" style={{ background: `${f.color}12`, border: `1px solid ${f.color}20` }}>
              <f.Icon size={16} color={f.color} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3, color: "#e2e8f0" }}>{f.title}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>{f.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick Start */}
      <div style={{ padding: "14px 16px", background: "#10b98108", border: "1px solid #10b98115", borderRadius: 12, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#10b981" }}>
          <Rocket size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Quick Start
        </h3>
        <div style={{ fontSize: 12, lineHeight: 2, opacity: 0.75 }}>
          <div><span style={{ color: "#10b981", fontWeight: 600, marginRight: 6 }}>1.</span>Open <strong>Solution Configurator</strong> to find the right play</div>
          <div><span style={{ color: "#10b981", fontWeight: 600, marginRight: 6 }}>2.</span>Click a play → <strong>Init DevKit</strong> to scaffold your project</div>
          <div><span style={{ color: "#10b981", fontWeight: 600, marginRight: 6 }}>3.</span>Connect the <strong>MCP Server</strong> for 45 AI architecture tools</div>
          <div><span style={{ color: "#10b981", fontWeight: 600, marginRight: 6 }}>4.</span>Run <strong>Evaluations</strong> to validate AI quality</div>
        </div>
      </div>

      {/* Links */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {QUICK_LINKS.map(l => (
          <button key={l.url} onClick={() => openUrl(l.url)}
            style={{ background: "none", border: "1px solid var(--border)", color: "#94a3b8", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
            <l.Icon size={12} /> {l.label} ↗
          </button>
        ))}
      </div>

      {/* Footer */}
      <p style={{ textAlign: "center", fontSize: 10, color: "#64748b", marginTop: 24, letterSpacing: 0.3 }}>
        From the Roots to the Fruits — The industry standard for AI primitive unification
      </p>
    </div>
  );
}
