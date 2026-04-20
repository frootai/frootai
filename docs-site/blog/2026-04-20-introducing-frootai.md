---
slug: introducing-frootai
title: "Introducing FrootAI — The uniFAIng Glue for the GenAI Ecosystem"
authors: [pavleen]
tags: [release, announcement]
description: "FrootAI is an open-source platform that unifies AI primitives — agents, skills, instructions, hooks, plugins, and workflows — through the FAI Protocol."
image: /img/frootai-social-card.png
---

# Introducing FrootAI

**From the Roots to the Fruits. It's connected. It's simply Frootful.** 🍊

The GenAI ecosystem is fragmented. Thousands of tools, frameworks, and platforms — each solving a piece of the puzzle, none connecting them all. Until now.

{/* truncate */}

## The Problem

Every AI team faces the same challenges:

- **Tool sprawl** — MCP servers, LangChain, Semantic Kernel, AutoGen, CrewAI — each with its own patterns
- **No standard wiring** — How do you compose an agent with a skill, constrain it with instructions, and guard it with hooks?
- **Reinventing the wheel** — Every new AI project starts from scratch instead of building on proven architectures
- **Quality gaps** — No systematic way to ensure AI solutions meet reliability, security, and cost targets

## The Solution: FrootAI

FrootAI is the **uniFAIng glue** — an open-source platform that connects the dots:

### 🧩 AI Primitives

Six composable building blocks:

| Primitive | Purpose | File Format |
|-----------|---------|-------------|
| **Agents** | Specialized AI personas | `.agent.md` |
| **Instructions** | Always-on domain knowledge | `.instructions.md` |
| **Skills** | Step-by-step capabilities | `SKILL.md` |
| **Hooks** | Event-driven automation | `hooks.json` |
| **Plugins** | Packaged distributions | `plugin.json` |
| **Workflows** | Multi-step processes | `.yml` |

### 🔗 FAI Protocol

The open specification (`fai-manifest.json`) that wires primitives together. Like `package.json` for npm, but for AI architectures:

```json
{
  "play": "01-enterprise-rag",
  "version": "1.0.0",
  "context": {
    "knowledge": ["./docs/rag-patterns.md"],
    "waf": ["reliability", "security", "cost-optimization"]
  },
  "primitives": {
    "agents": ["./agents/rag-architect.agent.md"],
    "skills": ["./skills/build-rag-pipeline/SKILL.md"],
    "instructions": ["./instructions/azure-search.instructions.md"]
  }
}
```

### 🏗️ Solution Plays

Pre-built, production-ready AI architectures. Each play includes:

- **DevKit** — Copilot-ready agents, skills, instructions
- **TuneKit** — Customer-tunable AI parameters
- **SpecKit** — Documentation and metadata
- **Infra** — Azure Verified Modules (Bicep)

### 📦 Distribution Everywhere

Install FrootAI wherever you work:

```bash
# MCP Server
npx frootai-mcp@latest

# Python
pip install frootai

# VS Code
ext install frootai.frootai

# Docker
docker pull ghcr.io/frootai/frootai-mcp
```

## What Makes FrootAI Different?

1. **Protocol-level composition** — Primitives auto-wire when used inside solution plays
2. **Well-Architected by default** — Every primitive aligns to 6 WAF pillars
3. **Framework-agnostic** — Works with LangChain, Semantic Kernel, AutoGen, and more
4. **Production-ready** — Not demos, but deployable architectures with infrastructure

## Get Started

```bash
npx frootai-mcp@latest
```

Then explore the [documentation](https://docs.frootai.dev), browse [solution plays](https://frootai.dev/solution-plays), or dive into the [FROOT learning path](https://docs.frootai.dev/learning/f1-genai-foundations).

## What's Next

We're building in the open. Star us on [GitHub](https://github.com/frootai/frootai), try a solution play, or contribute a primitive.

*The uniFAIng glue for the GenAI ecosystem.* 🍊
