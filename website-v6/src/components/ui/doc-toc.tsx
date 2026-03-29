"use client";

import { useEffect, useState } from "react";
import { List, X } from "lucide-react";

export function DocTableOfContents() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let tocbotInstance: typeof import("tocbot") | null = null;

    const init = async () => {
      const tocbot = await import("tocbot");
      tocbotInstance = tocbot;

      tocbot.init({
        tocSelector: ".js-toc",
        contentSelector: "article",
        headingSelector: "h1, h2, h3",
        hasInnerContainers: true,
        scrollSmooth: true,
        scrollSmoothOffset: -80,
        headingsOffset: 100,
        scrollSmoothDuration: 300,
        collapseDepth: 6,
        orderedList: false,
        activeLinkClass: "toc-active",
        listClass: "toc-list",
        linkClass: "toc-link",
        activeListItemClass: "toc-active-li",
        listItemClass: "toc-list-item",
        isCollapsedClass: "toc-collapsed",
        collapsibleClass: "toc-collapsible",
      });

      setReady(true);

      // Keep active TOC item centered in the sidebar
      let lastActive = "";
      let scrollTimer: ReturnType<typeof setTimeout> | null = null;
      const centerActive = () => {
        if (scrollTimer) clearTimeout(scrollTimer);
        // Delay to let tocbot finish DOM updates
        scrollTimer = setTimeout(() => {
          const container = document.querySelector(".js-toc-scroll") as HTMLElement;
          const active = container?.querySelector(".toc-active") as HTMLElement;
          if (!container || !active) return;
          const id = active.getAttribute("href") || "";
          if (id === lastActive) return;
          lastActive = id;
          // Calculate position to center active item
          const containerH = container.clientHeight;
          const activePos = active.offsetTop - container.offsetTop;
          const target = activePos - containerH / 2 + active.offsetHeight / 2;
          container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
        }, 50);
      };
      window.addEventListener("scroll", centerActive, { passive: true });
      (window as any).__tocCleanup = () => {
        window.removeEventListener("scroll", centerActive);
        if (scrollTimer) clearTimeout(scrollTimer);
      };
    };

    // Wait for article headings to render
    const timer = setTimeout(init, 400);

    return () => {
      clearTimeout(timer);
      tocbotInstance?.destroy();
      (window as any).__tocCleanup?.();
    };
  }, []);

  // Also init mobile TOC
  useEffect(() => {
    if (!mobileOpen || !ready) return;
    let tocbotMobile: typeof import("tocbot") | null = null;

    const initMobile = async () => {
      const tocbot = await import("tocbot");
      tocbotMobile = tocbot;
      tocbot.refresh({
        tocSelector: ".js-toc-mobile",
        contentSelector: "article",
        headingSelector: "h1, h2, h3",
        hasInnerContainers: true,
        scrollSmooth: true,
        scrollSmoothOffset: -80,
        headingsOffset: 100,
        collapseDepth: 6,
        orderedList: false,
        activeLinkClass: "toc-active",
        listClass: "toc-list",
        linkClass: "toc-link",
      });
    };

    initMobile();
    return () => { tocbotMobile = null; };
  }, [mobileOpen, ready]);

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden xl:block fixed top-28 right-[max(0.5rem,calc((100vw-82rem)/2))] w-64 z-30 max-h-[calc(100vh-8rem)]">
        <div className="rounded-xl border border-border-subtle/50 bg-bg-surface/60 backdrop-blur-xl flex flex-col max-h-[calc(100vh-8rem)]">
          <div className="px-3 pt-3 pb-1 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald mb-2">On this page</p>
            <div className="h-px bg-gradient-to-r from-emerald/20 via-border to-transparent" />
          </div>
          <div className="js-toc js-toc-scroll overflow-y-auto overscroll-contain p-2 pt-1 flex-1 relative" />
        </div>
      </aside>

      {/* Mobile: floating button */}
      <div className="xl:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-12 h-12 rounded-full bg-emerald text-white shadow-lg shadow-emerald/25 flex items-center justify-center cursor-pointer hover:bg-emerald/90 transition-all duration-200 hover:scale-105"
          aria-label="Table of contents"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <List className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="xl:hidden fixed inset-0 z-30" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute right-0 top-0 bottom-0 w-72 bg-bg/95 backdrop-blur-2xl border-l border-border-subtle p-4 pt-20 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald mb-2">On this page</p>
            <div className="h-px bg-gradient-to-r from-emerald/20 via-border to-transparent mb-3" />
            <div className="js-toc-mobile" />
          </div>
        </div>
      )}
    </>
  );
}
