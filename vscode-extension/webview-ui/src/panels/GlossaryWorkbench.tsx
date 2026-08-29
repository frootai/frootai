import { useMemo, useState } from "react";
import { BookOpen, BrainCircuit, CloudCog, Search, ShieldCheck, Sprout, Workflow, X } from "lucide-react";
import type { KnowledgeModuleView } from "../types";

type Layer = "Foundations" | "Reasoning" | "Orchestration" | "Operations" | "Transformation" | "Unspecified";
type Term = { term: string; slug: string; definition: string; layer: Layer; glyph: string };
type Group = { letter: string; terms: Term[] };
const META: Array<{ layer: Layer; color: string; Icon: typeof Sprout }> = [
  { layer: "Foundations", color: "#f59e0b", Icon: Sprout }, { layer: "Reasoning", color: "#10b981", Icon: BrainCircuit }, { layer: "Orchestration", color: "#06b6d4", Icon: Workflow }, { layer: "Operations", color: "#818cf8", Icon: CloudCog }, { layer: "Transformation", color: "#a78bfa", Icon: ShieldCheck },
];
const GLYPHS: Record<string, Layer> = { "🌱": "Foundations", "🪵": "Reasoning", "🌿": "Orchestration", "🏗️": "Operations", "🏗": "Operations", "🍎": "Transformation" };

export default function GlossaryWorkbench({ module }: { module?: KnowledgeModuleView }) {
  const groups = useMemo(() => parseGlossary(module?.content ?? ""), [module]);
  const [query, setQuery] = useState(""); const [layers, setLayers] = useState<Set<Layer>>(new Set());
  const filtered = useMemo(() => groups.map((group) => ({ ...group, terms: group.terms.filter((term) => (!layers.size || layers.has(term.layer)) && (!query.trim() || normalizeSearch(`${term.term} ${term.definition}`).includes(normalizeSearch(query)))) })).filter((group) => group.terms.length), [groups, layers, query]);
  const total = groups.reduce((sum, group) => sum + group.terms.length, 0); const visible = filtered.reduce((sum, group) => sum + group.terms.length, 0); const used = new Set(filtered.map((group) => group.letter));
  const toggle = (layer: Layer) => setLayers((current) => { const next = new Set(current); if (next.has(layer)) next.delete(layer); else next.add(layer); return next; });
  return <main className="fai-glossary"><header><span className="fai-eyebrow"><BookOpen size={13} /> FROOT reference</span><h1>AI Glossary A–Z</h1><p>Every term an architect, engineer, or consultant encounters in GenAI—defined clearly, with context for why it matters. <strong>{total || "200+"} terms</strong>, tagged by FROOT layer.</p><label className="fai-workbench-search"><Search size={16} /><input aria-label="Search glossary" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search terms or definitions…" />{query && <button aria-label="Clear glossary search" onClick={() => setQuery("")}><X size={14} /></button>}</label><div className="fai-glossary-filters"><span>Filter by layer</span>{META.map(({ layer, color, Icon }) => <button key={layer} aria-pressed={layers.has(layer)} className={layers.has(layer) ? "active" : ""} style={{ "--layer-color": color } as React.CSSProperties} onClick={() => toggle(layer)}><Icon size={13} />{layer}</button>)}{(query || layers.size > 0) && <small>{visible} of {total} terms match</small>}</div></header><nav aria-label="Jump to glossary letter">{Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)).map((letter) => <button key={letter} disabled={!used.has(letter)} onClick={() => document.getElementById(`letter-${letter}`)?.scrollIntoView({ behavior: "smooth" })}>{letter}</button>)}</nav><div className="fai-glossary-groups">{filtered.map((group) => <section id={`letter-${group.letter}`} key={group.letter}><header><strong>{group.letter}</strong><span>{group.terms.length} terms</span></header><div>{group.terms.map((term) => { const meta = META.find((item) => item.layer === term.layer) ?? { color: "#737373", Icon: BookOpen }; return <article id={term.slug} key={term.slug} style={{ "--layer-color": meta.color } as React.CSSProperties}><header><h2><meta.Icon size={15} />{term.term}</h2><span>{term.layer}</span></header><p>{term.definition}</p></article>; })}</div></section>)}</div>{!groups.length && <div className="fai-loading-panel"><span className="fai-pulse" /> Loading the bundled AI glossary…</div>}</main>;
}

export function parseGlossary(markdown: string): Group[] {
  const groups: Group[] = []; let current: Group | null = null; let term: Term | null = null; let definition: string[] = [];
  const flush = () => { if (term && current) { term.definition = definition.join(" ").replace(/\s+/g, " ").trim(); if (term.definition) current.terms.push(term); } term = null; definition = []; };
  for (const line of markdown.replace(/\r/g, "").split("\n")) {
    const letter = line.match(/^##\s+([A-Z])\s*$/); if (letter) { flush(); if (current?.terms.length) groups.push(current); current = { letter: letter[1], terms: [] }; continue; }
    const heading = line.match(/^###\s+(.+)$/); if (heading && current) { flush(); let label = heading[1].trim(); const glyph = Object.keys(GLYPHS).find((item) => label.includes(item)) ?? ""; if (glyph) label = label.split(glyph).join("").trim(); term = { term: label, slug: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), definition: "", layer: GLYPHS[glyph] ?? "Unspecified", glyph }; continue; }
    if (term && line.trim() && line.trim() !== "---") definition.push(line.trim().replace(/\*\*|`|\*/g, ""));
  }
  flush(); if (current?.terms.length) groups.push(current); return groups;
}

function normalizeSearch(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
