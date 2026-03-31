# FrootAI SDK — Integration & Embedding Guide

> Embed FrootAI's AI architecture knowledge engine into your platform, editor, pipeline, or product.

[![npm](https://img.shields.io/npm/v/frootai-mcp?style=flat-square&label=npm)](https://www.npmjs.com/package/frootai-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](../LICENSE)

---

## What is the FrootAI SDK?

FrootAI is an **AI architecture knowledge engine** that exposes:

- **16 MCP tools** — callable by any MCP-compatible agent
- **18 knowledge modules** — covering the full AI stack (tokens → production)
- **200+ AI terms** — precise glossary with definitions and context
- **7 architecture patterns** — decision guides for RAG, agents, models, cost
- **20 solution plays** — pre-tuned, deployable AI solution templates

This SDK guide shows how to **embed FrootAI into your product** through
six integration surfaces. Each surface is independent — use one or combine several.

---

## Integration Surfaces

| Surface | Protocol | Status | Best For |
|---------|----------|--------|----------|
| MCP Server | MCP/stdio | ✅ Live | Any MCP-compatible agent (Copilot, Claude, Cursor) |
| VS Code Extension | VS Code API | ✅ Live | Editor-native knowledge browsing |
| REST API | HTTP/JSON | 🔜 Planned | Backend services, web apps |
| GitHub Action | CI/CD | 🔜 Planned | Pipeline-time architecture validation |
| Copilot Extension | GitHub Copilot | 🔜 Planned | @frootai in GitHub Copilot Chat |
| White-label | Licensing | 🔜 Planned | Rebrand and deploy internally |

---

## 1. Embed as MCP Server

**The primary integration surface.** Any agent that supports the Model Context Protocol
can call FrootAI tools directly.

### Installation

```bash
# Zero-install — run directly
npx frootai-mcp

# Or install as dependency
npm install frootai-mcp
```

### Configuration (MCP client)

Add to your MCP configuration file (Claude Desktop, VS Code, Cursor, etc.):

```json
{
  "mcpServers": {
    "frootai": {
      "command": "npx",
      "args": ["frootai-mcp"]
    }
  }
}
```

### Verified Clients

| Client | Config Location | Tested |
|--------|----------------|--------|
| Claude Desktop | `claude_desktop_config.json` | ✅ |
| VS Code / GitHub Copilot | `.vscode/mcp.json` | ✅ |
| Cursor | Cursor settings → MCP | ✅ |
| Windsurf | Windsurf MCP config | ✅ |
| Azure AI Foundry | Agent tool definition | ✅ |
| Continue.dev | `config.json` → mcpServers | ✅ |

### Calling Tools Programmatically

If you're building an MCP client, the tool interface is:

```javascript
// Example: call lookup_term via MCP protocol
const result = await mcpClient.callTool("lookup_term", {
  term: "retrieval augmented generation"
});
// Returns: { definition, context, relatedTerms, module }
```

### Available Tools (16 total)

| Category | Tools | Description |
|----------|-------|-------------|
| **Static** (6) | `list_modules`, `get_module`, `lookup_term`, `search_knowledge`, `get_architecture_pattern`, `get_froot_overview` | Bundled knowledge — no network, <100ms |
| **Live** (4) | `fetch_azure_docs`, `fetch_external_mcp`, `list_community_plays`, `get_github_agentic_os` | Network-enabled with graceful fallback |
| **Agent Chain** (3) | `agent_build`, `agent_review`, `agent_tune` | Build → Review → Tune workflow |
| **AI Ecosystem** (3) | `get_model_catalog`, `get_azure_pricing`, `compare_models` | Model selection and cost estimation |

---

## 2. Embed as VS Code Extension

Ship FrootAI knowledge in your VS Code-based product or fork.

### Install from Marketplace

```bash
code --install-extension frootai.frootai-vscode
```

### What the Extension Provides

- **13 commands** (Ctrl+Shift+P): Look Up Term, Search Knowledge, Init DevKit, Architecture Patterns, etc.
- **Sidebar panels**: Solution Plays browser, FROOT Modules viewer, MCP Tools reference
- **Status bar**: Quick access to FrootAI actions
- **Bundled knowledge.json** (682 KB): Works offline, no API calls needed

### Embedding in a Custom VS Code Distribution

If you ship a custom VS Code distribution (e.g., GitHub Codespaces, Azure Data Studio):

```json
// Add to your default extensions list
{
  "recommendations": ["frootai.frootai-vscode"]
}
```

Or bundle the extension VSIX directly in your distribution.

---

## 3. Embed as REST API (Future)

> **Status:** Planned — Azure Function proxy exposing MCP tools over HTTP.

Deploy FrootAI as a REST API using Azure Functions:

```
POST /api/lookup_term
{ "term": "retrieval augmented generation" }

POST /api/search_knowledge
{ "query": "how to design RAG pipeline" }

POST /api/get_architecture_pattern
{ "pattern": "rag" }

POST /api/compare_models
{ "useCase": "enterprise chatbot", "models": ["gpt-4o", "gpt-4o-mini"] }
```

**Architecture:**
```
Client → Azure Front Door → Azure Function (Node.js)
                                     ↓
                              frootai-mcp (in-process)
                                     ↓
                              knowledge.json (bundled)
```

Authentication: Managed Identity + API key (for external consumers).

---

## 4. Embed as GitHub Action (Future)

> **Status:** Planned — CI/CD integration for architecture validation.

Add FrootAI to your CI pipeline to validate AI architecture decisions:

```yaml
# .github/workflows/ai-review.yml
name: AI Architecture Review
on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: frootai/architecture-review@v1
        with:
          play: "enterprise-rag"
          check-config: true
          check-infra: true
          check-evaluation: true
```

**What it validates:**
- Solution play structure (DevKit + TuneKit present)
- AI config parameters within safe ranges (temperature, max tokens)
- Infrastructure security (private endpoints, managed identity)
- Evaluation test cases defined and passing

---

## 5. Embed as Copilot Extension (Future)

> **Status:** Planned — `@frootai` in GitHub Copilot Chat.

```
@frootai which AI model should I use for a document summarization pipeline?
@frootai estimate the monthly cost for an enterprise RAG solution
@frootai show me the architecture pattern for multi-agent orchestration
```

The Copilot Extension wraps the MCP server tools into a conversational interface
directly in GitHub Copilot Chat, with no MCP configuration required by the user.

---

## 6. White-Label Licensing (Future)

> **Status:** Planned — for consulting firms and platform companies.

Rebrand and deploy FrootAI internally as your own AI architecture toolkit:

- **Custom branding** — your logo, colors, terminology
- **Custom knowledge modules** — add your organization's standards and patterns
- **Custom solution plays** — pre-configured for your client engagements
- **Private deployment** — Azure Container App or on-premises

Contact: [pavleen.bali@microsoft.com](mailto:pavleen.bali@microsoft.com) for licensing inquiries.

---

## API Surface Reference

### Core Data Assets

| Asset | Format | Size | Description |
|-------|--------|------|-------------|
| `knowledge.json` | JSON | 682 KB | All 18 modules + 200+ terms, bundled |
| `agent-card.json` | JSON (A2A) | 3 KB | Agent Card for A2A protocol interop |
| `registry-entry.json` | JSON | 4 KB | MCP registry entry for discoverability |

### Tool Input/Output Schema

Every MCP tool follows this pattern:

```typescript
interface ToolCall {
  name: string;          // e.g. "lookup_term"
  arguments: Record<string, unknown>;  // tool-specific params
}

interface ToolResult {
  content: Array<{
    type: "text";
    text: string;        // Markdown-formatted response
  }>;
}
```

### Knowledge Module IDs

```
F1  GenAI-Foundations        F2  LLM-Landscape
F3  AI-Glossary-AZ          F4  GitHub-Agentic-OS
R1  Prompt-Engineering       R2  RAG-Architecture
R3  Deterministic-AI
O1  Semantic-Kernel          O2  AI-Agents-Deep-Dive
O3  MCP-Tools-Functions
O4  Azure-AI-Foundry         O5  AI-Infrastructure
O6  Copilot-Ecosystem
T1  Fine-Tuning-MLOps        T2  Responsible-AI-Safety
T3  Production-Patterns
```

---

## Architecture Decision: Why MCP-First?

FrootAI chose MCP as the primary integration protocol because:

1. **Universal agent compatibility** — every major AI coding agent supports MCP
2. **Zero-config for users** — `npx frootai-mcp` and it works
3. **Composable** — agents pick and choose which tools to call
4. **Offline-capable** — static tools work without network
5. **Extensible** — new tools can be added without breaking existing integrations
6. **Protocol-level interop** — works across Claude, Copilot, Cursor, Windsurf, and more

The REST API, GitHub Action, and Copilot Extension surfaces all wrap the same
MCP tool implementations — one source of truth, multiple delivery mechanisms.

---

## Getting Started

1. **Try it now:** `npx frootai-mcp` — works in 30 seconds
2. **Browse the tools:** Add to your MCP config and ask your agent to `list_modules`
3. **Read the docs:** [frootai.dev](https://frootai.dev)
4. **Star the repo:** [github.com/frootai/frootai](https://github.com/frootai/frootai)

---

## License

MIT — use it, embed it, extend it, ship it.

> **FrootAI v2.2** — *The open glue for AI architecture.*
> 18 modules · 16 MCP tools · 20 solution plays · 200+ AI terms
