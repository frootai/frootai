# AGENTS.md — FrootAI Cross-Platform Agent Discovery

> **Standard**: This file follows the [AGENTS.md specification](https://github.com/anthropics/agent-specification) for cross-platform agent discovery.
> Any AI coding assistant (Copilot, Claude, Cursor, Windsurf, Cody, etc.) can read this file to discover available agents.

## Overview

FrootAI provides **238 specialized AI agents** organized by domain. Each agent is a `.agent.md` file with YAML frontmatter defining its description, tools, model preferences, and WAF (Well-Architected Framework) alignment.

**Browse the full catalog**: [frootai.dev/primitives/agents](https://frootai.dev/primitives/agents)

## Agent Architecture

```
agents/
├── fai-rag-architect.agent.md              # RAG specialist
├── fai-azure-ai-search-expert.agent.md     # AI Search expert
├── fai-security-reviewer.agent.md          # Security reviewer
├── fai-play-01-builder.agent.md            # Enterprise RAG Builder
├── ... (238 agents)
└── fai-rag-architect/fai-context.json      # FAI Protocol context
```

Each agent follows this structure:
```yaml
---
description: "One-line description of what this agent does"
tools: ["codebase", "terminal"]              # Tools the agent can use
model: ["gpt-4o", "gpt-4o-mini"]             # Preferred models (array)
waf: ["security", "reliability"]             # WAF pillar alignment
plays: ["01-enterprise-rag", "21-agentic-rag"] # Compatible solution plays
---

# Agent Name

Detailed instructions for the agent's behavior, expertise, and constraints.
```

## Agent Categories

### 🔍 RAG & Search (15+ agents)
| Agent | Description | Compatible Plays |
|-------|-------------|-----------------|
| `fai-rag-architect` | RAG pipeline design — chunking, indexing, retrieval, reranking | 01, 21, 28 |
| `fai-azure-ai-search-expert` | AI Search configuration, semantic ranking, hybrid search | 01, 09, 26 |
| `fai-rag-expert` | End-to-end RAG implementation, grounding, citation pipelines | 01, 21 |
| `fai-graphrag-expert` | Graph-based RAG — entity extraction, relationship mapping | 28 |
| `fai-embedding-expert` | Embedding model selection, dimensionality, batch processing | 01, 21, 26 |

### 🤖 Agent & Multi-Agent (15+ agents)
| Agent | Description | Compatible Plays |
|-------|-------------|-----------------|
| `fai-autogen-expert` | AutoGen ConversableAgent, GroupChat, code execution sandboxing | 07, 22, 51 |
| `fai-deterministic-expert` | Zero-temperature, seed pinning, structured output, guardrails | 03 |
| `fai-swarm-supervisor` | Distributed agent teams — topology, conflict resolution | 22 |
| `fai-crewai-expert` | CrewAI task delegation, agent specialization, crew orchestration | 07 |
| `fai-langchain-expert` | LCEL chains, agents with tools, LangSmith tracing | 01, 21 |
| `fai-dspy-expert` | DSPy signatures, optimizers, compiled prompt pipelines | 18, 03 |

### 🏗️ Infrastructure & Platform (20+ agents)
| Agent | Description | Compatible Plays |
|-------|-------------|-----------------|
| `fai-architect` | Solution architecture — Azure services, patterns, WAF | All plays |
| `fai-landing-zone` | Hub-spoke networking, private endpoints, governance | 02, 11 |
| `fai-azure-openai-expert` | Model deployment, PTU vs PAYG, content filtering, structured output | 01, 03, 14 |
| `fai-azure-aks-expert` | GPU node pools, vLLM serving, KEDA autoscaling | 02, 11, 12 |
| `fai-cost-optimizer` | FinOps — model routing, caching, right-sizing | 14, 52 |
| `fai-capacity-planner` | PTU allocation, GPU sizing, cost forecasting | 02, 12, 14 |

### 🔒 Security & Compliance (15+ agents)
| Agent | Description | Compatible Plays |
|-------|-------------|-----------------|
| `fai-security-reviewer` | OWASP LLM Top 10, prompt injection defense | All plays |
| `fai-compliance-expert` | GDPR, HIPAA, SOC 2, EU AI Act | 35, 70, 99 |
| `fai-responsible-ai-reviewer` | Fairness, bias detection, transparency | 60 |
| `fai-content-safety-expert` | Content moderation, severity scoring, Prompt Shields | 10, 61 |
| `fai-red-team-expert` | Adversarial testing, jailbreak simulation | 41 |

### 🎙️ Voice & Speech (5+ agents)
| Agent | Description | Compatible Plays |
|-------|-------------|-----------------|
| `fai-play-04-builder` | Call Center Voice AI — STT→LLM→TTS streaming pipeline | 04 |
| `fai-streaming-expert` | SSE, WebSocket, Event Hub streaming patterns | 04, 20 |

### 📄 Document Processing (10+ agents)
| Agent | Description | Compatible Plays |
|-------|-------------|-----------------|
| `fai-play-06-builder` | Azure Document Intelligence OCR, multi-format extraction | 06 |
| `fai-play-15-builder` | GPT-4o Vision multi-modal document analysis | 15 |

### 🏥 Industry Specialists (20+ agents)
| Agent | Description | Compatible Plays |
|-------|-------------|-----------------|
| `fai-salesforce-expert` | Einstein AI, Apex, SOQL | — |
| `fai-sap-expert` | SAP AI Core, CAP, BTP integration | — |
| `fai-servicenow-expert` | ITSM workflows, MCP connector | 05 |

### ⚙️ DevOps & Tooling (15+ agents)
| Agent | Description | Compatible Plays |
|-------|-------------|-----------------|
| `fai-devops-expert` | CI/CD, incident response, deployment risk | 37 |
| `fai-test-generator` | Test generation, mutation testing, coverage | 32 |
| `fai-code-reviewer` | PR review, OWASP scanning, style checks | 24 |
| `fai-azure-monitor-expert` | KQL queries, dashboards, AI telemetry | 17 |
| `fai-prompt-engineer` | Prompt versioning, A/B testing, optimization | 18 |
| `fai-github-actions-expert` | Reusable workflows, OIDC, matrix strategies | All plays |

### 🧠 ML & Model Management (10+ agents)
| Agent | Description | Compatible Plays |
|-------|-------------|-----------------|
| `fai-fine-tuning-expert` | LoRA, QLoRA, JSONL data prep, evaluation | 13 |
| `fai-azure-ai-foundry-expert` | Hub/Project model, Prompt Flow, evaluation pipelines | 01, 13 |
| `fai-mlflow-expert` | Experiment tracking, model registry, deployment | 13 |

### 🎨 Creative & Media (10+ agents)
| Agent | Description | Compatible Plays |
|-------|-------------|-----------------|
| `fai-i18n-expert` | Multilingual, ICU, locale management | 57 |
| `fai-technical-writer` | Diátaxis docs, API reference, architecture docs | All plays |

### 🔌 Platform Agents (10+ agents)
| Agent | Description | Compatible Plays |
|-------|-------------|-----------------|
| `fai-copilot-ecosystem-expert` | Copilot extensions, declarative agents, M365 | 08, 16, 40 |
| `fai-mcp-expert` | MCP protocol, tool design, server implementation | 29 |
| `fai-semantic-kernel-expert` | SK plugins, planners, orchestration | All plays |
| `fai-typescript-mcp-expert` | TypeScript MCP server with @modelcontextprotocol/sdk | 29 |
| `fai-python-mcp-expert` | Python MCP server with FastMCP decorators | 29 |
| `fai-csharp-mcp-expert` | C# MCP server with ModelContextProtocol NuGet | 29 |

### 🎯 Solution Play Agents (69 agents)

Each of the 23 solution plays has a dedicated builder/reviewer/tuner agent triad:

| Play | Builder | Reviewer | Tuner |
|------|---------|----------|-------|
| 01 — Enterprise RAG | FAI Enterprise RAG Builder | FAI Enterprise RAG Reviewer | FAI Enterprise RAG Tuner |
| 02 — AI Landing Zone | FAI AI Landing Zone Builder | FAI AI Landing Zone Reviewer | FAI AI Landing Zone Tuner |
| 03 — Deterministic Agent | FAI Deterministic Agent Builder | FAI Deterministic Agent Reviewer | FAI Deterministic Agent Tuner |
| 04 — Call Center Voice AI | FAI Call Center Voice AI Builder | FAI Call Center Voice AI Reviewer | FAI Call Center Voice AI Tuner |
| 05 — IT Ticket Resolution | FAI IT Ticket Resolution Builder | FAI IT Ticket Resolution Reviewer | FAI IT Ticket Resolution Tuner |
| 06 — Document Intelligence | FAI Document Intelligence Builder | FAI Document Intelligence Reviewer | FAI Document Intelligence Tuner |
| 07 — Multi-Agent Service | FAI Multi-Agent Service Builder | FAI Multi-Agent Service Reviewer | FAI Multi-Agent Service Tuner |
| 08 — Copilot Studio Bot | FAI Copilot Studio Bot Builder | FAI Copilot Studio Bot Reviewer | FAI Copilot Studio Bot Tuner |
| 09 — AI Search Portal | FAI AI Search Portal Builder | FAI AI Search Portal Reviewer | FAI AI Search Portal Tuner |
| 10 — Content Moderation | FAI Content Moderation Builder | FAI Content Moderation Reviewer | FAI Content Moderation Tuner |
| 11 — AI Landing Zone Adv. | FAI AI Landing Zone Advanced Builder | FAI AI Landing Zone Advanced Reviewer | FAI AI Landing Zone Advanced Tuner |
| 12 — Model Serving AKS | FAI Model Serving AKS Builder | FAI Model Serving AKS Reviewer | FAI Model Serving AKS Tuner |
| 13 — Fine-Tuning Workflow | FAI Fine-Tuning Workflow Builder | FAI Fine-Tuning Workflow Reviewer | FAI Fine-Tuning Workflow Tuner |
| 14 — Cost-Optimized Gateway | FAI Cost-Optimized AI Gateway Builder | FAI Cost-Optimized AI Gateway Reviewer | FAI Cost-Optimized AI Gateway Tuner |
| 15 — Document Processing | FAI Document Processing Builder | FAI Document Processing Reviewer | FAI Document Processing Tuner |
| 16 — Copilot Teams Ext. | FAI Copilot Teams Extension Builder | FAI Copilot Teams Extension Reviewer | FAI Copilot Teams Extension Tuner |
| 17 — AI Observability | FAI AI Observability Builder | FAI AI Observability Reviewer | FAI AI Observability Tuner |
| 18 — Prompt Optimization | FAI Prompt Optimization Builder | FAI Prompt Optimization Reviewer | FAI Prompt Optimization Tuner |
| 19 — Edge AI | FAI Edge AI Builder | FAI Edge AI Reviewer | FAI Edge AI Tuner |
| 20 — Real-Time Analytics | FAI Real-Time Analytics Builder | FAI Real-Time Analytics Reviewer | FAI Real-Time Analytics Tuner |
| 21 — Agentic RAG | FAI Agentic RAG Builder | FAI Agentic RAG Reviewer | FAI Agentic RAG Tuner |
| 22 — Swarm Orchestration | FAI Swarm Orchestration Builder | FAI Swarm Orchestration Reviewer | FAI Swarm Orchestration Tuner |
| 23 — Browser Agent | FAI Browser Agent Builder | FAI Browser Agent Reviewer | FAI Browser Agent Tuner |

Plus 2 utility agents: **FAI Play Dispatcher** (routes to correct play) and **FAI Play Lifecycle** (play management).

## How to Use

### In VS Code (with GitHub Copilot)
```
# Copilot automatically discovers agents from .agent.md files
# Reference an agent in Copilot Chat:
@workspace Which agent should I use for RAG?
```

### In a Solution Play
Agents are wired via `fai-manifest.json`:
```json
{
  "primitives": {
    "agents": ["./agent.md", "../../agents/fai-rag-architect.agent.md"]
  }
}
```

### Via MCP Server
```bash
npx frootai-mcp@latest  # 25 tools including agent_build, agent_review, agent_tune
```

### Via CLI
```bash
npx frootai primitives --type agents  # Browse all 238 agents
```

## Related Resources

- **Full Catalog**: [frootai.dev/primitives/agents](https://frootai.dev/primitives/agents)
- **Agent Patterns (L3)**: [frootai.dev/learning-hub/agent-patterns](https://frootai.dev/learning-hub/agent-patterns)
- **Primitive Primer (L2)**: [frootai.dev/learning-hub/primitive-primer](https://frootai.dev/learning-hub/primitive-primer)
- **FAI Protocol**: [frootai.dev/fai-protocol](https://frootai.dev/fai-protocol)
- **100 Solution Plays**: [frootai.dev/solution-plays](https://frootai.dev/solution-plays)
- **GitHub**: [github.com/frootai/frootai/tree/main/agents](https://github.com/frootai/frootai/tree/main/agents)
