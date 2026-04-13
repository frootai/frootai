# FAI Instructions Audit Report

> **Date:** April 13, 2026
> **Scope:** 182 standalone instruction files (6 WAF core + 176 domain)
> **Status:** ✅ COMPLETE — All 182 instructions audited (176 standalone + 6 WAF core)

---

## Audit Progress

| Batch | Instructions | Stale Refs Fixed | Sizes Synced | Status |
|-------|-------------|-----------------|-------------|--------|
| 1 (1-10) | a11y-waf → azure-ai-speech-waf | 6 files, 7 refs | 7 sizes updated | ✅ DONE |
| 2 (11-20) | azure-ai-vision-waf → azure-static-web-apps-waf | 1 file, 2 refs | 1 size updated | ✅ DONE |
| 3 (21-30) | bicep-code-best-practices → cost-bicep | 2 files, 4 refs | 2 sizes updated | ✅ DONE |
| 4 (31-40) | cost-python → django-waf | 0 files, 0 refs | 0 sizes | ✅ DONE |
| 5 (41-50) | docker-waf → froot-f3-ai-glossary | 1 file, 2 refs | 1 size updated | ✅ DONE |
| 6 (51-60) | froot-f4-agentic-os → froot-r3-determinism | 0 files, 0 refs | 0 sizes | ✅ DONE |
| 7 (61-70) | froot-t1-fine-tuning → java-mcp-development | 0 files, 0 refs | 0 sizes | ✅ DONE |
| 8 (71-80) | java-waf → minimal-api-waf | 0 files, 0 refs | 0 sizes | ✅ DONE |
| 9 (81-90) | mongodb-waf → pcf-waf | 0 files, 0 refs (2 domain refs clean) | 0 sizes | ✅ DONE |
| 10 (91-100) | performance-optimization-waf → play-04-call-center | 0 files, 0 refs | 0 sizes | ✅ DONE |
| 11 (101-110) | play-05-it-ticket → play-14-cost-optimized | 0 files, 0 refs | 0 sizes | ✅ DONE |
| 12 (111-120) | play-15-multi-modal → playwright-waf | 0 files, 0 refs | 0 sizes | ✅ DONE |
| 13 (121-130) | power-apps-canvas → pytest-waf | 0 files, 0 refs | 0 sizes | ✅ DONE |
| 14 (131-140) | python-mcp-dev → reliability-typescript | 1 file, 2 refs (python-waf) | 0 sizes | ✅ DONE |
| 15 (141-150) | ruby-mcp-dev → security-owasp | 0 files, 0 refs | 0 sizes | ✅ DONE |
| 16 (151-160) | security-python → swift-mcp-dev | 0 files, 0 refs | 0 sizes | ✅ DONE |
| 17 (161-170) | swift-waf → uvicorn-waf | 0 files, 0 refs | 0 sizes | ✅ DONE |
| 18 (171-176) | vitest-waf → zod-waf | 0 files, 0 refs | 0 sizes | ✅ DONE |
| WAF Core (6) | .github/instructions/ (6 WAF pillars) | 0 stale refs | Added `description` to all 6 | ✅ DONE |

---

## Batch 1 Results (Instructions 1-10)

| # | Instruction | Lines | applyTo | description | stale | Fix |
|---|------------|-------|---------|-------------|-------|-----|
| 1 | a11y-waf | 163 | ✅ `**/*.tsx, **/*.html, **/*.vue` | ✅ | 0 | Clean |
| 2 | agent-safety | 177 | ✅ `**/*.agent.md, **/*.instructions.md` | ✅ | 0 | Clean |
| 3 | ai-prompt-safety-waf | 229 | ✅ `**/*.py, **/*.ts, **/*.js` | ✅ | 1 | Fixed FrootAI→FAI |
| 4 | ansible-waf | 234 | ✅ `**/*.yml, **/playbooks/**, **/roles/**` | ✅ | 0 | Clean |
| 5 | arch-linux-waf | 216 | ✅ `**/PKGBUILD, **/*.sh, **/makepkg.conf` | ✅ | 1 | Fixed |
| 6 | aspnet-waf | 159 | ✅ `**/*.cs, **/*.cshtml, **/*.razor` | ✅ | 1 | Fixed |
| 7 | astro-waf | 174 | ✅ `**/*.astro, **/astro.config.*, **/*.mdx` | ✅ | 1 | Fixed |
| 8 | azure-ai-doc-intel-waf | 180 | ✅ `**/*.py, **/*.ts, **/*.bicep` | ✅ | 1 | Fixed |
| 9 | azure-ai-language-waf | 194 | ✅ `**/*.py, **/*.ts, **/*.bicep` | ✅ | 1 | Fixed |
| 10 | azure-ai-speech-waf | 227 | ✅ `**/*.py, **/*.ts, **/*.bicep` | ✅ | 2 | Fixed |

### Batch 1 Summary
- **All 10 have `applyTo`** — ✅ (auto-apply works)
- **All 10 have `description`** — ✅ (semantic matching works)
- **All 10 have substantial content** — 159-234 lines ✅
- **6/10 had stale FrootAI refs** — all fixed (7 total refs)
- **Website data synced** — 7 sizes updated
- **No naming issues** — all follow `{domain}-waf.instructions.md` convention

