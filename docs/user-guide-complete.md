---
sidebar_position: 31
title: User Guide
---

# FrootAI User Guide

> The complete guide to using FrootAI — from first install to production deployment.

---

## 1. Getting Started

### Step 1: Install the VS Code Extension

```bash
code --install-extension pavleenbali.frootai
```

Or search **"FrootAI"** in the VS Code Extensions Marketplace.

### Step 2: Browse the Knowledge Hub

Open the sidebar → **FROOT Modules** panel to explore 18 knowledge modules across 5 layers:

| Layer | Modules | Focus |
|---|---|---|
| 🌱 **F**oundations | GenAI, LLM Landscape, AI Glossary, Agentic OS | Core AI concepts |
| 🪵 **R**easoning | Prompt Engineering, RAG, Deterministic AI | Making AI reliable |
| 🌿 **O**rchestration | Semantic Kernel, AI Agents, MCP & Tools | Building agents |
| 🍃 **O**perations | Azure AI, Infrastructure, Copilot Ecosystem | Platform & infra |
| 🍎 **T**ransformation | Fine-Tuning, Responsible AI, Production Patterns | Production readiness |

### Step 3: Init DevKit

Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) → **FROOT: Init DevKit**

This scaffolds the `.github/` Agentic OS into your project:
- `agent.md` — Agent behavior rules
- `copilot-instructions.md` — Copilot context
- Prompt files, CI workflows, and config templates

### Step 4: Init TuneKit

Command Palette → **FROOT: Init TuneKit**

Adds tunable configuration files:
- `config/agents.json` — Agent routing and parameters
- `config/model-comparison.json` — Model selection criteria
- `config/guardrails.json` — Safety and content limits
- `evaluation/` — Golden sets and scoring scripts

### Step 5: Deploy

Command Palette → **FROOT: Deploy Solution**

Packages your configured play for deployment. Output depends on the selected solution play.

---

## 2. Using the VS Code Extension

### 2.1 All Commands

Open Command Palette and type `FROOT:` to see all available commands:

| Command | Description |
|---|---|
| **FROOT: Browse Modules** | Open the knowledge hub and browse all 18 modules |
| **FROOT: Search Knowledge** | Full-text search across all modules |
| **FROOT: Lookup Term** | Look up any AI term in the glossary (200+ terms) |
| **FROOT: Init DevKit** | Scaffold .github Agentic OS files into your project |
| **FROOT: Init TuneKit** | Add config and evaluation files |
| **FROOT: Show Solution Plays** | Browse all 20 solution plays with status |
| **FROOT: Open Play** | Open a specific play's folder |
| **FROOT: Deploy Solution** | Package and deploy the current play |
| **FROOT: Show MCP Tools** | View documentation for all 16 MCP tools |
| **FROOT: Read User Guide** | Open this guide in the editor |
| **FROOT: Show Architecture** | Display system architecture diagram |
| **FROOT: Show Changelog** | View version history |
| **FROOT: Check Updates** | Check for new versions of all components |

### 2.2 Sidebar Panels

The FrootAI sidebar (click the 🌱 icon) has these panels:

1. **FROOT Modules** — Expandable tree of all 18 knowledge modules, color-coded by layer
2. **Solution Plays** — All 20 plays with status badges (Ready / In Progress)
3. **MCP Tools** — Documentation for all 16 MCP server tools, grouped by type
4. **Quick Actions** — One-click access to common commands

### 2.3 Standalone Mode

The extension works **offline** with bundled knowledge. It caches downloaded content in `globalStorage` with a 24-hour TTL. No internet required for core functionality.

---

## 3. Using the MCP Server

### 3.1 What is the MCP Server?

The FrootAI MCP Server exposes 16 tools that any MCP-compatible AI agent can call. It adds AI architecture knowledge to your agent's capabilities.

