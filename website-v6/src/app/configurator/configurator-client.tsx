"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FadeIn } from "@/components/motion/fade-in";
import { GlowPill } from "@/components/ui/glow-pill";
import { SectionHeader } from "@/components/ui/section-header";
import { FileText, Search, Bot, Phone, Shield, Cloud, BarChart3, Cpu, Building2, Code2, Database, Lock, Zap, Timer, Crown, type LucideIcon } from "lucide-react";

/* ═══ DATA — from production configurator.tsx ═══ */

const questions: { q: string; options: { label: string; tags: string[]; Icon?: LucideIcon; color?: string }[] }[] = [
  { q: "What are you building?", options: [
    { label: "Document processing (OCR, extraction, forms)", tags: ["doc"], Icon: FileText, color: "#f59e0b" },
    { label: "Search / RAG / Knowledge base", tags: ["rag"], Icon: Search, color: "#10b981" },
    { label: "AI Agent (autonomous, tool-calling)", tags: ["agent"], Icon: Bot, color: "#6366f1" },
    { label: "Voice / Call center / Speech", tags: ["voice"], Icon: Phone, color: "#06b6d4" },
    { label: "Content moderation / Safety", tags: ["safety"], Icon: Shield, color: "#ec4899" },
    { label: "AI Landing Zone / Infrastructure", tags: ["infra"], Icon: Cloud, color: "#7c3aed" },
    { label: "Monitoring / Observability / Analytics", tags: ["ops"], Icon: BarChart3, color: "#0ea5e9" },
    { label: "Model serving / Fine-tuning / MLOps", tags: ["ml"], Icon: Cpu, color: "#f97316" },
  ]},
  { q: "What's your team's primary role?", options: [
    { label: "Infrastructure / Platform Engineering", tags: ["infra-team"], Icon: Building2, color: "#7c3aed" },
    { label: "Application / Full-stack Development", tags: ["dev-team"], Icon: Code2, color: "#6366f1" },
    { label: "Data / ML Engineering", tags: ["data-team"], Icon: Database, color: "#10b981" },
    { label: "Security / Compliance", tags: ["sec-team"], Icon: Lock, color: "#ec4899" },
  ]},
  { q: "What complexity level fits your timeline?", options: [
    { label: "Low — ship in a week", tags: ["low"], Icon: Zap, color: "#10b981" },
    { label: "Medium — ship in 2-4 weeks", tags: ["medium"], Icon: Timer, color: "#f59e0b" },
    { label: "High — enterprise-grade, months", tags: ["high"], Icon: Crown, color: "#7c3aed" },
  ]},
];

const playRecommendations: Record<string, { plays: string[]; why: string }> = {
  doc: { plays: ["06", "15"], why: "Document Intelligence + Multi-Modal DocProc cover OCR, forms, PDFs, and images." },
  rag: { plays: ["01", "09"], why: "Enterprise RAG Q&A for knowledge bases, AI Search Portal for web-facing search." },
  agent: { plays: ["03", "07", "05"], why: "Deterministic Agent for reliable single agents, Multi-Agent for complex orchestration, IT Ticket Resolution for ITSM." },
  voice: { plays: ["04"], why: "Call Center Voice AI with Azure Communication Services + Speech." },
  safety: { plays: ["10"], why: "Content Moderation Pipeline with Azure Content Safety + APIM." },
  infra: { plays: ["02", "11"], why: "AI Landing Zone for foundations, Advanced for multi-region enterprise." },
  ops: { plays: ["17", "14"], why: "AI Observability for monitoring, Cost-Optimized Gateway for FinOps." },
  ml: { plays: ["12", "13"], why: "Model Serving AKS for hosting, Fine-Tuning Workflow for customization." },
};

const playNames: Record<string, string> = {
  "01": "Enterprise RAG Q&A", "02": "AI Landing Zone", "03": "Deterministic Agent",
  "04": "Call Center Voice AI", "05": "IT Ticket Resolution", "06": "Document Intelligence",
  "07": "Multi-Agent Service", "08": "Copilot Studio Bot", "09": "AI Search Portal",
  "10": "Content Moderation", "11": "Landing Zone Advanced", "12": "Model Serving AKS",
  "13": "Fine-Tuning Workflow", "14": "AI Gateway", "15": "Multi-Modal DocProc",
  "16": "Copilot Teams Ext", "17": "AI Observability", "18": "Prompt Management",
  "19": "Edge AI Phi-4", "20": "Anomaly Detection",
};

