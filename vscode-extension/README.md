# FrootAI — From the Roots to the Fruits 🌳

> **The open glue binding Infrastructure, Platform & Application teams with the GenAI ecosystem.**
> Works standalone from any workspace — no clone needed.

---

## ⚡ NEW: Auto-Chain Agents (Build → Review → Tune)

Run `Ctrl+Shift+P` → **FrootAI: Auto-Chain Agents** to start a guided workflow:

1. **🛠️ Builder Agent** — describe what to build → Copilot generates solution-aware code
2. **🔍 Reviewer Agent** — auto-reviews for security, quality, Azure best practices
3. **🎛️ Tuner Agent** — validates TuneKit configs for production readiness
4. **🚀 Deploy** — optional deployment walkthrough

Each step prompts you to continue to the next. The full `builder → reviewer → tuner` chain in one flow.

---

## 🚀 Quick Actions (Click or Right-Click)

### Solution Plays — Click any play → Action Menu appears:
- **📖 Read Documentation** → Rich rendered panel with diagrams
- **🛠️ Init DevKit** → Full .github Agentic OS (19 files: instructions, prompts, agents, skills, hooks, workflows)
- **⚙️ Init TuneKit** → config/*.json (AI parameters) + infra/main.bicep + evaluation/
- **🛡️ Init Hooks** → guardrails.json (preToolUse policy gates)
- **📝 Init Prompts** → 4 slash commands (/deploy, /test, /review, /evaluate)
- **🔗 Open on GitHub** → Jump to solution play on GitHub

### MCP Tools — Right-click any tool:
- **📦 Install MCP Server** → Choose: Install globally (npm) / Run directly (npx) / Add .vscode/mcp.json
- **▶️ Start MCP Server** → Launches `npx frootai-mcp` in terminal (16 tools ready)
- **ℹ️ View Tool Documentation** → Rich webview panel with tool docs, input/output, examples

---

## 🛠️ DevKit — What Gets Initialized

When you run **Init DevKit**, FrootAI copies the complete .github Agentic OS to your workspace:

| Layer | Files | What They Do |
|-------|-------|-------------|
| **Layer 1** | `instructions/*.instructions.md` | Coding standards, solution patterns, security rules |
| **Layer 2** | `prompts/*.prompt.md` | /deploy, /test, /review, /evaluate slash commands |
| **Layer 2** | `agents/*.agent.md` | builder → reviewer → tuner (chained agents) |
| **Layer 2** | `skills/*/SKILL.md` | deploy-azure, evaluate, tune (self-contained) |
| **Layer 3** | `hooks/guardrails.json` | preToolUse policy gates (block secrets in code) |
| **Layer 3** | `workflows/*.md` | AI-driven CI: review PRs, deploy to Azure |
| **+** | `agent.md` + `.vscode/mcp.json` + `plugin.json` | Co-coder context + MCP auto-connect + plugin manifest |
| **+** | `infra/main.bicep` + `infra/parameters.json` | Azure infrastructure templates (Bicep IaC) |

**21+ files from one command. Code + infrastructure + agentic OS.**

---

## ⚙️ TuneKit — What Gets Initialized

When you run **Init TuneKit**, FrootAI copies AI fine-tuning configuration (NO infra — that's in DevKit):

| File | What It Controls |
|------|------------------|
| `config/openai.json` | temperature, top-k, top-p, max_tokens, model, JSON schema |
| `config/guardrails.json` | blocked topics, PII filters, abstention rules, toxicity |
| `config/search.json` | hybrid weights, semantic ranking, relevance thresholds |
| `config/chunking.json` | chunk size, token overlap, strategy, indexing |
| `config/agents.json` | Agent behavior tuning: personas, handoff, tool permissions |
| `config/model-comparison.json` | Model selection guide: cost vs quality, benchmarks |
| `evaluation/test-set.jsonl` | Ground-truth test cases |
| `evaluation/eval.py` | Automated quality scoring (groundedness, relevance, fluency) |

**Infra teams can tune AI without being AI specialists.**

---

## 📋 Sidebar Panels (4 panels)

| Panel | What's Inside |
|-------|-------------|
| **🎯 Solution Plays (20)** | Click → action menu · Right-click → Init DevKit/TuneKit |
| **🔌 MCP Tools (16)** | Grouped: 📦 Static (6) + ⛅ Live (4) + 🔗 Chain (3) + 🧠 AI (3) · Click → docs/actions |
| **Φ Knowledge Hub (18)** | Color-coded layers (yellow/green/blue/purple) + module descriptions |
| **📖 AI Glossary (200+)** | Click → read term definition in webview |

---

## 🔌 MCP Server Integration

The extension works alongside the FrootAI MCP Server (`npx frootai-mcp`):
- **MCP Server** = for your **AI agent** (Copilot, Claude, Cursor call its 16 tools)
- **VS Code Extension** = for **you** (browse, search, scaffold, learn)
- **Cached downloads** = DevKit Init caches files locally for 24h — works offline after first download

Install MCP: Right-click any tool in MCP panel → **Install MCP Server** → choose method.

---

## 🔍 All 13 Commands (Ctrl+Shift+P)

| Command | What It Does |
|---------|-------------|
| **Init DevKit** | .github Agentic OS (19 files) + infra |
| **Init TuneKit** | 8 AI config files (agents.json, model-comparison.json...) |
| **Auto-Chain Agents** | Build → Review → Tune guided workflow |
| **Install MCP Server** | npm/npx/config setup |
| **Start MCP Server** | Launch 16-tool server in terminal |
| **Configure MCP** | Add .vscode/mcp.json to workspace |
| Init Hooks | guardrails.json |
| Init Prompts | 4 slash commands |
| Look Up AI Term | 200+ glossary (inline webview) |
| Search Knowledge Base | Full-text 18 modules |
| Open Solution Play | Rich webview panel |
| Show Architecture Pattern | 7 decision guides |
| Open Setup Guide | Website |

---

## 📦 Install

**From VS Code Marketplace:**
```
Ctrl+Shift+X → Search "FrootAI" → Install
```

**From terminal:**
```bash
code --install-extension pavleenbali.frootai
```

---

## Links

- **Website**: https://gitpavleenbali.github.io/frootai/
- **GitHub**: https://github.com/gitpavleenbali/frootai
- **MCP Server (npm)**: https://www.npmjs.com/package/frootai-mcp
- **Setup Guide**: https://gitpavleenbali.github.io/frootai/setup-guide
- **Example User Guide**: https://gitpavleenbali.github.io/frootai/user-guide-05

---

## 🎯 Example: Deploy IT Ticket Resolution in 5 Minutes

Here's how to use FrootAI to build Solution Play 05 (IT Ticket Resolution):

**1.** Open FrootAI sidebar → **Left-click** `🎫 05 — IT Ticket Resolution`
**2.** Select **🛠️ Init DevKit** → 19 files copied (.github Agentic OS + agent.md + MCP config)
**3.** Select **⚙️ Init TuneKit** → config/*.json + infra/main.bicep + evaluation/ copied
**4.** Open **Copilot Chat** → enable **FrootAI tools** (🔧 icon)
**5.** Ask: *"Build me an IT ticket classification system using Logic Apps + OpenAI"*
**6.** Copilot generates solution-aware code (reads agent.md, follows instructions, uses config values)
**7.** Type **/review** → security + quality checklist
**8.** Type **/deploy** → Azure deployment walkthrough

**Result:** Production-ready IT ticket resolution — classified, routed, deployed. No AI specialist needed.

📖 [Full User Guide for Play 05 →](https://gitpavleenbali.github.io/frootai/user-guide-05)

---

## 📰 What's New in v0.9.0

| Feature | Description |
|---------|-------------|
| **Cached downloads** | DevKit Init caches files in VS Code globalStorage (24h TTL) — offline after first download |
| **Layer colors** | FROOT Modules panel shows color-coded layer icons (yellow/green/blue/purple) |
| **Module descriptions** | Each module shows a one-line description in sidebar (e.g., "R2: Retrieval-Augmented Generation patterns") |
| **MCP tool docs webview** | Click any MCP tool → "View Tool Documentation" → rich HTML panel with input/output, examples |
| **Tool grouping** | MCP Tools panel now groups: 📦 Static (6) + ⛅ Live (4) + 🔗 Chain (3) + 🧠 AI Ecosystem (3) |
| **16 MCP tools** | 3 new AI ecosystem tools: `get_model_catalog`, `get_azure_pricing`, `compare_models` |

---

**FrootAI v0.9.0** — The open glue for GenAI. From the roots to the fruits.
Built by [Pavleen Bali](https://linkedin.com/in/pavleenbali)
