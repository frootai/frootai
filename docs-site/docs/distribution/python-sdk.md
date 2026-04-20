---
sidebar_position: 4
title: Python SDK
description: The FrootAI Python SDK provides programmatic access to FROOT modules, solution plays, model comparison, and cost estimation from Python applications.
---

# Python SDK

The FrootAI Python SDK (`frootai`) gives you programmatic access to the entire FrootAI knowledge base from any Python application — search modules, browse plays, compare models, and estimate costs.

## Installation

```bash
pip install frootai
```

## Quick Start

```python
from frootai import FrootAIClient

client = FrootAIClient()

# Search FROOT knowledge base
results = client.search_knowledge("RAG chunking strategies")
for r in results:
    print(f"{r['module']}: {r['title']}")

# Get a specific module
module = client.get_module("R2")
print(module["title"])  # "RAG Architecture"

# List all solution plays
plays = client.list_plays()
print(f"{len(plays)} plays available")
```

## API Reference

### Knowledge & Modules

```python
# Search across all 17 FROOT modules
results = client.search_knowledge(query: str, max_results: int = 5)

# Get full content of a specific module
module = client.get_module(module_id: str)
# module_id: F1, F2, F3, R1, R2, R3, O1-O6, T1-T3

# List all modules organized by FROOT layer
modules = client.list_modules()

# Look up an AI/ML term in the glossary
definition = client.lookup_term(term: str)
```

### Solution Plays

```python
# List all solution plays
plays = client.list_plays(filter: str = None)

# Get detailed play information
play = client.get_play_detail(play_number: str)

# Semantic search for plays
matches = client.search_plays(query: str, top_k: int = 3)

# Compare plays side-by-side
comparison = client.compare_plays(plays: list[str])
```

### Models & Cost

```python
# Compare AI models for a use case
comparison = client.compare_models(use_case: str, priority: str = "quality")

# Get model catalog
catalog = client.get_model_catalog(category: str = "all")

# Estimate monthly Azure costs
estimate = client.estimate_cost(play: str, scale: str = "dev")
```

### Build / Review / Tune

```python
# Builder agent — implementation guidelines
guidelines = client.agent_build(task: str)

# Reviewer agent — security + quality checklist
review = client.agent_review(context: str = None)

# Tuner agent — production readiness validation
validation = client.agent_tune(context: str = None)

# Run evaluation against thresholds
result = client.run_evaluation(scores: dict, thresholds: dict = None)
```

## Usage Example: Evaluation Pipeline

```python
from frootai import FrootAIClient

client = FrootAIClient()

# Run evaluation
scores = {
    "groundedness": 4.5,
    "relevance": 3.8,
    "coherence": 4.1,
    "fluency": 4.6
}

result = client.run_evaluation(
    scores=scores,
    thresholds={"groundedness": 4.0, "relevance": 3.5}
)

print(f"Overall: {'PASS' if result['overall_pass'] else 'FAIL'}")
for metric in result["results"]:
    status = "✅" if metric["passed"] else "❌"
    print(f"  {status} {metric['metric']}: {metric['score']}")
```

## MCP Integration

The Python SDK also provides an MCP server wrapper:

```bash
pip install frootai-mcp
python -m frootai.mcp
```

This starts a Python MCP server exposing the same 25 tools as the Node.js MCP server.

## Version

Current version: **v4.0.0**, synced with 100 plays and all primitives.

## See Also

- [npm SDK](/docs/distribution/npm-sdk) — Node.js equivalent
- [MCP Server](/docs/distribution/mcp-server) — MCP protocol access
- [CLI](/docs/distribution/cli) — command-line interface
