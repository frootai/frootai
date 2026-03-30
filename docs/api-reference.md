---
sidebar_position: 33
title: API Reference
---

# FrootAI API Reference

> Technical reference for all public APIs — MCP tools, VS Code commands, config schemas, and Agentic OS files.

---

## 1. MCP Server Tools (16 tools)

The FrootAI MCP Server exposes tools over the **Model Context Protocol (stdio transport)**. All tools return JSON-RPC 2.0 responses.

### 1.1 Static Tools

#### `get_module`

Retrieve a full knowledge module by ID or name.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `module` | `string` | Yes | Module ID (e.g., `"F1"`) or name (e.g., `"GenAI-Foundations"`) |

**Output**: `{ content: [{ type: "text", text: "<full module content>" }] }`

**Example**:
```json
{
  "name": "get_module",
  "arguments": { "module": "RAG-Architecture" }
}
```

---

#### `list_modules`

List all available knowledge modules with metadata.

| Parameter | Type | Required | Description |
|---|---|---|---|
| *(none)* | — | — | No parameters required |

**Output**: `{ content: [{ type: "text", text: "<JSON array of modules>" }] }`

Each module entry:
```json
{
  "id": "F1",
  "name": "GenAI-Foundations",
  "layer": "Foundations",
  "title": "GenAI Foundations",
  "sizeBytes": 24500
}
```

---

#### `search_knowledge`

Full-text search across all knowledge modules.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Yes | Search query string |
| `limit` | `number` | No | Max results (default: 10) |

**Output**: `{ content: [{ type: "text", text: "<JSON array of matches>" }] }`

Each match:
```json
{
  "module": "RAG-Architecture",
  "section": "## Vector Databases",
  "snippet": "...matching text with context...",
  "score": 0.87
}
```

---

#### `lookup_term`

Look up an AI term in the glossary (200+ terms).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `term` | `string` | Yes | Term to look up (e.g., `"LoRA"`, `"RAG"`, `"RLHF"`) |

**Output**: `{ content: [{ type: "text", text: "<definition and context>" }] }`

---

### 1.2 Live Tools

#### `fetch_azure_docs`

Retrieve current Azure documentation for a service or topic.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `topic` | `string` | Yes | Azure service or topic (e.g., `"AI Search"`, `"Container Apps"`) |
| `section` | `string` | No | Specific section (e.g., `"pricing"`, `"quickstart"`) |

**Output**: `{ content: [{ type: "text", text: "<documentation content>" }] }`

> **Note**: Requires network connectivity.

---

#### `fetch_external_mcp`

Query external MCP server registries and catalogs.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Yes | What to search for (e.g., `"database tools"`, `"GitHub integration"`) |
| `registry` | `string` | No | Specific registry (default: all known registries) |

**Output**: `{ content: [{ type: "text", text: "<JSON array of MCP servers>" }] }`

---

### 1.3 Chain Tools

#### `agent_build`

Generate a new agent scaffold based on a scenario description.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `scenario` | `string` | Yes | Description of the agent's purpose |
| `model` | `string` | No | Preferred model (default: `"gpt-4o"`) |
| `style` | `string` | No | Agent style: `"conservative"`, `"balanced"`, `"creative"` (default: `"balanced"`) |

**Output**: `{ content: [{ type: "text", text: "<generated agent.md + config>" }] }`

---

#### `agent_review`

Review an agent's configuration for quality, security, and completeness.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `agentMd` | `string` | Yes | Contents of the agent.md file |
| `config` | `string` | No | Contents of agents.json config |
| `focus` | `string` | No | Review focus: `"security"`, `"completeness"`, `"performance"`, `"all"` (default: `"all"`) |

**Output**: `{ content: [{ type: "text", text: "<review findings and recommendations>" }] }`

---

#### `agent_tune`

