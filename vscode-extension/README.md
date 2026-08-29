<p align="center">
  <img src="https://raw.githubusercontent.com/frootai/frootai/main/vscode-extension/media/frootai-mark.png" width="48" alt="FrootAI">
</p>

<h1 align="center">FrootAI — VS Code Extension</h1>

<p align="center">
  <strong>From the Roots to the Fruits. It's connected, it's simply Frootful.</strong><br>
  <em>The UniFAIng Glue for GenAI Ecosystem</em>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode"><img src="https://img.shields.io/visual-studio-marketplace/v/frootai.frootai-vscode?style=flat-square&logo=visualstudiocode&label=Marketplace" alt="Version"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode"><img src="https://img.shields.io/visual-studio-marketplace/i/frootai.frootai-vscode?style=flat-square&logo=visualstudiocode&label=Installs" alt="Installs"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode"><img src="https://img.shields.io/visual-studio-marketplace/r/frootai.frootai-vscode?style=flat-square&label=Rating" alt="Rating"></a>
  <a href="https://github.com/frootai/frootai/blob/main/LICENSE"><img src="https://img.shields.io/badge/MIT-yellow?style=flat-square&label=License" alt="License"></a>
</p>

<p align="center">
  <strong>Solution plays</strong> · <strong>AI primitives</strong> · <strong>MCP tools</strong> · <strong>Knowledge Modules</strong> · <strong>Comprehensive Glossary</strong>
</p>

<p align="center">
  <strong>🟢 v6.1.0 — Federation GA (2026-06-20)</strong> — One MCP connection, every Tier-1 area (Azure, GitHub, Playwright, MarkItDown, MS&nbsp;Learn, Context7). Trust-gated. Operational — Stable. <a href="https://frootai.dev/blog/frootai-mcp-becomes-a-router">Read the launch post →</a>
</p>

---

## 📦 What's Inside

The extension adds a **FrootAI** icon to your activity bar with **7 sidebar sections**:

| Section | What You Get |
|---------|-------------|
| **Hi FAI** | Welcome hub, Agent FAI chat, Setup Guide, Global Search (`Ctrl+Shift+F9`) |
| **FAI Solution Plays** | Configurator wizard, browse 101 plays, scaffold projects, recently used |
| **FAI Primitives Catalog** | 200 agents · 150 instructions · 300 skills · hooks · 70 plugins |
| **FAI Learning Hub** | FAI Ecosystem explorer, 16 FROOT modules, AI Glossary, Learning Center, Quizzes |
| **FAI Packages** | MCP server setup, npm/PyPI/Docker distribution, CLI tools |
| **FAI Dev Hub** | Admin guide, user guide, API reference, changelog, architecture docs |
| **FAI Community** | Community showcase, contribution guide, GitHub links |

> **Works standalone** — no need to clone the FrootAI repo. Install the extension and go.

---

## 🏠 Welcome & Agent FAI

<p align="center">
  <img src="https://raw.githubusercontent.com/frootai/frootai/main/vscode-extension/media/welcome_FAI.png" width="680" alt="Welcome panel">
</p>

The **Welcome** panel is your starting point — quick-start actions, feature overview, and ecosystem links all in one place. Open it anytime with `Ctrl+Shift+F11`.

<p align="center">
  <img src="https://raw.githubusercontent.com/frootai/frootai/main/vscode-extension/media/agent_FAI.png" width="680" alt="Agent FAI chat">
</p>

**Agent FAI** is your AI-powered assistant that knows the entire FrootAI ecosystem. Ask about solution plays, architecture patterns, Azure best practices, primitives — anything. Responses stream in real-time with full context awareness.

---

## 🎯 Solution Plays

<p align="center">
  <img src="https://raw.githubusercontent.com/frootai/frootai/main/vscode-extension/media/configurator_FAI.png" width="680" alt="Solution Configurator">
</p>

The **Solution Configurator** walks you through 5 questions to recommend the best play for your scenario — industry, complexity, team size, and more.

<p align="center">
  <img src="https://raw.githubusercontent.com/frootai/frootai/main/vscode-extension/media/solutionplay_FAI.png" width="680" alt="Solution Play browser">
</p>

**Browse All Plays** gives you a searchable, filterable catalog of all solution plays. Click any play for a rich detail panel with WAF checklist, Azure services grid, tuning parameters, and cost breakdown.

