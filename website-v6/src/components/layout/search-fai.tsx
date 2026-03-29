"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

interface IndexEntry { t: string; u: string; b: string; type: string; parent?: string; }
interface SearchResult { title: string; url: string; excerpt: string; score: number; parent?: string; }

const SUGGESTIONS = [
  { label: "RAG architecture", href: "/docs/RAG-Architecture" },
  { label: "Solution Play 01", href: "/user-guide?play=01" },
  { label: "Cost optimization", href: "/docs/T3-Production-Patterns" },
  { label: "Embeddings", href: "/docs/GenAI-Foundations" },
  { label: "Azure AI Search", href: "/docs/Azure-AI-Foundry" },
  { label: "DevKit setup", href: "/setup-guide" },
];

function doSearch(query: string, index: IndexEntry[]): SearchResult[] {
  if (!query.trim() || !index.length) return [];
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored: SearchResult[] = [];

  for (const entry of index) {
    const title = (entry.t || "").toLowerCase();
    const body = (entry.b || "").toLowerCase();
    let score = 0;

    for (const w of words) {
      // Exact title match gets highest weight
      if (title === w) score += 50;
      else if (title.startsWith(w)) score += 20;
      else if (title.includes(w)) score += 10;
      // Body matches
      if (body.includes(w)) {
        score += 2;
        // Bonus for multiple occurrences in body
        const occurrences = body.split(w).length - 1;
        score += Math.min(occurrences, 5);
      }
    }

    // Boost heading entries (more targeted)
    if (score > 0 && entry.type === "heading") score += 3;
    if (score > 0 && entry.type === "doc") score += 5;

    if (score > 0) {
      let excerpt = "";
      if (entry.b) {
        const idx = entry.b.toLowerCase().indexOf(words[0]);
        if (idx >= 0) {
          const start = Math.max(0, idx - 40);
          excerpt = (start > 0 ? "..." : "") + entry.b.substring(start, start + 160) + (start + 160 < entry.b.length ? "..." : "");
        } else {
          excerpt = entry.b.substring(0, 120) + (entry.b.length > 120 ? "..." : "");
        }
      }

      scored.push({
        title: entry.t,
        url: entry.u,
        excerpt,
        score,
        parent: entry.parent,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 20);
}

export function SearchFAI() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="nav-accent-indigo px-3 py-1.5 rounded-lg text-[13px] font-medium text-indigo whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5">
        <Search className="h-3.5 w-3.5" /> Search FAI
      </button>
      {open && <SearchFAIPanel onClose={() => setOpen(false)} />}
    </>
  );
}

export function SearchFAIPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [index, setIndex] = useState<IndexEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load index on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/search-index.json");
        const data: IndexEntry[] = await res.json();
        setIndex(data);
      } catch { /* ignore */ }
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    })();
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (index.length > 0) {
      setResults(doSearch(val, index));
    }
  }, [index]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div ref={panelRef}
      className="relative w-full max-w-lg mx-4 rounded-2xl border border-indigo/20 bg-[#0b0b14]/98 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden"
      style={{ animation: "searchDropIn 0.15s ease-out" }}>

      {/* Input */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle">
        <Search className="h-4 w-4 text-indigo shrink-0" />
        <input ref={inputRef} type="text" value={query} onChange={handleInput}
          placeholder="Search FrootAI..."
          className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-dim" />
        <button onClick={onClose} className="text-fg-dim hover:text-fg cursor-pointer"><X className="h-4 w-4" /></button>
      </div>

      {/* Content */}
      <div className="max-h-[380px] overflow-y-auto">
        {loading && (
          <div className="px-4 py-8 text-center text-[13px] text-fg-dim">Loading search index...</div>
        )}

        {!loading && query.length === 0 && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-fg-dim mb-2">Try searching for</p>
            {SUGGESTIONS.map((s) => (
              <Link key={s.label} href={s.href} onClick={onClose}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-fg-muted hover:text-fg hover:bg-bg-hover transition-colors">
                <span className="h-2 w-2 rounded-full bg-amber shrink-0" />
                {s.label}
              </Link>
            ))}
          </div>
        )}

        {!loading && query.length > 0 && results.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-fg-dim">No results for &ldquo;{query}&rdquo;</div>
        )}

        {results.length > 0 && (
          <div className="px-2 py-2">
            {results.map((r, i) => (
              <Link key={`${r.url}-${i}`} href={r.url} onClick={onClose}
                className="nav-item-hover block px-3 py-2.5 rounded-lg transition-all duration-200 group">
                <div className="flex items-center gap-2">
                  <Search className="nav-icon h-3 w-3 text-indigo shrink-0 opacity-60 transition-colors duration-200" />
                  <span className="text-[13px] font-medium text-fg group-hover:text-white transition-colors">{r.title}</span>
                </div>
                {r.parent && (
                  <span className="ml-5 text-[11px] text-fg-muted">{r.parent}</span>
                )}
                {r.excerpt && (
                  <p className="ml-5 mt-0.5 text-[11px] text-fg-muted leading-relaxed line-clamp-2">{r.excerpt}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
