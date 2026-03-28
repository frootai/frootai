import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";

// ─── Release Data ──────────────────────────────────────────────────

interface Release {
  version: string;
  date: string;
  title: string;
  color: string;
  changes: string[];
}

const releases: Release[] = [
  {
    version: "v3.2.0",
    date: "March 27, 2026",
    title: "Logo, Ecosystem Completion, Auto-Publish",
    color: "#f59e0b",
    changes: [
      "New FrootAI Logo — transparent PNG (Logo 2), tightly-cropped favicon (6 sizes: 16-256px)",
      "Hero: 380px logo, -110px gap, 'It's simply Frootful.' tagline (pale golden yellow)",
      "Mobile: responsive hero (260px logo, 0px top padding), glassmorphism sidebar redesign",
      "Navbar logo: 40px standard size (was 32px)",
      "Docker page (/docker) — multi-arch setup, client configs, Kubernetes-ready",
      "Ecosystem page: +4 cards (Docker, CLI, REST API, SpecKit mention)",
      "Solution plays: +SpecKit card, SpecKit button per play, WAF + SpecKit badges",
      "Packages page: +5 FROOT Kits section (DevKit/TuneKit/SpecKit/InfraKit/EvalKit) with WAF-Aligned badges",
      "Setup guide: +CLI and Docker sections (Part 3 & 4)",
      "Developer Hub dropdown: reordered (API Reference after User Guide), renamed REST API Docs → REST API (Agent FAI)",
      "Roadmap: 6 items marked shipped (chatbot, scaffold, cost, WAF, Docker, REST API), 7 remaining",
      "Auto-publish workflows: npm + vsce now trigger on path push (version-gate), +workflow_dispatch",
      "Implementation plan: 242/242 = 100% shipped + 'Next Best Actions' future steps",
    ],
  },
  {
    version: "v3.1.2",
    date: "March 26–27, 2026",
    title: "CLI Scaffold, WAF Integration, REST API",
    color: "#10b981",
    changes: [
      "CLI: 8 commands — init, scaffold, search, cost, validate, validate --waf, doctor, help",
      "CLI scaffold: one-command play setup with froot.json manifest + 5 FROOT kits",
      "CLI init: auto-detect existing projects + post-scaffold welcome box",
      "@tuner agent: WAF check instructions (6 pillars checklist)",
      "REST API: 5 endpoints (chat, search, cost, health, openapi.json), 60 req/min rate limit",
      "OpenAPI 3.1 spec at /api/openapi.json",
      "API docs page (/api-docs) with interactive endpoint explorer",
      "SpecKit: spec/play-spec.json for all 20 plays, WAF alignment, evaluation thresholds",
      "FROOT Packages: config/froot-packages.json with 5 modular kits",
      "WAF scorecard: 6 pillars, 17 checks, npx frootai validate --waf",
      "6 WAF instruction files (.github/instructions/waf-*.instructions.md)",
      "User guide: +5 sections (SpecKit, CLI, Docker, REST API, WAF scorecard), 16→22 tools",
      "Agent FAI renamed from FAI Agent across entire codebase",
      "Consistency enforcement: validate-consistency.js (11 checks), sync-content.js, husky pre-commit",
      "Semantic release: release.js, release.yml, CHANGELOG generation",
      "Uptime monitoring: 15min checks, badges, npm publish notification",
      "12 GitHub Actions workflows active",
    ],
  },
  {
    version: "v3.0.0",
    date: "March 25, 2026",
    title: "Compute MCP, Docker, VS Code v1.0",
    color: "#7c3aed",
    changes: [
      "MCP: 6 new compute tools (semantic search, cost estimate, config validate, model compare, pricing, architecture patterns)",
      "MCP: 16 → 22 tools total (6 static + 4 live + 3 chain + 3 AI ecosystem + 6 compute)",
      "Docker: ghcr.io/gitpavleenbali/frootai-mcp multi-arch (amd64 + arm64)",
      "VS Code: v1.0.0 → v1.1.1, 17 commands, 4 sidebar panels, standalone engine",
      "VS Code: Init SpecKit command, MCP dropdown reorder, auto-create mcp.json",
      "npm v3.0.0 → v3.1.2 published",
      "Website: 25+ pages, Solution Configurator, Plugin Marketplace, Enterprise page",
      "Agent FAI chatbot live on Azure App Service B1 (Sweden Central)",
    ],
  },
  {
    version: "v2.3.0",
    date: "March 23, 2026",
    title: "Value Engine + Vision Complete",
    color: "#00C853",
    changes: [
      "Section F: Strategic value engine — MCP registry entry, SDK integration guide, adoption dashboard",
      "Section F: Professional README badges (VS Code installs, npm downloads, GitHub stars, build status)",
      "Section F: Public adoption page (/adoption) — ecosystem health, stats, use cases, integration points",
      "Section G: One-command deploy — azure.yaml + scripts/deploy-play.sh|.ps1 (infra + config + eval)",
      "Section G: Living packages — mcp-server/auto-update.js (knowledge auto-fetch from GitHub, 7-day TTL)",
      "Section G: Knowledge rebuild — scripts/rebuild-knowledge.sh|.ps1 (rebuild + sync + optional publish)",
      "Section G: Skill exporter — scripts/export-skills.sh|.ps1 (any FROOT module as .github/skills/)",
      "FAI Developer Hub — Developer Center, Feature Spec (A-Z), Admin/User/Contributor Guide, API Reference, Architecture, Changelog",
      "17 website pages total, 5 wiki docs in sidebar, full pre-push checklist with Developer Hub docs",
    ],
  },
  {
    version: "v2.2.0",
    date: "March 23, 2026",
    title: "Ecosystem Sprint",
    color: "#10b981",
    changes: [
      "Section C: 3 new MCP AI ecosystem tools (model catalog, pricing, compare)",
      "Section C: Rich agent.md for all 20 plays (1500–5000 bytes each)",
      "Section C: Per-play CI pipeline (validate-plays.yml)",
      "Section C: CONTRIBUTING.md rewritten + PR template",
      "Section C: Marketplace listing metadata (Azure + GitHub)",
      "Section C: A2A Agent Card for protocol interoperability",
    ],
  },
  {
    version: "v0.9.2",
    date: "March 23, 2026",
    title: "UX & Visibility",
    color: "#6366f1",
    changes: [
      "VS Code: Sidebar blank space fixed (collapsed panels)",
      "VS Code: MCP Tools (10) → (16), Phi → FAI Knowledge Hub",
      'VS Code: "Read User Guide" added to action picker (7 options)',
      "VS Code: All plays 04–20 status → Ready",
    ],
  },
  {
    version: "v0.9.0",
    date: "March 23, 2026",
    title: "Standalone Engine",
    color: "#06b6d4",
    changes: [
      "VS Code: Cached downloads (globalStorage, 24h TTL)",
      "VS Code: Layer colors in FROOT Modules panel",
      "VS Code: MCP Tools webview documentation",
      "VS Code: Tool grouping (Static + Live + Chain + AI)",
    ],
  },
  {
    version: "v2.1.1",
    date: "March 23, 2026",
    title: ".github Agentic OS",
    color: "#7c3aed",
    changes: [
      "MCP: Agent chain tools (agent_build, agent_review, agent_tune)",
      ".github Agentic OS deployed to all 20 plays (380 files)",
      "F4-GitHub-Agentic-OS knowledge module",
      "VS Code Extension standalone engine",
    ],
  },
  {
    version: "v1.3.1",
    date: "March 20–21, 2026",
    title: "Genesis",
    color: "#f59e0b",
    changes: [
      "17 knowledge modules launched",
      "MCP server with 6 tools",
      "VS Code extension v0.1.0",
      "Website with 8 pages",
      "20 solution play skeletons",
    ],
  },
];

