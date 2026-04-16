import { useState, useRef, useEffect, useCallback } from "react";
import { vscode } from "../vscode";

const STREAM_API = "https://frootai-chatbot-api.azurewebsites.net/api/chat/stream";

const SUGGESTIONS = [
  "Which play should I use for a RAG pipeline?",
  "How do I get started with FrootAI?",
  "How much will an AI agent solution cost?",
  "What is the .github Agentic OS?",
  "Compare Play 01 vs Play 21",
  "How do I set up the MCP server?",
];

interface Message {
  role: "user" | "assistant";
  text: string;
}

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#0d1117;border:1px solid #10b98125;padding:10px 12px;border-radius:8px;overflow-x:auto;font-size:11px;margin:8px 0;line-height:1.5"><code style="color:#10b981">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:#10b98112;color:#10b981;padding:1px 5px;border-radius:4px;font-size:11px">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h4 style="font-size:13px;font-weight:700;margin:14px 0 4px;color:#fbbf24;border-bottom:1px solid #fbbf2415;padding-bottom:4px">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:16px 0 6px;color:#10b981;border-bottom:1px solid #10b98115;padding-bottom:4px">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="font-size:16px;font-weight:800;margin:16px 0 8px">$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;font-weight:600">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#94a3b8">$1</em>')
    // Blockquotes
    .replace(/^&gt; (.+)$/gm, '<div style="border-left:3px solid #10b981;padding:6px 12px;margin:8px 0;background:#10b98108;border-radius:0 6px 6px 0;font-size:12px">$1</div>')
    // Lists
    .replace(/^- (.+)$/gm, '<div style="padding-left:14px;margin:3px 0;font-size:12px"><span style="color:#10b981;margin-right:6px">•</span>$1</div>')
    // HR
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #1a1a2e;margin:14px 0">')
    // Links — route FrootAI paths to VS Code commands
    .replace(/\[([^\]]+)\]\(\/solution-plays\/(\d{2})-[^)]+\)/g, '<a href="#" onclick="handleFaiLink(\'play\',\'$2\')" style="color:#06b6d4;text-decoration:none;border-bottom:1px dashed #06b6d440;cursor:pointer">$1 <span style="font-size:9px;background:#06b6d415;padding:1px 4px;border-radius:3px;margin-left:2px">VS Code</span></a>')
    .replace(/\[([^\]]+)\]\(\/configurator\)/g, '<a href="#" onclick="handleFaiLink(\'configurator\')" style="color:#f59e0b;text-decoration:none;border-bottom:1px dashed #f59e0b40;cursor:pointer">$1 <span style="font-size:9px;background:#f59e0b15;padding:1px 4px;border-radius:3px;margin-left:2px">VS Code</span></a>')
    .replace(/\[([^\]]+)\]\(\/solution-plays\)/g, '<a href="#" onclick="handleFaiLink(\'browse\')" style="color:#10b981;text-decoration:none;border-bottom:1px dashed #10b98140;cursor:pointer">$1 <span style="font-size:9px;background:#10b98115;padding:1px 4px;border-radius:3px;margin-left:2px">VS Code</span></a>')
    .replace(/\[([^\]]+)\]\(\/user-guide[^)]*\)/g, '<a href="#" onclick="handleFaiLink(\'browse\')" style="color:#8b5cf6;text-decoration:none;border-bottom:1px dashed #8b5cf640;cursor:pointer">$1 <span style="font-size:9px;background:#8b5cf615;padding:1px 4px;border-radius:3px;margin-left:2px">VS Code</span></a>')
    .replace(/\[([^\]]+)\]\(\/setup-guide\)/g, '<a href="#" onclick="handleFaiLink(\'setup\')" style="color:#f97316;text-decoration:none;border-bottom:1px dashed #f9731640;cursor:pointer">$1 <span style="font-size:9px;background:#f9731615;padding:1px 4px;border-radius:3px;margin-left:2px">VS Code</span></a>')
    .replace(/\[([^\]]+)\]\(\/docs\/([^)]+)\)/g, '<a href="#" onclick="handleFaiLink(\'module\',\'$2\')" style="color:#6366f1;text-decoration:none;border-bottom:1px dashed #6366f140;cursor:pointer">$1 <span style="font-size:9px;background:#6366f115;padding:1px 4px;border-radius:3px;margin-left:2px">VS Code</span></a>')
    .replace(/\[([^\]]+)\]\(\/marketplace\)/g, '<a href="#" onclick="handleFaiLink(\'marketplace\')" style="color:#ec4899;text-decoration:none;border-bottom:1px dashed #ec489940;cursor:pointer">$1 <span style="font-size:9px;background:#ec489915;padding:1px 4px;border-radius:3px;margin-left:2px">VS Code</span></a>')
    .replace(/\[([^\]]+)\]\(\/primitives[^)]*\)/g, '<a href="#" onclick="handleFaiLink(\'primitives\')" style="color:#3b82f6;text-decoration:none;border-bottom:1px dashed #3b82f640;cursor:pointer">$1 <span style="font-size:9px;background:#3b82f615;padding:1px 4px;border-radius:3px;margin-left:2px">VS Code</span></a>')
    // External links (GitHub, etc.)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="#" onclick="handleFaiLink(\'external\',\'$2\')" style="color:#94a3b8;text-decoration:none;border-bottom:1px dashed #94a3b830;cursor:pointer">$1 <span style="font-size:9px;background:#94a3b810;padding:1px 4px;border-radius:3px;margin-left:2px">↗</span></a>')
    // Remaining relative links
    .replace(/\[([^\]]+)\]\(\/([^)]+)\)/g, '<a href="#" onclick="handleFaiLink(\'external\',\'https://frootai.dev/$2\')" style="color:#94a3b8;text-decoration:none;cursor:pointer">$1 ↗</a>')
    .replace(/\n\n/g, '</p><p style="margin:6px 0;line-height:1.6">')
    .replace(/\n/g, '<br>');

  // Tables
  html = html.replace(/(\|.+\|(?:<br>\|[-:| ]+\|)?(?:<br>\|.+\|)*)/g, (match) => {
    const rows = match.split('<br>').filter(r => r.trim() && !r.match(/^\|[-:| ]+\|$/));
    if (rows.length === 0) return match;
    const tableRows = rows.map((row, idx) => {
      const cells = row.split('|').filter(c => c.trim()).map(c => c.trim());
      const tag = idx === 0 ? 'th' : 'td';
      const style = idx === 0
        ? 'style="padding:5px 8px;text-align:left;border-bottom:2px solid #10b98130;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#10b981"'
        : 'style="padding:5px 8px;border-bottom:1px solid #1a1a2e;font-size:12px"';
      return `<tr>${cells.map(c => `<${tag} ${style}>${c}</${tag}>`).join('')}</tr>`;
    }).join('');
    return `<div style="overflow-x:auto;margin:8px 0;border:1px solid #1a1a2e;border-radius:8px"><table style="width:100%;border-collapse:collapse">${tableRows}</table></div>`;
  });

  return `<p style="margin:6px 0;line-height:1.6">${html}</p>`;
}

