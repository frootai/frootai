---
sidebar_position: 1
title: "MCP Tools Reference"
description: "Complete reference for all 25 tools exposed by the FrootAI MCP Server — knowledge search, play discovery, agent workflows, model comparison, cost estimation, and more."
---

# MCP Tools Reference

The FrootAI MCP Server exposes **25 tools** that any MCP-compatible client (VS Code Copilot, Claude Desktop, Cursor, etc.) can invoke. Install and start using them immediately:

```bash
npx frootai-mcp@latest
```

:::tip Quick Start
Add the MCP server to your VS Code `mcp.json` or Claude Desktop config, then call any tool by name. See the [CLI Commands](./cli-commands.md) page for alternative CLI usage.
:::

## Complete Tool Catalog

| Tool | Description | Category |
|------|-------------|----------|
| `search_knowledge` | Search across all 17 FROOT modules | Knowledge |
| `get_module` | Get full content of a specific module (F1–T3) | Knowledge |
| `lookup_term` | Look up AI/ML term in glossary (200+ terms) | Knowledge |
| `list_modules` | List all modules by FROOT layer | Knowledge |
| `semantic_search_plays` | Natural language search for solution plays | Plays |
| `get_play_detail` | Detailed architecture for a specific play | Plays |
| `list_community_plays` | List all solution plays with status | Plays |
| `compare_plays` | Side-by-side play comparison | Plays |
| `agent_build` | Builder agent — implementation guidance | Agents |
| `agent_review` | Reviewer agent — security + quality review | Agents |
| `agent_tune` | Tuner agent — production readiness validation | Agents |
| `compare_models` | AI model comparison for use case | Models |
| `get_model_catalog` | List Azure OpenAI models with pricing | Models |
| `estimate_cost` | Calculate monthly Azure costs for a play | Cost |
| `get_azure_pricing` | Azure AI pricing for scenarios | Cost |
| `run_evaluation` | Check AI quality scores against thresholds | Evaluation |
| `validate_config` | Validate TuneKit config files | Validation |
| `generate_architecture_diagram` | Mermaid.js architecture diagram | Architecture |
| `get_architecture_pattern` | Architecture guidance for scenarios | Architecture |
| `embedding_playground` | Compare text similarity | Learning |
| `list_primitives` | Browse agents, skills, hooks, plugins, etc. | Primitives |
| `fetch_azure_docs` | Latest Azure documentation | Azure |
| `fetch_external_mcp` | Search for external MCP servers | MCP |
| `get_froot_overview` | Complete FROOT framework overview | Overview |
| `get_github_agentic_os` | .github Agentic OS guide | Reference |

---

## Detailed Tool Reference

### 1. `search_knowledge`

Search across all 17 FrootAI modules for a topic. Returns relevant sections matching the query.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | ✅ | — | Natural language search query |
| `max_results` | number | ❌ | 5 | Maximum matching sections to return |

**Example call:**

```json
{
  "tool": "search_knowledge",
  "arguments": {
    "query": "how to reduce hallucination in RAG",
    "max_results": 3
  }
}
```

**Example response:**

```json
{
  "results": [
    {
      "module": "R2 — RAG",
      "section": "Grounding & Citation",
      "content": "Use groundedness checks (score ≥ 4.0)..."
    }
  ]
}
```

---

### 2. `semantic_search_plays`

Describe what you want to build in natural language and get the top matching solution plays ranked by relevance.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | ✅ | — | What you want to build |
| `top_k` | number | ❌ | 3 | Number of results (max 5) |

**Example call:**

```json
{
  "tool": "semantic_search_plays",
  "arguments": {
    "query": "process invoices and extract line items",
    "top_k": 3
  }
}
```

**Example response:**

```json
{
  "matches": [
    { "play": "06-document-intelligence", "confidence": 0.94 },
    { "play": "15-document-processing", "confidence": 0.87 },
    { "play": "01-enterprise-rag", "confidence": 0.62 }
  ]
}
```

:::info
For full play details after finding a match, chain with [`get_play_detail`](#) passing the play number. See the [fai-manifest.json](./fai-manifest.md) spec for how plays are wired.
:::

---

### 3. `agent_build`

Triggers the **Builder agent** — returns implementation guidelines based on FrootAI best practices, then suggests review. Part of the Build → Review → Tune chain.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task` | string | ✅ | What the user wants to build |

**Example call:**

```json
{
  "tool": "agent_build",
  "arguments": {
    "task": "IT ticket classification API with Azure OpenAI"
  }
}
```

:::warning
After building, always follow up with `agent_review` and then `agent_tune` to complete the full quality chain. Skipping review or tuning may leave security or production-readiness gaps.
:::

---

### 4. `compare_models`

Side-by-side comparison of AI models for a specific use case. Recommends the best model based on your priority.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `useCase` | string | ✅ | — | What you're building |
| `priority` | enum | ❌ | `quality` | `cost`, `quality`, `speed`, or `context` |

**Example call:**

```json
{
  "tool": "compare_models",
  "arguments": {
    "useCase": "RAG chatbot with 50-page documents",
    "priority": "cost"
  }
}
```

---

### 5. `estimate_cost`

Calculate itemized monthly Azure costs for any solution play at dev or production scale.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `play` | string | ✅ | — | Play number: `01`–`20` |
| `scale` | enum | ❌ | `dev` | `dev` or `prod` |

**Example call:**

```json
{
  "tool": "estimate_cost",
  "arguments": {
    "play": "01",
    "scale": "prod"
  }
}
```

**Example response:**

```json
{
  "play": "01-enterprise-rag",
  "scale": "prod",
  "monthly_total": "$1,240",
  "breakdown": {
    "Azure OpenAI (GPT-4o)": "$800",
    "Azure AI Search (S1)": "$250",
    "Azure App Service (P1v3)": "$140",
    "Azure Cosmos DB (Serverless)": "$50"
  }
}
```

---

## Related Pages

- [CLI Commands](./cli-commands.md) — command-line alternatives to MCP tools
- [JSON Schemas](./schemas.md) — validation schemas for all FrootAI primitives
- [fai-manifest.json](./fai-manifest.md) — the wiring spec that ties plays together
