import React, { useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

const plays = [
  { id: "01", name: "Enterprise RAG Q&A", icon: "🔍", status: "Ready", cx: "Medium", desc: "Production RAG — AI Search + OpenAI + Container Apps. Pre-tuned: temp=0.1, hybrid 60/40, top-k=5, semantic reranker.", infra: "AI Search · Azure OpenAI · Container Apps · Blob", tune: "temperature · top-k · chunk size · reranking · relevance threshold", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/01-enterprise-rag",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/search.json", "config/chunking.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "1. Clone repo → cd solution-plays/01-enterprise-rag\n2. Open in VS Code → Copilot is RAG-aware (reads agent.md + copilot-instructions)\n3. MCP auto-connects via .vscode/mcp.json\n4. Build: Co-coder fills skeleton using DevKit context\n5. Tune: Review config/*.json → adjust knobs per your data\n6. Deploy: az deployment group create --template-file infra/main.bicep\n7. Evaluate: python evaluation/eval.py → verify quality targets\n8. Ship it." },
  { id: "02", name: "AI Landing Zone", icon: "⛰️", status: "Ready", cx: "Foundation", desc: "Foundational Azure infra for AI — VNet, private endpoints, managed identity, RBAC, GPU quotas.", infra: "VNet · Private Endpoints · RBAC · Managed Identity · Key Vault", tune: "Network config · service SKUs · GPU quota · region", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/02-ai-landing-zone",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/landing-zone.json", "config/openai.json", "config/guardrails.json", "infra/main.bicep"],
    guide: "1. Clone → cd solution-plays/02-ai-landing-zone\n2. Review config/landing-zone.json → set CIDR, SKUs, region\n3. Deploy: az deployment group create --template-file infra/main.bicep\n4. Verify: all services have private endpoints + managed identity\n5. Layer other solution plays on top." },
  { id: "03", name: "Deterministic Agent", icon: "🎯", status: "Ready", cx: "Medium", desc: "Reliable agent — temp=0, structured JSON, multi-layer guardrails, anti-sycophancy, evaluation.", infra: "Container Apps · Azure OpenAI · Content Safety", tune: "temperature=0 · JSON schema · seed · confidence · citations", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/03-deterministic-agent",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "1. Clone → cd solution-plays/03-deterministic-agent\n2. Review agent.md → understand anti-sycophancy + abstention rules\n3. Build: Co-coder implements guardrail pipeline using DevKit\n4. Tune: config/openai.json has temp=0, seed=42, strict schema\n5. Evaluate: python evaluation/eval.py → consistency >95%, groundedness >0.95\n6. Ship when all green." },
  { id: "04", name: "Call Center Voice AI", icon: "📞", status: "Skeleton", cx: "High", desc: "Voice-enabled customer service — Communication Services + AI Speech + OpenAI Agent.", infra: "Communication Services · AI Speech · Azure OpenAI · Container Apps", tune: "Speech config · grounding prompts · fallback chains · voice personality", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/04-call-center-voice-ai",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready. DevKit + TuneKit files present. Open in VS Code → co-coder fills implementation." },
  { id: "05", name: "IT Ticket Resolution", icon: "🎫", status: "Skeleton", cx: "Medium", desc: "Auto-classify, route, and resolve IT tickets — Logic Apps + AI Foundry + ServiceNow MCP.", infra: "Logic Apps · Azure OpenAI · ServiceNow MCP · Container Apps", tune: "Classification prompts · routing rules · confidence thresholds", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/05-it-ticket-resolution",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready. DevKit + TuneKit files present. Open in VS Code → co-coder fills implementation." },
  { id: "06", name: "Document Intelligence", icon: "📄", status: "Skeleton", cx: "Medium", desc: "Extract, classify, and structure document data — Blob + Doc Intelligence + OpenAI.", infra: "Blob Storage · Document Intelligence · Azure OpenAI · Cosmos DB", tune: "Extraction prompts · confidence thresholds · field schemas", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/06-document-intelligence",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready. DevKit + TuneKit files present." },
  { id: "07", name: "Multi-Agent Service", icon: "🤖", status: "Skeleton", cx: "High", desc: "Supervisor agent routes to specialists — Container Apps + Agent Framework + Dapr.", infra: "Container Apps · Azure OpenAI · Cosmos DB · Dapr", tune: "Supervisor routing · tool schemas · agent memory · handoff rules", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/07-multi-agent-service",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready." },
  { id: "08", name: "Copilot Studio Bot", icon: "💬", status: "Skeleton", cx: "Low", desc: "Low-code enterprise bot — Copilot Studio + Dataverse + SharePoint.", infra: "Copilot Studio · Dataverse · SharePoint · Power Platform", tune: "Topic design · knowledge sources · guardrails · flow", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/08-copilot-studio-bot",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready." },
  { id: "09", name: "AI Search Portal", icon: "🔎", status: "Skeleton", cx: "Medium", desc: "Enterprise search — AI Search + Web App + Semantic Ranking.", infra: "AI Search · App Service · Azure OpenAI · Blob Storage", tune: "Hybrid weights · semantic config · scoring profiles · filters", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/09-ai-search-portal",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready." },
  { id: "10", name: "Content Moderation", icon: "🛡️", status: "Skeleton", cx: "Low", desc: "Filter harmful content — AI Content Safety + APIM + Functions.", infra: "Content Safety · API Management · Azure Functions", tune: "Severity levels · custom categories · blocklists · actions", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/10-content-moderation",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready." },
  { id: "11", name: "Landing Zone Advanced", icon: "🏔️", status: "Skeleton", cx: "High", desc: "Multi-region, policy-driven, enterprise-grade AI landing zone with governance at scale.", infra: "Multi-region VNet · Azure Policy · PE · RBAC · GPU Quota", tune: "Governance policies · multi-region config · advanced RBAC", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/11-ai-landing-zone-advanced",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready. Advanced landing zone with multi-region + policy." },
  { id: "12", name: "Model Serving AKS", icon: "⚙️", status: "Skeleton", cx: "High", desc: "Deploy and serve LLMs on AKS with vLLM, GPU nodes, and auto-scaling.", infra: "AKS · vLLM · NVIDIA GPU · Container Registry", tune: "Quantization · batching · scaling rules · model config", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/12-model-serving-aks",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready. AKS + vLLM + GPU model serving." },
  { id: "13", name: "Fine-Tuning Workflow", icon: "🔬", status: "Skeleton", cx: "High", desc: "End-to-end fine-tuning — data prep, LoRA training, evaluation, deployment.", infra: "AI Foundry · GPU Compute · Storage · MLflow", tune: "LoRA rank · learning rate · epochs · eval metrics", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/13-fine-tuning-workflow",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready. LoRA fine-tuning pipeline." },
  { id: "14", name: "AI Gateway", icon: "🚪", status: "Skeleton", cx: "Medium", desc: "APIM-based AI gateway with semantic caching, load balancing, and token budgets.", infra: "API Management · Redis Cache · Azure OpenAI (multi-region)", tune: "Token budgets · caching rules · fallback chain · rate limits", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/14-cost-optimized-ai-gateway",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready. APIM AI gateway with caching." },
  { id: "15", name: "Multi-Modal DocProc", icon: "🖼️", status: "Skeleton", cx: "Medium", desc: "Process documents with text + images using GPT-4o multi-modal capabilities.", infra: "GPT-4o · Blob Storage · Cosmos DB · Functions", tune: "Image prompts · extraction schemas · confidence thresholds", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/15-multi-modal-docproc",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready." },
  { id: "16", name: "Copilot Teams Extension", icon: "👥", status: "Skeleton", cx: "Medium", desc: "M365 Copilot extension with Graph API and declarative agents.", infra: "M365 Copilot · Graph API · Azure Functions · App Reg", tune: "Declarative agent config · permissions · scoping", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/16-copilot-teams-extension",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready." },
  { id: "17", name: "AI Observability", icon: "📊", status: "Skeleton", cx: "Medium", desc: "Monitor AI workloads with KQL queries, quality alerts, and workbooks.", infra: "App Insights · Log Analytics · Azure Monitor · Workbooks", tune: "KQL queries · alert thresholds · quality metrics", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/17-ai-observability",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready." },
  { id: "18", name: "Prompt Management", icon: "📝", status: "Skeleton", cx: "Medium", desc: "Version control, A/B test, and rollback prompts across environments.", infra: "Prompt Flow · Git · GitHub Actions · AI Foundry", tune: "Prompt versions · A/B weights · rollback rules", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/18-prompt-management",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready." },
  { id: "19", name: "Edge AI Phi-4", icon: "📱", status: "Skeleton", cx: "High", desc: "Deploy Phi-4 on edge devices with ONNX quantization and local serving.", infra: "IoT Hub · Container Instances · ONNX Runtime · Edge", tune: "Quantization level · model config · sync schedule", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/19-edge-ai-phi4",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready." },
  { id: "20", name: "Anomaly Detection", icon: "🚨", status: "Skeleton", cx: "High", desc: "Detect anomalies in real-time streams — Event Hub + AI analysis.", infra: "Event Hub · Stream Analytics · Azure OpenAI · Functions", tune: "Threshold config · alert prompts · detection windows", github: "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/20-anomaly-detection",
    devkitFiles: ["agent.md", "instructions.md", "copilot-instructions.md", ".vscode/mcp.json", "mcp/index.js", "plugins/"],
    tunekitFiles: ["config/openai.json", "config/guardrails.json", "infra/main.bicep", "evaluation/"],
    guide: "Skeleton ready." },
];

function PlayCard({ play }: { play: typeof plays[0] }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const isReady = play.status === "Ready";
  return (
    <div style={{ padding: "20px 24px", borderRadius: "16px", border: "1px solid var(--ifm-color-emphasis-200)", background: "var(--ifm-background-surface-color)", marginBottom: "16px", transition: "border-color 0.2s ease" }} onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)")} onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--ifm-color-emphasis-200)")}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 4px" }}>{play.icon} {play.id} — {play.name}</h3>
          <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: "8px", background: isReady ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", color: isReady ? "#10b981" : "#f59e0b", fontWeight: 600 }}>{play.status}</span>
            <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: "8px", background: "rgba(99,102,241,0.1)", color: "#6366f1", fontWeight: 600 }}>{play.cx}</span>
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--ifm-color-emphasis-500)", lineHeight: 1.5, margin: "0 0 8px" }}>{play.desc}</p>
          <div style={{ fontSize: "0.72rem", color: "var(--ifm-color-emphasis-400)", marginBottom: "4px" }}><strong>Infra:</strong> {play.infra}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--ifm-color-emphasis-400)" }}><strong>Tuning:</strong> {play.tune}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
          <Link to={play.github} className="glow-btn glow-btn-github">GitHub</Link>
          <Link to={`${play.github}#-devkit--developer-velocity-ecosystem`} className="glow-btn glow-btn-devkit">🛠️ DevKit</Link>
          <Link to={`${play.github}#-tunekit--ai-fine-tuning-ecosystem`} className="glow-btn glow-btn-tunekit">🎛️ TuneKit</Link>
        </div>
      </div>
      {/* Expandable user guide */}
      <div style={{ marginTop: "12px", borderTop: "1px solid var(--ifm-color-emphasis-100)", paddingTop: "8px" }}>
        <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", color: "#10b981", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", padding: 0 }}>
          {expanded ? "▼ Hide User Guide" : "▶ Show User Guide"}
        </button>
        {expanded && (
          <div style={{ marginTop: "8px", padding: "12px 16px", borderRadius: "10px", background: "var(--ifm-color-emphasis-100)", fontSize: "0.78rem", lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "var(--ifm-font-family-monospace)" }}>
            {play.guide}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SolutionPlaysPage(): JSX.Element {
  return (
    <Layout title="Solution Plays — FrootAI" description="Pre-tuned deployable AI solutions. DevKit empowers the builder. TuneKit ships it to production.">
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>🎯 Solution Plays</h1>
          <p style={{ fontSize: "0.92rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "660px", margin: "0 auto 16px" }}>
            Each play ships with the full <strong>.github Agentic OS</strong> (19 files, 4 layers), <strong>🛠️ DevKit</strong> (empower your coding agent), and <strong>🎛️ TuneKit</strong> (fine-tune AI for production). LEGO blocks that compose into complete solutions.
          </p>
        </div>

        {/* .github Agentic OS + DevKit + TuneKit Explainer */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px", marginBottom: "32px", padding: "6px 0" }}>
          {/* .github Agentic OS */}
          <div style={{ padding: "20px", borderRadius: "16px", border: "2px solid rgba(16, 185, 129, 0.25)", background: "rgba(16, 185, 129, 0.03)", textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>🧠</div>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "10px" }}>.github Agentic OS</h3>
            <div style={{ textAlign: "left", fontSize: "0.78rem", lineHeight: 1.7 }}>
              <div><strong style={{ color: "#10b981" }}>Layer 1</strong> — Instructions (always-on context)</div>
              <div><strong style={{ color: "#10b981" }}>Layer 2</strong> — Prompts, Agents, Skills</div>
              <div><strong style={{ color: "#10b981" }}>Layer 3</strong> — Hooks + Workflows (CI/CD)</div>
              <div><strong style={{ color: "#10b981" }}>Layer 4</strong> — Plugin packaging</div>
            </div>
            <p style={{ fontSize: "0.68rem", color: "var(--ifm-color-emphasis-400)", marginTop: "10px", marginBottom: 0, fontStyle: "italic" }}>19 files per play · 7 primitives · 4 layers</p>
          </div>
          {/* DevKit */}
          <div style={{ padding: "20px", borderRadius: "16px", border: "2px solid rgba(6, 182, 212, 0.25)", background: "rgba(6, 182, 212, 0.03)", textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>🛠️</div>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "10px" }}>DevKit — Velocity</h3>
            <div style={{ textAlign: "left", fontSize: "0.78rem", lineHeight: 1.7 }}>
              <div><strong style={{ color: "#06b6d4" }}>agent.md</strong> — solution-aware co-coder</div>
              <div><strong style={{ color: "#06b6d4" }}>instructions.md</strong> — prompts, guardrails</div>
              <div><strong style={{ color: "#06b6d4" }}>MCP server</strong> — query while coding</div>
              <div><strong style={{ color: "#06b6d4" }}>plugins</strong> — reusable functions</div>
            </div>
            <p style={{ fontSize: "0.68rem", color: "var(--ifm-color-emphasis-400)", marginTop: "10px", marginBottom: 0, fontStyle: "italic" }}>Your agent knows the solution before you code.</p>
          </div>
          {/* TuneKit */}
          <div style={{ padding: "20px", borderRadius: "16px", border: "2px solid rgba(124, 58, 237, 0.25)", background: "rgba(124, 58, 237, 0.03)", textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>🎛️</div>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "10px" }}>TuneKit — Ship It</h3>
            <div style={{ textAlign: "left", fontSize: "0.78rem", lineHeight: 1.7 }}>
              <div><strong style={{ color: "#7c3aed" }}>config/*.json</strong> — pre-tuned AI knobs</div>
              <div><strong style={{ color: "#7c3aed" }}>infra/main.bicep</strong> — one-click deploy</div>
              <div><strong style={{ color: "#7c3aed" }}>evaluation/</strong> — test + score</div>
              <div><strong style={{ color: "#7c3aed" }}>guardrails</strong> — safety, PII, abstention</div>
            </div>
            <p style={{ fontSize: "0.68rem", color: "var(--ifm-color-emphasis-400)", marginTop: "10px", marginBottom: 0, fontStyle: "italic" }}>Every knob pre-calibrated for production.</p>
          </div>
        </div>

        <p style={{ fontSize: "0.78rem", color: "var(--ifm-color-emphasis-400)", textAlign: "center", marginBottom: "24px" }}>
          {plays.filter(p => p.status === "Ready").length} ready · {plays.filter(p => p.status === "Skeleton").length} skeleton · {plays.length} total
        </p>
        {plays.map((p) => <PlayCard key={p.id} play={p} />)}
        <div style={{ textAlign: "center", marginTop: "32px", display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", padding: "6px 0" }}>
          <Link to="/ecosystem" className={styles.glowPill} style={{ "--pill-color": "#10b981", display: "inline-block" } as React.CSSProperties}>
            🔗 Back to Ecosystem
          </Link>
          <Link to="/" className={styles.glowPill} style={{ "--pill-color": "#f59e0b", display: "inline-block" } as React.CSSProperties}>
            🌳 Back to FrootAI
          </Link>
        </div>
      </div>
    </Layout>
  );
}
