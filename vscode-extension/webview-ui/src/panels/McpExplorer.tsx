import { useState, useMemo } from "react";
import type { McpTool } from "../types";
import ToolCard from "../components/ToolCard";
import SearchInput from "../components/SearchInput";
import { vscode } from "../vscode";
import { Wrench, Play, Copy, BookOpen, Package, FlaskConical, ExternalLink } from "lucide-react";

const DEFAULT_TOOLS: McpTool[] = [
  { name: "list_modules", description: "Browse 18 FROOT knowledge modules by layer", category: "Knowledge", readOnly: true },
  { name: "get_module", description: "Read any module in full (F1-T3)", category: "Knowledge", readOnly: true },
  { name: "search_knowledge", description: "BM25 full-text search across all modules", category: "Knowledge", readOnly: true },
  { name: "lookup_term", description: "200+ AI/ML glossary term lookup", category: "Knowledge", readOnly: true },
  { name: "get_froot_overview", description: "Complete FrootAI framework summary", category: "Knowledge", readOnly: true },
  { name: "get_architecture_pattern", description: "7 architecture decision guides", category: "Knowledge", readOnly: true },
  { name: "list_solution_plays", description: "List all 101 solution plays", category: "Plays", readOnly: true },
  { name: "get_play_detail", description: "Full play info with infra and tuning", category: "Plays", readOnly: true },
  { name: "semantic_search_plays", description: "BM25-powered play matching", category: "Plays", readOnly: true },
  { name: "compare_plays", description: "Side-by-side play comparison", category: "Plays", readOnly: true },
  { name: "generate_architecture_diagram", description: "Mermaid.js architecture diagrams", category: "Architecture", readOnly: true },
  { name: "agent_build", description: "Builder agent — architecture guidance", category: "Agents", readOnly: true },
  { name: "agent_review", description: "Reviewer agent — security/quality audit", category: "Agents", readOnly: true },
  { name: "agent_tune", description: "Tuner agent — production readiness", category: "Agents", readOnly: true },
  { name: "get_model_catalog", description: "Azure AI model catalog with pricing", category: "Models", readOnly: true },
  { name: "get_azure_pricing", description: "Service pricing by tier", category: "Cost", readOnly: true },
  { name: "compare_models", description: "Side-by-side model comparison", category: "Models", readOnly: true },
  { name: "estimate_cost", description: "Itemized monthly cost per play", category: "Cost", readOnly: true },
  { name: "wire_play", description: "Generate fai-manifest.json for a play", category: "Tools", readOnly: false },
  { name: "inspect_wiring", description: "Check primitive connection status", category: "Tools", readOnly: true },
  { name: "validate_manifest", description: "Validate fai-manifest.json schema", category: "Tools", readOnly: true },
  { name: "validate_config", description: "Validate AI config parameters", category: "Tools", readOnly: true },
  { name: "evaluate_quality", description: "Run quality evaluation (5 metrics)", category: "Evaluation", readOnly: true },
  { name: "scaffold_play", description: "Scaffold project with DevKit structure", category: "Tools", readOnly: false },
  { name: "smart_scaffold", description: "AI-powered play recommendation + scaffold", category: "Tools", readOnly: false },
  { name: "list_marketplace", description: "Browse 860+ FAI primitives by type", category: "Primitives", readOnly: true },
  { name: "search_marketplace", description: "Search across all primitives", category: "Primitives", readOnly: true },
  { name: "get_waf_guidance", description: "WAF pillar guidance (6 pillars)", category: "Architecture", readOnly: true },
  { name: "get_learning_path", description: "Curated learning paths by topic", category: "Docs", readOnly: true },
  { name: "get_version_info", description: "Server version and capabilities", category: "Tools", readOnly: true },
];

