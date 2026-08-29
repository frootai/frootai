import { useState, useMemo } from "react";
import type { SolutionPlay, PlayCategory } from "../types";
import SearchInput from "../components/SearchInput";
import { vscode } from "../vscode";
import { Search, ChevronLeft, ChevronRight, Settings, ExternalLink, Bot, Mic, Shield, Cloud, FileText, MessageSquare, Database, Wrench, Palette, Heart, BarChart3, BookOpen, Globe, Radio, ShoppingCart, Scale, Building, Wifi, Zap, ArrowRight, SlidersHorizontal, Blocks } from "lucide-react";

const PLAYS_PER_PAGE = 20;

const CX_COLORS: Record<string, string> = {
  Foundation: "#0ea5e9", Low: "#10b981", Medium: "#f59e0b", High: "#ef4444", "Very High": "#7c3aed",
};

const CATEGORIES: PlayCategory[] = [
  { id: "rag", label: "RAG & Search", Icon: Search, color: "#10b981" },
  { id: "agent", label: "Agents", Icon: Bot, color: "#6366f1" },
  { id: "voice", label: "Voice & Speech", Icon: Mic, color: "#06b6d4" },
  { id: "security", label: "Security", Icon: Shield, color: "#ec4899" },
  { id: "infra", label: "Infrastructure", Icon: Cloud, color: "#7c3aed" },
  { id: "doc", label: "Documents", Icon: FileText, color: "#f59e0b" },
  { id: "devops", label: "DevOps", Icon: Settings, color: "#0ea5e9" },
  { id: "customer", label: "Customer & Sales", Icon: MessageSquare, color: "#14b8a6" },
  { id: "data", label: "Data & Pipeline", Icon: Database, color: "#8b5cf6" },
  { id: "ml", label: "MLOps", Icon: Wrench, color: "#f97316" },
  { id: "creative", label: "Creative & Media", Icon: Palette, color: "#d946ef" },
  { id: "health", label: "Healthcare", Icon: Heart, color: "#ef4444" },
  { id: "finance", label: "Finance & Risk", Icon: BarChart3, color: "#22c55e" },
  { id: "education", label: "Education", Icon: BookOpen, color: "#3b82f6" },
  { id: "energy", label: "Energy & Climate", Icon: Globe, color: "#16a34a" },
  { id: "iot", label: "IoT & Edge", Icon: Radio, color: "#f43f5e" },
  { id: "retail", label: "Retail & Commerce", Icon: ShoppingCart, color: "#a855f7" },
  { id: "legal", label: "Legal & Compliance", Icon: Scale, color: "#a855f7" },
  { id: "gov", label: "Government", Icon: Building, color: "#64748b" },
  { id: "telecom", label: "Telecom", Icon: Wifi, color: "#0891b2" },
  { id: "special", label: "Specialized", Icon: Zap, color: "#eab308" },
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

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    plays.forEach((p) => { if (p.cat) counts[p.cat] = (counts[p.cat] || 0) + 1; });
    return counts;
  }, [plays]);

  return (
    <main className="container fai-play-catalog">
      <section className="fai-play-hero">
        <div>
          <p className="fai-eyebrow">Canonical delivery contracts</p>
          <h1>Choose the delivery contract for your outcome.</h1>
          <p>Each Solution Play is a versioned workspace with a <code>.github</code> Agentic OS, implementation assets, architecture, quality controls, and explicit evidence status.</p>
          <div className="fai-play-hero-actions">
            <button className="btn" onClick={() => document.querySelector(".fai-play-catalog-panel")?.scrollIntoView({ behavior: "smooth" })}>Browse delivery contracts <ArrowRight size={13} /></button>
            <button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "navigate", panel: "configurator" })}><Settings size={13} /> Use Configurator</button>
          </div>
        </div>
        <aside className="fai-toolkit-summary" aria-label="FAI Toolkit summary">
          <header><Blocks size={14} /><span><strong>Tool engineering</strong><small>Structure agentic gaps into implementation, specification, and quality controls.</small></span></header>
          <div><ToolkitSummary name="DevKit" type="Implementation" detail="Agents, skills, prompts, MCP context, and implementation assets." /><ToolkitSummary name="SpecKit" type="Specification" detail="Architecture, WAF alignment, infrastructure, and evidence boundaries." /><ToolkitSummary name="TuneKit" type="Quality" detail="Models, thresholds, guardrails, evaluation, and runtime controls." /></div>
          <footer><span><strong>{plays.length}</strong><small>Plays</small></span><span><strong>{CATEGORIES.length}</strong><small>Domains</small></span><span><strong>3</strong><small>Kits per Play</small></span></footer>
        </aside>
      </section>

      <section className="fai-play-catalog-panel">
        <header className="fai-play-catalog-header"><div><p className="fai-eyebrow">Delivery contract catalog</p><h2>Find the contract for your outcome.</h2><p>Search canonical names, descriptions, architecture patterns, Azure services, domains, or Play numbers.</p></div><button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "navigate", panel: "configurator" })}>Not sure? Configurator <ArrowRight size={12} /></button></header>

        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by outcome, domain, service, or Play number..."
          resultCount={filtered.length}
        />

        <div className="fai-play-category-list" aria-label="Solution Play domains">
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
            <cat.Icon size={14} /> {cat.label} ({catCounts[cat.id]})
          </button>
        ))}
        </div>

      <div className="fai-play-results-meta">
        <span>
          <strong>{filtered.length}</strong> matching Play{filtered.length === 1 ? "" : "s"} · Showing {filtered.length ? (page - 1) * PLAYS_PER_PAGE + 1 : 0}–{Math.min(page * PLAYS_PER_PAGE, filtered.length)}
        </span>
        {totalPages > 1 && <span>Page {page} of {totalPages}</span>}
      </div>

      {paged.length === 0 ? (
        <div className="empty-state">
          <Search size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
          <p>No plays match your search.</p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearch(""); setSelectedCat(null); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="fai-play-grid">
          {paged.map((play) => (
            <BrowserPlayCard
              key={play.id}
              play={play}
              onView={() => openPlay(play)}
              onInit={() => cmd("initDevKit", play)}
              onSource={() => openUrl(`https://github.com/frootai/frootai/tree/main/solution-plays/${play.dir}`)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="fai-play-pagination" aria-label="Solution Play pages">
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
        </nav>
      )}

        <footer className="fai-play-catalog-footer"><button className="btn btn-secondary" onClick={() => openUrl("https://frootai.dev/solution-plays")}>Compare on frootai.dev <ExternalLink size={12} /></button></footer>
      </section>
    </main>
  );
}

/* ─── Play card for the browser ─── */

function BrowserPlayCard({ play, onView, onInit, onSource }: { play: SolutionPlay; onView: () => void; onInit: () => void; onSource: () => void }) {
  const cx = play.cx ?? "Medium";
  const cxColor = CX_COLORS[cx] ?? "#6b7280";
  const category = CATEGORIES.find((item) => item.id === play.cat) ?? CATEGORIES.at(-1)!;
  const CategoryIcon = category.Icon;
  const evidence = (play.certification?.level ?? play.status ?? "designed").replace(/_/g, " ");

  return (
    <article className="fai-play-card" style={{ "--play-accent": category.color, "--complexity-color": cxColor } as React.CSSProperties}>
      <header>
        <div className="fai-play-icon"><CategoryIcon size={20} /></div>
        <div><p className="fai-eyebrow">Play {play.id} · {category.label}</p><h3>{play.name}</h3></div>
      </header>
      <div className="fai-play-status"><span>Spec v0.1.0</span><span>{evidence}</span><span style={{ borderColor: cxColor, color: cxColor }}>{cx}</span></div>
      <p className="fai-play-tagline">{play.tagline ?? play.desc}</p>
      <section className="fai-play-toolkit">
        <header><Blocks size={12} /><span><strong>Tool engineering</strong><small>{play.pattern ?? "Canonical implementation, specification, and quality controls."}</small></span></header>
        <div>
          <PlayKit name="DevKit" type="Implementation" detail={`${play.devkit?.length ?? 0} workspace assets`} />
          <PlayKit name="SpecKit" type="Specification" detail={`${play.layer || "FAI"} · 6 WAF pillars`} />
          <PlayKit name="TuneKit" type="Quality" detail={`${play.tunekit?.length ?? 0} quality assets`} />
        </div>
      </section>
      {play.infra && <div className="fai-play-services">{play.infra.split("·").slice(0, 5).map(service => <span key={service}>{service.trim()}</span>)}</div>}
      <footer><button className="btn" onClick={onView}>View Play + Guide <ArrowRight size={12} /></button><button className="btn btn-secondary" onClick={onSource} aria-label={`Open ${play.name} source on GitHub`}><Globe size={13} /> Source</button><button className="btn btn-secondary" onClick={onInit}><SlidersHorizontal size={13} /> Initialize DevKit</button></footer>
    </article>
  );
}

function ToolkitSummary({ name, type, detail }: { name: string; type: string; detail: string }) {
  return <section><Wrench size={15} /><strong>{name}</strong><small>{type}</small><p>{detail}</p></section>;
}

function PlayKit({ name, type, detail }: { name: string; type: string; detail: string }) {
  return <div><Wrench size={12} /><span><strong>{name}</strong><small>{type}</small><p>{detail}</p></span></div>;
}
