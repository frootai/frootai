"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Search, Mountain, Target, Phone, Ticket, FileText, Bot, MessageCircle, Shield, Settings, Microscope, DoorOpen, Image, Users, BarChart3, FileEdit, Smartphone, AlertTriangle, Brain, Wrench, Sliders, Ruler, Factory, Package, Box, Layers, type LucideIcon } from "lucide-react";
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

/* ═══ ECOSYSTEM PANEL — expandable layers ═══ */

function EcoLayer({ icon, name, tagline, color, borderColor, children, rounded }: {
  icon: React.ReactNode; name: string; tagline: string; color: string; borderColor: string; children: React.ReactNode; rounded?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-2 ${borderColor} ${rounded || ""} transition-all duration-200 overflow-visible`} style={{ background: `${color}08` }}>
      <button onClick={() => setOpen(!open)} className="w-full px-4 py-3 grid grid-cols-[auto_140px_1fr_auto] items-center gap-3 cursor-pointer">
        {icon}
        <h3 className="font-bold text-[12px] text-fg text-left whitespace-nowrap">{name}</h3>
        <span className="text-[10px] text-fg/55 italic text-left truncate">{tagline}</span>
        <ChevronRight className={`h-3 w-3 text-fg/40 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EcosystemPanel() {
  return (
    <div className="mb-10 rounded-2xl border border-emerald/15 bg-gradient-to-b from-emerald/[0.02] to-transparent p-5">
      <div className="flex items-center justify-center gap-2 mb-4">
        <img src="/img/frootai-mark.svg" alt="" className="h-5 w-5" />
        <h2 className="font-extrabold text-[14px] tracking-wide">F<span className="text-emerald">AI</span> Ecosystem</h2>
        <span className="text-[10px] text-fg/55 italic ml-1">the living system behind every play</span>
      </div>

      <div className="space-y-0">
        {/* FROOT Toolkit */}
        <EcoLayer icon={<Box className="h-4 w-4 text-indigo" />} name="FROOT Toolkit" tagline="Layer 3 — composable kits: build, tune, architect" color="#6366f1" borderColor="border-indigo/20 border-b-0" rounded="rounded-t-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2 mb-3">
            <div className="rounded-lg border border-cyan/20 bg-cyan/[0.03] p-4 text-center">
              <div className="text-[8px] font-bold text-cyan mb-1">Box 1</div>
              <Wrench className="h-4 w-4 mx-auto mb-1.5 text-cyan" />
              <div className="font-bold text-[11px] text-fg mb-1">DevKit</div>
              <div className="text-[10px] text-fg/55 leading-relaxed">Your AI co-coder. agent.md gives Copilot solution context, infra/ deploys Bicep, MCP tools extend your agent, plugins add custom functions.</div>
            </div>
            <div className="rounded-lg border border-violet/20 bg-violet/[0.03] p-4 text-center">
              <div className="text-[8px] font-bold text-violet mb-1">Box 2</div>
              <Sliders className="h-4 w-4 mx-auto mb-1.5 text-violet" />
              <div className="font-bold text-[11px] text-fg mb-1">TuneKit</div>
              <div className="text-[10px] text-fg/55 leading-relaxed">AI config without being an AI specialist. config/*.json controls temperature, top-k, models. evaluation/ scores quality. Ship with confidence.</div>
            </div>
            <div className="rounded-lg border border-amber/20 bg-amber/[0.03] p-4 text-center">
              <div className="text-[8px] font-bold text-amber mb-1">Box 3</div>
              <Ruler className="h-4 w-4 mx-auto mb-1.5 text-amber" />
              <div className="font-bold text-[11px] text-fg mb-1">SpecKit</div>
              <div className="text-[10px] text-fg/55 leading-relaxed">Architecture blueprint. play-spec.json defines components, WAF alignment across all 6 pillars, and evaluation thresholds for production.</div>
            </div>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-fg/50 italic"><Brain className="h-3 w-3 inline mr-0.5 text-indigo/60" />Agentic OS (.github) — instructions · agents · skills · hooks · workflows — woven into every kit</span>
          </div>
        </EcoLayer>

        {/* FROOT Packages */}
        <EcoLayer icon={<Package className="h-4 w-4 text-emerald" />} name="FROOT Packages" tagline="Layer 2 — install once, every kit arrives" color="#10b981" borderColor="border-emerald/20 border-b-0">
          <div className="text-[10px] text-fg/55 text-center mb-3 leading-relaxed">
            Every FROOT Package delivers the full Toolkit — DevKit, TuneKit, and SpecKit — through the channel you prefer. Install one package, get all three kits.
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Link href="/vscode-extension" className="glow-card rounded-lg p-2 text-center" style={{ "--glow": "#10b981" } as React.CSSProperties}>
              <div className="font-bold text-[10px] text-fg">VS Code</div>
              <div className="text-[9px] text-fg/45">Extension</div>
            </Link>
            <Link href="/mcp-tooling" className="glow-card rounded-lg p-2 text-center" style={{ "--glow": "#10b981" } as React.CSSProperties}>
              <div className="font-bold text-[10px] text-fg">MCP Server</div>
              <div className="text-[9px] text-fg/45">npm install</div>
            </Link>
            <Link href="/docker" className="glow-card rounded-lg p-2 text-center" style={{ "--glow": "#10b981" } as React.CSSProperties}>
              <div className="font-bold text-[10px] text-fg">Docker</div>
              <div className="text-[9px] text-fg/45">Container</div>
            </Link>
            <Link href="/cli" className="glow-card rounded-lg p-2 text-center" style={{ "--glow": "#10b981" } as React.CSSProperties}>
              <div className="font-bold text-[10px] text-fg">CLI</div>
              <div className="text-[9px] text-fg/45">Terminal</div>
            </Link>
            <Link href="/marketplace" className="glow-card rounded-lg p-2 text-center" style={{ "--glow": "#10b981" } as React.CSSProperties}>
              <div className="font-bold text-[10px] text-fg">Marketplace</div>
              <div className="text-[9px] text-fg/45">Discover</div>
            </Link>
          </div>
          <div className="text-center mt-2">
            <Link href="/setup-guide" className="glow-card inline-block rounded-lg px-3 py-1 text-[10px] text-emerald font-semibold" style={{ "--glow": "#10b981" } as React.CSSProperties}>Setup Guide →</Link>
          </div>
        </EcoLayer>

        {/* FROOT Factory */}
        <EcoLayer icon={<Factory className="h-4 w-4 text-amber" />} name="FROOT Factory" tagline="Layer 1 — the production engine" color="#f59e0b" borderColor="border-amber/20" rounded="rounded-b-xl">
          <div className="text-[10px] text-fg/55 text-center leading-relaxed">
            Where raw ideas become production AI — assembles Agentic OS primitives into a coherent system. You don&apos;t just get templates. You get the machine that makes them.
          </div>
        </EcoLayer>
      </div>
    </div>
  );
}

/* ═══ FLIP KIT CARD ═══ */

function FlipKit({ icon, name, color, front, back }: { icon: React.ReactNode; name: string; color: string; front: string; back: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped(!flipped)}
      className="glow-card rounded-xl p-3 text-center cursor-pointer min-h-[100px] flex flex-col items-center justify-center transition-all duration-300"
      style={{ "--glow": color } as React.CSSProperties}
    >
      <AnimatePresence mode="wait">
        {!flipped ? (
          <motion.div key="front" initial={{ opacity: 0, rotateY: -90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: 90 }} transition={{ duration: 0.25 }}>
            {icon}
            <div className="font-bold text-[12px] text-fg mt-1.5">{name}</div>
            <div className="text-[10px] text-fg/50 mt-0.5">{front}</div>
          </motion.div>
        ) : (
          <motion.div key="back" initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: -90 }} transition={{ duration: 0.25 }}>
            <div className="text-[11px] text-fg/60 leading-relaxed">{back}</div>
            <div className="text-[9px] text-fg/30 mt-1.5 italic">tap to flip back</div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

/* ═══ PLAY CARD COMPONENT ═══ */

function PlayCard({ play }: { play: typeof plays[0] }) {
  const [expanded, setExpanded] = useState(false);
  const [kitOpen, setKitOpen] = useState(false);
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
          </div>
          <p className="text-[13px] text-fg-muted leading-relaxed mb-3">{play.desc}</p>
          <div className="text-[12px] text-fg/50 space-y-1">
            <div><span className="font-semibold text-fg/70">Infra:</span> {play.infra}</div>
            <div><span className="font-semibold text-fg/70">Tuning:</span> {play.tune}</div>
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex sm:flex-col gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <Link href={`/solution-plays/${play.github}`}
            className="glow-card rounded-lg px-3 py-1.5 text-[11px] font-semibold text-center bg-gradient-to-r from-emerald to-cyan text-white" style={{ "--glow": "#10b981" } as React.CSSProperties}>
            View Play
          </Link>
          <Link href={`/user-guide?play=${play.id}`}
            className="glow-card rounded-lg px-3 py-1.5 text-[11px] font-semibold text-center bg-gradient-to-r from-indigo to-violet text-white" style={{ "--glow": "#6366f1" } as React.CSSProperties}>
            User Guide
          </Link>
          <a href={`${ghBase}${play.github}`} target="_blank" rel="noopener noreferrer"
            className="glow-card rounded-lg px-3 py-1.5 text-[11px] font-semibold text-center bg-gradient-to-r from-amber to-orange text-white" style={{ "--glow": "#f59e0b" } as React.CSSProperties}>
            GitHub
          </a>
        </div>
      </div>

      {/* Expandable sections */}
      <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-3">
        {/* Quick Highlights */}
        <button onClick={() => setExpanded(!expanded)}
          className="glow-card flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-emerald cursor-pointer" style={{ "--glow": "#10b981" } as React.CSSProperties}>
          <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
          {expanded ? "Hide Highlights" : "Quick Highlights"}
        </button>
        {/* FROOT Toolkit */}
        <button onClick={() => setKitOpen(!kitOpen)}
          className="glow-card flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-amber cursor-pointer" style={{ "--glow": "#f59e0b" } as React.CSSProperties}>
          <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${kitOpen ? "rotate-90" : ""}`} />
          {kitOpen ? "Close FROOT Toolkit" : "FROOT Toolkit"}
        </button>
        <span className="text-[10px] text-fg/40 italic self-center">→ delivered via</span>
        {/* FROOT Packages */}
        <Link href="/setup-guide" className="glow-card flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-emerald" style={{ "--glow": "#10b981" } as React.CSSProperties}>
          <Package className="h-3.5 w-3.5" /> FROOT Packages
        </Link>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="mt-3 rounded-xl bg-bg-elevated p-4 text-[12px] leading-relaxed text-fg/60 space-y-2">
              <div className="font-semibold text-fg text-[13px] mb-1">{play.id} — {play.name}</div>
              <div><span className="font-bold text-emerald">Infra:</span> {play.infra}</div>
              <div><span className="font-bold text-cyan">Tuning:</span> {play.tune}</div>
              <div className="pt-2 border-t border-border mt-2">
                <span className="font-bold text-fg/70">Ships with:</span> FROOT Factory · FROOT Toolkit (DevKit + TuneKit + SpecKit) · FROOT Packages
              </div>
              <div className="text-[11px] text-fg/45 italic">
                {isReady ? "Ready — clone → open in VS Code → Copilot is solution-aware → build → tune → deploy → evaluate" : "Skeleton ready — DevKit + TuneKit files present. Open in VS Code → co-coder fills implementation."}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {kitOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="mt-3 rounded-xl border border-amber/20 bg-amber/[0.02] p-4">
              <div className="text-[11px] text-fg/50 text-center mb-3">
                <span className="font-bold text-emerald">FROOT Toolkit</span> — composable kits for <span className="text-fg/70 font-semibold">{play.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <FlipKit
                  icon={<Wrench className="h-5 w-5 text-cyan" />}
                  name="DevKit"
                  color="#06b6d4"
                  front="agent.md · infra/ · MCP · plugins"
                  back={`Build ${play.name} with a solution-aware co-coder. Copilot reads agent.md for context-rich scaffolding.`}
                />
                <FlipKit
                  icon={<Sliders className="h-5 w-5 text-violet" />}
                  name="TuneKit"
                  color="#8b5cf6"
                  front="config/*.json · evaluation/ · models"
                  back={`Tune ${play.name}: ${play.tune.split('·').slice(0, 2).join(' ·')}. No AI expertise needed.`}
                />
                <FlipKit
                  icon={<Ruler className="h-5 w-5 text-amber" />}
                  name="SpecKit"
                  color="#f59e0b"
                  front="play-spec.json · WAF · components"
                  back={`Blueprint for ${play.name} — WAF-aligned, 6 pillars, eval thresholds.`}
                />
              </div>
              <div className="mt-3 pt-2 border-t border-amber/10 text-center">
                <div className="text-[10px] text-fg/50 italic">Install any FROOT Package to get all three kits · Assembled by the FROOT Factory</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══ PAGE ═══ */

export function SolutionPlaysClient() {
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 py-12 sm:py-16">
      {/* ═══ HEADER ═══ */}
      <FadeIn>
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Layers className="h-7 w-7 text-emerald" />
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="text-emerald">FAI</span> Solution Plays
            </h1>
          </div>
          <div className="mx-auto max-w-xl rounded-2xl border border-emerald/20 bg-gradient-to-br from-emerald/[0.04] to-indigo/[0.02] px-6 py-4">
            <p className="text-[13px] text-fg/60 leading-relaxed italic text-center">
              &ldquo;From a single kit to a production solution — build AI the way you build with LEGO.&rdquo;
            </p>
          </div>
        </div>
      </FadeIn>

      {/* ═══ FAI ECOSYSTEM ═══ */}
      <FadeIn delay={0.1}>
        <EcosystemPanel />
      </FadeIn>

      {/* 20 Play cards */}
      <div className="space-y-4">
        {plays.map((play, i) => (
          <FadeIn key={play.id} delay={Math.min(i * 0.03, 0.3)}>
            <PlayCard play={play} />
          </FadeIn>
        ))}
      </div>

      {/* Closing statement */}
      <div className="mt-12 text-center">
        <p className="text-[10px] text-fg/50">Powered by the <span className="font-bold text-emerald/70">FAI Ecosystem</span></p>
        <p className="text-[10px] text-fg/40 mt-1 leading-relaxed max-w-md mx-auto">
          These plays are examples — not limits. The same Toolkit, Packages, and Factory that built them are yours to remix, extend, or use to create entirely new solutions.
        </p>
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
