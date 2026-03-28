"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send } from "lucide-react";
import { GlowPill } from "@/components/ui/glow-pill";

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS — matching production chatbot.tsx exactly
   ═══════════════════════════════════════════════════════════════════ */

const CHAT_API = "https://frootai-chatbot-api.azurewebsites.net/api/chat";
const STREAM_API = "https://frootai-chatbot-api.azurewebsites.net/api/chat/stream";

const SUGGESTIONS = [
  "Which play should I use for building a RAG pipeline?",
  "How do I get started with FrootAI?",
  "Compare gpt-4o vs gpt-4.1 for my use case",
  "How much will an AI agent solution cost per month?",
  "What is the .github Agentic OS?",
  "How do I set up the MCP server?",
];

function getFollowUps(lastReply: string): string[] {
  const r = lastReply.toLowerCase();
  if (r.includes("play 01") || r.includes("rag")) return ["How do I deploy Play 01?", "What chunking strategy should I use?", "Compare Play 01 vs Play 09"];
  if (r.includes("play 03") || r.includes("deterministic")) return ["How do guardrails work in Play 03?", "Can I combine Play 03 with Play 07?", "What is temperature=0?"];
  if (r.includes("play 07") || r.includes("multi-agent")) return ["How does agent handoff work?", "What's the Cosmos DB schema for state?", "Play 07 cost estimate"];
  if (r.includes("play 14") || r.includes("gateway") || r.includes("finops")) return ["How does semantic caching work?", "What's the token metering setup?", "Compare APIM vs custom proxy"];
  if (r.includes("mcp") || r.includes("npx frootai")) return ["List all 22 MCP tools", "How do agent chain tools work?", "What's the model catalog tool?"];
  if (r.includes("devkit") || r.includes("agentic os")) return ["What files are in L1 Always-On?", "How do prompts differ from agents?", "What are skills?"];
  if (r.includes("vs code") || r.includes("extension")) return ["How does Init DevKit work?", "What are the 4 sidebar panels?", "How to auto-chain agents?"];
  if (r.includes("cost") || r.includes("pricing")) return ["Which model is cheapest for classification?", "How to reduce costs with caching?", "Play 14 AI Gateway details"];
  if (r.includes("configurator")) return ["Show me all 20 plays", "Which play for document processing?", "What's the easiest play to start with?"];
  return ["Show me the 20 solution plays", "How do I install the VS Code extension?", "What is the FROOT framework?", "Recommend a play for my team"];
}

const FALLBACK: Record<string, string> = {
  document: "For document processing: **Play 06** (Document Intelligence) or **Play 15** (Multi-Modal DocProc).\n\n[User Guide Play 06](/user-guide?play=06) | [User Guide Play 15](/user-guide?play=15)",
  rag: "For RAG pipelines: **Play 01** (Enterprise RAG Q and A) with AI Search + OpenAI.\n\n[User Guide](/user-guide?play=01) | [All Plays](/solution-plays)",
  agent: "For AI agents: **Play 03** (Deterministic) or **Play 07** (Multi-Agent Service).\n\n[User Guide Play 03](/user-guide?play=03)",
  cost: "RAG: $150-300/mo (dev), $2K-8K (prod). Agent: $100-250 (dev), $1.5K-6K (prod).\n\nPlay 14 covers FinOps. [User Guide](/user-guide?play=14)",
  mcp: "Quick MCP setup: Add to .vscode/mcp.json or run: npx frootai-mcp\n\n[Setup Guide](/setup-guide) | [MCP Tools](/mcp-tooling)",
  start: "1. Try [Configurator](/configurator) 2. Install VS Code Extension 3. Init DevKit 4. Init TuneKit 5. Deploy\n\n[Setup Guide](/setup-guide)",
};

function getFallback(msg: string): string {
  const q = msg.toLowerCase();
  for (const [k, v] of Object.entries(FALLBACK)) { if (q.includes(k)) return v; }
  return "I can help with: solution plays, RAG, agents, costs, MCP setup, getting started.\n\nTry the [Configurator](/configurator) for a guided recommendation.";
}

/* ═══════════════════════════════════════════════════════════════════
   MARKDOWN COMPONENTS — Tailwind-only, rich rendering
   Tables, code blocks, bold, lists, blockquotes, links — ALL styled
   ═══════════════════════════════════════════════════════════════════ */

interface Message { role: "user" | "assistant"; text: string; }

