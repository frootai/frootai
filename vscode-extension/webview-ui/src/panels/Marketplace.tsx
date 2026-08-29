import { useState, useMemo } from "react";
import SearchInput from "../components/SearchInput";
import { vscode } from "../vscode";
import { Plug, Package, ExternalLink, Zap, Target, Globe } from "lucide-react";

interface Plugin {
  id: string;
  description?: string;
  version?: string;
  keywords?: string[];
  plays?: string[];
  items?: number;
  folder?: string;
}

const ITEMS_PER_PAGE = 20;
const GITHUB_BASE = "https://github.com/frootai/frootai/tree/main/";

const DOMAIN_FILTERS = [
  { id: "all", label: "All", color: "#94a3b8", keywords: [] },
  { id: "rag", label: "RAG", color: "#7c3aed", keywords: ["rag", "retrieval", "search", "embedding", "vector"] },
  { id: "agent", label: "Agents", color: "#f59e0b", keywords: ["agent", "multi-agent", "swarm", "autogen", "crewai"] },
  { id: "azure", label: "Azure", color: "#0ea5e9", keywords: ["azure", "cosmos", "openai", "functions", "container"] },
  { id: "security", label: "Security", color: "#ef4444", keywords: ["security", "compliance", "safety", "owasp", "pii"] },
  { id: "devops", label: "DevOps", color: "#f97316", keywords: ["devops", "ci-cd", "deploy", "github", "docker"] },
  { id: "eval", label: "Evaluation", color: "#10b981", keywords: ["eval", "quality", "groundedness", "metrics", "test"] },
  { id: "infra", label: "Infra", color: "#3b82f6", keywords: ["infra", "bicep", "terraform", "landing-zone", "network"] },
];

