<p align="center">
  <img src="https://frootai.dev/img/frootai-mark.png" width="120" alt="FrootAI">
</p>

<h1 align="center">FrootAI for VS Code</h1>
<p align="center"><strong>From the Roots to the Fruits</strong></p>
<p align="center"><em>20 Solution Plays  23 MCP Tools  16 Knowledge Modules  200+ AI Terms</em></p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode"><img src="https://img.shields.io/visual-studio-marketplace/v/frootai.frootai-vscode?style=flat-square&logo=visualstudiocode&label=Version" alt="Version"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode"><img src="https://img.shields.io/visual-studio-marketplace/i/frootai.frootai-vscode?style=flat-square&logo=visualstudiocode&label=Installs" alt="Installs"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode"><img src="https://img.shields.io/visual-studio-marketplace/r/frootai.frootai-vscode?style=flat-square&label=Rating" alt="Rating"></a>
  <a href="https://github.com/frootai/frootai/blob/main/LICENSE"><img src="https://img.shields.io/badge/MIT-yellow?style=flat-square&label=License" alt="License"></a>
</p>

---

## What is FrootAI?

FrootAI is an **AI architecture toolkit** that gives you everything to build production AI  directly inside VS Code. No web browser needed.

| What | How |
|------|-----|
| **Browse 20 Solution Plays** | Pre-tuned AI solutions (RAG, agents, landing zones, voice AI)  click to scaffold |
| **Explore 23 MCP Tools** | Click any tool to see documentation, input/output, and examples |
| **Search 200+ AI Terms** | Instant glossary lookup from the sidebar |
| **Scaffold in One Click** | Init DevKit (19 files), TuneKit (8 configs), SpecKit (WAF alignment) |
| **Estimate Azure Costs** | Pick a play + scale = monthly cost breakdown |
| **Run Evaluations** | Auto-runs eval.py and shows quality dashboard |

> **Works standalone**  no need to clone the FrootAI repo. Install the extension and go.

---

## Install

**Option 1  VS Code Marketplace (recommended):**

```
Ctrl+Shift+X  Search "FrootAI"  Install
```

**Option 2  Terminal:**

```bash
code --install-extension frootai.frootai-vscode
```

---

## Sidebar Panels

The extension adds a FrootAI icon to your activity bar with two panels:

### FAI Solution Plays

Browse all 20 deployable AI solutions, organized by FROOT layer:

| Icon | Layer | Plays | Examples |
|:----:|-------|:-----:|---------|
|  | **Foundations** | 2 | AI Landing Zone, Landing Zone Advanced |
|  | **Reasoning** | 3 | Enterprise RAG, Document Intelligence, AI Search Portal |
|  | **Orchestration** | 8 | Multi-Agent, Voice AI, IT Tickets, Copilot Teams, Content Moderation |
|  | **Transformation** | 4 | Fine-Tuning, Model Serving, Prompt Management, Edge AI Phi-4 |

**Click any play** to see actions:
-  **Read Documentation**  opens the play page on frootai.dev
-  **Init DevKit**  copies 19+ .github Agentic OS files to your workspace
-  **Init TuneKit**  copies AI config + evaluation files
-  **Init SpecKit**  generates architecture spec + WAF alignment
-  **Estimate Cost**  Azure cost breakdown (dev/prod)
-  **Run Evaluation**  auto-runs eval.py + shows quality dashboard
-  **User Guide**  opens frootai.dev/user-guide

**Title bar:**
-  **Browse**  opens frootai.dev/solution-plays

### FAI MCP Tools

Explore all 23 MCP tools across 5 categories:

| Icon | Category | Tools | What They Do |
|:----:|----------|:-----:|-------------|
|  | **Static** | 6 | Offline knowledge: modules, glossary, architecture patterns |
|  | **Live** | 4 | Azure docs, external MCP servers, community plays |
|  | **Agent Chain** | 3 | Build  Review  Tune workflow |
|  | **Ecosystem** | 4 | Model catalog, Azure pricing, model comparison |
|  | **Compute** | 6 | Cost estimation, embeddings, architecture diagrams |

**Click any tool**  opens rich documentation panel with:
- Color-coded badge (green/cyan/yellow/purple/pink per category)
- Full description + input/output docs
- Install commands (npm, pip, Docker)
- Links to frootai.dev + npm + PyPI

**Title bar:**
-  **Install**  setup MCP server (npm/pip/Docker/config)
-  **Docs**  opens frootai.dev/setup-guide
-  **npm**  opens npmjs.com/package/frootai-mcp

---

## What is a Solution Play?

A Solution Play is a **pre-tuned, deployable AI solution**  like a blueprint you can scaffold in one click.

Each play ships with:

```
solution-play/
 .github/                    19 Agentic OS files
    agents/                 builder  reviewer  tuner chain
    instructions/           coding standards + patterns
    prompts/                /deploy, /test, /review, /evaluate
    skills/                 deploy-azure, evaluate, tune
    hooks/                  guardrails.json (policy gates)
 config/                     AI parameters (temperature, models, guardrails)
 evaluation/                 test set + eval.py scoring script
 infra/                      Bicep IaC (main.bicep + parameters.json)
 spec/                       Architecture spec + WAF alignment
 plugin.json                 Distribution manifest
```

**20 plays available today**  more coming:

