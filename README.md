<p align="center">
  <img src=".github/frootai-mark.png" width="120" alt="FrootAI">
</p>

<h1 align="center">FrootAI</h1>
<p align="center"><strong>From the Roots to the Fruits. It's simply Frootful.</strong></p>
<p align="center"><em>An open ecosystem where Infra, Platform, and App teams build AI — Frootfully.</em></p>
<p align="center"><em>An open glue for the GenAI ecosystem, enabling deterministic and reliable AI solutions.</em></p>

<p align="center">
  <a href="https://frootai.dev"><img src="https://img.shields.io/badge/frootai.dev-10b981?style=flat-square&logo=cloudflare&logoColor=white" alt="Website"></a>
  <a href="https://github.com/frootai/frootai"><img src="https://img.shields.io/github/stars/frootai/frootai?style=flat-square&logo=github" alt="Stars"></a>
  <a href="https://www.npmjs.com/package/frootai-mcp"><img src="https://img.shields.io/npm/dw/frootai-mcp?style=flat-square&logo=npm&label=npm" alt="npm"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode"><img src="https://img.shields.io/visual-studio-marketplace/i/frootai.frootai-vscode?style=flat-square&logo=visualstudiocode&label=VS%20Code" alt="VS Code"></a>
  <a href="https://pypi.org/project/frootai/"><img src="https://img.shields.io/pypi/dm/frootai?style=flat-square&logo=python&label=PyPI" alt="PyPI"></a>
  <a href="https://www.npmjs.com/package/frootai-mcp"><img src="https://img.shields.io/npm/v/frootai-mcp?style=flat-square&logo=npm&label=MCP%20v" alt="Version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/MIT-yellow?style=flat-square&label=License" alt="License"></a>
</p>

---

### The Philosophy Behind FrootAI — The Essence of the FAI Engine

FrootAI is an intelligent way of packaging skills, knowledge, and the essential components of the GenAI ecosystem — all **synced**, not standalone. Infrastructure, platform, and application layers are woven together so that every piece understands and builds on the others. That's what *"from the roots to the fruits"* means: a fully connected ecosystem where Infra, Platform, and App teams build AI — *Frootfully*.

<details>
<summary><strong>The FROOT Framework</strong></summary>
<br>

**FROOT** = **F**oundations · **R**easoning · **O**rchestration · **O**perations · **T**ransformation

| Layer | What You Learn |
|:-----:|---------------|
| **F** | Tokens, models, glossary, Agentic OS |
| **R** | Prompts, RAG, grounding, deterministic AI |
| **O** | Semantic Kernel, agents, MCP, tools |
| **O** | Azure AI Foundry, GPU infra, Copilot ecosystem |
| **T** | Fine-tuning, responsible AI, production patterns |

</details>

