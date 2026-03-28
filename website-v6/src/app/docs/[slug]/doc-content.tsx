"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Generate anchor ID from heading text (matches search index toHash)
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
  blockquote: ({ children }: any) => <blockquote className="my-4 border-l-3 border-amber pl-4 text-fg-muted italic bg-amber/[0.03] rounded-r-lg py-2 pr-3">{children}</blockquote>,
  code: ({ children, className }: any) => {
    const isBlock = className?.includes("language-");
    return isBlock ? (
      <pre className="my-4 rounded-xl border border-border bg-bg/80 p-4 overflow-x-auto text-[13px] leading-relaxed"><code>{children}</code></pre>
    ) : (
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
  return (
    <article className="max-w-none">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </article>
  );
}
