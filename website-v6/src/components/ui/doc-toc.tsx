"use client";

import { useEffect, useState } from "react";
import { List, X } from "lucide-react";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function DocTableOfContents() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Extract headings from the rendered article
  useEffect(() => {
    const article = document.querySelector("article");
    if (!article) return;

    const headings = article.querySelectorAll("h1, h2, h3, h4");
    const tocItems: TocItem[] = [];
    headings.forEach((h) => {
      const id = h.id;
      const text = h.textContent || "";
      const level = parseInt(h.tagName[1]);
      if (id && text) tocItems.push({ id, text, level });
    });
    setItems(tocItems);
  }, []);

  // Track active heading via IntersectionObserver
  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 3) return null;

  const tocContent = (
    <nav className="space-y-0.5">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={() => setMobileOpen(false)}
          className={`block text-[12px] leading-snug py-1.5 px-3 rounded-r-lg transition-all duration-200 border-l-2 cursor-pointer
            hover:text-white hover:border-white/50 hover:bg-white/[0.04]
            ${item.level === 1 ? "font-bold" : ""}
            ${item.level === 2 ? "font-semibold" : ""}
            ${item.level === 3 ? "ml-3" : ""}
            ${item.level === 4 ? "ml-6 text-[11px]" : ""}
            ${activeId === item.id
              ? "text-emerald border-emerald bg-emerald/[0.06] shadow-[inset_0_0_12px_rgba(16,185,129,0.08)]"
              : "text-fg-dim border-transparent"
            }`}
        >
          {item.text}
        </a>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop: fixed sidebar on the right */}
      <aside className="hidden xl:block fixed top-24 right-[max(1rem,calc((100vw-80rem)/2+1rem))] max-h-[calc(100vh-8rem)] overflow-y-auto w-56 pr-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-fg-dim mb-3 px-3">On this page</p>
        {tocContent}
      </aside>

      {/* Mobile: floating button + slide-in panel */}
      <div className="xl:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-11 h-11 rounded-full bg-emerald/90 text-white shadow-lg shadow-emerald/20 flex items-center justify-center cursor-pointer hover:bg-emerald transition-colors"
          aria-label="Table of contents"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <List className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="xl:hidden fixed inset-0 z-30" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="absolute right-0 top-0 bottom-0 w-72 bg-bg/95 backdrop-blur-2xl border-l border-border-subtle p-5 pt-20 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-fg-dim mb-3">On this page</p>
            {tocContent}
          </div>
        </div>
      )}
    </>
  );
}
