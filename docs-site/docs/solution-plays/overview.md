---
sidebar_position: 1
title: "Solution Plays Overview"
description: "What are FrootAI Solution Plays — pre-built, tested, production-ready AI solution blueprints with DevKit, TuneKit, SpecKit, and infrastructure. Browse, initialize, and deploy."
---

# Solution Plays Overview

Solution Plays are **pre-built, tested, production-ready AI solution blueprints**. Each play provides everything you need to go from zero to deployed: Copilot agents, configuration files, infrastructure-as-code, evaluation pipelines, and documentation — all wired together by the FAI Protocol.

:::info Not Boilerplate
Plays aren't starter templates. They're opinionated, WAF-aligned implementations that encode the lessons from hundreds of enterprise AI deployments. You customize the `config/` files; the architecture and safety patterns are built in.
:::

## What's in a Play?

Every solution play follows the **4-kit structure**:

```
solution-play-NN/
├── .github/                          ← DevKit: Copilot brain
│   ├── copilot-instructions.md       ←   under 150 lines, domain knowledge
│   ├── agents/                       ←   builder / reviewer / tuner
│   │   ├── builder.agent.md
│   │   ├── reviewer.agent.md
│   │   └── tuner.agent.md
│   ├── instructions/                 ←   WAF-aligned guidance
│   ├── skills/                       ←   150+ line action skills
│   └── hooks/                        ←   SessionStart guardrails
├── config/                           ← TuneKit: customer-tunable params
│   ├── openai.json                   ←   model, temperature, max_tokens
│   └── guardrails.json               ←   safety thresholds
├── infra/                            ← Infra: Azure Bicep (AVM modules)
│   ├── main.bicep
│   └── modules/
├── evaluation/                       ← Eval: quality pipeline
│   └── eval-config.json
└── spec/                             ← SpecKit: metadata + docs
    └── fai-manifest.json             ←   FAI Protocol wiring
```

| Kit | Purpose | Who Edits |
|-----|---------|-----------|
| **DevKit** | Copilot agents, instructions, skills, hooks | Platform team |
| **TuneKit** | AI parameters, guardrails, thresholds | AI team / customer |
| **SpecKit** | Play metadata, documentation, wiring | Auto-generated |
| **Infra** | Azure infrastructure (Bicep + AVM) | Platform / DevOps |

## Categories

| Category | Plays | Description |
|----------|-------|-------------|
| **RAG** | 01, 09, 21 | Retrieval-Augmented Generation patterns |
| **Agents** | 03, 07, 22, 23 | Single-agent to swarm orchestration |
| **Infrastructure** | 02, 11, 14 | Landing zones, gateways, platforms |
| **Security** | 10 | Content moderation, safety pipelines |
| **Voice** | 04 | Speech-to-text, LLM, text-to-speech |
| **Document** | 06, 15 | OCR, extraction, multi-modal processing |
| **Copilot** | 08, 16 | Copilot Studio bots, Teams extensions |
| **Observability** | 17 | AI monitoring, metrics, dashboards |
| **Fine-Tuning** | 13 | LoRA/QLoRA workflows |
| **Edge** | 19 | On-device AI, ONNX, edge deployment |
| **Real-Time** | 20 | Streaming analytics, event-driven AI |

## Featured Plays

| # | Name | Category | Complexity | Key Azure Services |
|---|------|----------|------------|-------------------|
| **01** | Enterprise RAG | RAG | Intermediate | OpenAI, AI Search, Blob Storage |
| **02** | AI Landing Zone | Infrastructure | Intermediate | VNet, Private Endpoints, Key Vault |
| **03** | Deterministic Agent | Agents | Intermediate | OpenAI (temp=0), Structured Output |
| **04** | Call Center Voice AI | Voice | Advanced | Speech Services, OpenAI, Event Hub |
| **05** | IT Ticket Resolution | Agents | Intermediate | OpenAI, ServiceNow, Logic Apps |
| **06** | Document Intelligence | Document | Intermediate | Document Intelligence, OpenAI |
| **07** | Multi-Agent Service | Agents | Advanced | OpenAI, Semantic Kernel |
| **08** | Copilot Studio Bot | Copilot | Beginner | Copilot Studio, Dataverse |
| **09** | AI Search Portal | RAG | Intermediate | AI Search, OpenAI, App Service |
| **10** | Content Moderation | Security | Intermediate | Content Safety, OpenAI |

See the full [Play Catalog](./catalog.md) for all 23+ plays.

## How to Browse

| Method | Command / Link |
|--------|---------------|
| **Website** | [frootai.dev/solution-plays](https://frootai.dev/solution-plays) |
| **VS Code** | Install FrootAI extension → Solution Plays panel |
| **CLI** | `npx frootai list plays` |
| **MCP Server** | `npx frootai-mcp@latest` → `list_community_plays` tool |

## How to Initialize

```bash
# Scaffold any play by number + name
npx frootai scaffold 01-enterprise-rag

# Scaffold with specific options
npx frootai scaffold 02-ai-landing-zone --region eastus2

# List available plays
npx frootai list plays
```

After scaffolding:
1. Review `.github/copilot-instructions.md` for domain context
2. Customize `config/openai.json` and `config/guardrails.json`
3. Deploy infrastructure with `az deployment group create --template-file infra/main.bicep`
4. Use `@builder` agent in Copilot Chat to implement

## The Agent Triad

Every play includes three specialized agents that follow the **Build → Review → Tune** workflow:

| Agent | Role | Model | Focus |
|-------|------|-------|-------|
| **Builder** | Implements the solution | GPT-4o | Code generation, architecture |
| **Reviewer** | Reviews for quality and security | GPT-4o-mini | OWASP, WAF compliance, bugs |
| **Tuner** | Optimizes for production | GPT-4o-mini | Config validation, cost, performance |

```
@builder → implements code and architecture
    ↓
@reviewer → checks security, quality, WAF alignment
    ↓
@tuner → validates config, thresholds, production readiness
```

## WAF Alignment

All plays are aligned to the **6 Well-Architected Framework pillars**:

- **Reliability** — retry, circuit breaker, health checks, fallbacks
- **Security** — Managed Identity, Key Vault, RBAC, private endpoints
- **Cost Optimization** — model routing, token budgets, right-sizing
- **Operational Excellence** — CI/CD, IaC, observability, incident response
- **Performance Efficiency** — caching, streaming, async, model routing
- **Responsible AI** — content safety, groundedness, fairness, transparency

For detailed WAF patterns, see [T3: Production Patterns](../learning/t3-production-patterns.md) and [T2: Responsible AI](../learning/t2-responsible-ai.md).

## Next Steps

- Browse the full [Play Catalog](./catalog.md)
- Try [Workshop: Build a RAG Pipeline](../workshops/build-rag-pipeline.md) (Play 01)
- Try [Workshop: AI Landing Zone](../workshops/ai-landing-zone.md) (Play 02)
- Learn the foundations in the [Learning Hub](../learning/f1-genai-foundations.md)
