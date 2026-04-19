# FrootAI — Composio Integration

> Wrap all 45 FrootAI MCP tools as Composio actions for use in any agent framework.

---

## Overview

[Composio](https://composio.dev) provides a unified API for connecting AI agents to 250+ tools. This integration wraps FrootAI's 45 MCP tools as native Composio actions, enabling any Composio-connected agent framework (LangChain, CrewAI, AutoGen, LlamaIndex, OpenAI Assistants) to access FrootAI's architecture guidance, solution plays, and primitive management.

## Tool Metadata Mapping

FrootAI MCP tools map to Composio actions with the following structure:

### Architecture & Knowledge (8 actions)

| Composio Action | MCP Tool | Input Schema | Output |
|----------------|----------|--------------|--------|
| `FROOTAI_SEARCH_KNOWLEDGE` | `search_knowledge` | `{ query: string, max_results?: number }` | Matching knowledge sections with relevance scores |
| `FROOTAI_GET_MODULE` | `get_module` | `{ module_id: string, section?: string }` | Full module content (F1-T3) |
| `FROOTAI_GET_ARCHITECTURE_PATTERN` | `get_architecture_pattern` | `{ scenario: enum }` | Architecture guidance for 7 scenarios |
| `FROOTAI_GET_FROOT_OVERVIEW` | `get_froot_overview` | `{}` | Complete FROOT framework overview |
| `FROOTAI_LIST_MODULES` | `list_modules` | `{}` | All 24 modules by FROOT layer |
| `FROOTAI_LOOKUP_TERM` | `lookup_term` | `{ term: string }` | AI/ML glossary definition |
| `FROOTAI_GET_WAF_GUIDANCE` | `get_waf_guidance` | `{ pillar: string }` | WAF guidance by pillar |
| `FROOTAI_FETCH_AZURE_DOCS` | `fetch_azure_docs` | `{ service: string }` | Latest Azure documentation |

### Solution Plays (8 actions)

| Composio Action | MCP Tool | Input Schema | Output |
|----------------|----------|--------------|--------|
| `FROOTAI_GET_PLAY_DETAIL` | `get_play_detail` | `{ play_number: string }` | Full play architecture and config |
| `FROOTAI_LIST_PLAYS` | `list_community_plays` | `{ filter?: string }` | All 104 plays with status |
| `FROOTAI_SEARCH_PLAYS` | `semantic_search_plays` | `{ query: string, top_k?: number }` | Ranked play matches |
| `FROOTAI_COMPARE_PLAYS` | `compare_plays` | `{ plays: string }` | Side-by-side play comparison |
| `FROOTAI_ESTIMATE_COST` | `estimate_cost` | `{ play: string, scale?: enum }` | Azure cost breakdown |
| `FROOTAI_SCAFFOLD_PLAY` | `scaffold_play` | `{ play: string }` | Scaffold new play from template |
| `FROOTAI_EXPORT_PLAY_IAC` | `export_play_iac` | `{ play: string, format: enum }` | Bicep or Terraform IaC |
| `FROOTAI_GET_PLAY_PRIMITIVES` | `get_play_primitives` | `{ play: string }` | All primitives wired to a play |

### Model & Pricing (4 actions)

| Composio Action | MCP Tool | Input Schema | Output |
|----------------|----------|--------------|--------|
| `FROOTAI_COMPARE_MODELS` | `compare_models` | `{ useCase: string, priority?: enum }` | Model comparison with recommendation |
| `FROOTAI_GET_MODEL_CATALOG` | `get_model_catalog` | `{ category?: enum }` | Azure OpenAI model catalog |
| `FROOTAI_GET_AZURE_PRICING` | `get_azure_pricing` | `{ scenario: enum, scale?: enum }` | Azure AI pricing estimates |
| `FROOTAI_GET_ADAPTER_CONFIG` | `get_adapter_config` | `{ framework: string }` | Framework adapter config |

### Agent Workflow (4 actions)

| Composio Action | MCP Tool | Input Schema | Output |
|----------------|----------|--------------|--------|
| `FROOTAI_AGENT_BUILD` | `agent_build` | `{ task: string }` | Builder agent for code generation |
| `FROOTAI_AGENT_REVIEW` | `agent_review` | `{ context?: string }` | Security + quality review checklist |
| `FROOTAI_AGENT_TUNE` | `agent_tune` | `{ context?: string }` | Config validation and production readiness |
| `FROOTAI_RUN_FACTORY` | `run_factory_pipeline` | `{ play: string }` | FAI Factory CI/CD pipeline |

### Evaluation (4 actions)

| Composio Action | MCP Tool | Input Schema | Output |
|----------------|----------|--------------|--------|
| `FROOTAI_RUN_EVALUATION` | `run_evaluation` | `{ scores: object, thresholds?: object }` | Pass/fail per metric |
| `FROOTAI_VALIDATE_CONFIG` | `validate_config` | `{ config_type: enum, config_content: string }` | Config validation results |
| `FROOTAI_VALIDATE_MANIFEST` | `validate_manifest` | `{ manifest: string }` | FAI Protocol schema validation |
| `FROOTAI_VALIDATE_PRIMITIVES` | `validate_primitives` | `{}` | All primitives naming + schema check |

### Primitive Management (10 actions)

| Composio Action | MCP Tool | Input Schema | Output |
|----------------|----------|--------------|--------|
| `FROOTAI_LIST_PRIMITIVES` | `list_primitives` | `{ type: enum, limit?: number }` | Browse 860+ primitives by type |
| `FROOTAI_SEARCH_AGENTS` | `search_agents` | `{ query: string }` | Search 238 agents |
| `FROOTAI_GET_PRIMITIVE_DETAIL` | `get_primitive_detail` | `{ name: string, type: string }` | Deep-dive into any primitive |
| `FROOTAI_GET_SKILL_DETAIL` | `get_skill_detail` | `{ name: string }` | Full skill content with examples |
| `FROOTAI_LIST_WORKFLOWS` | `list_workflows` | `{}` | Browse 12 workflow templates |
| `FROOTAI_LIST_COOKBOOK` | `list_cookbook` | `{}` | Browse 16 cookbook recipes |
| `FROOTAI_LIST_HOOKS` | `list_hooks` | `{}` | Browse 10 SessionStart hooks |
| `FROOTAI_COMPARE_PRIMITIVES` | `compare_primitives` | `{ a: string, b: string }` | Side-by-side primitive comparison |
| `FROOTAI_MARKETPLACE_SEARCH` | `marketplace_search` | `{ query: string }` | Search 77+ FAI plugins |
| `FROOTAI_MARKETPLACE_BROWSE` | `marketplace_browse` | `{ page?: number }` | Browse plugin marketplace |

### Visualization & Protocol (4 actions)

| Composio Action | MCP Tool | Input Schema | Output |
|----------------|----------|--------------|--------|
| `FROOTAI_GENERATE_DIAGRAM` | `generate_architecture_diagram` | `{ play: string }` | Mermaid.js architecture diagram |
| `FROOTAI_EMBEDDING_PLAYGROUND` | `embedding_playground` | `{ text1: string, text2: string }` | Semantic similarity comparison |
| `FROOTAI_GET_GITHUB_AGENTIC_OS` | `get_github_agentic_os` | `{ primitive?: enum }` | GitHub Copilot primitives guide |
| `FROOTAI_GET_MOONSHOT_CONTRACTS` | `get_moonshot_contracts` | `{}` | FAI Protocol v2.0 contract definitions |

### Distribution & Status (3 actions)

| Composio Action | MCP Tool | Input Schema | Output |
|----------------|----------|--------------|--------|
| `FROOTAI_GET_DISTRIBUTION_STATUS` | `get_distribution_status` | `{}` | Sync status across 6 channels |
| `FROOTAI_GET_EVAL_TEMPLATE` | `get_eval_template` | `{ play: string }` | Evaluation pipeline template |
| `FROOTAI_FETCH_EXTERNAL_MCP` | `fetch_external_mcp` | `{ query: string }` | Search external MCP registries |

**Total: 45 Composio actions** wrapping all 45 FrootAI MCP tools.

## Authentication Flow

FrootAI MCP tools require no authentication — the server runs locally and serves from bundled knowledge. For Composio integration:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  AI Agent    │────▶│   Composio   │────▶│  FrootAI MCP    │
│  (any        │     │   Gateway    │     │  Server (local) │
│  framework)  │◀────│              │◀────│                 │
└─────────────┘     └──────────────┘     └─────────────────┘
```

### Setup

1. **Register FrootAI as a Composio tool:**

```python
from composio import ComposioToolSet, App

toolset = ComposioToolSet()

# FrootAI runs locally — no API key needed
toolset.register_local_tool(
    name="frootai",
    command="npx frootai-mcp@5.2.0",
    transport="stdio",
    description="AI architecture guidance, 104 solution plays, 860+ primitives"
)
```

2. **Use with LangChain:**

```python
from composio_langchain import ComposioToolSet, Action
from langchain_openai import ChatOpenAI

toolset = ComposioToolSet()
tools = toolset.get_tools(actions=[
    Action.FROOTAI_SEARCH_KNOWLEDGE,
    Action.FROOTAI_GET_PLAY_DETAIL,
    Action.FROOTAI_COMPARE_MODELS,
    Action.FROOTAI_ESTIMATE_COST
])

llm = ChatOpenAI(model="gpt-4o")
agent = create_react_agent(llm, tools)
agent.invoke({"input": "Find the best RAG architecture for processing legal documents and estimate costs"})
```

3. **Use with CrewAI:**

```python
from composio_crewai import ComposioToolSet, Action
from crewai import Agent, Task, Crew

toolset = ComposioToolSet()
tools = toolset.get_tools(actions=[
    Action.FROOTAI_SEARCH_KNOWLEDGE,
    Action.FROOTAI_GET_PLAY_DETAIL,
    Action.FROOTAI_AGENT_BUILD
])

architect = Agent(
    role="AI Architect",
    goal="Design optimal AI architecture using FrootAI solution plays",
    tools=tools
)

task = Task(
    description="Design a multi-agent system for IT ticket resolution",
    agent=architect
)

crew = Crew(agents=[architect], tasks=[task])
result = crew.kickoff()
```

4. **Use with OpenAI Assistants:**

```python
from composio_openai import ComposioToolSet, Action

toolset = ComposioToolSet()
tools = toolset.get_tools(actions=[
    Action.FROOTAI_SEARCH_PLAYS,
    Action.FROOTAI_GET_PLAY_DETAIL,
    Action.FROOTAI_GENERATE_DIAGRAM
])

# Attach to OpenAI Assistant
assistant = client.beta.assistants.create(
    name="AI Architecture Advisor",
    instructions="Use FrootAI tools to recommend AI architectures",
    tools=tools,
    model="gpt-4o"
)
```

## Composio App Manifest

```json
{
  "name": "frootai",
  "displayName": "FrootAI",
  "description": "AI architecture guidance with 45 tools, 104 solution plays, and 860+ primitives via the FAI Protocol",
  "version": "5.2.0",
  "logo": "https://frootai.dev/logo.png",
  "categories": ["developer-tools", "ai-architecture"],
  "auth": {
    "type": "none",
    "description": "FrootAI runs locally — no API key required"
  },
  "transport": {
    "type": "mcp-stdio",
    "command": "npx",
    "args": ["frootai-mcp@5.2.0"]
  },
  "actions_count": 45,
  "website": "https://frootai.dev",
  "repository": "https://github.com/frootai/frootai",
  "documentation": "https://frootai.dev/mcp"
}
```

## Links

- **Composio**: https://composio.dev
- **FrootAI Website**: https://frootai.dev
- **GitHub**: https://github.com/frootai/frootai
- **MCP Server**: https://www.npmjs.com/package/frootai-mcp
