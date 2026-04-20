"use client";

import { useState } from "react";

interface Channel {
  name: string;
  icon: string;
  command: string;
  link: string;
  description: string;
}

const channels: Channel[] = [
  {
    name: "MCP Server (npm)",
    icon: "🔧",
    command: "npx frootai-mcp@latest",
    link: "https://www.npmjs.com/package/frootai-mcp",
    description: "45 MCP tools for AI architecture guidance",
  },
  {
    name: "Python SDK (PyPI)",
    icon: "🐍",
    command: "pip install frootai",
    link: "https://pypi.org/project/frootai/",
    description: "Python client for FrootAI primitives and evaluation",
  },
  {
    name: "VS Code Extension",
    icon: "💎",
    command: "code --install-extension frootai.frootai",
    link: "https://marketplace.visualstudio.com/items?itemName=frootai.frootai",
    description: "Browse primitives and solution plays inside VS Code",
  },
  {
    name: "Docker Image",
    icon: "🐳",
    command: "docker pull frootai/frootai-mcp:latest",
    link: "https://hub.docker.com/r/frootai/frootai-mcp",
    description: "Containerized MCP server for team deployment",
  },
  {
    name: "CLI Tool",
    icon: "⌨️",
    command: "npx frootai@latest",
    link: "https://www.npmjs.com/package/frootai",
    description: "Initialize DevKits and manage solution plays",
  },
  {
    name: "Python MCP (PyPI)",
    icon: "🔌",
    command: "pip install frootai-mcp",
    link: "https://pypi.org/project/frootai-mcp/",
    description: "Python MCP server with 45 tools",
  },
];

const links = [
  {
    label: "GitHub Repository",
    icon: "⭐",
    href: "https://github.com/frootai/frootai",
    color: "text-yellow-400",
  },
  {
    label: "Documentation",
    icon: "📖",
    href: "https://docs.frootai.dev",
    color: "text-blue-400",
  },
  {
    label: "Status Page",
    icon: "🟢",
    href: "https://status.frootai.dev",
    color: "text-green-400",
  },
  {
    label: "Website",
    icon: "🌐",
    href: "https://frootai.dev",
    color: "text-frootai-emerald",
  },
];

export default function EcosystemPage() {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (cmd: string) => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 2000);
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Ecosystem</h1>
        <p className="mt-1 text-sm text-frootai-muted">
          Install and integrate FrootAI across your development workflow
        </p>
      </div>

      {/* Distribution Channels */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Distribution Channels</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((ch) => (
            <div
              key={ch.name}
              className="rounded-xl border border-frootai-border bg-frootai-surface p-5 hover:border-frootai-emerald/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{ch.icon}</span>
                <div>
                  <h3 className="text-sm font-semibold text-frootai-text">
                    {ch.name}
                  </h3>
                  <p className="text-xs text-frootai-muted">{ch.description}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-frootai-dark px-3 py-2 text-xs font-mono text-frootai-muted">
                  {ch.command}
                </code>
                <button
                  onClick={() => copyToClipboard(ch.command)}
                  className="shrink-0 rounded-lg bg-frootai-dark px-3 py-2 text-xs text-frootai-muted hover:text-frootai-emerald transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedCmd === ch.command ? "✓" : "📋"}
                </button>
              </div>
              <a
                href={ch.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-xs text-frootai-emerald hover:underline"
              >
                View package →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Links */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Links</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-frootai-border bg-frootai-surface p-4 hover:border-frootai-emerald/50 hover:bg-frootai-surface-hover transition-all"
            >
              <span className={`text-xl ${link.color}`}>{link.icon}</span>
              <span className="text-sm font-medium text-frootai-text">
                {link.label}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Roadmap placeholder */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Roadmap</h2>
        <div className="rounded-xl border border-frootai-border bg-frootai-surface p-6">
          <div className="space-y-4">
            {[
              { q: "Q2 2026", items: ["FAI Protocol v2.0", "A2A + AG-UI integration", "Visual DevKit builder"] },
              { q: "Q3 2026", items: ["Enterprise SSO", "Team collaboration features", "Custom play marketplace"] },
              { q: "Q4 2026", items: ["FAI Cloud (hosted runtime)", "Automated play generation", "100+ solution plays"] },
            ].map((milestone) => (
              <div key={milestone.q} className="flex gap-4">
                <span className="shrink-0 rounded-lg bg-frootai-emerald/10 px-3 py-1 text-xs font-semibold text-frootai-emerald">
                  {milestone.q}
                </span>
                <div className="flex flex-wrap gap-2">
                  {milestone.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-frootai-dark px-3 py-1 text-xs text-frootai-muted"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
