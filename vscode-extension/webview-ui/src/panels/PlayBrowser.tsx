import { useState, useMemo } from "react";
import type { SolutionPlay, PlayCategory } from "../types";
import Badge from "../components/Badge";
import SearchInput from "../components/SearchInput";
import { vscode } from "../vscode";
import { Search, LayoutGrid, ChevronLeft, ChevronRight, Settings, ExternalLink } from "lucide-react";

const PLAYS_PER_PAGE = 20;

const CX_COLORS: Record<string, string> = {
  Foundation: "#0ea5e9", Low: "#10b981", Medium: "#f59e0b", High: "#ef4444", "Very High": "#7c3aed",
};

const CATEGORIES: PlayCategory[] = [
  { id: "rag", label: "RAG & Search", icon: "🔍", color: "#10b981" },
  { id: "agent", label: "Agents", icon: "🤖", color: "#6366f1" },
  { id: "voice", label: "Voice & Speech", icon: "🎙️", color: "#06b6d4" },
  { id: "security", label: "Security", icon: "🔒", color: "#ec4899" },
  { id: "infra", label: "Infrastructure", icon: "☁️", color: "#7c3aed" },
  { id: "doc", label: "Documents", icon: "📄", color: "#f59e0b" },
  { id: "devops", label: "DevOps", icon: "⚙️", color: "#0ea5e9" },
  { id: "customer", label: "Customer & Sales", icon: "💬", color: "#14b8a6" },
  { id: "data", label: "Data & Pipeline", icon: "🗄️", color: "#8b5cf6" },
  { id: "ml", label: "MLOps", icon: "🔧", color: "#f97316" },
  { id: "creative", label: "Creative & Media", icon: "🎨", color: "#d946ef" },
  { id: "health", label: "Healthcare", icon: "❤️", color: "#ef4444" },
  { id: "finance", label: "Finance & Risk", icon: "📊", color: "#22c55e" },
  { id: "education", label: "Education", icon: "📚", color: "#3b82f6" },
  { id: "energy", label: "Energy & Climate", icon: "🌍", color: "#16a34a" },
  { id: "iot", label: "IoT & Edge", icon: "📡", color: "#f43f5e" },
  { id: "retail", label: "Retail & Commerce", icon: "🛒", color: "#a855f7" },
  { id: "legal", label: "Legal & Compliance", icon: "⚖️", color: "#a855f7" },
  { id: "gov", label: "Government", icon: "🏛️", color: "#64748b" },
  { id: "telecom", label: "Telecom", icon: "📶", color: "#0891b2" },
  { id: "special", label: "Specialized", icon: "⚡", color: "#eab308" },
];

interface Props {
  plays: SolutionPlay[];
}

