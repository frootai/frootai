# FrootAI — From the Roots to the Fruits

> **The open glue for GenAI.** 18 modules, 200+ terms, 20 solution plays, 22 MCP tools — works standalone from any workspace.

[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/pavleenbali.frootai)](https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai) [![Installs](https://img.shields.io/visual-studio-marketplace/i/pavleenbali.frootai)](https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai)

---

## Install

```bash
# From VS Code
Ctrl+Shift+X → Search "FrootAI" → Install
```

```bash
# Or from terminal
code --install-extension pavleenbali.frootai
```

---

## 4 Sidebar Panels

| Panel | Content |
|-------|---------|
| **Solution Plays (20)** | Click any play > action menu (Read, Init DevKit, Init TuneKit, Init Hooks, Init Prompts) |
| **MCP Tools (22)** | 5 groups: Static(6) + Live(4) + Chain(3) + Ecosystem(3) + Compute(6). Click > docs/actions |
| **Knowledge Hub (18)** | Color-coded FROOT layers with module descriptions |
| **AI Glossary (200+)** | Click any term for definition |

---

## 16 Commands (Ctrl+Shift+P)

| Command | What it does |
|---------|-------------|
| **Auto-Chain Agents** | Build > Review > Tune guided workflow |
| **Quick Cost Estimate** | Pick a play + scale > Azure cost breakdown |
| **Validate Config** | Validate config/*.json against best practices |
| **Init DevKit** | .github Agentic OS (19 files) + infra templates |
| **Init TuneKit** | 8 AI config files (agents.json, model-comparison.json, etc.) |
| **Init Hooks** | guardrails.json (preToolUse policy gates) |
| **Init Prompts** | 4 slash commands (/deploy, /test, /review, /evaluate) |
| **Install MCP Server** | npm/npx/config setup picker |
| **Start MCP Server** | Launch 22-tool MCP server in terminal |
| **Configure MCP** | Add .vscode/mcp.json to workspace |
| **Browse Solution Plays** | Quick pick from 20 plays |
| **Look Up AI Term** | 200+ glossary search |
| **Search Knowledge Base** | Full-text search 18 modules |
| **Open Solution Play** | Rich webview with diagrams |
| **Show Architecture Pattern** | 7 decision guides |
| **Open Setup Guide** | frootai.dev setup page |

---

## DevKit  What Gets Initialized

One command copies the complete .github Agentic OS to your workspace:

| Layer | Files |
|-------|-------|
| Context | `instructions/*.instructions.md`  coding standards, security rules |
| Capabilities | `prompts/*.prompt.md`  /deploy, /test, /review, /evaluate |
| Capabilities | `agents/*.agent.md`  builder, reviewer, tuner (chained) |
| Capabilities | `skills/*/SKILL.md`  deploy-azure, evaluate, tune |
| Enforcement | `hooks/guardrails.json`  preToolUse policy gates |
| Enforcement | `workflows/*.md`  AI-driven CI |
| Infrastructure | `infra/main.bicep` + `parameters.json` |

**21+ files from one command.**

---

## TuneKit  What Gets Initialized

AI configuration only (no infra  that is in DevKit):

| File | Controls |
|------|----------|
| `config/openai.json` | temperature, max_tokens, model, JSON schema |
| `config/guardrails.json` | blocked topics, PII filters, toxicity |
| `config/search.json` | hybrid weights, semantic ranking |
| `config/chunking.json` | chunk size, overlap, strategy |
| `config/agents.json` | personas, handoffs, tool permissions |
| `config/model-comparison.json` | cost vs quality benchmarks |
| `evaluation/test-set.jsonl` | ground-truth test cases |
| `evaluation/eval.py` | automated quality scoring |

---

## MCP Server Integration

The extension works alongside `npx frootai-mcp` (22 tools):

- **MCP Server** = for your **AI agent** (Copilot, Claude, Cursor call 22 tools)
- **VS Code Extension** = for **you** (browse, search, scaffold, estimate costs)
- **Cached downloads** = DevKit Init caches files locally for 24h

---

## Example: 5-Minute Deploy

1. Open FrootAI sidebar > Click **IT Ticket Resolution**
2. Select **Init DevKit** > 19 files copied
3. Select **Init TuneKit** > config + eval copied
4. Open Copilot Chat > Ask: *"Build me an IT ticket classification system"*
5. Type **/review** > security checklist
6. Type **/deploy** > Azure deployment

---

## Links

| | |
|---|---|
| **Website** | [frootai.dev](https://frootai.dev) |
| **npm** | [npmjs.com/package/frootai-mcp](https://www.npmjs.com/package/frootai-mcp) |
| **GitHub** | [github.com/gitpavleenbali/frootai](https://github.com/gitpavleenbali/frootai) |

---

**FrootAI v1.0.5** — 22 MCP tools, 16 commands, 20 solution plays, 18 modules, 200+ terms. From the roots to the fruits.
