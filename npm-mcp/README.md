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

### What Makes This Different

Other MCP servers are API wrappers (GitHub MCP wraps the GitHub API, Playwright MCP wraps a browser). **FrootAI MCP is a domain knowledge engine with a protocol that binds AI primitives together.**

| Feature | GitHub MCP | Anthropic MCP | Google MCP | **FrootAI MCP** |
|---------|-----------|---------------|-----------|-----------------|
| What it does | GitHub API wrapper | File/code access | Google API wrapper | **AI architecture engine** |
| Has a runtime engine? | No | No | No | **Yes — FAI Engine** |
| Wires AI primitives? | No | No | No | **Yes — fai-manifest.json** |
| Quality gates? | No | No | No | **Yes — guardrails per play** |
| Scaffolds projects? | No | No | No | **Yes — 24 files, fully wired** |
| Knowledge base? | No | No | No | **16 modules, BM25 search** |
| Plugin marketplace? | No | No | No | **77+ plugins, install/compose** |

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
      "args": ["-y", "frootai-mcp@latest"]
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
      "args": ["-y", "frootai-mcp@latest"]
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
- `list_community_plays`  browse 104 solution plays from GitHub
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

### Real-World Scenarios — See It In Action

These are real tool calls your AI agent makes when connected to the FrootAI MCP server. Each scenario shows the tool name, what you pass in, and what you get back. Try them in VS Code Copilot Chat, Claude Desktop, or any MCP-compatible client.

<details>
<summary>🔍 <b>Scenario 1: "I want to build a RAG chatbot"</b></summary>
<br>

```
You ask → semantic_search_plays("RAG chatbot with Azure AI Search")
You get → Play 01 (Enterprise RAG, 92% match), Play 21 (Agentic RAG, 78%), Play 09 (AI Search Portal, 65%)
```

**Why it matters:** Instead of Googling "how to build RAG", your AI agent instantly finds the best pre-built solution from 100 plays — ranked by semantic similarity to your description.
</details>

<details>
<summary>🏗️ <b>Scenario 2: "Scaffold a new project from scratch"</b></summary>
<br>

```
You ask → scaffold_play(name: "Invoice Processor", model: "gpt-4o")
You get → 24 files created in solution-plays/101-invoice-processor/ with agents, skills, config,
          infra, evaluation — all auto-wired via FAI Protocol
```

**Why it matters:** One tool call generates a complete, production-ready project structure — agents, instructions, skills, hooks, config, evaluation pipeline, and infrastructure templates — all pre-wired together.
</details>

<details>
<summary>🔗 <b>Scenario 3: "Wire my play and check if everything connects"</b></summary>
<br>

```
You ask → wire_play(playId: "01")
You get → Wiring Report: 1 agent → 3 instructions → 3 skills → 3 hooks,
          shared context (4 knowledge modules + 5 WAF pillars), all wired in 43ms
```

**What is "wiring"?** The FAI Engine reads your `fai-manifest.json`, resolves all file paths, injects shared knowledge context into every primitive, and verifies quality gates. Think of it as `docker compose up` but for AI primitives.
</details>

<details>
<summary>🔬 <b>Scenario 4: "X-ray my play's wiring graph"</b></summary>
<br>

```
You ask → inspect_wiring(playId: "01")
You get → Visual dependency graph:
          Agents → constrained by → Instructions → invoke → Skills
                → guarded by → Hooks → ALL share → FAI Context
```

**Why it matters:** See exactly how your play's primitives connect — which agent uses which skill, which instructions constrain behavior, and which hooks enforce guardrails.
</details>

<details>
<summary>✅ <b>Scenario 5: "Check if my AI responses meet quality standards"</b></summary>
<br>

```
You ask → evaluate_quality(scores: { groundedness: 0.97, relevance: 0.88, safety: 0 })
You get → Pass/fail table per metric against guardrail thresholds.
          Each play has its own quality bar defined in fai-manifest.json.
```

**Why it matters:** Automated quality gates catch regressions before they reach production. Scores below the threshold fail the check — no manual review needed.
</details>

