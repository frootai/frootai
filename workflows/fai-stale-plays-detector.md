---
name: FAI-stale-plays-detector
description: "Monthly detection of inactive solution plays — scores staleness across multiple signals including commit recency, issue activity, dependency age, and Azure service changes. Suggests renovation, archival, or removal with automatic issue creation."
on:
  schedule:
    - cron: "0 7 1 * *"
  workflow_dispatch:
    inputs:
      inactive_days:
        description: "Days of inactivity to flag as stale"
        type: number
        required: false
        default: 90
      exempt_plays:
        description: "Comma-separated play numbers to exempt (e.g., 01,02)"
        type: string
        required: false
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
    title-prefix: "[Stale Plays] "
    labels: ["stale", "maintenance", "automated"]
    close-older-issues: true
timeout-minutes: 20
---

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `inactive_days` | 90 | Days without commits before flagging stale |
| `aging_days` | 30 | Days threshold for "aging" classification |
| `exempt_plays` | (none) | Comma-separated play numbers to skip |
| `dependency_stale_months` | 6 | Months since dependency release to flag outdated |
| `issue_activity_window` | 90 | Days to look back for issue/PR activity |
| `renovate_score_threshold` | 40 | Staleness score above which renovation is recommended |
| `archive_score_threshold` | 70 | Staleness score above which archival is recommended |
| `remove_score_threshold` | 90 | Staleness score above which removal is recommended |

## Step 1: Enumerate solution plays

List all directories in `solution-plays/` matching the `NN-*` pattern:

```bash
PLAY_DIRS=$(find solution-plays -mindepth 1 -maxdepth 1 -type d -name "[0-9][0-9]-*" | sort)
TOTAL_PLAYS=$(echo "$PLAY_DIRS" | wc -l)

# Parse exempt list
EXEMPT_LIST="${EXEMPT_PLAYS:-}"
```

For each play, extract the number and name:

```bash
for DIR in $PLAY_DIRS; do
  PLAY_NUM=$(basename "$DIR" | grep -oP '^\d{2}')
  PLAY_NAME=$(basename "$DIR" | sed 's/^[0-9]*-//')

  # Check exemption
  if echo ",$EXEMPT_LIST," | grep -q ",$PLAY_NUM,"; then
    echo "$PLAY_NUM | $PLAY_NAME | EXEMPT"
    continue
  fi

  echo "$PLAY_NUM | $PLAY_NAME | ACTIVE"
done
```

## Step 2: Determine last activity per play

For each non-exempt play, gather commit history and classify:

```bash
INACTIVE_DAYS=${INACTIVE_DAYS:-90}
AGING_DAYS=${AGING_DAYS:-30}

ACTIVE_COUNT=0; AGING_COUNT=0; STALE_COUNT=0; NEVER_COUNT=0

for DIR in $PLAY_DIRS; do
  PLAY_NUM=$(basename "$DIR" | grep -oP '^\d{2}')
  # Skip exempt
  if echo ",$EXEMPT_LIST," | grep -q ",$PLAY_NUM,"; then continue; fi

  LAST_COMMIT=$(git log -1 --format="%ci" -- "$DIR/" 2>/dev/null | cut -d' ' -f1)

  if [ -z "$LAST_COMMIT" ]; then
    STATUS="⚫ Never committed"
    DAYS="N/A"
    NEVER_COUNT=$((NEVER_COUNT + 1))
  else
    DAYS=$(( ($(date +%s) - $(date -d "$LAST_COMMIT" +%s)) / 86400 ))
    if [ "$DAYS" -le "$AGING_DAYS" ]; then
      STATUS="🟢 Active"
      ACTIVE_COUNT=$((ACTIVE_COUNT + 1))
    elif [ "$DAYS" -le "$INACTIVE_DAYS" ]; then
      STATUS="🟡 Aging"
      AGING_COUNT=$((AGING_COUNT + 1))
    else
      STATUS="🔴 Stale"
      STALE_COUNT=$((STALE_COUNT + 1))
    fi
  fi

  # Additional activity metrics
  COMMIT_COUNT_90D=$(git log --since="90 days ago" --oneline -- "$DIR/" 2>/dev/null | wc -l)
  CONTRIBUTORS=$(git log --format="%aN" -- "$DIR/" 2>/dev/null | sort -u | wc -l)
  TOTAL_COMMITS=$(git log --oneline -- "$DIR/" 2>/dev/null | wc -l)

  echo "$PLAY_NUM | $LAST_COMMIT | $DAYS days | $COMMIT_COUNT_90D recent | $CONTRIBUTORS contribs | $STATUS"
done
```

## Step 3: Check manifest and artifact completeness

For each play, verify required files and score completeness (0-5):

