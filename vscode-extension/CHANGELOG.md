# Changelog

## [9.3.0] — 2026-04-16

### Phase A-F: Complete UI Overhaul

#### Agent FAI — Embedded AI Chat
- **Streaming chat panel** — SSE-powered AI chat with full FrootAI ecosystem knowledge
- **Rich system prompt** — maps all VS Code ecosystem URLs (plays, primitives, MCP, modules)
- **Typing indicator** — 3-dot bounce animation + streaming cursor
- **Sticky header** — identity bar with ecosystem tagline pills (Solution Plays, Primitives, Developer Tools, Learning Hub)
- **Smart link grounding** — VS Code commands for internal nav, ↗ symbol for external links
- **Inline markdown rendering** — styled tables, headers, code blocks, lists
- **@fai Chat Participant** — offline knowledge search in Copilot Chat (plays, modules, glossary, tools)

#### Plugin Marketplace
- **77 FAI plugins** — search, domain category filters, detail view with metadata
- **One-click install** — plugin installation commands
- **Unified hero header** — FrootAI logo + branded layout

#### FAI Protocol & Architecture Explainer
- **4-tab interactive panel** — Protocol, Layer, Engine, Factory
- **Protocol tab** — fai-manifest.json structure, fai-context.json, 7 schema cards, auto-wiring flow
- **Layer tab** — FROOT tree (5 layers, 16 modules), WAF 6-pillar grid
- **Engine tab** — 7 engine modules with pipeline visualization
- **Factory tab** — distribution channels, 15 GitHub Actions, validation pipeline
- **Sidebar integration** — 15+ tree items now open native panels instead of external URLs