<details>
<summary>🔄 <b>Scenario 6: "Build → Review → Tune workflow"</b></summary>
<br>

```
Step 1: agent_build("Invoice processing API")     → Architecture guidance
Step 2: agent_review("the invoice processing API") → Security + quality audit
Step 3: agent_tune("the invoice processing API")   → Production readiness verdict
```

**Why it matters:** Mirrors how real teams work — architect → code reviewer → QA. Each step feeds into the next, and the chain catches issues at every layer.
</details>

<details>
<summary>📋 <b>Scenario 7: "Validate my manifest follows the FAI Protocol"</b></summary>
<br>

```
You ask → validate_manifest(playId: "01")
You get → ✅ play: valid NN-kebab-case
          ✅ version: valid semver
          ✅ knowledge: 4 modules
          ✅ waf: 5 pillars
          ✅ all paths resolved
```

**Why it matters:** Like `terraform validate` but for AI primitives. Catches broken file paths, invalid WAF references, and missing required fields before anything runs.
</details>

<details>
<summary>⚖️ <b>Scenario 8: "Compare two solution approaches"</b></summary>
<br>

```
You ask → compare_plays(plays: "01,21")
You get → Side-by-side: complexity, services, cost, best-for comparison

Then  → estimate_cost(play: "01", scale: "prod")
You get → Itemized Azure pricing: AI Search $X/mo, OpenAI $Y/mo, App Service $Z/mo
```

**Why it matters:** Make informed architecture decisions — see the tradeoffs between approaches before writing a single line of code.
</details>

<details>
<summary>📚 <b>Scenario 9: "Search across all knowledge modules"</b></summary>
<br>

```
You ask → search_knowledge(query: "how to reduce hallucination in RAG")
You get → Top 5 BM25-ranked sections from 16 modules, with 500-char previews
```

**Why it matters:** BM25-ranked search across 358 indexed documents gives you precise, relevant answers from curated architecture knowledge — not generic web results.
</details>

<details>
<summary>🔌 <b>Scenario 10: "Install a community plugin"</b></summary>
<br>

```
Step 1: marketplace_search(query: "security")            → Finds enterprise-security plugin
Step 2: check_compatibility("enterprise-security", "01")  → Verifies WAF alignment
Step 3: install_plugin("enterprise-security", "01")       → Copies primitives, updates manifest
```

**Why it matters:** "npm for AI primitives" — discover, verify, install, and compose plugins into your solution play. Conflict detection ensures plugins don't overwrite each other.
</details>

---

### CLI — `npx frootai`