```bash
for DIR in $PLAY_DIRS; do
  PLAY_NUM=$(basename "$DIR" | grep -oP '^\d{2}')
  if echo ",$EXEMPT_LIST," | grep -q ",$PLAY_NUM,"; then continue; fi
  SCORE=0
  [ -f "$DIR/fai-manifest.json" ] && SCORE=$((SCORE + 1))
  [ -f "$DIR/README.md" ] && SCORE=$((SCORE + 1))
  [ -f "$DIR/infra/main.bicep" ] && SCORE=$((SCORE + 1))
  # Check plugin coverage
  for P in $(find plugins -name "plugin.json"); do
    jq -r '.plays[]?' "$P" 2>/dev/null | grep -q "$PLAY_NUM" && SCORE=$((SCORE + 1)) && break
  done
  # Check guardrails
  [ -f "$DIR/fai-manifest.json" ] && jq -e '.primitives.guardrails' "$DIR/fai-manifest.json" >/dev/null 2>&1 && SCORE=$((SCORE + 1))
  echo "$PLAY_NUM | $SCORE/5"
done
```

Artifacts checked: `fai-manifest.json` (required), `README.md` (required), `infra/main.bicep` (required), plugin in `plugins/` (expected), guardrails in manifest (expected).

## Step 4: Check for dependency issues

For plays with `package.json` or `requirements.txt`, scan for outdated dependencies:

```bash
for DIR in $PLAY_DIRS; do
  PLAY_NUM=$(basename "$DIR" | grep -oP '^\d{2}')
  if echo ",$EXEMPT_LIST," | grep -q ",$PLAY_NUM,"; then continue; fi
  DEP_ISSUES=0

  # Node.js: check lock file age, deprecated packages
  if [ -f "$DIR/package.json" ]; then
    if [ -f "$DIR/package-lock.json" ]; then
      LOCK_AGE=$(( ($(date +%s) - $(stat -c %Y "$DIR/package-lock.json" 2>/dev/null || echo 0)) / 86400 ))
      [ "$LOCK_AGE" -gt 180 ] && DEP_ISSUES=$((DEP_ISSUES + 1))
    fi
  fi

  # Python: check for unpinned deps
  if [ -f "$DIR/requirements.txt" ]; then
    UNPINNED=$(grep -v '==' "$DIR/requirements.txt" | grep -v '^#' | grep -v '^$' | wc -l)
    [ "$UNPINNED" -gt 0 ] && DEP_ISSUES=$((DEP_ISSUES + 1))
  fi

  # Bicep API version age
  if [ -f "$DIR/infra/main.bicep" ]; then
    OLD_APIS=$(grep -oP "apiVersion:\s*'\K[\d-]+" "$DIR/infra/main.bicep" 2>/dev/null | while read API_DATE; do
      API_YEAR=$(echo "$API_DATE" | cut -d'-' -f1)
      [ "$API_YEAR" -lt 2025 ] && echo "$API_DATE"
    done | wc -l)
    [ "$OLD_APIS" -gt 0 ] && DEP_ISSUES=$((DEP_ISSUES + 1))
  fi

  echo "$PLAY_NUM | $DEP_ISSUES dependency issues"
done
```

| Dependency Signal | Stale Threshold | Weight in Score |
|-------------------|-----------------|-----------------|
| Lock file age | > 180 days | 10 points |
| Unpinned Python deps | Any unpinned | 5 points |
| Old Bicep API versions | API year < current - 1 | 15 points |
| Deprecated npm packages | Any deprecated | 20 points |
| Known CVEs | Any high/critical | 25 points |

## Step 5: Check issue and PR activity

Query GitHub for recent activity related to each play:

```bash
for DIR in $PLAY_DIRS; do
  PLAY_NUM=$(basename "$DIR" | grep -oP '^\d{2}')
  PLAY_NAME=$(basename "$DIR" | sed 's/^[0-9]*-//')
  if echo ",$EXEMPT_LIST," | grep -q ",$PLAY_NUM,"; then continue; fi

  ISSUE_TOTAL=$(gh issue list --search "play $PLAY_NUM OR $PLAY_NAME" --state all --json number 2>/dev/null | jq length)
  ISSUE_OPEN=$(gh issue list --search "play $PLAY_NUM OR $PLAY_NAME" --state open --json number 2>/dev/null | jq length)
  PR_COUNT=$(gh pr list --search "$PLAY_NAME" --state all --json number 2>/dev/null | jq length)

  echo "$PLAY_NUM | Issues: $ISSUE_TOTAL (open:$ISSUE_OPEN, recent:$ISSUE_RECENT) | PRs: $PR_COUNT"
done
```

| Activity Signal | Weight | Interpretation |
|-----------------|--------|----------------|
| Open issues > 0 | -10 staleness | Active community interest |
| Recent issues (90d) > 0 | -15 staleness | Current demand |
| Recent PRs > 0 | -20 staleness | Active development |
| Bug reports open | -5 staleness | Users are using it |
| No activity at all | +20 staleness | No engagement signal |

## Step 6: Compute multi-signal staleness score

Combine all signals into a composite staleness score (0-100, higher = more stale):

