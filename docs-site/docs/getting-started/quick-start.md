---
sidebar_position: 2
title: Quick Start
description: Get FrootAI running in 5 minutes — install, init a play, and run your first evaluation.
---

# Quick Start

Go from zero to a working FrootAI environment in under 5 minutes.

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org/) (22+ recommended)
- **Git** — [git-scm.com](https://git-scm.com/)
- An AI-capable editor: **VS Code** with GitHub Copilot, **Cursor**, or **Claude Desktop**

## Step 1 — Install FrootAI

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="npm" label="npm" default>

```bash
# MCP Server — add AI tooling to any MCP-compatible agent
npx frootai-mcp@latest

# SDK — programmatic API for Node.js / TypeScript
npm install frootai
```

</TabItem>
<TabItem value="pip" label="pip">

```bash
# Python SDK — offline, zero dependencies
pip install frootai

# Python MCP Server
pip install frootai-mcp
```

</TabItem>
<TabItem value="docker" label="Docker">

```bash
# Zero-install MCP server
docker run -i ghcr.io/frootai/frootai-mcp
```

</TabItem>
<TabItem value="vscode" label="VS Code">

```bash
# Install the VS Code extension
code --install-extension frootai.frootai-vscode
```

Or search **"FrootAI"** in the VS Code Extensions panel.

</TabItem>
</Tabs>

## Step 2 — Configure Your AI Agent

Add FrootAI as an MCP server in your editor's config:

```json title="mcp.json (VS Code / Claude Desktop / Cursor)"
{
  "mcpServers": {
    "frootai": {
      "command": "npx",
      "args": ["frootai-mcp@latest"]
    }
  }
}
```

:::tip
This works with **GitHub Copilot**, **Claude Desktop**, **Cursor**, **Windsurf**, **Azure AI Foundry**, and any MCP-compatible client.
:::

## Step 3 — Init a Solution Play

Scaffold a complete DevKit for Enterprise RAG (Play 01):

```bash
npx frootai init-devkit 01
```

This generates the full play structure:

```
solution-plays/01-enterprise-rag/
├── .github/                    # DevKit: Copilot brain
│   ├── copilot-instructions.md #   Always-on context
│   ├── agents/                 #   builder, reviewer, tuner
│   ├── instructions/           #   Coding standards
│   ├── skills/                 #   Step-by-step procedures
│   └── hooks/                  #   Security guardrails
├── config/                     # TuneKit: AI parameters
│   ├── openai.json             #   Model + temperature
│   └── guardrails.json         #   Quality thresholds
├── infra/                      # Azure Bicep templates
├── spec/                       # Architecture decisions
└── fai-manifest.json           # FAI Protocol wiring
```

## Step 4 — Run Your First Evaluation

Validate that all primitives are correctly wired:

```bash
# Validate schemas, naming, and frontmatter
npm run validate:primitives

# Load the play in the FAI Engine
node engine/index.js solution-plays/01-enterprise-rag/fai-manifest.json --status
```

Expected output:

```
🍊 FAI Engine v0.1
══════════════════════════════════════════════════
  Play:      01-enterprise-rag v1.0.0
  Knowledge: 2 FROOT modules
  WAF:       3 pillars enforced
  Guardrails: groundedness≥0.95, safety≥0.99
  ✅ All primitives wired, context resolved
══════════════════════════════════════════════════
```

## Step 5 — Explore with the SDK

```javascript
import { FrootAI } from 'frootai';

const fai = new FrootAI();

// Search across all knowledge modules
const results = fai.search('RAG architecture');

// Get play details
const play = fai.plays.get('01');
console.log(play.title);  // "Enterprise RAG Q&A"

// Run evaluation quality gates
fai.evaluation.run({
  groundedness: 0.95,
  relevance: 0.88,
  safety: 1.0
});
```

:::info
The SDK works offline with zero external dependencies — all knowledge is bundled.
:::

## What's Next?

- **[Installation](./installation)** — all distribution channels and prerequisites
- **[Your First Solution Play](./first-play)** — deploy Play 01 to Azure
- **[FAI Protocol](../concepts/fai-protocol)** — understand the wiring specification
- **[Primitives](../concepts/primitives)** — the 6 building block types
- **[Solution Plays](../concepts/solution-plays)** — browse 100 pre-built architectures
