import React, { useState, useRef, useEffect } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./index.module.css";

const CHAT_API_URL = "https://frootai-chatbot-api.azurewebsites.net/api/chat";
const STREAM_API_URL = "https://frootai-chatbot-api.azurewebsites.net/api/chat/stream";
const BASE = ""; // Custom domain — no base path needed
const USE_FALLBACK = true;

const SUGGESTIONS = [
  "Which play should I use for building a RAG pipeline?",
  "How do I get started with FrootAI?",
  "Compare gpt-4o vs gpt-4.1 for my use case",
  "How much will an AI agent solution cost per month?",
  "What is the .github Agentic OS?",
  "How do I set up the MCP server?",
];

// Intelligent follow-up prompts based on last response
function getFollowUps(lastReply: string): string[] {
  const r = lastReply.toLowerCase();
  if (r.includes("play 01") || r.includes("rag")) return ["How do I deploy Play 01?", "What chunking strategy should I use?", "Compare Play 01 vs Play 09"];
  if (r.includes("play 03") || r.includes("deterministic")) return ["How do guardrails work in Play 03?", "Can I combine Play 03 with Play 07?", "What is temperature=0?"];
  if (r.includes("play 07") || r.includes("multi-agent")) return ["How does agent handoff work?", "What's the Cosmos DB schema for state?", "Play 07 cost estimate"];
  if (r.includes("play 14") || r.includes("gateway") || r.includes("finops")) return ["How does semantic caching work?", "What's the token metering setup?", "Compare APIM vs custom proxy"];
  if (r.includes("mcp") || r.includes("npx frootai")) return ["List all 16 MCP tools", "How do agent chain tools work?", "What's the model catalog tool?"];
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

export default function ChatbotPage(): JSX.Element {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{role: string; text: string}>>([
    { role: "assistant", text: "Hi, I'm **FAI**. Ready to make your journey **frootful**? 🌱\n\n> 🖐️ **New here?** Try [Hi FAI](/hi-fai) — our 5-minute quickstart guide." }
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chatRef.current;
    if (el) {
      // Only auto-scroll if user is near the bottom (within 150px)
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [history]);

  // Fix relative links by prepending base path
  const fixHref = (href: string) => {
    if (!href) return href;
    if (href.startsWith("http")) return href;
    if (href.startsWith("/")) return href;
    return href;
  };

  // Custom react-markdown components styled for FrootAI gold/indigo theme
  const mdComponents: Record<string, React.FC<any>> = {
    a: ({ href, children }) => (
      <a href={fixHref(href || "")} style={{ color: "#f59e0b", textDecoration: "underline", fontWeight: 500 }}
        target="_blank" rel="noopener noreferrer">{children}</a>
    ),
    strong: ({ children }) => <strong style={{ color: "#fbbf24" }}>{children}</strong>,
    h2: ({ children }) => <h3 style={{ margin: "14px 0 6px", fontSize: "1rem", fontWeight: 700, color: "#f59e0b", borderBottom: "1px solid rgba(245,158,11,0.15)", paddingBottom: "4px" }}>{children}</h3>,
    h3: ({ children }) => <h4 style={{ margin: "10px 0 4px", fontSize: "0.92rem", fontWeight: 700, color: "#eab308" }}>{children}</h4>,
    h4: ({ children }) => <h5 style={{ margin: "8px 0 4px", fontSize: "0.86rem", fontWeight: 600, color: "#d4d4d8" }}>{children}</h5>,
    p: ({ children }) => <p style={{ margin: "6px 0", lineHeight: 1.7 }}>{children}</p>,
    ul: ({ children }) => <ul style={{ margin: "4px 0", paddingLeft: "18px", listStyleType: "disc" }}>{children}</ul>,
    ol: ({ children }) => <ol style={{ margin: "4px 0", paddingLeft: "18px" }}>{children}</ol>,
    li: ({ children }) => <li style={{ margin: "2px 0", lineHeight: 1.6, fontSize: "0.83rem" }}>{children}</li>,
    code: ({ children, className }) => {
      const isBlock = className?.includes("language-");
      return isBlock ? (
        <pre style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "8px", padding: "12px 14px", margin: "8px 0", overflowX: "auto", fontSize: "0.78rem", lineHeight: 1.5 }}>
          <code>{children}</code>
        </pre>
      ) : (
        <code style={{ background: "rgba(245,158,11,0.1)", padding: "1px 6px", borderRadius: "4px", fontSize: "0.8rem", color: "#fbbf24" }}>{children}</code>
      );
    },
    pre: ({ children }) => <>{children}</>,
    table: ({ children }) => (
      <div style={{ overflowX: "auto", margin: "8px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", lineHeight: 1.5 }}>{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead style={{ borderBottom: "2px solid rgba(245,158,11,0.3)" }}>{children}</thead>,
    th: ({ children }) => <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: "#f59e0b", fontSize: "0.76rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>{children}</th>,
    td: ({ children }) => <td style={{ padding: "5px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{children}</td>,
    blockquote: ({ children }) => (
      <blockquote style={{ margin: "8px 0", borderLeft: "3px solid #f59e0b", paddingLeft: "12px", color: "var(--ifm-color-emphasis-500)", fontStyle: "italic" }}>{children}</blockquote>
    ),
    hr: () => <hr style={{ border: "none", borderTop: "1px solid rgba(245,158,11,0.15)", margin: "12px 0" }} />,
  };

  // Render markdown with react-markdown + GFM (tables, strikethrough)
  const renderMd = (text: string) => (
    <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{text}</Markdown>
  );

  const send = async (text?: string) => {
    const message = text || msg;
    if (!message.trim() || loading) return;
    const newH = [...history, { role: "user", text: message }];
    setHistory(newH); setMsg(""); setLoading(true);

    // Add placeholder for streaming assistant message
    const streamH = [...newH, { role: "assistant", text: "" }];
    setHistory(streamH);

    try {
      const res = await fetch(STREAM_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: newH.slice(-10).map(m => ({ role: m.role, content: m.text })) }),
      });

      if (!res.ok || !res.body) throw new Error("API " + res.status);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.content) {
                accumulated += json.content;
                setHistory([...newH, { role: "assistant", text: accumulated }]);
              }
            } catch {}
          }
        }
      }

      // If streaming produced nothing, use fallback
      if (!accumulated) throw new Error("Empty stream");
    } catch {
      setHistory([...newH, { role: "assistant", text: USE_FALLBACK ? getFallback(message) : "Could not reach AI service. Try: npx frootai-mcp" }]);
    }
    finally { setLoading(false); }
  };

  // Get the last assistant message for follow-ups
  const lastAssistant = [...history].reverse().find(m => m.role === "assistant");
  const followUps = lastAssistant ? getFollowUps(lastAssistant.text) : [];

  return (
    <Layout title="FAI Agent - FrootAI" description="AI-powered architecture guide. Grounded in 20 solution plays, 22 MCP tools, 18 knowledge modules.">
      {/* Bouncing dots + streaming cursor animations */}
      <style>{`
        @keyframes bounceDot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-8px); opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .bounce-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; animation: bounceDot 1.4s ease-in-out infinite; }
        .bounce-dot:nth-child(1) { animation-delay: 0s; }
        .bounce-dot:nth-child(2) { animation-delay: 0.2s; }
        .bounce-dot:nth-child(3) { animation-delay: 0.4s; }
        .streaming-cursor::after { content: '\u258C'; animation: blink 0.8s step-end infinite; color: #f59e0b; font-weight: 300; }
      `}</style>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 24px 80px", width: "100%", position: "relative" }}>

        {/* Subtle gold/amber radial glow behind the hero */}
        <div style={{ position: "absolute", top: "-60px", left: "50%", transform: "translateX(-50%)", width: "700px", height: "400px", background: "radial-gradient(ellipse at 50% 40%, rgba(245,158,11,0.08) 0%, rgba(234,179,8,0.04) 40%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

        {/* ═══ HERO HEADER ═══ */}
        <div style={{ textAlign: "center", marginBottom: "24px", position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-block", padding: "3px 14px", borderRadius: "20px", background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(234,179,8,0.08))", border: "1px solid rgba(245,158,11,0.3)", fontSize: "0.65rem", color: "#f59e0b", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "12px" }}>
            Powered by Azure OpenAI GPT-4.1
          </div>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, margin: "0 0 6px", background: "linear-gradient(135deg, #f59e0b 0%, #eab308 40%, #f97316 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            ✨ FAI Agent
          </h1>
          <p style={{ color: "var(--ifm-color-emphasis-500)", fontSize: "0.88rem", margin: "0 0 4px", fontWeight: 500 }}>
            Your open glue for binding <span style={{ color: "#10b981", fontWeight: 700 }}>Infrastructure</span>, <span style={{ color: "#06b6d4", fontWeight: 700 }}>Platform</span> & <span style={{ color: "#7c3aed", fontWeight: 700 }}>Application</span> with the Agentic Ecosystem
          </p>
          <p style={{ color: "var(--ifm-color-emphasis-400)", fontSize: "0.72rem", margin: 0, fontStyle: "italic" }}>
            From the Roots to the Fruits
          </p>
        </div>

        {/* ═══ CHAT CONTAINER (glassmorphism) ═══ */}
        <div style={{ border: "1px solid rgba(245,158,11,0.15)", borderRadius: "24px", background: "rgba(20,20,40,0.45)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", display: "flex", flexDirection: "column", minHeight: "520px", boxShadow: "0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)" }}>

          {/* Messages */}
          <div ref={chatRef} style={{ flex: 1, padding: "24px", overflowY: "auto", maxHeight: "600px", scrollBehavior: "auto" }}>
            {history.map((m, i) => (
              <div key={i} style={{ marginBottom: "16px", display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-start", gap: "10px" }}>
                {m.role === "assistant" && (
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(99,102,241,0.15))", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0, marginTop: "2px" }}>✨</div>
                )}
                <div style={{ maxWidth: "85%", padding: "14px 18px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${m.role === "user" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)"}`, backdropFilter: "blur(8px)", fontSize: "0.84rem", lineHeight: 1.7 }}>
                  <div className={loading && i === history.length - 1 && m.role === "assistant" ? "streaming-cursor" : ""}>
                    {m.role === "assistant" ? renderMd(m.text) : m.text}
                  </div>
                </div>
              </div>
            ))}
            {loading && history[history.length - 1]?.text === "" && (
              <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "flex-start", gap: "10px", marginBottom: "16px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(99,102,241,0.15))", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0 }}>✨</div>
                <div style={{ padding: "14px 18px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(8px)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span className="bounce-dot" />
                    <span className="bounce-dot" />
                    <span className="bounce-dot" />
                    <span style={{ color: "var(--ifm-color-emphasis-400)", marginLeft: "6px", fontSize: "0.8rem" }}>FAI Agent is thinking</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggestion chips — show initial OR follow-up prompts */}
          {!loading && (
            <div style={{ padding: "6px 20px 4px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {(history.length <= 1 ? SUGGESTIONS : followUps).map((s, i) => (
                <button key={i} onClick={() => send(s)} style={{ padding: "5px 14px", borderRadius: "20px", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.04)", color: "#f59e0b", fontSize: "0.7rem", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.12)"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.04)"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.2)"; }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <textarea value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything... (Shift+Enter for new line)" rows={1} style={{ flex: 1, padding: "14px 18px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", backdropFilter: "blur(8px)", color: "#e0e0e0", fontSize: "0.85rem", outline: "none", transition: "border-color 0.2s, background 0.2s", resize: "none", overflow: "hidden", minHeight: "48px", maxHeight: "160px", lineHeight: "1.5", fontFamily: "inherit" }} disabled={loading}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 160) + "px"; }} />
            <button onClick={() => send()} disabled={loading} style={{ padding: "14px 28px", borderRadius: "14px", background: loading ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #6366f1, #7c3aed)", color: loading ? "#555" : "#fff", border: "none", fontWeight: 700, cursor: loading ? "default" : "pointer", fontSize: "0.85rem", transition: "all 0.2s", boxShadow: loading ? "none" : "0 4px 16px rgba(99,102,241,0.3)", whiteSpace: "nowrap" }}>{loading ? "..." : "Ask ✨"}</button>
          </div>
        </div>

        {/* ═══ BOTTOM LINKS ═══ */}
        <div style={{ marginTop: "20px", textAlign: "center", display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/" className={styles.glowPill} style={{ "--pill-color": "#f59e0b" } as React.CSSProperties}>Back to FrootAI</Link>
          <Link to="/configurator" className={styles.glowPill} style={{ "--pill-color": "#6366f1" } as React.CSSProperties}>Solution Configurator</Link>
          <Link to="/ecosystem" className={styles.glowPill} style={{ "--pill-color": "#7c3aed" } as React.CSSProperties}>FAI Ecosystem</Link>
          <Link to="/learning-hub" className={styles.glowPill} style={{ "--pill-color": "#f97316" } as React.CSSProperties}>FAI Learning Center</Link>
        </div>
      </div>
    </Layout>
  );
}