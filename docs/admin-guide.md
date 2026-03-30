---
sidebar_position: 30
title: Admin Guide
---

# FrootAI Admin Guide

> Platform administration for FrootAI — installation, configuration, monitoring, and troubleshooting.

---

## 1. Platform Overview

FrootAI is a **Build It Yourself (BIY)** AI kit consisting of four main components:

| Component | Description | Location |
|---|---|---|
| **Website** | Docusaurus-powered knowledge hub + landing pages | `website/` |
| **MCP Server** | 16 tools exposing AI knowledge to any MCP-compatible agent | `mcp-server/` |
| **VS Code Extension** | 13 commands, sidebar panels, standalone offline engine | `vscode-extension/` |
| **Solution Plays** | 20 pre-built scenario accelerators with DevKit + TuneKit | `solution-plays/` |

All components share:
- The **`docs/`** folder (18 knowledge modules in the FROOT framework)
- The **`config/`** folder (guardrails, models, routing parameters)
- The **`.github/`** Agentic OS scaffolding (agent, copilot, CI files)

---

## 2. Installation

### 2.1 Website

```bash
# Prerequisites: Node.js 18+
cd website
npm install
npx docusaurus build         # production build → website/build/
npx docusaurus start          # dev server on localhost:3000
```

**Deploy to GitHub Pages:**

```bash
GIT_USER=<github-username> npx docusaurus deploy
```

The site is configured with `baseUrl: /frootai/` in `docusaurus.config.ts`.

### 2.2 MCP Server

```bash
# Option A: npm (recommended — zero clone)
npm install -g frootai-mcp
frootai-mcp

# Option B: npx (no install)
npx frootai-mcp

# Option C: from source
cd mcp-server
npm install
node src/index.js
```

The MCP server runs on **stdio** by default. Clients configure it via their MCP config (e.g., `.vscode/mcp.json`).

### 2.3 VS Code Extension

```bash
# From Marketplace
code --install-extension pavleenbali.frootai

# From source (development)
cd vscode-extension
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

---

## 3. Configuration

### 3.1 MCP Client Config (`.vscode/mcp.json`)

```json
{
  "servers": {
    "frootai": {
      "command": "npx",
      "args": ["frootai-mcp"],
      "env": {}
    }
  }
}
```

### 3.2 Config Files (`config/`)

| File | Purpose |
|---|---|
| `openai.json` | Model parameters — temperature, max_tokens, deployment names |
| `guardrails.json` | Content safety limits, blocked topics, rate limits |
| `routing.json` | Agent routing rules — which play for which scenario |

All config files are **read at startup**. Changes require a restart of the relevant component.

### 3.3 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `FROOTAI_LOG_LEVEL` | `info` | Logging verbosity: `debug`, `info`, `warn`, `error` |
| `FROOTAI_CACHE_TTL` | `86400` | Cache TTL in seconds (24h) for downloaded knowledge |
| `FROOTAI_CONFIG_DIR` | `./config` | Path to config files |

> **Security**: FrootAI uses **Managed Identity** by design. No API keys are stored in config. See [Security](#7-security).

---

## 4. Solution Play Management

### 4.1 Adding a New Play

1. Create `solution-plays/<NN>-<slug>/` with the required structure:
   ```
   solution-plays/21-new-play/
   ├── .github/
   │   ├── agent.md          # Agent behavior rules
   │   ├── copilot-instructions.md
   │   └── prompts/
   │       └── init.prompt.md
   ├── config/
   │   └── agents.json
   ├── evaluation/
   │   ├── evaluate.py
   │   └── golden-set.jsonl
   └── README.md
   ```

2. Populate `agent.md` (target: 1500–5000 bytes) with:
   - Play context and scope
   - Behavioral rules
   - Tool references
   - Error-handling instructions

3. Run validation:
   ```bash
   # CI will catch issues, but you can validate locally:
   python scripts/validate-plays.py
   ```

### 4.2 Quality Standards

- Every play must have: `README.md`, `agent.md`, `copilot-instructions.md`
- `agent.md` must be 1500–5000 bytes
- At least one config file in `config/`
- Evaluation set with 5+ golden examples

---

## 5. MCP Server Administration

### 5.1 Health Check

```bash
# Verify the server starts and lists tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx frootai-mcp
```

### 5.2 Tool Inventory

The MCP server exposes **16 tools** in four groups:

| Group | Tools | Description |
|---|---|---|
| **Static** | `get_module`, `list_modules`, `search_knowledge`, `lookup_term` | Bundled knowledge queries |
| **Live** | `fetch_azure_docs`, `fetch_external_mcp` | Real-time documentation retrieval |
| **Chain** | `agent_build`, `agent_review`, `agent_tune` | Multi-step agent workflows |
| **AI Ecosystem** | `get_architecture_pattern`, `get_froot_overview`, `get_github_agentic_os`, `list_community_plays` | Ecosystem & pattern tools |

### 5.3 Upgrading

```bash
# npm global install
npm update -g frootai-mcp

