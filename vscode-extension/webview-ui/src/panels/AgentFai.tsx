import { useState, useRef, useEffect } from "react";
import { vscode } from "../vscode";

const STREAM_API = "https://frootai-chatbot-api.azurewebsites.net/api/chat/stream";

const SUGGESTIONS = [
  "Which play should I use for a RAG pipeline?",
  "How do I get started with FrootAI?",
  "Compare gpt-4o vs gpt-4.1 for my use case",
  "How much will an AI agent solution cost?",
  "What is the .github Agentic OS?",
  "How do I set up the MCP server?",
];

interface Message {
  role: "user" | "assistant";
  text: string;
}

export default function AgentFai() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const history = [...messages.slice(-8), userMsg].map(m => ({ role: m.role, content: m.text }));

    try {
      const res = await fetch(STREAM_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), history }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      setMessages(prev => [...prev, { role: "assistant", text: "" }]);

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
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", text: accumulated };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: `⚠️ Could not reach Agent FAI API. Error: ${e.message}\n\nTry the offline @fai chat participant instead (type @fai in Copilot Chat).`,
      }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", padding: 0 }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--vscode-panel-border)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>🤖</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Agent FAI</div>
          <div style={{ fontSize: 11, opacity: 0.5 }}>Ask about solution plays, architecture, costs, getting started</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>🤖</p>
            <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Hi! I'm Agent FAI</p>
            <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>Ask me anything about FrootAI, solution plays, architecture, or AI on Azure.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 360, margin: "0 auto" }}>
              {SUGGESTIONS.map(s => (
                <button key={s} className="btn btn-sm btn-ghost" onClick={() => send(s)}
                  style={{ textAlign: "left", fontSize: 12, padding: "6px 10px", whiteSpace: "normal", lineHeight: 1.4 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%", padding: "8px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
              background: m.role === "user" ? "#10b98120" : "var(--vscode-editor-background)",
              border: `1px solid ${m.role === "user" ? "#10b98130" : "var(--vscode-panel-border)"}`,
            }}>
              {m.text || (loading && i === messages.length - 1 ? "⏳ Thinking..." : "")}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "8px 16px 12px", borderTop: "1px solid var(--vscode-panel-border)", display: "flex", gap: 8 }}>
        <input
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send(input)}
          placeholder="Ask Agent FAI..."
          disabled={loading}
          style={{ flex: 1 }}
        />
        <button className="btn btn-sm" onClick={() => send(input)} disabled={loading || !input.trim()}
          style={{ background: "#10b98120", color: "#10b981", borderColor: "#10b981", padding: "4px 12px" }}>
          Send
        </button>
      </div>
    </div>
  );
}