// Tool parameter schemas for "Try It" feature
const TOOL_PARAMS: Record<string, Array<{ name: string; type: string; desc: string; required?: boolean; options?: string[] }>> = {
  get_module: [{ name: "module_id", type: "text", desc: "Module ID (e.g. F1, R2, O3, T1)", required: true }],
  search_knowledge: [{ name: "query", type: "text", desc: "Search query", required: true }, { name: "max_results", type: "number", desc: "Max results (default: 5)" }],
  lookup_term: [{ name: "term", type: "text", desc: "AI/ML term to look up", required: true }],
  get_architecture_pattern: [{ name: "scenario", type: "select", desc: "Architecture scenario", required: true, options: ["rag_pipeline", "agent_hosting", "model_selection", "cost_optimization", "deterministic_ai", "multi_agent", "fine_tuning_decision"] }],
  get_play_detail: [{ name: "play_number", type: "text", desc: "Play number (01-100)", required: true }],
  semantic_search_plays: [{ name: "query", type: "text", desc: "What you want to build", required: true }, { name: "top_k", type: "number", desc: "Results (default: 3, max: 5)" }],
  compare_plays: [{ name: "plays", type: "text", desc: "Comma-separated play numbers (e.g. 01,03)", required: true }],
  generate_architecture_diagram: [{ name: "play", type: "text", desc: "Play number (01-20)", required: true }],
  agent_build: [{ name: "task", type: "text", desc: "What to build", required: true }],
  agent_review: [{ name: "context", type: "text", desc: "What to review" }],
  agent_tune: [{ name: "context", type: "text", desc: "What to validate" }],
  get_model_catalog: [{ name: "category", type: "select", desc: "Model category", options: ["all", "gpt", "embedding", "image", "speech"] }],
  compare_models: [{ name: "useCase", type: "text", desc: "Use case", required: true }, { name: "priority", type: "select", desc: "Priority", options: ["quality", "cost", "speed", "context"] }],
  estimate_cost: [{ name: "play", type: "text", desc: "Play number (01-20)", required: true }, { name: "scale", type: "select", desc: "Scale", options: ["dev", "prod"] }],
  get_azure_pricing: [{ name: "scenario", type: "select", desc: "Scenario", required: true, options: ["rag", "agent", "batch", "realtime", "custom"] }],
  evaluate_quality: [{ name: "scores", type: "text", desc: "JSON scores object", required: true }],
  validate_config: [{ name: "config_type", type: "select", desc: "Config type", required: true, options: ["openai.json", "guardrails.json", "agents.json"] }, { name: "config_content", type: "text", desc: "JSON config content", required: true }],
  get_waf_guidance: [{ name: "pillar", type: "select", desc: "WAF pillar", options: ["reliability", "security", "cost", "operational", "performance", "responsible-ai"] }],
  list_marketplace: [{ name: "type", type: "select", desc: "Primitive type", required: true, options: ["agents", "instructions", "skills", "hooks", "plugins", "workflows", "cookbook"] }],
  search_marketplace: [{ name: "query", type: "text", desc: "Search query", required: true }],
};