| What | For Whom | Link |
|------|----------|------|
| **Solution Plays** | Infra & platform engineers | [Browse Plays](https://frootai.dev/solution-plays) |
| **MCP Server** | AI agents (Copilot, Claude, Cursor) | [MCP Tooling](https://frootai.dev/mcp-tooling) |
| **Knowledge Modules** | Cloud architects, CSAs | [Docs](https://frootai.dev/docs) |
| **VS Code Extension** | Developers | [VS Code Extension](https://frootai.dev/vscode-extension) |
| **Python SDK** | Data scientists | [Python SDK](https://frootai.dev/python) |
| **CLI** | Everyone | [CLI Docs](https://frootai.dev/cli) |

---

### Get Started

```bash
npx frootai-mcp@latest                          # MCP Server  add to any AI agent
code --install-extension frootai.frootai-vscode     # VS Code Extension
pip install frootai                              # Python SDK
docker run -i ghcr.io/frootai/frootai-mcp        # Docker  zero install
npx frootai init                                 # CLI  scaffold a project
```

<details>
<summary><strong>MCP Config (Claude Desktop / VS Code / Cursor)</strong></summary>

```json
{
  "mcpServers": {
    "frootai": { "command": "npx", "args": ["frootai-mcp@latest"] }
  }
}
```

Works with: **GitHub Copilot**  **Claude Desktop**  **Cursor**  **Windsurf**  **Azure AI Foundry**  any MCP client

</details>

---

### The FAI Ecosystem

<p align="center">
  <img src=".github/fai-eco-big.png" width="700" alt="FAI Ecosystem — Factory builds, Packages deliver, Toolkit equips">
</p>

---

### MCP Server  23 Tools

| Category | # | Tools |
|----------|:-:|-------|
| **Static** | 6 | `list_modules`  `get_module`  `lookup_term`  `search_knowledge`  `get_architecture_pattern`  `get_froot_overview` |
| **Live** | 4 | `fetch_azure_docs`  `fetch_external_mcp`  `list_community_plays`  `get_github_agentic_os` |
| **Agent Chain** | 3 | `agent_build`  `agent_review`  `agent_tune` |
| **AI Ecosystem** | 4 | `get_model_catalog`  `get_azure_pricing`  `compare_models`  `compare_plays` |
| **Compute** | 6 | `estimate_cost`  `embedding_playground`  `generate_architecture_diagram`  `run_evaluation` + 2 more |

---

### Solution Plays

<details>
<summary><strong>20 pre-tuned, deployable AI solutions</strong>  click to expand</summary>
<br>

| # | Solution | What It Deploys |
|:-:|---------|----------------|
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
| 11 | **AI Landing Zone Adv.** | Multi-region + DR + compliance |
| 12 | **Model Serving on AKS** | GPU clusters + model endpoints |
| 13 | **Fine-Tuning Workflow** | Data prep  train  eval  deploy |
| 14 | **Cost-Optimized Gateway** | Smart routing + token budgets |
| 15 | **Multi-Modal Doc Proc** | Images + tables + handwriting |
| 16 | **Copilot Teams Ext.** | Teams bot with AI backend |
| 17 | **AI Observability** | Tracing + metrics + alerting |
| 18 | **Prompt Management** | Versioning + A/B testing + rollback |
| 19 | **Edge AI with Phi-4** | On-device inference, no cloud |
| 20 | **Anomaly Detection** | Time-series + pattern recognition |

Every play ships with: `.github` Agentic OS (19 files)  DevKit  TuneKit  SpecKit  Bicep infra

</details>

---

<details>
<summary><strong>Distribution Channels</strong></summary>
<br>

| Channel | Install | Version | Links |
|---------|---------|:-------:|-------|
| **npm** | `npm install frootai-mcp` | 3.2.0 | [Website](https://frootai.dev/mcp-tooling)  [npmjs.com](https://www.npmjs.com/package/frootai-mcp) |
| **PyPI SDK** | `pip install frootai` | 3.3.0 | [PyPI](https://pypi.org/project/frootai/) |
| **PyPI MCP** | `pip install frootai-mcp` | 3.2.0 | [PyPI](https://pypi.org/project/frootai-mcp/) |
| **Docker** | `docker run -i ghcr.io/frootai/frootai-mcp` | latest | [Website](https://frootai.dev/docker)  [GHCR](https://github.com/frootai/frootai/pkgs/container/frootai-mcp) |
| **VS Code** | `code --install-extension frootai.frootai-vscode` | 1.4.0 | [Website](https://frootai.dev/vscode-extension)  [Marketplace](https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode) |
| **CLI** | `npx frootai <command>` | 3.2.0 | [Website](https://frootai.dev/cli) |
| **REST API** |  | live | [API Docs](https://frootai.dev/api-docs) |
| **GitHub** |  | latest | [github.com/frootai/frootai](https://github.com/frootai/frootai) |

</details>

---

<details>
<summary><strong>Repository Structure</strong></summary>
<br>

```
frootai/frootai
 mcp-server/            MCP tools + knowledge.json
 vscode-extension/      VS Code extension
 python-sdk/            Python SDK — offline, zero deps
 python-mcp/            Python MCP Server
 functions/             REST API + Agent FAI chatbot
 solution-plays/        Deployable plays with .github Agentic OS
 docs/                  FROOT knowledge modules
 config/                Configurator data + spec templates
 scripts/               Build, sync, validate automation
 workshops/             Hands-on workshops
 community-plugins/     ServiceNow, Salesforce, SAP
 bicep-registry/        Azure Bicep modules
 CONTRIBUTING.md
 LICENSE (MIT)
```

</details>

---

### Links

| Resource | Link |
|---|---|
| **Website** | [frootai.dev](https://frootai.dev) |
| **Docs** | [Knowledge Modules](https://frootai.dev/docs) |
| **Solution Plays** | [Browse All Plays](https://frootai.dev/solution-plays) |
| **Agent FAI** | [Chatbot](https://frootai.dev/chatbot) |
| **Configurator** | [Play Recommendation Wizard](https://frootai.dev/configurator) |
| **Packages** | [Distribution Channels](https://frootai.dev/packages) |
| **Setup Guide** | [Installation Guide](https://frootai.dev/setup-guide) |
| **Learning Hub** | [Workshops & Certs](https://frootai.dev/learning-hub) |
| **CLI** | [CLI Reference](https://frootai.dev/cli) |
| **REST API** | [API Docs](https://frootai.dev/api-docs) |
| **Contact** | [info@frootai.dev](mailto:info@frootai.dev) |

---

### Contributing

Open source under MIT. See [CONTRIBUTING.md](./CONTRIBUTING.md).

 **Star the repo** to help others discover FrootAI.

---

<p align="center">
  <a href="https://frootai.dev">Website</a> · 
  <a href="https://frootai.dev/chatbot">Agent FAI</a> · 
  <a href="https://frootai.dev/docs">Docs</a> · 
  <a href="https://frootai.dev/solution-plays">Solution Plays</a>
</p>
<p align="center"><em>It's simply Frootful.</em></p>
<p align="center">© 2026 FrootAI — MIT License</p>