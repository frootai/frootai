import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, KeyRound, Link2, RotateCcw, Send, Square } from "lucide-react";
import type { AccountView } from "../types";
import { vscode } from "../vscode";

const SUGGESTIONS = ["I want to build a production RAG system", "Recommend a Solution Play for a multi-agent service", "How should I evaluate this AI workspace?", "Which MCP tools fit my architecture?"];
type Message = { role: "user" | "assistant"; content: string; createdAt: string; citations?: Citation[] };
type Citation = { label: string; detail: string | null; href: string | null };
type ThinkingPhase = "grounding" | "retrieving" | "responding";

export default function AgentFai({ initialMessages = [], account: initialAccount }: { initialMessages?: Message[]; account?: AccountView }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [account, setAccount] = useState<AccountView>(initialAccount ?? { configured: false, status: "disconnected", redacted: null, lastError: null });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase>("grounding");
  const [streamingText, setStreamingText] = useState("");
  const streamingRef = useRef("");
  const endRef = useRef<HTMLDivElement>(null);
  const apiKeyRequired = !account.configured || account.status === "invalid";

  useEffect(() => { if (typeof endRef.current?.scrollIntoView === "function") endRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages, phase, streamingText]);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const message = event.data;
      if (!message) return;
      if (message.type === "agentFaiState") {
        if (Array.isArray(message.messages)) setMessages(message.messages);
        if (message.account) setAccount(message.account);
      }
      if (message.type === "agentFaiStarted") {
        streamingRef.current = ""; setStreamingText(""); setLoading(true); setThinkingPhase("grounding");
        setPhase(message.message ?? "Searching FrootAI products, Solution Plays, and grounded evidence…");
      }
      if (message.type === "agentFaiThinking") {
        setThinkingPhase(message.phase ?? "retrieving"); setPhase(message.message ?? "Agent FAI is reasoning from grounded evidence…");
      }
      if (message.type === "agentFaiChunk" && typeof message.content === "string") {
        streamingRef.current += message.content; setStreamingText(streamingRef.current); setThinkingPhase("responding");
      }
      if (message.type === "agentFaiCompleted" || message.type === "agentFaiResponse") {
        setMessages((current) => [...current, { role: "assistant", content: message.reply, createdAt: new Date().toISOString(), citations: message.citations ?? [] }]);
        streamingRef.current = ""; setStreamingText(""); setLoading(false); setPhase("");
      }
      if (message.type === "agentFaiError") {
        setMessages((current) => [...current, { role: "assistant", content: `Agent FAI could not complete this request: ${message.message}`, createdAt: new Date().toISOString() }]);
        if (message.account) setAccount(message.account);
        streamingRef.current = ""; setStreamingText(""); setLoading(false); setPhase("");
      }
      if (message.type === "agentFaiCancelled") {
        const partial = typeof message.partial === "string" && message.partial.trim() ? message.partial : streamingRef.current;
        if (partial) setMessages((current) => [...current, { role: "assistant", content: partial, createdAt: new Date().toISOString() }]);
        streamingRef.current = ""; setStreamingText(""); setLoading(false); setPhase("Response stopped.");
      }
      if (message.type === "agentFaiReset") { streamingRef.current = ""; setStreamingText(""); setMessages([]); setLoading(false); setPhase(""); }
    };
    window.addEventListener("message", listener);
    vscode.postMessage({ command: "agentFaiReady" });
    return () => window.removeEventListener("message", listener);
  }, []);

  const handleClick = useCallback((event: React.MouseEvent) => {
    const link = (event.target as HTMLElement).closest("a[data-fai]") as HTMLElement | null;
    if (!link) return;
    event.preventDefault();
    const type = link.dataset.fai;
    let arg = link.dataset.arg ?? "";
    try { arg = decodeURIComponent(arg); } catch { return; }
    if (type === "play") vscode.postMessage({ command: "openPlay", playId: arg });
    else if (type === "primitive") { const [primitiveType, ...parts] = arg.split("/"); vscode.postMessage({ command: "openPrimitive", primitiveType, primitiveId: parts.join("/") }); }
    else if (type === "route") vscode.postMessage({ command: "workbenchNavigate", route: arg });
    else if (type === "configurator") vscode.postMessage({ command: "openConfigurator" });
    else if (type === "browse") vscode.postMessage({ command: "browsePlays" });
    else if (type === "primitives") vscode.postMessage({ command: "openPrimitives", primitiveType: arg });
    else if (type === "marketplace") vscode.postMessage({ command: "openMarketplace" });
    else if (type === "external") vscode.postMessage({ command: "openUrl", url: arg });
  }, []);

  const send = (value: string) => {
    const text = value.trim();
    if (!text || loading) return;
    if (!account.configured) { vscode.postMessage({ command: "account" }); return; }
    setMessages((current) => [...current, { role: "user", content: text, createdAt: new Date().toISOString() }]);
    setInput(""); setLoading(true); setPhase("Searching Plays, products, primitives, and workspace context…");
    vscode.postMessage({ command: "sendAgentFai", text });
  };

  return (
    <main className="fai-agent-shell" onClick={handleClick}>
      <header className="fai-agent-header">
        <div className="fai-agent-identity"><span><Bot size={18} /></span><div><strong>Agent FAI</strong><small>Persistent workspace copilot · grounded in the FAI product system</small></div></div>
        <div className="fai-agent-controls">
          <button className="btn btn-secondary btn-sm" onClick={() => vscode.postMessage({ command: "account" })}><KeyRound size={12} /> {account.configured ? account.status : "Connect account"}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => vscode.postMessage({ command: "resetAgentFai" })}><RotateCcw size={12} /> New chat</button>
        </div>
      </header>
      <section className="fai-agent-messages" aria-live="polite">
        {!messages.length && <div className="fai-agent-empty"><p className="fai-eyebrow">Ask → evidence → native action</p><h1>What should we build?</h1><p>Agent FAI can recommend Solution Plays, explain architecture, connect products, and return links that open directly inside this VS Code workbench.</p><div>{SUGGESTIONS.map((suggestion) => <button key={suggestion} onClick={() => send(suggestion)}>{suggestion}</button>)}</div></div>}
        {messages.map((message, index) => <article key={`${message.createdAt}-${index}`} className={`fai-agent-message ${message.role}`}><span>{message.role === "user" ? "YOU" : "FAI"}</span><div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />{Boolean(message.citations?.length) && <div className="fai-agent-citations">{message.citations!.map((citation, citationIndex) => <button key={`${citation.label}-${citationIndex}`} onClick={() => openCitation(citation)}><Link2 size={11} /><span><strong>{citation.label}</strong>{citation.detail && <small>{citation.detail}</small>}</span>{citation.href && <ExternalLink size={10} />}</button>)}</div>}</article>)}
        {streamingText && <article className="fai-agent-message assistant streaming" aria-label="Agent FAI streaming response"><span>FAI</span><div dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingText) }} /><i className="fai-stream-cursor" aria-hidden="true" /></article>}
        {loading && <ThinkingIndicator phase={thinkingPhase} message={phase} compact={Boolean(streamingText)} />}
        {!loading && phase && <div className="fai-agent-phase">{phase}</div>}
        {apiKeyRequired && <section className="fai-agent-key-required" aria-labelledby="fai-agent-key-required-title"><span><KeyRound size={22} /></span><p className="fai-eyebrow">Hosted Agent FAI</p><h2 id="fai-agent-key-required-title">API key required</h2><p>{account.status === "invalid" ? "The stored key is no longer valid. Create or enter a current key to continue this conversation." : "Sign in to create a personal FrootAI API key, or enter one you already have."}</p><div className="fai-agent-key-actions"><button className="btn" onClick={() => vscode.postMessage({ command: "accountSignIn" })}>Sign in &amp; create key <ExternalLink size={13} /></button><button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "accountSetKey" })}><KeyRound size={14} /> {account.status === "invalid" ? "Replace API key" : "Enter API key"}</button></div></section>}
        <div ref={endRef} />
      </section>
      <footer className="fai-agent-composer">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(input); } }} placeholder={account.configured ? "Ask Agent FAI about this workspace…" : "Connect your account to use hosted Agent FAI"} disabled={loading} aria-label="Ask Agent FAI" />
        {loading ? <button className="btn" onClick={() => vscode.postMessage({ command: "cancelAgentFai" })}><Square size={13} /> Stop</button> : <button className="btn" disabled={!input.trim()} onClick={() => send(input)}><Send size={13} /> Send</button>}
      </footer>
    </main>
  );

  function openCitation(citation: Citation): void {
    if (!citation.href) return;
    const match = /^https?:\/\/(?:www\.)?frootai\.dev\/solution-plays\/(\d{1,3})-[a-z0-9-]+/i.exec(citation.href);
    if (match) vscode.postMessage({ command: "openPlay", playId: match[1].padStart(2, "0") });
    else {
      const primitive = /^https?:\/\/(?:www\.)?frootai\.dev\/primitives\/(agents|skills|instructions|hooks|plugins)[\/#]([^?#]+)/i.exec(citation.href);
      if (primitive) vscode.postMessage({ command: "openPrimitive", primitiveType: primitive[1], primitiveId: primitive[2] });
      else {
        const plugin = /^https?:\/\/(?:www\.)?frootai\.dev\/marketplace[#/]([^?#/]+)/i.exec(citation.href);
        if (plugin) vscode.postMessage({ command: "openPrimitive", primitiveType: "plugins", primitiveId: plugin[1] });
        else vscode.postMessage({ command: "openUrl", url: citation.href });
      }
    }
  }
}

const THINKING_STAGES: Array<{ id: ThinkingPhase; label: string }> = [
  { id: "grounding", label: "Ground" },
  { id: "retrieving", label: "Retrieve" },
  { id: "responding", label: "Respond" },
];

function ThinkingIndicator({ phase, message, compact }: { phase: ThinkingPhase; message: string; compact: boolean }) {
  const activeIndex = THINKING_STAGES.findIndex((stage) => stage.id === phase);
  return <div className={`fai-thinking ${compact ? "compact" : ""}`} role="status" aria-label={`Agent FAI thinking: ${message}`}>
    <div className="fai-thinking-dots" aria-hidden="true"><span /><span /><span /></div>
    <div><strong>{compact ? "Grounded response streaming" : <>Agent FAI is thinking<span className="fai-thinking-caret" aria-hidden="true" /></>}</strong><p>{message}</p><ol aria-hidden="true">{THINKING_STAGES.map((stage, index) => <li key={stage.id} className={index < activeIndex ? "complete" : index === activeIndex ? "active" : ""}><span />{stage.label}</li>)}</ol></div>
  </div>;
}

export function renderMarkdown(markdown: string): string {
  return markdown
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```\w*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^### (.+)$/gm, "<h4>$1</h4>").replace(/^## (.+)$/gm, "<h3>$1</h3>").replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(https?:\/\/(?:www\.)?frootai\.dev\/solution-plays\/(\d{1,3})-[^)]+\)/g, (_all, label, id) => nativeLink(label, "play", id))
    .replace(/\[([^\]]+)\]\(\/solution-plays\/(\d{1,3})-[^)]+\)/g, (_all, label, id) => nativeLink(label, "play", id))
    .replace(/\[([^\]]+)\]\(\/solution-plays\)/g, '<a href="#" data-fai="browse">$1</a>')
    .replace(/\[([^\]]+)\]\(\/configurator\)/g, '<a href="#" data-fai="configurator">$1</a>')
    .replace(/\[([^\]]+)\]\(https?:\/\/(?:www\.)?frootai\.dev\/primitives\/(agents|skills|instructions|hooks|plugins)[\/#]([^\s)]+)\)/g, (_all, label, type, id) => nativeLink(label, "primitive", `${type}/${id}`))
    .replace(/\[([^\]]+)\]\(\/primitives\/(agents|skills|instructions|hooks|plugins)[\/#]([^\s)]+)\)/g, (_all, label, type, id) => nativeLink(label, "primitive", `${type}/${id}`))
    .replace(/\[([^\]]+)\]\(\/primitives(?:\/(agents|skills|instructions|hooks|plugins))?[^)]*\)/g, (_all, label, type) => nativeLink(label, "primitives", type ?? ""))
    .replace(/\[([^\]]+)\]\(https?:\/\/(?:www\.)?frootai\.dev\/marketplace[#/]([^\s)]+)\)/g, (_all, label, id) => nativeLink(label, "primitive", `plugins/${id}`))
    .replace(/\[([^\]]+)\]\(\/marketplace[#/]([^\s)]+)\)/g, (_all, label, id) => nativeLink(label, "primitive", `plugins/${id}`))
    .replace(/\[([^\]]+)\]\(\/marketplace\)/g, '<a href="#" data-fai="marketplace">$1</a>')
    .replace(/\[([^\]]+)\]\(\/(docs(?:\/[^)]+)?|glossary|mcp-tooling|solution-accelerator(?:\/[^)]+)?)\)/g, (_all, label, route) => nativeLink(label, "route", `/${route}`))
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_all, label, url) => trustedExternalLink(label, url))
    .replace(/^- (.+)$/gm, "<li>$1</li>").replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
}

function nativeLink(label: string, type: string, argument: string): string { return `<a href="#" data-fai="${type}" data-arg="${encodeURIComponent(argument)}">${label}</a>`; }

function trustedExternalLink(label: string, value: string): string {
  try {
    const url = new URL(value.split("&amp;").join("&"));
    const host = url.hostname.toLowerCase();
    if ((host === "frootai.dev" || host === "www.frootai.dev") && url.pathname === "/docs/partner-onboarding") url.pathname = "/partners";
    const trusted = url.protocol === "https:" && (host === "frootai.dev" || host === "www.frootai.dev" || host === "github.com" || host === "learn.microsoft.com" || host === "azure.microsoft.com");
    return trusted ? `${nativeLink(label, "external", url.toString())} <span>↗</span>` : label;
  } catch { return label; }
}
