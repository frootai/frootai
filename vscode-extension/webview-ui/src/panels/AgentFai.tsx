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
    // Code blocks — dark with emerald syntax
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#0d1117;border:1px solid #10b98120;padding:12px 14px;border-radius:10px;overflow-x:auto;font-size:11px;margin:10px 0;line-height:1.6;font-family:monospace"><code style="color:#10b981">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:#10b98110;color:#10b981;padding:2px 6px;border-radius:4px;font-size:11px;font-family:monospace">$1</code>')
    // Headers — emerald h2, amber h3, white h4
    .replace(/^#### (.+)$/gm, '<h5 style="font-size:12px;font-weight:700;margin:12px 0 4px;color:#94a3b8">$1</h5>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:13px;font-weight:700;margin:14px 0 6px;color:#fbbf24">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:18px 0 8px;color:#10b981;border-bottom:1px solid #10b98115;padding-bottom:6px">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="font-size:17px;font-weight:800;margin:18px 0 8px;color:#fff">$1</h2>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong style="color:#fff;font-weight:700;font-style:italic">$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e2e8f0;font-weight:600">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#94a3b8">$1</em>')
    // Blockquotes — emerald accent
    .replace(/^&gt; 💡(.+)$/gm, '<div style="border-left:3px solid #f59e0b;padding:8px 14px;margin:10px 0;background:#f59e0b08;border-radius:0 8px 8px 0;font-size:12px;line-height:1.5">💡$1</div>')
    .replace(/^&gt; (.+)$/gm, '<div style="border-left:3px solid #10b981;padding:8px 14px;margin:10px 0;background:#10b98108;border-radius:0 8px 8px 0;font-size:12px;line-height:1.5">$1</div>')
    // Numbered lists
    .replace(/^(\d+)\. (.+)$/gm, '<div style="padding-left:4px;margin:4px 0;font-size:12px;display:flex;gap:8px;line-height:1.5"><span style="color:#10b981;font-weight:600;min-width:16px">$1.</span><span>$2</span></div>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<div style="padding-left:4px;margin:4px 0;font-size:12px;display:flex;gap:8px;line-height:1.5"><span style="color:#10b981">•</span><span>$1</span></div>')
    // HR
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #1a1a2e;margin:16px 0">')
    // Links — VS Code ecosystem (data-fai attributes for event delegation)
    .replace(/\[([^\]]+)\]\(\/solution-plays\/(\d{2})-[^)]+\)/g, '<a href="#" data-fai="play" data-arg="$2" style="color:#06b6d4;text-decoration:none;border-bottom:1px dashed #06b6d430;cursor:pointer;transition:color 0.2s">$1</a>')
    .replace(/\[([^\]]+)\]\(\/user-guide\?play=(\d{2})\)/g, '<a href="#" data-fai="play" data-arg="$2" style="color:#8b5cf6;text-decoration:none;border-bottom:1px dashed #8b5cf630;cursor:pointer">$1</a>')
    .replace(/\[([^\]]+)\]\(\/configurator\)/g, '<a href="#" data-fai="configurator" style="color:#f59e0b;text-decoration:none;border-bottom:1px dashed #f59e0b30;cursor:pointer">$1</a>')
    .replace(/\[([^\]]+)\]\(\/solution-plays\)/g, '<a href="#" data-fai="browse" style="color:#10b981;text-decoration:none;border-bottom:1px dashed #10b98130;cursor:pointer">$1</a>')
    .replace(/\[([^\]]+)\]\(\/user-guide[^)]*\)/g, '<a href="#" data-fai="browse" style="color:#8b5cf6;text-decoration:none;border-bottom:1px dashed #8b5cf630;cursor:pointer">$1</a>')
    .replace(/\[([^\]]+)\]\(\/setup-guide\)/g, '<a href="#" data-fai="setup" style="color:#f97316;text-decoration:none;border-bottom:1px dashed #f9731630;cursor:pointer">$1</a>')
    .replace(/\[([^\]]+)\]\(\/docs\/([^)]+)\)/g, '<a href="#" data-fai="module" data-arg="$2" style="color:#6366f1;text-decoration:none;border-bottom:1px dashed #6366f130;cursor:pointer">$1</a>')
    .replace(/\[([^\]]+)\]\(\/marketplace\)/g, '<a href="#" data-fai="marketplace" style="color:#ec4899;text-decoration:none;border-bottom:1px dashed #ec489930;cursor:pointer">$1</a>')
    .replace(/\[([^\]]+)\]\(\/primitives[^)]*\)/g, '<a href="#" data-fai="primitives" style="color:#3b82f6;text-decoration:none;border-bottom:1px dashed #3b82f630;cursor:pointer">$1</a>')
    .replace(/\[([^\]]+)\]\(\/mcp[^)]*\)/g, '<a href="#" data-fai="external" data-arg="https://frootai.dev/mcp-tooling" style="color:#7c3aed;text-decoration:none;cursor:pointer">$1 ↗</a>')
    // External links — grey with arrow-up-right symbol
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="#" data-fai="external" data-arg="$2" style="color:#64748b;text-decoration:none;border-bottom:1px dashed #64748b25;cursor:pointer;font-size:12px">$1 <span style="font-size:10px;opacity:0.6">↗</span></a>')
    // Remaining relative links
    .replace(/\[([^\]]+)\]\(\/([^)]+)\)/g, '<a href="#" data-fai="external" data-arg="https://frootai.dev/$2" style="color:#64748b;text-decoration:none;cursor:pointer;font-size:12px">$1 <span style="font-size:10px;opacity:0.6">↗</span></a>')
    .replace(/\n\n/g, '</p><p style="margin:8px 0;line-height:1.65;font-size:13px">')
    .replace(/\n/g, '<br>');

  // Tables — rounded container with emerald headers
  html = html.replace(/(\|.+\|(?:<br>\|[-:| ]+\|)?(?:<br>\|.+\|)*)/g, (match) => {
    const rows = match.split('<br>').filter(r => r.trim() && !r.match(/^\|[-:| ]+\|$/));
    if (rows.length === 0) return match;
    const tableRows = rows.map((row, idx) => {
      const cells = row.split('|').filter(c => c.trim()).map(c => c.trim());
      const tag = idx === 0 ? 'th' : 'td';
      const style = idx === 0
        ? 'style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#10b981;background:#10b98108"'
        : 'style="padding:7px 10px;border-top:1px solid #1a1a2e;font-size:12px;line-height:1.5"';
      return `<tr style="${idx > 0 ? 'transition:background 0.15s' : ''}" ${idx > 0 ? 'onmouseenter="this.style.background=\'#ffffff06\'" onmouseleave="this.style.background=\'none\'"' : ''}>${cells.map(c => `<${tag} ${style}>${c}</${tag}>`).join('')}</tr>`;
    }).join('');
    return `<div style="overflow-x:auto;margin:10px 0;border:1px solid #1a1a2e;border-radius:10px;background:#0a0a12"><table style="width:100%;border-collapse:collapse">${tableRows}</table></div>`;
  });

  return `<div style="line-height:1.65;font-size:13px"><p style="margin:6px 0">${html}</p></div>`;
}

