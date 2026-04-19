import { useState, useMemo } from "react";
import SearchInput from "../components/SearchInput";
import Badge from "../components/Badge";

// ─── Data ───
const LAYERS = [
  { key: "All", color: "#6b7280" },
  { key: "F", label: "Foundations", color: "#f59e0b" },
  { key: "R", label: "Reasoning", color: "#10b981" },
  { key: "O", label: "Orchestration", color: "#06b6d4" },
  { key: "T", label: "Transformation", color: "#7c3aed" },
];

const PLAYS = [
  { id: "01", name: "Enterprise RAG Q&A", icon: "🔍", layer: "R" },
  { id: "02", name: "AI Landing Zone", icon: "🏗️", layer: "F" },
  { id: "03", name: "Deterministic Agent", icon: "🤖", layer: "O" },
  { id: "04", name: "Call Center Voice AI", icon: "📞", layer: "O" },
  { id: "05", name: "IT Ticket Resolution", icon: "🎫", layer: "O" },
  { id: "06", name: "Document Intelligence", icon: "📄", layer: "R" },
  { id: "07", name: "Multi-Agent Service", icon: "🤖", layer: "O" },
  { id: "08", name: "Copilot Studio Bot", icon: "💬", layer: "O" },
  { id: "09", name: "AI Search Portal", icon: "🔎", layer: "R" },
  { id: "10", name: "Content Moderation", icon: "🛡️", layer: "O" },
  { id: "11", name: "Landing Zone Advanced", icon: "🏗️", layer: "F" },
  { id: "12", name: "Model Serving AKS", icon: "⚙️", layer: "T" },
  { id: "13", name: "Fine-Tuning Workflow", icon: "🔧", layer: "T" },
  { id: "14", name: "AI Gateway", icon: "🚪", layer: "O" },
  { id: "15", name: "Multi-Modal DocProc", icon: "📄", layer: "R" },
  { id: "16", name: "Copilot Teams Ext.", icon: "💬", layer: "O" },
  { id: "17", name: "AI Observability", icon: "📊", layer: "O" },
  { id: "18", name: "Prompt Management", icon: "✏️", layer: "T" },
  { id: "19", name: "Edge AI Phi-4", icon: "📱", layer: "T" },
  { id: "20", name: "Anomaly Detection", icon: "⚡", layer: "O" },
  { id: "21", name: "Agentic RAG", icon: "🔍", layer: "R" },
  { id: "22", name: "Multi-Agent Swarm", icon: "🐝", layer: "O" },
  { id: "23", name: "Browser Automation", icon: "🌐", layer: "O" },
];

const PRIMITIVES = [
  { type: "Agents", count: 201, icon: "🤖", color: "#ef4444" },
  { type: "Instructions", count: 176, icon: "📋", color: "#3b82f6" },
  { type: "Skills", count: 282, icon: "🧩", color: "#10b981" },
  { type: "Hooks", count: 10, icon: "🔗", color: "#f59e0b" },
  { type: "Plugins", count: 77, icon: "🔌", color: "#8b5cf6" },
  { type: "Workflows", count: 12, icon: "⚙️", color: "#06b6d4" },
  { type: "Cookbook", count: 16, icon: "📖", color: "#ec4899" },
];

const QUICK_ACTIONS = [
  { label: "Init DevKit", cmd: "frootai.initDevKit", icon: "🚀" },
  { label: "Init TuneKit", cmd: "frootai.initTuneKit", icon: "🎛️" },
  { label: "Setup MCP", cmd: "frootai.installMcpServer", icon: "🔧" },
  { label: "Evaluate", cmd: "frootai.openEvaluationDashboard", icon: "📊" },
  { label: "Scaffold", cmd: "frootai.openScaffoldWizard", icon: "🏗️" },
  { label: "Cost Est.", cmd: "frootai.quickCostEstimate", icon: "💰" },
];

// ─── Sidebar Component ───
interface VsCodeApi { postMessage(msg: unknown): void; }
declare function acquireVsCodeApi(): VsCodeApi;
const vscode = acquireVsCodeApi();

type Tab = "plays" | "primitives" | "actions";

