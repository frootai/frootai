# frootai-mcp

> **AI architecture knowledge + agent chain as an MCP skill.** 22 tools (6 static + 4 live + 3 agent chain + 3 AI ecosystem + 6 compute), 18 modules, 200+ terms. Hybrid: works offline + fetches live Azure docs. Auto-chain: Build → Review → Tune in chat.

## Install & Run

```bash
npx frootai-mcp
```

Or install globally:

```bash
npm install -g frootai-mcp
frootai-mcp
```

## MCP Config

**Claude Desktop** / **Cursor**:
```json
{
  "mcpServers": {
    "frootai": { "command": "npx", "args": ["frootai-mcp"] }
  }
}
```

**VS Code** (`.vscode/mcp.json`):
```json
{
  "servers": {
    "frootai": { "command": "npx", "args": ["frootai-mcp"] }
  }
}
```

## 16 Tools

### Static Tools (bundled knowledge — works offline)

| Tool | Description |
|------|------------|
| `list_modules` | Browse 18 modules by FROOT layer |
| `get_module` | Read module content (F1–T3, F4: .github Agentic OS) |
| `lookup_term` | 200+ AI/ML term definitions |
| `search_knowledge` | Full-text search all modules |
| `get_architecture_pattern` | 7 decision guides (RAG, agents, hosting, cost, etc.) |
| `get_froot_overview` | Complete FROOT framework summary |

### Live Tools (network-enabled — graceful fallback if offline)

| Tool | Description |
|------|------------|
| `fetch_azure_docs` | Search Microsoft Learn for Azure service docs |
| `fetch_external_mcp` | Find MCP servers from public registries |
| `list_community_plays` | List 20 solution plays from GitHub |
| `get_github_agentic_os` | .github agentic OS guide (7 primitives) |

### Agent Chain Tools (Build → Review → Tune in chat)

| Tool | Description |
|------|------------|
| `agent_build` | 🛠️ Builder — architecture guidance + building rules, suggests review |
| `agent_review` | 🔍 Reviewer — security + quality checklist, suggests tuning |
| `agent_tune` | 🎛️ Tuner — production readiness validation, suggests deploy |

**How auto-chain works:** Just talk in Copilot Chat:
1. "Build me an IT ticket API" → `agent_build` returns guidance + *"ask me to review"*
2. "Review this code" → `agent_review` returns checklist + *"ask me to tune"*
3. "Validate my config" → `agent_tune` returns verdict + *"ready to deploy"*

No clipboard. No commands. Pure conversation.

### AI Ecosystem Tools (NEW in v2.2)

| Tool | Description |
|------|------------|
| `get_model_catalog` | Azure AI model catalog with pricing, capabilities, and recommendations |
| `get_azure_pricing` | Monthly cost estimates for RAG, agent, batch, realtime scenarios |
| `compare_models` | Side-by-side model comparison for a specific use case |

## What's Inside

- **18 FROOT modules** — Foundations, Reasoning, Orchestration, Operations, Transformation
- **200+ AI/ML glossary terms** — from ablation to zero-shot
- **7 architecture decision guides** — RAG, agents, hosting, cost, deterministic AI, multi-agent, fine-tuning
- **682KB knowledge bundle** — curated, verified, zero hallucination
- **20 solution plays** — with .github Agentic OS (19 files × 20 plays)
- **3 agent chain tools** — Build → Review → Tune in natural conversation

## Links

- **Website**: https://frootai.dev
- **GitHub**: https://github.com/gitpavleenbali/frootai
- **VS Code Extension**: https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai
- **Setup Guide**: https://frootai.dev/setup-guide

---

**FrootAI** — The open glue binding Infrastructure, Platform & Application teams with the GenAI ecosystem. From the roots to the fruits.
