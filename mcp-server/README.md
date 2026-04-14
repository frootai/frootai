<p align="center">
  <img src="https://frootai.dev/img/frootai-mark.png" width="100" alt="FrootAI">
</p>

<h1 align="center">FrootAI</h1>
<p align="center"><sub>MCP Server (npm)</sub></p>
<p align="center"><strong>From the Roots to the Fruits. It's simply Frootful.</strong></p>
<p align="center"><em>An open ecosystem where Infra, Platform, and App teams build AI — Frootfully.</em></p>
<p align="center"><em>An open glue for the GenAI ecosystem, enabling deterministic and reliable AI solutions.</em></p>

<p align="center">
  <a href="https://www.npmjs.com/package/frootai-mcp"><img src="https://img.shields.io/npm/v/frootai-mcp?style=flat-square&logo=npm" alt="npm"></a>
  <a href="https://www.npmjs.com/package/frootai-mcp"><img src="https://img.shields.io/npm/dw/frootai-mcp?style=flat-square&label=downloads" alt="downloads"></a>
  <a href="https://github.com/frootai/frootai/blob/main/LICENSE"><img src="https://img.shields.io/badge/MIT-yellow?style=flat-square&label=license" alt="license"></a>
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

### The FAI Ecosystem

<p align="center">
  <img src="https://raw.githubusercontent.com/frootai/frootai/main/.github/fai-eco-big.png" width="700" alt="FAI Ecosystem — Factory builds, Packages deliver, Toolkit equips">
</p>

---

### Quick Start

```bash
npx frootai-mcp@latest
```

**Other install methods:**

```bash
npm i -g frootai-mcp                        # Install globally
docker run -i ghcr.io/frootai/frootai-mcp   # Docker (no Node.js needed)
pip install frootai-mcp                      # Python
```

---

### Connect to Your Agent

**VS Code / GitHub Copilot**  `.vscode/mcp.json`:

```json
{
  "servers": {
    "frootai": {
      "type": "stdio",
      "command": "npx",
      "args": ["frootai-mcp@latest"]
    }
  }
}
```

<details>
<summary><b>Claude Desktop / Cursor</b></summary>

```json
{
  "mcpServers": {
    "frootai": {
      "command": "npx",
      "args": ["frootai-mcp@latest"]
    }
  }
}
```

</details>

<details>
<summary><b>Docker</b>  <code>.vscode/mcp.json</code></summary>

```json
{
  "servers": {
    "frootai": {
      "type": "stdio",
      "command": "docker",
      "args": ["run", "-i", "ghcr.io/frootai/frootai-mcp"]
    }
  }
}
```

</details>

---

### MCP Tools (45 total)

**Static** — bundled knowledge, works offline
- `list_modules`  browse 18 FROOT knowledge modules by layer
- `get_module`  read any module in full (F1–T3)
- `lookup_term`  200+ AI/ML glossary definitions
- `search_knowledge`  full-text search across all modules
- `get_architecture_pattern`  7 pre-built architecture decision guides
- `get_froot_overview`  complete FROOT framework summary

**Live** — network-enabled, graceful offline fallback
- `fetch_azure_docs`  search Microsoft Learn for Azure docs
- `fetch_external_mcp`  discover MCP servers from public registries
- `list_community_plays`  browse 101 solution plays from GitHub
- `get_github_agentic_os`  .github Agentic OS 7-primitive guide

**Agent Chain** — build → review → tune
- `agent_build`  architecture guidance + code patterns, suggests review
- `agent_review`  security, quality, compliance audit, suggests tune
- `agent_tune`  production readiness validation + verdict

**Ecosystem** — Azure AI intelligence
- `get_model_catalog`  Azure AI model catalog with pricing tiers
- `get_azure_pricing`  monthly cost estimates by scenario + scale
- `estimate_cost`  itemized Azure cost estimate per play + scale
- `compare_models`  side-by-side model comparison for your use case
- `compare_plays`  compare two solution plays (services, cost, complexity)
- `semantic_search_plays`  natural language search across 100 plays
- `embedding_playground`  cosine similarity — educational RAG tool
- `run_evaluation`  quality scoring (groundedness, relevance, coherence, fluency)
- `validate_config`  validate TuneKit configs against best practices
- `generate_architecture_diagram`  Mermaid.js diagram for any play

**FAI Engine** — the open glue (FAI Protocol runtime)
- `wire_play`  resolve FAI Protocol context, bind primitives, activate guardrails
- `inspect_wiring`  audit a play's wiring — primitives, context, health score
- `validate_manifest`  validate `fai-manifest.json` schema + completeness
- `get_play_detail`  full play spec — services, config, WAF alignment, evaluation
- `list_primitives`  browse 830+ primitives by type (agents, skills, hooks…)
- `evaluate_quality`  run quality evaluation with configurable pass/fail thresholds

**Scaffold & Create** — generate production-ready plays and primitives
- `scaffold_play`  generate a complete play (24+ files) with FAI Protocol auto-wired
- `create_primitive`  create an agent, instruction, or skill with proper frontmatter
- `smart_scaffold`  semantic search → find best matching play → scaffold it

