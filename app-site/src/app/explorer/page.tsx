"use client";

import { useState, useEffect, useMemo } from "react";
import { getCatalog, getAllPrimitives, type Catalog, type Primitive } from "@/lib/api";
import PrimitiveCard from "@/components/PrimitiveCard";
import SearchBar from "@/components/SearchBar";

const tabs = [
  { key: "all", label: "All" },
  { key: "agent", label: "Agents" },
  { key: "skill", label: "Skills" },
  { key: "instruction", label: "Instructions" },
  { key: "hook", label: "Hooks" },
  { key: "plugin", label: "Plugins" },
  { key: "workflow", label: "Workflows" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function ExplorerPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [selected, setSelected] = useState<Primitive | null>(null);
  const [visibleCount, setVisibleCount] = useState(48);

  useEffect(() => {
    getCatalog()
      .then(setCatalog)
      .finally(() => setLoading(false));
  }, []);

  const primitives = useMemo(() => {
    if (!catalog) return [];
    return getAllPrimitives(catalog);
  }, [catalog]);

  const filtered = useMemo(() => {
    let result = primitives;
    if (activeTab !== "all") {
      result = result.filter((p) => p.type === activeTab);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      );
    }
    return result;
  }, [primitives, activeTab, query]);

  useEffect(() => {
    setVisibleCount(48);
  }, [activeTab, query]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: primitives.length };
    for (const p of primitives) {
      counts[p.type] = (counts[p.type] ?? 0) + 1;
    }
    return counts;
  }, [primitives]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Primitive Explorer</h1>
        <p className="mt-1 text-sm text-frootai-muted">
          Browse and search across all FrootAI primitives
        </p>
      </div>

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search agents, skills, instructions..."
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-frootai-emerald/10 text-frootai-emerald"
                : "text-frootai-muted hover:bg-frootai-surface hover:text-frootai-text"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-60">
              {typeCounts[tab.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border border-frootai-border bg-frootai-surface"
            />
          ))}
        </div>
      ) : (
        <>
          <p className="text-xs text-frootai-muted">
            {filtered.length} primitive{filtered.length !== 1 ? "s" : ""} found
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.slice(0, visibleCount).map((p) => (
              <PrimitiveCard
                key={`${p.type}-${p.id}`}
                primitive={p}
                onClick={() => setSelected(p)}
              />
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setVisibleCount((c) => c + 48)}
                className="rounded-lg bg-frootai-surface px-6 py-2 text-sm text-frootai-emerald hover:bg-frootai-surface-hover transition-colors"
              >
                Load more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSelected(null)}
          />
          <div className="relative max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl border border-frootai-border bg-frootai-surface p-6">
            <button
              onClick={() => setSelected(null)}
              className="absolute right-4 top-4 text-frootai-muted hover:text-frootai-text"
            >
              ✕
            </button>
            <div className="space-y-4">
              <div>
                <span className="inline-block rounded-full bg-frootai-emerald/10 px-2 py-0.5 text-xs font-medium uppercase text-frootai-emerald">
                  {selected.type}
                </span>
                <h2 className="mt-2 text-lg font-bold text-frootai-text">
                  {selected.name}
                </h2>
              </div>
              <p className="text-sm text-frootai-muted leading-relaxed">
                {selected.description}
              </p>
              {selected.waf.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-frootai-muted">
                    WAF Pillars
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.waf.map((w) => (
                      <span
                        key={w}
                        className="rounded bg-frootai-emerald/10 px-2 py-0.5 text-xs text-frootai-emerald"
                      >
                        {w.replace(/-/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selected.plays.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-frootai-muted">
                    Compatible Plays
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.plays.map((p) => (
                      <span
                        key={p}
                        className="rounded bg-frootai-gold/10 px-2 py-0.5 text-xs text-frootai-gold"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-2">
                <code className="block rounded-lg bg-frootai-dark p-3 text-xs font-mono text-frootai-muted">
                  ID: {selected.id}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
