# FrootAI — Copilot Instructions

> Architecture guidance for implementing FrootAI solutions.

## 🧬 Mission DNA
We are building the **industry standard for AI primitive unification**. The FAI Protocol (`fai-manifest.json`) is the missing binding glue — context-wiring between agents, instructions, skills, hooks, workflows, plugins, tools, prompts, and guardrails. MCP handles tool calling. A2A handles delegation. AG-UI handles rendering. **We handle wiring.** One day every AI platform will adopt this standard. We are the pioneers.

**Terminology:** FAI Protocol (the spec) → FAI Layer (the conceptual glue) → FAI Engine (the runtime) → FAI Factory (CI/CD) → FAI Packages (distribution) → FAI Toolkit (DevKit+TuneKit+SpecKit) → FAI Marketplace (discovery).

## Implementation Plan Sections Tracker
The implementation plan `.internal/improvisation/implementation-plan.md` has **25 sections + appendices**. Track ALL sections — not just the K-tasks and AI-items:
- **Section 0:** Master Tracker (K-tasks 49/49 ✅, AI-items 115/115 ✅)
- **Sections 1-2:** Mission understanding + competitor landscape (reference knowledge)
- **Section 3:** Improvisation priorities (21/23 done)
- **Sections 6-14:** Phase 1-9 findings with per-phase action items (mark ✅ as done)
- **Section 15:** Cross-cutting synthesis + gap analysis
- **Sections 16-17:** Grand Vision + Co-Founder Discussion (FAI Protocol design, 100-play roadmap)
- **Section 18:** Kickstart Strategy (49/49 ✅)
- **Section 19:** Coverage Gaps + Website Backlog
- **Section 25:** April 6 Website Polish Sprint (20/20 ✅)
- **Appendices 2A-9A:** Complete primitive indexes (187 agents, 175 instructions, 271 skills mapped)

## Section 25 Status — April 6 Website Polish Sprint
**Done (20/20):** I-1 through I-20 ✅ — play detail pages (100/100), user guides (100/100), primitives landing with category cards, sub-pages with Download/VS Code/GitHub/Copy/Share buttons, marketplace pagination + modals, contribute section, FAI rename, MCP page with 25/25 tools, knowledge.json ecosystem data, search-index 2072 entries, chatbot prompt updated, Python SDK updated, learning pages with prev/next nav + CodeBlock, all links verified, stale numbers fixed, data regenerated
**Not started (0/20):** ALL COMPLETE

## Current Website Stats (April 6, 2026)
- **145 HTML pages** in frootai.dev static output
- **100 solution plays** with View Play + User Guide pages
- **4 primitive sub-pages** (agents 238, instructions 176, skills 322, hooks 10)
- **77 plugins** with pagination (20/page), click-to-view modals, download/copy/share
- **15 learning hub pages** (L1-L15) with avg 340 lines, CodeBlock, prev/next nav
- **16 cookbook recipes** + **12 workflows** with modals
- All primitive display names use "FAI" prefix (not "FrootAI")
- VS Code install uses `vscode://github.copilot-chat/createAgent` protocol
- **Content Scaling Sprint:** Skills ✅ (159 avg), Hooks ✅ (449 avg), Plugins ✅ (124 avg), Workflows ✅ (306 avg), Cookbook ✅ (344 avg). Agents 10/238 done, Instructions 10/176 done
- **Distribution:** VS Code v2.0.0, MCP v3.5.0, Python SDK v4.0.0, Python MCP v3.5.0, Docker v3.5.0 — all synced with 100 plays + 860+ primitives + FAI Protocol

