---
sidebar_position: 1
title: FAI Protocol
description: The FAI Protocol is an open specification for declaring how AI primitives are wired together — the Dockerfile equivalent for AI systems.
---

# FAI Protocol

The FAI Protocol is the declarative context-wiring standard for AI primitive orchestration. It defines `fai-manifest.json` — a single file that serves as the **Dockerfile equivalent for AI systems**.

## The Problem

The AI tooling ecosystem has produced hundreds of building blocks — agents, retrieval pipelines, prompt templates, guardrails, evaluation harnesses, infrastructure modules — but **no standard for wiring them together**. Each framework defines its own composition model, and each platform adds its own orchestration layer. The result is fragmented, non-portable AI systems.

Protocols like MCP standardize tool calling. A2A standardizes delegation. AG-UI standardizes rendering. But none address: *how do you declare which primitives a system uses, how they share context, and what quality thresholds they must meet?*

## The Solution

The FAI Protocol introduces `fai-manifest.json` — just as a Dockerfile declares base images, dependencies, and build steps for a container, `fai-manifest.json` declares knowledge context, primitives, quality guardrails, infrastructure, and toolkit paths for an AI solution.

```
┌─────────────────────────────────┐
│       fai-manifest.json         │
├─────────────────────────────────┤
│  context:                       │
│    knowledge → FROOT modules    │
│    waf → 6 pillars enforced     │
│  primitives:                    │
│    agents, skills, hooks, ...   │
│  guardrails:                    │
│    groundedness, safety, cost   │
│  infrastructure:                │
│    bicep, terraform, docker     │
│  toolkit:                       │
│    devkit, tunekit, speckit     │
└─────────────────────────────────┘
```

## fai-manifest.json

Every solution play contains exactly one manifest at its root. Here is a complete example:

```json title="fai-manifest.json"
{
  "$schema": "https://frootai.dev/schemas/fai-manifest.schema.json",
  "play": "01-enterprise-rag",
  "version": "1.0.0",
  "context": {
    "knowledge": [
      "F1-GenAI-Foundations",
      "R2-RAG-Architecture",
      "O4-Azure-AI-Services",
      "T3-Production-Patterns"
    ],
    "waf": [
      "security",
      "reliability",
      "cost-optimization",
      "responsible-ai"
    ],
    "scope": "enterprise-rag-qa"
  },
  "primitives": {
    "agents": [
      "./agent.md",
      "./.github/agents/builder.agent.md"
    ],
    "instructions": [
      "./.github/copilot-instructions.md"
    ],
    "skills": [
      "./.github/skills/rag-indexer"
    ],
    "hooks": [
      "../../hooks/frootai-secrets-scanner/",
      "../../hooks/frootai-tool-guardian/"
    ],
    "guardrails": {
      "groundedness": 0.95,
      "coherence": 0.90,
      "relevance": 0.85,
      "safety": 0,
      "costPerQuery": 0.02
    }
  },
  "infrastructure": {
    "bicep": "./infra/main.bicep",
    "parameters": "./infra/main.bicepparam"
  },
  "toolkit": {
    "devkit": "./.github",
    "tunekit": "./config",
    "speckit": "./spec"
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `play` | `string` | Play identifier matching `NN-kebab-case` (e.g., `01-enterprise-rag`) |
| `version` | `string` | Semantic version (e.g., `1.0.0`) |
| `context` | `object` | Shared knowledge and WAF alignment (see below) |
| `primitives` | `object` | Primitive declarations and guardrail thresholds |

### Context Section

The `context` object declares shared knowledge and governance that applies to **every primitive** loaded from this manifest:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `knowledge` | `string[]` | Yes | FROOT knowledge module IDs (min 1) |
| `waf` | `string[]` | Yes | WAF pillars to enforce (min 1) |
| `scope` | `string` | No | Scenario scope for context isolation |

When the FAI Engine loads a primitive, it injects the resolved knowledge content and WAF constraints. An agent designed for RAG automatically receives RAG architecture knowledge and enforces the security pillar — without the agent declaring those dependencies itself.

### Guardrails Section

Quality thresholds enforced at the protocol level:

| Metric | Range | Description |
|--------|-------|-------------|
| `groundedness` | 0–1 | Response supported by retrieved sources. Recommended ≥ 0.95 |
| `coherence` | 0–1 | Logical consistency and readability. Recommended ≥ 0.90 |
| `relevance` | 0–1 | Response addresses the user's query. Recommended ≥ 0.85 |
| `safety` | 0 | Maximum safety violations. **Must be 0 for production** |
| `costPerQuery` | USD | Maximum cost per query in US dollars |

:::danger
The `safety` threshold MUST be `0` for all production deployments — zero tolerance for harmful content.
:::

## fai-context.json

The companion lightweight format for standalone primitives. While `fai-manifest.json` wires an entire play, `fai-context.json` lets individual agents or skills declare their own context assumptions:

```json title="agents/fai-rag-architect/fai-context.json"
{
  "assumes": ["R2-RAG-Architecture", "O4-Azure-AI-Services"],
  "waf": ["security", "reliability"],
  "compatible-plays": ["01-enterprise-rag", "21-agentic-rag", "28-knowledge-graph-rag"]
}
```

### Context Inheritance

When a standalone primitive is loaded into a play:

1. The FAI Engine reads the manifest's `context.knowledge` and resolves each module ID
2. Play-level `waf` pillars are **additive** — both play and primitive WAF pillars are enforced
3. Play-level `knowledge` **replaces** standalone `assumes`
4. Play-level guardrails **override** any evaluation thresholds in `fai-context.json`

## What the FAI Protocol Delegates

The FAI Protocol doesn't try to do everything. It explicitly delegates to existing standards:

| Concern | Delegated To |
|---------|-------------|
| Tool invocation | MCP (Model Context Protocol) |
| Agent-to-agent delegation | A2A (Agent-to-Agent Protocol) |
| UI rendering | AG-UI |
| Model inference | Provider APIs (OpenAI, Azure, Anthropic) |
| Infrastructure provisioning | Bicep, Terraform, Pulumi |
| Package distribution | npm, PyPI, Docker |

:::info
Read the [full FAI Protocol specification](https://github.com/frootai/frootai/tree/main/fai-protocol) for exhaustive field definitions, path resolution rules, and conformance requirements.
:::

## Next Steps

- **[Primitives](./primitives)** — the 6 building block types wired by the protocol
- **[Solution Plays](./solution-plays)** — how plays use the manifest
- **[Well-Architected Framework](./well-architected)** — the 6 WAF pillars
- **[Your First Solution Play](../getting-started/first-play)** — build one yourself
