"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

interface TocEntry {
  id: string;
  text: string;
  level: number;
  children: { id: string; text: string }[];
}

export function InPageToc() {
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const poll = () => {
      const article = document.querySelector("article");
      if (!article) return;
      const headings = article.querySelectorAll("h2, h3");
      const items: TocEntry[] = [];
      let current: TocEntry | null = null;

      headings.forEach((h) => {
        const id = h.id;
        const text = h.textContent || "";
        const level = parseInt(h.tagName[1]);
        if (!id || !text) return;

        if (level === 2) {
          current = { id, text, level, children: [] };
          items.push(current);
        } else if (level === 3 && current) {
          current.children.push({ id, text });
        }
      });
      if (items.length > 0) setEntries(items);
    };
    poll();
    const timer = setTimeout(poll, 600);
    return () => clearTimeout(timer);
  }, []);

  if (entries.length < 2) return null;

  return (
    <div className="my-6 rounded-xl border border-border-subtle bg-bg-surface/40 px-5 py-4">
      <h3 className="text-sm font-bold mb-2 text-fg">Table of Contents</h3>
      <ul className="space-y-0.5">
        {entries.map((e) => (
          <li key={e.id}>
            <div className="flex items-center gap-1">
              {e.children.length > 0 && (
                <button
                  onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  className="p-0.5 text-fg-dim hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${expanded === e.id ? "" : "-rotate-90"}`} />
                </button>
              )}
              {e.children.length === 0 && <span className="w-4" />}
              <a
                href={`#${e.id}`}
                className="text-[13px] text-emerald font-medium hover:text-white transition-colors"
              >
                {e.text}
              </a>
            </div>
            {expanded === e.id && e.children.length > 0 && (
              <ul className="ml-5 mt-0.5 space-y-0.5">
                {e.children.map((c) => (
                  <li key={c.id}>
                    <a href={`#${c.id}`} className="text-[12px] text-cyan hover:text-white transition-colors">
                      {c.text}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