**Marketplace** — plugin ecosystem (npm for AI primitives)
- `marketplace_search`  semantic search across 77+ plugins by use case
- `marketplace_browse`  paginated listing with 8 category filters
- `install_plugin`  copy plugin primitives into `.github/` with conflict detection
- `uninstall_plugin`  remove plugin primitives cleanly
- `list_installed`  scan `.github/` and match against marketplace registry
- `check_compatibility`  validate plugin + play alignment + WAF + file conflicts
- `validate_plugin`  check `plugin.json` schema, naming, and file refs
- `compose_plugins`  multi-install with cross-plugin conflict detection
- `publish_plugin`  validate → generate marketplace entry → register
- `check_plugin_updates`  compare installed vs marketplace versions
- `resolve_dependencies`  topological dependency resolution + install order
- `list_external_plugins`  browse community plugins from external sources
- `marketplace_stats`  full analytics: totals, categories, top plugins, play coverage

---

### CLI  `npx frootai`

```bash
npx frootai init                              # Interactive project scaffolding
npx frootai search "RAG architecture"         # Search knowledge base
npx frootai cost enterprise-rag --scale prod  # Azure cost estimate
npx frootai validate                          # Check project structure
npx frootai validate --waf                    # WAF alignment scorecard (6 pillars)
npx frootai doctor                            # Health check
npx frootai help                              # All commands
```

**`frootai init`** scaffolds a complete project:

```
my-ai-project/
 .vscode/mcp.json           MCP auto-connects
 .github/
    copilot-instructions.md
    agents/                Builder, Reviewer, Tuner
    instructions/          Coding standards, patterns
    prompts/               /deploy, /test, /review, /evaluate
 config/                    OpenAI, Search, Guardrails
 evaluation/                Eval thresholds + eval.py
 spec/                      Architecture spec + WAF alignment
 README.md
```

**`frootai validate --waf`**  checks your project against the Well-Architected Framework:

-  Reliability  retry policies, health probes
-  Security  managed identity, private endpoints
-  Cost Optimization  right-sized SKUs, token budgets
-  Operational Excellence  CI/CD, diagnostics
-  Performance Efficiency  caching, streaming
-  Responsible AI  content safety, guardrails

---

### HTTP Transport (Remote MCP)

Run as a remote HTTP server alongside stdio — no config change needed:

```bash
# Stdio (default — local agents, VS Code, Claude Desktop)
npx frootai-mcp

# HTTP server — remote clients, Container Apps, k8s
npx frootai-mcp http
PORT=8080 npx frootai-mcp http

# With API key auth
FAI_AUTH_MODE=apikey FAI_API_KEYS=my-secret-key npx frootai-mcp http

# Docker
docker run -p 3000:3000 ghcr.io/frootai/frootai-mcp http
```

Connect a remote client:

```json
{ "servers": { "frootai": { "type": "http", "url": "https://your-host:3000/mcp" } } }
```

Health probes (Kubernetes / Container Apps):
- `GET /healthz` — liveness (status, version, uptime, engine)
- `GET /readyz` — readiness (modules loaded, sessions, cache stats)

---

### Agent FAI REST API

Chat with Agent FAI  grounded in FrootAI knowledge: [frootai.dev/chatbot](https://frootai.dev/chatbot)

`POST /api/chat`  `POST /api/chat/stream`  `POST /api/search-plays`  `POST /api/estimate-cost`  `GET /api/health`

[Agent FAI REST API Docs ](https://frootai.dev/api-docs)

---

### What Ships Inside

- **FROOT Knowledge Modules** — 16 modules across Foundations, Reasoning, Orchestration, Operations, Transformation
- **AI Glossary** — 200+ AI/ML term definitions
- **100 Solution Plays** — pre-tuned deployable solutions with .github Agentic OS
- **830+ Primitives** — agents, instructions, skills, hooks, plugins, workflows
- **FAI Engine** — FAI Protocol runtime: wire, inspect, validate, evaluate
- **FAI Marketplace** — 77+ plugins searchable and installable via MCP
- **Architecture Decision Guides** — RAG, agents, hosting, model selection, cost optimization, determinism
- **OpenTelemetry** — opt-in observability (OTEL_EXPORTER_OTLP_ENDPOINT)

> The FrootAI ecosystem is growing. New modules, plays, and tools are added with every release.

---

### Links

| Resource | Link |
|---|---|
| **Website** | [frootai.dev](https://frootai.dev) |
| **Setup Guide** | [FAI Packages Setup](https://frootai.dev/setup-guide) |
| **CLI Docs** | [CLI Reference](https://frootai.dev/cli) |
| **REST API** | [Agent FAI REST API](https://frootai.dev/api-docs) |
| **VS Code Extension** | [Marketplace](https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode) |
| **Docker Image** | [GitHub Container Registry](https://github.com/frootai/frootai/pkgs/container/frootai-mcp) |
| **Python SDK** | [PyPI — frootai](https://pypi.org/project/frootai/) |
| **Python MCP Server** | [PyPI — frootai-mcp](https://pypi.org/project/frootai-mcp/) |
| **GitHub** | [frootai/frootai](https://github.com/frootai/frootai) |
| **Contact** | [info@frootai.dev](mailto:info@frootai.dev) |

---

<p align="center"> 2026 FrootAI  MIT License</p>
<p align="center"><sub>AI architecture  MCP  model-context-protocol  Azure  RAG  agents  copilot  semantic-kernel  infrastructure-as-code  solution-plays  devkit  tunekit  agentic-os  well-architected  open-source  frootai</sub></p>