> **Note:** The CLI has moved to the standalone [`frootai`](https://www.npmjs.com/package/frootai) package (21 commands).

```bash
npx frootai help                              # Show all 21 commands
npx frootai info 01                           # Play details + cost estimate
npx frootai list                              # Browse 104 solution plays
npx frootai search "RAG architecture"         # BM25 ranked search
npx frootai scaffold 01                       # Download play + generate templates
npx frootai install 01 --kit devkit           # Install specific kit
npx frootai deploy                            # Guided Azure deployment
npx frootai status                            # Current project context
npx frootai diff                              # Compare local vs GitHub
npx frootai login                             # Check Azure + GitHub auth
npx frootai doctor                            # Health check
npx frootai validate --waf                    # WAF alignment scorecard
```

Install: `npm i -g frootai` or use `npx frootai@latest`

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

### Advanced Features

<details>
<summary><b>🔎 BM25 Search Engine</b></summary>
<br>

All search tools use a pre-built BM25 index (Robertson IDF, k1=1.5, b=0.75) over 358 documents. Far more accurate than keyword matching — finds "voice AI call center" → Play 04 with high relevance. The index covers all 104 solution plays, 16 knowledge modules, and the glossary.
</details>

<details>
<summary><b>🏷️ Tool Annotations</b></summary>
<br>

All 45 tools have MCP-standard annotations telling clients about their behavior:
- `readOnlyHint: true` — safe to call without side effects (knowledge, ecosystem, agent chain tools)
- `destructiveHint: true` — creates or modifies files (scaffold, install/uninstall)
- `openWorldHint: true` — makes network requests (live tools)
- `idempotentHint: true` — safe to retry (most tools)
</details>

<details>
<summary><b>📝 Structured Logging</b></summary>
<br>

The server emits MCP `notifications/message` with RFC 5424 severity levels (debug, info, warning, error). Clients see real-time logs for cache hits, BM25 queries, engine wiring, and scaffold progress.
</details>

<details>
<summary><b>📊 Progress Tokens</b></summary>
<br>

Long-running tools (`scaffold_play`, `smart_scaffold`) emit `notifications/progress` with per-step updates. Clients see: "Creating agent.md (1/24)... Creating copilot-instructions.md (2/24)... Verifying FAI Protocol wiring..."
</details>

<details>
<summary><b>👁️ Subscribable Resources</b></summary>
<br>

The server watches `solution-plays/` for changes and emits `notifications/resources/list_changed`. Clients auto-refresh their resource list when plays are added or removed.
</details>

<details>
<summary><b>📡 SSE Event Stream (HTTP mode)</b></summary>
<br>

In HTTP transport mode, `GET /mcp` returns a persistent SSE stream with server notifications. Supports `Last-Event-ID` for reconnection replay from a 50-event ring buffer. 15-second heartbeat keeps connections alive.
</details>

---

### The FAI Protocol — How Wiring Works

The **FAI Protocol** is what makes FrootAI unique. Every solution play has a `fai-manifest.json` — a binding contract that declares:

- **Context** — which knowledge modules and WAF pillars this play uses
- **Primitives** — which agents, instructions, skills, hooks, and workflows belong to this play
- **Guardrails** — quality thresholds (groundedness, coherence, relevance, safety, cost)

When you call `wire_play("01")`, the FAI Engine:

1. **Loads** the manifest from `solution-plays/01-enterprise-rag/spec/fai-manifest.json`
2. **Resolves** all file paths for every primitive
3. **Builds shared context** — injects knowledge modules + WAF pillars into every primitive
4. **Wires** agents → instructions → skills → hooks into a connected graph
5. **Creates** a quality evaluator with the play's guardrail thresholds

The result: every primitive in the play shares the same knowledge context and quality standards. Change one thing in the manifest, and it propagates everywhere.

<details>
<summary><b>📄 Example manifest</b> (<code>fai-manifest.json</code>)</summary>
<br>

```json
{
  "play": "01-enterprise-rag",
  "version": "1.0.0",
  "context": {
    "knowledge": ["R2-RAG-Architecture", "O3-MCP-Tools-Functions", "T3-Production-Patterns"],
    "waf": ["security", "reliability", "cost-optimization"],
    "scope": "enterprise-rag-qa"
  },
  "primitives": {
    "agents": ["./agent.md"],
    "instructions": ["./instructions.md", "../../instructions/python-waf.instructions.md"],
    "skills": ["./.github/skills/deploy-enterprise-rag/"],
    "hooks": ["../../hooks/frootai-secrets-scanner/"],
    "guardrails": {
      "groundedness": 0.95,
      "coherence": 0.90,
      "safety": 0
    }
  }
}
```

</details>

Think of it as `docker-compose.yml` for AI primitives — one file that defines how everything connects.

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
- **BM25 Search Engine** — pre-built index over 358 documents (plays + knowledge), Robertson IDF ranking
- **Progress Tokens** — real-time progress for scaffold operations
- **Structured Logging** — RFC 5424 `notifications/message` to connected clients
- **Tool Annotations** — all 45 tools annotated with `readOnlyHint`/`destructiveHint`/`idempotentHint`
- **SSE Event Stream** — resumable Server-Sent Events in HTTP mode
- **Subscribable Resources** — live change notifications via `fs.watch`
- **OpenTelemetry** — opt-in observability (OTEL_EXPORTER_OTLP_ENDPOINT)

> The FrootAI ecosystem is growing. New modules, plays, and tools are added with every release.

---

### Links

| Resource | Link |
|---|---|
| **Website** | [frootai.dev](https://frootai.dev) |
| **CLI & SDK (npm)** | [frootai on npm](https://www.npmjs.com/package/frootai) |
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