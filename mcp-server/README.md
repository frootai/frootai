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

### MCP Tools

**Static**  bundled knowledge, works offline
- `list_modules`  browse FROOT knowledge modules by layer
- `get_module`  read any module in full
- `lookup_term`  AI/ML glossary lookup
- `search_knowledge`  full-text search across all modules
- `get_architecture_pattern`  architecture decision guides
- `get_froot_overview`  complete framework summary

**Live**  network-enabled, graceful offline fallback
- `fetch_azure_docs`  search Microsoft Learn for Azure docs
- `fetch_external_mcp`  discover MCP servers from public registries
- `list_community_plays`  browse solution plays from GitHub
- `get_github_agentic_os`  .github Agentic OS implementation guide

**Agent Chain**  build  review  tune
- `agent_build`  architecture guidance + code patterns
- `agent_review`  security, quality, compliance audit
- `agent_tune`  production readiness validation

**Ecosystem**  Azure AI intelligence
- `get_model_catalog`  Azure AI model catalog with pricing
- `get_azure_pricing`  monthly cost estimates for Azure services
- `compare_models`  side-by-side model comparison
- `compare_plays`  compare solution plays

**Compute**  real calculations, not just lookups
- `estimate_cost`  itemized Azure cost estimate per play + scale
- `validate_config`  validate configs against best practices
- `generate_architecture_diagram`  Mermaid architecture diagrams
- `embedding_playground`  cosine similarity between texts
- `semantic_search_plays`  semantic search across solution plays
- `run_evaluation`  quality scoring with configurable thresholds

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

### Agent FAI REST API

Chat with Agent FAI  grounded in FrootAI knowledge: [frootai.dev/chatbot](https://frootai.dev/chatbot)

`POST /api/chat`  `POST /api/chat/stream`  `POST /api/search-plays`  `POST /api/estimate-cost`  `GET /api/health`

[Agent FAI REST API Docs ](https://frootai.dev/api-docs)

---

### What Ships Inside

- **FROOT Knowledge Modules**  Foundations, Reasoning, Orchestration, Operations, Transformation
- **AI Glossary**  comprehensive AI/ML term definitions
- **Solution Plays**  pre-tuned deployable solutions with .github Agentic OS
- **Architecture Decision Guides**  RAG, agents, hosting, model selection, cost optimization, determinism

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