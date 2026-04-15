---
name: fai-daily-ecosystem-report
description: "Daily ecosystem health summary — primitive counts, marketplace stats, validation status, and recent changes across agents, instructions, skills, hooks, and plugins. The morning briefing for the FAI team."
on:
  schedule:
    - cron: "0 8 * * 1-5"
  workflow_dispatch: {}
permissions:
  contents: read
  issues: write
engine: copilot
tools:
  github:
    toolsets: [repos, issues]
  bash: true
safe-outputs:
  create-issue:
    max: 1
    title-prefix: "[FAI Daily] "
    labels: ["daily-report", "automated"]
    close-older-issues: true
timeout-minutes: 15
---

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `competitor_agents` | 187 | Baseline agent count for comparison |
| `competitor_instructions` | 175 | Baseline instruction count |
| `competitor_skills` | 271 | Baseline skill count |
| `competitor_hooks` | 6 | Baseline hook count |
| `competitor_plugins` | 65 | Baseline plugin count |
| `alert_validation_errors` | 0 | Maximum acceptable validation errors |
| `alert_stale_marketplace_hours` | 48 | Hours before marketplace.json is flagged stale |
| `trend_comparison_days` | 1 | Days back for trend comparison |

## Step 1: Count all primitives

Run these commands and capture the numbers:

```bash
AGENTS=$(find agents -name "*.agent.md" | wc -l)
INSTRUCTIONS=$(find instructions -name "*.instructions.md" | wc -l)
SKILLS=$(find skills -mindepth 1 -maxdepth 1 -type d | wc -l)
HOOKS=$(find hooks -mindepth 1 -maxdepth 1 -type d | wc -l)
PLUGINS=$(find plugins -mindepth 1 -maxdepth 1 -type d | wc -l)
WORKFLOWS=$(find workflows -name "*.md" ! -name "README.md" | wc -l)
COOKBOOK=$(find cookbook -name "*.md" ! -name "README.md" | wc -l)
PLAYS=$(find solution-plays -mindepth 1 -maxdepth 1 -type d | wc -l)
SCHEMAS=$(find schemas -name "*.json" | wc -l)
TOTAL=$((AGENTS + INSTRUCTIONS + SKILLS + HOOKS + PLUGINS + WORKFLOWS + COOKBOOK))
```

Compute delta against competitor baselines:

```bash
DELTA_AGENTS=$((AGENTS - 187))
DELTA_INSTRUCTIONS=$((INSTRUCTIONS - 175))
DELTA_SKILLS=$((SKILLS - 271))
DELTA_HOOKS=$((HOOKS - 6))
DELTA_PLUGINS=$((PLUGINS - 65))
```

## Step 2: Get marketplace stats

Parse `marketplace.json` for aggregate metrics:

```bash
MARKETPLACE_PLUGINS=$(jq '.plugins | length' marketplace.json)
MARKETPLACE_ITEMS=$(jq '[.plugins[].items | length] | add' marketplace.json)
MARKETPLACE_CATEGORIES=$(jq '[.plugins[].category] | unique | length' marketplace.json)
MARKETPLACE_GENERATED=$(jq -r '.generated' marketplace.json)
MARKETPLACE_AGE_HOURS=$(( ($(date +%s) - $(date -d "$MARKETPLACE_GENERATED" +%s)) / 3600 ))
```

Flag marketplace as stale if `MARKETPLACE_AGE_HOURS > alert_stale_marketplace_hours`.

## Step 3: Run validation suite

Execute the full validation pipeline and capture results:

```bash
VALIDATION_OUTPUT=$(node scripts/validate-primitives.js 2>&1)
VALIDATION_EXIT=$?
CHECKS_TOTAL=$(echo "$VALIDATION_OUTPUT" | grep -oP '\d+ checks' | grep -oP '\d+')
CHECKS_PASSED=$(echo "$VALIDATION_OUTPUT" | grep -oP '\d+ passed' | grep -oP '\d+')
CHECKS_ERRORS=$(echo "$VALIDATION_OUTPUT" | grep -oP '\d+ errors?' | grep -oP '\d+')
```

