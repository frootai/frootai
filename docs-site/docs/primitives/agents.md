---
sidebar_position: 1
title: Agents
description: Define AI personalities with tools, model preferences, and WAF alignment using .agent.md files with YAML frontmatter.
---

# Agents

Agents are **AI personalities** defined in `.agent.md` files. Each agent declares its domain expertise, available tools, preferred models, WAF alignment, and compatible solution plays. Agents are the interactive primitives of FrootAI — users invoke them in Copilot Chat for domain-specific assistance.

## File Structure

Every agent lives in the `agents/` directory (or `.github/agents/` inside a solution play) and follows this structure:

```markdown title="agents/fai-rag-architect.agent.md"
---
description: "RAG pipeline design — chunking, indexing, retrieval, reranking"
name: "FAI RAG Architect"
tools:
  - "codebase"
  - "terminal"
model: ["gpt-4o", "gpt-4o-mini"]
waf:
  - "security"
  - "reliability"
plays:
  - "01"
  - "21"
---

# FAI RAG Architect

You are a RAG pipeline specialist focused on Azure AI Search...
```

The file has two parts:
1. **YAML frontmatter** — metadata, tool configuration, WAF alignment
2. **Markdown body** — the system prompt defining the agent's behavior

## Frontmatter Fields

| Field | Required | Type | Validation |
|-------|----------|------|------------|
| `description` | ✅ | string | 10+ characters |
| `name` | No | string | Display name shown in Copilot Chat |
| `tools` | No | string[] | Valid tool IDs: `codebase`, `terminal`, `azure_development`, `github`, `fetch` |
| `model` | No | string[] | Preferred models in priority order |
| `waf` | No | string[] | Valid WAF pillar names |
| `plays` | No | string[] | 2-digit solution play numbers |

### Valid WAF Pillars

Use these exact values — validation rejects misspellings:

- `security`
- `reliability`
- `cost-optimization`
- `operational-excellence`
- `performance-efficiency`
- `responsible-ai`

## Builder → Reviewer → Tuner Triad

Each solution play has a dedicated agent triad that follows the build → review → tune workflow:

| Role | Naming Convention | Purpose |
|------|-------------------|---------|
| **Builder** | `fai-play-NN-builder` | Implements the solution play |
| **Reviewer** | `fai-play-NN-reviewer` | Reviews for security, WAF, quality |
| **Tuner** | `fai-play-NN-tuner` | Validates config and production readiness |

```markdown title="Example: Play 01 Builder Agent"
---
description: "Enterprise RAG implementation specialist — builds ingestion pipelines, retrieval APIs, and evaluation harnesses for Azure AI Search + GPT-4o."
tools: ["codebase", "terminal", "azure_development"]
waf: ["security", "reliability", "cost-optimization"]
plays: ["01"]
---

# FAI Enterprise RAG Builder

You implement enterprise RAG solutions on Azure...
```

:::tip Agent Handoffs
Use `@builder`, `@reviewer`, or `@tuner` in Copilot Chat to trigger the triad workflow. The builder creates, the reviewer validates, and the tuner optimizes for production.
:::

## Agent Categories

FrootAI provides 238+ agents organized by domain:

- **RAG & Search** — `fai-rag-architect`, `fai-azure-ai-search-expert`, `fai-embedding-expert`
- **Agent & Multi-Agent** — `fai-autogen-expert`, `fai-swarm-supervisor`, `fai-crewai-expert`
- **Infrastructure** — `fai-architect`, `fai-landing-zone`, `fai-azure-openai-expert`
- **Security & Compliance** — `fai-security-reviewer`, `fai-compliance-expert`, `fai-red-team-expert`
- **DevOps & Tooling** — `fai-devops-expert`, `fai-test-generator`, `fai-github-actions-expert`

## Referencing Agents in fai-manifest.json

Wire agents into a solution play via the manifest:

```json title="solution-plays/01-enterprise-rag/fai-manifest.json"
{
  "primitives": {
    "agents": [
      "../../agents/fai-rag-architect.agent.md",
      "./.github/agents/rag-builder.agent.md"
    ]
  }
}
```

## System Prompt Writing Guide

Structure your agent body in this order for maximum effectiveness:

1. **Opening paragraph** — who the agent is, in one clear sentence
2. **Core Expertise** — bullet list of specific knowledge areas (10–20 items)
3. **Your Approach** — how the agent thinks and works (numbered steps)
4. **Guidelines** — specific technical defaults and preferences
5. **Non-Negotiables** — hard rules prefixed with NEVER/ALWAYS
6. **Response Format** — how to structure outputs

:::warning One Expertise Per Agent
An agent should be "RAG architect" not "full-stack developer." Narrow expertise produces better responses. Use the triad pattern for broader coverage.
:::

## Naming Convention

| Pattern | Example | Use Case |
|---------|---------|----------|
| `fai-{domain}-expert` | `fai-azure-openai-expert` | Domain expert |
| `fai-play-{nn}-builder` | `fai-play-01-builder` | Play builder |
| `fai-{pillar}-reviewer` | `fai-security-reviewer` | WAF specialist |

All filenames must be **lowercase-hyphen** — no underscores or camelCase.

## Validation

```bash
npm run validate:primitives
```

This checks that every agent has:
- `description` with 10+ characters
- Valid `waf` pillar names
- Correct lowercase-hyphen filename

## See Also

- [Create an Agent Guide](/docs/guides/create-agent) — step-by-step tutorial
- [FAI Protocol](/docs/concepts/fai-protocol) — how agents wire into plays
- [Primitives Overview](/docs/concepts/primitives) — all 6 primitive types
