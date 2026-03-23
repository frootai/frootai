# FrootAI — From the Roots to the Fruits 🌳

> **The open glue binding Infrastructure, Platform & Application teams with the GenAI ecosystem.**
> Works standalone from any workspace — no clone needed.

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
- **▶️ Start MCP Server** → Launches `npx frootai-mcp` in terminal (10 tools ready)

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

**19 files from one command. Your coding agent is instantly solution-aware.**

---

## ⚙️ TuneKit — What Gets Initialized

When you run **Init TuneKit**, FrootAI copies production AI configuration:

| File | What It Controls |
|------|-----------------|
| `config/openai.json` | temperature, top-k, max_tokens, model, JSON schema |
| `config/guardrails.json` | blocked topics, PII filters, abstention rules |
| `config/search.json` | hybrid weights, reranking, relevance thresholds |
| `config/chunking.json` | chunk size, overlap, strategy |
| `infra/main.bicep` | One-click Azure deploy (Bicep IaC) |
| `infra/parameters.json` | Environment-specific knobs |
| `evaluation/test-set.jsonl` | Ground-truth test cases |
| `evaluation/eval.py` | Automated quality scoring |

**Pre-tuned by architects. Review, adjust, deploy, validate.**

---

## 📋 Sidebar Panels (4 panels)

| Panel | What's Inside |
|-------|-------------|
| **🎯 Solution Plays (20)** | Click → action menu · Right-click → Init DevKit/TuneKit |
| **🔌 MCP Tools (10)** | Right-click → Install/Start MCP Server |
| **Φ Knowledge Hub (18)** | Click → read module in rich webview panel |
| **📖 AI Glossary (200+)** | Click → read term definition in webview |

---

## 🔌 MCP Server Integration

The extension works alongside the FrootAI MCP Server (`npx frootai-mcp`):
- **MCP Server** = for your **AI agent** (Copilot, Claude, Cursor call its 10 tools)
- **VS Code Extension** = for **you** (browse, search, scaffold, learn)

Install MCP: Right-click any tool in MCP panel → **Install MCP Server** → choose method.

---

## 🔍 All 12 Commands (Ctrl+Shift+P)

| Command | What It Does |
|---------|-------------|
| **Init DevKit** | .github Agentic OS (19 files) |
| **Init TuneKit** | config + infra + evaluation |
| **Install MCP Server** | npm/npx/config setup |
| **Start MCP Server** | Launch in terminal |
| Init Hooks | guardrails.json |
| Init Prompts | 4 slash commands |
| Look Up AI Term | 200+ glossary (inline webview) |
| Search Knowledge Base | Full-text 18 modules |
| Open Solution Play | Rich webview panel |
| Show Architecture Pattern | 7 decision guides |
| Open Setup Guide | Website |
| Browse Solution Plays | Website |

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

**FrootAI** — The open glue for GenAI. From the roots to the fruits.
Built by [Pavleen Bali](https://linkedin.com/in/pavleenbali)