If `CHECKS_ERRORS > alert_validation_errors`, flag as critical in the report.

Also run consistency check:

```bash
CONSISTENCY_OUTPUT=$(node scripts/validate-consistency.js 2>&1)
CONSISTENCY_EXIT=$?
```

## Step 4: Check build pipeline status

Verify the core build scripts execute without errors:

```bash
BUILD_STATUS="✅"
node scripts/generate-marketplace.js --dry-run 2>&1 || BUILD_STATUS="❌"
node scripts/generate-website-data.js --dry-run 2>&1 || BUILD_STATUS="❌"
```

Check for any pending security advisories in dependencies:

```bash
AUDIT_OUTPUT=$(npm audit --json 2>/dev/null)
AUDIT_CRITICAL=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.critical // 0')
AUDIT_HIGH=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.high // 0')
```

## Step 5: Dependency freshness scan

Check age of key dependency files:

```bash
PKG_LOCK_AGE=$(( ($(date +%s) - $(date -r package-lock.json +%s)) / 86400 ))
SCHEMA_AGE=$(git log -1 --format="%ct" -- schemas/ | xargs -I{} bash -c 'echo $(( ($(date +%s) - {}) / 86400 ))')
ENGINE_AGE=$(git log -1 --format="%ct" -- engine/ | xargs -I{} bash -c 'echo $(( ($(date +%s) - {}) / 86400 ))')
```

| Artifact | Max Age (days) | Status Indicator |
|----------|---------------|-----------------|
| `package-lock.json` | 30 | 🟢 ≤ 30, 🟡 31-60, 🔴 > 60 |
| `schemas/` | 60 | 🟢 ≤ 60, 🟡 61-120, 🔴 > 120 |
| `engine/` | 45 | 🟢 ≤ 45, 🟡 46-90, 🔴 > 90 |
| `marketplace.json` | 2 (hours) | 🟢 ≤ 48h, 🟡 49-96h, 🔴 > 96h |

## Step 6: Recent changes (last 24h)

Use git log to identify all changes in the reporting period:

```bash
CHANGED_FILES=$(git log --since="24 hours ago" --name-only --pretty=format:"" | sort -u | grep -v '^$')

NEW_AGENTS=$(echo "$CHANGED_FILES" | grep '^agents/' | wc -l)
NEW_INSTRUCTIONS=$(echo "$CHANGED_FILES" | grep '^instructions/' | wc -l)
NEW_SKILLS=$(echo "$CHANGED_FILES" | grep '^skills/' | wc -l)
NEW_PLUGINS=$(echo "$CHANGED_FILES" | grep '^plugins/' | wc -l)
NEW_HOOKS=$(echo "$CHANGED_FILES" | grep '^hooks/' | wc -l)
CONFIG_CHANGES=$(echo "$CHANGED_FILES" | grep -E '^(config/|schemas/|engine/)' | wc -l)
PLAY_CHANGES=$(echo "$CHANGED_FILES" | grep '^solution-plays/' | wc -l)
SCRIPT_CHANGES=$(echo "$CHANGED_FILES" | grep '^scripts/' | wc -l)

COMMIT_COUNT_24H=$(git log --since="24 hours ago" --oneline | wc -l)
CONTRIBUTOR_COUNT_24H=$(git log --since="24 hours ago" --format="%aN" | sort -u | wc -l)
```

## Step 7: Trend comparison vs previous report

Search for the most recent daily report issue to compute day-over-day deltas:

```bash
PREV_ISSUE=$(gh issue list --label "daily-report" --state closed --limit 1 --json body -q '.[0].body')
```

Extract previous primitive counts from the last report body and compute deltas.
If no previous report exists, note "First report — no trend data available."

| Metric | Yesterday | Today | Delta | Trend |
|--------|-----------|-------|-------|-------|
| Agents | prev | curr | +/- N | ↑/↓/→ |
| Instructions | prev | curr | +/- N | ↑/↓/→ |
| Skills | prev | curr | +/- N | ↑/↓/→ |
| Validation Errors | prev | curr | +/- N | ↑/↓/→ |
| Commits (24h) | prev | curr | +/- N | ↑/↓/→ |

