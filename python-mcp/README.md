<p align="center">
  <img src="https://frootai.dev/img/frootai-mark.png" width="100" alt="FrootAI">
</p>

<h1 align="center">FrootAI</h1>
<p align="center"><sub>MCP Server (Python)</sub></p>
<p align="center"><strong>From the Roots to the Fruits. It's simply Frootful.</strong></p>
<p align="center"><em>An open ecosystem where Infra, Platform, and App teams build AI — Frootfully.</em></p>
<p align="center"><em>An open glue for the GenAI ecosystem, enabling deterministic and reliable AI solutions.</em></p>

<p align="center">
  <a href="https://pypi.org/project/frootai-mcp/"><img src="https://img.shields.io/pypi/v/frootai-mcp?style=flat-square&logo=python" alt="PyPI"></a>
  <a href="https://pypi.org/project/frootai-mcp/"><img src="https://img.shields.io/pypi/dm/frootai-mcp?style=flat-square&label=downloads" alt="downloads"></a>
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

**Requirements:** Python >= 3.10

```bash
pip install frootai-mcp
```

### Run as MCP Server

```bash
frootai-mcp-py
```

### Use in Python

```python
from frootai_mcp.server import mcp

# Run as MCP server (stdio transport)
mcp.run(transport="stdio")
```

Or call tools directly:

```python
import asyncio
from frootai_mcp.server import search_knowledge, wire_play

result = asyncio.run(search_knowledge(query="RAG architecture"))
print(result)
```

---

### Connect to Your Agent

**VS Code / GitHub Copilot** `.vscode/mcp.json`:

```json
{
  "servers": {
    "frootai": {
      "type": "stdio",
      "command": "frootai-mcp-py"
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
      "command": "frootai-mcp-py"
    }
  }
}
```

</details>

---

### MCP Capabilities

| Capability | Count | Description |
|-----------|-------|-------------|
| **Tools** | 45 | Full MCP tools with annotations |
| **Resources** | 4 | URI templates for modules, plays, glossary, overview |
| **Prompts** | 6 | Guided workflows for architecture, review, scaffold |
| **Search** | BM25 | 358 docs × 8,627 terms, Robertson IDF |
| **Plays** | 100 | Solution architectures from starter to enterprise |
| **Primitives** | 860+ | Agents, instructions, skills, hooks, plugins |

### MCP Tools (45)

**Knowledge (6)** — bundled knowledge, works offline
- `list_modules` — browse FROOT knowledge modules by layer
- `get_module` — read any module in full
- `lookup_term` — AI/ML glossary lookup (200+ terms)
- `search_knowledge` — BM25 full-text search across all modules
- `get_architecture_pattern` — architecture decision guides
- `get_froot_overview` — complete framework summary

**Solution Plays (5)** — 100 pre-architected solutions
- `list_solution_plays` — list all 100 plays with filters
- `get_play_detail` — full play info with infra, tuning, complexity
- `semantic_search_plays` — BM25-powered play matching
- `compare_plays` — side-by-side play comparison
- `generate_architecture_diagram` — Mermaid.js diagrams

**Agent Chain (3)** — build → review → tune
- `agent_build` — architecture guidance + recommended play
- `agent_review` — security, quality, compliance audit
- `agent_tune` — production readiness + tuning recommendations

**Azure / Live (4)** — Azure AI intelligence
- `get_model_catalog` — model catalog with pricing tiers
- `get_azure_pricing` — service pricing by tier
- `compare_models` — side-by-side model comparison
- `estimate_cost` — itemized monthly cost per play

**Ecosystem (5)** — platform awareness
- `get_github_agentic_os` — .github Agentic OS guide
- `list_community_plays` — community plugin marketplace
- `fetch_azure_docs` — Azure documentation links
- `fetch_external_mcp` — discover MCP servers
- `get_play_spec` — SpecKit with WAF alignment

**FAI Engine (5)** — protocol wiring
- `wire_play` — generate fai-manifest.json for a play
- `inspect_wiring` — check what primitives are connected
- `validate_manifest` — validate fai-manifest.json schema
- `validate_config` — validate AI config parameters
- `evaluate_quality` — run quality evaluation (groundedness, relevance, etc.)

**Marketplace (4)** — primitive discovery
- `list_marketplace` — browse 860+ primitives by type
- `get_primitive_detail` — get detail for a specific primitive
- `search_marketplace` — keyword search across all primitives
- `embedding_playground` — text similarity comparison (educational)

**Scaffold (5)** — project bootstrapping
- `scaffold_play` — scaffold a new play with DevKit structure
- `smart_scaffold` — describe what you want, get the best play
- `list_templates` — available scaffold templates by complexity
- `preview_scaffold` — dry-run preview of scaffold output
- `scaffold_status` — check scaffold completeness

**Extra (8)** — specialized utilities
- `run_evaluation` — run evaluation with custom thresholds
- `get_bicep_best_practices` — Bicep IaC best practices
- `list_primitives` — list primitives by type
- `get_waf_guidance` — WAF pillar guidance
- `check_play_compatibility` — check if plays can compose
- `get_learning_path` — curated learning paths by topic
- `export_play_config` — export play config as JSON
- `get_version_info` — server version and capabilities

### MCP Resources (4)

| URI | Description |
|-----|-------------|
| `fai://modules/{module_id}` | Read FROOT module without tool call |
| `fai://plays/{play_id}` | Read solution play without tool call |
| `fai://glossary/{term}` | Look up glossary term without tool call |
| `fai://overview` | Platform overview without tool call |

### MCP Prompts (6)

| Prompt | Description |
|--------|-------------|
| `design_architecture` | Guided AI architecture design |
| `review_config` | Structured config review for production |
| `pick_solution_play` | Conversational play selection |
| `estimate_costs` | Azure cost estimation workflow |
| `scaffold_project` | Project bootstrapping workflow |
| `learn_fai_protocol` | FAI Protocol educational walkthrough |

---

### What Ships Inside

| Component | Details |
|-----------|---------|
| **FROOT Knowledge** | 16 modules across 5 layers (682KB) |
| **BM25 Search Index** | 358 documents × 8,627 terms, pre-computed IDF |
| **Solution Plays** | 100 pre-architected Azure AI solutions |
| **AI Glossary** | 200+ terms extracted from modules |
| **FAI Protocol** | Manifest schema for play wiring |
| **Architecture Guides** | RAG, agents, hosting, cost, security |

> **Feature parity** with the Node.js MCP server — same 45 tools, same knowledge, same FAI Engine.

---

### Testing

```bash
pip install pytest
cd python-mcp
python -m pytest tests/ -v
# 43 tests across 9 test classes
```

---

### Links

| Resource | Link |
|---|---|
| **Website** | [frootai.dev](https://frootai.dev) |
| **Setup Guide** | [FAI Packages Setup](https://frootai.dev/setup-guide) |
| **Python SDK** | [PyPI — frootai](https://pypi.org/project/frootai/) |
| **Node MCP Server** | [npm — frootai-mcp](https://www.npmjs.com/package/frootai-mcp) |
| **VS Code Extension** | [Marketplace](https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode) |
| **Docker Image** | [GitHub Container Registry](https://github.com/frootai/frootai/pkgs/container/frootai-mcp) |
| **GitHub** | [frootai/frootai](https://github.com/frootai/frootai) |
| **Contact** | [info@frootai.dev](mailto:info@frootai.dev) |

---

<p align="center">© 2026 FrootAI — MIT License</p>
<p align="center"><sub>AI architecture · MCP · model-context-protocol · Python · Azure · RAG · agents · copilot · semantic-kernel · open-source · frootai</sub></p>