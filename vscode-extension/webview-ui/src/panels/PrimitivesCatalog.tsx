import { useState, useMemo } from "react";
import type { ComponentType } from "react";
import SearchInput from "../components/SearchInput";
import { vscode } from "../vscode";
import { Bot, Puzzle, FileText, Shield, Plug, Package, Search, Cloud, Lock, Brain, Settings, BarChart3, Globe, Zap, Building, ExternalLink, Paperclip, Target } from "lucide-react";

// ─── Types ───
interface PrimitiveItem {
  id: string;
  name?: string;
  description?: string;
  file?: string;
  folder?: string;
  waf?: string[];
  applyTo?: string;
  events?: string[];
  size?: number;
  version?: string;
  keywords?: string[];
  plays?: string[];
  items?: number;
}

type CategoryId = "agents" | "skills" | "instructions" | "hooks" | "plugins";

interface CategoryMeta {
  label: string;
  Icon: ComponentType<{ size?: number }>;
  color: string;
  desc: string;
  ext: string;
  githubPath: string;
}

interface SubCategory {
  id: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  color: string;
  keywords: string[];
}

// ─── Constants ───
const ITEMS_PER_PAGE = 30;
const GITHUB_BASE = "https://github.com/frootai/frootai/tree/main/";
const GITHUB_RAW = "https://raw.githubusercontent.com/frootai/frootai/main/";

const CATEGORY_META: Record<CategoryId, CategoryMeta> = {
  agents: { label: "Agents", Icon: Bot, color: "#10b981", desc: "Autonomous AI personas with WAF alignment and play compatibility", ext: ".agent.md", githubPath: "agents" },
  skills: { label: "Skills", Icon: Puzzle, color: "#8b5cf6", desc: "Reusable capability modules — LEGO blocks that auto-wire in plays", ext: "SKILL.md", githubPath: "skills" },
  instructions: { label: "Instructions", Icon: FileText, color: "#06b6d4", desc: "Scoped behavioral directives with glob patterns", ext: ".instructions.md", githubPath: "instructions" },
  hooks: { label: "Hooks", Icon: Lock, color: "#f59e0b", desc: "Event-driven security gates — run on SessionStart, Stop, etc.", ext: "hooks.json", githubPath: "hooks" },
  plugins: { label: "Plugins", Icon: Plug, color: "#ec4899", desc: "Composable integration packages with marketplace listing", ext: "plugin.json", githubPath: "plugins" },
};

const SUB_CATEGORIES: SubCategory[] = [
  { id: "all", label: "All", Icon: Package, color: "#94a3b8", keywords: [] },
  { id: "rag", label: "RAG & Search", Icon: Search, color: "#7c3aed", keywords: ["rag", "search", "retrieval", "embedding", "vector", "knowledge-graph", "indexing"] },
  { id: "azure", label: "Azure Cloud", Icon: Cloud, color: "#0ea5e9", keywords: ["azure", "cosmos", "storage", "functions", "key-vault", "openai", "monitor", "service-bus", "event-hub", "container", "bicep"] },
  { id: "security", label: "Security", Icon: Shield, color: "#ef4444", keywords: ["security", "compliance", "red-team", "content-safety", "pii", "secrets", "owasp", "license"] },
  { id: "agent", label: "Multi-Agent", Icon: Brain, color: "#f59e0b", keywords: ["multi-agent", "swarm", "orchestrat", "autogen", "crewai", "langchain", "agentic"] },
  { id: "devops", label: "DevOps", Icon: Settings, color: "#f97316", keywords: ["devops", "github", "docker", "kubernetes", "ci-cd", "pipeline", "deploy", "test"] },
  { id: "data", label: "Data & ML", Icon: BarChart3, color: "#06b6d4", keywords: ["data", "fine-tun", "mlflow", "evaluat", "batch", "training", "model"] },
  { id: "web", label: "Web & Code", Icon: Globe, color: "#8b5cf6", keywords: ["typescript", "python", "rust", "java", "go", "api", "react", "angular", "blazor", "nextjs", "web"] },
  { id: "platform", label: "Platform & MCP", Icon: Zap, color: "#ec4899", keywords: ["mcp", "semantic-kernel", "copilot", "temporal", "foundry", "a2a", "ag-ui"] },
  { id: "infra", label: "Infrastructure", Icon: Building, color: "#3b82f6", keywords: ["infra", "bicep", "terraform", "landing-zone", "network", "aks", "container-app"] },
];

