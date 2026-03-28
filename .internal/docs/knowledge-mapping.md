# FrootAI Knowledge Mapping — Self-Reference for AI Agents

> **Purpose:** Reference document for any AI agent (Copilot, Claude, etc.) working on this codebase.
> **Last updated:** March 28, 2026 (post P1-P6 completion)
> **Use:** Read this file at the START of any new session to understand the full ecosystem.

---

## Source of Truth — Canonical Values

| Fact | Value | Source File |
|------|-------|-------------|
| MCP tools | **23** | `mcp-server/index.js` (count `server.tool(` calls) |
| Solution plays | **20** (all Ready) | `python-sdk/frootai/plays.py` |
| VS Code commands | **19** | `vscode-extension/package.json` → contributes.commands |
| VS Code version | **1.4.0** | `vscode-extension/package.json` → version |
| npm MCP version | **3.2.0** | `mcp-server/package.json` → version |
| Python SDK version | **3.3.0** | `python-sdk/pyproject.toml` → version |
| Python MCP version | **3.2.0** | `python-mcp/pyproject.toml` → version |
| Knowledge modules | **16** | `mcp-server/knowledge.json` → modules (dict keys) |
| Glossary terms | **159+** | Extracted at runtime from module content |
| FROOT layers | **5** (F, R, O_ORCH, O_OPS, T) | `mcp-server/knowledge.json` → layers |
| Website pages | **26** | `website/src/pages/*.tsx` |
| CI/CD workflows | **13** | `.github/workflows/*.yml` |
| Distribution channels | **8** | npm, PyPI SDK, PyPI MCP, Docker, VS Code, CLI, REST API, GitHub |
| Workshops | **3** | `workshops/` directory |
| Community plugins | **3** | `community-plugins/` (ServiceNow, Salesforce, SAP) |
| Bicep modules | **2** | `bicep-registry/` (ai-landing-zone, enterprise-rag) |

---

## File Map — Where Everything Lives

### Core Product
| Component | Path | What |
|-----------|------|------|
| MCP Server (Node.js) | `mcp-server/index.js` | 23 MCP tools, 682KB knowledge |
| MCP CLI | `mcp-server/cli.js` | 6 commands (init, scaffold, search, cost, validate, doctor) |
| Knowledge Base | `mcp-server/knowledge.json` | 16 modules, 682KB |
| VS Code Extension | `vscode-extension/src/extension.js` | 19 commands, 2 sidebar panels |
| Python SDK | `python-sdk/frootai/` | client, plays, evaluation, ab_testing, cli |
| Python MCP | `python-mcp/frootai_mcp/server.py` | 22 tools (same as Node.js minus run_evaluation) |
| REST API | `functions/server.js` | 6 endpoints, chatbot system prompt |
| Foundry Agent | `foundry-agent/agent.py` | Azure AI Foundry hosted agent |

### Website (Docusaurus)
| Page | Path | Key Data |
|------|------|----------|
| Homepage | `website/src/pages/index.tsx` | Stats, FROOT layers, outcomes |
| Solution Plays | `website/src/pages/solution-plays.tsx` | 20 plays, all Ready |
| MCP Tooling | `website/src/pages/mcp-tooling.tsx` | 23 tools, install methods |
| VS Code | `website/src/pages/vscode-extension.tsx` | 19 commands, v1.4.0 |
| Ecosystem | `website/src/pages/ecosystem.tsx` | 8 channels incl Python |
| Setup Guide | `website/src/pages/setup-guide.tsx` | Parts 1-5 (MCP, VS Code, CLI, Docker, Python) |
| Packages | `website/src/pages/packages.tsx` | 16 modules by layer |
| CLI | `website/src/pages/cli.tsx` | 6 commands |
| Docker | `website/src/pages/docker.tsx` | Multi-arch, install |
| API Docs | `website/src/pages/api-docs.tsx` | 6 REST endpoints |
| Enterprise | `website/src/pages/enterprise.tsx` | Support tiers (Free/Pro/Enterprise) |
| Learning Hub | `website/src/pages/learning-hub.tsx` | Certification (Associate/Professional/Expert) |
| Configurator | `website/src/pages/configurator.tsx` | 3-question play recommender |
| Dev Hub | `website/src/pages/dev-hub.tsx` | Versions, changelog, tools |
| Changelog | `website/src/pages/dev-hub-changelog.tsx` | Release history |
| Feature Spec | `website/src/pages/feature-spec.tsx` | All features documented |
| Community | `website/src/pages/community.tsx` | OSS community info |
| Marketplace | `website/src/pages/marketplace.tsx` | Plugin marketplace |
| Adoption | `website/src/pages/adoption.tsx` | Adoption metrics/stats |
| Hi FAI | `website/src/pages/hi-fai.tsx` | Agent FAI info page |
| Partners | `website/src/pages/partners.tsx` | Partner integrations |
| Eval Dashboard | `website/src/pages/eval-dashboard.tsx` | Evaluation visualization |
| Chatbot | `website/src/pages/chatbot.tsx` | Agent FAI chat interface |
| User Guide | `website/src/pages/user-guide.tsx` | Dynamic per-play guide |
| Search | `website/src/theme/SearchBar/index.js` | Custom search pill |
| Config | `website/docusaurus.config.ts` | SEO, search, favicon |