export default function Sidebar() {
  const [tab, setTab] = useState<Tab>("plays");
  const [search, setSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState("All");

  const filteredPlays = useMemo(() => {
    let list = PLAYS;
    if (layerFilter !== "All") list = list.filter(p => p.layer === layerFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.id.includes(q));
    }
    return list;
  }, [search, layerFilter]);

  const cmd = (command: string, args?: Record<string, string>) => {
    vscode.postMessage({ command, ...args });
  };

  return (
    <div className="sidebar">
      {/* Tab Bar */}
      <div className="tab-bar">
        <button className={`tab ${tab === "plays" ? "active" : ""}`} onClick={() => setTab("plays")}>
          Plays
        </button>
        <button className={`tab ${tab === "primitives" ? "active" : ""}`} onClick={() => setTab("primitives")}>
          Primitives
        </button>
        <button className={`tab ${tab === "actions" ? "active" : ""}`} onClick={() => setTab("actions")}>
          Actions
        </button>
      </div>

      {/* Plays Tab */}
      {tab === "plays" && (
        <div className="tab-content">
          <SearchInput value={search} onChange={setSearch} placeholder="Search 101 plays..." resultCount={filteredPlays.length} />
          <div className="filter-bar">
            {LAYERS.map(l => (
              <button
                key={l.key}
                className={`filter-tag ${layerFilter === l.key ? "active" : ""}`}
                style={layerFilter === l.key ? { background: l.color, borderColor: l.color } : {}}
                onClick={() => setLayerFilter(l.key)}
              >
                {l.key === "All" ? "All" : l.key}
              </button>
            ))}
          </div>
          <div className="play-list">
            {filteredPlays.map(p => {
              const layerColor = LAYERS.find(l => l.key === p.layer)?.color ?? "#6b7280";
              return (
                <div
                  key={p.id}
                  className="play-item"
                  onClick={() => cmd("frootai.openPlayDetail", { playId: p.id })}
                >
                  <span className="play-icon">{p.icon}</span>
                  <div className="play-info">
                    <span className="play-name">{p.id} — {p.name}</span>
                    <span className="play-layer" style={{ color: layerColor }}>{p.layer}</span>
                  </div>
                  <span className="play-arrow">›</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Primitives Tab */}
      {tab === "primitives" && (
        <div className="tab-content">
          <div className="section-header">860+ FAI Primitives</div>
          <div className="primitives-grid">
            {PRIMITIVES.map(p => (
              <div key={p.type} className="primitive-card" onClick={() => cmd("frootai.browsePrimitives")}>
                <span className="primitive-icon">{p.icon}</span>
                <span className="primitive-type">{p.type}</span>
                <Badge label={String(p.count)} color={p.color} />
              </div>
            ))}
          </div>
          <div className="section-header" style={{ marginTop: 16 }}>Quick Links</div>
          <div className="link-list">
            <div className="link-item" onClick={() => cmd("frootai.openMcpExplorer")}>🔧 MCP Tools (45)</div>
            <div className="link-item" onClick={() => cmd("frootai.searchAll")}>🔍 Search Everything</div>
            <div className="link-item" onClick={() => cmd("frootai.lookupTerm")}>📖 AI Glossary (200+)</div>
            <div className="link-item" onClick={() => cmd("frootai.showArchitecturePattern")}>🏛️ Architecture Patterns</div>
          </div>
        </div>
      )}

      {/* Actions Tab */}
      {tab === "actions" && (
        <div className="tab-content">
          <div className="section-header">Quick Actions</div>
          <div className="action-grid">
            {QUICK_ACTIONS.map(a => (
              <button key={a.cmd} className="action-btn" onClick={() => cmd(a.cmd)}>
                <span className="action-icon">{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>

          <div className="section-header" style={{ marginTop: 20 }}>FAI Protocol</div>
          <div className="link-list">
            <div className="link-item" onClick={() => cmd("frootai.createManifest")}>📦 Create fai-manifest.json</div>
            <div className="link-item" onClick={() => cmd("frootai.validateConfig")}>✅ Validate Config</div>
            <div className="link-item" onClick={() => cmd("frootai.autoChainAgents")}>🔄 Build → Review → Tune</div>
            <div className="link-item" onClick={() => cmd("frootai.installPlugin")}>🔌 Install Plugin</div>
          </div>

          <div className="section-header" style={{ marginTop: 20 }}>Links</div>
          <div className="link-list">
            <div className="link-item" onClick={() => cmd("frootai.browseSolutionPlays")}>🌐 frootai.dev</div>
            <div className="link-item" onClick={() => cmd("frootai.openSetupGuide")}>📚 Setup Guide</div>
            <div className="link-item" onClick={() => cmd("frootai.openNpmPage")}>📦 npm Package</div>
          </div>
        </div>
      )}
    </div>
  );
}
