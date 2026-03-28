# FrootAI Website v6 — Implementation Plan

> **Goal**: Complete production-grade modernization. Every page rewritten from scratch using modern Tailwind CSS, React Server Components, Framer Motion, and shadcn/ui patterns. Zero regression, zero shortcuts, zero copied inline styles.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, static export) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 (zero inline styles) |
| Components | shadcn/ui patterns (CVA + Tailwind Merge) |
| Animation | Framer Motion |
| Icons | Lucide React |
| Markdown | react-markdown + remark-gfm (tables, code, lists) |
| Fonts | Geist Sans + Geist Mono |
| Deployment | Static export → GitHub Pages |

---

## Phase 0 — Foundation (Scaffold + Design System + Shared Components)

### Tier 0.1 — Project Scaffold
- [x] Create `website-v6/` with Next.js, TypeScript, Tailwind CSS
- [x] Install: framer-motion, lucide-react, clsx, class-variance-authority, tailwind-merge, react-markdown, remark-gfm
- [x] Configure `next.config.ts` with `output: 'export'`, turbopack root
- [x] Copy `/public/img/` assets from production site

### Tier 0.2 — Design System (globals.css)
- [x] Color tokens: ultra-deep dark (#050508), FROOT brand palette (amber, emerald, cyan, indigo, violet)
- [x] Typography: Geist font variables, tracking, line-height scale
- [x] Border/surface/elevated token layers
- [x] CSS utilities: gradient-text-froot, gradient-text-gold, glow effects
- [x] Animation keyframes: float, pulse, marquee, bounce-dot, streaming-cursor, blink
- [x] Glassmorphism class
- [x] Glow card hover (with CSS custom property --glow)
- [x] Pill link component class
- [x] Scrollbar, selection, smooth scroll

### Tier 0.3 — Reusable UI Components (src/components/ui/)
- [x] `button.tsx` — CVA variants (default, outline, ghost, pill), sizes (sm, md, lg)
- [x] `card.tsx` — Glow card with --glow color prop, hover lift
- [x] `badge.tsx` — Status badge (Ready/Skeleton/Coming Soon), color-coded
- [x] `section-header.tsx` — Title + subtitle + optional badge, centered
- [x] `code-block.tsx` — Styled code with copy button
- [x] `pill-link.tsx` — Rounded link with color accent
- [x] `glow-pill.tsx` — CTA pill links matching production site
- [x] `expandable.tsx` — Expand/collapse with Framer Motion animation

### Tier 0.4 — Layout Components (src/components/layout/)
- [x] `navbar.tsx` — 5 dropdown menus + right links (Hi FAI, Agent FAI, GitHub). Animated dropdowns with Framer Motion. Mobile hamburger with grouped sections.
- [x] `footer.tsx` — 4 columns (Explore, Community, Install, Connect) + copyright
- [x] `page-shell.tsx` — Reusable page wrapper with title, subtitle, badge, back-link, bottom pills
- [x] `announcement-bar.tsx` — Top banner matching production (MCP + VS Code promo, dismissible)

### Tier 0.5 — Motion Components (src/components/motion/)
- [x] `fade-in.tsx` — Scroll-triggered reveal (direction: up/down/left/right/none)
- [x] `stagger-children.tsx` — Container that staggers child animations (StaggerChildren + StaggerItem)

### Tier 0.6 — Root Layout
- [x] `layout.tsx` — Geist fonts, dark mode forced, AnnouncementBar + Navbar + Footer + main
- [x] Full SEO metadata matching production (OG, Twitter, favicon)

**Validation**: `npx next build` — 0 errors. ✅ PASSED

---

## Phase 1 — Landing Page + Chatbot (2 highest-impact pages)

### Tier 1.1 — Landing Page (`/`)
- [x] Hero: Animated floating logo, gradient title "FrootAI", FROOT acronym with colored letters, mission quote box, ambient glow backdrop
- [x] Ecosystem Grid: 10 cards (glow-card component), responsive 5-col desktop → 2-col mobile
- [x] Stats Bar: 4 animated counters (18+ Modules, 20 Plays, 22 Tools, 200+ Terms)
- [x] FROOT Framework: 5 expandable layers, each with module chip links
- [x] Outcomes Grid: 8 achievement cards
- [x] CTA Section: BIY headline, Infra/Platform/App metaphor, 14 pill links
- [x] Verify all internal links work

### Tier 1.2 — Chatbot (`/chatbot`)
- [x] Hero header: "Agent FAI" gradient title, "Powered by Azure OpenAI GPT-4.1" badge
- [x] Chat container: Glassmorphism card with border glow
- [x] Message rendering: User (right-aligned, amber tint) vs Assistant (left-aligned, with ✨ avatar)
- [x] **Markdown rendering** (CRITICAL): Tables, bold, code blocks (inline + block), lists (ul/ol), blockquotes, links (amber colored), headings, horizontal rules — ALL styled with Tailwind
- [x] SSE streaming: Read `data: {content}` chunks, append to message, show streaming cursor
- [x] Compute augmentation: `/api/estimate-cost` for cost questions, `/api/search-plays` for play search
- [x] Fallback responses for 6 categories (document, rag, agent, cost, mcp, start)
- [x] Suggestion chips: 6 initial prompts + context-aware follow-ups based on last response
- [x] Bounce-dot loading animation
- [x] Auto-scroll with manual override (user scrolls up = pause)
- [x] Textarea input with auto-resize, Shift+Enter for newline
- [x] Bottom navigation pills (4 GlowPill links)

**Validation**: Build 0 errors. Routes: / (51KB), /chatbot (35KB). ✅ PASSED

---

## Phase 2 — Solution Plays + Configurator + Ecosystem (3 core product pages)

### Tier 2.1 — Solution Plays (`/solution-plays`)
- [x] Header with play count
- [x] 3 explainer cards: .github Agentic OS, DevKit, TuneKit (with layer details)
- [x] 20 PlayCard components, each with:
  - Icon, ID, name, description
  - Status badge (Ready/Skeleton), Complexity badge, WAF badge, SpecKit badge
  - Infra stack, Tuning knobs
  - 5 action buttons: GitHub, DevKit, TuneKit, SpecKit, User Guide
  - Expandable user guide section with monospace text
  - Hover border glow

### Tier 2.2 — Configurator (`/configurator`)
- [x] 3-step wizard with progress bar
- [x] Step 1: "What are you building?" — 8 options
- [x] Step 2: "Team's primary role?" — 4 options
- [x] Step 3: "Complexity level?" — 3 options
- [x] Result: Recommended plays with User Guide + View Play + Setup Guide links
- [x] "Start Over" button
- [x] Bottom navigation pills

### Tier 2.3 — Ecosystem (`/ecosystem`)
- [x] Telescope section: Solution Plays card + FROOT Packages card (2-col)
- [x] Microscope section: MCP Server + VS Code Extension + Docker + CLI (4 cards)
- [x] Each card with bullet features + CTA pill

**Validation**: All 20 plays render. Expand/collapse works. Configurator wizard completes. All links valid. ✅ PASSED

---

## Phase 3 — Developer Tools (4 pages)

### Tier 3.1 — MCP Tooling (`/mcp-tooling`)
- [x] 3 install method cards (Quick Run, Install Global, npm Registry)
- [x] Without vs With comparison cards
- [x] 6 client config cards (Claude, VS Code, Foundry, Cursor, Copilot Studio, Gemini)
- [x] 6 static tools grid, 4 live tools grid, 3 agent chain tools grid
- [x] 6 AI ecosystem tools grid
- [x] Bottom navigation pills

### Tier 3.2 — VS Code Extension (`/vscode-extension`)
- [x] Install card with marketplace link
- [x] 3 "What You Get" cards (Solution Plays, FROOT Modules, MCP Tools)
- [x] 12 commands list with hot/normal styling
- [x] DevKit Init workflow explanation (4 steps with Layer details)
- [x] Bottom navigation pills

### Tier 3.3 — CLI (`/cli`)
- [x] 8 CLI commands with descriptions
- [x] Install instructions + npx usage
- [x] Full `frootai init` example with output
- [x] Bottom navigation pills

### Tier 3.4 — Docker (`/docker`)
- [x] Quick start commands
- [x] 6 image detail cards (Registry, Image, Arch, Tools, Knowledge, Size)
- [x] 2 client configs (Claude + VS Code) with code blocks
- [x] Docker Compose sidecar example
- [x] "Why Docker" feature list
- [x] Bottom navigation pills

**Validation**: Build 0 errors. All 4 routes HTTP 200. ✅ PASSED

---

## Phase 4 — Knowledge & Learning (4 pages)

### Tier 4.1 — Packages (`/packages`)
- [x] 6 category cards (Foundations, Reasoning, Orchestration, Operations, Transformation, MCP Tools)
- [x] Category filter buttons (click to filter, click again to show all)
- [x] 21 packages with: ID badge, name, description, file, size, date, 3 links (Docs, GitHub, Raw)
- [x] Responsive layout (mobile stacked, desktop side-by-side)

### Tier 4.2 — Learning Hub (`/learning-hub`)
- [x] 4 path cards (Knowledge Modules, AI Glossary, Workshops, Quiz) with glow-card hover
- [x] Coming Soon: Certification section with dashed border + violet badge
- [x] Explore More CTA section with 4 GlowPill links

### Tier 4.3 — Setup Guide (`/setup-guide`)
- [x] 4 section scroll buttons (MCP, VS Code, CLI, Docker) with color-coded borders
- [x] MCP section: Prerequisites card, 3 install options (npm/Docker/GitHub), 3-tab client config (Claude/VS Code/Foundry)
- [x] VS Code section: Install command + sidebar capabilities
- [x] CLI section: 4 key commands
- [x] Docker section: Quick start command

### Tier 4.4 — Hi FAI (`/hi-fai`)
- [x] 5-step guided quickstart with animated step transitions (AnimatePresence)
- [x] Step 1: Welcome + 4 stat cards + FROOT quote
- [x] Step 2: VS Code install + sidebar panels
- [x] Step 3: MCP setup + mcp.json config
- [x] Step 4: DevKit + TuneKit init cards
- [x] Step 5: Agent chain (Build → Review → Tune) + completion CTAs
- [x] Progress bar with clickable step indicators
- [x] Previous/Next navigation buttons

**Validation**: Build 0 errors. 14 routes. All 4 new: /packages (71KB), /learning-hub (40KB), /setup-guide (43KB), /hi-fai (33KB). ✅ PASSED

---

## Phase 5 — Community & Enterprise (5 pages)

### Tier 5.1 — Partners (`/partners`)
- [x] How Partner MCP Works (4-step flow)
- [x] 6 partner cards (ServiceNow, Salesforce, SAP, Datadog, PagerDuty, Jira) with capabilities lists + "Coming Soon" badges
- [x] Propose a Partner CTA section

### Tier 5.2 — Marketplace (`/marketplace`)
- [x] How It Works (3-step cards)
- [x] Plugin manifest example (plugin.json code block)
- [x] 20 featured plugin cards in responsive grid
- [x] Submit plugin CTA

### Tier 5.3 — Community (`/community`)
- [x] Star on GitHub badge
- [x] Everything is Free card ($0 — Forever, 10 items)
- [x] How to Contribute (4 cards: Add Play, Improve Knowledge, Build Tools, Star & Share)
- [x] Ready to Join CTA with 4 GlowPill links

### Tier 5.4 — Enterprise (`/enterprise`)
- [x] Mirrors community with enterprise angle
- [x] Everything is Free card
- [x] Navigation links

### Tier 5.5 — Adoption (`/adoption`)
- [x] 6 stat cards with icons and colors
- [x] Ecosystem Health table (6 components with version/status)
- [x] 6 use case cards (RAG, Agents, Landing Zones, Cost, Training, DevOps)
- [x] Integration points grid (6 clients)

**Validation**: Build 0 errors. 19 routes. All 5 new: /partners (56KB), /marketplace (61KB), /community (44KB), /enterprise (37KB), /adoption (62KB). ✅ PASSED

---

## Phase 6 — Developer Hub & Reference (5 pages)

### Tier 6.1 — Dev Hub (`/dev-hub`)
- [x] 6 quick link glow-cards (Admin Guide, User Guide, Contributor Guide, API Reference, Changelog, Architecture)
- [x] 3-step Getting Started with code blocks
- [x] Latest Release versions (3 cards)
- [x] Developer Resources grid (4 external links)
- [x] Ready to build CTA

### Tier 6.2 — Feature Spec (`/feature-spec`)
- [x] 16-section scrollable table of contents with anchor links
- [x] FeatureTable component (Feature, Description, Status, Link columns)
- [x] Platform Overview (9-row table) + Solution Plays (4-row table) fully populated
- [x] Sections 3–16 with headers, descriptions, and "View details →" links

### Tier 6.3 — API Docs (`/api-docs`)
- [x] 6 REST API endpoints with method badge, path, description
- [x] Request/Response code blocks side-by-side
- [x] Base URL code block

### Tier 6.4 — Eval Dashboard (`/eval-dashboard`)
- [x] 6 quality metric cards (Groundedness, Coherence, Relevance, Fluency, Safety, Cost)
- [x] Each with target threshold, description, icon, color
- [x] Evaluation pipeline (4-step ordered list)

### Tier 6.5 — Dev Hub Changelog (`/dev-hub-changelog`)
- [x] 4 release entries (v3.1.2, v3.0.0, v2.0.0, v1.0.0) with version badge, date, change list
- [x] GitHub Releases external link

**Validation**: Build 0 errors. 24 routes. All 5 new: /dev-hub (53KB), /feature-spec (48KB), /api-docs (56KB), /eval-dashboard (45KB), /dev-hub-changelog (42KB). ✅ PASSED

---

## Phase 7 — Dynamic Pages + Docs System (2 pages)

### Tier 7.1 — User Guide (`/user-guide`)
- [x] Dynamic page reading `?play=XX` from URL via useSearchParams + Suspense
- [x] Play-specific guide with 6 steps (VS Code → DevKit → TuneKit → MCP → Auto-Chain → Deploy)
- [x] All 20 plays supported with full data (name, icon, desc, infra, tune, cx, status, github)
- [x] Status + Complexity badges
- [x] Summary card ("What You Just Did")
- [x] Bottom navigation GlowPills
- [x] "Play not found" fallback for invalid IDs

### Tier 7.2 — Docs System (`/docs` + `/docs/[slug]`)
- [x] Docs index page listing all 24 markdown files grouped by 5 FROOT layers
- [x] 7 extra guides/references linked separately
- [x] Dynamic [slug] page that reads markdown from ../docs/ folder at build time
- [x] generateStaticParams for all 24 slugs
- [x] Full markdown rendering with Tailwind-styled components (h1-h4, p, a, strong, code, pre, table, thead, th, td, ul, ol, li, blockquote, hr, img)
- [x] Tables render with proper thead/td borders and emerald headers
- [x] Code blocks render with border, bg, overflow-x-auto
- [x] "Edit on GitHub" link per doc
- [x] Back navigation link

**Validation**: Build 0 errors. 51 routes (25 pages + 24 docs + /docs index + /404). /docs/RAG-Architecture: 291KB rendered. ✅ PASSED

---

## Phase 8 — Final Polish + Validation

### Tier 8.1 — Cross-Page Consistency
- [x] Every page uses PageShell, SectionHeader, or custom layout appropriate to its type
- [x] All navigation pills use GlowPill component consistently
- [x] All cards use Card or glow-card CSS class consistently
- [x] Typography hierarchy consistent (text-2xl font-bold for h2, text-lg for h3, text-[13px] for body)

### Tier 8.2 — Animation Polish
- [x] FadeIn on every section header (verified: all page and client files)
- [x] StaggerChildren on all card grids (ecosystem, outcomes, features, packages, etc.)
- [x] Smooth expand/collapse with Framer Motion AnimatePresence (FROOT layers, play guides, hi-fai steps)
- [x] Hover states on every interactive element (hover:-translate-y, hover:border-*, hover:bg-*, hover:scale-110)

### Tier 8.3 — Mobile Audit
- [x] All grids use responsive breakpoints (grid-cols-1 sm:grid-cols-2 lg:grid-cols-*)
- [x] All flex layouts wrap on mobile (flex-wrap, flex-col sm:flex-row)
- [x] Touch targets adequate (py-2.5+, px-3+, min 44px effective)
- [x] Hamburger menu works (lg:hidden mobile menu with AnimatePresence, max-h-[75vh] scroll)
- [x] Chatbot usable on mobile (max-w-3xl, responsive padding, auto-resize textarea)

### Tier 8.4 — Full Validation Suite
- [x] `npx next build` — 0 errors, 51 routes generated
- [x] HTTP 200 on all 25 page routes (25/25 PASS)
- [x] HTTP 200 on all 24 doc routes (24/24 PASS)
- [x] Chatbot markdown components: tables (th/td styled), code blocks (inline + block), bold (gold), lists, blockquotes, links (amber), headings, hr — ALL Tailwind-styled
- [x] Static export: 465 files, 12.4 MB — GitHub Pages ready

**FINAL VALIDATION: 49/49 routes PASS. 0 build errors. 51 source files. ALL PHASES COMPLETE. ✅**

---

## Summary

| Phase | Pages | Description |
|-------|-------|-------------|
| 0 | 0 | Foundation: scaffold, design system, shared components |
| 1 | 2 | Landing page + Chatbot |
| 2 | 3 | Solution Plays + Configurator + Ecosystem |
| 3 | 4 | MCP Tooling + VS Code + CLI + Docker |
| 4 | 4 | Packages + Learning Hub + Setup Guide + Hi FAI |
| 5 | 5 | Partners + Marketplace + Community + Enterprise + Adoption |
| 6 | 5 | Dev Hub + Feature Spec + API Docs + Eval Dashboard + Changelog |
| 7 | 2 | User Guide (dynamic) + Docs System (24 slugs) |
| 8 | 0 | Polish + validation |
| **Total** | **25 pages + 24 docs = 49 routes** | |
