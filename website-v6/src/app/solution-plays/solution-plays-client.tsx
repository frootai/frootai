"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Search, Mountain, Target, Phone, Ticket, FileText, Bot, MessageCircle, Shield, Settings, Microscope, DoorOpen, Image, Users, BarChart3, FileEdit, Smartphone, AlertTriangle, Brain, Wrench, Sliders, Ruler, type LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { Badge } from "@/components/ui/badge";
import { GlowPill } from "@/components/ui/glow-pill";
import { SectionHeader } from "@/components/ui/section-header";

/* ═══ ALL 20 PLAYS — full production data ═══ */

const plays = [
  { id: "01", name: "Enterprise RAG Q&A", Icon: Search, status: "Ready", cx: "Medium", desc: "Production RAG — AI Search + OpenAI + Container Apps. Pre-tuned: temp=0.1, hybrid 60/40, top-k=5, semantic reranker.", infra: "AI Search · Azure OpenAI · Container Apps · Blob", tune: "temperature · top-k · chunk size · reranking · relevance threshold", github: "01-enterprise-rag" },
  { id: "02", name: "AI Landing Zone", Icon: Mountain, status: "Ready", cx: "Foundation", desc: "Foundational Azure infra for AI — VNet, private endpoints, managed identity, RBAC, GPU quotas.", infra: "VNet · Private Endpoints · RBAC · Managed Identity · Key Vault", tune: "Network config · service SKUs · GPU quota · region", github: "02-ai-landing-zone" },
  { id: "03", name: "Deterministic Agent", Icon: Target, status: "Ready", cx: "Medium", desc: "Reliable agent — temp=0, structured JSON, multi-layer guardrails, anti-sycophancy, evaluation.", infra: "Container Apps · Azure OpenAI · Content Safety", tune: "temperature=0 · JSON schema · seed · confidence · citations", github: "03-deterministic-agent" },
  { id: "04", name: "Call Center Voice AI", Icon: Phone, status: "Skeleton", cx: "High", desc: "Voice-enabled customer service — Communication Services + AI Speech + OpenAI Agent.", infra: "Communication Services · AI Speech · Azure OpenAI · Container Apps", tune: "Speech config · grounding prompts · fallback chains", github: "04-call-center-voice-ai" },
  { id: "05", name: "IT Ticket Resolution", Icon: Ticket, status: "Skeleton", cx: "Medium", desc: "Auto-classify, route, and resolve IT tickets — Logic Apps + AI Foundry + ServiceNow MCP.", infra: "Logic Apps · Azure OpenAI · ServiceNow MCP · Container Apps", tune: "Classification prompts · routing rules · confidence thresholds", github: "05-it-ticket-resolution" },
  { id: "06", name: "Document Intelligence", Icon: FileText, status: "Skeleton", cx: "Medium", desc: "Extract, classify, and structure document data — Doc Intelligence + OpenAI + Cosmos DB.", infra: "Blob Storage · Document Intelligence · Azure OpenAI · Cosmos DB", tune: "Extraction prompts · confidence thresholds · field schemas", github: "06-document-intelligence" },
  { id: "07", name: "Multi-Agent Service", Icon: Bot, status: "Skeleton", cx: "High", desc: "Supervisor agent routes to specialists — Container Apps + Agent Framework + Dapr.", infra: "Container Apps · Azure OpenAI · Cosmos DB · Dapr", tune: "Supervisor routing · tool schemas · agent memory", github: "07-multi-agent-service" },
  { id: "08", name: "Copilot Studio Bot", Icon: MessageCircle, status: "Skeleton", cx: "Low", desc: "Low-code enterprise bot — Copilot Studio + Dataverse + SharePoint.", infra: "Copilot Studio · Dataverse · SharePoint · Power Platform", tune: "Topic design · knowledge sources · guardrails", github: "08-copilot-studio-bot" },
  { id: "09", name: "AI Search Portal", Icon: Search, status: "Skeleton", cx: "Medium", desc: "Enterprise search — AI Search + semantic ranking + Web App.", infra: "AI Search · App Service · Azure OpenAI · Blob Storage", tune: "Hybrid weights · semantic config · scoring profiles", github: "09-ai-search-portal" },
  { id: "10", name: "Content Moderation", Icon: Shield, status: "Skeleton", cx: "Low", desc: "Filter harmful content — Content Safety + APIM + Functions.", infra: "Content Safety · API Management · Azure Functions", tune: "Severity levels · custom categories · blocklists", github: "10-content-moderation" },
  { id: "11", name: "Landing Zone Advanced", Icon: Mountain, status: "Skeleton", cx: "High", desc: "Multi-region, policy-driven, enterprise-grade AI landing zone.", infra: "Multi-region VNet · Azure Policy · PE · RBAC · GPU Quota", tune: "Governance policies · multi-region config · RBAC", github: "11-ai-landing-zone-advanced" },
  { id: "12", name: "Model Serving AKS", Icon: Settings, status: "Skeleton", cx: "High", desc: "Deploy and serve LLMs on AKS with vLLM, GPU nodes, auto-scaling.", infra: "AKS · vLLM · NVIDIA GPU · Container Registry", tune: "Quantization · batching · scaling rules", github: "12-model-serving-aks" },
  { id: "13", name: "Fine-Tuning Workflow", Icon: Microscope, status: "Skeleton", cx: "High", desc: "End-to-end fine-tuning — data prep, LoRA training, evaluation, deployment.", infra: "AI Foundry · GPU Compute · Storage · MLflow", tune: "LoRA rank · learning rate · epochs · eval metrics", github: "13-fine-tuning-workflow" },
  { id: "14", name: "Cost-Optimized AI Gateway", Icon: DoorOpen, status: "Skeleton", cx: "Medium", desc: "APIM-based AI gateway with semantic caching, load balancing, token budgets.", infra: "API Management · Redis Cache · Azure OpenAI (multi-region)", tune: "Token budgets · caching rules · fallback chain", github: "14-cost-optimized-ai-gateway" },
  { id: "15", name: "Multi-Modal DocProc", Icon: Image, status: "Skeleton", cx: "Medium", desc: "Process documents with text + images using GPT-4o multi-modal.", infra: "GPT-4o · Blob Storage · Cosmos DB · Functions", tune: "Image prompts · extraction schemas · thresholds", github: "15-multi-modal-docproc" },
  { id: "16", name: "Copilot Teams Extension", Icon: Users, status: "Skeleton", cx: "Medium", desc: "M365 Copilot extension with Graph API and declarative agents.", infra: "M365 Copilot · Graph API · Azure Functions · App Reg", tune: "Declarative agent config · permissions · scoping", github: "16-copilot-teams-extension" },
  { id: "17", name: "AI Observability", Icon: BarChart3, status: "Skeleton", cx: "Medium", desc: "Monitor AI workloads with KQL queries, quality alerts, workbooks.", infra: "App Insights · Log Analytics · Azure Monitor · Workbooks", tune: "KQL queries · alert thresholds · quality metrics", github: "17-ai-observability" },
  { id: "18", name: "Prompt Management", Icon: FileEdit, status: "Skeleton", cx: "Medium", desc: "Version control, A/B test, and rollback prompts across environments.", infra: "Prompt Flow · Git · GitHub Actions · AI Foundry", tune: "Prompt versions · A/B weights · rollback rules", github: "18-prompt-management" },
  { id: "19", name: "Edge AI Phi-4", Icon: Smartphone, status: "Skeleton", cx: "High", desc: "Deploy Phi-4 on edge devices with ONNX quantization and local serving.", infra: "IoT Hub · Container Instances · ONNX Runtime · Edge", tune: "Quantization level · model config · sync schedule", github: "19-edge-ai-phi4" },
  { id: "20", name: "Anomaly Detection", Icon: AlertTriangle, status: "Skeleton", cx: "High", desc: "Real-time anomaly detection — Event Hub + AI analysis + alerting.", infra: "Event Hub · Stream Analytics · Azure OpenAI · Functions", tune: "Threshold config · alert prompts · detection windows", github: "20-anomaly-detection" },
];

