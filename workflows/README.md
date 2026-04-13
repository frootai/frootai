# FAI — Agentic Workflows

> Natural language workflow definitions that compile to automated YAML — quality scanning, compliance checks, reporting.

## What Are FAI Workflows?

Agentic workflows are markdown files with YAML frontmatter that describe automated tasks in natural language. They're compiled and executed by GitHub's `gh aw` CLI or similar agentic workflow engines.

## Workflow Format

```yaml
---
name: "Workflow Name"
description: "What it does"
on:
  schedule:
    - cron: "0 10 * * 1"         # Cron trigger
  workflow_dispatch:               # Manual trigger
    inputs:
      param:
        description: "..."
        type: string

permissions:
  contents: read
  issues: read/write

engine: copilot

tools:
  github:
    toolsets: [repos, issues, pull_requests]
  bash: true

safe-outputs:
  create-issue:
    max: 1
    title-prefix: "[FAI Report] "
    close-older-issues: true

timeout-minutes: 60
---

## Step 1: Gather data
Natural language instructions...

## Step 2: Analyze
More instructions...

## Step 3: Report
Create the output...
```

## Safe-Outputs Model

Safe-outputs constrain what the workflow agent can produce — preventing runaway:

| Output Type | Constraints |
|-------------|-------------|
| `create-issue` | `max`, `title-prefix`, `labels`, `close-older-issues` |
| `add-comment` | `max` (usually 1) |
| `create-pull-request` | `draft: true`, `title-prefix` |
| `noop` | Agent can choose to produce no output |

## Planned Workflows

### Quality & Health (4)

| Workflow | Trigger | Complexity | Purpose |
|----------|---------|-----------|---------|
| `fai-play-quality-report.md` | Weekly (Mon 10AM) | Complex (6 steps) | Scan all 23 plays for completeness — manifest, README, DevKit, TuneKit, infra, plugin |
| `fai-evaluation-regression.md` | Weekly (Mon 11AM) | Advanced (6 steps) | Detect evaluation score regressions — groundedness, coherence, safety, cost trends |
| `fai-marketplace-health.md` | Weekly (Wed 9AM) | Complex (6 steps) | Validate plugin references, detect orphans, regenerate marketplace if needed |
| `fai-daily-ecosystem-report.md` | Weekdays (8AM) | Medium (6 steps) | Morning briefing — primitive counts, validation, recent changes, competitor delta |

### Compliance & Review (2)

| Workflow | Trigger | Complexity | Purpose |
|----------|---------|-----------|---------|
| `fai-waf-compliance-check.md` | Per-PR | Advanced (8 steps) | Scan changed files against all 6 WAF pillars — security, reliability, cost, opex, perf, RAI |
| `fai-primitive-pr-review.md` | Per-PR (primitives) | Complex (6 steps) | Validate naming, frontmatter, WAF alignment, and schema compliance for primitive PRs |

### Staleness & Relevance (3)

| Workflow | Trigger | Complexity | Purpose |
|----------|---------|-----------|---------|
| `fai-knowledge-staleness.md` | Monthly (1st, 8AM) | Complex (5 steps) | Flag stale FROOT modules (90d), plays (120d), and primitives (180d) with health score |
| `fai-stale-plays-detector.md` | Monthly (1st, 7AM) | Complex (6 steps) | Detect inactive plays — suggest renovate, archive, or remove with completeness score |
| `fai-play-relevance-check.md` | Slash command | Interactive (4 steps) | `/play-relevance` — assess play against Azure service availability, pricing, WAF, demand |

### Reporting (3)

| Workflow | Trigger | Complexity | Purpose |
|----------|---------|-----------|---------|
| `fai-release-readiness.md` | Manual dispatch | Advanced (8 steps) | Pre-release compliance — versions, validation, secrets, changelog, marketplace, license |
| `fai-contributors-report.md` | Monthly (1st, 9AM) | Complex (7 steps) | Contributor activity — new vs returning, primitive growth, highlight contributions |
| `fai-play-portfolio-summary.md` | Manual dispatch | Advanced (7 steps) | Aggregated play dashboard — maturity scores (Gold/Silver/Bronze), WAF coverage, plugin status |

## Validation

```bash
node scripts/validate-primitives.js workflows/
```

## GitHub Agentic Workflows (`gh aw`) Integration

FAI workflows use the **natural language markdown format** compatible with GitHub's `gh aw` CLI:

```bash
# Compile a workflow to GitHub Actions YAML
gh aw compile workflows/fai-play-quality-report.md

# Run a workflow manually
gh aw run workflows/fai-play-quality-report.md
```

**Status:** Our workflow `.md` files follow the `gh aw` frontmatter format (name, description, on, permissions, engine, tools, safe-outputs, timeout-minutes). They can be compiled to `.lock.yml` GitHub Actions workflows using `gh aw compile`.

**Decision:** We adopt the `gh aw` format as our standard. Workflows are authored as natural language markdown, compiled to YAML for execution. The `.md` file is the source of truth.