| # | Play | What It Deploys |
|:-:|------|----------------|
| 01 | Enterprise RAG Q&A | AI Search + OpenAI + Container App |
| 02 | AI Landing Zone | VNet + Private Endpoints + RBAC + GPU |
| 03 | Deterministic Agent | Reliable agent with guardrails + eval |
| 04 | Call Center Voice AI | Real-time speech + sentiment |
| 05 | IT Ticket Resolution | Auto-triage + KB resolution |
| 06 | Document Intelligence | PDF/image extraction |
| 07 | Multi-Agent Service | Orchestrated agent collaboration |
| 08 | Copilot Studio Bot | Low-code conversational AI |
| 09 | AI Search Portal | Enterprise search with facets |
| 10 | Content Moderation | Safety filters + classification |
| 11 | Landing Zone Advanced | Multi-region + DR + compliance |
| 12 | Model Serving AKS | GPU clusters + endpoints |
| 13 | Fine-Tuning Workflow | Data prep  train  eval  deploy |
| 14 | Cost-Optimized Gateway | Smart routing + token budgets |
| 15 | Multi-Modal DocProc | Images + tables + handwriting |
| 16 | Copilot Teams Extension | Teams bot with AI backend |
| 17 | AI Observability | Tracing + metrics + alerting |
| 18 | Prompt Management | Versioning + A/B testing |
| 19 | Edge AI Phi-4 | On-device inference, no cloud |
| 20 | Anomaly Detection | Time-series + pattern recognition |

---

## Commands (Ctrl+Shift+P)

| Command | What |
|---------|------|
| `FrootAI: Browse All Plays` | Quick pick from 20 plays |
| `FrootAI: Initialize DevKit` | .github Agentic OS (19+ files) |
| `FrootAI: Initialize TuneKit` | AI config + evaluation files |
| `FrootAI: Initialize SpecKit` | Architecture spec + WAF alignment |
| `FrootAI: Initialize Hooks` | guardrails.json |
| `FrootAI: Initialize Prompts` | 4 slash commands |
| `FrootAI: Setup MCP Server` | npm / pip / Docker / .vscode config |
| `FrootAI: Quick Cost Estimate` | Azure cost breakdown |
| `FrootAI: Run Evaluation` | Auto-run eval.py + dashboard |
| `FrootAI: Auto-Chain Agents` | Build  Review  Tune workflow |
| `FrootAI: Validate Config` | Check config/*.json |
| `FrootAI: Look Up AI Term` | 200+ glossary search |
| `FrootAI: Search Knowledge Base` | Full-text search 16 modules |
| `FrootAI: Architecture Patterns` | 7 decision guides |
| `FrootAI: Install Plugin` | Community plugin installer |

---

## MCP Server  For Your AI Agent

The extension works alongside the **FrootAI MCP Server** (23 tools that any AI agent can call):

| You (human) | Your Agent (AI) |
|:---:|:---:|
| **VS Code Extension** | **MCP Server** |
| Browse, search, scaffold | Query knowledge, estimate costs, compare models |
| `Ctrl+Shift+X  FrootAI` | `npx frootai-mcp` |

**Install the MCP Server** (click  Install in the sidebar, or):

```bash
npx frootai-mcp@latest          # Node.js
pip install frootai-mcp          # Python
docker run -i ghcr.io/frootai/frootai-mcp  # Docker
```

---

## 5-Minute Quick Start

1. **Install**  `Ctrl+Shift+X`  Search "FrootAI"  Install
2. **Open sidebar**  Click the FrootAI tree icon on the left
3. **Pick a play**  Click "01 Enterprise RAG Q&A"
4. **Scaffold**  Select "Init DevKit"  19 files copied to your workspace
5. **Add AI config**  Select "Init TuneKit"  config + evaluation copied
6. **Open Copilot**  Chat reads your `agent.md` + `.github/` context automatically
7. **Deploy**  Type `/deploy` in Copilot Chat  guided Azure deployment

---

## The FROOT Framework

Each knowledge module and solution play maps to a FROOT layer:

```
 F  Foundations      Tokens, models, glossary, Agentic OS
 R  Reasoning        Prompts, RAG, grounding, deterministic AI
 O  Orchestration    Semantic Kernel, agents, MCP, tools
 O  Operations       Azure AI Foundry, GPU infra, Copilot ecosystem
 T  Transformation   Fine-tuning, responsible AI, production patterns
```

**16 modules  200+ terms  60,000+ words of curated content**

---

## Related Packages

| Package | Install | What |
|---------|---------|------|
| **Node MCP Server** | `npx frootai-mcp` | [npm](https://www.npmjs.com/package/frootai-mcp) |
| **Python SDK** | `pip install frootai` | [PyPI](https://pypi.org/project/frootai/) |
| **Python MCP** | `pip install frootai-mcp` | [PyPI](https://pypi.org/project/frootai-mcp/) |
| **Docker** | `docker run -i ghcr.io/frootai/frootai-mcp` | [GHCR](https://github.com/frootai/frootai/pkgs/container/frootai-mcp) |
| **CLI** | `npx frootai <command>` | [Docs](https://frootai.dev/cli) |

---

## Links

| | |
|:--:|---|
|  | [frootai.dev](https://frootai.dev) |
|  | [frootai.dev/setup-guide](https://frootai.dev/setup-guide) |
|  | [frootai.dev/solution-plays](https://frootai.dev/solution-plays) |
|  | [frootai.dev/python](https://frootai.dev/python) |
|  | [github.com/frootai/frootai](https://github.com/frootai/frootai) |
|  | [info@frootai.dev](mailto:info@frootai.dev) |

---

<p align="center"><em>It's simply Frootful.</em> </p>
<p align="center"> 2026 FrootAI  MIT License</p>