# FrootAI — Product Hunt Launch Kit

> Everything needed for a successful Product Hunt launch.

---

## Tagline (60 chars max)

```
The open glue that wires AI primitives into systems
```

**Alternatives:**
- `Wire AI agents, skills & plugins into deployable systems`
- `104 AI architectures, 862 primitives, one protocol`

## Short Description (260 chars)

```
FrootAI is the missing binding layer for AI development. While MCP handles tool calling and A2A handles delegation, FrootAI handles wiring — 862+ primitives across 104 solution plays via the FAI Protocol. 45 MCP tools. Bicep + Terraform IaC. Open source.
```

## Detailed Description

### The Problem

Building production AI systems requires assembling dozens of primitives — agents, instructions, skills, hooks, plugins — from different frameworks with no standard way to wire them together. Teams spend more time on integration plumbing than on actual AI value.

### The Solution

FrootAI introduces the **FAI Protocol** — a declarative standard (`fai-manifest.json`) that context-wires AI primitives into deployable systems. Think of it as the Dockerfile for AI architectures.

**What you get:**

🔧 **45 MCP Tools** — Architecture guidance, solution play discovery, model comparison, cost estimation, AI evaluation, primitive management, and FAI Protocol orchestration. Works with any MCP-compatible client (VS Code, Claude Desktop, Cursor, Windsurf).

📦 **104 Solution Plays** — Production-ready AI architectures covering Enterprise RAG, Multi-Agent Systems, Voice AI, Document Intelligence, Agentic RAG, Edge AI, Browser Agents, AI Landing Zones, and 96 more. Each play ships with agents, IaC (Bicep + Terraform), evaluation pipelines, and quality guardrails.

🧩 **862+ Reusable Primitives** — 238 agents, 176 instructions, 333 skills, 10 hooks, 77 plugins, 12 workflows, and 16 cookbook recipes. All cataloged with Well-Architected Framework alignment across 6 pillars.

🔌 **FAI Protocol v2.0** — 10 moonshot contract types (Context, Guardrail, Routing, Handoff, Evaluation, Cost, Security, Observability, Deployment, Lifecycle) for declarative agent orchestration across platforms.

🌐 **Cross-Framework** — Native adapters for Semantic Kernel and LangChain. Framework-agnostic primitives that work everywhere.

### How it works

```bash
# Install — zero config, instant start
npx frootai-mcp@5.2.0

# Search 104 solution plays
# "I need a RAG pipeline with citation tracking"
→ Returns Play 01: Enterprise RAG with architecture, IaC, and eval pipeline

# Wire primitives via FAI Protocol
# fai-manifest.json declares agents, skills, guardrails, and contracts
→ One file wires an entire AI system

# Deploy with IaC
# Bicep + Terraform templates for every Azure play
→ Infrastructure and AI wiring ship together
```

## Key Features (5 bullets for the Product Hunt card)

1. **🔧 45 MCP Tools** — Architecture guidance, cost estimation, model comparison, evaluation, and primitive orchestration via any MCP client
2. **📦 104 Solution Plays** — Production-ready AI architectures with agents, IaC, eval pipelines, and guardrails for every scenario
3. **🧩 862+ AI Primitives** — Agents, skills, instructions, hooks, plugins, workflows, and cookbook recipes — all WAF-aligned and cross-framework
4. **🔌 FAI Protocol** — The Dockerfile for AI systems — declarative context-wiring with 10 moonshot contract types
5. **🌐 6 Distribution Channels** — npm, PyPI, VS Code, Docker, GitHub Actions, CLI — use FrootAI wherever you build

## Maker Comment Draft

> Hey Product Hunt! 👋
>
> I'm the creator of FrootAI — the open glue for the GenAI ecosystem.
>
> **The problem we solve:** Building production AI systems requires assembling agents, skills, and tools from different frameworks. There's no standard for wiring these primitives together. MCP handles tool calling. A2A handles delegation. AG-UI handles rendering. But nothing handles the *wiring* — how primitives share context, enforce quality gates, and deploy as a system.
>
> **What we built:** The FAI Protocol — a declarative standard (`fai-manifest.json`) that context-wires AI primitives into deployable architectures. One manifest file declares your agents, skills, guardrails, IaC, and evaluation pipelines. We ship 862+ reusable primitives across 104 production-ready solution plays.
>
> **What makes us different:**
> - Primitives work standalone but auto-wire when used inside solution plays
> - Every primitive has Well-Architected Framework alignment (6 pillars)
> - IaC (Bicep + Terraform) ships with every architecture
> - 45 MCP tools work in VS Code, Claude Desktop, Cursor, and any MCP client
> - 6 distribution channels — install however you prefer
>
> **It's 100% open source (MIT).** We believe every AI platform will eventually need a primitive wiring standard. We're the pioneers building it.
>
> Would love your feedback on what primitives or solution plays you'd find most useful!

## Launch Checklist

### Pre-Launch (1 week before)
- [ ] Verify all 45 MCP tools are working in latest release
- [ ] Update frootai.dev homepage with launch banner
- [ ] Prepare 5 screenshots/GIFs showing key workflows
- [ ] Record 1-minute demo video (MCP tools in VS Code → architecture diagram → cost estimation)
- [ ] Draft 3 social media announcements (Twitter/X, LinkedIn, Reddit)
- [ ] Notify top contributors and early adopters
- [ ] Test `npx frootai-mcp@5.2.0` fresh install on clean machine

### Launch Day
- [ ] Submit to Product Hunt at 12:01 AM PT
- [ ] Post maker comment immediately after submission
- [ ] Share on Twitter/X with demo GIF
- [ ] Post on LinkedIn with detailed write-up
- [ ] Share on r/MachineLearning, r/artificial, r/ChatGPT, r/LocalLLaMA
- [ ] Share in MCP Discord, AI Discord servers
- [ ] Reply to every comment within 1 hour

### Post-Launch (48 hours)
- [ ] Thank all supporters publicly
- [ ] Create GitHub Discussion for Product Hunt visitors
- [ ] Track conversion: PH visitors → GitHub stars → npm installs
- [ ] Update README.md with "Featured on Product Hunt" badge
- [ ] Plan follow-up content based on feedback themes

## Product Hunt Metadata

```
Category: Developer Tools
Topics: AI, Open Source, MCP, Architecture, Developer Tools
Pricing: Free (MIT License)
Platform: Cross-platform (npm, PyPI, Docker, VS Code, GitHub Actions)
Website: https://frootai.dev
GitHub: https://github.com/frootai/frootai
```

## Media Assets Needed

| Asset | Spec | Status |
|-------|------|--------|
| Logo (240×240) | PNG, transparent background | Required |
| Gallery image 1 | 1270×760, MCP tools in VS Code | Required |
| Gallery image 2 | 1270×760, Solution play architecture diagram | Required |
| Gallery image 3 | 1270×760, FAI Protocol manifest example | Required |
| Gallery image 4 | 1270×760, Cost estimation output | Optional |
| Gallery image 5 | 1270×760, Primitive catalog browse | Optional |
| Demo video | 1-2 min, MP4, 1080p | Recommended |
| OG image | 1200×630, for social sharing | Required |