// ─── Styles ────────────────────────────────────────────────────────

const cardStyle = (color: string): React.CSSProperties => ({
  padding: "24px 28px",
  borderRadius: "14px",
  border: "1px solid var(--ifm-color-emphasis-200)",
  borderLeft: `4px solid ${color}`,
  background: "var(--ifm-background-surface-color)",
  marginBottom: "24px",
  transition: "border-color 0.2s, box-shadow 0.2s",
});

const badgeStyle = (color: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: "6px",
  fontSize: "0.72rem",
  fontWeight: 700,
  fontFamily: "var(--ifm-font-family-monospace)",
  background: `${color}18`,
  color,
  marginRight: "10px",
});

// ─── Page ──────────────────────────────────────────────────────────

export default function DevHubChangelogPage(): JSX.Element {
  return (
    <Layout title="Changelog — FrootAI" description="FrootAI version history and release notes.">
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* ═══ HEADER ═══ */}
        <section style={{ textAlign: "center", marginBottom: "48px" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "#7c3aed", marginBottom: "8px" }}>
            Release History
          </p>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "8px",
            background: "linear-gradient(135deg, #10b981 0%, #06b6d4 40%, #7c3aed 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Changelog
          </h1>
          <p style={{ fontSize: "0.92rem", color: "var(--ifm-color-emphasis-500)", maxWidth: "500px", margin: "0 auto" }}>
            Every release, from Genesis to today. New tools, fixes, and ecosystem improvements.
          </p>
        </section>

        {/* ═══ RELEASES ═══ */}
        {releases.map((r) => (
          <div key={r.version} style={cardStyle(r.color)}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              <span style={badgeStyle(r.color)}>{r.version}</span>
              <span style={{ fontSize: "0.78rem", color: "var(--ifm-color-emphasis-400)" }}>{r.date}</span>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: r.color, marginLeft: "4px" }}>— "{r.title}"</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: "20px" }}>
              {r.changes.map((c, i) => (
                <li key={i} style={{ fontSize: "0.84rem", lineHeight: 1.8, color: "var(--ifm-color-emphasis-700)" }}>{c}</li>
              ))}
            </ul>
          </div>
        ))}

        {/* ═══ FOOTER ═══ */}
        <section style={{ textAlign: "center", padding: "28px 24px", borderRadius: "16px", border: "1px solid var(--ifm-color-emphasis-200)", background: "var(--ifm-background-surface-color)" }}>
          <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-500)", marginBottom: "16px" }}>
            For the full commit history, visit GitHub.
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { label: "📜 Full Commit Log", to: "https://github.com/gitpavleenbali/frootai/commits/main", color: "#10b981" },
              { label: "🏠 Developer Hub", to: "/dev-hub", color: "#6366f1" },
              { label: "⭐ Star on GitHub", to: "https://github.com/gitpavleenbali/frootai", color: "#f59e0b" },
            ].map((link) => (
              <Link key={link.label} to={link.to} className={styles.glowPill} style={{ "--pill-color": link.color } as React.CSSProperties}>
                {link.label}
              </Link>
            ))}
          </div>
        </section>

      </div>
    </Layout>
  );
}
