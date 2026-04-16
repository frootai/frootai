import { useState } from "react";
import type { SolutionPlay } from "../types";
import Badge from "../components/Badge";
import { vscode } from "../vscode";
import {
  Settings, FileText, Search, Bot, Phone, Shield, Cloud, BarChart3, Wrench,
  Heart, DollarSign, Scale, GraduationCap, Headphones, Radio, Palette, Database,
  Building2, Code2, Lock, Zap, Timer, Crown, RotateCcw, ChevronRight, ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CX_COLORS: Record<string, string> = {
  Foundation: "#0ea5e9", Low: "#10b981", Medium: "#f59e0b", High: "#ef4444", "Very High": "#7c3aed",
};

interface Option { label: string; tags: string[]; Icon: LucideIcon; color: string }
interface Question { q: string; options: Option[] }

const questions: Question[] = [
  {
    q: "What are you building?",
    options: [
      { label: "Document Processing (OCR, extraction, forms)", tags: ["doc"], Icon: FileText, color: "#f59e0b" },
      { label: "Search / RAG / Knowledge Base", tags: ["rag"], Icon: Search, color: "#10b981" },
      { label: "AI Agent / Multi-Agent", tags: ["agent"], Icon: Bot, color: "#6366f1" },
      { label: "Voice / Speech / Call Center", tags: ["voice"], Icon: Phone, color: "#06b6d4" },
      { label: "Content Safety / Moderation", tags: ["safety"], Icon: Shield, color: "#ec4899" },
      { label: "Infrastructure / Landing Zone", tags: ["infra"], Icon: Cloud, color: "#7c3aed" },
      { label: "DevOps / Observability", tags: ["ops"], Icon: BarChart3, color: "#0ea5e9" },
      { label: "Model Serving / MLOps", tags: ["ml"], Icon: Wrench, color: "#f97316" },
      { label: "Healthcare / Clinical", tags: ["health"], Icon: Heart, color: "#ef4444" },
      { label: "Finance / Risk / Fraud", tags: ["finance"], Icon: DollarSign, color: "#22c55e" },
      { label: "Legal / Compliance", tags: ["legal"], Icon: Scale, color: "#a855f7" },
      { label: "Education / Training", tags: ["education"], Icon: GraduationCap, color: "#3b82f6" },
      { label: "Customer Support / CRM", tags: ["support"], Icon: Headphones, color: "#14b8a6" },
      { label: "IoT / Edge / Digital Twin", tags: ["iot"], Icon: Radio, color: "#f43f5e" },
      { label: "Creative / Media / Translation", tags: ["creative"], Icon: Palette, color: "#d946ef" },
      { label: "Data Pipeline / Synthetic Data", tags: ["data"], Icon: Database, color: "#8b5cf6" },
    ],
  },
  {
    q: "What's your team's primary role?",
    options: [
      { label: "Infrastructure / Platform Engineering", tags: ["infra-team"], Icon: Building2, color: "#7c3aed" },
      { label: "Application / Full-stack Development", tags: ["dev-team"], Icon: Code2, color: "#6366f1" },
      { label: "Data / ML Engineering", tags: ["data-team"], Icon: Database, color: "#10b981" },
      { label: "Security / Compliance", tags: ["sec-team"], Icon: Lock, color: "#ec4899" },
    ],
  },
  {
    q: "What complexity level fits your timeline?",
    options: [
      { label: "Low — ship in a week", tags: ["low"], Icon: Zap, color: "#10b981" },
      { label: "Medium — ship in 2-4 weeks", tags: ["medium"], Icon: Timer, color: "#f59e0b" },
      { label: "High — enterprise-grade, months", tags: ["high"], Icon: Crown, color: "#7c3aed" },
    ],
  },
];

const recommendations: Record<string, { plays: string[]; why: string }> = {
  doc: { plays: ["06", "15", "38"], why: "Document Intelligence, Multi-Modal DocProc, and Document Understanding V2 cover OCR, forms, PDFs, and advanced extraction." },
  rag: { plays: ["01", "21", "26", "28", "67"], why: "Enterprise RAG, Agentic RAG, Semantic Search, Knowledge Graph RAG, and Knowledge Management for any search or knowledge scenario." },
  agent: { plays: ["03", "07", "22", "42", "51", "100"], why: "Deterministic Agent, Multi-Agent Service, Swarm, Computer Use, Autonomous Coding, and FAI Meta Agent for any agent architecture." },
  voice: { plays: ["04", "33", "96"], why: "Call Center Voice AI, Voice AI Agent, and Realtime Voice Agent V2 for speech and telephony solutions." },
  safety: { plays: ["10", "30", "41", "61"], why: "Content Moderation, Security Hardening, Red Teaming, and Moderation V2 for safety and responsible AI." },
  infra: { plays: ["02", "11", "66", "83", "99"], why: "AI Landing Zones, Infrastructure Optimizer, Building Energy Optimizer, and Enterprise Governance Hub." },
  ops: { plays: ["17", "37", "98"], why: "AI Observability, AI-Powered DevOps, and Agent Evaluation Platform for monitoring and CI/CD." },
  ml: { plays: ["12", "13", "19", "34", "48"], why: "Model Serving AKS, Fine-Tuning, Edge AI Phi-4, Edge Deployment, and Model Governance for end-to-end MLOps." },
  health: { plays: ["46"], why: "Healthcare Clinical AI for clinical decision support, medical NLP, and patient-facing AI." },
  finance: { plays: ["50", "63", "72", "87"], why: "Financial Risk Intelligence, Fraud Detection, Climate Risk Assessor, and Dynamic Pricing for finance and risk." },
  legal: { plays: ["35", "53", "70", "85"], why: "AI Compliance Engine, Legal Document AI, ESG Compliance Agent, and Policy Impact Analyzer for legal and regulatory use cases." },
  education: { plays: ["65", "74", "75", "76", "77"], why: "Training Curriculum, Tutoring Agent, Exam Generation, Accessibility Learning, and Research Paper AI for education." },
  support: { plays: ["54", "64", "84", "91"], why: "Customer Support V2, Sales Assistant, Citizen Services Chatbot, and Churn Predictor for CRM and support." },
  iot: { plays: ["44", "58", "68", "71", "78", "80", "90"], why: "On-Device AI, Digital Twin, Predictive Maintenance, Smart Energy, Precision Agriculture, Biodiversity, and Network Optimization for IoT and edge." },
  creative: { plays: ["43", "49", "57", "94"], why: "Video Generation, Creative AI Studio, Translation Engine, and Podcast Generator for media and creative workflows." },
  data: { plays: ["27", "47", "55", "89", "97"], why: "AI Data Pipeline, Synthetic Data Factory, Supply Chain AI, Retail Inventory Predictor, and Data Marketplace for data engineering." },
};

interface Props {
  plays: SolutionPlay[];
}

export default function Configurator({ plays }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);

  const handleAnswer = (tags: string[]) => {
    setAnswers([...answers, ...tags]);
    setStep(step + 1);
  };

  const showResult = step >= questions.length;
  const rec = showResult ? (recommendations[answers[0]] || recommendations["rag"]) : null;

  const openPlay = (play: SolutionPlay) => {
    vscode.postMessage({ command: "navigate", panel: "playDetail", play });
  };

  const cmd = (command: string, play: SolutionPlay) => {
    vscode.postMessage({ command, playId: play.id, playDir: play.dir });
  };

  const logoUri = (window as any).panelData?.logoUri;

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      {/* Branding */}
      <div style={{ textAlign: "center", padding: "16px 16px 8px" }}>
        {logoUri && <img src={logoUri} alt="FrootAI" style={{ width: 48, height: 48, marginBottom: 8 }} />}
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>
          <span style={{ color: "var(--vscode-foreground)" }}>Froot</span>
          <span style={{ color: "#10b981" }}>AI</span>
        </div>
      </div>

      {/* Hero */}
      <div className="hero">
        <h1 style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Settings size={22} color="#f59e0b" />
          Solution Configurator
        </h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
          Answer 3 questions → get personalized play recommendations
        </p>
      </div>

      {/* Progress */}
      <div className="steps">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`step-dot${i < step ? " done" : i === step ? " active" : ""}`}
            style={{ width: 40, height: 4, borderRadius: 2 }}
          />
        ))}
      </div>

      {!showResult ? (
        /* ─── Question step ─── */
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            Step {step + 1} of {questions.length}: {questions[step].q}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: step === 0 ? "1fr 1fr" : "1fr",
              gap: 8,
            }}
          >
            {questions[step].options.map((opt, i) => (
              <button
                key={i}
                className="card card-clickable"
                onClick={() => handleAnswer(opt.tags)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                  background: "var(--vscode-editor-inactiveSelectionBackground, #2a2d2e)",
                  border: "1px solid var(--vscode-widget-border, #454545)",
                  color: "inherit",
                  fontFamily: "inherit",
                  fontSize: 12,
                }}
              >
                <opt.Icon size={18} color={opt.color} style={{ flexShrink: 0 }} />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ─── Results ─── */
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#10b981" }}>
            ✅ Your Recommended Plays
          </h2>
          <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 20, lineHeight: 1.6 }}>
            {rec?.why}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rec?.plays.map((id) => {
              const play = plays.find((p) => p.id === id);
              if (!play) return null;
              const cx = play.cx ?? "Medium";
              return (
                <div key={id} className="card" style={{ borderLeft: `3px solid #10b981` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        Play {play.id} — {play.name}
                      </div>
                      {play.tagline && (
                        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, lineHeight: 1.4 }}>
                          {play.tagline}
                        </div>
                      )}
                    </div>
                    <Badge label={cx} color={CX_COLORS[cx] ?? "#6b7280"} />
                  </div>

                  {play.costDev && (
                    <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 8 }}>
                      💰 Dev: {play.costDev} · Prod: {play.costProd}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => openPlay(play)} style={{ flex: 1 }}>
                      View Play <ChevronRight size={12} style={{ verticalAlign: -1 }} />
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => cmd("initDevKit", play)} style={{ flex: 1 }}>
                      Init DevKit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Start over */}
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button
              className="btn btn-secondary"
              onClick={() => { setStep(0); setAnswers([]); }}
            >
              <RotateCcw size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 32, paddingBottom: 20, flexWrap: "wrap" }}>
        <button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "navigate", panel: "playBrowser" })}>
          Browse All Plays
        </button>
        <button className="btn btn-secondary" onClick={() => vscode.postMessage({ command: "openUrl", url: "https://frootai.dev/configurator" })}>
          <ExternalLink size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
          Open on Website
        </button>
      </div>
    </div>
  );
}
