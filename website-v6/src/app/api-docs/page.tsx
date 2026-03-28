import type { Metadata } from "next";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeader } from "@/components/ui/section-header";
import { CodeBlock } from "@/components/ui/code-block";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GlowPill } from "@/components/ui/glow-pill";

export const metadata: Metadata = { title: "REST API", description: "FrootAI REST API endpoints for Agent FAI chatbot, play search, and cost estimation." };

const endpoints = [
  { method: "POST", path: "/api/chat", desc: "Send a message to Agent FAI (non-streaming)", body: '{ "message": "How do I build a RAG pipeline?", "history": [...] }', response: '{ "reply": "For RAG pipelines, use Play 01..." }' },
  { method: "POST", path: "/api/chat/stream", desc: "SSE streaming response from Agent FAI (GPT-4.1)", body: '{ "message": "Compare Play 01 vs 09", "history": [...] }', response: 'data: {"content":"For"}\ndata: {"content":" RAG"}\n...\ndata: [DONE]' },
  { method: "POST", path: "/api/search-plays", desc: "Semantic search across 20 solution plays", body: '{ "query": "document processing" }', response: '{ "results": [{ "id": "06", "name": "Document Intelligence", "score": 0.92 }] }' },
  { method: "POST", path: "/api/estimate-cost", desc: "Estimate monthly Azure cost for a solution play", body: '{ "play": "01", "scale": "dev" }', response: '{ "play": { "id": "01", "name": "Enterprise RAG" }, "scale": "dev", "items": [...], "total": 245 }' },
  { method: "GET", path: "/api/health", desc: "Health check endpoint", body: "N/A", response: '{ "status": "ok", "version": "3.0.1" }' },
  { method: "GET", path: "/api/plays", desc: "List all 20 solution plays with metadata", body: "N/A", response: '{ "plays": [{ "id": "01", "name": "Enterprise RAG", "status": "Ready" }, ...] }' },
];

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader
        badge="REST API"
        badgeColor="#6366f1"
        title="Agent FAI — REST API"
        subtitle="6 endpoints powering the FrootAI chatbot, play search, and cost estimation."
      />

      <FadeIn>
        <p className="text-[13px] text-fg-muted mb-2">Base URL:</p>
        <CodeBlock label="API Base" labelColor="#6366f1" code="https://frootai-chatbot-api.azurewebsites.net" className="mb-10" />
      </FadeIn>

      <div className="space-y-8">
        {endpoints.map((ep, i) => (
          <FadeIn key={ep.path} delay={i * 0.04}>
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Badge label={ep.method} color={ep.method === "POST" ? "#f59e0b" : "#10b981"} />
                <code className="text-sm font-bold font-mono">{ep.path}</code>
              </div>
              <p className="text-[13px] text-fg-muted mb-3">{ep.desc}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-fg-dim mb-1.5">Request</p>
                  <pre className="rounded-lg bg-bg/60 border border-border-subtle p-3 text-[11px] font-mono text-fg-muted overflow-x-auto leading-relaxed whitespace-pre-wrap">{ep.body}</pre>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-fg-dim mb-1.5">Response</p>
                  <pre className="rounded-lg bg-bg/60 border border-border-subtle p-3 text-[11px] font-mono text-fg-muted overflow-x-auto leading-relaxed whitespace-pre-wrap">{ep.response}</pre>
                </div>
              </div>
            </Card>
          </FadeIn>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap justify-center gap-2">
        <GlowPill href="/chatbot" color="#f59e0b">Try Agent FAI</GlowPill>
        <GlowPill href="/dev-hub" color="#6366f1">Developer Hub</GlowPill>
        <GlowPill href="/" color="#10b981">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