/* eslint-disable @typescript-eslint/no-explicit-any */
const mdComponents: Record<string, React.FC<any>> = {
  a: ({ href, children }: any) => (
    <a href={href || ""} className="text-amber underline font-medium hover:text-gold transition-colors" target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  strong: ({ children }: any) => <strong className="text-gold font-bold">{children}</strong>,
  h2: ({ children }: any) => <h3 className="mt-3 mb-1.5 text-sm font-bold text-amber border-b border-amber/15 pb-1">{children}</h3>,
  h3: ({ children }: any) => <h4 className="mt-2.5 mb-1 text-[13px] font-bold text-gold">{children}</h4>,
  h4: ({ children }: any) => <h5 className="mt-2 mb-1 text-[13px] font-semibold text-fg-muted">{children}</h5>,
  p: ({ children }: any) => <p className="my-1.5 leading-[1.7]">{children}</p>,
  ul: ({ children }: any) => <ul className="my-1 pl-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-1 pl-4 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li className="text-[13px] leading-relaxed">{children}</li>,
  code: ({ children, className }: any) => {
    const isBlock = className?.includes("language-");
    return isBlock ? (
      <pre className="my-2 rounded-lg border border-amber/15 bg-black/40 p-3 overflow-x-auto text-[12px] leading-relaxed">
        <code>{children}</code>
      </pre>
    ) : (
      <code className="rounded bg-amber/10 px-1.5 py-0.5 text-[12px] text-gold font-mono">{children}</code>
    );
  },
  pre: ({ children }: any) => <>{children}</>,
  table: ({ children }: any) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-[12px] leading-relaxed border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="border-b-2 border-amber/30">{children}</thead>,
  th: ({ children }: any) => <th className="px-3 py-2 text-left font-bold text-amber text-[11px] uppercase tracking-wider">{children}</th>,
  td: ({ children }: any) => <td className="px-3 py-1.5 border-b border-border-subtle">{children}</td>,
  blockquote: ({ children }: any) => (
    <blockquote className="my-2 border-l-2 border-amber pl-3 text-fg-muted italic">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-amber/15" />,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════
   CHATBOT CLIENT
   ═══════════════════════════════════════════════════════════════════ */

export function ChatbotClient() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Message[]>([
    { role: "assistant", text: "Hi, I'm **FAI**. Ready to make your journey **frootful**? 🌱\n\n> 🖐️ **New here?** Try [Hi FAI](/hi-fai) — our 5-minute quickstart guide." },
  ]);
  const chatRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current && autoScroll) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [history, autoScroll]);

  // Detect scroll pause
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const handler = () => setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const send = useCallback(async (text?: string) => {
    const message = text || msg;
    if (!message.trim() || loading) return;
    const newH: Message[] = [...history, { role: "user", text: message }];
    setHistory(newH);
    setMsg("");
    setLoading(true);
    setAutoScroll(true);

    // Auto-resize textarea back
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }

    // ── Compute augmentation ──
    let computeContext = "";
    const q = message.toLowerCase();
    try {
      const costMatch = q.match(/(?:cost|price|pricing|how much|estimate|budget).*(?:play|solution)?\s*(\d{1,2})/);
      if (costMatch || q.includes("cost") || q.includes("pricing") || q.includes("how much")) {
        const playNum = costMatch?.[1] || "01";
        const scale = q.includes("prod") || q.includes("production") ? "prod" : "dev";
        const r = await fetch(CHAT_API.replace("/api/chat", "/api/estimate-cost"), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ play: playNum, scale }),
        });
        if (r.ok) {
          const data = await r.json();
          computeContext = `\n\n[COMPUTED DATA — use this in your response]\nCost estimate for Play ${data.play.id} (${data.play.name}) at ${data.scale} scale:\n${data.items.map((i: { service: string; cost: number }) => `- ${i.service}: $${i.cost}/mo`).join("\n")}\nTotal: $${data.total}/mo\n[END COMPUTED DATA]`;
        }
      } else if (q.includes("which play") || q.includes("what play") || q.includes("recommend") || q.includes("find a play") || q.includes("suggest")) {
        const r = await fetch(CHAT_API.replace("/api/chat", "/api/search-plays"), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: message }),
        });
        if (r.ok) {
          const data = await r.json();
          computeContext = `\n\n[COMPUTED DATA — use this in your response]\nSemantic play search results for "${message}":\n${data.results.map((p: { id: string; name: string; score: number; services: string[] }) => `- Play ${p.id}: ${p.name} (${(p.score * 100).toFixed(0)}% match) — ${p.services.join(", ")}`).join("\n")}\n[END COMPUTED DATA]`;
        }
      }
    } catch { /* compute augmentation is optional — GPT works without it */ }

    // ── Streaming ──
    const streamH: Message[] = [...newH, { role: "assistant", text: "" }];
    setHistory(streamH);

    try {
      const msgWithContext = computeContext ? message + computeContext : message;
      const res = await fetch(STREAM_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msgWithContext, history: newH.slice(-10).map(m => ({ role: m.role, content: m.text })) }),
      });
      if (!res.ok || !res.body) throw new Error("API " + res.status);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.content) {
                accumulated += json.content;
                setHistory([...newH, { role: "assistant", text: accumulated }]);
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      }
      if (!accumulated) throw new Error("Empty stream");
    } catch {
      setHistory([...newH, { role: "assistant", text: getFallback(message) }]);
    } finally {
      setLoading(false);
    }
  }, [msg, loading, history]);

  // Follow-ups
  const lastAssistant = [...history].reverse().find(m => m.role === "assistant");
  const followUps = lastAssistant ? getFollowUps(lastAssistant.text) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 relative">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,rgba(245,158,11,0.06),transparent_70%)]" />

      {/* ═══ HERO HEADER ═══ */}
      <div className="text-center mb-6 relative z-10">
        <div className="inline-block px-3.5 py-1 rounded-full border border-amber/25 bg-amber/8 text-[11px] text-amber font-bold uppercase tracking-wider mb-3">
          Powered by Azure OpenAI GPT-4.1
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-gradient-gold sm:text-5xl">
          ✨ Agent FAI
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Your open glue for binding{" "}
          <span className="font-bold text-emerald">Infrastructure</span>,{" "}
          <span className="font-bold text-cyan">Platform</span> &{" "}
          <span className="font-bold text-violet">Application</span> with the Agentic Ecosystem
        </p>
        <p className="mt-1 text-[12px] text-fg-dim italic">From the Roots to the Fruits</p>
      </div>

      {/* ═══ CHAT CONTAINER (glassmorphism) ═══ */}
      <div className="glass rounded-3xl overflow-hidden shadow-2xl shadow-black/30 flex flex-col min-h-[520px] border border-amber/10">

        {/* Messages area */}
        <div ref={chatRef} className="flex-1 px-5 py-5 overflow-y-auto max-h-[600px] space-y-4" style={{ scrollBehavior: "auto" }}>
          {history.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {/* Assistant avatar */}
              {m.role === "assistant" && (
                <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full bg-gradient-to-br from-amber/20 to-indigo/15 border border-amber/30 flex items-center justify-center text-[12px]">
                  ✨
                </div>
              )}
              {/* Message bubble */}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-[1.7] ${
                m.role === "user"
                  ? "bg-amber/8 border border-amber/15 rounded-br-sm"
                  : "bg-white/[0.03] border border-white/[0.06] rounded-bl-sm"
              } ${loading && i === history.length - 1 && m.role === "assistant" ? "streaming-cursor" : ""}`}>
                {m.role === "assistant" ? (
                  <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{m.text}</Markdown>
                ) : m.text}
              </div>
            </div>
          ))}

          {/* Bounce-dot loading */}
          {loading && history[history.length - 1]?.text === "" && (
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-amber/20 to-indigo/15 border border-amber/30 flex items-center justify-center text-[12px]">
                ✨
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="bounce-dot" />
                  <span className="bounce-dot" />
                  <span className="bounce-dot" />
                  <span className="ml-1.5 text-[13px] text-fg-dim">Agent FAI is thinking</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ═══ SUGGESTION CHIPS ═══ */}
        {!loading && (
          <div className="px-5 pb-1.5 flex gap-1.5 flex-wrap">
            {(history.length <= 1 ? SUGGESTIONS : followUps).map((s, i) => (
              <button key={i} onClick={() => send(s)}
                className="rounded-full border border-amber/20 bg-amber/[0.04] px-3 py-1.5 text-[11px] text-amber cursor-pointer transition-all duration-200 hover:bg-amber/[0.12] hover:border-amber/40 hover:-translate-y-0.5 whitespace-nowrap">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* ═══ INPUT ═══ */}
        <div className="flex items-end gap-2.5 px-5 py-4 border-t border-white/[0.04]">
          <textarea
            ref={textareaRef}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 160) + "px";
            }}
            placeholder="Ask anything... (Shift+Enter for new line)"
            rows={1}
            disabled={loading}
            className="flex-1 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-[14px] text-fg outline-none transition-colors duration-200 focus:border-amber/30 focus:bg-white/[0.06] resize-none overflow-hidden min-h-[48px] max-h-[160px] leading-relaxed placeholder:text-fg-dim font-sans"
          />
          <button
            onClick={() => send()}
            disabled={loading || !msg.trim()}
            className="flex-shrink-0 rounded-2xl px-6 py-3 text-[14px] font-bold text-white transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-indigo to-violet shadow-lg shadow-indigo/30 hover:shadow-xl hover:shadow-indigo/40 active:scale-[0.97]"
          >
            {loading ? "..." : (
              <span className="flex items-center gap-1.5">Ask ✨</span>
            )}
          </button>
        </div>
      </div>

      {/* ═══ BOTTOM LINKS ═══ */}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
        <GlowPill href="/configurator" color="#6366f1">Solution Configurator</GlowPill>
        <GlowPill href="/ecosystem" color="#7c3aed">FAI Ecosystem</GlowPill>
        <GlowPill href="/learning-hub" color="#f97316">FAI Learning Center</GlowPill>
      </div>
    </div>
  );
}
