"use client";

import { useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "@/components/ui/mermaid-diagram";
import { AlertTriangle, Info, Lightbulb, MessageCircleWarning, Flame } from "lucide-react";

// ─── Admonition styling ────────────────────────────────────────
const ADMONITION_STYLES: Record<string, { icon: React.ReactNode; border: string; bg: string; titleColor: string }> = {
  tip:     { icon: <Lightbulb className="h-4 w-4 shrink-0" />, border: "border-emerald/30", bg: "bg-emerald/[0.04]", titleColor: "text-emerald" },
  note:    { icon: <Info className="h-4 w-4 shrink-0" />,      border: "border-indigo/30",  bg: "bg-indigo/[0.04]",  titleColor: "text-indigo" },
  info:    { icon: <Info className="h-4 w-4 shrink-0" />,      border: "border-cyan/30",    bg: "bg-cyan/[0.04]",    titleColor: "text-cyan" },
  warning: { icon: <AlertTriangle className="h-4 w-4 shrink-0" />, border: "border-amber/30", bg: "bg-amber/[0.04]", titleColor: "text-amber" },
  caution: { icon: <MessageCircleWarning className="h-4 w-4 shrink-0" />, border: "border-orange/30", bg: "bg-orange/[0.04]", titleColor: "text-orange" },
  danger:  { icon: <Flame className="h-4 w-4 shrink-0" />,    border: "border-rose/30",    bg: "bg-rose/[0.04]",    titleColor: "text-rose" },
};

function Admonition({ type, title, children }: { type: string; title: string; children: React.ReactNode }) {
  const style = ADMONITION_STYLES[type] || ADMONITION_STYLES.note;
  return (
    <div className={`my-4 rounded-xl border-l-4 ${style.border} ${style.bg} px-4 py-3`}>
      <div className={`flex items-center gap-2 font-bold text-[13px] ${style.titleColor} mb-1`}>
        {style.icon}
        {title || type.charAt(0).toUpperCase() + type.slice(1)}
      </div>
      <div className="text-[13px] leading-[1.7] text-fg-muted [&>p]:my-1">{children}</div>
    </div>
  );
}

// ─── Preprocessing: convert Docusaurus syntax to HTML markers ──
function preprocessContent(raw: string): string {
  // Normalize Windows line endings
  let content = raw.replace(/\r\n/g, '\n');

  // Strip YAML frontmatter (only if file starts with ---) 
  if (content.startsWith("---\n")) {
    const end = content.indexOf("\n---", 4);
    if (end > 0) {
      content = content.substring(end + 4).replace(/^\n+/, "");
    }
  }

  // Strip manually-written "## Table of Contents" sections from markdown
  // These exist in 6 docs and duplicate the auto-generated sidebar TOC
  content = content.replace(/^## Table of Contents\n[\s\S]*?(?=\n## |\n---)/gm, "");

  // Convert Docusaurus admonitions to blockquote-based markers
  // :::type Title\ncontent\n::: → > [!type] Title\n> content
  // This keeps everything in pure markdown so remark-gfm tables aren't broken
  content = content.replace(
    /^:::(\w+)\s*(.*)\n([\s\S]*?)\n^:::\s*$/gm,
    (_match, type, title, body) => {
      const titleText = (title || "").trim();
      const prefix = `> **[${type.toUpperCase()}]${titleText ? ` ${titleText}` : ""}**\n`;
      const bodyLines = body.trim().split("\n").map((l: string) => `> ${l}`).join("\n");
      return `${prefix}>\n${bodyLines}`;
    }
  );

  // Convert <details><summary>...</summary>...</details> to a markdown-friendly format
  // Replace with a blockquote marker that our component can detect
  content = content.replace(
    /<details>\s*<summary>(.*?)<\/summary>([\s\S]*?)<\/details>/gi,
    (_match, summary, body) => {
      const trimmedBody = body.trim();
      return `> **[DETAILS] ${summary.trim()}**\n>\n${trimmedBody.split('\n').map((l: string) => `> ${l}`).join('\n')}`;
    }
  );

  return content;
}

// ─── Heading anchor IDs ────────────────────────────────────────
function toId(children: React.ReactNode): string {
  const text = typeof children === "string" ? children
    : Array.isArray(children) ? children.map(c => typeof c === "string" ? c : c?.props?.children || "").join("")
    : String(children || "");
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '').replace(/^-+/, '');
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const components: Record<string, React.FC<any>> = {
  h1: ({ children }: any) => <h1 id={toId(children)} className="text-2xl font-extrabold mt-10 mb-4 tracking-tight scroll-mt-24">{children}</h1>,
  h2: ({ children }: any) => <h2 id={toId(children)} className="text-xl font-bold mt-8 mb-3 tracking-tight border-b border-border-subtle pb-2 scroll-mt-24">{children}</h2>,
  h3: ({ children }: any) => <h3 id={toId(children)} className="text-lg font-bold mt-6 mb-2 scroll-mt-24">{children}</h3>,
  h4: ({ children }: any) => <h4 id={toId(children)} className="text-base font-semibold mt-4 mb-1.5 text-fg-muted scroll-mt-24">{children}</h4>,
  p: ({ children }: any) => <p className="my-3 text-[14px] leading-[1.8] text-fg-muted">{children}</p>,
  a: ({ href, children }: any) => <a href={href} className="text-amber hover:underline font-medium" target="_blank" rel="noopener noreferrer">{children}</a>,
  strong: ({ children }: any) => <strong className="font-bold text-fg">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  ul: ({ children }: any) => <ul className="my-3 pl-5 space-y-1 list-disc">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-3 pl-5 space-y-1 list-decimal">{children}</ol>,
  li: ({ children }: any) => <li className="text-[14px] leading-relaxed text-fg-muted">{children}</li>,
  blockquote: ({ children }: any) => {
    // Detect admonition blockquotes: first child is a <p> with <strong>[TYPE] Title</strong>
    const firstChild = Array.isArray(children) ? children.find((c: any) => c?.type === "p" || c?.props?.children) : null;
    const firstText = firstChild?.props?.children;
    // Check for [TYPE] pattern in the strong element
    let admonType = "";
    let admonTitle = "";
    if (firstText) {
      const strongEl = Array.isArray(firstText) ? firstText.find((c: any) => c?.type === "strong" || c?.props?.children) : firstText;
      const strongText = typeof strongEl?.props?.children === "string" ? strongEl.props.children : "";
      const match = strongText.match(/^\[(\w+)\]\s*(.*)/);
      if (match) {
        admonType = match[1].toLowerCase();
        admonTitle = match[2] || admonType.charAt(0).toUpperCase() + admonType.slice(1);
      }
    }
    if (admonType && admonType === "details") {
      const rest = Array.isArray(children) ? children.filter((_: any, i: number) => i !== children.indexOf(firstChild)) : children;
      return (
        <details className="my-4 rounded-xl border border-border bg-bg-surface/50 overflow-hidden">
          <summary className="px-4 py-3 text-[13px] font-semibold text-fg cursor-pointer hover:bg-bg-hover transition-colors select-none">{admonTitle}</summary>
          <div className="px-4 pb-3 text-[13px] leading-[1.7] text-fg-muted [&>p]:my-1">{rest}</div>
        </details>
      );
    }
    if (admonType && ADMONITION_STYLES[admonType]) {
      const style = ADMONITION_STYLES[admonType];
      // Remove the first paragraph (the [TYPE] Title marker)
      const rest = Array.isArray(children) ? children.filter((_: any, i: number) => i !== children.indexOf(firstChild)) : children;
      return (
        <div className={`my-4 rounded-xl border-l-4 ${style.border} ${style.bg} px-4 py-3`}>
          <div className={`flex items-center gap-2 font-bold text-[13px] ${style.titleColor} mb-1`}>
            {style.icon}
            {admonTitle}
          </div>
          <div className="text-[13px] leading-[1.7] text-fg-muted [&>p]:my-1">{rest}</div>
        </div>
      );
    }
    return <blockquote className="my-4 border-l-3 border-amber pl-4 text-fg-muted italic bg-amber/[0.03] rounded-r-lg py-2 pr-3">{children}</blockquote>;
  },
  code: ({ children, className, node }: any) => {
    const lang = className?.replace("language-", "") || "";
    const text = typeof children === "string" ? children : String(children || "");

    // Mermaid diagrams
    if (lang === "mermaid") {
      return <MermaidDiagram chart={text} />;
    }

    // Block code: has a language class OR parent is <pre>
    const isBlock = className?.includes("language-") || node?.position;
    if (isBlock && (lang || text.includes("\n"))) {
      return (
        <pre className="my-4 rounded-xl border border-border bg-[#0a0a14] p-4 overflow-x-auto text-[12.5px] leading-[1.7] font-mono max-h-[500px] overflow-y-auto overscroll-contain">
          {lang && <span className="block text-[10px] text-fg-dim uppercase tracking-wider mb-2 pb-1 border-b border-border-subtle">{lang}</span>}
          <code>{children}</code>
        </pre>
      );
    }

    return (
      <code className="rounded bg-indigo/10 px-1.5 py-0.5 text-[13px] text-indigo font-mono">{children}</code>
    );
  },
  pre: ({ children }: any) => <>{children}</>,
  table: ({ children }: any) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-[13px] leading-relaxed border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="border-b-2 border-emerald/25 bg-bg-surface">{children}</thead>,
  th: ({ children }: any) => <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-emerald">{children}</th>,
  td: ({ children }: any) => <td className="px-4 py-2 border-t border-border-subtle text-fg-muted">{children}</td>,
  hr: () => <hr className="my-6 border-border" />,
  img: ({ src, alt }: any) => <img src={src} alt={alt || ""} className="my-4 rounded-xl max-w-full" />,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export function DocContent({ content }: { content: string }) {
  const processed = useMemo(() => preprocessContent(content), [content]);
  return (
    <article className="max-w-none">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {processed}
      </Markdown>
    </article>
  );
}
