"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeader } from "@/components/ui/section-header";
import { CodeBlock } from "@/components/ui/code-block";
import { Card } from "@/components/ui/card";
import { GlowPill } from "@/components/ui/glow-pill";

const stats = [
  { num: "20", label: "Solution Plays", color: "#7c3aed" },
  { num: "22", label: "MCP Tools", color: "#6366f1" },
  { num: "18", label: "Knowledge Modules", color: "#10b981" },
  { num: "200+", label: "AI Glossary Terms", color: "#f59e0b" },
];

export function HiFaiClient() {
  const [step, setStep] = useState(0);
  const totalSteps = 5;

  const steps = [
    /* Step 1: Welcome */
    <div key="1">
      <p className="text-sm text-fg-muted leading-relaxed mb-5">
        <strong className="text-fg">FrootAI</strong> is a <em>Build It Yourself</em> AI LEGO Kit — the open-source glue binding{" "}
        <span className="font-bold text-emerald">Infrastructure</span>,{" "}
        <span className="font-bold text-cyan">Platform</span> &{" "}
        <span className="font-bold text-violet">Application</span> teams with the GenAI ecosystem.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {stats.map((s) => (
          <div key={s.label} className="text-center rounded-xl border p-3" style={{ borderColor: `color-mix(in srgb, ${s.color} 25%, transparent)`, background: `color-mix(in srgb, ${s.color} 4%, transparent)` }}>
            <div className="text-xl font-extrabold" style={{ color: s.color }}>{s.num}</div>
            <div className="text-[10px] text-fg-dim uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <blockquote className="border-l-2 border-emerald pl-3 text-[13px] text-fg-muted italic">
        <strong className="text-fg">FROOT</strong> = Foundations · Reasoning · Orchestration · Operations · Transformation
      </blockquote>
    </div>,

    /* Step 2: VS Code Extension */
    <div key="2">
      <p className="text-sm text-fg-muted leading-relaxed mb-4">
        The VS Code Extension is your control center — browse plays, init DevKit, search knowledge, and chain agents.
      </p>
      <CodeBlock label="Terminal" labelColor="#10b981" className="mb-4" code="code --install-extension pavleenbali.frootai" />
      <p className="text-[13px] text-fg-muted mb-4">
        Or: <strong className="text-fg">Ctrl+Shift+X</strong> → search <strong className="text-fg">&quot;FrootAI&quot;</strong> → Install
      </p>
      <div className="flex flex-wrap gap-2">
        {["Solution Plays (20)", "MCP Tools (22)", "Knowledge Hub (18)", "AI Glossary (200+)"].map((p) => (
          <span key={p} className="rounded-lg border border-emerald/20 bg-emerald/5 px-3 py-1.5 text-[11px] font-semibold text-emerald">{p}</span>
        ))}
      </div>
    </div>,

    /* Step 3: MCP Server */
    <div key="3">
      <p className="text-sm text-fg-muted leading-relaxed mb-4">
        The MCP Server gives your AI agent 22 tools for live FrootAI knowledge — architecture patterns, model pricing, Azure docs, and more.
      </p>
      <CodeBlock label="Add to .vscode/mcp.json" labelColor="#10b981" className="mb-4" code={`{\n  "servers": {\n    "frootai": {\n      "type": "stdio",\n      "command": "npx",\n      "args": ["frootai-mcp"]\n    }\n  }\n}`} />
      <p className="text-[12px] text-emerald font-semibold">Reload VS Code. FrootAI tools are now available in Copilot Chat.</p>
    </div>,

    /* Step 4: DevKit + TuneKit */
    <div key="4">
      <p className="text-sm text-fg-muted leading-relaxed mb-4">
        Initialize DevKit to get the full .github Agentic OS (19 files, 4 layers) + TuneKit for AI configuration.
      </p>
      <div className="space-y-3">
        <Card className="border-cyan/20 bg-cyan/[0.02]">
          <h4 className="font-bold text-[13px] text-cyan mb-1">Init DevKit</h4>
          <p className="text-[12px] text-fg-muted">Left-click on a play → select Init DevKit → 19 files copied to .github/</p>
        </Card>
        <Card className="border-violet/20 bg-violet/[0.02]">
          <h4 className="font-bold text-[13px] text-violet mb-1">Init TuneKit</h4>
          <p className="text-[12px] text-fg-muted">Left-click again → Init TuneKit → config/*.json + infra/main.bicep + evaluation/</p>
        </Card>
      </div>
    </div>,

    /* Step 5: Auto-Chain */
    <div key="5">
      <p className="text-sm text-fg-muted leading-relaxed mb-4">
        Use the Build → Review → Tune agent chain for a full development workflow.
      </p>
      <Card className="border-amber/20 bg-amber/[0.02] mb-4">
        <p className="text-[12px] text-fg-muted mb-2">Run <code className="rounded bg-amber/10 px-1.5 py-0.5 text-amber font-mono text-[11px]">Ctrl+Shift+P → FrootAI: Auto-Chain Agents</code></p>
        <ol className="text-[13px] text-fg-muted space-y-1.5 list-decimal pl-4">
          <li><strong className="text-fg">Builder</strong> — describe what to build → paste prompt in Copilot Chat</li>
          <li><strong className="text-fg">Reviewer</strong> — auto-reviews code for security, quality, best practices</li>
          <li><strong className="text-fg">Tuner</strong> — validates TuneKit configs for production readiness</li>
          <li><strong className="text-fg">Deploy</strong> — optional /deploy walkthrough</li>
        </ol>
      </Card>
      <div className="text-center">
        <p className="text-[14px] font-bold text-emerald mb-3">You&apos;re all set!</p>
        <div className="flex flex-wrap justify-center gap-2">
          <GlowPill href="/solution-plays" color="#7c3aed">Browse Solution Plays</GlowPill>
          <GlowPill href="/chatbot" color="#f59e0b">Ask Agent FAI</GlowPill>
          <GlowPill href="/" color="#10b981">Back to FrootAI</GlowPill>
        </div>
      </div>
    </div>,
  ];

  const stepTitles = [
    { num: "01", icon: "", title: "Welcome to FrootAI", time: "30 sec" },
    { num: "02", icon: "", title: "Install VS Code Extension", time: "1 min" },
    { num: "03", icon: "", title: "Set Up MCP Server", time: "1 min" },
    { num: "04", icon: "", title: "DevKit + TuneKit", time: "1 min" },
    { num: "05", icon: "", title: "Auto-Chain Agents", time: "1 min" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader
        title="Hi FAI — 5-Minute Quickstart"
        subtitle="From zero to production-ready in 5 steps. Welcome to FrootAI."
      />

      {/* Progress */}
      <FadeIn>
        <div className="flex gap-1.5 justify-center mb-8">
          {stepTitles.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${i === step ? "w-10 bg-emerald" : i < step ? "w-6 bg-emerald/40" : "w-6 bg-border"}`} />
          ))}
        </div>
      </FadeIn>

      {/* Step header */}
      <FadeIn>
        <div className="flex items-center gap-3 mb-6">
          <div>
            <h2 className="text-lg font-bold">Step {stepTitles[step].num}: {stepTitles[step].title}</h2>
            <p className="text-[11px] text-fg-dim">{stepTitles[step].time}</p>
          </div>
        </div>
      </FadeIn>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="mb-8"
        >
          {steps[step]}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
          className="flex items-center gap-1 rounded-xl border border-border px-4 py-2 text-[13px] font-semibold text-fg-muted cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg-elevated transition-colors">
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <span className="text-[12px] text-fg-dim">{step + 1} / {totalSteps}</span>
        <button onClick={() => setStep(Math.min(totalSteps - 1, step + 1))} disabled={step === totalSteps - 1}
          className="flex items-center gap-1 rounded-xl border border-emerald/30 bg-emerald/5 px-4 py-2 text-[13px] font-semibold text-emerald cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald/10 transition-colors">
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
