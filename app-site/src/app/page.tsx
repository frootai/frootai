"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCatalog, type CatalogStats } from "@/lib/api";
import StatCard from "@/components/StatCard";

const quickActions = [
  {
    icon: "🔍",
    title: "Browse Primitives",
    description: "Explore 800+ agents, skills, instructions, hooks & plugins",
    href: "/explorer",
  },
  {
    icon: "🏗️",
    title: "Configure Play",
    description: "Pick a solution play and customize it for your use case",
    href: "/plays",
  },
  {
    icon: "🎮",
    title: "Test MCP Tool",
    description: "Try FrootAI MCP tools interactively in the playground",
    href: "/playground",
  },
  {
    icon: "📖",
    title: "Read Docs",
    description: "Learn the FROOT framework and AI architecture patterns",
    href: "/learning",
  },
];

const checklistItems = [
  { label: "Install CLI", done: false, cmd: "npx frootai-mcp@latest" },
  { label: "Browse Plays", done: false, href: "/plays" },
  { label: "Init DevKit", done: false, cmd: "npx frootai init 01" },
  { label: "Run Evaluation", done: false, cmd: "npx frootai eval" },
];

export default function Dashboard() {
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCatalog()
      .then((c) => setStats(c.stats))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-2xl border border-frootai-border bg-gradient-to-br from-frootai-surface to-frootai-dark p-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to{" "}
          <span className="text-white">Froot</span>
          <span className="text-frootai-emerald">AI</span>{" "}
          Platform
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-frootai-muted leading-relaxed">
          The interactive hub for AI primitives. Browse, test, and configure
          solution plays — from enterprise RAG to multi-agent swarms.
        </p>
      </div>

      {/* Stats Grid */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Platform Stats</h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-frootai-border bg-frootai-surface"
              />
            ))}
          </div>
        ) : stats ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard icon="📦" title="Total Primitives" value={stats.totalPrimitives} />
            <StatCard icon="🤖" title="Agents" value={stats.agents} />
            <StatCard icon="⚡" title="Skills" value={stats.skills} />
            <StatCard icon="🏗️" title="Solution Plays" value={stats.plays} />
            <StatCard icon="🔌" title="Plugins" value={stats.plugins} />
            <StatCard icon="🔧" title="MCP Tools" value={stats.mcpTools} />
          </div>
        ) : null}
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-xl border border-frootai-border bg-frootai-surface p-5 hover:border-frootai-emerald/50 hover:bg-frootai-surface-hover transition-all"
            >
              <span className="text-2xl">{action.icon}</span>
              <h3 className="mt-3 text-sm font-semibold text-frootai-text group-hover:text-frootai-emerald transition-colors">
                {action.title}
              </h3>
              <p className="mt-1 text-xs text-frootai-muted leading-relaxed">
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Getting Started */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Getting Started</h2>
        <div className="rounded-xl border border-frootai-border bg-frootai-surface p-5">
          <div className="space-y-3">
            {checklistItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg bg-frootai-dark/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                      item.done
                        ? "border-frootai-emerald bg-frootai-emerald text-white"
                        : "border-frootai-border text-frootai-muted"
                    }`}
                  >
                    {item.done ? "✓" : ""}
                  </span>
                  <span className="text-sm text-frootai-text">
                    {item.label}
                  </span>
                </div>
                {item.cmd && (
                  <code className="rounded bg-frootai-surface px-2 py-1 text-[11px] font-mono text-frootai-muted">
                    {item.cmd}
                  </code>
                )}
                {item.href && (
                  <Link
                    href={item.href}
                    className="text-xs text-frootai-emerald hover:underline"
                  >
                    Go →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
