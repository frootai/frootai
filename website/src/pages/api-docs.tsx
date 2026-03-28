import React, { useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";

const codeStyle: React.CSSProperties = {
  display: "block", padding: "14px 18px", borderRadius: "12px", fontSize: "0.78rem",
  fontFamily: "var(--ifm-font-family-monospace)", background: "rgba(16, 185, 129, 0.04)",
  border: "1px solid rgba(16, 185, 129, 0.12)", lineHeight: "1.7", marginBottom: "16px",
  overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" as any, maxWidth: "100%",
};

const cardStyle: React.CSSProperties = {
  padding: "24px", borderRadius: "14px", border: "1px solid var(--ifm-color-emphasis-200)",
  background: "var(--ifm-background-surface-color)", marginBottom: "20px",
};

const h2Style: React.CSSProperties = { fontSize: "1.3rem", fontWeight: 700, marginBottom: "12px", marginTop: "40px" };
const h3Style: React.CSSProperties = { fontSize: "1.05rem", fontWeight: 700, marginBottom: "8px", marginTop: "24px" };
const methodBadge = (m: string) => ({
  display: "inline-block", padding: "2px 10px", borderRadius: "6px", fontSize: "0.72rem",
  fontWeight: 800, letterSpacing: "0.05em", marginRight: "10px",
  background: m === "GET" ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)",
  color: m === "GET" ? "#10b981" : "#6366f1",
});

const endpoints = [
  {
    method: "GET", path: "/api/health", summary: "Health check",
    desc: "Returns service status, model, tool count, and version.",
    example: `curl https://frootai-chatbot-api.azurewebsites.net/api/health`,
    response: `{
  "status": "ok",
  "service": "frootai-chatbot-api",
  "model": "gpt-4o-mini",
  "tools": 22,
  "version": "3.1.2"
}`,
  },
  {
    method: "POST", path: "/api/search-plays", summary: "Search solution plays",
    desc: "Search across 20 FrootAI solution plays by keyword.",
    example: `curl -X POST https://frootai-chatbot-api.azurewebsites.net/api/search-plays \\
  -H "Content-Type: application/json" \\
  -d '{"query": "RAG"}'`,
    response: `{
  "results": [
    { "number": "01", "name": "Enterprise RAG Q&A", "complexity": "Med", "url": "/user-guide?play=01" }
  ]
}`,
  },
  {
    method: "POST", path: "/api/estimate-cost", summary: "Estimate Azure costs",
    desc: "Returns monthly Azure cost estimate for a solution play at dev or prod scale.",
    example: `curl -X POST https://frootai-chatbot-api.azurewebsites.net/api/estimate-cost \\
  -H "Content-Type: application/json" \\
  -d '{"play": "01", "scale": "prod"}'`,
    response: `{
  "play": "Enterprise RAG Q&A",
  "scale": "prod",
  "total": 480,
  "breakdown": [
    { "service": "AI Search", "cost": 250 },
    { "service": "OpenAI", "cost": 150 },
    { "service": "App Service", "cost": 55 }
  ]
}`,
  },
  {
    method: "POST", path: "/api/chat", summary: "Chat with Agent FAI",
    desc: "Send a message to Agent FAI. Returns the complete AI response.",
    example: `curl -X POST https://frootai-chatbot-api.azurewebsites.net/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message": "What is RAG architecture?"}'`,
    response: `{
  "reply": "## 🔍 RAG Architecture\\n\\nRetrieval-Augmented Generation..."
}`,
  },
  {
    method: "POST", path: "/api/chat/stream", summary: "Chat (streaming SSE)",
    desc: "Send a message and receive a streaming Server-Sent Events response. Each event contains a text chunk.",
    example: `curl -N -X POST https://frootai-chatbot-api.azurewebsites.net/api/chat/stream \\
  -H "Content-Type: application/json" \\
  -d '{"message": "What is RAG?"}' \\
  --no-buffer`,
    response: `data: {"chunk":"## "}
data: {"chunk":"RAG "}
data: {"chunk":"Architecture\\n"}
...
data: [DONE]`,
  },
  {
    method: "GET", path: "/api/openapi.json", summary: "OpenAPI specification",
    desc: "Returns the full OpenAPI 3.1 specification for this API.",
    example: `curl https://frootai-chatbot-api.azurewebsites.net/api/openapi.json`,
    response: `{ "openapi": "3.1.0", "info": { "title": "FrootAI Chatbot API", ... } }`,
  },
];

export default function APIReferencePage(): JSX.Element {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <Layout title="API Reference — FrootAI" description="REST API documentation for FrootAI Chatbot API — search plays, estimate costs, chat with Agent FAI.">
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px 80px" }}>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "8px" }}>📡 API Reference</h1>
        <p style={{ fontSize: "0.95rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "12px" }}>
          REST API for the FrootAI Chatbot — search plays, estimate costs, and chat with Agent FAI.
        </p>
        <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-400)", marginBottom: "32px" }}>
          Base URL: <code style={{ color: "#10b981" }}>https://frootai-chatbot-api.azurewebsites.net</code>
          &nbsp;·&nbsp; Rate limit: 60 req/min &nbsp;·&nbsp;
          <a href="https://frootai-chatbot-api.azurewebsites.net/api/openapi.json" style={{ color: "#6366f1" }}>OpenAPI Spec ↗</a>
        </p>

        {/* ══ ENDPOINTS ══ */}
        {endpoints.map((ep, i) => (
          <div key={i} style={cardStyle}>
            <div
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
            >
              <span style={methodBadge(ep.method)}>{ep.method}</span>
              <code style={{ fontSize: "0.88rem", fontWeight: 600 }}>{ep.path}</code>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)" }}>{ep.summary}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--ifm-color-emphasis-400)" }}>{expandedIdx === i ? "▾" : "▸"}</span>
            </div>

            {expandedIdx === i && (
              <div style={{ marginTop: "16px" }}>
                <p style={{ fontSize: "0.85rem", marginBottom: "12px" }}>{ep.desc}</p>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" as any, color: "var(--ifm-color-emphasis-500)", marginBottom: "4px" }}>Example</p>
                <pre style={codeStyle}>{ep.example}</pre>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" as any, color: "var(--ifm-color-emphasis-500)", marginBottom: "4px" }}>Response</p>
                <pre style={codeStyle}>{ep.response}</pre>
              </div>
            )}
          </div>
        ))}

        {/* ══ RATE LIMITING ══ */}
        <h2 style={h2Style}>🛡️ Rate Limiting</h2>
        <div style={cardStyle}>
          <p style={{ fontSize: "0.88rem" }}>
            All endpoints are rate-limited to <strong>60 requests per minute</strong> per IP address.
          </p>
          <p style={{ fontSize: "0.85rem", marginTop: "8px" }}>
            Exceeding the limit returns <code>429 Too Many Requests</code>:
          </p>
          <pre style={codeStyle}>{`{ "error": "Rate limit exceeded. Max 60 requests per minute." }`}</pre>
        </div>

        {/* ══ LINKS ══ */}
        <h2 style={h2Style}>📎 Related</h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link to="/cli" style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.04)", color: "var(--ifm-font-color-base)", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none" }}>⚡ CLI</Link>
          <Link to="/mcp-tooling" style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.04)", color: "var(--ifm-font-color-base)", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none" }}>🔌 23 MCP tools</Link>
          <Link to="/setup-guide" style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid rgba(249,115,22,0.3)", background: "rgba(249,115,22,0.04)", color: "var(--ifm-font-color-base)", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none" }}>📦 Setup Guide</Link>
        </div>
      </div>
    </Layout>
  );
}
