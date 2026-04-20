---
sidebar_position: 2
title: Primitives
description: FrootAI's 6 primitive types — agents, instructions, skills, hooks, plugins, and workflows — the building blocks that compose into production AI systems.
---

# Primitives

Primitives are the building blocks of every FrootAI solution. There are **6 primitive types**, each serving a distinct purpose. Every primitive works **standalone** and **auto-wires** when placed inside a solution play via the [FAI Protocol](./fai-protocol).

## The 6 Primitive Types

| Type | File Format | Count | Purpose |
|------|------------|:-----:|---------|
| **Agents** | `.agent.md` | 238 | AI personalities with tools, model preferences, and WAF alignment |
| **Instructions** | `.instructions.md` | 176 | Auto-applied coding standards scoped by file glob patterns |
| **Skills** | `SKILL.md` folder | 322 | Multi-step procedures the agent can execute |
| **Hooks** | `hooks.json` | 10 | Event-driven guardrails triggered by lifecycle events |
| **Plugins** | `plugin.json` | 77 | Themed bundles of agents + skills + hooks |
| **Workflows** | `.yml` | 13 | Multi-agent orchestration pipelines |

## Agents

Agents are AI personalities defined in `.agent.md` files with YAML frontmatter. Each agent declares its description, tools, preferred models, WAF alignment, and compatible plays.

```markdown title="agents/fai-rag-architect.agent.md"
---
description: "RAG pipeline design — chunking, indexing, retrieval, reranking"
tools: ["codebase", "terminal"]
model: ["gpt-4o", "gpt-4o-mini"]
waf: ["security", "reliability"]
plays: ["01-enterprise-rag", "21-agentic-rag"]
---

# FAI RAG Architect

You are the RAG Architect agent. Design retrieval-augmented generation
pipelines with optimal chunking strategies, hybrid search, and reranking.
Always cite the WAF pillar when making architecture decisions.
```

:::info
Every solution play ships with a **builder → reviewer → tuner** agent triad for the build-review-tune workflow.
:::

## Instructions

Instructions are auto-applied coding standards in `.instructions.md` files. The `applyTo` glob pattern determines which files the instruction activates for.

```markdown title="instructions/waf-security.instructions.md"
---
description: "Security best practices from Azure Well-Architected Framework"
applyTo: "**/*.{ts,js,py,bicep,json,yaml,yml}"
waf: ["security"]
---

# Security — Azure Well-Architected Framework

## Identity & Access
- NEVER hardcode secrets, API keys, or connection strings
- Use Azure Managed Identity for service-to-service auth
- Use Azure Key Vault for secrets management
```

## Skills

Skills are self-contained, multi-step procedures packaged in folders with a `SKILL.md` file. They provide step-by-step logic that an agent can follow to accomplish complex tasks.

```markdown title="skills/fai-play-initializer/SKILL.md"
---
name: fai-play-initializer
description: "Scaffold a new FrootAI solution play with full FAI Protocol structure"
---

# FAI Play Initializer

## Steps

1. Pick a play number and kebab-case name
2. Scaffold the directory tree (DevKit, TuneKit, SpecKit, Infra)
3. Create fai-manifest.json with context and primitives
4. Create TuneKit config files (openai.json, guardrails.json)
5. Create DevKit agent (builder.agent.md)
6. Validate with `npm run validate:primitives`
```

:::tip
Skills must be **150+ lines** with detailed step-by-step logic. Think runbook, not summary.
:::

## Hooks

Hooks are event-driven scripts triggered by lifecycle events. They are defined in a `hooks.json` file inside a named folder.

```json title="hooks/frootai-secrets-scanner/hooks.json"
{
  "version": 1,
  "hooks": [
    {
      "event": "SessionStart",
      "steps": [
        {
          "type": "shell",
          "command": "bash ${__dirname}/scan-secrets.sh"
        }
      ]
    }
  ]
}
```

Available lifecycle events:

| Event | When It Fires |
|-------|--------------|
| `SessionStart` | Agent session begins |
| `UserPromptSubmit` | User sends a message |
| `PreToolUse` | Before a tool is invoked |
| `PostToolUse` | After a tool completes |
| `PreCompact` | Before context compaction |
| `SubagentStart` | Before a sub-agent launches |
| `SubagentStop` | After a sub-agent completes |
| `Stop` | Agent session ends |

:::warning
**Never use `PreToolUse` hooks** — they spawn a process per tool call, adding ~5 seconds of delay each time. Use `SessionStart` for validation and scanning.
:::

## Plugins

Plugins are themed bundles that package agents, skills, and hooks into a single installable unit. Each plugin has a `plugin.json` manifest.

```json title="plugins/enterprise-rag/plugin.json"
{
  "name": "enterprise-rag",
  "description": "Complete RAG pipeline with security hooks and evaluation",
  "version": "1.0.0",
  "author": { "name": "FrootAI" },
  "license": "MIT",
  "agents": ["./.github/agents/rag-builder.agent.md"],
  "skills": ["./.github/skills/rag-indexer/"],
  "hooks": ["../../hooks/frootai-secrets-scanner/"],
  "plays": ["01-enterprise-rag"]
}
```

## Workflows

Workflows are multi-agent orchestration pipelines defined in `.yml` files. They coordinate multiple agents to accomplish complex tasks.

```yaml title="workflows/safe-outputs.yml"
name: safe-outputs
steps:
  - agent: builder
    task: "Generate the solution code"
  - agent: reviewer
    task: "Review for security and quality"
  - agent: tuner
    task: "Validate config and thresholds"
```

## How Primitives Compose

Primitives follow a **standalone → auto-wire** model:

1. **Standalone**: Every primitive works independently. An agent in `agents/` can be referenced directly by any AI coding assistant.

2. **Auto-wire**: When a primitive is referenced in a play's `fai-manifest.json`, the FAI Engine injects shared context (knowledge modules + WAF pillars) into the primitive automatically.

```
Standalone Agent                    Inside a Play
┌─────────────┐                 ┌──────────────────┐
│ agent.md    │                 │ fai-manifest.json │
│  - tools    │    ──wired──▸   │   context:        │
│  - model    │                 │     knowledge ──▸ agent receives
│  - waf      │                 │     waf ──▸        domain knowledge
└─────────────┘                 └──────────────────┘
```

## WAF Alignment

Every primitive can declare which [Well-Architected Framework](./well-architected) pillars it supports via a `waf` array in its frontmatter. This enables automated governance — the FAI Engine verifies that a play's declared WAF pillars are covered by its primitives.

## Validation

Validate all primitives in the repository:

```bash
npm run validate:primitives
```

This checks:
- File naming follows lowercase-hyphen convention
- YAML frontmatter has required fields per type
- Skill names match their parent folder
- Hook events are valid lifecycle events
- Plugin manifests are complete and valid

## Next Steps

- **[FAI Protocol](./fai-protocol)** — how primitives are wired together
- **[Solution Plays](./solution-plays)** — see primitives in action
- **[Naming Conventions](../contributing/naming-conventions)** — file naming rules
- **[How to Contribute](../contributing/how-to-contribute)** — add your own primitives
