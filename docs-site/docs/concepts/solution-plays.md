---
sidebar_position: 3
title: Solution Plays
description: Solution plays are pre-built, deployable AI architectures — the unit of work in FrootAI. 100 plays covering RAG, agents, infrastructure, security, and more.
---

# Solution Plays

A solution play is a **complete, deployable AI solution** — the unit of work in FrootAI. Each play bundles primitives, infrastructure, evaluation pipelines, and configuration into a self-contained package wired through the [FAI Protocol](./fai-protocol).

## What's in a Play?

Every play ships with four toolkits plus a protocol manifest:

| Toolkit | Folder | Contents |
|---------|--------|----------|
| **DevKit** | `.github/` | Agents, instructions, prompts, skills, hooks — the 7 primitives |
| **TuneKit** | `config/` | Model parameters, evaluation thresholds, guardrail configs |
| **SpecKit** | `spec/` | ADRs, architecture diagrams, implementation notes |
| **Infrastructure** | `infra/` | Bicep templates for Azure resources |
| **FAI Manifest** | `fai-manifest.json` | Protocol wiring — connects everything above |

**DevKit** gives the AI coding agent context. **TuneKit** controls quality gates. **SpecKit** captures design decisions. The manifest binds them all.

```
solution-plays/01-enterprise-rag/
├── .github/                    # DevKit
│   ├── copilot-instructions.md
│   ├── agents/                 # builder, reviewer, tuner
│   ├── instructions/           # coding standards
│   ├── skills/                 # step-by-step procedures
│   └── hooks/                  # security guardrails
├── config/                     # TuneKit
│   ├── openai.json
│   └── guardrails.json
├── spec/                       # SpecKit
├── infra/                      # Azure Bicep
│   ├── main.bicep
│   └── parameters.json
├── evaluation/                 # Quality pipeline
│   └── test-set.jsonl
└── fai-manifest.json           # FAI Protocol
```

## Play Categories

### 🔍 RAG & Search

| # | Play | What It Deploys |
|:-:|------|----------------|
| 01 | **Enterprise RAG Q&A** | AI Search + OpenAI + Container App |
| 09 | **AI Search Portal** | Enterprise search with facets |
| 21 | **Agentic RAG** | Autonomous retrieval + multi-source |
| 26 | **Semantic Search** | Vector + hybrid + reranking |
| 28 | **Knowledge Graph RAG** | Cosmos DB Gremlin + entities |

### 🤖 Agents & Multi-Agent

| # | Play | What It Deploys |
|:-:|------|----------------|
| 03 | **Deterministic Agent** | Reliable agent with guardrails + eval |
| 07 | **Multi-Agent Service** | Orchestrated agent collaboration |
| 22 | **Multi-Agent Swarm** | Distributed teams + supervisor |
| 23 | **Browser Automation** | Playwright MCP + vision |
| 42 | **Computer Use Agent** | Vision-based desktop automation |

### 🏗️ Infrastructure & Platform

| # | Play | What It Deploys |
|:-:|------|----------------|
| 02 | **AI Landing Zone** | VNet + Private Endpoints + RBAC + GPU |
| 11 | **AI Landing Zone Adv.** | Multi-region + DR + compliance |
| 12 | **Model Serving on AKS** | GPU clusters + model endpoints |
| 14 | **Cost-Optimized Gateway** | Smart routing + token budgets |
| 29 | **MCP Gateway** | Proxy + rate limiting + discovery |

### 🔒 Security & Compliance

| # | Play | What It Deploys |
|:-:|------|----------------|
| 10 | **Content Moderation** | Safety filters + content classification |
| 30 | **AI Security Hardening** | OWASP LLM Top 10 + jailbreak defense |
| 35 | **AI Compliance Engine** | GDPR, HIPAA, SOC 2, EU AI Act |
| 41 | **AI Red Teaming** | Adversarial testing + safety scoring |

### 🎙️ Voice & Speech

| # | Play | What It Deploys |
|:-:|------|----------------|
| 04 | **Call Center Voice AI** | Real-time speech + sentiment analysis |
| 33 | **Voice AI Agent** | Speech-to-text + conversational AI |

### 📄 Document Processing

| # | Play | What It Deploys |
|:-:|------|----------------|
| 06 | **Document Intelligence** | PDF/image extraction pipeline |
| 15 | **Multi-Modal Doc Proc** | Images + tables + handwriting |
| 38 | **Document Understanding v2** | Multi-page PDF + entity linking |

:::info
Browse all 100 plays at [frootai.dev/solution-plays](https://frootai.dev/solution-plays) or use the [Configurator](https://frootai.dev/configurator) to find the right play for your use case.
:::

## How to Choose a Play

1. **By use case** — What are you building? RAG chatbot → Play 01. Landing zone → Play 02.
2. **By complexity** — Plays range from Low (single service) to High (multi-region, multi-agent).
3. **By Azure services** — Filter by the services you already use or want to adopt.
4. **By WAF pillar** — Need security hardening? Filter by the `security` pillar.

Use the interactive [Configurator](https://frootai.dev/configurator) for a guided recommendation.

## Working with Plays

### Scaffolding

```bash
# Initialize a play's DevKit
npx frootai init-devkit 01

# Validate all primitives
npm run validate:primitives
```

### Deploying

```bash
# Preview Azure deployment
az deployment group what-if \
  --resource-group rg-frootai-01 \
  --template-file infra/main.bicep

# Deploy
az deployment group create \
  --resource-group rg-frootai-01 \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json
```

### Evaluating

```bash
# Load play and verify wiring
node engine/index.js fai-manifest.json --status

# Run quality gate evaluation
node engine/index.js fai-manifest.json --eval
```

## Creating Your Own Play

See the [cookbook recipe: Initialize a Solution Play](https://github.com/frootai/frootai/blob/main/cookbook/01-init-play.md) or follow [Your First Solution Play](../getting-started/first-play) for a guided tutorial.

## Next Steps

- **[Your First Solution Play](../getting-started/first-play)** — build and deploy Play 01
- **[FAI Protocol](./fai-protocol)** — how plays are wired via manifests
- **[Primitives](./primitives)** — the building blocks inside every play
- **[How to Contribute](../contributing/how-to-contribute)** — create and share your own play