export default function AgentFai() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Register global link handler for markdown links
  useEffect(() => {
    (window as any).handleFaiLink = (type: string, arg?: string) => {
      switch (type) {
        case "play": vscode.postMessage({ command: "openPlay", playId: arg }); break;
        case "configurator": vscode.postMessage({ command: "openConfigurator" }); break;
        case "browse": vscode.postMessage({ command: "browsePlays" }); break;
        case "setup": vscode.postMessage({ command: "openSetup" }); break;
        case "primitives": vscode.postMessage({ command: "openPrimitives" }); break;
        case "marketplace": vscode.postMessage({ command: "openMarketplace" }); break;
        case "module": vscode.postMessage({ command: "openModule", moduleId: arg }); break;
        case "external": vscode.postMessage({ command: "openUrl", url: arg }); break;
      }
    };
  }, []);

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
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #1a1a2e", background: "#0a0a12", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#10b98115", border: "1px solid #10b98125", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: -0.3 }}>Agent <span style={{ color: "#10b981" }}>FAI</span></div>
          <div style={{ fontSize: 11, opacity: 0.45 }}>Powered by Azure OpenAI — ask anything about FrootAI</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "#10b98110", border: "1px solid #10b98120", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 12px" }}>🤖</div>
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, letterSpacing: -0.3 }}>Hi! I'm Agent <span style={{ color: "#10b981" }}>FAI</span></p>
            <p style={{ fontSize: 12, opacity: 0.5, marginBottom: 20 }}>Ask me anything about solution plays, architecture, costs, or getting started.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxWidth: 400, margin: "0 auto" }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  style={{ textAlign: "left", fontSize: 11, padding: "8px 10px", lineHeight: 1.4, background: "#10b98108", border: "1px solid #10b98115", borderRadius: 8, cursor: "pointer", color: "inherit", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#10b98140"; e.currentTarget.style.background = "#10b98115"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#10b98115"; e.currentTarget.style.background = "#10b98108"; }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 14, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "90%", padding: m.role === "user" ? "8px 14px" : "12px 16px", borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px", fontSize: 13, lineHeight: 1.65,
              background: m.role === "user" ? "#10b98118" : "#0d1117",
              border: `1px solid ${m.role === "user" ? "#10b98125" : "#1a1a2e"}`,
            }}>
              {m.role === "user"
                ? <span style={{ color: "#e2e8f0" }}>{m.text}</span>
                : m.text
                  ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
                  : (loading && i === messages.length - 1 ? <span style={{ color: "#10b981", fontSize: 12 }}>⏳ Agent FAI is thinking...</span> : "")
              }
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 16px 14px", borderTop: "1px solid #1a1a2e", background: "#0a0a12", display: "flex", gap: 8 }}>
        <input
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send(input)}
          placeholder="Ask Agent FAI anything..."
          disabled={loading}
          style={{ flex: 1, background: "#151520", border: "1px solid #1a1a2e", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}
        />
        <button onClick={() => send(input)} disabled={loading || !input.trim()}
          style={{ background: loading ? "#333" : "linear-gradient(135deg, #10b981, #06b6d4)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: !input.trim() ? 0.4 : 1 }}>
          Send
        </button>
      </div>
    </div>
  );
}