Each play ships as a **4-kit structure**:

```
solution-play/
├── .github/           DevKit — agents, instructions, skills, hooks, prompts
├── config/            TuneKit — AI parameters, guardrails, model routing
├── evaluation/        eval.py + test sets + quality scoring
├── infra/             Bicep IaC (Azure plays) or Docker Compose
└── spec/              SpecKit — architecture spec + WAF alignment
```

**Play actions** — Init DevKit · Init TuneKit · Init SpecKit · Estimate Cost · Run Evaluation · User Guide

---

## 🧩 Primitives Catalog

<p align="center">
  <img src="https://raw.githubusercontent.com/frootai/frootai/main/vscode-extension/media/catalog_FAI.png" width="680" alt="Primitives Catalog">
</p>

Browse **AI primitives** across 5 tabs with search, WAF pillar filters, and domain filters:

| Primitive | Count | What They Do |
|-----------|:-----:|-------------|
| **Agents** | 238 | Specialized `.agent.md` files — RAG, security, DevOps, per-play builder/reviewer/tuner |
| **Instructions** | 176 | Coding standards, WAF guidelines, domain patterns (`.instructions.md`) |
| **Skills** | 322 | Actionable recipes — deploy, evaluate, tune, scaffold (`SKILL.md`) |
| **Hooks** | 10 | Policy gates — secrets scanning, guardrails, session validation |
| **Plugins** | 77 | Themed bundles of agents + instructions + skills + hooks |

One-click install for any primitive — agents use the `vscode://github.copilot-chat/createAgent` protocol.

---

## 📚 Learning Hub

Explore the **FROOT Framework** — knowledge modules across 5 layers:

| Layer | Modules |
|:-----:|---------|
| **F**oundations | GenAI Foundations · LLMs · Glossary · Agentic OS |
| **R**easoning | Prompts · RAG · Deterministic AI |
| **O**rchestration | Semantic Kernel · Agents · MCP & Tools |
| **O**perations | Azure AI · GPU Infrastructure · Copilot Ecosystem |
| **T**ransformation | Fine-Tuning · Responsible AI · Production Patterns |

Also includes:
- **FAI Ecosystem** — 6-tab explorer: Factory · Packages · Toolkit · Engine · Protocol · Layer
- **AI Glossary** — Comprehensive glossary with definitions and context
- **Learning Center** — 15 guided learning pages on frootai.dev
- **Quiz & Assessment** — 25 questions to test your knowledge

---

## 📡 Packages & Distribution

Set up the FAI ecosystem in your preferred format:

| Channel | Package | Install |
|---------|---------|---------|
| **npm** | `frootai-mcp` | Use the version approved by your project policy |
| **PyPI** | `frootai-mcp` | `uvx frootai-mcp` |
| **Docker** | `ghcr.io/frootai/frootai-mcp` | `docker pull ghcr.io/frootai/frootai-mcp` |
| **CLI** | `frootai` | `npx frootai` |
| **VS Code** | This extension | `code --install-extension frootai.frootai-vscode` |
| **Website** | frootai.dev | [frootai.dev](https://frootai.dev) |

Each channel exposes its verified contract and runtime-discovered capabilities. Check the active surface for current counts and versions.

---

## 🚀 Installation

**Option 1 — VS Code Marketplace** (recommended):

```
Ctrl+Shift+X → Search "FrootAI" → Install
```

**Option 2 — Terminal:**

```bash
code --install-extension frootai.frootai-vscode
```

---

## ⚡ Quick Start

```
1. Install   →  Ctrl+Shift+X → "FrootAI" → Install
2. Setup MCP →  Sidebar → FAI Packages → Setup MCP Server
3. Build     →  Sidebar → Solution Configurator → pick a play → Scaffold
```

That's it — you're ready to build AI solutions with FrootAI.

---

## 📊 TokenOps — Local-First AI FinOps

TokenOps ships inside this extension. It provides evidence-first planning and reconciliation without claiming access to hidden IDE telemetry.

1. Open **FrootAI: TokenOps — Open Dashboard** from the Command Palette.
2. Paste visible prompt text or use the current editor selection, select a model and tool scenario, then create a low/base/high estimate.
3. Use **FrootAI: TokenOps — Save Receipt Template**, replace every placeholder with real provider, gateway, or instrumented MCP evidence, and import it with **Import Usage Receipt**.
4. Review estimate-versus-actual reconciliation, observed-cost budgets, forecasts, chargeback, and evidence-backed recommendations.

### Evidence semantics

| Grade | Meaning |
|---|---|
| **Observed** | Direct provider, gateway, MCP, or supported GitHub report evidence |
| **Calculated** | Deterministic result derived from observed inputs |
| **Allocated** | Observed totals assigned to a project or repository using an explicit key |
| **Estimated** | Planning range; never treated as actual usage |
| **Forecasted** | Projection based on observed month-to-date cost |
| **Unavailable** | Data the available source does not expose |

Exact local tokenization is used only for supported encodings. Other models are explicitly marked as provider estimates. Built-in prices are intentionally unset; pricing overrides require source and as-of provenance.

### Data, privacy, and retention

- TokenOps stores bounded metrics and evidence metadata per workspace/repository in VS Code extension storage: up to 5,000 observations, 500 estimates, and 8 MB per scoped store.
- Prompt text, source code, tool arguments, and tool result payloads are not persisted or exported.
- No TokenOps data is synchronized to FrootAI. Network access occurs only when the user explicitly connects GitHub usage.
- GitHub access uses VS Code authentication and organization-level reports. GitHub does not expose hidden Copilot IDE prompts, private orchestration, or complete IDE token totals; those remain **Unavailable**.
- Use **FrootAI: TokenOps — Export Local Data** for a portable JSON snapshot. Use **Clear Local Data** to permanently remove the current workspace/repository scope after modal confirmation.

### Receipt format

A receipt is a JSON object or an array/JSONL stream of objects. Required evidence includes a valid ISO 8601 `observedAt`, plus at least one observable token count, cost, or tool-call summary. Common OpenAI, Anthropic, and Google usage field names are normalized. Invalid timestamps, negative/fractional token counts, excessive files, oversized payloads, and mismatched source digests are rejected with a visible error.

If import fails, save a fresh template and verify that every placeholder was replaced with actual evidence. GitHub `403` responses generally mean the authenticated account lacks organization metrics permission. Empty budget and forecast values mean no priced observed receipt exists for the current month—not zero usage.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+F9` | Search Everything — plays, tools, glossary, modules |
| `Ctrl+Shift+F10` | Browse All Plays — filterable catalog |
| `Ctrl+Shift+F11` | Welcome — feature overview and quick start |

---

<details>
<summary><strong>🎛️ Commands</strong> (<code>Ctrl+Shift+P</code>) — click to expand</summary>
<br>

| Command | Description |
|---------|-------------|
| `FrootAI: Search Everything` | Global search across plays, tools, glossary, modules |
| `FrootAI: Browse All Plays` | Full catalog with categories, search, pagination |
| `FrootAI: Solution Configurator` | 5-question wizard → personalized recommendation |
| `FrootAI: Welcome` | Feature overview, quick start, ecosystem links |
| `FrootAI: Agent FAI` | Streaming AI chat — ask anything about FrootAI |
| `FrootAI: Plugin Marketplace` | Browse FAI plugins with search and filters |
| `FrootAI: FAI Ecosystem` | Interactive 6-tab ecosystem explorer |
| `FrootAI: Open Primitives Catalog` | AI primitives across 5 tabs with filters |
| `FrootAI: Open Evaluation` | 3-mode dashboard: guide, demo, real workspace data |
| `FrootAI: Open Scaffold Wizard` | 4-step wizard to bootstrap a play |
| `FrootAI: Initialize DevKit` | .github Agentic OS files |
| `FrootAI: Initialize TuneKit` | AI config + evaluation files |
| `FrootAI: Initialize SpecKit` | Architecture spec + WAF alignment |
| `FrootAI: Initialize Hooks` | guardrails.json |
| `FrootAI: Initialize Prompts` | Slash commands |
| `FrootAI: Install Agent` | Install FAI agent via QuickPick |
| `FrootAI: Install Instruction` | Install FAI instruction via QuickPick |
| `FrootAI: Setup MCP Server` | npm / pip / Docker / .vscode config |
| `FrootAI: Quick Cost Estimate` | Azure cost breakdown by tier |
| `FrootAI: Run Evaluation` | Auto-run eval.py + quality dashboard |
| `FrootAI: Auto-Chain Agents` | Build → Review → Tune workflow |
| `FrootAI: Validate Config` | Check config/*.json |
| `FrootAI: Validate Manifest` | Schema-validate fai-manifest.json with diagnostics |
| `FrootAI: Open Play from Manifest` | Detect play ID → open detail |
| `FrootAI: Look Up AI Term` | AI glossary search |
| `FrootAI: Search Knowledge Base` | Full-text search across modules |
| `FrootAI: Architecture Patterns` | Decision guides |

</details>

---

## 🔬 FAI Ecosystem Architecture

| Layer | Component | Role |
|:-----:|-----------|------|
| 🏭 | **FAI Factory** | CI/CD · Validation · Publishing |
| 📦 | **FAI Packages** | npm · PyPI · Docker · VS Code |
| 🧰 | **FAI Toolkit** | DevKit · TuneKit · SpecKit |
| ⚙️ | **FAI Engine** | Runtime · Wiring · Resolution |
| 📋 | **FAI Protocol** | fai-manifest.json · fai-context.json |
| 🧬 | **FAI Layer** | The UniFAIng Glue — Context Wiring |

> **Flow:** Factory → Packages → Toolkit → Engine → Protocol → Layer

---

## 🌱 Federation Surface (GA in `6.1.0`)

The **FrootAI Federation surface** is GA in v6.1.0 — the bundled MCP kernel attaches external MCP areas ("areas") and routes tool calls under `<area>.<tool>` prefixes. One MCP connection from your client, every Tier-1 area available, trust gated by a single manifest you control.

| Layer | Ships |
|---|---|
| **Settings** | 5 `frootai.federation.*` config keys (`enabled` / `preAttach` / `trustFile` / `idleDisconnectMinutes` / `autoAttachFromPlayManifest`) |
| **Commands** | 6 palette-exposed: `attach` / `detach` / `listAttached` / `discoverMcp` / `trustQuery` / `attachFromManifest` |
| **Views** | 2 sidebar tree views (Attached + Marketplace) + 1 React webview (Federation Explorer) |
| **MCP server-definition** | New `frootai-federated` provider id alongside `frootai` — other MCP consumers connect without re-spawning |
| **Keybinding** | `Ctrl+Shift+F12` / `Cmd+Shift+F12` → Discover MCP |
| **Walkthrough** | "Try federation" 3-step section appended to the welcome walkthrough |
| **Pre-attached on activation** | Whatever's listed in your `frootai.federation.preAttach` setting — eager-attach for low first-call latency |
| **Trust gate** | Every attach passes through `TrustEvaluator.evaluate()` — community-tier servers blocked unless explicit `trust_overrides` entry |

### Federation Explorer at a glance

```
FrootAI Federation
├─ Attached
│  ├─ azure         · first-party-ms · 47 tools
│  ├─ github        · first-party-ms · 31 tools
│  └─ playwright    · first-party-ms · 18 tools
├─ Marketplace (auto-attachable)
│  ├─ markitdown    · first-party-ms
│  ├─ ms-learn      · first-party-ms
│  ├─ context7      · verified-publisher
│  └─ chrome-devtools · verified-publisher
└─ Trust posture
   └─ Active overrides: 0
```

### Lockstep launch (v6 across all 5 surfaces)

| Surface | Version | Channel |
|---|---|---|
| `frootai-mcp` (npm + PyPI) | 6.0.0 | latest |
| `frootai` (CLI) | 6.1.0 | npm latest |
| `frootai-vscode` (this extension) | 6.1.0 | Marketplace stable |
| `frootai/frootai` (Action) | v6.0.0 | GitHub Marketplace |
| Foundry agent | 2.0.0 | production slot |
| `mcp.frootai.dev` | GA | Operational — Stable |

> **Backward compatibility:** v5.1.x users auto-upgrade on update. v5 behavior is preserved with `FROOTAI_FEDERATION=off` for any consumer that needs the legacy single-tool surface.

See [`CHANGELOG.md`](CHANGELOG.md#610) for the full v6.1.0 ship inventory.

---

## 🔌 MCP Server Definition Providers

This extension contributes **two** MCP server-definition providers other VS Code MCP consumers can discover and connect to:

| Provider id | Label | Exposes |
|---|---|---|
| `frootai` | FrootAI MCP Server | The bundled FrootAI built-in MCP server (knowledge, live, agent-chain, ecosystem, compute, engine, scaffold, marketplace tools). |
| `frootai-federated` | FrootAI Federated | The running FrootAI Federation kernel's federated tool list, prefixed by attached area (`<area>.<tool>`). Exposed **without re-spawning** — third-party MCP consumers (e.g. agents, other extensions) can connect to the SAME kernel process this extension manages, preserving idle-disconnect timers, trust-file overrides, and already-attached areas. |

The `frootai-federated` provider returns the live federated tool list from the running federation kernel. When no federation kernel is currently running (no areas attached, federation disabled, or extension just activated), the provider returns an empty list — other MCP consumers should treat that as "no federated tools available right now" rather than an error.

---

## 🧪 Cross-Platform Smoke Matrix

Every push that touches the federation surface runs the [`vscode-federation-cross-platform.yml`](../.github/workflows/vscode-federation-cross-platform.yml) GitHub Actions matrix:

| OS Runner | Node | What runs |
|---|---|---|
| `ubuntu-latest` (Linux) | 18 / 20 / 22 | M5.25 extension test suite (4 files / 37 cases) + every `vscode-mcp-*.test.js` orchard gate |
| `windows-latest` | 18 / 20 / 22 | (same) |
| `macos-latest` | 18 / 20 / 22 | (same) |

The `fail-fast: false` strategy guarantees one OS failure doesn't mask the others — the M5.26 row literal mandates "all three" succeed, so the report shows precisely which platform broke. The smoke target is **`playwright`** per the row literal; when M5.22+ wires real kernel spawn, this matrix automatically picks up the end-to-end `playwright` attach without workflow edits.

---

## �️ Visual Regression — Federation Explorer

Per **M5.27**, every PR touching [`webview-ui/src/panels/FederationExplorer.tsx`](webview-ui/src/panels/FederationExplorer.tsx) triggers the [`vscode-federation-visual-regression.yml`](../.github/workflows/vscode-federation-visual-regression.yml) workflow. The canonical golden roster lives at [`webview-ui/__screenshots__/federation-explorer/manifest.json`](webview-ui/__screenshots__/federation-explorer/manifest.json):

| Golden ID | Theme variants | State |
|---|---|---|
| `catalog-empty` | dark + light | Catalog tab, marketplace fetch in flight, empty area list |
| `catalog-filtered` | dark + light | Catalog tab, first-party-ms tier filter active, 3 entries visible |
| `attached-empty` | dark + light | Attached tab, no areas, empty-state copy |
| `attached-list` | dark + light | Attached tab, azure + playwright attached, idle timers |
| `warning-state` | dark + light | Attached tab, azure at 9.5min / 10min idle (M5.19 amber warning) |

The workflow today validates the manifest shape (canonical roster + resolution + theme variants) and confirms the webview builds. The full pixel-diff baseline lands once the Playwright Component Testing harness ships — at which point baseline PNGs commit alongside `manifest.json` as `<id>.<theme>.png` (5 states × 2 themes = 10 files), and the diff step augments the workflow without changing the path-filter trigger.

---

## �🔗 Links

| | |
|---|---|
| 🌐 **Website** | [frootai.dev](https://frootai.dev) |
| 📦 **npm** | [npmjs.com/package/frootai-mcp](https://www.npmjs.com/package/frootai-mcp) |
| 🐍 **PyPI** | [pypi.org/project/frootai-mcp](https://pypi.org/project/frootai-mcp/) |
| 🐳 **Docker** | [ghcr.io/frootai/frootai-mcp](https://github.com/frootai/frootai/pkgs/container/frootai-mcp) |
| 💻 **GitHub** | [github.com/frootai/frootai](https://github.com/frootai/frootai) |
| 🤝 **Community** | [frootai.dev/community](https://frootai.dev/community) |
| 📖 **Contribute** | [frootai.dev/contribute](https://frootai.dev/contribute) |
| 📚 **Learning Hub** | [frootai.dev/learning-hub](https://frootai.dev/learning-hub) |

---

<p align="center">
  <img src="https://raw.githubusercontent.com/frootai/frootai/main/vscode-extension/media/frootai-mark.png" width="32" alt="FrootAI"><br>
  <strong>From the Roots to the Fruits.</strong><br>
  <em>It's connected, it's simply Frootful.</em><br><br>
  <sub>MIT License · © 2026 FrootAI</sub>
</p>