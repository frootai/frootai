"use client";

import { useState } from "react";
import { FadeIn } from "@/components/motion/fade-in";
import { SectionHeader } from "@/components/ui/section-header";
import { CodeBlock } from "@/components/ui/code-block";
import { Card } from "@/components/ui/card";
import { GlowPill } from "@/components/ui/glow-pill";

const tabs = [
  { id: "mcp", label: "MCP Server", color: "#10b981" },
  { id: "vscode", label: "VS Code Extension", color: "#6366f1" },
  { id: "cli", label: "CLI", color: "#f59e0b" },
  { id: "docker", label: "Docker", color: "#06b6d4" },
];

const clientTabs = ["Claude / Cursor", "VS Code / Copilot", "Azure AI Foundry"] as const;

export function SetupGuideClient() {
  const [activeClient, setActiveClient] = useState<typeof clientTabs[number]>("Claude / Cursor");

  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 py-12 sm:py-16">
      <SectionHeader
        title="FrootAI Setup Guide"
        subtitle={<>Two tools, one setup page. Get FrootAI&apos;s <strong className="text-fg">MCP Server</strong> (for your AI agent) and <strong className="text-fg">VS Code Extension</strong> (for you) up and running in minutes.</>}
      />

      {/* Section scroll buttons */}
      <FadeIn>
        <div className="flex flex-wrap gap-2 justify-center mb-12">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-xl border-2 px-5 py-2.5 text-[13px] font-bold cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              style={{ borderColor: `color-mix(in srgb, ${t.color} 30%, transparent)`, background: `color-mix(in srgb, ${t.color} 4%, transparent)`, color: t.color }}>
              {t.label}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* ═══ MCP SERVER ═══ */}
      <section id="mcp" className="mb-16 rounded-2xl border-2 border-emerald/20 bg-emerald/[0.01] p-6 sm:p-8 scroll-mt-24">
        <h2 className="text-xl font-bold text-emerald mb-2">Part 1: MCP Server Setup</h2>
        <p className="text-[13px] text-fg-muted mb-6">Add AI architecture knowledge to any agent. Works with Claude Desktop, VS Code Copilot, Cursor, Windsurf, Azure AI Foundry.</p>

        <Card className="mb-6">
          <h3 className="font-bold text-sm mb-3">Prerequisites</h3>
          <ul className="text-[13px] text-fg-muted space-y-1.5 list-disc pl-4">
            <li><strong className="text-fg">Node.js 18+</strong> — <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer" className="text-amber hover:underline">Download here</a></li>
            <li><strong className="text-fg">Git</strong> — <a href="https://git-scm.com/" target="_blank" rel="noopener noreferrer" className="text-amber hover:underline">Download here</a></li>
            <li><strong className="text-fg">An MCP client</strong> — VS Code, Claude Desktop, Cursor, Windsurf, or Azure AI Foundry</li>
          </ul>
        </Card>

        <h3 className="font-bold text-sm mb-2">Step 1: Install</h3>
        <p className="text-[12px] text-fg-dim mb-2">Option A: npm (Recommended — zero clone)</p>
        <CodeBlock label="Terminal" labelColor="#10b981" className="mb-4" code={`# Run directly (no install needed)\nnpx frootai-mcp@latest\n\n# OR install globally\nnpm install -g frootai-mcp@latest\nfrootai-mcp`} />

        <p className="text-[12px] text-fg-dim mb-2">Option B: Docker (no Node.js needed)</p>
        <CodeBlock label="Terminal" labelColor="#06b6d4" className="mb-4" code="docker run -i ghcr.io/gitpavleenbali/frootai-mcp" />

        <p className="text-[12px] text-fg-dim mb-2">Option C: From GitHub</p>
        <CodeBlock label="Terminal" labelColor="#6366f1" className="mb-6" code={`git clone https://github.com/gitpavleenbali/frootai.git\ncd frootai/mcp-server\nnpm install`} />

        <h3 className="font-bold text-sm mb-3">Step 2: Connect to Your Client</h3>
        <div className="flex gap-2 mb-4 flex-wrap">
          {clientTabs.map((ct) => (
            <button key={ct} onClick={() => setActiveClient(ct)}
              className={`rounded-lg px-4 py-2 text-[12px] font-semibold border cursor-pointer transition-colors ${activeClient === ct ? "border-indigo/40 bg-indigo/10 text-indigo" : "border-border text-fg-muted hover:bg-bg-elevated"}`}>
              {ct}
            </button>
          ))}
        </div>

        {activeClient === "Claude / Cursor" && (
          <Card>
            <h4 className="font-bold text-[13px] mb-2">Claude Desktop / Cursor / Windsurf</h4>
            <CodeBlock label="claude_desktop_config.json" labelColor="#6366f1" code={`{\n  "mcpServers": {\n    "frootai": {\n      "command": "npx",\n      "args": ["frootai-mcp"]\n    }\n  }\n}`} />
            <p className="mt-3 text-[12px] text-emerald">Restart Claude Desktop. FrootAI appears in your tools list.</p>
          </Card>
        )}
        {activeClient === "VS Code / Copilot" && (
          <Card>
            <h4 className="font-bold text-[13px] mb-2">VS Code / GitHub Copilot</h4>
            <p className="text-[12px] text-fg-muted mb-2">Create <code className="rounded bg-indigo/10 px-1.5 py-0.5 text-[11px] text-indigo font-mono">.vscode/mcp.json</code> in your project:</p>
            <CodeBlock label=".vscode/mcp.json" labelColor="#6366f1" code={`{\n  "servers": {\n    "frootai": {\n      "type": "stdio",\n      "command": "npx",\n      "args": ["frootai-mcp"]\n    }\n  }\n}`} />
            <p className="mt-3 text-[12px] text-emerald">Reload VS Code. Type @frootai in Copilot Chat to query.</p>
          </Card>
        )}
        {activeClient === "Azure AI Foundry" && (
          <Card>
            <h4 className="font-bold text-[13px] mb-2">Azure AI Foundry</h4>
            <ol className="text-[13px] text-fg-muted space-y-1.5 list-decimal pl-4">
              <li>Open your Agent in Azure AI Foundry</li>
              <li>Click <strong className="text-fg">Tools → Add Tool</strong></li>
              <li>Select <strong className="text-fg">MCP</strong> from the type dropdown</li>
              <li>Point to the FrootAI MCP server</li>
              <li>22 tools appear in your agent&apos;s tool list</li>
            </ol>
          </Card>
        )}
      </section>

      {/* ═══ VS CODE EXTENSION ═══ */}
      <section id="vscode" className="mb-16 rounded-2xl border-2 border-indigo/20 bg-indigo/[0.01] p-6 sm:p-8 scroll-mt-24">
        <h2 className="text-xl font-bold text-indigo mb-2">Part 2: VS Code Extension</h2>
        <p className="text-[13px] text-fg-muted mb-6">Browse plays, init DevKit, search terms — right from your editor.</p>
        <CodeBlock label="Terminal" labelColor="#6366f1" className="mb-4" code="code --install-extension pavleenbali.frootai" />
        <p className="text-[13px] text-fg-muted mb-4">Or: <strong className="text-fg">Ctrl+Shift+X</strong> → search <strong className="text-fg">&quot;FrootAI&quot;</strong> → Install</p>
        <div className="flex flex-wrap gap-2">
          {["Solution Plays (20)", "MCP Tools (22)", "Knowledge Hub (18)", "AI Glossary (200+)"].map((p) => (
            <span key={p} className="rounded-lg border border-emerald/20 bg-emerald/5 px-3 py-1.5 text-[11px] font-semibold text-emerald">{p}</span>
          ))}
        </div>
      </section>

      {/* ═══ CLI ═══ */}
      <section id="cli" className="mb-16 rounded-2xl border-2 border-amber/20 bg-amber/[0.01] p-6 sm:p-8 scroll-mt-24">
        <h2 className="text-xl font-bold text-amber mb-2">Part 3: CLI</h2>
        <p className="text-[13px] text-fg-muted mb-4">Ships with the MCP Server package. No extra install.</p>
        <CodeBlock label="Terminal" labelColor="#f59e0b" code={`npx frootai init        # Interactive project scaffolding\nnpx frootai search RAG  # Search knowledge base\nnpx frootai cost 01 dev # Estimate Azure costs\nnpx frootai doctor      # Check environment`} />
      </section>

      {/* ═══ DOCKER ═══ */}
      <section id="docker" className="mb-16 rounded-2xl border-2 border-cyan/20 bg-cyan/[0.01] p-6 sm:p-8 scroll-mt-24">
        <h2 className="text-xl font-bold text-cyan mb-2">Part 4: Docker</h2>
        <p className="text-[13px] text-fg-muted mb-4">Zero Node.js required. Multi-arch (amd64 + arm64).</p>
        <CodeBlock label="Terminal" labelColor="#06b6d4" code="docker run -i --rm ghcr.io/gitpavleenbali/frootai-mcp:latest" />
      </section>

      {/* Bottom nav */}
      <div className="flex flex-wrap justify-center gap-2">
        <GlowPill href="/mcp-tooling" color="#10b981">MCP Server Details</GlowPill>
        <GlowPill href="/vscode-extension" color="#6366f1">Extension Details</GlowPill>
        <GlowPill href="/ecosystem" color="#0ea5e9">Ecosystem</GlowPill>
        <GlowPill href="/" color="#f59e0b">Back to FrootAI</GlowPill>
      </div>
    </div>
  );
}
