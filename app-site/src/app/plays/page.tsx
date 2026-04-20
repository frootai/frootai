"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getCatalog,
  type Play,
  formatPlayName,
  getPlayCategory,
  getPlayComplexity,
} from "@/lib/api";
import PlayCard from "@/components/PlayCard";
import SearchBar from "@/components/SearchBar";

const categories = [
  "All",
  "RAG",
  "Agents",
  "Infrastructure",
  "Security",
  "Voice & Media",
  "Documents",
  "AI/ML",
  "Platform",
  "General",
];

export default function PlaysPage() {
  const [plays, setPlays] = useState<Play[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Play | null>(null);

  useEffect(() => {
    getCatalog()
      .then((c) => setPlays(c.plays))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = plays;
    if (category !== "All") {
      result = result.filter((p) => getPlayCategory(p.slug) === category);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (p) =>
          p.slug.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          formatPlayName(p.slug).toLowerCase().includes(q)
      );
    }
    return result;
  }, [plays, category, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solution Plays</h1>
        <p className="mt-1 text-sm text-frootai-muted">
          Pre-built AI solution architectures — from RAG to multi-agent swarms
        </p>
      </div>

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search plays by name or description..."
      />

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              category === cat
                ? "bg-frootai-emerald/10 text-frootai-emerald"
                : "text-frootai-muted hover:bg-frootai-surface hover:text-frootai-text"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border border-frootai-border bg-frootai-surface"
            />
          ))}
        </div>
      ) : (
        <>
          <p className="text-xs text-frootai-muted">
            {filtered.length} play{filtered.length !== 1 ? "s" : ""} found
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <PlayCard key={p.id} play={p} onClick={() => setSelected(p)} />
            ))}
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSelected(null)}
          />
          <div className="relative max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl border border-frootai-border bg-frootai-surface p-6">
            <button
              onClick={() => setSelected(null)}
              className="absolute right-4 top-4 text-frootai-muted hover:text-frootai-text"
            >
              ✕
            </button>
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-frootai-emerald/10 text-lg font-bold text-frootai-emerald">
                  {selected.id.padStart(2, "0")}
                </span>
                <div>
                  <h2 className="text-lg font-bold">
                    {formatPlayName(selected.slug)}
                  </h2>
                  <span className="text-xs text-frootai-muted">
                    {getPlayCategory(selected.slug)} •{" "}
                    {getPlayComplexity(selected)} complexity
                  </span>
                </div>
              </div>

              <p className="text-sm text-frootai-muted leading-relaxed">
                {selected.description}
              </p>

              {/* DevKit */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-frootai-muted">
                  DevKit
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Agents", value: selected.devkit?.agents },
                    { label: "Skills", value: selected.devkit?.skills },
                    { label: "Instructions", value: selected.devkit?.instructions },
                    { label: "Hooks", value: selected.devkit?.hooks },
                  ].map((d) => (
                    <div
                      key={d.label}
                      className="rounded-lg bg-frootai-dark/50 p-2 text-center"
                    >
                      <p className="text-lg font-bold text-frootai-text">
                        {d.value ?? 0}
                      </p>
                      <p className="text-[10px] text-frootai-muted">
                        {d.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* TuneKit */}
              {selected.tunekit && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-frootai-muted">
                    TuneKit
                  </h4>
                  <div className="rounded-lg bg-frootai-dark/50 p-3 text-xs font-mono text-frootai-muted space-y-1">
                    <p>
                      Model:{" "}
                      <span className="text-frootai-text">
                        {selected.tunekit.model}
                      </span>
                    </p>
                    <p>
                      Temperature:{" "}
                      <span className="text-frootai-text">
                        {selected.tunekit.temperature}
                      </span>
                    </p>
                    <p>
                      Max Tokens:{" "}
                      <span className="text-frootai-text">
                        {selected.tunekit.maxTokens}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* WAF */}
              {selected.speckit?.waf && selected.speckit.waf.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-frootai-muted">
                    WAF Pillars
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.speckit.waf.map((w) => (
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

              {/* Init command */}
              <div className="rounded-lg bg-frootai-dark p-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-frootai-muted">
                  Init DevKit
                </p>
                <code className="text-xs font-mono text-frootai-emerald">
                  npx frootai init {selected.slug}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
