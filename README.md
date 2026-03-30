<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://frootai.dev/img/frootai-og.png">
  <img alt="FrootAI — From the Roots to the Fruits" src="https://frootai.dev/img/frootai-og.png" width="100%">
</picture>

<h1 align="center">🌳 FrootAI™</h1>
<h3 align="center">From the Roots to the Fruits</h3>
<p align="center"><em>The open AI architecture ecosystem for Infrastructure, Platform & Application teams.</em></p>

<p align="center">
  <a href="https://frootai.dev"><img src="https://img.shields.io/badge/Website-frootai.dev-10b981?style=flat-square&logo=cloudflare" alt="Website"></a>
  <a href="https://github.com/frootai/frootai"><img src="https://img.shields.io/github/stars/frootai/frootai?style=flat-square&logo=github" alt="Stars"></a>
  <a href="https://www.npmjs.com/package/frootai-mcp"><img src="https://img.shields.io/npm/dw/frootai-mcp?style=flat-square&logo=npm&label=npm" alt="npm"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai"><img src="https://img.shields.io/visual-studio-marketplace/i/pavleenbali.frootai?style=flat-square&logo=visualstudiocode&label=VS%20Code" alt="VS Code"></a>
</p>

<p align="center">
  <a href="https://pypi.org/project/frootai/"><img src="https://img.shields.io/pypi/dm/frootai?style=flat-square&logo=python&label=PyPI" alt="PyPI"></a>
  <a href="https://github.com/frootai/frootai/actions/workflows/docker-publish.yml"><img src="https://img.shields.io/github/actions/workflow/status/frootai/frootai/docker-publish.yml?style=flat-square&label=Docker&logo=docker" alt="Docker"></a>
  <a href="https://www.npmjs.com/package/frootai-mcp"><img src="https://img.shields.io/npm/v/frootai-mcp?style=flat-square&logo=npm&label=MCP%20v" alt="MCP Version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License"></a>
</p>

---

## What is FrootAI?

**FrootAI** is an open ecosystem where **Infra**, **Platform**, and **App** teams build AI — *Frootfully*.

> **FROOT** = **F**oundations · **R**easoning · **O**rchestration · **O**perations · **T**ransformation

