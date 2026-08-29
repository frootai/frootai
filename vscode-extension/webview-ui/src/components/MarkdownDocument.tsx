import type { ReactNode } from "react";
import MermaidDiagram from "./MermaidDiagram";
import { vscode } from "../vscode";

type Block =
  | { type: "heading"; depth: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; language: string; content: string }
  | { type: "table"; rows: string[][] }
  | { type: "rule" };

export default function MarkdownDocument({ markdown, onNavigate, diagramProvenance = "canonical" }: { markdown: string; onNavigate?: (route: string) => void; diagramProvenance?: "canonical" | "generated" }) {
  const blocks = parseMarkdown(markdown);
  return <article className="fai-doc-markdown">
    {blocks.map((block, index) => {
      if (block.type === "heading") {
        const id = slugify(block.text);
        if (block.depth === 1) return <h1 id={id} key={index}>{inline(block.text, onNavigate)}</h1>;
        if (block.depth === 2) return <h2 id={id} key={index}>{inline(block.text, onNavigate)}</h2>;
        if (block.depth === 3) return <h3 id={id} key={index}>{inline(block.text, onNavigate)}</h3>;
        return <h4 id={id} key={index}>{inline(block.text, onNavigate)}</h4>;
      }
      if (block.type === "paragraph") return <p key={index}>{inline(block.text, onNavigate)}</p>;
      if (block.type === "quote") return <blockquote key={index}>{inline(block.text, onNavigate)}</blockquote>;
      if (block.type === "rule") return <hr key={index} />;
      if (block.type === "list") {
        const items = block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, onNavigate)}</li>);
        return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
      }
      if (block.type === "table") return <div className="fai-doc-table-wrap" key={index}><table><caption style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>Structured architecture and reference data</caption><thead><tr>{block.rows[0].map((cell, cellIndex) => <th scope="col" key={cellIndex}>{inline(cell, onNavigate)}</th>)}</tr></thead><tbody>{block.rows.slice(1).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{inline(cell, onNavigate)}</td>)}</tr>)}</tbody></table></div>;
      if (block.language === "mermaid") return <MermaidDiagram key={index} chart={block.content} provenance={diagramProvenance} />;
      return <div className="fai-doc-code" key={index}><span>{block.language || "code"}</span><pre><code>{block.content}</code></pre></div>;
    })}
  </article>;
}

export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length && blocks.length < 1_500) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const fence = line.match(/^\s*```([^\s`]*)/);
    if (fence) {
      const content: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) { content.push(lines[index]); index += 1; }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", language: fence[1].toLowerCase(), content: content.join("\n") });
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { blocks.push({ type: "heading", depth: heading[1].length, text: heading[2].replace(/\s+#+$/, "") }); index += 1; continue; }
    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) { blocks.push({ type: "rule" }); index += 1; continue; }
    if (/^>\s?/.test(line)) {
      const parts: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) { parts.push(lines[index].replace(/^>\s?/, "")); index += 1; }
      blocks.push({ type: "quote", text: parts.join(" ") }); continue;
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line); const items: string[] = [];
      const matcher = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
      while (index < lines.length && matcher.test(lines[index])) { items.push(lines[index].replace(matcher, "")); index += 1; }
      blocks.push({ type: "list", ordered, items }); continue;
    }
    if (/^\s*\|.+\|\s*$/.test(line) && index + 1 < lines.length && /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[index + 1])) {
      const rows: string[][] = [splitTableRow(line)]; index += 2;
      while (index < lines.length && /^\s*\|.+\|\s*$/.test(lines[index])) { rows.push(splitTableRow(lines[index])); index += 1; }
      blocks.push({ type: "table", rows }); continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index], lines[index + 1])) { paragraph.push(lines[index].trim()); index += 1; }
    if (!paragraph.length) { paragraph.push(lines[index].trim()); index += 1; }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

function isBlockStart(line: string, next = ""): boolean {
  return /^\s*```/.test(line) || /^(#{1,4})\s+/.test(line) || /^>\s?/.test(line) || /^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line) || /^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line) || (/^\s*\|.+\|\s*$/.test(line) && /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/.test(next));
}

function splitTableRow(row: string): string[] { return row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()); }
function slugify(value: string): string { return value.toLowerCase().replace(/[`*_]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function inline(text: string, onNavigate?: (route: string) => void): ReactNode[] {
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  const result: ReactNode[] = []; let cursor = 0; let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) result.push(text.slice(cursor, match.index));
    if (match[2] && match[3]) {
      const href = match[3]; const label = match[2];
      result.push(<a key={`${match.index}-${href}`} href="#" onClick={(event) => { event.preventDefault(); openLink(href, onNavigate); }}>{label}</a>);
    } else if (match[4]) result.push(<code key={match.index}>{match[4]}</code>);
    else if (match[5]) result.push(<strong key={match.index}>{match[5]}</strong>);
    else if (match[6]) result.push(<em key={match.index}>{match[6]}</em>);
    cursor = pattern.lastIndex;
  }
  if (cursor < text.length) result.push(text.slice(cursor));
  return result;
}

function openLink(href: string, onNavigate?: (route: string) => void): void {
  const normalized = href.replace(/^https?:\/\/(?:www\.)?frootai\.dev/i, "");
  if (normalized.startsWith("/docs/")) { routeOrPost(normalized, href, onNavigate); return; }
  if (normalized === "/docs" || normalized.startsWith("/glossary") || normalized.startsWith("/solution-plays") || normalized.startsWith("/solution-accelerator") || normalized.startsWith("/mcp-tooling") || normalized.startsWith("/primitives")) { routeOrPost(normalized, href, onNavigate); return; }
  if (href.startsWith("#")) { document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" }); return; }
  if (/^https:\/\//i.test(href)) vscode.postMessage({ command: "openUrl", url: href });
}

function routeOrPost(route: string, href: string, onNavigate?: (route: string) => void): void {
  if (onNavigate) onNavigate(route); else vscode.postMessage({ command: "openUrl", url: href.startsWith("http") ? href : `https://www.frootai.dev${route}` });
}
