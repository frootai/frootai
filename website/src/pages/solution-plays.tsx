import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";

const plays = [
  {
    id: "01", name: "Enterprise RAG Q&A", icon: "🔍", status: "Ready", complexity: "Medium",
    desc: "Production RAG pipeline — AI Search + OpenAI + Container App. Pre-tuned: temp=0.1, hybrid search 60/40, top-k=5, semantic reranker.",
    infra: "AI Search · Azure OpenAI · Container Apps · Blob Storage",
    tuning: "temperature · top-k · chunk size · reranking · relevance threshold",
    files: ["agent.md", "instructions.md", "config/openai.json", "config/search.json", "config/chunking.json", "config/guardrails.json", "infra/main.bicep", "evaluation/eval.py", "mcp/index.js"],
    github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/01-enterprise-rag",
  },
  {
    id: "02", name: "AI Landing Zone", icon: "⛰️", status: "Ready", complexity: "Foundation",
    desc: "Foundational Azure infrastructure for all AI workloads. VNet, private endpoints, managed identity, RBAC, GPU quotas, core AI services.",
    infra: "VNet · Private Endpoints · RBAC · Managed Identity · Key Vault",
    tuning: "N/A (infra only — the bedrock for other solution plays)",
    files: ["infra/main.bicep", "infra/parameters.json", "config/landing-zone.json"],
    github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/02-ai-landing-zone",
  },
  {
    id: "03", name: "Deterministic Agent", icon: "🎯", status: "Ready", complexity: "Medium",
    desc: "Reliable agent with temp=0, structured JSON output, multi-layer guardrails, anti-sycophancy, and evaluation pipeline.",
    infra: "Container Apps · Azure OpenAI · Content Safety",
    tuning: "temperature=0 · JSON schema · seed · confidence threshold · citation verification",
    files: ["agent.md", "instructions.md", "config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/eval.py"],
    github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/03-deterministic-agent",
  },
];

const upcoming = [
  { id: "04", name: "Call Center Voice AI", icon: "📞" },
  { id: "05", name: "IT Ticket Resolution", icon: "🎫" },
  { id: "06", name: "Document Intelligence", icon: "📄" },
  { id: "07", name: "Multi-Agent Service", icon: "🤖" },
  { id: "08", name: "Copilot Studio Bot", icon: "💬" },
];

export default function SolutionPlaysPage(): JSX.Element {
  return (
    <Layout title="Solution Plays — FrootAI" description="Pre-tuned, deployable AI solutions. Infrastructure + AI config + agent instructions + evaluation — one command to deploy.">
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>🎯 Solution Plays</h1>
          <p style={{ fontSize: "0.95rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "600px", margin: "0 auto" }}>
            Pre-tuned, deployable AI solutions. Each play ships with infrastructure blueprints, AI configuration,
            agent instructions, and evaluation pipeline. One command to deploy. Zero AI expertise required.
          </p>
        </div>

        {/* Available plays */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "48px" }}>
          {plays.map((play) => (
            <div key={play.id} style={{ padding: "24px", borderRadius: "16px", border: "1px solid var(--ifm-color-emphasis-200)", background: "var(--ifm-background-surface-color)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 4px" }}>
                    <span style={{ marginRight: "8px" }}>{play.icon}</span>
                    {play.id} — {play.name}
                  </h2>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={{ fontSize: "0.7rem", padding: "2px 10px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", fontWeight: 600 }}>{play.status}</span>
                    <span style={{ fontSize: "0.7rem", padding: "2px 10px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.1)", color: "#6366f1", fontWeight: 600 }}>{play.complexity}</span>
                  </div>
                </div>
                <Link to={play.github} style={{ padding: "8px 20px", borderRadius: "8px", background: "linear-gradient(135deg, #6366f1, #7c3aed)", color: "#fff", fontWeight: 600, fontSize: "0.82rem", textDecoration: "none" }}>
                  Open on GitHub
                </Link>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)", lineHeight: 1.6, marginBottom: "12px" }}>{play.desc}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ifm-color-emphasis-400)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Infrastructure</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-600)" }}>{play.infra}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ifm-color-emphasis-400)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>AI Tuning</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-600)" }}>{play.tuning}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ifm-color-emphasis-400)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Included Files</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {play.files.map((f) => (
                    <span key={f} style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "6px", background: "var(--ifm-color-emphasis-100)", fontFamily: "var(--ifm-font-family-monospace)" }}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Coming soon */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, textAlign: "center", marginBottom: "16px" }}>Coming Soon</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px", marginBottom: "40px" }}>
          {upcoming.map((p) => (
            <div key={p.id} style={{ padding: "16px", borderRadius: "12px", border: "1px dashed var(--ifm-color-emphasis-200)", textAlign: "center", opacity: 0.6 }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{p.icon}</div>
              <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{p.id} — {p.name}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center" }}>
          <Link to="/" style={{ display: "inline-block", padding: "12px 32px", borderRadius: "10px", background: "linear-gradient(135deg, #10b981, #06b6d4)", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
            ← Back to FrootAI
          </Link>
        </div>
      </div>
    </Layout>
  );
}