| What | Numbers | For Whom | Links |
|------|:-------:|----------|-------|
| 🎯 **Solution Plays** — pre-tuned, deployable AI solutions | **20** plays | Infra & platform engineers | [Website](https://frootai.dev/solution-plays) · [GitHub](https://github.com/frootai/frootai/tree/main/solution-plays) |
| 🔌 **MCP Server** — callable AI architecture knowledge | **23** tools | AI agents (Copilot, Claude, Cursor) | [Website](https://frootai.dev/mcp-tooling) · [npm](https://www.npmjs.com/package/frootai-mcp) |
| 📖 **Knowledge Modules** — end-to-end AI curriculum | **16** modules | Cloud architects, CSAs | [Website](https://frootai.dev/docs) · [GitHub](https://github.com/frootai/frootai/tree/main/docs) |
| 💻 **VS Code Extension** — browse, scaffold, search | **19** commands | Developers | [Website](https://frootai.dev/vscode-extension) · [Marketplace](https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai) |
| 🐍 **Python SDK** — offline knowledge + evaluation | **zero** dependencies | Data scientists | [PyPI](https://pypi.org/project/frootai/) |
| ⌨️ **CLI** — init, search, cost, validate, doctor | **6** commands | Everyone | [Website](https://frootai.dev/cli) |

---

## Get Started in 30 Seconds

### Option 1: MCP Server (for your AI agent)

```bash
npx frootai-mcp@latest
```

Then add to your MCP config (`.vscode/mcp.json`, Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "frootai": { "command": "npx", "args": ["frootai-mcp@latest"] }
  }
}
```

### Option 2: VS Code Extension

```bash
code --install-extension pavleenbali.frootai
```

### Option 3: Python

```bash
pip install frootai          # SDK — offline knowledge, cost estimation
pip install frootai-mcp      # MCP Server — same 23 tools, pure Python
```

### Option 4: Docker

```bash
docker run -i ghcr.io/frootai/frootai-mcp
```

### Option 5: CLI

```bash
npx frootai init                              # Scaffold a project
npx frootai search "RAG architecture"         # Search knowledge
npx frootai cost enterprise-rag --scale prod  # Cost estimate
npx frootai validate                          # Check project structure
npx frootai doctor                            # Health check
```

---

## The FAI Ecosystem

```
┌─────────────────────────────────────────────────────────┐
│                    🏭 FAI Factory                        │
│     The production engine — assembles knowledge,         │
│     agents & skills into deployable form                 │
└──────────────────────────┬──────────────────────────────┘
                           │ builds
┌──────────────────────────▼──────────────────────────────┐
│                    📦 FAI Packages                        │
│     6 distribution channels:                             │
│     VS Code · npm · PyPI · Docker · CLI · GitHub         │
└──────────────────────────┬──────────────────────────────┘
                           │ delivers
┌──────────────────────────▼──────────────────────────────┐
│                    🔧 FAI Toolkit                         │
│     What ships inside every package:                     │
│     DevKit · TuneKit · SpecKit                           │
└─────────────────────────────────────────────────────────┘
```

**Factory builds → Packages deliver → Toolkit equips**

---

## MCP Server — 23 Tools

| Category | Tools | What They Do |
|----------|:-----:|--------------|
| **Static** (bundled) | 6 | `list_modules`, `get_module`, `lookup_term`, `search_knowledge`, `get_architecture_pattern`, `get_froot_overview` |
| **Live** (network) | 4 | `fetch_azure_docs`, `fetch_external_mcp`, `list_community_plays`, `get_github_agentic_os` |
| **Agent Chain** | 3 | `agent_build` → `agent_review` → `agent_tune` |
| **AI Ecosystem** | 4 | `get_model_catalog`, `get_azure_pricing`, `compare_models`, `compare_plays` |
| **Compute** | 6 | `estimate_cost`, `embedding_playground`, `generate_architecture_diagram`, `search_knowledge` (semantic), `get_architecture_pattern`, `run_evaluation` |

Works with: **GitHub Copilot** · **Claude Desktop** · **Cursor** · **Windsurf** · **Azure AI Foundry** · any MCP client

---

## Solution Plays

Pre-tuned, deployable AI solutions — infra + AI config + agent instructions + evaluation.

| # | Solution | What It Deploys |
|---|---------|----------------|
| 01 | **Enterprise RAG Q&A** | AI Search + OpenAI + Container App |
| 02 | **AI Landing Zone** | VNet + Private Endpoints + RBAC + GPU |
| 03 | **Deterministic Agent** | Reliable agent with guardrails + eval |
| 04 | **Call Center Voice AI** | Real-time speech + sentiment analysis |
| 05 | **IT Ticket Resolution** | Auto-triage + resolution with KB |
| 06 | **Document Intelligence** | PDF/image extraction pipeline |
| 07 | **Multi-Agent Service** | Orchestrated agent collaboration |
| 08 | **Copilot Studio Bot** | Low-code conversational AI |
| 09 | **AI Search Portal** | Enterprise search with facets |
| 10 | **Content Moderation** | Safety filters + content classification |
| 11 | **AI Landing Zone Advanced** | Multi-region + DR + compliance |
| 12 | **Model Serving on AKS** | GPU clusters + model endpoints |
| 13 | **Fine-Tuning Workflow** | Data prep → train → eval → deploy |
| 14 | **Cost-Optimized AI Gateway** | Smart routing + token budgets |
| 15 | **Multi-Modal Doc Processing** | Images + tables + handwriting |
| 16 | **Copilot Teams Extension** | Teams bot with AI backend |
| 17 | **AI Observability** | Tracing + metrics + alerting |
| 18 | **Prompt Management** | Versioning + A/B testing + rollback |
| 19 | **Edge AI with Phi-4** | On-device inference, no cloud |
| 20 | **Anomaly Detection** | Time-series + pattern recognition |

Every play ships with: `.github` Agentic OS (19 files) · DevKit · TuneKit · SpecKit · Bicep infra

---

## .github Agentic OS

Every solution play includes the full GitHub Copilot Agentic OS — 4 layers, 7 primitives:

```
.github/
├── copilot-instructions.md              # Layer 1: Always-on context
├── instructions/*.instructions.md       # Layer 1: Modular standards
├── prompts/*.prompt.md                  # Layer 2: /deploy, /test, /review, /evaluate
├── agents/*.agent.md                    # Layer 2: builder → reviewer → tuner chain
├── skills/*/SKILL.md                    # Layer 2: Reusable runbooks
├── hooks/guardrails.json                # Layer 3: Policy enforcement
├── workflows/*.md                       # Layer 3: AI-driven CI
└── plugin.json                          # Layer 4: Distribution manifest
```

**19 files × 20 plays = 380 agentic OS files shipped.**

---

## The FROOT Framework

| Layer | Modules | What You Learn |
|:-----:|---------|---------------|
| 🌱 **F** | F1 · F2 · F3 · F4 | Foundations — tokens, models, glossary, Agentic OS |
| 🪵 **R** | R1 · R2 · R3 | Reasoning — prompts, RAG, grounding, deterministic AI |
| 🌿 **O** | O1 · O2 · O3 | Orchestration — Semantic Kernel, agents, MCP, tools |
| 🍃 **O** | O4 · O5 · O6 | Operations — Azure AI Foundry, GPU infra, Copilot ecosystem |
| 🍎 **T** | T1 · T2 · T3 | Transformation — fine-tuning, responsible AI, production patterns |

**16 modules · 200+ AI terms · 60,000+ words of curated content**

---

## Distribution Channels

| Channel | Install | Version | Links |
|---------|---------|:-------:|-------|
| **npm** | `npm install frootai-mcp` | 3.2.0 | [Website](https://frootai.dev/mcp-tooling) · [npmjs.com](https://www.npmjs.com/package/frootai-mcp) |
| **PyPI SDK** | `pip install frootai` | 3.3.0 | [PyPI](https://pypi.org/project/frootai/) |
| **PyPI MCP** | `pip install frootai-mcp` | 3.2.0 | [PyPI](https://pypi.org/project/frootai-mcp/) |
| **Docker** | `docker run -i ghcr.io/frootai/frootai-mcp` | latest | [Website](https://frootai.dev/docker) · [GHCR](https://github.com/frootai/frootai/pkgs/container/frootai-mcp) |
| **VS Code** | `code --install-extension pavleenbali.frootai` | 1.4.0 | [Website](https://frootai.dev/vscode-extension) · [Marketplace](https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai) |
| **CLI** | `npx frootai <command>` | 3.2.0 | [Website](https://frootai.dev/cli) |
| **REST API** | [frootai.dev/api-docs](https://frootai.dev/api-docs) | live | [API Docs](https://frootai.dev/api-docs) |
| **GitHub** | [github.com/frootai/frootai](https://github.com/frootai/frootai) | latest | [GitHub](https://github.com/frootai/frootai) |

---

## Repository Structure

```
frootai/frootai
├── mcp-server/            23 MCP tools + knowledge.json (682KB)
├── vscode-extension/      VS Code extension (19 commands, 2 sidebar panels)
├── python-sdk/            Python SDK — offline, zero deps
├── python-mcp/            Python MCP Server — 23 tools
├── functions/             REST API + Agent FAI chatbot
├── solution-plays/        20 plays with full .github Agentic OS
├── docs/                  16 FROOT knowledge modules
├── config/                Configurator data + spec templates
├── scripts/               Build, sync, validate automation
├── workshops/             3 hands-on workshop materials
├── community-plugins/     ServiceNow, Salesforce, SAP
├── bicep-registry/        Reusable Azure Bicep modules
├── infra-registry/        Infrastructure module registry
├── marketplace/           Marketplace listing metadata
├── CONTRIBUTING.md        How to contribute
└── LICENSE                MIT
```

---

## Platform

| Page | What |
|------|------|
| 🌐 [frootai.dev](https://frootai.dev) | Homepage — ecosystem overview |
| 📖 [/docs](https://frootai.dev/docs) | 16 knowledge modules with Mermaid diagrams |
| 🎯 [/solution-plays](https://frootai.dev/solution-plays) | Browse all 20 plays |
| 🤖 [/chatbot](https://frootai.dev/chatbot) | Agent FAI — ask anything about AI architecture |
| 🔧 [/configurator](https://frootai.dev/configurator) | 3-question wizard → personalized recommendation |
| 📦 [/packages](https://frootai.dev/packages) | All distribution channels |
| 🛠️ [/setup-guide](https://frootai.dev/setup-guide) | Step-by-step installation |
| 🎓 [/learning-hub](https://frootai.dev/learning-hub) | Workshops & certifications |
| 💼 [/enterprise](https://frootai.dev/enterprise) | Enterprise support tiers |
| 📊 [/api-docs](https://frootai.dev/api-docs) | REST API documentation |

---

## Why FrootAI?

| Problem | Solution |
|---------|----------|
| Infra teams don't speak AI | 🌱 Foundations layer — tokens, models, 200+ term glossary |
| RAG pipelines are poorly designed | 🪵 Reasoning layer — architecture patterns, grounding |
| Agent frameworks are confusing | 🌿 Orchestration layer — Semantic Kernel vs Agent Framework |
| AI workloads are expensive | 🍃 Operations layer — cost optimization, right-sizing |
| AI agents hallucinate in production | 🍎 Transformation layer — determinism, guardrails, evaluation |
| Teams work in silos | 🔗 FrootAI is the open glue — shared vocabulary |
| Agents burn tokens searching the web | 🔌 MCP server — curated knowledge, 90% token reduction |

---

## Contributing

FrootAI is open source under MIT. See [CONTRIBUTING.md](./CONTRIBUTING.md).

- **Add a solution play** — follow the DevKit + TuneKit structure
- **Improve existing plays** — deepen configs, add evaluation tests
- **Add MCP tools** — extend the 23-tool server
- **Improve knowledge** — fix modules, add glossary terms
- **Build a community plugin** — ServiceNow, Salesforce, SAP, or your own
- ⭐ **Star the repo** — help others discover FrootAI

---

## License

MIT — use it, extend it, embed it, ship it. See [LICENSE](./LICENSE).

"FrootAI" and the FrootAI logo are trademarks of FrootAI Contributors.

---

<p align="center">
  <strong>FrootAI v3</strong> · 16 modules · 23 MCP tools · 20 solution plays · 200+ AI terms
  <br>
  <em>It's simply Frootful.</em> 🌳
</p>