const playSlugs: Record<string, string> = {
  "01": "01-enterprise-rag", "02": "02-ai-landing-zone", "03": "03-deterministic-agent",
  "04": "04-call-center-voice-ai", "05": "05-it-ticket-resolution", "06": "06-document-intelligence",
  "07": "07-multi-agent-service", "08": "08-copilot-studio-bot", "09": "09-ai-search-portal",
  "10": "10-content-moderation", "11": "11-ai-landing-zone-advanced", "12": "12-model-serving-aks",
  "13": "13-fine-tuning-workflow", "14": "14-cost-optimized-ai-gateway", "15": "15-multi-modal-docproc",
  "16": "16-copilot-teams-extension", "17": "17-ai-observability", "18": "18-prompt-management",
  "19": "19-edge-ai-phi4", "20": "20-anomaly-detection",
};

/* ═══ CLIENT ═══ */

export function ConfiguratorClient() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);

  const handleAnswer = (tags: string[]) => {
    setAnswers([...answers, ...tags]);
    setStep(step + 1);
  };

  const showResult = step >= questions.length;
  const rec = showResult ? (playRecommendations[answers[0]] || playRecommendations["rag"]) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader
        title="Solution Configurator"
        subtitle="Answer 3 questions → get a personalized FrootAI solution play recommendation."
      />

      {/* Progress bar */}
      <div className="flex justify-center gap-2 mb-10">
        {questions.map((_, i) => (
          <div key={i} className="h-1 rounded-full transition-all duration-300"
            style={{ width: "60px", background: i <= step ? "#00c853" : "rgba(255,255,255,0.08)" }} />
        ))}
      </div>

      {!showResult ? (
        <FadeIn key={step}>
          <h2 className="text-lg font-bold mb-5">
            Step {step + 1} of {questions.length}: {questions[step].q}
          </h2>
          <div className="space-y-2.5">
            {questions[step].options.map((opt, i) => (
              <motion.button
                key={i}
                onClick={() => handleAnswer(opt.tags)}
                className="glow-card group w-full text-left flex items-center gap-3 px-5 py-4 text-sm text-fg cursor-pointer"
                style={{ "--glow": opt.color || "#10b981" } as React.CSSProperties}
                whileTap={{ scale: 0.99 }}
              >
                {opt.Icon && <opt.Icon className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110" style={{ color: opt.color }} />}
                {opt.label}
              </motion.button>
            ))}
          </div>
        </FadeIn>
      ) : (
        <FadeIn>
          <h2 className="text-xl font-bold text-green mb-4">Your Recommended Plays</h2>
          <p className="text-sm text-fg-muted mb-6">{rec?.why}</p>

          <div className="space-y-3">
            {rec?.plays.map((id) => (
              <div key={id} className="rounded-xl border border-green/25 bg-green/[0.04] p-5">
                <div className="font-bold text-base mb-3">Play {id} — {playNames[id]}</div>
                <div className="flex flex-wrap gap-2">
                  <GlowPill href={`/user-guide?play=${id}`} color="#10b981">User Guide</GlowPill>
                  <GlowPill href={`/solution-plays/${playSlugs[id]}`} color="#6366f1">View Play</GlowPill>
                  <GlowPill href="/setup-guide" color="#f59e0b">Setup Guide</GlowPill>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => { setStep(0); setAnswers([]); }}
              className="rounded-xl border border-border px-6 py-2.5 text-sm text-fg-muted cursor-pointer hover:bg-bg-elevated transition-colors"
            >
              Start Over
            </button>
          </div>
        </FadeIn>
      )}

      {/* Bottom nav */}
      <div className="mt-14 flex flex-wrap justify-center gap-2">
        <GlowPill href="/solution-plays" color="#6366f1">All 20 Plays</GlowPill>
        <GlowPill href="/chatbot" color="#d4a853">Ask Agent FAI</GlowPill>
        <GlowPill href="/" color="#10b981">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