### Solution Plays (20)
| Path Pattern | Contents |
|-------------|----------|
| `solution-plays/XX-name/.github/` | Agentic OS (19 files: agents, instructions, prompts, skills, hooks, workflows) |
| `solution-plays/XX-name/config/openai.json` | AI model config with system prompt |
| `solution-plays/XX-name/config/guardrails.json` | Safety guardrails (domain-specific) |
| `solution-plays/XX-name/spec/play-spec.json` | Architecture spec + WAF alignment |
| `solution-plays/XX-name/froot.json` | Package manifest |
| `solution-plays/XX-name/infra/main.bicep` | Azure infrastructure |
| `solution-plays/XX-name/plugin.json` | Layer 4 plugin manifest |

### CI/CD Workflows (13)
| Workflow | Trigger | Channel |
|----------|---------|---------|
| `deploy.yml` | Push to website/ | GitHub Pages |
| `npm-publish.yml` | Version bump in mcp-server/ | npm |
| `vsce-publish.yml` | Version bump in vscode-extension/ | VS Code Marketplace |
| `pypi-publish.yml` | Version bump in python-*/ | PyPI |
| `docker-publish.yml` | Push to mcp-server/ | Docker (ghcr.io) |
| `deploy-chatbot.yml` | Push to functions/ | Azure App Service |
| `consistency-check.yml` | Push (any) | Self-healing auto-fix |
| `content-sync.yml` | Push (any) | Version/count validation |
| `version-check.yml` | PRs | Pre-merge version guard |
| `sync-readme.yml` | Push to READMEs | Cross-file sync |
| `validate-plays.yml` | Push to solution-plays/ | JSON + Bicep lint |
| `uptime.yml` | Scheduled | Site + API monitoring |
| `release.yml` | Tags | GitHub Release notes |

### READMEs & Landing Pages (must stay in sync)
| File | Purpose | Key Values |
|------|---------|------------|
| `README.md` (root) | GitHub landing page | Tools, plays, install methods, Python |
| `mcp-server/README.md` | npm landing page | 23 tools, 16 modules, install |
| `vscode-extension/README.md` | VS Code Marketplace | 19 commands, 23 tools |
| `python-sdk/README.md` | PyPI landing page (frootai) | 16 modules, CLI, API |
| `python-mcp/README.md` | PyPI landing page (frootai-mcp) | 23 tools, install |

---

## Consistency Check Protocol

When making ANY change that affects counts or versions:

1. **Update the source of truth first** (package.json, index.js, etc.)
2. **Run bulk update** across all downstream files:
   ```powershell
   # Example: tool count changed from 23 to 24
   Get-ChildItem -Recurse -Path "website/src/pages" -Filter "*.tsx" | ForEach-Object {
     $c = Get-Content $_.FullName -Raw
     $u = $c -replace '23 tools', '24 tools' -replace '23 MCP', '24 MCP'
     if($c -ne $u) { Set-Content $_.FullName $u -NoNewline; Write-Output "Fixed: $($_.Name)" }
   }
   ```
3. **Also update:** READMEs, functions/server.js (chatbot prompt), docusaurus.config.ts
4. **Commit with:** `fix: sync tool count 23→24 across N files`
5. **Verify with:** `node scripts/validate-consistency.js`

---

## What's Been Published (Live URLs)

| Channel | URL | Version |
|---------|-----|---------|
| Website | https://frootai.dev | Latest (auto-deploy on push) |
| npm | https://www.npmjs.com/package/frootai-mcp | 3.2.0 |
| PyPI SDK | https://pypi.org/project/frootai/ | 3.3.0 |
| PyPI MCP | https://pypi.org/project/frootai-mcp/ | 3.2.0 |
| Docker | ghcr.io/gitpavleenbali/frootai-mcp | latest |
| VS Code | https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai | 1.4.0 (pending publish) |
| Chatbot | https://frootai-chatbot-api.azurewebsites.net | Live |
| GitHub | https://github.com/gitpavleenbali/frootai | Latest |

---

## Phase Execution Checklist (for future sprints)

When completing any implementation item:

- [ ] Code the feature
- [ ] Test it works
- [ ] Update `ImplementationPlan.md` (📋 → ✅)
- [ ] Update website pages with new counts/features
- [ ] Update all READMEs if counts/versions changed
- [ ] Update chatbot system prompt if features changed
- [ ] Update VS Code extension if sidebar/commands changed
- [ ] Commit with conventional commit message
- [ ] Push to main
- [ ] Verify CI/CD workflows pass

---

## Remaining Items (as of March 28, 2026)

| # | Item | Owner | Status |
|---|------|-------|--------|
| 1 | Add GitHub Secrets (NPM_TOKEN, VSCE_PAT, PYPI_TOKEN) | Pavleen | Portal action |
| 2 | Add GitHub Topics (mcp, ai-tools, azure) | Pavleen | Portal action |
| 3 | Re-run failed GitHub Actions | Pavleen | Portal action |
| 4 | TypeScript SDK (@frootai/sdk) | Deferred | Low demand |
| 5 | SDK documentation + examples | Deferred | Python covers it |
| 6 | MCP auto-restart / health check | Blocked | VS Code API ~v1.102+ |
| 7 | Publish VS Code Extension v1.4.0 | Pavleen | `cd vscode-extension && vsce publish` |
| 8 | Publish marketing (blog, Show HN, Product Hunt) | Pavleen | Drafts in .internal/marketing/ |
| 9 | Revoke + regenerate PyPI token | Pavleen | Token was exposed in terminal |