const ghBase = "https://github.com/gitpavleenbali/frootai/tree/main/solution-plays/";

/* ═══ PLAY CARD COMPONENT ═══ */

function PlayCard({ play }: { play: typeof plays[0] }) {
  const [expanded, setExpanded] = useState(false);
  const isReady = play.status === "Ready";

  return (
    <div className="rounded-2xl border border-border bg-bg-surface p-5 sm:p-6 transition-all duration-300 hover:border-indigo/20 hover:shadow-lg hover:shadow-black/20">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        {/* Left: content */}
        <div className="flex-1 min-w-0">
          <h3 className="flex items-center gap-2 text-base font-bold mb-2">
            <play.Icon className="h-5 w-5 text-fg-muted" />
            {play.id} — {play.name}
          </h3>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge label={play.status} color={isReady ? "#10b981" : "#f59e0b"} />
            <Badge label={play.cx} color="#6366f1" />
            <Badge label="WAF-Aligned" color="#10b981" />
            <Badge label="SpecKit" color="#f59e0b" />
          </div>
          <p className="text-[13px] text-fg-muted leading-relaxed mb-3">{play.desc}</p>
          <div className="text-[12px] text-fg-dim space-y-1">
            <div><span className="font-semibold text-fg-muted">Infra:</span> {play.infra}</div>
            <div><span className="font-semibold text-fg-muted">Tuning:</span> {play.tune}</div>
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex sm:flex-col gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <a href={`${ghBase}${play.github}`} target="_blank" rel="noopener noreferrer"
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-center bg-gradient-to-r from-indigo to-violet text-white hover:opacity-90 transition-opacity">
            GitHub
          </a>
          <a href={`${ghBase}${play.github}#-devkit--developer-velocity-ecosystem`} target="_blank" rel="noopener noreferrer"
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-center border border-cyan/30 text-cyan bg-cyan/5 hover:bg-cyan/10 transition-colors">
            DevKit
          </a>
          <a href={`${ghBase}${play.github}#-tunekit--ai-fine-tuning-ecosystem`} target="_blank" rel="noopener noreferrer"
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-center border border-violet/30 text-violet bg-violet/5 hover:bg-violet/10 transition-colors">
            TuneKit
          </a>
          <a href={`${ghBase}${play.github}#-speckit--architecture-specs`} target="_blank" rel="noopener noreferrer"
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-center border border-amber/30 text-amber bg-amber/5 hover:bg-amber/10 transition-colors">
            SpecKit
          </a>
          <Link href={`/user-guide?play=${play.id}`}
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-center border border-amber/30 text-amber bg-amber/5 hover:bg-amber/10 transition-colors">
            User Guide
          </Link>
        </div>
      </div>

      {/* Expandable guide */}
      <div className="mt-4 pt-3 border-t border-border">
        <button onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald cursor-pointer hover:underline">
          <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
          {expanded ? "Hide User Guide" : "Show User Guide"}
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="mt-3 rounded-xl bg-bg-elevated p-4 text-[12px] leading-relaxed font-mono text-fg-muted whitespace-pre-wrap">
                {isReady ? `1. Clone repo → cd solution-plays/${play.github}\n2. Open in VS Code → Copilot is solution-aware (reads agent.md + copilot-instructions)\n3. MCP auto-connects via .vscode/mcp.json\n4. Build: Co-coder fills skeleton using DevKit context\n5. Tune: Review config/*.json → adjust knobs per your data\n6. Deploy: az deployment group create --template-file infra/main.bicep\n7. Evaluate: python evaluation/eval.py → verify quality targets\n8. Ship it.`
                  : `Skeleton ready. DevKit + TuneKit files present.\nOpen in VS Code → co-coder fills implementation.`}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ═══ PAGE ═══ */

export function SolutionPlaysClient() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader
        title="Solution Plays"
        subtitle="Each play ships with the full .github Agentic OS (19 files, 4 layers), DevKit (empower your coding agent), TuneKit (fine-tune AI for production), SpecKit (architecture specs + WAF alignment), and plugin.json (Layer 4 distribution manifest)."
      />

      {/* 3 Explainer cards */}
      <StaggerChildren className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StaggerItem>
          <div className="rounded-2xl border-2 border-emerald/20 bg-emerald/[0.02] p-5 text-center">
            <div className="flex justify-center mb-2"><Brain className="h-8 w-8 text-emerald-400" /></div>
            <h3 className="font-extrabold text-sm mb-3">.github Agentic OS</h3>
            <div className="text-left text-[12px] leading-relaxed text-fg-muted space-y-1">
              <div><span className="font-bold text-emerald">Layer 1</span> — Instructions (always-on context)</div>
              <div><span className="font-bold text-emerald">Layer 2</span> — Prompts, Agents, Skills</div>
              <div><span className="font-bold text-emerald">Layer 3</span> — Hooks + Workflows (CI/CD)</div>
              <div><span className="font-bold text-emerald">Layer 4</span> — Plugin packaging</div>
            </div>
            <p className="mt-3 text-[11px] text-fg-dim italic">19 files per play · 7 primitives · 4 layers</p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="rounded-2xl border-2 border-cyan/20 bg-cyan/[0.02] p-5 text-center">
            <div className="flex justify-center mb-2"><Wrench className="h-8 w-8 text-cyan-400" /></div>
            <h3 className="font-extrabold text-sm mb-3">DevKit — Build + Deploy</h3>
            <div className="text-left text-[12px] leading-relaxed text-fg-muted space-y-1">
              <div><span className="font-bold text-cyan">agent.md</span> — solution-aware co-coder</div>
              <div><span className="font-bold text-cyan">instructions</span> — prompts, guardrails</div>
              <div><span className="font-bold text-cyan">infra/</span> — Bicep IaC templates</div>
              <div><span className="font-bold text-cyan">MCP + plugins</span> — tools + functions</div>
            </div>
            <p className="mt-3 text-[11px] text-fg-dim italic">Code + infrastructure in one kit.</p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="rounded-2xl border-2 border-violet/20 bg-violet/[0.02] p-5 text-center">
            <div className="flex justify-center mb-2"><Sliders className="h-8 w-8 text-violet-400" /></div>
            <h3 className="font-extrabold text-sm mb-3">TuneKit — AI Fine-Tuning</h3>
            <div className="text-left text-[12px] leading-relaxed text-fg-muted space-y-1">
              <div><span className="font-bold text-violet">config/*.json</span> — temp, top-k, models</div>
              <div><span className="font-bold text-violet">agents.json</span> — agent behavior tuning</div>
              <div><span className="font-bold text-violet">model-comparison</span> — cost vs quality</div>
              <div><span className="font-bold text-violet">evaluation/</span> — test + score + ship</div>
            </div>
            <p className="mt-3 text-[11px] text-fg-dim italic">Tune AI without being an AI specialist.</p>
          </div>
        </StaggerItem>
      </StaggerChildren>

      {/* 20 Play cards */}
      <div className="space-y-4">
        {plays.map((play, i) => (
          <FadeIn key={play.id} delay={Math.min(i * 0.03, 0.3)}>
            <PlayCard play={play} />
          </FadeIn>
        ))}
      </div>

      {/* Bottom nav */}
      <div className="mt-14 flex flex-wrap justify-center gap-2">
        <GlowPill href="/configurator" color="#f59e0b">Configurator</GlowPill>
        <GlowPill href="/chatbot" color="#10b981">Agent FAI</GlowPill>
        <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