| Signal | Weight | Score Formula |
|--------|--------|---------------|
| Commit recency | 30% | min(days_since_commit / inactive_days × 100, 100) |
| Manifest completeness | 20% | (1 - artifacts_present / total_artifacts) × 100 |
| Dependency freshness | 20% | dependency_issues × 20 (capped at 100) |
| Community activity | 15% | 100 if no issues/PRs, 50 if old only, 0 if recent |
| Contributor diversity | 15% | 100 if solo, 50 if 2, 0 if 3+ contributors |

**Staleness Score = Σ(signal_score × weight)**

| Score Range | Classification | Action |
|-------------|---------------|--------|
| 0-39 | 🟢 Healthy | No action needed |
| 40-69 | 🟡 Aging | Schedule review within 30 days |
| 70-89 | 🔴 Stale — Renovate or Archive | Create renovation issue or mark for archive |
| 90-100 | ⚫ Obsolete — Remove | Begin deprecation process |

## Step 7: Suggest actions for stale plays

For each play above the renovation threshold, determine the appropriate action:

```bash
for PLAY in $STALE_PLAYS; do
  STALENESS_SCORE=... # from Step 6

  if [ "$STALENESS_SCORE" -ge 90 ]; then
    ACTION="🗑️ Remove"
    REASON="No unique value, no community interest, dependencies abandoned"
    TIMELINE="Deprecation notice → 30-day grace period → remove"
  elif [ "$STALENESS_SCORE" -ge 70 ]; then
    ACTION="📦 Archive"
    REASON="Core approach superseded by newer pattern or Azure service"
    TIMELINE="Mark as archived, point to successor play, keep for reference"
  else
    ACTION="🔄 Renovate"
    REASON="Valuable pattern but needs fresh dependencies and docs"
    TIMELINE="Create issue with specific update tasks, assign owner"
  fi

  echo "$PLAY | Score: $STALENESS_SCORE | $ACTION | $REASON"
done
```

### Renovation tasks (generated per play)

Update dependencies → Refresh Bicep API versions → Verify Azure service status → Update README → Add missing artifacts (`fai-manifest.json`, plugin, guardrails) → Run evaluation suite.

### Archive workflow

Add `"status": "archived"` to manifest → Prepend `[ARCHIVED]` to README → Add successor banner → Remove from marketplace → Keep directory for reference.

## Step 8: Migration recommendations

For archived/removed plays, suggest migration paths to successor plays. Check if a newer play covers the same scenario.

## Step 9: Error handling

| Failure | Recovery |
|---------|----------|
| Git history missing | Score commit recency as 100% stale, note limitation |
| GitHub API rate limited | Skip community analysis, note unavailable |
| Invalid manifest JSON | Score completeness as 0, note parse error |
| Date parsing error | Default to max staleness, flag with "⚠️" |

Always produce a report even with partial data. Mark incomplete signals.

## Step 10: Generate stale plays report

Create an issue with the comprehensive detection results:

```markdown
# 🍊 Stale Plays Detection Report — YYYY-MM-DD

## Executive Summary

| Classification | Count | Percentage |
|---------------|-------|------------|
| 🟢 Healthy | 45 | 66% |
| 🟡 Aging | 12 | 18% |
| 🔴 Stale | 8 | 12% |
| ⚫ Obsolete | 1 | 1% |
| Exempt | 2 | 3% |
| **Total** | **68** | — |

**Detection threshold:** 90 days (configurable)
**Exempt plays:** 01 (Enterprise RAG), 02 (AI Landing Zone)

## Stale Plays (Score ≥ 70)

| # | Play | Score | Days | Commits (90d) | Issues | Artifacts | Action |
|---|------|-------|------|---------------|--------|-----------|--------|
| 15 | legacy-migration | 82 | 137d | 0 | 0 | 3/5 | 📦 Archive |
| 23 | static-classifier | 78 | 112d | 0 | 1 | 2/5 | 🔄 Renovate |
| 31 | basic-chatbot | 91 | 200d | 0 | 0 | 1/5 | 🗑️ Remove |

## Aging Plays — Watch List (Score 40-69)

| # | Play | Score | Days | Signal | ETA to Stale |
|---|------|-------|------|--------|-------------|
| 08 | batch-processing | 55 | 72d | Low activity | ~18 days |
| 12 | edge-inference | 48 | 61d | 1 recent issue | ~29 days |

## Recommended Actions

| Action | Play | Details |
|--------|------|---------|
| 🗑️ Remove | #31 basic-chatbot | Superseded by Play #03 → deprecation 30d |
| 📦 Archive | #15 legacy-migration | Successor: Play #42 Cloud Modernization |
| 🔄 Renovate | #23 static-classifier | Update SDK v2, add manifest, refresh Bicep |

## Approaching Staleness

| Play | ETA | Preventive Action |
|------|-----|-------------------|
| #08 batch-processing | ~18d | Merge open PR, update README |
| #12 edge-inference | ~29d | Address open issue, bump deps |

## Generated by FAI Workflow Engine
_Next detection: first day of next month at 07:00 UTC_
_Override threshold: `/stale-plays inactive_days=60`_
```