export default function PlayBrowser({ plays }: Props) {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = plays;

    if (selectedCat) {
      result = result.filter((p) => p.cat === selectedCat);
    }

    if (search.trim()) {
      const words = search.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
      result = result.filter((p) => {
        const haystack = [p.id, p.name, p.desc, p.infra, p.tagline, p.cat, p.pattern]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return words.every((w) => haystack.includes(w));
      });
    }

    return result;
  }, [plays, search, selectedCat]);

  const totalPages = Math.ceil(filtered.length / PLAYS_PER_PAGE);
  const paged = filtered.slice((page - 1) * PLAYS_PER_PAGE, page * PLAYS_PER_PAGE);

  const handleCatClick = (catId: string) => {
    setSelectedCat(selectedCat === catId ? null : catId);
    setPage(1);
  };

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const openPlay = (play: SolutionPlay) => {
    vscode.postMessage({ command: "navigate", panel: "playDetail", play });
  };

  const cmd = (command: string, play: SolutionPlay) => {
    vscode.postMessage({ command, playId: play.id, playDir: play.dir });
  };

  const openUrl = (url: string) => vscode.postMessage({ command: "openUrl", url });

  const logoUri = (window as any).panelData?.logoUri;

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    plays.forEach((p) => { if (p.cat) counts[p.cat] = (counts[p.cat] || 0) + 1; });
    return counts;
  }, [plays]);

  return (
    <div className="container">
      {/* Branding */}
      <div style={{ textAlign: "center", padding: "16px 16px 8px" }}>
        {logoUri && <img src={logoUri} alt="FrootAI" style={{ width: 48, height: 48, marginBottom: 8 }} />}
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>
          <span style={{ color: "var(--vscode-foreground)" }}>Froot</span>
          <span style={{ color: "#10b981" }}>AI</span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
          From the Roots to the Fruits — The Open Glue for GenAI
        </div>
      </div>

      {/* Hero */}
      <div className="hero">
        <h1 style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <LayoutGrid size={24} />
          Solution Plays
        </h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
          {plays.length} pre-architected AI solutions — browse, search, and initialize
        </p>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={handleSearchChange}
        placeholder="Search plays by name, service, pattern, category..."
        resultCount={filtered.length}
      />

      {/* Category pills */}
      <div className="filter-bar">
        <button
          className={`filter-tag${!selectedCat ? " active" : ""}`}
          onClick={() => { setSelectedCat(null); setPage(1); }}
        >
          All ({plays.length})
        </button>
        {CATEGORIES.filter((c) => catCounts[c.id]).map((cat) => (
          <button
            key={cat.id}
            className={`filter-tag${selectedCat === cat.id ? " active" : ""}`}
            onClick={() => handleCatClick(cat.id)}
            style={
              selectedCat === cat.id
                ? { background: cat.color, borderColor: "transparent", color: "#fff" }
                : undefined
            }
          >
            {cat.icon} {cat.label} ({catCounts[cat.id]})
          </button>
        ))}
      </div>

      {/* Results header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, fontSize: 12, opacity: 0.6 }}>
        <span>
          Showing {(page - 1) * PLAYS_PER_PAGE + 1}–{Math.min(page * PLAYS_PER_PAGE, filtered.length)} of {filtered.length}
        </span>
        {totalPages > 1 && <span>Page {page} of {totalPages}</span>}
      </div>

      {/* Play cards */}
      {paged.length === 0 ? (
        <div className="empty-state">
          <Search size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
          <p>No plays match your search.</p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearch(""); setSelectedCat(null); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-2">
          {paged.map((play) => (
            <BrowserPlayCard
              key={play.id}
              play={play}
              onView={() => openPlay(play)}
              onInit={() => cmd("initDevKit", play)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 12 }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            style={{ opacity: page <= 1 ? 0.3 : 1 }}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .map((p, idx, arr) => (
              <span key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ opacity: 0.3 }}>…</span>}
                <button
                  className={`btn btn-sm ${p === page ? "" : "btn-secondary"}`}
                  onClick={() => setPage(p)}
                  style={{ minWidth: 32 }}
                >
                  {p}
                </button>
              </span>
            ))}
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            style={{ opacity: page >= totalPages ? 0.3 : 1 }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Bottom actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24, paddingBottom: 20, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => vscode.postMessage({ command: "navigate", panel: "configurator" })} style={{ background: "#f59e0b" }}>
          <Settings size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
          Solution Configurator
        </button>
        <button className="btn btn-secondary" onClick={() => openUrl("https://frootai.dev/solution-plays")}>
          <ExternalLink size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
          Open on Website
        </button>
      </div>
    </div>
  );
}

/* ─── Play card for the browser ─── */

function BrowserPlayCard({ play, onView, onInit }: { play: SolutionPlay; onView: () => void; onInit: () => void }) {
  const cx = play.cx ?? "Medium";
  const cxColor = CX_COLORS[cx] ?? "#6b7280";

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            <span style={{ opacity: 0.5, marginRight: 4 }}>{play.id}</span>
            {play.name}
          </div>
          {play.tagline && (
            <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {play.tagline}
            </div>
          )}
        </div>
        <Badge label={cx} color={cxColor} />
      </div>

      {/* Infrastructure chips */}
      {play.infra && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {play.infra.split("·").slice(0, 4).map((s) => (
            <span
              key={s.trim()}
              style={{
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 500,
                background: "var(--vscode-badge-background, #333)",
                color: "var(--vscode-badge-foreground, #ccc)",
              }}
            >
              {s.trim()}
            </span>
          ))}
          {play.infra.split("·").length > 4 && (
            <span style={{ fontSize: 10, opacity: 0.4, padding: "2px 4px" }}>
              +{play.infra.split("·").length - 4}
            </span>
          )}
        </div>
      )}

      {/* Cost estimate (compact) */}
      {play.costDev && (
        <div style={{ fontSize: 10, opacity: 0.5 }}>
          💰 Dev: {play.costDev} · Prod: {play.costProd}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
        <button className="btn btn-sm" onClick={onView} style={{ flex: 1 }}>
          View Play
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onInit} style={{ flex: 1 }}>
          Init DevKit
        </button>
      </div>
    </div>
  );
}