const WAF_COLORS: Record<string, string> = {
  reliability: "#3b82f6",
  security: "#ef4444",
  "cost-optimization": "#10b981",
  "operational-excellence": "#f59e0b",
  "performance-efficiency": "#8b5cf6",
  "responsible-ai": "#ec4899",
};

const WAF_SHORT: Record<string, string> = {
  reliability: "Reliability",
  security: "Security",
  "cost-optimization": "Cost",
  "operational-excellence": "Ops",
  "performance-efficiency": "Perf",
  "responsible-ai": "RAI",
};

// ─── Component ───
export default function PrimitivesCatalog({ primitives }: { primitives: Record<CategoryId, PrimitiveItem[]> }) {
  const [activeTab, setActiveTab] = useState<CategoryId>("agents");
  const [search, setSearch] = useState("");
  const [subCat, setSubCat] = useState("all");
  const [wafFilter, setWafFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<PrimitiveItem | null>(null);

  const items = primitives[activeTab] || [];
  const meta = CATEGORY_META[activeTab];

  const filtered = useMemo(() => {
    let result = items;
    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          (p.name || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q) ||
          (p.applyTo || "").toLowerCase().includes(q) ||
          (p.keywords || []).some((k) => k.includes(q))
      );
    }
    // Sub-category
    if (subCat !== "all") {
      const sc = SUB_CATEGORIES.find((s) => s.id === subCat);
      if (sc && sc.keywords.length > 0) {
        result = result.filter((p) => {
          const text = `${p.id} ${p.name || ""} ${p.description || ""} ${(p.keywords || []).join(" ")}`.toLowerCase();
          return sc.keywords.some((kw) => text.includes(kw));
        });
      }
    }
    // WAF filter
    if (wafFilter && (activeTab === "agents" || activeTab === "plugins")) {
      result = result.filter((p) => p.waf && p.waf.includes(wafFilter));
    }
    return result;
  }, [items, search, subCat, wafFilter, activeTab]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const switchTab = (t: CategoryId) => { setActiveTab(t); setSearch(""); setSubCat("all"); setWafFilter(null); setPage(1); setSelectedItem(null); };
  const switchSubCat = (id: string) => { setSubCat(id); setPage(1); };

  const getGithubUrl = (item: PrimitiveItem) => GITHUB_BASE + (item.file || item.folder || `${meta.githubPath}/${item.id}`);
  const getInstallUri = (item: PrimitiveItem) => {
    if (activeTab !== "agents") return null;
    const rawUrl = `${GITHUB_RAW}${item.file || `agents/${item.id}.agent.md`}`;
    return `vscode://github.copilot-chat/createAgent?url=${encodeURIComponent(rawUrl)}`;
  };

  // ─── Detail View ───
  if (selectedItem) {
    return (
      <div className="container">
        <button className="btn btn-sm" onClick={() => setSelectedItem(null)} style={{ marginBottom: 12 }}>← Back to {meta.label}</button>
        <DetailView item={selectedItem} category={activeTab} meta={meta} onGithub={() => vscode.postMessage({ command: "openUrl", url: getGithubUrl(selectedItem) })} onInstall={() => { const uri = getInstallUri(selectedItem); if (uri) vscode.postMessage({ command: "openUrl", url: uri }); }} />
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
          FAI Primitives Catalog
        </h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
          {items.length.toLocaleString()} primitives across 5 categories — the building blocks of every solution play
        </p>
      </div>

      {/* Category Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {(Object.keys(CATEGORY_META) as CategoryId[]).map((catId) => {
          const cm = CATEGORY_META[catId];
          const count = (primitives[catId] || []).length;
          const active = catId === activeTab;
          return (
            <button
              key={catId}
              className={`btn btn-sm ${active ? "" : "btn-ghost"}`}
              onClick={() => switchTab(catId)}
              style={{
                background: active ? `${cm.color}20` : undefined,
                borderColor: active ? cm.color : undefined,
                color: active ? cm.color : undefined,
                fontWeight: active ? 700 : 400,
              }}
            >
              <cm.Icon size={14} /> {cm.label} <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 4 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Category Description */}
      <div style={{ padding: "10px 14px", background: `${meta.color}10`, borderLeft: `3px solid ${meta.color}`, borderRadius: 6, marginBottom: 14, fontSize: 13, opacity: 0.8 }}>
        {meta.desc}
      </div>

      {/* Search */}
      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={`Search ${meta.label.toLowerCase()}...`} resultCount={filtered.length} />

      {/* Sub-category Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {SUB_CATEGORIES.map((sc) => {
          const count = sc.id === "all" ? items.length : items.filter((p) => {
            const text = `${p.id} ${p.name || ""} ${p.description || ""} ${(p.keywords || []).join(" ")}`.toLowerCase();
            return sc.keywords.some((kw) => text.includes(kw));
          }).length;
          if (sc.id !== "all" && count === 0) return null;
          const active = subCat === sc.id;
          return (
            <button
              key={sc.id}
              className={`btn btn-sm ${active ? "" : "btn-ghost"}`}
              onClick={() => switchSubCat(sc.id)}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                background: active ? `${sc.color}20` : undefined,
                borderColor: active ? sc.color : "transparent",
                color: active ? sc.color : undefined,
              }}
            >
              <sc.Icon size={12} /> {sc.label} <span style={{ opacity: 0.5 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* WAF Filter (agents/plugins only) */}
      {(activeTab === "agents" || activeTab === "plugins") && (
        <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, opacity: 0.5, alignSelf: "center", marginRight: 4 }}>WAF:</span>
          {Object.entries(WAF_SHORT).map(([key, label]) => {
            const active = wafFilter === key;
            const color = WAF_COLORS[key];
            return (
              <button
                key={key}
                className={`btn btn-sm ${active ? "" : "btn-ghost"}`}
                onClick={() => setWafFilter(active ? null : key)}
                style={{
                  fontSize: 10,
                  padding: "2px 6px",
                  background: active ? `${color}25` : undefined,
                  borderColor: active ? color : "transparent",
                  color: active ? color : undefined,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {paged.map((item) => (
          <PrimitiveCard key={item.id} item={item} category={activeTab} meta={meta} onClick={() => setSelectedItem(item)} onGithub={() => vscode.postMessage({ command: "openUrl", url: getGithubUrl(item) })} onInstall={() => { const uri = getInstallUri(item); if (uri) vscode.postMessage({ command: "openUrl", url: uri }); }} />
        ))}
      </div>

      {paged.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", opacity: 0.5 }}>
          <p style={{ fontSize: 32 }}><Search size={32} /></p>
          <p>No {meta.label.toLowerCase()} match your search</p>
        </div>
      )}

      {/* Pagination */}
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

// ─── PrimitiveCard ───
function PrimitiveCard({ item, category, meta, onClick, onGithub, onInstall }: {
  item: PrimitiveItem; category: CategoryId; meta: CategoryMeta;
  onClick: () => void; onGithub: () => void; onInstall: () => void;
}) {
  const displayName = item.name || item.id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const sizeKb = item.size ? `${(item.size / 1024).toFixed(1)}KB` : null;

  return (
    <div
      className="card"
      onClick={onClick}
      style={{ cursor: "pointer", padding: "12px 14px", borderRadius: 8, transition: "border-color 0.2s", borderColor: "var(--vscode-panel-border)" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = meta.color)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--vscode-panel-border)")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: meta.color }}><meta.Icon size={14} /> {displayName}</span>
        {sizeKb && <span style={{ fontSize: 10, opacity: 0.4 }}>{sizeKb}</span>}
      </div>

      {item.description && (
        <p style={{ fontSize: 12, opacity: 0.7, margin: "0 0 8px", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.description}
        </p>
      )}

      {/* WAF tags (agents) */}
      {item.waf && item.waf.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          {item.waf.map((w) => (
            <span key={w} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: `${WAF_COLORS[w] || "#666"}18`, color: WAF_COLORS[w] || "#999" }}>
              {WAF_SHORT[w] || w}
            </span>
          ))}
        </div>
      )}

      {/* applyTo (instructions) */}
      {item.applyTo && (
        <div style={{ fontSize: 10, opacity: 0.5, fontFamily: "monospace", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <Paperclip size={10} style={{ verticalAlign: -1, marginRight: 2 }} />{item.applyTo}
        </div>
      )}

      {/* events (hooks) */}
      {item.events && item.events.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
          {item.events.map((e) => (
            <span key={e} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#f59e0b18", color: "#f59e0b" }}>{e}</span>
          ))}
        </div>
      )}

      {/* plays (plugins) */}
      {item.plays && item.plays.length > 0 && (
        <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4 }}>
          <Target size={10} style={{ verticalAlign: -1, marginRight: 2 }} />Plays: {item.plays.join(", ")}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 4, marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
        <button className="btn btn-sm btn-ghost" onClick={onGithub} title="View on GitHub" style={{ fontSize: 10, padding: "2px 6px" }}>
          <ExternalLink size={10} style={{ verticalAlign: -1, marginRight: 2 }} /> GitHub
        </button>
        {category === "agents" && (
          <button className="btn btn-sm" onClick={onInstall} title="Install in VS Code" style={{ fontSize: 10, padding: "2px 6px", background: `${meta.color}25`, color: meta.color, borderColor: meta.color }}>
            <Zap size={10} style={{ verticalAlign: -1, marginRight: 2 }} /> Install
          </button>
        )}
      </div>
    </div>
  );
}

// ─── DetailView ───
function DetailView({ item, category, meta, onGithub, onInstall }: {
  item: PrimitiveItem; category: CategoryId; meta: CategoryMeta;
  onGithub: () => void; onInstall: () => void;
}) {
  const displayName = item.name || item.id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const sizeKb = item.size ? `${(item.size / 1024).toFixed(1)}KB` : null;

  return (
    <div>
      {/* Header */}
      <div style={{ padding: "16px 0", borderBottom: "1px solid var(--vscode-panel-border)", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          <span style={{ color: meta.color }}><meta.Icon size={18} /></span> {displayName}
        </h2>
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="pill" style={{ background: `${meta.color}18`, color: meta.color, borderColor: `${meta.color}40` }}>
            {meta.label}
          </span>
          {sizeKb && <span style={{ fontSize: 11, opacity: 0.5 }}>{sizeKb}</span>}
          {item.version && <span style={{ fontSize: 11, opacity: 0.5 }}>v{item.version}</span>}
        </div>
      </div>

      {/* Description */}
      {item.description && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 6px", fontSize: 13, opacity: 0.7 }}>Description</h4>
          <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{item.description}</p>
        </div>
      )}

      {/* WAF Alignment */}
      {item.waf && item.waf.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.7 }}>WAF Alignment</h4>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {item.waf.map((w) => (
              <span key={w} className="pill" style={{ background: `${WAF_COLORS[w] || "#666"}18`, color: WAF_COLORS[w] || "#999", borderColor: `${WAF_COLORS[w] || "#666"}40` }}>
                {WAF_SHORT[w] || w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Metadata Table */}
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.7 }}>Details</h4>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <tbody>
            <tr><td style={tdLabel}>ID</td><td style={tdVal}><code>{item.id}</code></td></tr>
            {item.file && <tr><td style={tdLabel}>File</td><td style={tdVal}><code>{item.file}</code></td></tr>}
            {item.folder && <tr><td style={tdLabel}>Folder</td><td style={tdVal}><code>{item.folder}</code></td></tr>}
            {item.applyTo && <tr><td style={tdLabel}>Applies To</td><td style={tdVal}><code>{item.applyTo}</code></td></tr>}
            {item.events && <tr><td style={tdLabel}>Events</td><td style={tdVal}>{item.events.join(", ")}</td></tr>}
            {item.keywords && <tr><td style={tdLabel}>Keywords</td><td style={tdVal}>{item.keywords.join(", ")}</td></tr>}
            {item.plays && <tr><td style={tdLabel}>Plays</td><td style={tdVal}>{item.plays.join(", ")}</td></tr>}
            {item.items !== undefined && <tr><td style={tdLabel}>Bundled Items</td><td style={tdVal}>{item.items}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* CLI Install */}
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.7 }}>Install</h4>
        <div style={{ background: "var(--vscode-editor-background)", padding: "10px 14px", borderRadius: 6, fontFamily: "monospace", fontSize: 12 }}>
          {category === "agents" && <div>npx frootai install agent {item.id}</div>}
          {category === "skills" && <div>npx frootai install skill {item.id}</div>}
          {category === "instructions" && <div>npx frootai install instruction {item.id}</div>}
          {category === "hooks" && <div>npx frootai install hook {item.id}</div>}
          {category === "plugins" && <div>npx frootai install plugin {item.id}</div>}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" onClick={onGithub} style={{ background: `${meta.color}20`, color: meta.color, borderColor: meta.color }}>
          <ExternalLink size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> View on GitHub
        </button>
        {category === "agents" && (
          <button className="btn" onClick={onInstall} style={{ background: "#10b98120", color: "#10b981", borderColor: "#10b981" }}>
            <Zap size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Install in VS Code
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => vscode.postMessage({ command: "openUrl", url: `https://frootai.dev/primitives/${category}#${item.id}` })}>
          <Globe size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> View on Website
        </button>
      </div>
    </div>
  );
}

const tdLabel: React.CSSProperties = { padding: "6px 12px 6px 0", opacity: 0.6, fontWeight: 500, verticalAlign: "top", whiteSpace: "nowrap" };
const tdVal: React.CSSProperties = { padding: "6px 0" };