### 3.2 Setup

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "frootai": {
      "command": "npx",
      "args": ["frootai-mcp"]
    }
  }
}
```

### 3.3 Tool Reference

#### Static Tools (bundled knowledge)

| Tool | What it does | Example query |
|---|---|---|
| `get_module` | Retrieve a full knowledge module | "Get the RAG Architecture module" |
| `list_modules` | List all 18 modules with metadata | "What modules are available?" |
| `search_knowledge` | Full-text search across all content | "Search for vector databases" |
| `lookup_term` | Look up a term in the AI glossary | "What is LoRA?" |

#### Live Tools (real-time retrieval)

| Tool | What it does | Example query |
|---|---|---|
| `fetch_azure_docs` | Fetch current Azure documentation | "Get Azure AI Search pricing" |
| `fetch_external_mcp` | Query external MCP registries | "Find MCP servers for databases" |

#### Chain Tools (multi-step workflows)

| Tool | What it does | Example query |
|---|---|---|
| `agent_build` | Generate a new agent scaffold | "Build an IT ticket resolution agent" |
| `agent_review` | Review an agent's configuration | "Review my agent.md for security issues" |
| `agent_tune` | Optimize agent parameters | "Tune my agent for lower latency" |

#### AI Ecosystem Tools

| Tool | What it does | Example query |
|---|---|---|
| `get_architecture_pattern` | Get architecture patterns for a scenario | "Pattern for multi-agent RAG" |
| `get_froot_overview` | Overview of the FrootAI platform | "What is FrootAI?" |
| `get_github_agentic_os` | Explain the .github Agentic OS | "What files does DevKit create?" |
| `list_community_plays` | Browse community solution plays | "Show me community plays" |
| `get_ai_model_guidance` | Model selection guidance | "Compare GPT-4o vs Claude 3.5" |

### 3.4 Using in Copilot Chat

In VS Code with GitHub Copilot, you can invoke MCP tools naturally:

```
@workspace Use frootai to search for "semantic kernel orchestration"
@workspace Use frootai to get the RAG Architecture module
@workspace Use frootai agent_build to create an IT ticket agent
```

---

## 4. Solution Plays

### 4.1 What is a Solution Play?

A solution play is a **pre-configured scenario accelerator**. Each play includes:

- **README.md** — Overview, architecture, deployment steps
- **DevKit** (`.github/` Agentic OS) — Agent rules, copilot instructions, prompts, CI
- **TuneKit** (`config/` + `evaluation/`) — Tunable parameters and quality benchmarks

### 4.2 Available Plays (20)

| # | Play | Category |
|---|---|---|
| 01 | IT Ticket Resolution | IT Operations |
| 02 | Customer Support Agent | Customer Service |
| 03 | Code Review Assistant | Development |
| 04 | Security Incident Response | Security |
| 05 | Knowledge Base FAQ | Knowledge Management |
| 06 | Onboarding Assistant | HR / People |
| 07 | Sales Intelligence | Sales |
| 08 | Compliance Checker | Governance |
| 09 | Data Quality Monitor | Data Engineering |
| 10 | Infrastructure Health | Platform / SRE |
| 11 | Cost Optimization Advisor | FinOps |
| 12 | Release Notes Generator | DevOps |
| 13 | API Documentation Writer | Documentation |
| 14 | Meeting Summarizer | Productivity |
| 15 | Competitive Analysis | Strategy |
| 16 | Training Content Creator | Learning |
| 17 | Change Management | ITSM |
| 18 | Document Processor | Document AI |
| 19 | Multi-Agent Orchestrator | Agent Platform |
| 20 | Custom Play Template | Template |

### 4.3 Choosing a Play

Use the **Solution Configurator** at `/configurator` — answer 3 questions and get a recommendation. Or use the AI Assistant at `/chatbot`.

### 4.4 Customizing a Play

1. `FROOT: Init DevKit` to scaffold the play's .github files
2. Edit `agent.md` to adjust behavior rules
3. `FROOT: Init TuneKit` to add config parameters
4. Tune `config/agents.json` for your scenario
5. Run evaluation against the golden set

---

## 5. DevKit Deep Dive

The DevKit scaffolds **.github Agentic OS** — a structured set of files that make your project agent-ready.

### 5.1 File Reference

| File | Purpose |
|---|---|
| `.github/agent.md` | Primary agent behavior rules — scope, constraints, tools, error handling |
| `.github/copilot-instructions.md` | GitHub Copilot context — project structure, conventions, key files |
| `.github/prompts/init.prompt.md` | Initial prompt for bootstrapping the agent |
| `.github/prompts/review.prompt.md` | Code review prompt template |
| `.github/prompts/deploy.prompt.md` | Deployment preparation prompt |
| `.github/workflows/validate.yml` | CI pipeline — structure validation, lint, test |
| `.github/ISSUE_TEMPLATE/bug.yml` | Structured bug report template |
| `.github/ISSUE_TEMPLATE/feature.yml` | Feature request template |
| `.github/pull_request_template.md` | PR description template |

### 5.2 The 7 Primitives

The Agentic OS uses 7 composable primitives:

1. **Agent Rules** (`agent.md`) — Behavioral boundaries
2. **Context** (`copilot-instructions.md`) — Project knowledge
3. **Prompts** (`prompts/*.prompt.md`) — Reusable prompt templates
4. **Workflows** (`workflows/*.yml`) — CI/CD automation
5. **Templates** (`ISSUE_TEMPLATE/`, `pull_request_template.md`) — Structured collaboration
6. **Config** (`config/`) — Tunable parameters
7. **Evaluation** (`evaluation/`) — Quality benchmarks

---

## 6. TuneKit Deep Dive

### 6.1 Config Files

| File | Parameters |
|---|---|
| `config/agents.json` | Agent routing, model selection, temperature, max_tokens |
| `config/model-comparison.json` | Model capabilities, latency, cost comparison |
| `config/guardrails.json` | Content filters, blocked topics, rate limits |
| `config/search.json` | Search method (vector, hybrid, keyword), top_k |
| `config/chunking.json` | Chunk size, overlap, strategy |

### 6.2 Tuning Workflow

1. Review current config: `FROOT: Show Config`
2. Adjust parameters based on your scenario
3. Run evaluation: `python evaluation/evaluate.py`
4. Compare scores against the golden set
5. Iterate until quality targets are met

### 6.3 Evaluation

Each play includes:
- `evaluation/golden-set.jsonl` — Expected inputs/outputs (5+ examples)
- `evaluation/evaluate.py` — Scoring script (accuracy, latency, safety)
- Results output to `evaluation/results.json`

---

## 7. Agent Chain

The **build → review → tune** chain is a three-step workflow:

### Step 1: Build (`agent_build`)
Generate a new agent scaffold based on your scenario description. Produces `agent.md`, config files, and evaluation templates.

### Step 2: Review (`agent_review`)
Analyze the generated agent for:
- Security gaps
- Missing error handling
- Unclear scope boundaries
- Config completeness

### Step 3: Tune (`agent_tune`)
Optimize parameters based on review findings and evaluation results. Adjusts temperature, model selection, guardrails, and routing.

---

## 8. FAQ

**Q: Does FrootAI require an internet connection?**
A: Core functionality works offline. The VS Code extension bundles knowledge locally. Live tools (`fetch_azure_docs`, `fetch_external_mcp`) require connectivity.

**Q: Which AI models does FrootAI support?**
A: FrootAI is model-agnostic. Solution plays can be configured for any model in `config/agents.json`. The knowledge modules cover GPT-4o, Claude, Gemini, Phi, Llama, and more.

**Q: Can I use FrootAI without VS Code?**
A: Yes. The MCP server works with any MCP-compatible client (Claude Desktop, Cursor, Windsurf, Azure AI Foundry). The website is accessible via browser.

**Q: How do I add a custom solution play?**
A: See the [Contributor Guide](./contributor-guide) for step-by-step instructions.

**Q: Is FrootAI free?**
A: Yes. FrootAI is 100% open source under the MIT license.

**Q: How do I report a bug?**
A: Open an issue on [GitHub](https://github.com/gitpavleenbali/frootai/issues) using the bug report template.

**Q: How often is the knowledge base updated?**
A: Knowledge modules are updated with each release. The changelog tracks all content changes.

---

> **Next**: [Admin Guide](./admin-guide) · [Contributor Guide](./contributor-guide) · [API Reference](./api-reference)