# Verify version
npx frootai-mcp --version
```

---

## 6. Monitoring

### 6.1 CI Pipeline

The repository uses GitHub Actions for continuous validation:

| Workflow | Trigger | What it checks |
|---|---|---|
| `validate-plays.yml` | Push to `solution-plays/` | Play structure, agent.md size, required files |
| `build-website.yml` | Push to `website/` or `docs/` | Docusaurus build success, broken links |
| `test-mcp.yml` | Push to `mcp-server/` | Tool registration, response schema |

### 6.2 Build Status

Monitor at: `https://github.com/frootai/frootai/actions`

### 6.3 Website Deploy Health

After deploy, verify:
- Homepage loads: `https://frootai.dev`
- Docs render: `https://frootai.dev/docs/`
- No console errors in browser DevTools

---

## 7. Security

### 7.1 Managed Identity

FrootAI follows the **no API keys** principle:

- All Azure service access uses **Managed Identity** or **DefaultAzureCredential**
- Config files contain **no secrets** — only model names, limits, and routing rules
- The MCP server is a **local stdio process** — no network ports exposed

### 7.2 Content Safety

- `guardrails.json` defines blocked topics and content filters
- Agent behaviors are bounded by `agent.md` rules in each play
- Evaluation sets validate that responses stay within safety guidelines

### 7.3 RBAC

- GitHub repository uses branch protection on `main`
- CI must pass before merge
- Solution plays require reviewer approval

---

## Deployment Automation

### One-Command Deployment

Deploy any solution play end-to-end:

```bash
./scripts/deploy-play.sh <play-number> --resource-group <rg-name>
```

Prerequisites: Azure CLI logged in, resource group created, Bicep installed.

### Knowledge Management

Rebuild knowledge bundle after updating docs/:
```bash
./scripts/rebuild-knowledge.sh          # rebuild only
./scripts/rebuild-knowledge.sh --publish # rebuild + npm publish
```

### Skill Export

Export FROOT modules as GitHub Copilot skills:
```bash
./scripts/export-skills.sh --all
```

### azd Integration

FrootAI supports Azure Developer CLI:
```bash
azd up  # deploys using azure.yaml configuration
```

---

## 8. Troubleshooting

### 8.1 Common Issues

| Issue | Cause | Fix |
|---|---|---|
| MCP server not found | npm not in PATH | Run `npm config get prefix` and add to PATH |
| Extension commands missing | Extension not activated | Reload VS Code window (`Cmd+Shift+P → Reload`) |
| Website build fails | Missing deps or broken links | Run `npm install` then check `onBrokenLinks` in config |
| Play validation fails | Missing required files | Check `README.md`, `agent.md`, `copilot-instructions.md` exist |
| Stale knowledge | Cached data expired | Delete `globalStorage/frootai/` cache folder |

### 8.2 Logs

```bash
# MCP server debug logging
FROOTAI_LOG_LEVEL=debug npx frootai-mcp

# VS Code extension logs
# Output panel → select "FrootAI" from dropdown

# Website build verbose
npx docusaurus build --verbose
```

### 8.3 Getting Help

- **GitHub Issues**: [github.com/frootai/frootai/issues](https://github.com/frootai/frootai/issues)
- **Discussions**: [github.com/frootai/frootai/discussions](https://github.com/frootai/frootai/discussions)
- **Changelog**: [Developer Hub → Changelog](/dev-hub-changelog)

---

> **Next**: [User Guide](./user-guide-complete) · [Contributor Guide](./contributor-guide) · [API Reference](./api-reference)