## Step 8: Error handling

| Failure | Recovery |
|---------|----------|
| `validate-primitives.js` crashes | Report "Validation unavailable" with exit code, continue |
| `marketplace.json` missing | Report marketplace section as "Not generated", continue |
| Git history unavailable | Skip trend and change sections, note in report |
| `npm audit` fails | Skip security section, note "Audit unavailable" |
| Previous report not found | Skip trend comparison, mark as "First run" |

Always produce a report even with partial data. Indicate which sections were skipped.

## Step 9: Compose daily report

Create an issue with the full ecosystem dashboard:

```markdown
# 🍊 FAI Daily Ecosystem Report — YYYY-MM-DD

## Primitive Inventory

| Type | Count | vs Baseline | Delta | Status |
|------|-------|-------------|-------|--------|
| Agents | 238 | +51 vs 187 | +2 ↑ | 🟢 Ahead |
| Instructions | 176 | +1 vs 175 | +0 → | 🟢 Ahead |
| Skills | 322 | +51 vs 271 | +3 ↑ | 🟢 Ahead |
| Hooks | 10 | +4 vs 6 | +0 → | 🟢 Ahead |
| Plugins | 77 | +12 vs 65 | +1 ↑ | 🟢 Ahead |
| Workflows | 12 | — | +0 → | — |
| Cookbook | 16 | — | +0 → | — |
| Solution Plays | 101 | — | +0 → | — |
| **Total Primitives** | **952** | — | **+6 ↑** | — |

## Marketplace

| Metric | Value | Status |
|--------|-------|--------|
| Plugins listed | 77 | — |
| Total items | 342 | — |
| Categories | 12 | — |
| Last generated | 2h ago | 🟢 Fresh |

## Validation & Build

| Check | Result | Status |
|-------|--------|--------|
| Primitive validation | 1247/1247 passed | ✅ |
| Consistency check | All consistent | ✅ |
| Build pipeline | All scripts OK | ✅ |
| Security audit | 0 critical, 0 high | ✅ |

## Dependency Freshness

| Artifact | Age | Threshold | Status |
|----------|-----|-----------|--------|
| package-lock.json | 12d | 30d | 🟢 |
| schemas/ | 8d | 60d | 🟢 |
| engine/ | 15d | 45d | 🟢 |

## Activity (Last 24h)

| Metric | Count |
|--------|-------|
| Commits | 7 |
| Contributors | 2 |
| Files changed | 14 |
| New agents | 2 |
| New skills | 3 |
| Config changes | 1 |
| Play updates | 2 |

## Trend (vs Yesterday)

| Metric | Yesterday | Today | Trend |
|--------|-----------|-------|-------|
| Total primitives | 946 | 952 | ↑ +6 |
| Validation errors | 0 | 0 | → 0 |
| Commits | 5 | 7 | ↑ +2 |

## Alert Summary

| Level | Alert | Action |
|-------|-------|--------|
| — | No alerts today | — |

## Generated by FAI Workflow Engine
_Next report: tomorrow at 08:00 UTC_
```

## Step 10: Notification integration

If critical alerts are detected (validation errors, security vulnerabilities, stale marketplace),
append a notification block at the end of the report body:

```markdown
---
**⚠️ Alerts requiring attention:**
- [CRITICAL] 3 validation errors detected — run `node scripts/validate-primitives.js --verbose`
- [WARNING] marketplace.json is 72h stale — run `node scripts/generate-marketplace.js`
- [INFO] 1 high-severity npm vulnerability — run `npm audit fix`
```

Alert severity classification:

| Severity | Trigger | Color |
|----------|---------|-------|
| 🔴 CRITICAL | Validation errors > 0, security critical > 0 | Red label added |
| 🟡 WARNING | Stale marketplace, dependency age exceeded | — |
| 🟢 INFO | Minor version drift, low-severity audit | — |
