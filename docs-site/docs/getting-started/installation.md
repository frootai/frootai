---
sidebar_position: 3
title: Installation
description: Install FrootAI via npm, pip, Docker, VS Code extension, or CLI — all distribution channels with prerequisites.
---

# Installation

FrootAI is available through multiple distribution channels. Choose the one that fits your workflow.

## Prerequisites

| Requirement | Minimum Version | Check |
|-------------|----------------|-------|
| Node.js | 18+ (22+ recommended) | `node --version` |
| Python | 3.9+ (for Python SDK) | `python --version` |
| Docker | 20+ (for container usage) | `docker --version` |
| Git | 2.30+ | `git --version` |
| Azure CLI | 2.60+ (for deployment) | `az version` |

:::info
Only Node.js is required for the core tooling. Python, Docker, and Azure CLI are needed only for their respective channels.
:::

## npm — MCP Server

The MCP Server exposes 45 tools to any AI agent that speaks the [Model Context Protocol](https://modelcontextprotocol.io/):

```bash
# Run directly (no install needed)
npx frootai-mcp@latest

# Or install globally
npm install -g frootai-mcp
frootai-mcp
```

Add to your editor's MCP configuration:

```json title=".vscode/mcp.json"
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
This configuration works with **GitHub Copilot**, **Claude Desktop**, **Cursor**, **Windsurf**, and any MCP client.
:::

## npm — SDK & CLI

The SDK provides a full programmatic API for Node.js and TypeScript:

```bash
npm install frootai
```

```javascript
import { FrootAI } from 'frootai';

const fai = new FrootAI();
fai.search('RAG architecture');   // BM25-ranked results
fai.plays.get('01');              // Play details
fai.listModules();                // 16 FROOT modules
```

The CLI provides command-line access to all FrootAI features:

```bash
# Run via npx (no install)
npx frootai --help

# Or install globally
npm install -g frootai
frootai init-devkit 01
frootai primitives --type agents
```

## Python — SDK

The Python SDK is offline-capable with zero external dependencies:

```bash
pip install frootai
```

```python
from frootai import FrootAI

fai = FrootAI()
results = fai.search("RAG architecture")
play = fai.plays.get("01")
```

## Python — MCP Server

```bash
pip install frootai-mcp
```

```json title="claude_desktop_config.json"
{
  "mcpServers": {
    "frootai": {
      "command": "frootai-mcp"
    }
  }
}
```

## VS Code Extension

Install from the Visual Studio Marketplace:

```bash
code --install-extension frootai.frootai-vscode
```

Or search **"FrootAI"** in the VS Code Extensions panel (`Ctrl+Shift+X`).

The extension provides:
- Solution play browsing and scaffolding
- Primitive validation and linting
- Integrated MCP server management
- DevKit initialization commands

## Docker

Run the MCP server with zero local dependencies:

```bash
# Pull and run
docker pull ghcr.io/frootai/frootai-mcp
docker run -i ghcr.io/frootai/frootai-mcp

# Or use docker compose
```

```yaml title="docker-compose.yml"
services:
  frootai-mcp:
    image: ghcr.io/frootai/frootai-mcp:latest
    stdin_open: true
```

## Clone the Repository

For contributing or exploring the full source:

```bash
git clone https://github.com/frootai/frootai.git
cd frootai
npm install
npm run validate:primitives  # Verify everything works
```

:::warning
The repository includes 100 solution plays, 238 agents, 322 skills, and 77 plugins. The initial clone is approximately 50 MB.
:::

## Distribution Channels Summary

| Channel | Install Command | Use Case |
|---------|----------------|----------|
| **npm MCP** | `npx frootai-mcp@latest` | Add FrootAI tools to any AI agent |
| **npm SDK** | `npm install frootai` | Programmatic API in Node.js/TS |
| **PyPI SDK** | `pip install frootai` | Python API, offline, zero deps |
| **PyPI MCP** | `pip install frootai-mcp` | Python MCP server |
| **VS Code** | `code --install-extension frootai.frootai-vscode` | IDE integration |
| **Docker** | `docker run -i ghcr.io/frootai/frootai-mcp` | Zero-install MCP server |
| **CLI** | `npx frootai` | Command-line access |
| **GitHub** | `git clone` | Full source, contributions |

## Next Steps

- **[Quick Start](./quick-start)** — 5-minute guide from zero to running
- **[Your First Solution Play](./first-play)** — build and deploy Play 01
