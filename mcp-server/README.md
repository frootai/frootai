<p align="center">
  <img src="frootai-mark.png" width="100" alt="FrootAI">
</p>

# frootai-mcp

> **The AI architecture knowledge engine for your coding agent.**
> 23 tools. 16 modules. 682KB of curated knowledge. Zero hallucination.

[![npm](https://img.shields.io/npm/v/frootai-mcp)](https://www.npmjs.com/package/frootai-mcp) [![license](https://img.shields.io/npm/l/frootai-mcp)](LICENSE)

**FrootAI** — From the Roots to the Fruits. The open glue for GenAI architecture.

---

## Quick Start

```bash
npx frootai-mcp@latest
```

<details>
<summary><b>Other install methods</b></summary>

**Install globally:**
```bash
npm i -g frootai-mcp@latest && frootai-mcp
```

**Docker (no Node.js needed):**
```bash
docker run -i ghcr.io/frootai/frootai-mcp
```

</details>

---

## Connect to Your AI Agent

<details open>
<summary><b>VS Code / GitHub Copilot</b> — <code>.vscode/mcp.json</code></summary>

```json
{
  "servers": {
    "frootai": {
      "type": "stdio",
      "command": "npx",
      "args": ["frootai-mcp"]
    }
  }
}
```

</details>

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
<summary><b>Docker</b> — <code>.vscode/mcp.json</code></summary>

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

## 23 tools at a Glance

<details open>
<summary><b>Static (6)</b> — Bundled knowledge, works offline</summary>

| Tool | What it does |
|------|-------------|
| `list_modules` | Browse 16 FROOT modules by layer |
| `get_module` | Read any module (F1-F4, R1-R3, O1-O6, T1-T3) |
| `lookup_term` | 200+ AI/ML term definitions |
| `search_knowledge` | Full-text search across all modules |
| `get_architecture_pattern` | 7 decision guides (RAG vs fine-tuning, model selection, etc.) |
| `get_froot_overview` | Complete framework summary |

</details>

<details>
<summary><b>Live (4)</b> — Network-enabled, graceful offline fallback</summary>

| Tool | What it does |
|------|-------------|
| `fetch_azure_docs` | Search Microsoft Learn for Azure docs |
| `fetch_external_mcp` | Find MCP servers from public registries |
| `list_community_plays` | List 20 solution plays from GitHub |
| `get_github_agentic_os` | .github Agentic OS guide (7 primitives) |

</details>

<details>
<summary><b>Agent Chain (3)</b> — Build → Review → Tune in conversation</summary>

| Tool | What it does |
|------|-------------|
| `agent_build` | Architecture guidance + code patterns, suggests review |
| `agent_review` | Security + quality checklist, suggests tuning |
| `agent_tune` | Production readiness validation, suggests deploy |

Just talk: *"Build me an IT ticket API"* → *"Review this"* → *"Validate my config"*. Each tool hands off to the next.

</details>

<details>
<summary><b>Ecosystem (3)</b> — Azure AI model intelligence</summary>

| Tool | What it does |
|------|-------------|
| `get_model_catalog` | Azure AI model catalog with pricing + capabilities |
| `get_azure_pricing` | Monthly cost estimates for 25+ Azure services |
| `compare_models` | Side-by-side model comparison for your use case |

</details>

<details>
<summary><b>Compute (6)</b> — Real calculations, not just lookups</summary>

| Tool | What it does |
|------|-------------|
| `semantic_search_plays` | Embedding-powered search across 20 solution plays |
| `estimate_cost` | Itemized Azure cost estimate per play + scale |
| `validate_config` | Validate openai.json / guardrails.json against best practices |
| `compare_plays` | Side-by-side comparison of solution plays |
| `generate_architecture_diagram` | Mermaid architecture diagrams for any play |
| `embedding_playground` | Cosine similarity between texts (educational) |
| `run_evaluation` | Quality evaluation — scores vs thresholds with recommendations |

</details>

---

## CLI — `npx frootai`

The same package also ships a CLI for project scaffolding and knowledge lookups:

```bash
npx frootai init                              # Interactive project scaffolding
npx frootai search "RAG architecture"         # Search knowledge base from terminal
npx frootai cost enterprise-rag --scale prod  # Azure cost estimate
npx frootai validate                          # Check project structure + configs
npx frootai doctor                            # Health check (Node, git, MCP)
```

### `frootai init`

3 questions → scaffolds a complete FrootAI project:

```
? What are you building? [Enterprise RAG / AI Agent / AI Gateway / ...]
? Target scale? [dev / prod]
? Project name? [my-ai-project]
```

Creates:
```
my-ai-project/
├── .vscode/mcp.json          ← MCP server auto-connects
├── .github/agents/           ← Builder, Reviewer, Tuner agents
├── .github/copilot-instructions.md
├── config/                   ← OpenAI, Search, Guardrails configs
├── evaluation/               ← Eval thresholds
└── README.md
```

Then just `cd my-ai-project && code .` — FrootAI MCP auto-connects in VS Code.

### `frootai validate --waf`

Run a WAF scorecard against your project (6 pillars, 17 checks):

```bash
npx frootai validate --waf
```

Returns pass/fail for each WAF pillar: Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency, Responsible AI.

---

## REST API

Agent FAI is also available as a REST API:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/search-plays` | Search 20 solution plays |
| POST | `/api/estimate-cost` | Azure cost estimate |
| POST | `/api/chat` | Chat with Agent FAI |
| POST | `/api/chat/stream` | Streaming chat (SSE) |
| GET | `/api/openapi.json` | OpenAPI 3.1 spec |

**Base URL**: `https://frootai-chatbot-api.azurewebsites.net` · Rate limit: 60 req/min

[📡 API Docs →](https://frootai.dev/api-docs) · [OpenAPI Spec →](https://frootai-chatbot-api.azurewebsites.net/api/openapi.json)

---

## What's Bundled

| Content | Size |
|---------|------|
| 16 FROOT modules (F·R·O·O·T) | 682KB |
| 200+ glossary terms | A-Z |
| 20 solution plays | .github Agentic OS |
| 7 architecture decision guides | RAG, agents, hosting, cost |

---

## Links

| | |
|---|---|
| **Website** | [frootai.dev](https://frootai.dev) |
| **CLI Docs** | [frootai.dev/cli](https://frootai.dev/cli) |
| **REST API Docs** | [frootai.dev/api-docs](https://frootai.dev/api-docs) |
| **VS Code Extension** | [marketplace.visualstudio.com](https://marketplace.visualstudio.com/items?itemName=psbali.frootai) |
| **Docker** | [ghcr.io/frootai/frootai-mcp](https://github.com/frootai/frootai/pkgs/container/frootai-mcp) |
| **Python SDK** | [pypi.org/project/frootai](https://pypi.org/project/frootai/) |
| **Python MCP** | [pypi.org/project/frootai-mcp](https://pypi.org/project/frootai-mcp/) |
| **GitHub** | [github.com/frootai/frootai](https://github.com/frootai/frootai) |
| **Setup Guide** | [frootai.dev/setup-guide](https://frootai.dev/setup-guide) |
| **Contact** | [info@frootai.dev](mailto:info@frootai.dev) |

---

© 2026 FrootAI · MIT License
