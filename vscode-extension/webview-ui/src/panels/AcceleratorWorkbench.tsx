import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bot, Boxes, Building, Code2, Database, ExternalLink, FileText, GitFork, Grid3X3, MessageCircle, Package, Plug, Search, Shield, Sparkles, Star, Workflow } from "lucide-react";
import type { AcceleratorView } from "../types";
import { vscode } from "../vscode";

const CATEGORIES = [
  { id: "all", label: "All", Icon: Grid3X3 },
  { id: "rag", label: "RAG & Search", Icon: Search },
  { id: "agents", label: "AI Agents", Icon: Bot },
  { id: "mcp", label: "MCP & Tools", Icon: Plug },
  { id: "chat", label: "Chat & Copilot", Icon: MessageCircle },
  { id: "document", label: "Document AI", Icon: FileText },
  { id: "security", label: "Security", Icon: Shield },
  { id: "data", label: "Data & MLOps", Icon: Database },
  { id: "infra", label: "Infrastructure", Icon: Building },
];
const PUBLISHERS = ["all", "frootai", "microsoft", "google", "aws", "community"] as const;
const PAGE_SIZE = 24;

export function AcceleratorCatalog({ entries, loading, onNavigate }: { entries: AcceleratorView[]; loading: boolean; onNavigate: (route: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [publisher, setPublisher] = useState<(typeof PUBLISHERS)[number]>("all");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => entries.filter((entry) =>
    (publisher === "all" || entry.publisher === publisher)
    && (category === "all" || entry.category === category)
    && (!query.trim() || `${entry.name} ${entry.fullName} ${entry.description} ${entry.language} ${entry.topics.join(" ")}`.toLowerCase().includes(query.toLowerCase().trim())),
  ), [category, entries, publisher, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const update = (callback: () => void) => { callback(); setPage(1); };

  return <main className="container fai-accelerator">
    <section className="fai-content-hero"><div><span className="fai-eyebrow"><Sparkles size={13} /> Explore source intelligence</span><h1>FAI Solution Accelerator</h1><p>Compare repositories, publishers, capabilities, lifecycle, and source evidence. This is read-only discovery and visioning—not a delivery contract or deployment.</p></div><aside><strong>{entries.length || "1,083"}</strong><span>accelerators</span><strong>5</strong><span>publishers</span></aside></section>
    <section className="fai-accelerator-path"><div><span className="fai-eyebrow">01 · Explore</span><h2>Find proven implementation evidence.</h2><p>Search canonical and community sources before choosing a bounded delivery contract.</p></div><div><span className="fai-eyebrow">02 · Deliver</span><h2>Move into a Solution Play.</h2><p>Use a versioned Play with DevKit, SpecKit, TuneKit, infrastructure, evaluation, and evidence status.</p><button className="btn btn-secondary" onClick={() => onNavigate("/solution-plays")}>Choose a delivery contract <ArrowRight size={12} /></button></div></section>
    <label className="fai-workbench-search"><Search size={16} /><input aria-label="Search solution accelerators" value={query} onChange={(event) => update(() => setQuery(event.target.value))} placeholder="Search repositories, technologies, outcomes…" /><span>{filtered.length} results</span></label>
    <div className="fai-filter-row" aria-label="Accelerator publisher filters">{PUBLISHERS.map((item) => <button key={item} className={publisher === item ? "active" : ""} onClick={() => update(() => setPublisher(item))}>{item === "all" ? "All publishers" : item}</button>)}</div>
    <div className="fai-filter-row" aria-label="Accelerator category filters">{CATEGORIES.map((item) => <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => update(() => setCategory(item.id))}><item.Icon size={12} />{item.label}</button>)}</div>
    {loading && !entries.length ? <div className="fai-loading-panel"><span className="fai-pulse" /> Loading the canonical accelerator catalog…</div> : <div className="fai-accelerator-grid">{visible.map((entry) => <button key={entry.id} onClick={() => onNavigate(`/solution-accelerator/${encodeURIComponent(entry.id)}`)}><header><span className={`fai-publisher ${entry.publisher}`}>{entry.publisher}</span><span>{entry.verificationState.replace(/_/g, " ")}</span></header><h2>{entry.name}</h2><p>{entry.description}</p><div>{entry.language && <span><Code2 size={11} />{entry.language}</span>}{entry.stars !== null && <span><Star size={11} />{entry.stars.toLocaleString()}</span>}{entry.license && <span>{entry.license}</span>}</div><footer>Inspect source intelligence <ArrowRight size={12} /></footer></button>)}</div>}
    {!loading && !filtered.length && <div className="fai-loading-panel">No accelerators match these filters.</div>}
    {pages > 1 && <nav className="fai-pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>← Previous</button><span>Page {page} of {pages}</span><button disabled={page === pages} onClick={() => setPage((value) => value + 1)}>Next →</button></nav>}
  </main>;
}

export function AcceleratorDetail({ entry, onNavigate }: { entry?: AcceleratorView; onNavigate: (route: string) => void }) {
  const [installStatus, setInstallStatus] = useState<{ status: string; message: string } | null>(null);
  useEffect(() => {
    const listener = (event: MessageEvent) => { const message = event.data; if (message?.type === "acceleratorInstallStatus" && message.id === entry?.id) setInstallStatus({ status: message.status, message: message.message ?? message.status }); };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [entry?.id]);
  if (!entry) return <main className="container"><div className="fai-loading-panel">This accelerator could not be found in the canonical catalog.</div></main>;
  const open = (url: string) => vscode.postMessage({ command: "openUrl", url });
  return <main className="container fai-accelerator-detail">
    <section className="fai-content-hero"><div><span className={`fai-publisher ${entry.publisher}`}>{entry.publisher}</span><h1>{entry.name}</h1><p>{entry.description}</p><div className="fai-detail-actions"><button className="btn" onClick={() => open(entry.sourceUrl)}><GitFork size={13} /> Inspect source <ExternalLink size={11} /></button><button className="btn" onClick={() => { setInstallStatus({ status: "loading", message: "Resolving an immutable repository commit and verifying .github assets…" }); vscode.postMessage({ command: "installAcceleratorAssets", acceleratorId: entry.id }); }}><Package size={13} /> Download repository .github</button><button className="btn" onClick={() => vscode.postMessage({ command: "cloneAccelerator", acceleratorId: entry.id })}><GitFork size={13} /> Clone repository</button>{entry.playId && <button className="btn btn-secondary" onClick={() => onNavigate(`/solution-plays/${entry.playId}`)}>Open delivery Play <ArrowRight size={11} /></button>}</div>{installStatus && <p role="status" className={`fai-inline-status ${installStatus.status}`}>{installStatus.message}</p>}</div><aside><strong>{entry.stars?.toLocaleString() ?? "—"}</strong><span>stars</span><strong>{entry.language || "Mixed"}</strong><span>language</span></aside></section>
    <section className="fai-source-contract"><header><span className="fai-eyebrow">Source identity</span><strong>{entry.fullName}</strong></header><div><Info label="Owner" value={entry.owner} /><Info label="Publisher" value={entry.publisher} /><Info label="License" value={entry.license || "Not declared"} /><Info label="Category" value={entry.category} /><Info label="Verification" value={entry.verificationState.replace(/_/g, " ")} /><Info label="Updated" value={entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : "Not reported"} /></div></section>
    <section className="fai-accelerator-blueprint"><header><Workflow size={16} /><div><span className="fai-eyebrow">Evidence path</span><h2>From source to governed delivery</h2></div></header><div><Step number="01" icon={GitFork} title="Inspect" detail="Review repository identity, code, documentation, and declared capabilities." /><Step number="02" icon={Boxes} title="Download" detail="Copy only the pinned, hash-verified .github assets while preserving existing files." /><Step number="03" icon={Shield} title="Bound" detail="Choose a canonical Solution Play before treating source as a delivery contract." /><Step number="04" icon={Package} title="Deliver" detail="Initialize governed DevKit, SpecKit, TuneKit, and verification controls." /></div></section>
    {entry.topics.length > 0 && <section className="fai-source-topics"><h2>Capabilities and topics</h2><div>{entry.topics.map((topic) => <span key={topic}>{topic}</span>)}</div></section>}
  </main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Step({ number, icon: Icon, title, detail }: { number: string; icon: typeof GitFork; title: string; detail: string }) { return <article><span>{number}</span><Icon size={18} /><h3>{title}</h3><p>{detail}</p></article>; }
