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
from frootai_mcp import FrootAIMCP

server = FrootAIMCP()
result = server._search_knowledge({"query": "RAG architecture"})
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

### MCP Tools

**Static** — bundled knowledge, works offline
- `list_modules` — browse FROOT knowledge modules by layer
- `get_module` — read any module in full
- `lookup_term` — AI/ML glossary lookup
- `search_knowledge` — full-text search across all modules
- `get_architecture_pattern` — architecture decision guides
- `get_froot_overview` — complete framework summary

**Live** — network-enabled, graceful offline fallback
- `fetch_azure_docs` — search Microsoft Learn for Azure docs
- `fetch_external_mcp` — discover MCP servers from public registries
- `list_community_plays` — browse solution plays from GitHub
- `get_github_agentic_os` — .github Agentic OS implementation guide

**Agent Chain** — build → review → tune
- `agent_build` — architecture guidance + code patterns
- `agent_review` — security, quality, compliance audit
- `agent_tune` — production readiness validation

**Ecosystem** — Azure AI intelligence
- `get_model_catalog` — Azure AI model catalog with pricing
- `get_azure_pricing` — monthly cost estimates for Azure services
- `compare_models` — side-by-side model comparison
- `compare_plays` — compare solution plays

**Compute** — real calculations, not just lookups
- `estimate_cost` — itemized Azure cost estimate per play + scale
- `validate_config` — validate configs against best practices
- `generate_architecture_diagram` — Mermaid architecture diagrams
- `embedding_playground` — cosine similarity between texts
- `semantic_search_plays` — semantic search across solution plays
- `run_evaluation` — quality scoring with configurable thresholds

---

### What Ships Inside

- **FROOT Knowledge Modules** — Foundations, Reasoning, Orchestration, Operations, Transformation
- **AI Glossary** — comprehensive AI/ML term definitions
- **Solution Plays** — pre-tuned deployable AI solutions
- **Architecture Decision Guides** — RAG, agents, hosting, cost optimization

> Same tools as the Node.js MCP server. The FrootAI ecosystem grows with every release.

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