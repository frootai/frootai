"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { GlowPill } from "@/components/ui/glow-pill";

const plays: Record<string, { id: string; name: string; icon: string; desc: string; infra: string; tune: string; cx: string; status: string; github: string }> = {
  "01": { id: "01", name: "Enterprise RAG Q&A", icon: "", desc: "Production RAG — AI Search + OpenAI + Container Apps.", infra: "AI Search · Azure OpenAI · Container Apps · Blob", tune: "temperature · top-k · chunk size · reranking", cx: "Medium", status: "Ready", github: "01-enterprise-rag" },
  "02": { id: "02", name: "AI Landing Zone", icon: "", desc: "Foundational Azure infra for AI — VNet, private endpoints, RBAC.", infra: "VNet · Private Endpoints · RBAC · Managed Identity", tune: "Network config · SKUs · GPU quota", cx: "Foundation", status: "Ready", github: "02-ai-landing-zone" },
  "03": { id: "03", name: "Deterministic Agent", icon: "", desc: "Reliable agent — temp=0, structured JSON, guardrails.", infra: "Container Apps · Azure OpenAI · Content Safety", tune: "temperature=0 · JSON schema · seed · confidence", cx: "Medium", status: "Ready", github: "03-deterministic-agent" },
  "04": { id: "04", name: "Call Center Voice AI", icon: "", desc: "Voice-enabled customer service.", infra: "Communication Services · AI Speech · Azure OpenAI", tune: "Speech config · grounding prompts", cx: "High", status: "Skeleton", github: "04-call-center-voice-ai" },
  "05": { id: "05", name: "IT Ticket Resolution", icon: "", desc: "Auto-classify, route, resolve IT tickets.", infra: "Logic Apps · Azure OpenAI · ServiceNow MCP", tune: "Classification prompts · routing rules", cx: "Medium", status: "Skeleton", github: "05-it-ticket-resolution" },
  "06": { id: "06", name: "Document Intelligence", icon: "", desc: "Extract, classify, structure document data.", infra: "Blob · Document Intelligence · Azure OpenAI · Cosmos DB", tune: "Extraction prompts · field schemas", cx: "Medium", status: "Skeleton", github: "06-document-intelligence" },
  "07": { id: "07", name: "Multi-Agent Service", icon: "", desc: "Supervisor agent routes to specialists.", infra: "Container Apps · Azure OpenAI · Cosmos DB · Dapr", tune: "Supervisor routing · tool schemas", cx: "High", status: "Skeleton", github: "07-multi-agent-service" },
  "08": { id: "08", name: "Copilot Studio Bot", icon: "", desc: "Low-code enterprise bot.", infra: "Copilot Studio · Dataverse · SharePoint", tune: "Topic design · knowledge sources", cx: "Low", status: "Skeleton", github: "08-copilot-studio-bot" },
  "09": { id: "09", name: "AI Search Portal", icon: "", desc: "Enterprise search with semantic ranking.", infra: "AI Search · App Service · Azure OpenAI", tune: "Hybrid weights · scoring profiles", cx: "Medium", status: "Skeleton", github: "09-ai-search-portal" },
  "10": { id: "10", name: "Content Moderation", icon: "", desc: "Filter harmful content.", infra: "Content Safety · APIM · Azure Functions", tune: "Severity levels · blocklists", cx: "Low", status: "Skeleton", github: "10-content-moderation" },
  "11": { id: "11", name: "Landing Zone Advanced", icon: "", desc: "Multi-region enterprise AI landing zone.", infra: "Multi-region VNet · Azure Policy · RBAC", tune: "Governance policies · multi-region config", cx: "High", status: "Skeleton", github: "11-ai-landing-zone-advanced" },
  "12": { id: "12", name: "Model Serving AKS", icon: "", desc: "Deploy LLMs on AKS with vLLM.", infra: "AKS · vLLM · NVIDIA GPU · ACR", tune: "Quantization · batching · scaling", cx: "High", status: "Skeleton", github: "12-model-serving-aks" },
  "13": { id: "13", name: "Fine-Tuning Workflow", icon: "", desc: "End-to-end fine-tuning with LoRA.", infra: "AI Foundry · GPU Compute · MLflow", tune: "LoRA rank · learning rate · epochs", cx: "High", status: "Skeleton", github: "13-fine-tuning-workflow" },
  "14": { id: "14", name: "Cost-Optimized AI Gateway", icon: "", desc: "APIM-based AI gateway with caching.", infra: "APIM · Redis Cache · Azure OpenAI", tune: "Token budgets · caching rules", cx: "Medium", status: "Skeleton", github: "14-cost-optimized-ai-gateway" },
  "15": { id: "15", name: "Multi-Modal DocProc", icon: "", desc: "Process docs with GPT-4o multi-modal.", infra: "GPT-4o · Blob · Cosmos DB · Functions", tune: "Image prompts · extraction schemas", cx: "Medium", status: "Skeleton", github: "15-multi-modal-docproc" },
  "16": { id: "16", name: "Copilot Teams Extension", icon: "", desc: "M365 Copilot extension with Graph API.", infra: "M365 Copilot · Graph API · Azure Functions", tune: "Declarative agent config · permissions", cx: "Medium", status: "Skeleton", github: "16-copilot-teams-extension" },
  "17": { id: "17", name: "AI Observability", icon: "", desc: "Monitor AI with KQL and workbooks.", infra: "App Insights · Log Analytics · Monitor", tune: "KQL queries · alert thresholds", cx: "Medium", status: "Skeleton", github: "17-ai-observability" },
  "18": { id: "18", name: "Prompt Management", icon: "", desc: "Version control and A/B test prompts.", infra: "Prompt Flow · Git · GitHub Actions", tune: "Prompt versions · A/B weights", cx: "Medium", status: "Skeleton", github: "18-prompt-management" },
  "19": { id: "19", name: "Edge AI Phi-4", icon: "", desc: "Deploy Phi-4 on edge with ONNX.", infra: "IoT Hub · Container Instances · ONNX", tune: "Quantization level · sync schedule", cx: "High", status: "Skeleton", github: "19-edge-ai-phi4" },
  "20": { id: "20", name: "Anomaly Detection", icon: "", desc: "Real-time anomaly detection.", infra: "Event Hub · Stream Analytics · Azure OpenAI", tune: "Threshold config · detection windows", cx: "High", status: "Skeleton", github: "20-anomaly-detection" },
};