const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "frootai": {
      "command": "npx",
      "args": ["-y", "frootai-mcp@latest"]
    }
  }
}`;

interface Props { tools?: McpTool[]; }

function TryItModal({ tool, onClose }: { tool: McpTool; onClose: () => void }) {
  const params = TOOL_PARAMS[tool.name] || [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRun = () => {
    setLoading(true);
    vscode.postMessage({ command: "tryTool", toolName: tool.name, params: values });
    setTimeout(() => {
      const hasParams = Object.values(values).some(v => v.trim());
      setResult(JSON.stringify({
        tool: tool.name,
        params: hasParams ? values : "(none)",
        note: "MCP tools require a running MCP server connection. To execute live:",
        steps: [
          "1. Run: npx frootai-mcp@latest (starts the MCP server)",
          "2. In VS Code settings, configure MCP server connection",
          "3. Use the @fai chat participant or Agent FAI to invoke tools",
        ],
        quickStart: "npx frootai-mcp@latest",
      }, null, 2));
      setLoading(false);
    }, 400);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--vscode-editor-background, #1e1e1e)", border: "1px solid var(--vscode-widget-border, #444)", borderRadius: 8, padding: 24, width: "90%", maxWidth: 520, maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}><FlaskConical size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Try: <code>{tool.name}</code></h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 16 }}>{tool.description}</p>

        {params.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {params.map((p) => (
              <div key={p.name}>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  {p.name} {p.required && <span style={{ color: "#ef4444" }}>*</span>}
                </label>
                <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>{p.desc}</div>
                {p.type === "select" && p.options ? (
                  <select value={values[p.name] || ""} onChange={(e) => setValues({ ...values, [p.name]: e.target.value })}
                    style={{ width: "100%", padding: "6px 8px", background: "var(--vscode-input-background, #333)", color: "inherit", border: "1px solid var(--vscode-input-border, #555)", borderRadius: 4 }}>
                    <option value="">Select...</option>
                    {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={p.type === "number" ? "number" : "text"} value={values[p.name] || ""} onChange={(e) => setValues({ ...values, [p.name]: e.target.value })}
                    placeholder={p.desc}
                    style={{ width: "100%", padding: "6px 8px", background: "var(--vscode-input-background, #333)", color: "inherit", border: "1px solid var(--vscode-input-border, #555)", borderRadius: 4, boxSizing: "border-box" }} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>This tool takes no parameters.</p>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: result ? 16 : 0 }}>
          <button className="btn" onClick={handleRun} disabled={loading} style={{ flex: 1 }}>
            {loading ? "Running..." : <><Play size={12} style={{ verticalAlign: -2, marginRight: 4 }} />Run Tool</>}
          </button>
          <button className="btn btn-secondary" onClick={() => {
            const snippet = JSON.stringify({ name: tool.name, arguments: values }, null, 2);
            vscode.postMessage({ command: "copyToClipboard", text: snippet });
          }} style={{ flex: 1 }}>
            <Copy size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Copy Call
          </button>
        </div>

        {result && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Result:</div>
            <pre style={{ background: "var(--vscode-textCodeBlock-background, #2d2d2d)", padding: 12, borderRadius: 6, fontSize: 11, overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap", margin: 0 }}>
              {result}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default function McpExplorer({ tools }: Props) {
  const allTools = tools?.length ? tools : DEFAULT_TOOLS;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [tryTool, setTryTool] = useState<McpTool | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set(allTools.map((t) => t.category));
    return ["All", ...Array.from(cats).sort()];
  }, [allTools]);

  const filtered = useMemo(() => {
    return allTools.filter((t) => {
      const matchSearch = !search || t.name.includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
      const matchCat = category === "All" || t.category === category;
      return matchSearch && matchCat;
    });
  }, [allTools, search, category]);

  const logoUri = (window as any).panelData?.logoUri;

  return (
    <div className="container">
      {/* Hero */}
      <div className="hero">
        {logoUri && <img src={logoUri} alt="FrootAI" style={{ width: 48, height: 48, marginBottom: 8 }} />}
        <h1 style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Wrench size={24} />
          FAI MCP Tools
        </h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
          45 tools for AI architecture — knowledge, scaffolding, evaluation, and more
        </p>
      </div>

      {/* Quick Actions Bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => {
          vscode.postMessage({ command: "copyToClipboard", text: MCP_CONFIG_SNIPPET });
        }}>
          <Copy size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Copy MCP Config
        </button>
        <button className="btn btn-secondary" onClick={() => setShowConfig(!showConfig)}>
          {showConfig ? "Hide" : "Show"} Install Config
        </button>
        <button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "openUrl", url: "https://frootai.dev/mcp-server" })}>
          <BookOpen size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Docs
        </button>
      </div>

      {/* MCP config snippet */}
      {showConfig && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}><Package size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Add to VS Code settings.json or .vscode/mcp.json:</div>
          <pre style={{ background: "var(--vscode-textCodeBlock-background, #2d2d2d)", padding: 12, borderRadius: 6, fontSize: 12, margin: 0, overflow: "auto" }}>
            {MCP_CONFIG_SNIPPET}
          </pre>
        </div>
      )}

      <SearchInput value={search} onChange={setSearch} placeholder="Search tools..." resultCount={filtered.length} />

      <div className="filter-bar">
        {categories.map((c) => (
          <button key={c} className={`filter-tag ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
            {c} {c !== "All" ? `(${allTools.filter((t) => t.category === c).length})` : ""}
          </button>
        ))}
      </div>

      <div className="grid grid-2">
        {filtered.map((t) => <ToolCard key={t.name} tool={t} onTryIt={() => setTryTool(t)} />)}
      </div>

      {filtered.length === 0 && <div className="empty-state">No tools match your search.</div>}

      {/* Try It Modal */}
      {tryTool && <TryItModal tool={tryTool} onClose={() => setTryTool(null)} />}
    </div>
  );
}
