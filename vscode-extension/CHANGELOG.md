# Changelog

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
