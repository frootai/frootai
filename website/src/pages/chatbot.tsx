import React, { useState, useRef, useEffect } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import styles from "./index.module.css";

const CHAT_API_URL = "https://frootai-chatbot-api.azurewebsites.net/api/chat";
const BASE = "/frootai"; // GitHub Pages base path
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
    { role: "assistant", text: "Welcome! I'm your **open glue** for binding **Infra**, **Platform** & **Application** with the Agentic Ecosystem.\n\nAsk me about any of the **20 solution plays**, the **MCP server**, **VS Code extension**, or how to get started." }
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  // Markdown to HTML — fixes links by prepending /frootai base path
  const renderMd = (text: string) => {
    let html = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, (_, label, path) => {
        const href = path.startsWith("/frootai") ? path : `${BASE}${path}`;
        return `<a href="${href}" style="color:#f59e0b;text-decoration:underline;">${label}</a>`;
      })
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" style="color:#f59e0b;text-decoration:underline;" target="_blank" rel="noopener">$1</a>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(245,158,11,0.1);padding:2px 6px;border-radius:4px;font-size:0.8rem;">$1</code>')
      .replace(/^### (.+)$/gm, '<h4 style="margin:8px 0 4px;font-size:0.9rem;font-weight:700;">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 style="margin:10px 0 4px;font-size:0.95rem;font-weight:700;">$1</h3>')
      .replace(/\| .+\|/g, (match) => `<span style="font-size:0.78rem;font-family:monospace;">${match}</span>`)
      .replace(/^- (.+)$/gm, '• $1')
      .replace(/^(\d+)\. (.+)$/gm, '$1. $2')
      .replace(/\n/g, '<br/>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const send = async (text?: string) => {
    const message = text || msg;
    if (!message.trim() || loading) return;
    const newH = [...history, { role: "user", text: message }];
    setHistory(newH); setMsg(""); setLoading(true);
    try {
      const res = await fetch(CHAT_API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history: newH.slice(-10).map(m => ({ role: m.role, content: m.text })) }) });
      if (res.ok) { const d = await res.json(); setHistory([...newH, { role: "assistant", text: d.reply }]); }
      else throw new Error("API " + res.status);
    } catch { setHistory([...newH, { role: "assistant", text: USE_FALLBACK ? getFallback(message) : "Could not reach AI service. Try: npx frootai-mcp" }]); }
    finally { setLoading(false); }
  };

  // Get the last assistant message for follow-ups
  const lastAssistant = [...history].reverse().find(m => m.role === "assistant");
  const followUps = lastAssistant ? getFollowUps(lastAssistant.text) : [];

  return (
    <Layout title="FAI Agent - FrootAI" description="AI-powered architecture guide. Grounded in 20 solution plays, 16 MCP tools, 18 knowledge modules. Powered by Azure OpenAI GPT-4.1.">
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 24px 80px", width: "100%" }}>

        {/* ═══ HERO HEADER ═══ */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ display: "inline-block", padding: "3px 14px", borderRadius: "20px", background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(234,179,8,0.08))", border: "1px solid rgba(245,158,11,0.3)", fontSize: "0.65rem", color: "#f59e0b", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "12px" }}>
            Powered by Azure OpenAI GPT-4.1
          </div>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, margin: "0 0 8px", background: "linear-gradient(135deg, #f59e0b 0%, #eab308 40%, #f97316 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            ✨ FAI Agent
          </h1>
          <p style={{ color: "var(--ifm-color-emphasis-500)", fontSize: "0.88rem", margin: "0 0 6px", fontWeight: 500 }}>
            Your open glue for binding <span style={{ color: "#10b981", fontWeight: 700 }}>Infrastructure</span>, <span style={{ color: "#06b6d4", fontWeight: 700 }}>Platform</span> & <span style={{ color: "#7c3aed", fontWeight: 700 }}>Application</span> with the Agentic Ecosystem
          </p>
          <p style={{ color: "var(--ifm-color-emphasis-400)", fontSize: "0.72rem", margin: 0, fontStyle: "italic" }}>
            From the Roots to the Fruits — grounded in 20 plays, 16 MCP tools, 18 modules
          </p>
        </div>

        {/* ═══ CHAT CONTAINER ═══ */}
        <div style={{ border: "1px solid rgba(245,158,11,0.25)", borderRadius: "20px", background: "linear-gradient(180deg, rgba(26,26,46,0.7) 0%, rgba(15,15,30,0.8) 100%)", display: "flex", flexDirection: "column", minHeight: "480px", boxShadow: "0 8px 32px rgba(245,158,11,0.06), 0 0 80px rgba(99,102,241,0.03)" }}>

          {/* Messages */}
          <div style={{ flex: 1, padding: "24px", overflowY: "auto", maxHeight: "560px" }}>
            {history.map((m, i) => (
              <div key={i} style={{ marginBottom: "16px", display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-start", gap: "10px" }}>
                {m.role === "assistant" && (
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(99,102,241,0.15))", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0, marginTop: "2px" }}>✨</div>
                )}
                <div style={{ maxWidth: "80%", padding: "14px 18px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(234,179,8,0.06))" : "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(124,58,237,0.04))", border: `1px solid ${m.role === "user" ? "rgba(245,158,11,0.25)" : "rgba(99,102,241,0.15)"}`, fontSize: "0.84rem", lineHeight: 1.7 }}>
                  {m.role === "assistant" ? renderMd(m.text) : m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "flex-start", gap: "10px", marginBottom: "16px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(99,102,241,0.15))", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0, animation: "pulse 1.5s ease-in-out infinite" }}>✨</div>
                <div style={{ padding: "14px 18px", borderRadius: "16px 16px 16px 4px", background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(124,58,237,0.04))", border: "1px solid rgba(99,102,241,0.15)", fontSize: "0.84rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b", animation: "pulse 1s ease-in-out infinite" }} />
                    <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b", animation: "pulse 1s ease-in-out 0.2s infinite" }} />
                    <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b", animation: "pulse 1s ease-in-out 0.4s infinite" }} />
                    <span style={{ color: "var(--ifm-color-emphasis-400)", marginLeft: "4px" }}>FAI Agent processing</span>
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
          <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: "10px" }}>
            <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask FAI Agent anything about FrootAI..." style={{ flex: 1, padding: "14px 18px", borderRadius: "12px", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(0,0,0,0.3)", color: "#e0e0e0", fontSize: "0.85rem", outline: "none", transition: "border-color 0.2s" }} disabled={loading}
              onFocus={e => e.currentTarget.style.borderColor = "rgba(245,158,11,0.5)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(245,158,11,0.2)"} />
            <button onClick={() => send()} disabled={loading} style={{ padding: "14px 28px", borderRadius: "12px", background: loading ? "#333" : "linear-gradient(135deg, #f59e0b, #eab308)", color: loading ? "#666" : "#000", border: "none", fontWeight: 700, cursor: loading ? "default" : "pointer", fontSize: "0.85rem", transition: "all 0.2s", boxShadow: loading ? "none" : "0 4px 12px rgba(245,158,11,0.2)" }}>{loading ? "..." : "Ask ✨"}</button>
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