---
sidebar_position: 2
title: VS Code Extension
description: The FrootAI VS Code extension brings solution play browsing, primitive catalog, MCP integration, and evaluation dashboards directly into your editor.
---

# VS Code Extension

The FrootAI VS Code extension integrates the full FrootAI ecosystem into your editor — browse solution plays, discover primitives, configure MCP tools, and run evaluations without leaving VS Code.

## Installation

Install from the VS Code Marketplace:

```bash
code --install-extension frootai.frootai-vscode
```

Or search for **"FrootAI"** in the VS Code Extensions panel (`Ctrl+Shift+X`).

:::info VS Code Protocol Link
You can also install via protocol link:
```
vscode://github.copilot-chat/createAgent
```
:::

## Features

### Solution Play Browser

Browse all 100 solution plays with filtering by category, complexity, and WAF alignment:

- **Play details** — architecture, services, config, evaluation metrics
- **Init DevKit** — scaffold a new play from any template
- **User guides** — step-by-step implementation instructions
- **Cost estimation** — monthly cost breakdown by environment

### Primitive Catalog

Discover and browse all 830+ FAI primitives:

| Category | Count | Description |
|----------|:-----:|-------------|
| Agents | 238 | AI personalities with tools and WAF alignment |
| Instructions | 176 | Auto-applied coding standards |
| Skills | 322 | Multi-step procedures |
| Hooks | 10 | Event-driven guardrails |
| Plugins | 77 | Themed primitive bundles |
| Workflows | 13 | Multi-agent orchestration |

### MCP Integration

Built-in MCP server configuration for Copilot Chat — access 25 FrootAI tools directly from your conversations.

### Evaluation Dashboard

Run and visualize quality gate evaluations:
- Groundedness, coherence, relevance, fluency scores
- Historical trend tracking
- Pass/fail status per play

## Commands

| Command | Description |
|---------|-------------|
| `FrootAI: Browse Solution Plays` | Open the play browser |
| `FrootAI: Browse Primitives` | Open the primitive catalog |
| `FrootAI: Init Play` | Scaffold a new solution play |
| `FrootAI: Validate Primitives` | Run `npm run validate:primitives` |
| `FrootAI: Run Evaluation` | Evaluate a play's quality gates |
| `FrootAI: Estimate Cost` | Calculate Azure costs for a play |

Access commands via `Ctrl+Shift+P` and type "FrootAI".

## Settings

Configure the extension in VS Code settings:

```json title=".vscode/settings.json"
{
  "frootai.playsDirectory": "solution-plays",
  "frootai.showWAFIndicators": true,
  "frootai.autoValidateOnSave": false,
  "frootai.mcpServerPath": "mcp-server/index.js"
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `playsDirectory` | `solution-plays` | Path to solution plays |
| `showWAFIndicators` | `true` | Show WAF pillar indicators in play browser |
| `autoValidateOnSave` | `false` | Run validation on file save |
| `mcpServerPath` | `mcp-server/index.js` | Path to MCP server entry point |

## Version

Current version: **v2.0.0**, synced with 100 plays and all primitives.

## See Also

- [Configure VS Code](/docs/guides/configure-vscode) — full VS Code setup guide
- [MCP Server](/docs/distribution/mcp-server) — MCP server configuration
- [Quick Start](/docs/getting-started/quick-start) — get started with FrootAI