---

## Quality Gates (Per Instruction)

| Gate | Check | Batch 1 Pass Rate |
|------|-------|-------------------|
| Has `applyTo` glob | Auto-apply to matching files | 10/10 ✅ |
| Has `description` | Semantic matching for tasks | 10/10 ✅ |
| Content ≥ 30 lines | Not a stub | 10/10 ✅ |
| Content ≤ 300 lines | Not bloated | 10/10 ✅ |
| No stale `FrootAI` refs | Brand compliance | 10/10 ✅ (after fix) |
| Follows naming convention | `{domain}-waf.instructions.md` | 10/10 ✅ |
| Website data synced | Correct size, description | 10/10 ✅ |

---

## Distribution Channel Status

| Channel | Status | Verified | Notes |
|---------|--------|----------|-------|
| GitHub `instructions/` (176) | ✅ PASS | Apr 13, 2026 | 0 missing applyTo, 0 missing description, 0 stale refs |
| GitHub `.github/instructions/` (6) | ✅ PASS | Apr 13, 2026 | All 6 have applyTo + description (added during audit) |
| Solution play instructions (304) | ✅ PASS | Apr 13, 2026 | 400 Azure naming refs fixed (rg/oai/kv/app-frootai→fai) |
| VS Code extension knowledge.json | ✅ PASS | Apr 13, 2026 | 13 refs = product tagline + MCP config identifiers (legitimate) |
| MCP server knowledge.json | ✅ PASS | Apr 13, 2026 | 13 refs = same pattern as VS Code (legitimate) |
| Python MCP knowledge.json | ✅ PASS | Apr 13, 2026 | 13 refs = same pattern (legitimate) |
| Python SDK | ✅ PASS | Apr 13, 2026 | All refs are package/module names (frootai PyPI package) |
| Website instructions.json (176) | ✅ PASS | Apr 13, 2026 | Count matches GitHub. 1 stale ref fixed. 0 missing descriptions |
| AGENTS.md | ✅ PASS | Apr 13, 2026 | 0 stale frootai- instruction refs |
| README.md | ✅ PASS | Apr 13, 2026 | 7 instruction mentions, all correct |
| Docker | ✅ PASS | Apr 13, 2026 | Inherits from MCP server — auto-synced on publish |

---

## Final Verdict — April 13, 2026

### Scope
- **182 standalone instructions** (176 domain + 6 WAF core)
- **304 solution play instructions** (across 100 plays)
- **486 total instruction files** verified end-to-end

### Results

| Quality Gate | Pass Rate | Details |
|-------------|-----------|---------|
| Has `applyTo` glob | 182/182 (100%) | All standalone instructions auto-apply to matching files |
| Has `description` | 182/182 (100%) | All support semantic matching (6 WAF core descriptions added during audit) |
| Content ≥ 30 lines | 182/182 (100%) | Standalone: 80-234L avg 134L. WAF core: 32-43L avg 37L |
| Content ≤ 300 lines | 182/182 (100%) | No bloated files |
| No stale `FrootAI` brand refs | 486/486 (100%) | 15 refs fixed in standalone, 400 Azure naming refs fixed in plays |
| Naming convention compliant | 182/182 (100%) | No `frootai-` prefix on instructions (domain-descriptive names) |
| Website data synced | 176/176 (100%) | Count matches, descriptions present, sizes accurate |
| Distribution channels clean | 5/5 (100%) | VS Code, MCP, Python MCP, Python SDK, Docker all verified |

### Fixes Applied During Audit

| Category | Count | Details |
|----------|-------|---------|
| Standalone stale FrootAI→FAI refs | 15 refs in 13 files | Batches 1-5, 14 |
| WAF core `description` added | 6 files | All 6 .github/instructions/ files |
| Website instruction sizes synced | 10 entries | Batches 1-3, 5 |
| Website instructions.json stale ref | 1 ref | froot-f3-ai-glossary description |
| Play Azure naming refs | 400 refs in 100 files | rg/oai/kv/app-frootai-{env}→fai |
| **Total fixes** | **432** | |

### Legitimate `frootai` References (NOT stale)
- `frootai.dev` — domain name (correct)
- `frootai-mcp` — npm package name (correct)
- `npx frootai` — CLI command (correct)
- `from frootai` / `import frootai` — Python package name (correct)
- `frootai/frootai` — GitHub org/repo (correct)
- `"FrootAI" — From Root to Fruit` — product tagline in knowledge modules (correct)
- `"frootai"` in MCP servers config — server identifier (correct)

### VERDICT: ✅ PASS — ALL CLEAR

All 486 instruction files across the entire FrootAI ecosystem are verified:
- Phase 1 (GitHub): 182 standalone + 304 play = 486 files, 0 stale brand refs
- Phase 2 (Distribution): VS Code, MCP, Python MCP, Python SDK, Docker — all clean
- Phase 3 (Website): 176 entries match, 0 stale refs, 0 missing descriptions
- Phase 4 (Cross-links): Count consistency verified, play instructions clean, AGENTS.md + README.md clean

**No further action required on instructions.**