Optimize agent parameters based on evaluation results.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `config` | `string` | Yes | Current agents.json content |
| `evalResults` | `string` | No | Evaluation results JSON |
| `goal` | `string` | No | Optimization goal: `"accuracy"`, `"latency"`, `"cost"`, `"balanced"` (default: `"balanced"`) |

**Output**: `{ content: [{ type: "text", text: "<optimized config + explanation>" }] }`

---

### 1.4 AI Ecosystem Tools

#### `get_architecture_pattern`

Get architecture patterns for a given scenario.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `scenario` | `string` | Yes | Description of the architecture need |
| `constraints` | `string` | No | Constraints (e.g., `"low-latency"`, `"multi-region"`) |

**Output**: `{ content: [{ type: "text", text: "<pattern description with diagram>" }] }`

---

#### `get_froot_overview`

Get an overview of the FrootAI platform and its components.

| Parameter | Type | Required | Description |
|---|---|---|---|
| *(none)* | — | — | No parameters required |

**Output**: `{ content: [{ type: "text", text: "<platform overview>" }] }`

---

#### `get_github_agentic_os`

Explain the .github Agentic OS — files, primitives, and composition.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `detail` | `string` | No | Detail level: `"summary"`, `"full"` (default: `"summary"`) |

**Output**: `{ content: [{ type: "text", text: "<Agentic OS documentation>" }] }`

---

#### `list_community_plays`

Browse community-contributed solution plays.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `category` | `string` | No | Filter by category (e.g., `"IT"`, `"Security"`, `"DevOps"`) |

**Output**: `{ content: [{ type: "text", text: "<JSON array of plays>" }] }`

---

#### `get_ai_model_guidance`

Get model selection guidance and comparison data.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `models` | `string` | No | Models to compare (comma-separated, e.g., `"gpt-4o,claude-3.5-sonnet"`) |
| `useCase` | `string` | No | Use case for recommendation (e.g., `"code generation"`, `"summarization"`) |

**Output**: `{ content: [{ type: "text", text: "<model comparison and recommendation>" }] }`

---

## 2. VS Code Extension Commands (13 commands)

All commands are prefixed with `frootai.` and appear in the Command Palette as `FROOT:`.

| Command ID | Palette Label | Description |
|---|---|---|
| `frootai.browseModules` | FROOT: Browse Modules | Open the knowledge hub module browser |
| `frootai.searchKnowledge` | FROOT: Search Knowledge | Full-text search across all modules |
| `frootai.lookupTerm` | FROOT: Lookup Term | Look up an AI term in the glossary |
| `frootai.initDevKit` | FROOT: Init DevKit | Scaffold .github Agentic OS into the workspace |
| `frootai.initTuneKit` | FROOT: Init TuneKit | Add config and evaluation files |
| `frootai.showPlays` | FROOT: Show Solution Plays | Browse all 20 solution plays |
| `frootai.openPlay` | FROOT: Open Play | Open a specific play's folder |
| `frootai.deploy` | FROOT: Deploy Solution | Package and deploy the current play |
| `frootai.showMcpTools` | FROOT: Show MCP Tools | View MCP tool documentation |
| `frootai.readUserGuide` | FROOT: Read User Guide | Open the user guide |
| `frootai.showArchitecture` | FROOT: Show Architecture | Display system architecture |
| `frootai.showChangelog` | FROOT: Show Changelog | View version history |
| `frootai.checkUpdates` | FROOT: Check Updates | Check for new versions |

---

## 3. Config File Schemas

### 3.1 `openai.json`

```json
{
  "_comment": "Azure OpenAI deployment configuration",
  "deployment_name": "gpt-4o",
  "api_version": "2024-08-01-preview",
  "temperature": 0.7,
  "max_tokens": 4096,
  "top_p": 0.95,
  "frequency_penalty": 0,
  "presence_penalty": 0
}
```

