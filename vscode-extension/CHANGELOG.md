# Changelog

> Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [SemVer](https://semver.org/spec/v2.0.0.html).
> **Versioning doctrine:** local version = registry-published + 1 patch.
> See `.internal/improvements/MASTER-IMPROVEMENT-PLAN.md` §2 (in `frootai-core` repo).

## [Unreleased]

### Added

- Completed the local-first TokenOps v1 release surface with workspace-scoped JSON export, confirmed local-data deletion, an intentionally invalid receipt template that must be populated from real evidence, and a dedicated onboarding walkthrough.
- Documented TokenOps evidence grades, receipt requirements, retention limits, privacy behavior, GitHub permissions and telemetry limitations, settings, and troubleshooting guidance.

### Changed

- Rebuilt the native Solution Play catalog around the website's canonical delivery-contract hierarchy: outcome-led hero, FAI Toolkit summary, domain filters, spacious contract cards, explicit DevKit/SpecKit/TuneKit sections, source links, and cleaner responsive behavior.
- Converted the Product System Home stage map into a single accessible tab surface. Wide editors show the selected stage immediately below the tab row; narrow editor groups use an inline accordion so each stage's content appears directly beneath the clicked stage.
- Replaced the fragile architecture-only source view with a layered, network-independent service blueprint derived from each bundled Play contract. Canonical GitHub evidence now enriches the blueprint rather than controlling whether it renders.

### Fixed

- Added a jsDelivr fallback for canonical `architecture.md` retrieval and a bundled architecture-contract fallback when both live sources are unavailable, preventing terminal diagram failure states.
- Aligned VS Code account validation with website-issued Agent FAI credentials: current keys use `fai_live_` plus 48 lowercase hexadecimal characters. Safe paste normalization now removes a copied `Bearer` prefix, surrounding quotes, BOMs, and zero-width characters before storing only the normalized key in SecretStorage.
- Replaced the misleading immediate “verified” connection message with an explicit saved state; Agent FAI marks the account verified only after the API accepts its first request.

### Validation

- Passed 62 extension tests, 20 TokenOps tests, 45 React webview tests, 40 Federation tests, 60 Agent FAI backend tests, 26 website key/API route tests, production compilation, deployed auth-gateway smoke, and packaged Electron visual acceptance.

## [6.1.4] — 2026-08-28

### Added

- Added first-run FrootAI Account onboarding and a native account page. Revocable `fai_live_` credentials remain exclusively in VS Code SecretStorage and are never exposed to webviews.
- Added durable, workspace-scoped Agent FAI conversations with encrypted local retention, bounded history, stable thread continuity, account-aware readiness, and native Solution Play links in both response content and citation cards.
- Added host-owned authenticated Agent FAI requests to `frootai.dev/v1/agent/chat`; the webview retains `connect-src 'none'` and cannot access credentials or perform privileged network calls.
- Added bounded Repository Intelligence with safe metadata scanning, architecture-signal detection, explainable Solution Play recommendations, and direct native navigation into Play Detail.
- Added canonical TuneKit and SpecKit installers alongside DevKit, with exact file-count confirmation, cancellable progress, path containment, preserved existing files, and visible copied/skipped outcomes.

### Changed

- Expanded Product System Home and the workspace navigation surface with live account state and Repository Intelligence access.
- Expanded Play Detail with inline architecture, service flow, cost and toolkit context, and independent DevKit, TuneKit, and SpecKit status reporting.
- Routed canonical FrootAI Solution Play URLs from Agent FAI into the native VS Code Play Detail experience rather than an external browser.

### Fixed

- Removed a host-side CommonJS import from the React webview bundle that caused every native panel to fail at runtime with `require is not defined`; production builds now reject browser bundles containing runtime `require()` calls.
- Registered the contributed Federation attached/catalog tree providers so the sidebar presents a truthful unavailable/empty state instead of VS Code's missing-provider error.
- Routed catalog selections through the dedicated Play Detail host so inline architecture and canonical DevKit, TuneKit, and SpecKit behavior remain consistent from every entry point; repaired the native back path to Solution Plays.

### Validation

- Passed TypeScript type checking, 62 host tests, 43 React webview tests, 40 Federation tests, and the production extension/webview build.
- Live Play 01 smoke retrieved 4,375 architecture bytes and independently downloaded 34/34 DevKit, 11/11 TuneKit, and 7/7 SpecKit files into clean disposable destinations with zero skips.
- Passed an isolated packaged Electron acceptance journey covering the FrootAI activity view, five-stage Home, Home-to-Account click path, disconnected Agent FAI routing, Repository Intelligence, searchable 101-Play catalog, native Play Detail, and runtime/CSP error capture.

## [6.1.3] — 2026-08-28

### Fixed

- Restored the Solution Play architecture diagram directly inside Play Detail, with an immediate service-flow view and canonical `architecture.md` loaded into the same page.
- Replaced Play Detail's legacy DevKit command hop with an explicit canonical downloader: target workspace selection, exact file-count confirmation, cancellable progress, safe paths, preserved existing files, and visible copied/skipped results.
- Removed obsolete Play Detail debug-version and click-registration instrumentation.

### Validation

- Live Play 01 smoke retrieved 4,375 architecture bytes and downloaded all 34 planned DevKit files into a disposable directory, including `agent.md` and `spec/fai-manifest.json`.

## [6.1.2] — 2026-08-28

### Added

- Shared native FrootAI chrome across every React workbench panel.
- Website-derived Product System Home with hero actions, system trace, five delivery stages, stage handoffs, delivery surfaces, and a native product directory.
- Reproducible desktop references for the homepage and eleven product routes under `docs/visual-reference/`.

### Changed

- Converged Home, Agent FAI, Configurator, Plays, Primitives, Marketplace, MCP, Federation, Evaluation, Toolkit, Protocol, and compact sidebar onto the website's paper/grid, square-border, monospace-eyebrow, and stage-accent design language.
- Preserved VS Code theme tokens, keyboard focus, high contrast, responsive layout, and reduced motion rather than embedding website pages.
- Removed stale fixed package versions and MCP/catalog counts from product surfaces; runtime-dependent availability now uses neutral, evidence-based wording.
- Pinned `tsx` as the extension's declared test runner so `npm test` is non-interactive and reproducible.

### Added — [Z6.12] Lean federation setting

- **`frootai.federation.lean`** (default `false`) — ⚡ low-calorie federation.
  Losslessly byte-compacts federated tool descriptions (strips whitespace +
  routing ceremony) so an attached area's tool list loads with fewer tokens —
  same capability, no imperative/parameter altered. Maps to
  `FROOTAI_LEAN_FEDERATION=1` for the spawned kernel via
  `federation-env-mapping.js`.

### Added — federation surface (new areas + remote transports)

- New Tier-1 areas reachable via `FrootAI: Federation — Attach MCP Area`:
  **Markitdown** (`uvx markitdown-mcp`, PyPI) and **Microsoft Learn**
  (hosted `http-sse` endpoint `https://learn.microsoft.com/api/mcp`).
- Federation kernel now supports remote **`http-sse`** + **`http-streaming`**
  transports (not just local stdio), unlocking hosted MCP areas.

### Added — [Z8.5] Lean Mode commands

- **FrootAI: Compile to Lean** (`frootai.lean.compile`) — compiles the active
  editor to its lossless Lean form in a side-by-side preview, with a measured
  byte-savings toast. Same `leanCompact` transform as the MCP/CLI/SDKs.
- **FrootAI: Toggle Full / Lean View** (`frootai.lean.toggleView`) — opens the
  Full ↔ Lean counterpart of the active file (`foo.md` ↔ `foo.lean.md`).
- Pure logic in `src/commands/lean-compile-core.js` (gated by
  `scripts/orchard/test/vscode-mcp-lean-compile.test.js`).

## [6.1.0] — 2026-06-20

**Stable release on the VS Code Marketplace `stable` channel.** Promotes
`6.0.0-alpha.1` to GA in lockstep with the M11 launch arc:
- `frootai-mcp@6.0.0` (npm + PyPI, M11.5)
- `frootai@6.1.0` CLI (M11.6)
- `frootai-vscode@6.1.0` (this release, M11.7)
- `frootai/frootai@v6` Action (M11.8)
- Foundry agent `v2.0.0` (M11.9)
- Hosted MCP DNS flip (M11.10)

### Added — GA federation surface

Promotes the M5 federation primitive from pre-release → stable:

- 5 `frootai.federation.*` settings (enabled, preAttach, trustFile,
  idleDisconnectMinutes, autoAttachFromPlayManifest).
- 6 federation commands (attach, detach, listAttached, discoverMcp,
  trustQuery, attachFromManifest) + 3 dispatchable commands.
- 2 sidebar tree views + the `FederationExplorer` React webview.
- New `frootai-federated` MCP server-definition provider alongside
  existing `frootai` (other VS Code MCP consumers can attach to the
  running federation kernel without re-spawning).
- Keybinding `Ctrl+Shift+F12` / `Cmd+Shift+F12` → discoverMcp.
- "Try federation" walkthrough section in `frootai.gettingStarted`.

### Federation surface by group

- **Group A** (`M5.1..M5.9`) — Federation settings + 6 federation commands + 2 sidebar views.
- **Group B** (`M5.10..M5.19`) — Federation-aware UI: tree providers, explorer webview, persisted state, env mapping, chip rendering, auto-attach toast, status bar.
- **Group C** (`M5.20..M5.30`) — Operations + CI + release: trust elicitation, second MCP definition provider, keybinding, walkthrough, telemetry, in-tree test suite, cross-platform smoke, visual regression.

### Changed
- Promoted `6.0.0-alpha.1` → `6.1.0` on Marketplace `stable` channel.
- The kernel-spawn resolver is no longer behind PIN_ONE_AHEAD —
  federation surfaces now render fully populated state (was empty-state
  with `kernel_connection_pending` in alpha).

### Backward compatibility
- Strictly additive: every pre-M5 command, view, and contribution
  preserved.
- Operators on the stable `5.1.8` channel auto-upgrade to `6.1.0`.

## [6.0.0-alpha.1] — pre-release

> **Phase M5 — FrootAI Federation surface.** Net-new federation primitive lets the bundled MCP kernel attach external MCP areas ("areas") and route tool calls under `<area>.<tool>` prefixes. Strictly additive — every pre-M5 command, view, and contribution preserved.

### Added

- **Group A (`M5.1..M5.9`)** — Federation settings + 6 federation commands + 2 sidebar views.
- **Group B (`M5.10..M5.19`)** — Federation-aware UI: tree providers, explorer webview, persisted state, env mapping, chip rendering, auto-attach toast, status bar.
- **Group C (`M5.20..M5.30`)** — Operations + CI + release: trust elicitation, second MCP definition provider, keybinding, walkthrough, telemetry, in-tree test suite, cross-platform smoke, visual regression.

### Federation surface inventory

- **Settings**: 5 `frootai.federation.*` config keys (`enabled` / `preAttach` / `trustFile` / `idleDisconnectMinutes` / `autoAttachFromPlayManifest`) declared in `package.json` (M5.1).
- **Commands**: 6 palette-exposed commands (`attach` / `detach` / `listAttached` / `discoverMcp` / `trustQuery` / `attachFromManifest`) + 3 dispatchable commands (`playOpenAutoAttach` / `statusBar.refresh` / `elicitTrust`).
- **Views**: 2 sidebar tree views (`frootai.federation.attached` + `frootai.federation.marketplace`) + 1 React webview (`FederationExplorer`).
- **MCP server-definition providers**: new `frootai-federated` id alongside existing `frootai` (M5.21) — other VS Code MCP consumers can connect to the running federation kernel without re-spawning.
- **Keybinding**: `Ctrl+Shift+F12` / `Cmd+Shift+F12` → `frootai.federation.discoverMcp` (M5.22).
- **Walkthrough**: "Try federation" 3-step section appended to `frootai.gettingStarted` (M5.23) with new media files under `media/walkthrough-fed-*.md`.
- **Telemetry**: every federation command emits `(command, durationMs, error?)` via the existing extension telemetry sink (M5.24).
- **Test infra**: 4-file in-tree extension test suite (`src/test/federation/`) + 27-gate orchard sweep (`scripts/orchard/test/vscode-mcp-*.test.js`).
- **CI**: cross-platform smoke matrix on Linux + Windows + macOS × Node 18/20/22 (M5.26); visual regression workflow on every PR touching `FederationExplorer.tsx` (M5.27).

### Notes

- PIN_ONE_AHEAD posture: the federation kernel client is the M5.4 `buildPendingFederationClient` stub until the kernel-spawn resolver lands at M5.22+ / future ship. All federation surfaces (tree providers, status bar, explorer webview, auto-attach toast) handle the `kernel_connection_pending` error gracefully and render empty-state without surfacing the error to operators.
- Pre-release distribution: this `6.0.0-alpha.1` build ships to VS Code Marketplace's `pre-release` channel (M5.29). Operators on the stable `5.1.8` channel see no update.

## [5.1.8] — 2026-05-06

> Completes the URI handler suite. Skills, hooks, and prompts now install directly from frootai.dev with one click. The /installSkill, /installHook, /installPrompt routes were placeholders in v5.1.7 — they now do the right thing.

### Added
- **`frootai.installSkill` / `frootai.installHook` / `frootai.installPrompt`** — three new commands that download a primitive's folder from GitHub and write all files into the user's workspace. Used by the URI handler routes of the same names.
  - Lists folder contents via GitHub Contents API (`/repos/.../contents/path`)
  - Downloads each file with progress notification (`X/N: filename`)
  - Writes to `<workspace>/skills/<id>/`, `<workspace>/hooks/<id>/`, etc. (mirrors repo layout)
  - Auto-opens the primary file (SKILL.md / hooks.json / *.prompt.md) in the editor after install
  - All operations logged to FrootAI Output channel; errors auto-reveal the channel
  - Accepts optional pre-selected ID (skips QuickPick when called from URI)
  - Falls back to QuickPick browser when no catalog is available (e.g. prompts.json doesn't exist yet)
- All three commands declared in `package.json` `contributes.commands[]` (so they appear in Command Palette and pass the manifest contract).

### Changed
- **URI handler route disambiguation**:
  - `/installHook?id=NAME` → `frootai.installHook` (primitive folder install) — was previously aliased to legacy `/initHooks` per-play behavior
  - `/installPrompt?id=NAME` → `frootai.installPrompt` (primitive folder install) — was previously aliased to legacy `/initPrompts`
  - `/initHooks?play=NN` → `frootai.initHooks` (legacy: per-play guardrails.json — UNCHANGED)
  - `/initPrompts?play=NN` → `frootai.initPrompts` (legacy: per-play prompt scaffolds — UNCHANGED)
  - The two surfaces now have distinct routes, no shadowing.
- **Health Check** lists all 14 URI routes with v5.1.8 markers on the new ones and "(legacy)" on the per-play init routes.

### Notes
- Tag `ext-v5.1.8` will trigger the GitHub workflow to publish to the VS Code Marketplace.
- Companion website work in `frootai.dev/src/app/primitives/[category]/category-client.tsx` (commit `e638903`) wires every primitive card's "VS Code" button to fire the new deep-links via the shared `<VSCodeOpenButton>` component.

---

## [5.1.7] — 2026-05-06

> Adds web-to-IDE deep linking. Click any "Open in VS Code" button on **frootai.dev** → the exact play, agent, instruction, or primitive opens directly in the installed FrootAI extension. No copy-paste, no `git clone`. Extension activates automatically if not already installed (via VS Code's standard install-on-URI prompt).

### Added
- **URI handler** (`vscode://frootai.frootai-vscode/<route>?<params>`) — registered via `vscode.window.registerUriHandler()`. Supports 11 routes:
  - `/openPlay?id=NN` → opens Play Detail panel for play NN
  - `/installPlay?id=NN` → installs play as plugin (writes scaffold files to workspace)
  - `/initDevKit?play=NN` / `/initTuneKit?play=NN` / `/initSpecKit?play=NN` → initialize the respective kit
  - `/installHook?play=NN` / `/installPrompt?play=NN` → download hooks/prompts for play
  - `/installAgent?id=NAME` / `/installInstruction?id=NAME` → skip the QuickPick and install directly (new: pre-selected ID support)
  - `/openPrimitives` / `/openMarketplace` → open the corresponding catalog
  - All routes log to the FrootAI Output channel for diagnostics; unknown routes open the Welcome panel with a warning toast.
- **`frootai.installAgent` and `frootai.installInstruction`** now accept an optional pre-selected ID (first arg). When provided, skips the QuickPick and installs directly. Falls back to QuickPick if the ID is not found.
- **Health Check expanded** — `frootai.healthCheck` now lists all 11 URI routes alongside the 9 PlayDetail commands. Shows a copy-pasteable test URI (`vscode://frootai.frootai-vscode/openPlay?id=01`) for end-to-end verification.

### Notes
- Activation event remains `onStartupFinished` — no `onUri` needed since the extension is always active when VS Code is open.
- VS Code's built-in install prompt fires automatically for users who don't have FrootAI installed and click a deep-link from the website.
- Tag `ext-v5.1.7` will trigger the GitHub Actions workflow to publish to the VS Code Marketplace + Open VSX.

---

## [5.1.6] — 2026-05-05

> Picks up the version-correction stub originally drafted on 2026-05-03 and merges it with the substantive bug-fix work shipped 2026-05-05. **Single 5.1.6 release** — sequential successor to marketplace-published `5.1.5`, per the doctrine line at the top of this file.

### Fixed
- **6 PlayDetail buttons silently no-op'd** when the user navigated `Browse Plays → click play card → PlayDetail` (in-place navigation). Root cause: `setupNavigationHandler` (`src/extension.ts`) only handled 3 of the 9 webview commands (`initDevKit`/`initTuneKit`/`initSpecKit`); the other 6 (`initHooks`, `initPrompts`, `installPlugin`, `cost`, `diagram`, `runEvaluation`) hit the default case and were dropped. Now all 9 are wired with a shared `resolvePlay()` helper that accepts both `playId` and `playDir`, plus try/catch + auto-revealing OutputChannel logs.
- **Architecture Diagram showed only "Loading..."** — the panel was created with `enableScripts: false`, but `markdownToHtml()` requires inline scripts to load `marked.js` + `mermaid.js` from `cdn.jsdelivr.net` and render the markdown. Fixed by setting `enableScripts: true` on this panel only (CSP already restricts script-src to that CDN) and passing the markdown directly to `markdownToHtml` rather than extracting `<body>` and re-wrapping (which orphaned the script tag).
- **`installPlugin` always opened a QuickPick** even when invoked from PlayDetail with a known play. Refactored `frootai.installPlugin` to accept an optional `preSelectedPlay` argument and skip the picker when present (same pattern as `initDevKit`).
- **2 commands were not declared in `package.json` `contributes.commands[]`** (`estimateCostForPlay`, `showArchitectureDiagram`). Runtime registration succeeded but VS Code's manifest contract treated them as ghost commands. All 10 commands now declared.

### Added
- **`frootai.estimateCostForPlay`** — dedicated command that loads `cost.json` (local repo → GitHub fallback via `downloadFromGitHub`) and renders an itemized webview with grouped service breakdown by category, dev/prod/enterprise tier totals, bar charts, and optimization tips. Accepts optional `preSelectedPlay`.
- **`frootai.showArchitectureDiagram`** — dedicated command that loads `architecture.md` (local → GitHub) and renders full markdown including Mermaid diagrams via `marked.js` + `mermaid.js`. Falls back to a service-list summary when `architecture.md` is missing.
- **`frootai.healthCheck`** — self-diagnostic command available from the Command Palette. Calls `vscode.commands.getCommands(true)`, iterates the 9 expected PlayDetail commands, prints ✅/❌ to the FrootAI Output channel (force-revealed), and shows a toast summary. Lets users diagnose missing-command bugs without opening dev tools.
- **Sticky `FrootAI v5.1.6 ✓` badge** in the top-right corner of every PlayDetail panel — visual proof the user is on the new bundle without opening dev tools.

### Changed
- **Phase 1 harmonization** (carried over from the original 2026-05-03 stub) — `package.json` version corrected from vanity-inflated `6.8.1` down to `5.1.6` (= VSX-published `5.1.5` + 1 patch). The `[9.3.0]` entry below describes feature work that was completed but **never published to the VS Code Marketplace under that label** — its body of work is preserved for archeology; the version label was fictional.
- **`extension.ts` PlayDetail message switch** reduced from ~340 lines of inline handlers to 9 one-liner `executeCommand` delegations following the same pattern as the working Full Packages buttons. All implementation now lives in `legacy.js` registered commands.
- **OutputChannel `FrootAI`** added at activation, stored on `globalThis.__frootaiLog`, used by both PlayDetail and `setupNavigationHandler` for every received message + every error (auto-revealed on failure).
- **Webview cache-buster** — `?v=${nonce}-${Date.now()}` appended to `main.js` and `main.css` URLs in `reactHost.ts` so VS Code never serves stale assets between extension upgrades.

### Documentation
- New repo memory at `/memories/repo/vscode-extension-debugging.md` documenting the two-layer registration trap (runtime + `package.json`), the multi-handler audit pattern (`grep onDidReceiveMessage`), and the clean-install procedure (`Remove-Item` the old folder before `--install-extension`).

### Notes
- This release is **not yet published**. Tag `ext-v5.1.6` will trigger the GitHub workflow once operator commits and pushes.
- Local 5.2.x dev iterations (5.2.0 → 5.2.3) and a transient 5.3.0 draft were collapsed into this single 5.1.6 release per the "+1 patch from registry" doctrine. They never shipped publicly.
- See `.internal/improvements/PHASE-1-EXECUTION-LOG.md` for full audit trail.

---

## [9.3.0] — 2026-04-16
> ⚠ This version was **never published** to the VS Code Marketplace. Body of work is preserved here for archeology; superseded by `[5.1.6]` above.

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
