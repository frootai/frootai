# FrootAI — Agents (238)

> 201 standalone role-based agents that work individually AND wire into solution plays via the FAI Layer.

## What Are FrootAI Agents?

FrootAI agents are `.agent.md` files — each describes an AI persona with specific expertise, tools, and guidelines. Unlike standalone agents elsewhere, FrootAI agents are **context-aware**: they reference knowledge modules, respect WAF guardrails, and output play-compatible artifacts.

## Agent Schema

Every agent uses YAML frontmatter:

```yaml
---
description: "1-2 sentence purpose statement"    # Required
name: "Human-readable display name"               # Optional
model: GPT-4.1                                     # Optional (default: provider default)
tools: ['tool1', 'tool2']                          # Optional
---
```

Body content follows the pattern:
1. **Persona/expertise declaration**
2. **Knowledge areas** (bullet points)
3. **Guidelines/rules** (best practices, anti-patterns)
4. **Response format**
5. **Code examples** (good vs bad)

## Three-Tier Hierarchy

| Tier | Focus | Lines | Example |
|------|-------|-------|---------|
| Specialist | Deep domain (Azure, RAG, MCP) | 40-50 | `fai-rag-architect.agent.md` |
| Role-Based | Architecture, security, testing | 100-200 | `fai-security-reviewer.agent.md` |
| Orchestration | Planning, multi-agent, lifecycle | 200-500 | `fai-play-dispatcher.agent.md` |

## Naming Convention

`kebab-case.agent.md` — always lowercase, hyphen-separated.

Prefix with `fai-` for official agents. Community agents use descriptive names without prefix.

## FAI Layer Integration

Each agent can include a companion `fai-context.json`:

```json
{
  "assumes": ["R2-RAG-Architecture"],
  "waf": ["security", "reliability"],
  "compatible-plays": ["01", "09", "21"]
}
```

This makes the agent aware of which knowledge modules, WAF pillars, and solution plays it integrates with — even when used standalone.

## Validation

```bash
node scripts/validate-primitives.js agents/
```
