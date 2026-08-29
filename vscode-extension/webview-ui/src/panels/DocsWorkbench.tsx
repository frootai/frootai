import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, BrainCircuit, CloudCog, Library, Search, ShieldCheck, Sprout, Workflow } from "lucide-react";
import type { KnowledgeModuleView } from "../types";
import MarkdownDocument from "../components/MarkdownDocument";

const LAYERS = [
  { key: "Foundations", id: "F", label: "Foundations", promise: "Build the shared language", color: "#f59e0b", Icon: Sprout },
  { key: "Reasoning", id: "R", label: "Reasoning", promise: "Make every answer defensible", color: "#10b981", Icon: BrainCircuit },
  { key: "Orchestration", id: "O¹", label: "Orchestration", promise: "Coordinate intelligent work", color: "#06b6d4", Icon: Workflow },
  { key: "Operations", id: "O²", label: "Operations", promise: "Run with confidence", color: "#818cf8", Icon: CloudCog },
  { key: "Transformation", id: "T", label: "Transformation", promise: "Create durable impact", color: "#ec4899", Icon: ShieldCheck },
];

export function DocsCatalog({ modules, onNavigate }: { modules: KnowledgeModuleView[]; onNavigate: (route: string) => void }) {
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState("All");
  const filtered = useMemo(() => modules.filter((module) => (layer === "All" || module.layer === layer) && (!query.trim() || `${module.id} ${module.title} ${module.content.slice(0, 2500)}`.toLowerCase().includes(query.toLowerCase().trim()))), [layer, modules, query]);
  return <main className="container fai-docs-catalog">
    <section className="fai-content-hero"><div><span className="fai-eyebrow"><Library size={13} /> FAI Knowledge Modules</span><h1>Understand the stack. Design with judgment.</h1><p>Sixteen connected FROOT modules move from model fundamentals to grounded reasoning, agent orchestration, reliable operations, and responsible production.</p></div><aside><strong>{modules.length || 16}</strong><span>modules</span><strong>5</strong><span>layers</span></aside></section>
    <section className="fai-doc-layer-grid" aria-label="Filter knowledge modules by FROOT layer">{LAYERS.map((item) => <button key={item.key} className={layer === item.key ? "active" : ""} style={{ "--layer-color": item.color } as React.CSSProperties} onClick={() => setLayer(layer === item.key ? "All" : item.key)}><item.Icon size={18} /><span className="fai-eyebrow">{item.id} · {item.label}</span><strong>{item.promise}</strong><small>{modules.filter((module) => module.layer === item.key).length} modules</small></button>)}</section>
    <label className="fai-workbench-search"><Search size={16} /><input aria-label="Search knowledge modules" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agents, RAG, safety, Foundry…" /><span>{filtered.length} results</span></label>
    <div className="fai-doc-module-groups">{LAYERS.map((item) => { const layerModules = filtered.filter((module) => module.layer === item.key); if (!layerModules.length) return null; return <section key={item.key}><header><item.Icon size={15} style={{ color: item.color }} /><h2>{item.id} · {item.label}</h2><span>{layerModules.length} modules</span></header><div>{layerModules.map((module) => <button key={module.id} onClick={() => onNavigate(`/docs/${module.id}`)} style={{ "--layer-color": item.color } as React.CSSProperties}><span className="fai-eyebrow">{module.id}</span><h3>{module.title}</h3><p>{moduleSummary(module.content)}</p><footer>Open module <ArrowRight size={12} /></footer></button>)}</div></section>; })}</div>
    {!modules.length && <div className="fai-loading-panel"><span className="fai-pulse" /> Loading bundled knowledge modules…</div>}
  </main>;
}

export function DocsReader({ module, modules, onNavigate }: { module?: KnowledgeModuleView; modules: KnowledgeModuleView[]; onNavigate: (route: string) => void }) {
  const index = module ? modules.findIndex((item) => item.id === module.id) : -1;
  if (!module) return <main className="container"><div className="fai-loading-panel"><BookOpen size={17} /> The requested module is unavailable.</div></main>;
  return <main className="container fai-doc-reader"><header><span className="fai-eyebrow">{module.id} · {module.layer}</span><h1>{module.title}</h1><p>Bundled canonical FROOT knowledge · fully rendered inside VS Code</p></header><div className="fai-doc-reader-layout"><aside aria-label="Knowledge module navigation"><button onClick={() => onNavigate("/docs")}><Library size={13} /> All modules</button>{modules.map((item) => <button key={item.id} className={item.id === module.id ? "active" : ""} onClick={() => onNavigate(`/docs/${item.id}`)}><span>{item.id}</span>{item.title}</button>)}</aside><MarkdownDocument markdown={module.content} onNavigate={onNavigate} /></div><footer>{index > 0 && <button className="btn btn-secondary" onClick={() => onNavigate(`/docs/${modules[index - 1].id}`)}>← {modules[index - 1].title}</button>}<button className="btn" onClick={() => onNavigate(index < modules.length - 1 ? `/docs/${modules[index + 1].id}` : "/docs")}>{index < modules.length - 1 ? `${modules[index + 1].title} →` : "All modules"}</button></footer></main>;
}

function moduleSummary(content: string): string {
  return content.replace(/```[\s\S]*?```/g, " ").split(/\n\s*\n/).map((part) => part.replace(/[#>*_`\[\]]/g, "").trim()).find((part) => part.length > 70)?.slice(0, 220) || "Open this FROOT module for architecture guidance, examples, and production practices.";
}
