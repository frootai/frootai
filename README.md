<p align="center">
  <img src=".github/frootai-mark.png" width="120" alt="FrootAI">
</p>

<h1 align="center">FrootAI</h1>
<p align="center"><strong>From the Roots to the Fruits. It's connected. It's simply Frootful.</strong></p>
<p align="center"><em>A uniFAIng glue for the GenAI ecosystem, enabling deterministic and reliable AI solutions.</em></p>
<p align="center"><em>An open ecosystem where Infra, Platform, and App teams build AI — Frootfully.</em></p>

<p align="center">
  <a href="https://frootai.dev"><img src="https://img.shields.io/badge/frootai.dev-10b981?style=flat-square&logo=cloudflare&logoColor=white" alt="Website"></a>
  <a href="https://github.com/frootai/frootai"><img src="https://img.shields.io/github/stars/frootai/frootai?style=flat-square&logo=github" alt="Stars"></a>
  <a href="https://www.npmjs.com/package/frootai-mcp"><img src="https://img.shields.io/npm/dw/frootai-mcp?style=flat-square&logo=npm&label=npm" alt="npm"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode"><img src="https://img.shields.io/visual-studio-marketplace/i/frootai.frootai-vscode?style=flat-square&logo=visualstudiocode&label=VS%20Code" alt="VS Code"></a>
  <a href="https://pypi.org/project/frootai/"><img src="https://img.shields.io/pypi/dm/frootai?style=flat-square&logo=python&label=PyPI" alt="PyPI"></a>
  <a href="https://www.npmjs.com/package/frootai-mcp"><img src="https://img.shields.io/npm/v/frootai-mcp?style=flat-square&logo=npm&label=MCP%20v" alt="Version"></a>
  <a href="./conformance/"><img src="./conformance/badge.svg" alt="FAI Protocol L0 conformance"></a>
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
| **npm SDK** | Node.js / TypeScript developers | [npm](https://www.npmjs.com/package/frootai) |
| **Python SDK** | Data scientists | [Python SDK](https://frootai.dev/python) |
| **Knowledge Modules** | Cloud architects, CSAs | [Docs](https://frootai.dev/docs) |
| **VS Code Extension** | Developers | [VS Code Extension](https://frootai.dev/vscode-extension) |
| **CLI** | Everyone | [CLI Docs](https://frootai.dev/cli) |

---

### Get Started

```bash
npx frootai-mcp@latest                          # MCP Server — add to any AI agent
npx frootai init                                 # CLI — scaffold a project
npx skills add frootai/frootai                   # Skills — install FrootAI skills into any agent
npm install frootai                              # npm SDK — import in Node.js/TS
pip install frootai                              # Python SDK
code --install-extension frootai.frootai-vscode  # VS Code Extension
docker run -i ghcr.io/frootai/frootai-mcp        # Docker — zero install
```

<details>
<summary><strong>Install skills into any agent (skills.sh)</strong></summary>

FrootAI's skills follow the [Agent Skills](https://agentskills.io) open standard and are installable
into 70+ agents (GitHub Copilot, Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Goose, and more)
via the universal [`skills`](https://skills.sh) installer:

```bash
# Interactive picker — choose the skills you need (avoid context rot; install only what's relevant)
npx skills add frootai/frootai

# Install a specific skill into a specific agent, non-interactively
npx skills add frootai/frootai --skill fai-azure-cosmos-modeling --agent github-copilot --yes

# Generate a one-off prompt for a skill without installing it
npx skills use frootai/frootai@fai-mcp-python-generator
```

Skills are also browsable as themed bundles in Claude Code via
`/plugin marketplace add frootai/frootai`, and render as chips with one-click demo prompts in
VS Code / Codex / Cursor.

</details>

<details>
<summary><strong>MCP Config (Claude Desktop / VS Code / Cursor)</strong></summary>

```json
{
  "mcpServers": {
    "frootai": { "command": "npx", "args": ["frootai-mcp@latest"] }
  }
}
```

Works with: **GitHub Copilot** · **Claude Desktop** · **Cursor** · **Windsurf** · **Azure AI Foundry** · any MCP client

</details>

---

### npm SDK — Full Programmatic API

```bash
npm install frootai
```

```javascript
import { FrootAI, PromptExperiment, PromptVariant, CopilotSession, AgenticLoop, Task } from 'frootai';

const fai = new FrootAI();

// Search, plays, modules
fai.search('RAG architecture');          // BM25-ranked results
fai.plays.get('01');                     // Play details
fai.listModules();                       // 17 FROOT modules (incl. V1 Voice & Speech AI)

// Evaluation quality gates
fai.evaluation.run({ groundedness: 0.95, relevance: 0.88 });

// A/B test prompts
const exp = new PromptExperiment({
  name: 'rag-v2',
  variants: [
    new PromptVariant('control', 'You are a helpful assistant.'),
    new PromptVariant('expert', 'You are an Azure AI expert. Cite sources.'),
  ],
});

// Agentic loop — builder → reviewer → tuner
const loop = new AgenticLoop({ planFile: 'spec/plan.json' });
loop.addTask(new Task('Create RAG pipeline', 'builder'))
    .addTask(new Task('Review security', 'reviewer'));
await loop.run();
```

---

### The FAI Ecosystem

<p align="center">
  <img src=".github/fai-eco-big.png" width="700" alt="FAI Ecosystem — Factory builds, Packages deliver, Toolkit equips">
</p>

---

### FAI Protocol — The Binding Glue

FrootAI introduces the **FAI Protocol** — a context-wiring specification that connects 9 AI primitives (agents, instructions, skills, hooks, workflows, plugins, tools, prompts, guardrails) into evaluated, deployed, production-ready systems.

| Component | What It Is | File |
|-----------|-----------|------|
| **FAI Protocol** | The spec — how primitives declare context and wiring | `fai-manifest.json` |
| **FAI Layer** | The conceptual glue — shared context across primitives | Design principle |
| **FAI Engine** | The runtime — reads manifests, wires primitives, evaluates quality | `engine/index.js` |
| **FAI Factory** | CI/CD — validates, builds, and packs primitives | `scripts/validate-primitives.js` |
| **FAI Marketplace** | Discovery registry for plugins | `marketplace.json` |

**Primitives:**

| Folder | What Lives Here | Schema |
|--------|----------------|--------|
| `schemas/` | 7 JSON schemas validating all primitive types | Draft-07 |
| `agents/` | Standalone `.agent.md` files with WAF alignment | `agent.schema.json` |
| `instructions/` | `.instructions.md` files with `applyTo` globs | `instruction.schema.json` |
| `skills/` | `SKILL.md` folders with optional bundled assets | `skill.schema.json` |
| `hooks/` | Security hooks (secrets scanner, tool guardian, governance audit) | `hook.schema.json` |
| `plugins/` | Themed bundles of agents + skills + hooks | `plugin.schema.json` |
| `engine/` | FAI Engine v0.1 — manifest reader, context resolver, evaluator | — |

```bash
npm run validate:primitives     # Validate all primitives against schemas
npm run generate:marketplace    # Generate marketplace.json from plugins/
npm run scaffold                # Interactive CLI to create new primitives
node engine/index.js <manifest> # Load a play with the FAI Engine
```

---

### MCP Server — 51 Tools

| Category | # | Tools |
|----------|:-:|-------|
| **Knowledge** | 6 | `list_modules`  `get_module`  `lookup_term`  `search_knowledge`  `get_architecture_pattern`  `get_froot_overview` |
| **Live** | 4 | `fetch_azure_docs`  `fetch_external_mcp`  `list_community_plays`  `get_github_agentic_os` |
| **Agent Chain** | 3 | `agent_build`  `agent_review`  `agent_tune` _(code-aware in v6.3+)_ |
| **Ecosystem** | 10 | model catalog, Azure pricing, model/play comparisons, embedding playground (azure-openai · char-ngram · jaccard), config validation, architecture diagrams |
| **FAI Engine** | 7 | wire/inspect/validate plays, evaluate quality, plus `run_eval_live` _(v6.6+)_ |
| **Scaffold** | 7 | `scaffold_play`  `create_primitive`  `smart_scaffold` + `scaffold_component` _(v6.4+)_ + `get_play_config` _(v6.4+)_ + `get_dependencies` _(v6.4+)_ + `generate_bicep` _(v6.5+)_ |
| **Workspace** | 1 | `analyze_workspace` _(v6.2+)_ |
| **Marketplace** | 13 | search, install, uninstall, compose, publish, dependency resolution, stats |

---

### Solution Plays

<details>
<summary><strong>100 pre-tuned, deployable AI solutions</strong> — click to expand</summary>
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
| 21 | **Agentic RAG** | Autonomous retrieval + multi-source |
| 22 | **Multi-Agent Swarm** | Distributed teams + supervisor |
| 23 | **Browser Automation** | Playwright MCP + vision |
| 24 | **AI Code Review** | CodeQL + OWASP + AI comments |
| 25 | **Conversation Memory** | Short/long/episodic memory |
| 26 | **Semantic Search** | Vector + hybrid + reranking |
| 27 | **AI Data Pipeline** | ETL + LLM augmentation |
| 28 | **Knowledge Graph RAG** | Cosmos DB Gremlin + entities |
| 29 | **MCP Gateway** | Proxy + rate limiting + discovery |
| 30 | **AI Security Hardening** | OWASP LLM Top 10 + jailbreak defense |
| 31 | **Low-Code AI Builder** | Visual AI pipeline design + deploy |
| 32 | **AI-Powered Testing** | Autonomous test generation, polyglot |
| 33 | **Voice AI Agent** | Speech-to-text + conversational AI |
| 34 | **Edge AI Deployment** | ONNX quantization + IoT Hub |
| 35 | **AI Compliance Engine** | GDPR, HIPAA, SOC 2, EU AI Act |
| 36 | **Multimodal Agent** | GPT-4o Vision + text + code |
| 37 | **AI-Powered DevOps** | Incident triage + runbook + GitOps |
| 38 | **Document Understanding v2** | Multi-page PDF + entity linking |
| 39 | **AI Meeting Assistant** | Transcription + action items |
| 40 | **Copilot Studio Advanced** | Declarative agents + M365 Graph |
| 41 | **AI Red Teaming** | Adversarial testing + safety scoring |
| 42 | **Computer Use Agent** | Vision-based desktop automation |
| 43 | **AI Video Generation** | Text-to-video pipeline |
| 44 | **Foundry Local On-Device** | Air-gapped LLM inference |
| 45 | **Real-Time Event AI** | Streaming event processing |
| 46 | **Healthcare Clinical AI** | HIPAA-compliant decision support |
| 47 | **Synthetic Data Factory** | Privacy-safe dataset generation |
| 48 | **AI Model Governance** | Model registry + compliance |
| 49 | **Creative AI Studio** | Multi-modal content creation |
| 50 | **Financial Risk Intelligence** | Risk assessment + fraud detection |

Every play ships with: `fai-manifest.json` + `.github` Agentic OS (agents, instructions, prompts, skills) + DevKit + TuneKit + SpecKit + Bicep infra + evaluation test set

</details>

---

<details>
<summary><strong>Distribution Channels</strong></summary>
<br>

| Channel | Install | Version | Links |
|---------|---------|:-------:|-------|
| **npm MCP** | `npm install frootai-mcp` | 6.0.0 | [Website](https://frootai.dev/mcp-tooling) · [npmjs.com](https://www.npmjs.com/package/frootai-mcp) |
| **npm SDK** | `npm install frootai` | 6.0.0 | [npmjs.com](https://www.npmjs.com/package/frootai) |
| **PyPI SDK** | `pip install frootai` | 6.0.0 | [PyPI](https://pypi.org/project/frootai/) |
| **PyPI MCP** | `pip install frootai-mcp` | 6.0.0 | [PyPI](https://pypi.org/project/frootai-mcp/) |
| **Docker** | `docker run -i ghcr.io/frootai/frootai-mcp` | latest | [Website](https://frootai.dev/docker) · [GHCR](https://github.com/frootai/frootai/pkgs/container/frootai-mcp) |
| **VS Code** | `code --install-extension frootai.frootai-vscode` | 6.0.0 | [Website](https://frootai.dev/vscode-extension) · [Marketplace](https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode) |
| **CLI** | `npx frootai <command>` | 6.0.0 | [Website](https://frootai.dev/cli) |
| **GitHub** | — | latest | [github.com/frootai/frootai](https://github.com/frootai/frootai) |

</details>

---

<details>
<summary><strong>Repository Structure</strong></summary>
<br>

```
frootai/frootai
├── agents/               238 standalone .agent.md files (WAF-aligned)
├── instructions/         176 standalone .instructions.md files
├── skills/               322 skill folders with SKILL.md
├── hooks/                10 security hooks (secrets, tools, governance, PII, cost...)
├── plugins/              77 themed bundles (1,008 items, 416 categories)
├── workflows/            13 agentic workflows (safe-outputs, NL → YAML)
├── cookbook/              16 step-by-step recipes
├── schemas/              7 JSON schemas validating all primitive types
├── engine/               FAI Engine v0.1 (7 modules — manifest reader → evaluator)
├── solution-plays/       100 deployable plays with DevKit+TuneKit+SpecKit+Bicep
├── npm-mcp/              MCP Server — 51 tools + knowledge.json
├── npm-sdk/              npm SDK & CLI — FrootAI class, 8 commands, 7 modules
├── python-sdk/           Python SDK — offline, zero deps, 7 modules
├── python-mcp/           Python MCP Server
├── vscode-extension/     VS Code extension (4 commands, play browser)
├── functions/            REST API + Agent FAI chatbot
├── docs/                 FROOT knowledge modules (17 modules, ~720 KB)
├── config/               Configurator data + spec templates
├── scripts/              21 build/validate/generate scripts
├── marketplace.json      Auto-generated plugin registry
├── website-data/         8 JSON feeds for frootai.dev
├── workshops/            Hands-on workshops
├── community-plugins/    ServiceNow, Salesforce, SAP
├── bicep-registry/       Azure Bicep modules
├── .github/workflows/    15 CI/CD pipelines
├── .vscode/              15 tasks + schema validation + MCP
├── CONTRIBUTING.md
└── LICENSE (MIT)
```

</details>

---

### GitHub Action

Use `frootai/frootai@v6` in any workflow. The v6 action adds **MCP federation** — pre-attach Tier-1 areas (Azure, Playwright, MS Learn) so evaluations and validations run with full federated context.

#### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `command` | ✅ | `validate` | CLI command: validate, cost, search, doctor, evaluate, primitives, factory |
| `play` | | | Solution play ID (e.g. `29-mcp-gateway`) |
| `scale` | | `dev` | Scale tier for cost estimation |
| `waf` | | `false` | Run WAF alignment check |
| `format` | | `json` | Output format: json, markdown, table |
| `threshold` | | `0.8` | Minimum evaluation score (0.0–1.0) |
| `version` | | `5.2.0` | frootai-mcp version (`6.0.0-alpha.2` for federation) |
| `mcp-attach` | | | Comma-separated MCP areas to pre-attach (e.g. `azure,playwright`) |
| `mcp-trust-file` | | | Path to trust-override JSON (relative to repo root) |
| `mcp-federation` | | `on` | Federation kill-switch: `on` or `off` |

#### Outputs

| Output | Description |
|--------|-------------|
| `result` | JSON output from the command |
| `status` | Exit status (`pass` / `fail`) for CI gating |
| `cost-estimate` | Monthly cost in USD (cost command only) |
| `eval-score` | Evaluation score (evaluate command only) |
| `mcp-attached` | JSON array of attached area names (e.g. `["azure","playwright"]`) |
| `mcp-tools-count` | Total MCP tools registered across attached areas |

#### Basic usage (v5 compatible)

```yaml
- uses: frootai/frootai@v6
  with:
    command: validate
```

#### Federation usage

```yaml
- uses: frootai/frootai@v6
  with:
    command: evaluate
    play: 29-mcp-gateway
    mcp-attach: azure
    version: '6.0.0-alpha.2'
```

#### Auto-attach from Play manifest

When a play declares `spec/mcp-scope.json` with an `attached` array, the action auto-populates `mcp-attach` — no workflow change needed:

```yaml
- uses: frootai/frootai@v6
  with:
    command: evaluate
    play: 29-mcp-gateway       # auto-attaches "azure" from play manifest
    version: '6.0.0-alpha.2'
```

#### Sample workflows

- [`.github/workflows/example-federation.yml`](.github/workflows/example-federation.yml) — single-area federation with Azure
- [`.github/workflows/example-multi-mcp.yml`](.github/workflows/example-multi-mcp.yml) — multi-area federation with Azure + Playwright

#### Secrets handling

The action automatically masks all `FROOTAI_*` env values in logs via `::add-mask::`. For area-specific credentials, use the `FROOTAI_SECRET_*` naming convention — any env var matching that prefix is masked before the kernel starts:

```yaml
env:
  FROOTAI_SECRET_AZURE_KEY: ${{ secrets.AZURE_KEY }}
```

Values injected via `${{ secrets.* }}` are also masked by GitHub Actions itself. The double-masking ensures federation debug logs (`ACTIONS_STEP_DEBUG=true`) never leak credentials.

---

### Links

| Resource | Link |
|---|---|
| **Website** | [frootai.dev](https://frootai.dev) |
| **Documentation** | [docs.frootai.dev](https://docs.frootai.dev) |
| **Platform App** | [app.frootai.dev](https://app.frootai.dev) |
| **REST API** | [api.frootai.dev](https://api.frootai.dev) |
| **Status** | [status.frootai.dev](https://status.frootai.dev) |
| **Solution Plays** | [Browse All Plays](https://frootai.dev/solution-plays) |
| **Agent FAI** | [Chatbot](https://frootai.dev/chatbot) |
| **Configurator** | [Play Recommendation Wizard](https://frootai.dev/configurator) |
| **Packages** | [Distribution Channels](https://frootai.dev/packages) |
| **Setup Guide** | [Installation Guide](https://frootai.dev/setup-guide) |
| **Learning Hub** | [Interactive Learning](https://frootai.dev/learning-hub) |
| **CLI** | [CLI Reference](https://frootai.dev/cli) |
| **Contact** | [info@frootai.dev](mailto:info@frootai.dev) |

---

### Contributing

Open source under MIT. See [CONTRIBUTING.md](./CONTRIBUTING.md).

 **Star the repo** to help others discover FrootAI.

---

<p align="center">
  <a href="https://frootai.dev">Website</a> · 
  <a href="https://docs.frootai.dev">Docs</a> · 
  <a href="https://app.frootai.dev">App</a> · 
  <a href="https://api.frootai.dev">API</a> · 
  <a href="https://frootai.dev/solution-plays">Solution Plays</a> · 
  <a href="https://frootai.dev/chatbot">Agent FAI</a>
</p>
<p align="center"><em>It's simply Frootful.</em></p>
<p align="center">© 2026 FrootAI — MIT License</p>