export default function AgentFai() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Click handler for data-fai links (event delegation — CSP safe)
  const handleClick = useCallback((e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest("a[data-fai]") as HTMLElement | null;
    if (!link) return;
    e.preventDefault();
    const type = link.getAttribute("data-fai") || "";
    const arg = link.getAttribute("data-arg") || "";
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
  }, []);

  useEffect(() => {
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [handleClick]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const systemMsg = {
      role: "system",
      content: `You are Agent FAI — the intelligent navigator for FrootAI inside VS Code.

## Your VS Code Ecosystem (use these internal links — they open panels inside VS Code):

### Solution Plays (101 deployable AI architectures)
- Link format: [Play Name](/solution-plays/XX-slug) — opens Play Detail panel
- Example: [Play 01: Enterprise RAG](/solution-plays/01-enterprise-rag)
- Browse all: [Browse All Plays](/solution-plays) — opens Play Browser panel
- Find the right play: [Solution Configurator](/configurator) — opens Configurator panel

### Primitives (830+ building blocks)
- Agents (238): [Primitives Catalog](/primitives/agents) — opens Catalog panel
- Skills (322): [Skills Catalog](/primitives/skills)
- Instructions (176): [Instructions](/primitives/instructions)
- Hooks (10): [Hooks](/primitives/hooks)
- Browse all: [Primitives Catalog](/primitives) — opens full catalog
- Plugins (77): [Plugin Marketplace](/marketplace) — opens Marketplace panel

### Knowledge & Learning
- FROOT modules: [Module Name](/docs/MODULE-ID) — opens knowledge webview
- Setup: [Setup Guide](/setup-guide) — opens Setup Guide panel

## Rules:
1. ALWAYS use the internal link formats above — they open VS Code panels, not browser
2. NEVER use /user-guide links — use /solution-plays/XX-slug instead
3. Put external links (GitHub, Azure docs, npm) at the END under "## 🌐 Explore on Web"
4. Keep responses concise, structured, and actionable
5. Use tables for comparisons
6. Never use mermaid diagrams
7. Use bold for key terms, code blocks for commands`
    };
    const history = [systemMsg, ...messages.slice(-8).map(m => ({ role: m.role, content: m.text })), { role: "user", content: text.trim() }];

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
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #10b98115, #06b6d415)", border: "1px solid #10b98125", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8V4H8"/><rect x="8" y="2" width="8" height="4" rx="1"/><rect x="4" y="8" width="16" height="12" rx="2"/>
            <circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M10 17h4"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: -0.3 }}>Agent <span style={{ color: "#10b981" }}>FAI</span></div>
          <div style={{ fontSize: 11, opacity: 0.45 }}>Powered by Azure OpenAI — ask anything about FrootAI</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: "0 20px" }}>
            {/* Icon — styled SVG circle, no emoji */}
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #10b98115, #06b6d415)", border: "1px solid #10b98125", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8V4H8"/><rect x="8" y="2" width="8" height="4" rx="1"/><rect x="4" y="8" width="16" height="12" rx="2"/>
                <circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M10 17h4"/>
              </svg>
            </div>
            <p style={{ fontWeight: 800, fontSize: 22, marginBottom: 4, letterSpacing: -0.5 }}>Hi! I'm Agent <span style={{ color: "#10b981" }}>FAI</span></p>
            <p style={{ fontSize: 13, opacity: 0.45, marginBottom: 28, maxWidth: 400, textAlign: "center", lineHeight: 1.5 }}>Ask me anything about solution plays, architecture patterns, costs, or getting started with FrootAI.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", maxWidth: 480 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  style={{ textAlign: "left", fontSize: 13, padding: "14px 16px", lineHeight: 1.5, background: "linear-gradient(135deg, #10b98106, #06b6d406)", border: "1px solid #10b98118", borderRadius: 12, cursor: "pointer", color: "inherit", transition: "all 0.25s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#10b98140"; e.currentTarget.style.background = "linear-gradient(135deg, #10b98112, #06b6d412)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#10b98118"; e.currentTarget.style.background = "linear-gradient(135deg, #10b98106, #06b6d406)"; e.currentTarget.style.transform = "none"; }}>
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
