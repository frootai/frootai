---
sidebar_position: 1
title: MCP Server
description: The FrootAI MCP Server exposes 25 tools for searching knowledge, comparing models, estimating costs, and validating configurations — accessible from VS Code, Cursor, and Claude Desktop.
---

# MCP Server

The FrootAI MCP Server is a **Model Context Protocol** server that gives AI assistants access to the entire FrootAI knowledge base — 17 FROOT modules, 100 solution plays, 830+ primitives, and AI model comparison data.

## Installation

```bash
npx frootai-mcp@latest
```

No configuration needed — the server runs with bundled knowledge data.

## Configuration

### VS Code (Copilot Chat)

Add to `.vscode/mcp.json` in your project:

```json title=".vscode/mcp.json"
{
  "servers": {
    "frootai": {
      "command": "npx",
      "args": ["frootai-mcp@latest"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings:

```json title="~/.cursor/mcp.json"
{
  "mcpServers": {
    "frootai": {
      "command": "npx",
      "args": ["frootai-mcp@latest"]
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "frootai": {
      "command": "npx",
      "args": ["frootai-mcp@latest"]
    }
  }
}
```

## Available Tools

### Knowledge & Learning

| Tool | Description |
|------|-------------|
| `search_knowledge` | Search across all 17 FROOT modules by topic |
| `get_module` | Get full content of a specific module (F1–T3) |
| `list_modules` | List all modules organized by FROOT layer |
| `lookup_term` | Look up an AI/ML term in the glossary (200+ terms) |

### Solution Plays

| Tool | Description |
|------|-------------|
| `get_play_detail` | Detailed architecture, services, config for a play |
| `list_community_plays` | List all 100 plays with status |
| `semantic_search_plays` | Describe what you want, get matching plays |
| `compare_plays` | Side-by-side comparison of 2–3 plays |
| `generate_architecture_diagram` | Generate Mermaid.js diagram for a play |

### Models & Cost

| Tool | Description |
|------|-------------|
| `compare_models` | Side-by-side model comparison for a use case |
| `get_model_catalog` | List Azure OpenAI models with capabilities |
| `estimate_cost` | Calculate monthly Azure costs for a play |
| `get_azure_pricing` | Pricing estimates by scenario |

### Architecture & Patterns

| Tool | Description |
|------|-------------|
| `get_architecture_pattern` | Guidance for RAG, agents, cost optimization |
| `get_froot_overview` | Complete FROOT framework overview |
| `get_github_agentic_os` | GitHub Copilot agentic OS guide |

### Build & Validate

| Tool | Description |
|------|-------------|
| `agent_build` | Builder agent — implementation guidelines |
| `agent_review` | Reviewer agent — security + quality checklist |
| `agent_tune` | Tuner agent — production readiness validation |
| `validate_config` | Validate TuneKit config files |
| `run_evaluation` | Check AI quality scores against thresholds |

### Ecosystem

| Tool | Description |
|------|-------------|
| `list_primitives` | Browse all 830+ primitives by type |
| `fetch_azure_docs` | Fetch latest Azure documentation |
| `fetch_external_mcp` | Search for external MCP servers |
| `embedding_playground` | Compare texts for semantic similarity |

## Usage Examples

### Search for RAG patterns

Ask your AI assistant:
> "Search FrootAI knowledge for RAG chunking strategies"

The assistant calls `search_knowledge` with `query: "RAG chunking strategies"` and returns relevant sections from the FROOT knowledge base.

### Find a solution play

> "I want to build a document processing pipeline. What FrootAI play should I use?"

The assistant calls `semantic_search_plays` to find the best match.

### Compare models

> "Compare GPT-4o vs GPT-4o-mini for a RAG chatbot"

The assistant calls `compare_models` with `useCase: "RAG chatbot"`.

### Estimate costs

> "How much would Play 01 cost in production?"

The assistant calls `estimate_cost` with `play: "01"` and `scale: "prod"`.

## Docker Deployment

For containerized environments, see the [Docker distribution](/docs/distribution/docker).

## Version

The MCP server version is synced with the main FrootAI release. Current: **v3.5.0**.

```bash
# Check installed version
npx frootai-mcp@latest --version
```

## See Also

- [Build an MCP Server](/docs/guides/build-mcp-server) — create your own MCP server
- [Configure VS Code](/docs/guides/configure-vscode) — full VS Code setup
- [Docker](/docs/distribution/docker) — containerized MCP server
