<p align="center">
  <img src="https://frootai.dev/img/frootai-mark.png" width="100" alt="FrootAI">
</p>

<h1 align="center">FrootAI</h1>
<p align="center"><sub>Python SDK</sub></p>
<p align="center"><strong>From the Roots to the Fruits. It's simply Frootful.</strong></p>
<p align="center"><em>An open ecosystem where Infra, Platform, and App teams build AI — Frootfully.</em></p>
<p align="center"><em>An open glue for the GenAI ecosystem, enabling deterministic and reliable AI solutions.</em></p>

<p align="center">
  <a href="https://pypi.org/project/frootai/"><img src="https://img.shields.io/pypi/v/frootai?style=flat-square&logo=python" alt="PyPI"></a>
  <a href="https://pypi.org/project/frootai/"><img src="https://img.shields.io/pypi/dm/frootai?style=flat-square&label=downloads" alt="downloads"></a>
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

### Install

```bash
pip install frootai
```

### Quick Start

```python
from frootai import FrootAI, SolutionPlay, Evaluator

client = FrootAI()

# Search knowledge
results = client.search("RAG architecture")

# Get a module
module = client.get_module("R2")  # RAG Architecture

# Browse solution plays
plays = SolutionPlay.all()

# Estimate Azure costs
cost = client.estimate_cost("01-enterprise-rag", scale="prod")

# Run evaluation
evaluator = Evaluator()
scores = {"groundedness": 4.5, "relevance": 3.8}
results = evaluator.check_thresholds(scores)
```

### CLI

```bash
frootai plays                    # List solution plays
frootai search "embeddings"      # Search knowledge
frootai modules                  # List FROOT modules
frootai glossary temperature     # Look up a term
frootai cost 01-enterprise-rag   # Azure cost estimate
```

---

### Features

- **Knowledge Search**  full-text search across all FROOT modules, offline
- **Solution Plays**  browse and filter pre-tuned deployable solutions
- **AI Glossary**  comprehensive AI/ML term definitions
- **Cost Estimation**  Azure cost estimates per solution play and scale
- **Evaluation Framework**  quality scoring with configurable thresholds
- **A/B Testing**  prompt experiments with real model callbacks
- **Zero Dependencies**  pure Python stdlib, works anywhere

> The FrootAI ecosystem is growing. New modules, plays, and capabilities with every release.

---

### Links

| Resource | Link |
|---|---|
| **Website** | [frootai.dev](https://frootai.dev) |
| **Setup Guide** | [FAI Packages Setup](https://frootai.dev/setup-guide) |
| **Python MCP Server** | [PyPI — frootai-mcp](https://pypi.org/project/frootai-mcp/) |
| **Node MCP Server** | [npm — frootai-mcp](https://www.npmjs.com/package/frootai-mcp) |
| **VS Code Extension** | [Marketplace](https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode) |
| **Docker Image** | [GitHub Container Registry](https://github.com/frootai/frootai/pkgs/container/frootai-mcp) |
| **GitHub** | [frootai/frootai](https://github.com/frootai/frootai) |
| **Contact** | [info@frootai.dev](mailto:info@frootai.dev) |

---

<p align="center">© 2026 FrootAI — MIT License</p>
<p align="center"><sub>AI architecture · Python · SDK · Azure · RAG · agents · copilot · evaluation · cost-estimation · offline-first · zero-dependencies · open-source · frootai</sub></p>