export default function Marketplace({ plugins }: { plugins: Plugin[] }) {
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Plugin | null>(null);

  const filtered = useMemo(() => {
    let result = plugins;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.id.includes(q) || (p.description || "").toLowerCase().includes(q) ||
        (p.keywords || []).some(k => k.includes(q))
      );
    }
    if (domain !== "all") {
      const df = DOMAIN_FILTERS.find(d => d.id === domain);
      if (df) {
        result = result.filter(p => {
          const text = `${p.id} ${p.description || ""} ${(p.keywords || []).join(" ")}`.toLowerCase();
          return df.keywords.some(kw => text.includes(kw));
        });
      }
    }
    return result;
  }, [plugins, search, domain]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const switchDomain = (id: string) => { setDomain(id); setPage(1); };

  if (selected) {
    return (
      <div className="container" style={{ padding: "16px 20px" }}>
        <button className="btn btn-sm" onClick={() => setSelected(null)} style={{ marginBottom: 12 }}>← Back to Marketplace</button>
        <PluginDetail plugin={selected} />
      </div>
    );
  }

  const logoUri = (window as any).panelData?.logoUri;

  return (
    <div className="container" style={{ padding: "16px 20px" }}>
      {/* Hero */}
      <div className="hero">
        {logoUri && <img src={logoUri} alt="FrootAI" style={{ width: 48, height: 48, marginBottom: 8 }} />}
        <h1 style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Plug size={24} />
          FAI Plugin Marketplace
        </h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
          {plugins.length} composable plugins — each bundles agents, skills, instructions, hooks
        </p>
      </div>

      <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search plugins..." resultCount={filtered.length} />

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {DOMAIN_FILTERS.map(df => {
          const active = domain === df.id;
          return (
            <button key={df.id} className="btn btn-sm btn-ghost" onClick={() => switchDomain(df.id)}
              style={{ fontSize: 11, padding: "3px 8px", background: active ? `${df.color}25` : undefined, borderColor: active ? df.color : "transparent", color: active ? df.color : undefined }}>
              {df.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {paged.map(plugin => (
          <div key={plugin.id} className="card" onClick={() => setSelected(plugin)}
            style={{ cursor: "pointer", padding: "12px 14px", borderRadius: 8, transition: "border-color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "#ec4899")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--vscode-panel-border)")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "#ec4899" }}><Plug size={14} style={{ verticalAlign: -2, marginRight: 4 }} />{plugin.id}</span>
              {plugin.version && <span style={{ fontSize: 10, opacity: 0.4 }}>v{plugin.version}</span>}
            </div>
            {plugin.description && (
              <p style={{ fontSize: 12, opacity: 0.7, margin: "0 0 8px", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {plugin.description}
              </p>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, opacity: 0.5 }}>
              {plugin.items !== undefined && <span><Package size={12} style={{ verticalAlign: -2, marginRight: 2 }} />{plugin.items} items</span>}
              {plugin.plays && plugin.plays.length > 0 && <span><Target size={12} style={{ verticalAlign: -2, marginRight: 2 }} />{plugin.plays.join(", ")}</span>}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 8 }} onClick={e => e.stopPropagation()}>
              <button className="btn btn-sm btn-ghost" onClick={() => vscode.postMessage({ command: "openUrl", url: GITHUB_BASE + (plugin.folder || `plugins/${plugin.id}`) })} style={{ fontSize: 10, padding: "2px 6px" }}>
                <ExternalLink size={12} style={{ verticalAlign: -2, marginRight: 2 }} /> GitHub
              </button>
              <button className="btn btn-sm" onClick={() => vscode.postMessage({ command: "installPlugin", pluginId: plugin.id })}
                style={{ fontSize: 10, padding: "2px 6px", background: "#ec489925", color: "#ec4899", borderColor: "#ec4899" }}>
                <Zap size={12} style={{ verticalAlign: -2, marginRight: 2 }} /> Install
              </button>
            </div>
          </div>
        ))}
      </div>

      {paged.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", opacity: 0.5 }}>
          <p style={{ fontSize: 32 }}><Plug size={32} /></p>
          <p>No plugins match your search</p>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
          <button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span style={{ fontSize: 12, opacity: 0.6 }}>Page {page} of {totalPages}</span>
          <button className="btn btn-sm btn-ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

function PluginDetail({ plugin }: { plugin: Plugin }) {
  const displayName = plugin.id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return (
    <div>
      <div style={{ padding: "16px 0", borderBottom: "1px solid var(--vscode-panel-border)", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          <span style={{ color: "#ec4899" }}><Plug size={18} /></span> {displayName}
        </h2>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <span className="pill" style={{ background: "#ec489918", color: "#ec4899", borderColor: "#ec489940" }}>Plugin</span>
          {plugin.version && <span style={{ fontSize: 11, opacity: 0.5 }}>v{plugin.version}</span>}
          {plugin.items !== undefined && <span style={{ fontSize: 11, opacity: 0.5 }}><Package size={12} style={{ verticalAlign: -2, marginRight: 2 }} />{plugin.items} bundled items</span>}
        </div>
      </div>

      {plugin.description && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 6px", fontSize: 13, opacity: 0.7 }}>Description</h4>
          <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{plugin.description}</p>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.7 }}>Details</h4>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <tbody>
            <tr><td style={tdL}>ID</td><td style={tdV}><code>{plugin.id}</code></td></tr>
            {plugin.folder && <tr><td style={tdL}>Folder</td><td style={tdV}><code>{plugin.folder}</code></td></tr>}
            {plugin.keywords && <tr><td style={tdL}>Keywords</td><td style={tdV}>{plugin.keywords.join(", ")}</td></tr>}
            {plugin.plays && plugin.plays.length > 0 && <tr><td style={tdL}>Compatible Plays</td><td style={tdV}>{plugin.plays.join(", ")}</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.7 }}>Install</h4>
        <div style={{ background: "var(--vscode-editor-background)", padding: "10px 14px", borderRadius: 6, fontFamily: "monospace", fontSize: 12 }}>
          npx frootai install plugin {plugin.id}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => vscode.postMessage({ command: "installPlugin", pluginId: plugin.id })}
          style={{ background: "#ec489920", color: "#ec4899", borderColor: "#ec4899" }}>
          <Zap size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Install Plugin
        </button>
        <button className="btn btn-ghost" onClick={() => vscode.postMessage({ command: "openUrl", url: GITHUB_BASE + (plugin.folder || `plugins/${plugin.id}`) })}>
          <ExternalLink size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> View on GitHub
        </button>
        <button className="btn btn-ghost" onClick={() => vscode.postMessage({ command: "openUrl", url: `https://frootai.dev/marketplace` })}>
          <Globe size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> View on Website
        </button>
      </div>
    </div>
  );
}

const tdL: React.CSSProperties = { padding: "6px 12px 6px 0", opacity: 0.6, fontWeight: 500, verticalAlign: "top", whiteSpace: "nowrap" };
const tdV: React.CSSProperties = { padding: "6px 0" };
