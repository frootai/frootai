---
sidebar_position: 1
title: Introduction
description: What is FrootAI? The uniFAIng glue for the GenAI ecosystem — connecting agents, skills, infrastructure, and evaluation into production-ready AI solutions.
---

# Introduction

**From the Roots to the Fruits. It's connected. It's simply Frootful.**

FrootAI is an open ecosystem that unifies the GenAI landscape — binding Infrastructure, Platform, and Application teams with a shared protocol, shared primitives, and shared quality gates. Every piece understands and builds on the others so that Infra, Platform, and App teams build AI — *Frootfully*.

## What Problem Does FrootAI Solve?

The AI tooling ecosystem has produced hundreds of capable building blocks — agents, retrieval pipelines, prompt templates, guardrails, evaluation harnesses, infrastructure modules — but **no standard for wiring them together**. Each framework (LangChain, Semantic Kernel, AutoGen, CrewAI) defines its own composition model, and each platform (Azure AI Foundry, AWS Bedrock, Vertex AI) adds its own orchestration layer.

Protocols like **MCP** standardize tool calling. **A2A** standardizes delegation. **AG-UI** standardizes rendering. But none address the fundamental question: *how do you declare which primitives a system uses, how they share context, and what quality thresholds they must meet?*

**FrootAI answers that question with the FAI Protocol.**

## Core Concepts

### FAI Protocol

The `fai-manifest.json` is the Dockerfile equivalent for AI systems — a single declarative file that wires primitives, knowledge, WAF pillars, and guardrails into one coherent manifest:

```json
{
  "play": "01-enterprise-rag",
  "version": "1.0.0",
  "context": {
    "knowledge": ["R2-RAG-Architecture", "O4-Azure-AI-Services"],
    "waf": ["security", "reliability", "cost-optimization"]
  },
  "primitives": {
    "agents": ["./.github/agents/builder.agent.md"],
    "instructions": ["./.github/copilot-instructions.md"],
    "skills": ["./.github/skills/rag-indexer"]
  }
}
```

Learn more in the [FAI Protocol concept page](../concepts/fai-protocol).

### Primitives

Six building block types that work standalone **and** auto-wire when placed inside a solution play:

| Type | Format | Purpose |
|------|--------|---------|
| **Agents** | `.agent.md` | AI personalities with tools, model preferences, and WAF alignment |
| **Instructions** | `.instructions.md` | Auto-applied coding standards scoped by file glob |
| **Skills** | `SKILL.md` folder | Multi-step procedures the agent can execute |
| **Hooks** | `hooks.json` | Event-driven guardrails triggered by lifecycle events |
| **Plugins** | `plugin.json` | Themed bundles of agents + skills + hooks |
| **Workflows** | `.yml` | Multi-agent orchestration pipelines |

### Solution Plays

100 pre-built, deployable AI architectures — each shipping with a full DevKit, TuneKit, SpecKit, Bicep infrastructure, and evaluation pipeline. From Enterprise RAG to Edge AI, every play is wired through the FAI Protocol.

## Quick Preview

```bash
# Start the MCP server — works with Copilot, Claude, Cursor, Windsurf
npx frootai-mcp@latest

# Scaffold a new solution play
npx frootai init-devkit 01

# Validate all primitives
npm run validate:primitives
```

## What Makes FrootAI Different?

| Feature | FrootAI | Others |
|---------|---------|--------|
| **Protocol-level composition** | `fai-manifest.json` wires 9 primitive types | Framework-specific, non-portable |
| **WAF alignment** | Every primitive maps to 6 Well-Architected pillars | Ad hoc or missing |
| **100 solution plays** | Complete, deployable architectures with IaC | Samples or templates |
| **Quality gates** | Guardrails enforced at the protocol level | Manual or per-framework |
| **Multi-channel distribution** | npm, PyPI, Docker, VS Code, MCP, CLI | Single-channel |

## The FROOT Framework

**FROOT** = **F**oundations · **R**easoning · **O**rchestration · **O**perations · **T**ransformation

| Layer | What You Learn |
|:-----:|----------------|
| **F** | Tokens, models, glossary, Agentic OS |
| **R** | Prompts, RAG, grounding, deterministic AI |
| **O** | Semantic Kernel, agents, MCP, tools |
| **O** | Azure AI Foundry, GPU infra, Copilot ecosystem |
| **T** | Fine-tuning, responsible AI, production patterns |

## Next Steps

- **[Quick Start](./quick-start)** — zero to running in 5 minutes
- **[Installation](./installation)** — all distribution channels
- **[Your First Solution Play](./first-play)** — build and deploy Play 01
- **[FAI Protocol](../concepts/fai-protocol)** — deep-dive into the wiring spec
- **[Primitives](../concepts/primitives)** — the 6 building block types
