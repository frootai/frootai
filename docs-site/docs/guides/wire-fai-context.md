---
sidebar_position: 9
title: Wire FAI Context
description: Connect standalone primitives to the FAI Protocol using fai-manifest.json and fai-context.json — the wiring layer that makes AI primitives context-aware.
---

# Wire FAI Context

Connect standalone primitives (agents, skills, instructions) to FROOT knowledge modules, WAF pillars, and solution plays via the FAI Protocol wiring layer.

## Manifest vs. Context

| Aspect | `fai-manifest.json` | `fai-context.json` |
|--------|---------------------|---------------------|
| **Level** | Solution play (top-level) | Individual primitive |
| **Location** | `solution-plays/NN-name/` | Next to any agent, instruction, or skill |
| **Purpose** | Wire ALL primitives for a play | Declare context for ONE primitive |
| **Analogy** | Docker Compose (full stack) | Single Dockerfile (one service) |
| **Required** | Yes, for every play | No, optional for standalone primitives |

:::tip Rule of Thumb
Building a **solution play**? → Create `fai-manifest.json`.  
Building a **standalone primitive** that needs context? → Create `fai-context.json`.
:::

## Creating fai-context.json

Place the context file in a subfolder named after the primitive:

```
agents/
  fai-rag-architect.agent.md       # The agent itself
  fai-rag-architect/
    fai-context.json                # Context for this agent
```

```json title="agents/fai-rag-architect/fai-context.json"
{
  "assumes": [
    "R2-RAG-Architecture",
    "O3-MCP-Tools-Functions",
    "T2-Responsible-AI"
  ],
  "waf": [
    "security",
    "reliability",
    "cost-optimization"
  ],
  "compatiblePlays": [
    "01-enterprise-rag",
    "21-agentic-rag"
  ],
  "evaluation": {
    "groundedness": 0.95,
    "coherence": 0.90
  }
}
```

## The `assumes` Field

Declares which FROOT knowledge modules your primitive needs:

| Series | ID | Module Name |
|--------|----|-------------|
| Foundations | `F1` | GenAI Foundations |
| | `F2` | LLM Selection |
| | `F3` | AI Glossary |
| Reasoning | `R1` | Prompt Patterns |
| | `R2` | RAG Architecture |
| | `R3` | Deterministic AI |
| Orchestration | `O1` | Semantic Kernel |
| | `O2` | Agent Coding |
| | `O3` | MCP Tools |
| | `O5` | GPU Infrastructure |
| Transformation | `T1` | Fine-Tuning + MLOps |
| | `T2` | Responsible AI |
| | `T3` | Production Deploy |

## Creating fai-manifest.json

Top-level wiring for solution plays:

```json title="solution-plays/01-enterprise-rag/fai-manifest.json"
{
  "play": "01-enterprise-rag",
  "version": "2.0.0",
  "context": {
    "knowledge": ["R2-RAG-Architecture", "R1-Prompt-Patterns"],
    "waf": ["security", "reliability", "cost-optimization"],
    "scope": "Enterprise RAG with Azure AI Search and GPT-4o"
  },
  "primitives": {
    "agents": ["../../agents/fai-rag-architect.agent.md"],
    "instructions": ["../../instructions/python-waf.instructions.md"],
    "skills": ["../../skills/fai-build-genai-rag/"],
    "hooks": ["../../hooks/fai-secrets-scanner/"],
    "guardrails": {
      "groundedness": 0.95,
      "coherence": 0.90,
      "safety": 0.99
    }
  },
  "infrastructure": {
    "bicep": "./infra/main.bicep"
  }
}
```

## Context Resolution Chain

```
1. Read fai-manifest.json
   ├── Load context.knowledge[] → FROOT modules
   ├── Load context.waf[] → WAF pillar rules
2. Resolve each primitive reference
   ├── Check for fai-context.json → merge knowledge + waf
   └── Verify compatiblePlays includes this play
3. Apply guardrails from manifest
4. Report: all primitives wired, modules loaded, pillars enforced
```

**Conflict resolution:** Knowledge modules and WAF pillars are **unioned**. Guardrails — **manifest wins**.

## Validation

```bash
# Validate all primitives
npm run validate:primitives

# Load play in FAI Engine
node engine/index.js solution-plays/01-enterprise-rag/fai-manifest.json --status
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "0 modules loaded" | Add FROOT module IDs to `context.knowledge` |
| "Primitive not found" | Paths are relative to manifest location |
| Context file ignored | Must be in subfolder named after the primitive |
| JSON parse error | Validate: `node -e "require('./path/file.json')"` |

## See Also

- [FAI Protocol](/docs/concepts/fai-protocol) — full protocol specification
- [Primitives Overview](/docs/concepts/primitives) — all 6 primitive types
- [Create an Agent](/docs/guides/create-agent) — agents with context