function UserGuideContent() {
  const params = useSearchParams();
  const playId = params.get("play") || "01";
  const play = plays[playId];

  if (!play) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-3">Play not found</h1>
        <p className="text-fg-muted mb-5">Use ?play=01 through ?play=20</p>
        <GlowPill href="/solution-plays" color="#7c3aed">← Back to Solution Plays</GlowPill>
      </div>
    );
  }

  const ghBase = `https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/${play.github}`;
  const isReady = play.status === "Ready";

  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 py-12 sm:py-16">
      {/* Header */}
      <FadeIn>
        <div className="text-center mb-10">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Solution Play {play.id} — {play.name}</h1>
          <p className="mt-2 text-sm text-fg-muted max-w-xl mx-auto">Complete user guide: from zero to production. {play.desc}</p>
          <div className="flex gap-1.5 justify-center mt-3">
            <Badge label={play.status} color={isReady ? "#10b981" : "#f59e0b"} />
            <Badge label={play.cx} color="#6366f1" />
          </div>
        </div>
      </FadeIn>

      {/* Overview */}
      <FadeIn delay={0.05}>
        <Card className="border-emerald/20 bg-emerald/[0.01] mb-8">
          <h2 className="font-bold text-sm mb-2">What You&apos;ll Build</h2>
          <p className="text-[13px] text-fg-muted mb-2">{play.desc}</p>
          <div className="text-[12px] text-fg-dim space-y-1">
            <div><span className="font-semibold text-fg-muted">Infra:</span> {play.infra}</div>
            <div><span className="font-semibold text-fg-muted">Tuning:</span> {play.tune}</div>
          </div>
        </Card>
      </FadeIn>

      {/* Step 1 */}
      <FadeIn delay={0.1}>
        <h2 className="text-lg font-bold mb-3">Step 1: Open VS Code Extension</h2>
        <Card className="mb-6">
          <p className="text-[13px] text-fg-muted mb-2">Install FrootAI if needed:</p>
          <CodeBlock code="code --install-extension pavleenbali.frootai" label="Terminal" labelColor="#10b981" />
          <p className="mt-3 text-[13px] text-fg-muted">Open sidebar (tree icon). Find <strong className="text-fg">{play.id} — {play.name}</strong> in Solution Plays.</p>
        </Card>
      </FadeIn>

      {/* Step 2 */}
      <FadeIn delay={0.15}>
        <h2 className="text-lg font-bold mb-3">Step 2: Initialize DevKit</h2>
        <Card className="border-cyan/20 bg-cyan/[0.01] mb-6">
          <p className="text-[13px] text-fg-muted mb-2"><strong className="text-fg">Left-click</strong> on the play → select <strong className="text-fg">Init DevKit</strong></p>
          <p className="text-[13px] text-fg-muted mb-2">FrootAI copies the <strong className="text-fg">full .github Agentic OS</strong> (19 files):</p>
          <ul className="text-[12px] text-fg-muted space-y-1 list-disc pl-5">
            <li><strong className="text-cyan">Layer 1:</strong> Instructions (coding standards, security)</li>
            <li><strong className="text-cyan">Layer 2:</strong> Prompts (/deploy, /test, /review, /evaluate)</li>
            <li><strong className="text-cyan">Layer 2:</strong> Agents (builder → reviewer → tuner)</li>
            <li><strong className="text-cyan">Layer 2:</strong> Skills (deploy-azure, evaluate, tune)</li>
            <li><strong className="text-indigo">Layer 3:</strong> Hooks (guardrails.json) + Workflows</li>
          </ul>
          <p className="mt-2 text-[12px] text-fg-muted">+ agent.md, .vscode/mcp.json, plugin.json</p>
        </Card>
      </FadeIn>

      {/* Step 3 */}
      <FadeIn delay={0.2}>
        <h2 className="text-lg font-bold mb-3">Step 3: Initialize TuneKit</h2>
        <Card className="border-violet/20 bg-violet/[0.01] mb-6">
          <p className="text-[13px] text-fg-muted mb-2">Left-click again → select <strong className="text-fg">Init TuneKit</strong></p>
          <ul className="text-[12px] text-fg-muted space-y-1 list-disc pl-5">
            <li><code className="rounded bg-violet/10 px-1 py-0.5 text-[11px] text-violet font-mono">config/openai.json</code> — AI model parameters ({play.tune})</li>
            <li><code className="rounded bg-violet/10 px-1 py-0.5 text-[11px] text-violet font-mono">config/guardrails.json</code> — safety rules, PII, abstention</li>
            <li><code className="rounded bg-violet/10 px-1 py-0.5 text-[11px] text-violet font-mono">infra/main.bicep</code> — Azure deploy ({play.infra})</li>
            <li><code className="rounded bg-violet/10 px-1 py-0.5 text-[11px] text-violet font-mono">evaluation/</code> — test set + automated scoring</li>
          </ul>
        </Card>
      </FadeIn>

      {/* Step 4 */}
      <FadeIn delay={0.25}>
        <h2 className="text-lg font-bold mb-3">Step 4: Use MCP Tools</h2>
        <Card className="mb-6">
          <p className="text-[13px] text-fg-muted">Open <strong className="text-fg">Copilot Chat</strong> → enable <strong className="text-fg">FrootAI</strong> in tools. Ask questions about {play.name}.</p>
        </Card>
      </FadeIn>

      {/* Step 5 */}
      <FadeIn delay={0.3}>
        <h2 className="text-lg font-bold mb-3">Step 5: Auto-Chain Agents</h2>
        <Card className="border-amber/20 bg-amber/[0.01] mb-6">
          <p className="text-[13px] text-fg-muted mb-2">Run <code className="rounded bg-amber/10 px-1.5 py-0.5 text-[11px] text-amber font-mono">Ctrl+Shift+P → FrootAI: Auto-Chain Agents</code></p>
          <ol className="text-[13px] text-fg-muted space-y-1 list-decimal pl-5">
            <li><strong className="text-fg">Builder</strong> — describe what to build → paste in Copilot Chat</li>
            <li><strong className="text-fg">Reviewer</strong> — auto-reviews for security, quality</li>
            <li><strong className="text-fg">Tuner</strong> — validates TuneKit configs</li>
            <li><strong className="text-fg">Deploy</strong> — optional /deploy walkthrough</li>
          </ol>
        </Card>
      </FadeIn>

      {/* Step 6 */}
      <FadeIn delay={0.35}>
        <h2 className="text-lg font-bold mb-3">Step 6: Validate & Deploy</h2>
        <Card className="mb-8">
          <ul className="text-[13px] text-fg-muted space-y-1 list-disc pl-5">
            <li><strong className="text-fg">/review</strong> — Security + quality checklist</li>
            <li><strong className="text-fg">/evaluate</strong> — Run evaluation pipeline</li>
            <li><strong className="text-fg">/deploy</strong> — Azure deployment walkthrough</li>
          </ul>
        </Card>
      </FadeIn>

      {/* Summary */}
      <FadeIn delay={0.4}>
        <Card className="text-center mb-8">
          <h3 className="font-bold text-sm mb-2">What You Just Did</h3>
          <p className="text-[13px] text-fg-muted leading-relaxed">
            <strong className="text-fg">Init DevKit</strong> → .github Agentic OS (19 files)<br />
            <strong className="text-fg">Init TuneKit</strong> → config + infra + evaluation<br />
            <strong className="text-fg">Auto-Chain</strong> → Build → Review → Tune → Deploy<br />
            <strong className="text-fg">Result</strong> → Production-ready {play.name}
          </p>
        </Card>
      </FadeIn>

      {/* Nav */}
      <div className="flex flex-wrap justify-center gap-2">
        <GlowPill href={ghBase} color="#6366f1" external>GitHub</GlowPill>
        <GlowPill href="/solution-plays" color="#7c3aed">All Plays</GlowPill>
        <GlowPill href="/" color="#f59e0b">FrootAI</GlowPill>
      </div>
    </div>
  );
}

export function UserGuideClient() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[40vh] text-fg-dim">Loading guide...</div>}>
      <UserGuideContent />
    </Suspense>
  );
}
