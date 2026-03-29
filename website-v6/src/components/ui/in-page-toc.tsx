"use client";

import { useEffect, useState } from "react";

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

export function InPageToc() {
  const [entries, setEntries] = useState<TocEntry[]>([]);

  useEffect(() => {
    const poll = () => {
      const article = document.querySelector("article");
      if (!article) return;
      const headings = article.querySelectorAll("h2, h3");
      const items: TocEntry[] = [];
      headings.forEach((h) => {
        const id = h.id;
        const text = h.textContent || "";
        const level = parseInt(h.tagName[1]);
        if (id && text) items.push({ id, text, level });
      });
      if (items.length > 0) setEntries(items);
    };
    poll();
    const timer = setTimeout(poll, 600);
    return () => clearTimeout(timer);
  }, []);

  if (entries.length < 2) return null;

  return (
    <div className="my-8 rounded-xl border border-border-subtle bg-bg-surface/40 p-5">
      <h2 className="text-lg font-bold mb-3 text-fg">Table of Contents</h2>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.id} style={{ paddingLeft: e.level === 3 ? "16px" : "0" }}>
            <a
              href={`#${e.id}`}
              className={`text-[13px] leading-relaxed transition-colors duration-150 hover:text-white ${
                e.level === 2 ? "text-emerald font-medium" : "text-cyan"
              }`}
            >
              {e.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