#### Evaluation Dashboard Enhancement
- **3-mode dashboard** — empty state guide, demo data, real workspace data
- **Workspace scanning** — auto-detects eval-config.json, eval-results.json, results/*.json
- **Setup guide** — file structure reference, template code blocks, Create Config/Results buttons
- **Live/demo toggle** — switch between real workspace data and demo reference
- **Workspace status pills** — detection indicators for each eval file

#### Design System Overhaul
- **Emojis → Lucide icons** — all 8 panel files upgraded to lucide-react SVGs
- **CSS design system** — brand variables, glow-card with hover lift, gradient buttons, icon-box utilities
- **Unified hero headers** — FrootAI logo SVG + hero section on all panels
- **Consistent theming** — all panels (Primitives, Marketplace, MCP, Welcome) match same visual language

#### Bug Fixes (Phase C)
- **Install Agent** — now uses QuickPick + `vscode://github.copilot-chat/createAgent` protocol (was broken URL)
- **Install Instruction** — new command for instruction installation
- **Filter highlight** — subcategory buttons now correctly styled (was inverted)
- **File decorations** — expanded to 12 types with 2-letter text badges
- **CodeLens icon** — changed from `$(zap)` to `$(checklist)`
- **Scaffold auto-select** — `initialPlay` arg auto-jumps to step 2
- **MCP Run Tool** — connection instructions + copy command button

#### Tests & Polish
- **60 tests** (was 50) — new tests for Agent FAI, Marketplace, Protocol Explainer, chat participant, file decorations
- **44 commands** (was ~30), 5 sidebar views, 1 chat participant, 3 keybindings
- **11 React panels** — playDetail, evaluation, scaffold, mcpExplorer, playBrowser, configurator, welcome, primitivesCatalog, marketplace, agentFai, protocolExplainer

## [9.1.0] — 2026-04-16

### Phase 6: Workspace Intelligence & Distribution

- **Workspace play detection** — auto-detects fai-manifest.json in workspace, shows active play in status bar with click-to-open
- **Manifest diagnostics** — real-time DiagnosticCollection validates fai-manifest.json: missing required fields, invalid play ID format, bad semver, invalid WAF pillars, guardrail thresholds out of range, broken file references
- **Validate Manifest command** — schema validation with detailed output in Problems panel; auto-finds manifests if none open
- **Explorer context menus** — right-click fai-manifest.json → Validate Manifest / Open Play Detail; right-click .agent.md, SKILL.md → Open FAI File
- **4 new commands** — validateManifest, openPlayFromManifest, peekFaiFile, openDetectedPlay
- **.vscodeignore optimized** — excludes test/, webview-ui/src/, docs from VSIX for smaller package
- **Test suite expanded** — 34 tests (was 27), now covers context menus, new commands
- **README updated** — 18 features (was 15), 24 commands (was 21)

## [9.0.0] — 2026-04-16

### Phase 5: Polish & Production Hardening
- **File decorations** — FAI files (fai-manifest.json, .agent.md, .instructions.md, SKILL.md) get badges in Explorer
- **CodeLens** on fai-manifest.json — inline "Validate Manifest" + wiring summary (play ID, primitive count, WAF pillars)
- **Keybindings** — `Ctrl+Shift+F10` Browse Plays, `Ctrl+Shift+F11` Welcome
- **CHANGELOG** updated with full Phase 1–4 history

### Phase 4: Getting Started & Onboarding
- **Welcome panel** — React webview with 6-card feature grid, Quick Start, ecosystem links; auto-opens on first install
- **What's New notification** — detects version updates via globalState, shows changelog highlights
- **Interactive tooltips** — rich Markdown tooltips on all tree items (plays, modules, MCP tools, glossary)
- **Enhanced walkthrough media** — 5 markdown guides with tables, code blocks, tips

### Phase 3: Rich Webview Panels
- **Recently Used** — top 5 last-opened plays in sidebar, persisted via workspaceState
- **PlayDetail enhancements** — Azure services grid, tuning params table, WAF checklist, Init DevKit/TuneKit buttons
- **Evaluation Dashboard** — trend sparklines, delta badges, summary stats, CSV export
- **Scaffold Wizard** — 4-step wizard with play picker, config, file preview, create
- **MCP Explorer** — TryIt modal with schema-aware parameter forms, Copy MCP Config, Install Config

### Phase 2: Enhanced Tree Views & Search
- **SolutionPlayProvider** — category grouping by FROOT layers, multi-word search, view mode toggle, complexity badges
- **Search All** — live QuickPick with real-time filtering across plays, tools, glossary, modules
- **6 tree header buttons** — filter, refresh, toggle, configurator, welcome, MCP
- **src/types.ts** — shared TypeScript type definitions

### Phase 1: Solution Plays Data Foundation
- **SolutionPlay interface** expanded 11→20 fields (azure, waf, tuning, evaluation, category)
- **categories.ts** — 21 categories with FROOT layer mapping
- **101 plays enriched** — all plays have category, complexity, azure services, WAF pillars
- **PlayBrowser.tsx** — filterable, paginated play catalog with category cards
- **Configurator.tsx** — 5-question recommendation wizard

## [6.0.0] — 2026-04-14

### Architecture
- **TypeScript migration** — entire extension rewritten from 2,127-line JS monolith to modular TypeScript
- **esbuild bundling** — fast builds via esbuild (114KB dev / 78KB prod), replaces no-build approach
- **17 TypeScript modules** across `data/`, `providers/`, `commands/`, `webviews/`, `utils/`
- Strict TypeScript with full type safety

### New Features
- **Global Search** (`Ctrl+Shift+F9`) — fuzzy search across plays, MCP tools, and glossary
- **Play Detail Panel** — rich webview with hero header, WAF alignment pills, quick actions
- **Evaluation Dashboard** — 5 metric cards with scores, thresholds, pass/fail visualization
- **Scaffold Wizard** — 4-step interactive wizard (pick play → name → preview → create)
- **MCP Tool Explorer** — filterable grid of all 45 tools with category badges and copy config
- **Getting Started Walkthrough** — 5-step onboarding for new users
- **Keybinding** — `Ctrl+Shift+F9` for Search Everything

### Enhanced Tree Views
- Solution Plays: search/filter, complexity badges (color-coded), status icons, rich tooltips
- Primitives Catalog: fixed counts (201/176/282/10/77), distinct category icons, count descriptions
- MCP Tools: read-only/read-write annotations, 7 category groups

### Cleanup
- Removed 9 stale VSIX files from repository (0.1.0 through 5.0.7)
- Added `.vscodeignore` to exclude source files from published VSIX
- Build output goes to `out/` (not source `src/`)

## [5.0.7] — 2026-04-01
- 4 tree views (plays, primitives, FAI protocol, MCP tools)
- 25 commands (init DevKit/TuneKit/SpecKit, evaluate, cost, etc.)
- MCP server auto-registration
- Markdown webview rendering with Mermaid support
- GitHub download + 24h cache
