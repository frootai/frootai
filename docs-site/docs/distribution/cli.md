---
sidebar_position: 5
title: CLI
description: The FrootAI CLI provides commands for initializing plays, scaffolding primitives, running evaluations, estimating costs, and validating configurations.
---

# CLI

The FrootAI CLI (`npx frootai`) provides command-line access to play initialization, primitive scaffolding, evaluation, cost estimation, and validation.

## Installation

No installation needed — run directly with `npx`:

```bash
npx frootai [command]
```

Or install globally:

```bash
npm install -g frootai
frootai [command]
```

## Commands

### init

Initialize a new solution play from a template:

```bash
npx frootai init --play 01 --name my-rag-app
```

This scaffolds the full Play 101 golden template structure:

```
my-rag-app/
├── agent.md
├── .github/
│   ├── copilot-instructions.md
│   ├── agents/
│   ├── instructions/
│   ├── skills/
│   └── hooks/
├── .vscode/mcp.json
├── config/
├── infra/
├── evaluation/
└── spec/
```

### scaffold

Create individual primitives:

```bash
# Scaffold an agent
npx frootai scaffold agent --name fai-my-expert

# Scaffold a skill
npx frootai scaffold skill --name fai-deploy-my-app

# Scaffold an instruction
npx frootai scaffold instruction --name my-standards

# Scaffold a hook
npx frootai scaffold hook --name fai-my-check
```

### evaluate

Run quality gate evaluation against a play's guardrails:

```bash
npx frootai evaluate --play 01-enterprise-rag
```

Output:
```
📊 FAI Quality Evaluation Report
  Play: 01-enterprise-rag (v2.0.0)
  ✅ groundedness: 97.0% (threshold: 0.95)
  ✅ coherence:    93.0% (threshold: 0.90)
  ✅ relevance:    88.0% (threshold: 0.85)
  ✅ All quality gates passed
```

### cost

Estimate monthly Azure costs for a play:

```bash
# Development environment
npx frootai cost --play 01 --scale dev

# Production environment
npx frootai cost --play 01 --scale prod
```

### validate

Validate all primitives in the repository:

```bash
npx frootai validate
```

This checks:
- Agent frontmatter (description 10+ chars, valid WAF pillars)
- Skill names match folder names
- Instruction `applyTo` glob patterns are valid
- Plugin `plugin.json` schema compliance
- Hook `hooks.json` configuration

### primitives

Browse the primitive catalog:

```bash
# List all agents
npx frootai primitives --type agents

# List all skills
npx frootai primitives --type skills

# Search primitives
npx frootai primitives --search "RAG"
```

### compare

Compare solution plays or AI models:

```bash
# Compare plays
npx frootai compare --plays 01,03,07

# Compare models
npx frootai compare --models "gpt-4o,gpt-4o-mini" --use-case "RAG chatbot"
```

## Global Options

| Option | Description |
|--------|-------------|
| `--help` | Show help for a command |
| `--version` | Show CLI version |
| `--verbose` | Enable detailed output |
| `--json` | Output as JSON (for piping) |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Validation or evaluation failure |
| `2` | Invalid arguments |

## Version

Current version synced with main FrootAI release.

## See Also

- [Quick Start](/docs/getting-started/quick-start) — getting started guide
- [MCP Server](/docs/distribution/mcp-server) — MCP protocol access
- [npm SDK](/docs/distribution/npm-sdk) — programmatic Node.js access