| Field | Type | Description |
|---|---|---|
| `deployment_name` | `string` | Azure OpenAI deployment name |
| `api_version` | `string` | API version string |
| `temperature` | `number` | Sampling temperature (0–2) |
| `max_tokens` | `number` | Maximum response tokens |
| `top_p` | `number` | Nucleus sampling threshold |
| `frequency_penalty` | `number` | Repetition penalty (-2 to 2) |
| `presence_penalty` | `number` | Topic presence penalty (-2 to 2) |

### 3.2 `guardrails.json`

```json
{
  "_comment": "Content safety and guardrail configuration",
  "max_input_tokens": 8192,
  "max_output_tokens": 4096,
  "blocked_topics": ["violence", "self-harm", "illegal-activity"],
  "content_filter_level": "medium",
  "rate_limit_rpm": 60,
  "require_grounding": true,
  "citation_required": true
}
```

| Field | Type | Description |
|---|---|---|
| `max_input_tokens` | `number` | Maximum tokens in user input |
| `max_output_tokens` | `number` | Maximum tokens in response |
| `blocked_topics` | `string[]` | Topics to filter out |
| `content_filter_level` | `string` | Filter strictness: `"low"`, `"medium"`, `"high"` |
| `rate_limit_rpm` | `number` | Requests per minute limit |
| `require_grounding` | `boolean` | Require grounded (cited) responses |
| `citation_required` | `boolean` | Include source citations |

### 3.3 `agents.json`

```json
{
  "_comment": "Agent routing and model configuration",
  "default_model": "gpt-4o",
  "fallback_model": "gpt-4o-mini",
  "routing": {
    "complex_reasoning": "gpt-4o",
    "simple_qa": "gpt-4o-mini",
    "code_generation": "gpt-4o"
  },
  "temperature_overrides": {
    "code_generation": 0.2,
    "creative_writing": 0.9
  },
  "max_retries": 3,
  "timeout_ms": 30000
}
```

### 3.4 `model-comparison.json`

```json
{
  "_comment": "Model comparison data for selection guidance",
  "models": [
    {
      "name": "gpt-4o",
      "provider": "Azure OpenAI",
      "context_window": 128000,
      "cost_per_1k_input": 0.005,
      "cost_per_1k_output": 0.015,
      "latency_p50_ms": 800,
      "strengths": ["reasoning", "code", "multimodal"]
    }
  ]
}
```

### 3.5 `search.json`

```json
{
  "_comment": "Search configuration for RAG pipelines",
  "method": "hybrid",
  "top_k": 5,
  "min_score": 0.7,
  "reranker": true,
  "embedding_model": "text-embedding-3-large",
  "dimensions": 3072
}
```

### 3.6 `chunking.json`

```json
{
  "_comment": "Document chunking strategy",
  "strategy": "semantic",
  "chunk_size_tokens": 512,
  "overlap_tokens": 64,
  "separators": ["\n## ", "\n### ", "\n\n", "\n"],
  "preserve_markdown_structure": true
}
```

---

## 4. Plugin Manifest (`plugin.json`)

The root `plugin.json` describes the FrootAI plugin for marketplace and registry listing.

```json
{
  "name": "frootai",
  "version": "2.2.0",
  "description": "BIY AI Kit — From the Roots to the Fruits",
  "author": "FrootAI Contributors",
  "license": "MIT",
  "repository": "https://github.com/frootai/frootai",
  "components": {
    "mcp-server": { "version": "2.2.0", "tools": 16 },
    "vscode-extension": { "version": "0.9.2", "commands": 13 },
    "website": { "pages": 13 },
    "knowledge-modules": { "count": 18 },
    "solution-plays": { "count": 20 }
  },
  "keywords": ["ai", "mcp", "agents", "azure", "rag", "froot"],
  "categories": ["AI", "Developer Tools", "Azure"]
}
```

---

## 5. .github Agentic OS File Reference (19 files)

The Agentic OS is a scaffolded set of files that make any project agent-ready. Organized in 4 layers:

### Layer 1: Agent Identity