## Agent Workflow
When implementing features, follow the builder → reviewer → tuner chain:
1. **Build**: Implement using config/ values and architecture patterns from FrootAI MCP
2. **Review**: Self-review against security, RAG quality, Azure best practices, config compliance
3. **Tune**: Verify config/*.json values are production-appropriate and evaluation thresholds are met

For explicit agent handoffs, use @builder, @reviewer, or @tuner in Copilot Chat.

## Solution Play Modernization (MUST READ before modifying any solution play)

The golden standard for modernizing solution plays lives at `.internal/improvisation/solution-play-improvisation.md` (3,724 lines, 56 rules). **Before starting ANY solution play work, `read_file .internal/improvisation/solution-play-improvisation.md` — specifically Section 47 (Condensed Execution Reference), Section 46 (Master Gap Register), and Section 34 (Modernization Execution Checklist).**

### Three-Phase Execution (Rule 46 — NEVER skip a phase)

| Phase | Scope | What to Do |
|-------|-------|-----------|
| **Phase 1: GitHub** | Core repo (`c:\CodeSpace\frootai`) | Rewrite copilot-instructions.md (<150 lines, knowledge-only). Fix agents (named, proper tools, file discovery). Upgrade skills (150+ lines). Fix hooks (SessionStart only). Fix workflows (.yml). Fix MCP (npx). Restructure to 4-kit (DevKit/TuneKit/SpecKit/Infra). Verify token budget. Scan for Play 100 remnants. Commit + push. |
| **Phase 2: Distribution** | VS Code, npm, PyPI | Update VS Code extension (SOLUTION_PLAYS, Init DevKit scanner). Update MCP knowledge.json. Update Python SDK. Tag per channel: `ext-vN.N.N`, `mcp-vN.N.N`, `sdk-vN.N.N`. Do in batches (after 5-10 plays), not per-play. |
| **Phase 3: Website** | `c:\CodeSpace\frootai.dev` | Update play detail pages, user guides, primitives counts, search index. Do in batches after distribution channel updates. |

### Key Principles (from 56 golden rules)
- **Rule 41**: copilot-instructions.md = knowledge supplement, NOT behavioral override. If removing a line doesn't change model output quality, delete it.
- **Rule 42**: Hybrid model — generic Copilot does 90%, Play adds domain corrections. Agents are OPTIONAL.
- **Rule 31**: copilot-instructions.md MUST be <150 lines / <1500 tokens (most expensive file — always loaded).
- **Rule 33**: NEVER use PreToolUse hooks (spawn process per tool call → 5s delay each). 8 events available: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PreCompact, SubagentStart, SubagentStop, Stop.
- **Rule 45**: Play 101 file structure is the golden template. Match it for every play.
- **Rule 50**: Agents must use handoffs for builder→reviewer→tuner with pre-filled prompts.
- **Rule 52**: Differentiate models by agent role — builder=gpt-4o, reviewer/tuner=gpt-4o-mini, add fallback arrays.
- **Rule 53**: MCP config = committed infra — use `inputs` for secrets, `envFile` for .env, never hardcode keys.
- **Rule 55**: Plugins = DevKit distribution format. Design DevKit to be plugin-extractable.
- **Rule 56**: Follow MS 4-step workflow — Explore → Plan → Implement → Review.

### Play 101 Golden Template Structure
```
solution-play-NN/
├── agent.md                           ← DevKit: root orchestrator (only root file)
├── .github/                           ← DevKit: Copilot brain
│   ├── copilot-instructions.md        ←   <150 lines, knowledge ONLY
│   ├── agents/{builder,reviewer,tuner}.agent.md
│   ├── instructions/{domain}*.instructions.md
│   ├── prompts/{test,review,deploy,evaluate}.prompt.md
│   ├── skills/{action}-{domain}/SKILL.md  (150+ lines each)
│   ├── hooks/{domain}-guardrails.json     (SessionStart only)
│   └── workflows/*.yml
├── .vscode/mcp.json + settings.json   ← DevKit: editor config
├── config/                            ← TuneKit: customer-tunable AI params
├── infra/                             ← Infra: AVM Bicep (Azure plays ONLY)
├── evaluation/                        ← AI plays: eval pipeline
└── spec/                              ← SpecKit: metadata + docs
```

## Primitive Review Checklist (PR Validation)
When reviewing PRs that add or modify agents, instructions, skills, hooks, or plugins, verify:

### Naming Convention (All Primitives)
- All files: **lowercase-hyphen** (no underscores, no camelCase)
- Examples: `fai-rag-architect.agent.md`, `python-waf.instructions.md`, `fai-play-initializer/SKILL.md`

### Frontmatter Requirements

| Primitive | Required Fields | Validation |
|-----------|----------------|------------|
| `.agent.md` | `description` (10+ chars) | Optional: `name`, `model`, `tools`, `waf[]`, `plays[]` |
| `.instructions.md` | `description` (10+ chars), `applyTo` (glob) | Optional: `waf[]` |
| `SKILL.md` | `name` (kebab, matches folder), `description` (10-1024 chars) | Name must equal parent folder |
| `hooks.json` | `version: 1`, at least one event | Events: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PreCompact, SubagentStart, SubagentStop, Stop |
| `plugin.json` | `name`, `description`, `version` (semver), `author.name`, `license` | Name must match folder |
| `fai-manifest.json` | `play` (NN-kebab), `version` (semver), `context.knowledge[]`, `context.waf[]`, `primitives` | Guardrails thresholds 0-1 |
| `fai-context.json` | None required | WAF values must be valid pillar names |

### PR Checklist
- [ ] File naming follows lowercase-hyphen convention
- [ ] Frontmatter has all required fields per type
- [ ] `npm run validate:primitives` passes (0 errors)
- [ ] No secrets, API keys, or connection strings in any file
- [ ] WAF pillar references use valid values from the 6-pillar set
- [ ] If new play: `fai-manifest.json` exists with context + primitives + guardrails
- [ ] If new plugin: `plugin.json` + README.md exist, marketplace regenerated

## Well-Architected Framework Alignment
All FrootAI solution plays follow the 6 WAF pillars. See `.github/instructions/` for detailed guidance:
- **Reliability**: Retry, circuit breaker, health checks, graceful degradation
- **Security**: Managed Identity, Key Vault, content safety, RBAC
- **Cost Optimization**: Model routing, token budgets, right-sizing
- **Operational Excellence**: CI/CD, observability, IaC, incident management
- **Performance Efficiency**: Caching, streaming, async, bundle optimization
- **Responsible AI**: Content safety, groundedness, fairness, transparency

## Content Sync
When changing tool counts, versions, module counts, or play counts:
1. Update the source of truth (index.js, package.json, knowledge.json)
2. Run `node scripts/sync-content.js` to propagate
3. Run `node scripts/validate-consistency.js` to verify
See `scripts/CONTENT-SOURCE-MAP.md` for the full data flow.

## Local Website Preview (RAM-safe)
**Never use `next dev` for previewing** — it holds the full module graph in memory (~2-3GB).
Instead, build once and serve the static output:
```bash
cd c:\CodeSpace\frootai.dev
npx next build                       # One-time build, Node exits after
npx serve out -p 3000                # ~30MB RAM static server (NO -s flag)
```
If hot-reload is absolutely needed, cap memory:
```bash
$env:NODE_OPTIONS="--max-old-space-size=1024"; npx next dev -p 3000
```

## Node.js Process Hygiene
**This machine has limited RAM.** Before and after any build/serve operation:
1. Kill orphan Node processes: `Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*postcss*" -or $_.CommandLine -like "*next*dev*" } | Stop-Process -Force`
2. Verify only expected processes remain: `Get-Process -Name "node" -ErrorAction SilentlyContinue | Select-Object Id, @{N='MB';E={[math]::Round($_.WorkingSet64/1MB,1)}} | Format-Table`
3. Expected processes: VS Code Copilot backend (~60MB) + `serve` static server (~60MB). Total ~120MB max.
4. **Never leave `next dev` running** — it spawns 100+ PostCSS workers that persist as zombies after crashes.
5. When starting a new serve instance, kill the old one first.

## Bottom Nav GlowPill Color Standard
Every page's bottom navigation must use these exact colors:
| Pill | Color | Hex |
|------|-------|-----|
| Back to FrootAI | Emerald | `#10b981` |
| Ask Agent FAI | Gold | `#d4a853` |
| Configurator | Amber | `#f59e0b` |
| Solution Plays | Violet | `#7c3aed` |
| Ecosystem | Sky | `#0ea5e9` |
| Setup Guide | Orange | `#f97316` |
| GitHub / Star | Yellow | `#eab308` |
| VS Code Extension | Indigo | `#6366f1` |
| MCP Server | Violet | `#7c3aed` |
| Community | Green | `#00c853` |

"Back to FrootAI" must always be branded: `<span>Back to <span className="text-white">Froot</span><span className="text-emerald">AI</span></span>`
"Ask Agent FAI" must always be branded: `<span>Ask Agent <span className="text-white">F</span><span className="text-emerald">AI</span></span>`
Page titles use "FAI" not "FrootAI" (e.g., "FAI CLI", "FAI MCP Server", "FAI VS Code Extension").

## Release Process
```bash
npm run release:dry    # Preview version bump + changelog
npm run release        # Bump → sync → validate → commit → tag
git push origin main --tags  # Triggers npm + vsce + docker publish
```

## Implementation Plan Execution (Kickstart Protocol)

### Co-Founder Mindset
Act as a seasoned co-founder who has built 10+ startups and exited two for billions. Bring that founder energy — decisive, creative, quality-obsessed, shipping-focused. When something is missing from a prompt, fill the gap with expertise. We are building the best product in the AI primitives ecosystem.

### Originality & Creative Differentiation
FrootAI's competitive analysis lives in `.internal/` (gitignored — NEVER pushed to remote). We study the ecosystem deeply but **everything we build is original**:
- Study patterns, understand architectures, learn from what works — then build something 10x more efficient, connected, and elegant
- Every FrootAI primitive must have WAF alignment, shared context wiring, and play compatibility — things no competitor has
- Never copy structure, naming, or content verbatim. Translate, enhance, and wire into the FAI Layer
- Our differentiator: standalone primitives that auto-wire when used inside solution plays

### Single Source of Truth
The implementation plan lives at `.internal/improvisation/implementation-plan.md`.
- **Section 0** contains the Master Execution Tracker — update it after EVERY task
- All 49 K-tasks and 115 AI action items are tracked there
- Mark tasks: ⬜ Not Started → 🔄 In Progress → ✅ Complete
- Update the Phase Status Overview counters after each completion

### Dual-Repo Simultaneous Updates
FrootAI has TWO linked repositories — update BOTH when a task affects the frontend:
- **Core repo** (`c:\CodeSpace\frootai\`) — primitives, schemas, engine, MCP, SDK
- **Website repo** (`c:\CodeSpace\frootai.dev\`) — Next.js 16 frontend, user-facing pages

**Rule:** When creating a new primitive category (agents/, skills/, hooks/, etc.) or adding content that users should discover, update the website simultaneously. Do NOT accumulate a website backlog — ship core + frontend together for every feature.

### Validate & Verify After Every Action
After every phase or action item completion:
1. **Schema check** — run `node scripts/validate-primitives.js` (once it exists)
2. **Syntax check** — `node -e "require('./path/to/file.json')"` for JSON; `bash -n script.sh` for bash
3. **Repo verify** — ensure the file exists, has content (no placeholders), and follows naming conventions
4. **Website verify** — if users should see this, check frootai.dev has it too (build + visual check)
5. **Cross-reference** — does this change affect README.md, knowledge.json, or package.json? Update them

### Task Execution Standard
For every K-task:
1. **State the task** — what we're building and why
2. **Execute** — create files with full content, no placeholders
3. **Verify** — run validation (schema check, syntax check, lint)
4. **Update tracker** — mark ✅ in Section 0 with date and notes
5. **Website check** — does this need a frontend update? If yes, do it now
6. **README check** — after completing a set of related items, update the repo README.md to reflect new capabilities

### Tracker & Learnings Updates
After completing each phase or significant milestone:
1. Update Section 0 tracker with ✅ status, date, and verification notes
2. If there are learnings, gotchas, or future improvements discovered during execution — add them to the **Future Roadmap** section at the end of the implementation plan
3. Keep the implementation plan as a living document — it evolves as we learn

### README & Documentation Cadence
When a set of related items is complete (e.g., all K1 schemas done, all K2 hooks done):
- Update the `README.md` at the repo root to reflect new capabilities
- Update `schemas/README.md` (or relevant folder README) with actual status (Planned → Done)
- If the feature is user-facing, add it to the website

### Internal Files — Gitignored
The `.internal/` folder is gitignored and MUST stay that way:
- `.internal/docs/` — competitor analysis, strategic docs
- `.internal/improvisation/` — implementation plan, internal notes
- `.internal/competitor/` — cloned competitor repos for reference
- **NEVER** reference competitor file paths in public-facing code or docs

### Primitive Naming Convention
All FrootAI primitives follow lowercase-hyphen naming:
- Agents: `kebab-case.agent.md` (e.g., `frootai-rag-architect.agent.md`)
- Instructions: `kebab-case.instructions.md` (e.g., `python-waf.instructions.md`)
- Skills: `kebab-case/SKILL.md` folder (e.g., `frootai-play-initializer/SKILL.md`)
- Hooks: `kebab-case/` folder with `hooks.json` + script (e.g., `frootai-secrets-scanner/`)
- Plugins: `kebab-case/plugin.json` (e.g., `enterprise-rag/plugin.json`)

### FAI Protocol Files
- `fai-manifest.json` — full play wiring (context + primitives + infrastructure + toolkit)
- `fai-context.json` — lightweight LEGO block context reference (assumes + waf + compatible-plays)
- All schemas live in `schemas/` and validate via `scripts/validate-primitives.js`
