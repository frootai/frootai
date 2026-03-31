<p align="center">
  <img src="frootai-mark.png" width="100" alt="FrootAI">
</p>

# FrootAI — Python SDK

> Offline-first access to 16 AI architecture knowledge modules, 20 solution plays, cost estimation, evaluation, and A/B testing. Zero external dependencies.

[![PyPI](https://img.shields.io/pypi/v/frootai)](https://pypi.org/project/frootai/)
[![Python](https://img.shields.io/pypi/pyversions/frootai)](https://pypi.org/project/frootai/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## Install

```bash
pip install frootai
```

## Quick Start

```python
from frootai import FrootAI, SolutionPlay, Evaluator

# Search 682KB knowledge base (16 modules across 5 FROOT layers)
client = FrootAI()
results = client.search("RAG architecture")
for r in results:
    print(f"[{r['module_id']}] {r['title']} — {r['relevance']} hits")

# Get a specific module
module = client.get_module("R2")  # RAG Architecture & Retrieval
print(f"{module['title']}: {module['content_length']:,} chars")

# List all FROOT layers
for layer in client.list_layers():
    print(f"{layer['emoji']} {layer['name']} ({len(layer['modules'])} modules)")

# Estimate Azure costs
cost = client.estimate_cost("01-enterprise-rag", scale="prod")
print(f"${cost['monthly_total']}/mo")

# Browse 20 solution plays
plays = SolutionPlay.all()
ready = SolutionPlay.ready()  # 3 production-ready
by_layer = SolutionPlay.by_layer("R")  # Reasoning layer plays
```

## Features

### Knowledge Search (offline, no API calls)

```python
client = FrootAI()

# Full-text search across 16 modules (643KB of real content)
results = client.search("embeddings", max_results=5)

# Get module by ID
mod = client.get_module("O2")  # AI Agents & Microsoft Agent Framework

# List all modules
for m in client.list_modules():
    print(f"{m['emoji']} {m['id']} {m['title']} ({m['content_length'] // 1024}KB)")

# Extract a specific section
section = client.get_module_section("F1", "Table of Contents")
```

### Glossary (159+ terms extracted from content)

```python
# Look up a term
term = client.lookup_term("temperature")

# Search glossary
terms = client.search_glossary("embedding", max_results=10)
```

### Cost Estimation

```python
# Estimate monthly Azure costs for a solution play
cost = client.estimate_cost("01-enterprise-rag", scale="dev")
# {'play': '01-enterprise-rag', 'scale': 'dev', 'monthly_total': 430, 'breakdown': {...}}

cost = client.estimate_cost("01-enterprise-rag", scale="prod")
# {'monthly_total': 3600, 'breakdown': {'openai-gpt4o': 2500, 'ai-search-standard': 750, ...}}
```

### Solution Plays (20 pre-tuned architecture blueprints)

```python
from frootai.plays import SolutionPlay

play = SolutionPlay.get("03")
print(f"{play.name}: {play.description}")
print(f"Infrastructure: {play.infra}")
print(f"Tuning params: {play.tuning}")
print(f"Related modules: {play.modules}")

# Filter by FROOT layer
orchestration_plays = SolutionPlay.by_layer("O_ORCH")
```

### Evaluation (quality gates)

```python
from frootai import Evaluator

evaluator = Evaluator()
scores = {"groundedness": 4.5, "relevance": 3.2, "coherence": 4.1, "fluency": 4.8}

results = evaluator.check_thresholds(scores)
print(evaluator.summary(scores))
# 3/4 checks passed (relevance 3.2 < threshold 4.0)
```

### A/B Testing (prompt experiments)

```python
from frootai.ab_testing import PromptExperiment, PromptVariant

# You provide the model function — no fake scores
def my_model(system_prompt, query):
    return call_your_llm(system_prompt=system_prompt, user_message=query)

def my_scorer(query, response):
    return {"groundedness": 4.5, "relevance": 4.0}

experiment = PromptExperiment(
    name="system-prompt-v2",
    variants=[
        PromptVariant("control", "You are a helpful assistant."),
        PromptVariant("expert", "You are an Azure AI expert. Cite sources."),
    ],
)

results = experiment.run(["What is RAG?"], model_fn=my_model, scorer_fn=my_scorer)
print(f"Winner: {experiment.pick_winner(results)}")
```

## CLI

```bash
frootai plays                    # List all 20 solution plays
frootai plays --ready            # Show production-ready plays only
frootai plays --layer R          # Filter by FROOT layer
frootai search "embeddings"      # Search knowledge base
frootai modules                  # List all 16 modules with sizes
frootai glossary temperature     # Look up a term
frootai cost 01-enterprise-rag   # Estimate Azure costs
frootai cost 01-enterprise-rag --scale prod
frootai --version                # Show version
```

## What's Inside

- **16 knowledge modules** (643KB) across 5 FROOT layers: Foundations, Reasoning, Orchestration, Operations, Transformation
- **20 solution plays** with infrastructure, tuning parameters, and module mapping
- **159+ glossary terms** extracted from module content
- **Cost estimation** for 10 plays with dev/prod breakdowns
- **Evaluation framework** with configurable thresholds
- **A/B testing framework** with real model callbacks (no fake scores)
- **Zero external dependencies** — pure Python stdlib

## FROOT Layers

| Layer | Emoji | Name | Modules |
|-------|-------|------|---------|
| F | 🌱 | Foundations | F1-F4 (GenAI, LLMs, Glossary, Agentic OS) |
| R | 🪵 | Reasoning | R1-R3 (Prompts, RAG, Deterministic AI) |
| O_ORCH | 🌿 | Orchestration | O1-O3 (Semantic Kernel, Agents, MCP) |
| O_OPS | 🏗️ | Operations | O4-O6 (Platform, Infrastructure, Copilot) |
| T | 🍎 | Transformation | T1-T3 (Fine-Tuning, Responsible AI, Production) |

## Links

- **Website:** [frootai.dev](https://frootai.dev)
- **npm MCP Server:** [frootai-mcp](https://www.npmjs.com/package/frootai-mcp)
- **VS Code Extension:** [psbali.frootai](https://marketplace.visualstudio.com/items?itemName=psbali.frootai)
- **Docker:** [ghcr.io/frootai/frootai-mcp](https://github.com/frootai/frootai/pkgs/container/frootai-mcp)
- **GitHub:** [github.com/frootai/frootai](https://github.com/frootai/frootai)
- **Python MCP Server:** [frootai-mcp (PyPI)](https://pypi.org/project/frootai-mcp/)
- **Contact:** [info@frootai.dev](mailto:info@frootai.dev)

## License

MIT — Pavleen Bali
