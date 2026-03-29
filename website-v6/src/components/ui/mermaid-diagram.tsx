"use client";

import { useEffect, useRef, useState } from "react";

let mermaidInitialized = false;

export function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mermaid = (await import("mermaid" as any)).default;

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            themeVariables: {
              primaryColor: "#10b981",
              primaryTextColor: "#e0e0e0",
              primaryBorderColor: "#10b981",
              lineColor: "#6366f1",
              secondaryColor: "#7c3aed",
              tertiaryColor: "#06b6d4",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: "13px",
              nodeBorder: "#10b981",
              mainBkg: "#1a1a2e",
              textColor: "#e0e0e0",
              labelTextColor: "#e0e0e0",
              actorTextColor: "#e0e0e0",
              actorBkg: "#1a1a2e",
              actorBorder: "#10b981",
              signalColor: "#6366f1",
              noteBkgColor: "#2a2a4a",
              noteTextColor: "#e0e0e0",
              noteBorderColor: "#6366f1",
            },
            flowchart: { curve: "basis", htmlLabels: true },
            sequence: { mirrorActors: false },
            mindmap: { padding: 16 },
          });
          mermaidInitialized = true;
        }

        // Clean the chart text
        const cleaned = chart.trim();
        const { svg: rendered } = await mermaid.render(idRef.current, cleaned);
        if (!cancelled) setSvg(rendered);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to render diagram");
      }
    })();

    return () => { cancelled = true; };
  }, [chart]);

  if (error) {
    return (
      <div className="my-4 rounded-xl border border-rose/20 bg-rose/[0.04] p-4 overflow-x-auto">
        <p className="text-[11px] text-rose font-medium mb-2">Diagram render error</p>
        <pre className="text-[12px] text-fg-muted leading-relaxed whitespace-pre-wrap">{chart}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 rounded-xl border border-border bg-bg/80 p-8 text-center">
        <div className="text-[12px] text-fg-dim animate-pulse">Rendering diagram...</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-4 rounded-xl border border-indigo/15 bg-[#0d0d1a] p-4 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