| File | Purpose |
|---|---|
| `.github/agent.md` | Primary agent behavior rules — scope, constraints, tools, error handling |
| `.github/copilot-instructions.md` | GitHub Copilot context — project structure, conventions, key files |

### Layer 2: Prompt Library

| File | Purpose |
|---|---|
| `.github/prompts/init.prompt.md` | Bootstrap the agent with project context |
| `.github/prompts/review.prompt.md` | Code review prompt template |
| `.github/prompts/deploy.prompt.md` | Deployment preparation prompt |
| `.github/prompts/debug.prompt.md` | Debugging and troubleshooting prompt |
| `.github/prompts/test.prompt.md` | Test generation prompt |
| `.github/prompts/refactor.prompt.md` | Code refactoring prompt |

### Layer 3: CI/CD Automation

| File | Purpose |
|---|---|
| `.github/workflows/validate.yml` | Validate play structure, file sizes, JSON formatting |
| `.github/workflows/build.yml` | Build and test pipeline |
| `.github/workflows/deploy.yml` | Deployment workflow |
| `.github/workflows/evaluate.yml` | Run evaluation scripts and report scores |

### Layer 4: Collaboration Templates

| File | Purpose |
|---|---|
| `.github/ISSUE_TEMPLATE/bug.yml` | Structured bug report template |
| `.github/ISSUE_TEMPLATE/feature.yml` | Feature request template |
| `.github/ISSUE_TEMPLATE/play-request.yml` | New solution play request |
| `.github/pull_request_template.md` | PR description template with checklist |
| `.github/CODEOWNERS` | Review assignment rules |
| `.github/FUNDING.yml` | Sponsorship information |
| `.github/dependabot.yml` | Dependency update configuration |

### Composition

These files compose through 7 primitives:

1. **Agent Rules** → `agent.md`
2. **Context** → `copilot-instructions.md`
3. **Prompts** → `prompts/*.prompt.md`
4. **Workflows** → `workflows/*.yml`
5. **Templates** → `ISSUE_TEMPLATE/`, `pull_request_template.md`
6. **Config** → `config/*.json`
7. **Evaluation** → `evaluation/`

Each primitive is independent but they strengthen each other. An agent with rules + context + prompts is significantly more capable than rules alone.

---

## Scripts & Automation

### deploy-play.sh / deploy-play.ps1

Deploy any solution play end-to-end (infra + config + eval).

**Usage:**
```bash
./scripts/deploy-play.sh <play-number> [--resource-group <rg>] [--skip-eval]
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `play-number` | Play number (01-20) | Yes |
| `--resource-group` | Azure resource group name | No (uses default) |
| `--skip-eval` | Skip evaluation step | No |

### rebuild-knowledge.sh / rebuild-knowledge.ps1

Rebuild knowledge.json from docs/ and sync to VS Code extension.

**Usage:**
```bash
./scripts/rebuild-knowledge.sh [--publish]
```

### export-skills.sh / export-skills.ps1

Export FROOT modules as `.github/skills/` folders for GitHub Copilot.

**Usage:**
```bash
./scripts/export-skills.sh <module-id>   # e.g., F1, R2, O3
./scripts/export-skills.sh --all          # export all 16 modules
```

### auto-update.js (MCP Server)

Knowledge auto-refresh module. Checks if knowledge.json is older than 7 days and fetches latest from GitHub.

```javascript
import { getLatestKnowledge } from './auto-update.js';
const knowledge = await getLatestKnowledge();
```

## Azure Integration

### azure.yaml

Configuration for `azd up` deployment. Place in the root of any solution play.

### registry-entry.json

MCP ecosystem registry entry for FrootAI. Located at `mcp-server/registry-entry.json`.

### agent-card.json

A2A (Agent-to-Agent) protocol card. Located at `mcp-server/agent-card.json`.

---

> **Next**: [Admin Guide](./admin-guide) · [User Guide](./user-guide-complete) · [Architecture Overview](./architecture-overview)
