---
name: FAI-contributors-report
description: "Monthly contributor activity report — tracks commits, PRs, reviews, new primitives, streak tracking, recognition badges, and community health across repos. Produces leaderboards and month-over-month growth analysis."
on:
  schedule:
    - cron: "0 9 1 * *"
  workflow_dispatch:
    inputs:
      start_date:
        description: "Report start date (YYYY-MM-DD)"
        type: string
        required: false
      end_date:
        description: "Report end date (YYYY-MM-DD)"
        type: string
        required: false
      include_website:
        description: "Include FAI.dev repo stats"
        type: boolean
        required: false
        default: true
permissions:
  contents: read
  issues: write
engine: copilot
tools:
  github:
    toolsets: [repos, pull_requests, issues]
  bash: true
safe-outputs:
  create-issue:
    max: 1
    title-prefix: "[Contributors] "
    labels: ["community", "automated"]
    close-older-issues: true
timeout-minutes: 30
---

## Step 1: Determine date range

```bash
if [ -n "${{ inputs.start_date }}" ] && [ -n "${{ inputs.end_date }}" ]; then
  START="${{ inputs.start_date }}"; END="${{ inputs.end_date }}"
else
  START=$(date -d "$(date +%Y-%m-01) -1 month" +%Y-%m-%d)
  END=$(date -d "$(date +%Y-%m-01) -1 day" +%Y-%m-%d)
fi
MONTH=$(date -d "$START" +"%B %Y")
echo "Period: $START to $END ($MONTH)"
```

## Step 2: Gather commit activity

```bash
CONTRIBUTORS=$(git log --format="%aN" --since="$START" --until="$END" | sort -u | grep -v '\[bot\]')
CONTRIB_COUNT=$(echo "$CONTRIBUTORS" | grep -c '.' || echo 0)
TOTAL_COMMITS=$(git log --oneline --since="$START" --until="$END" | wc -l)

# Per-contributor breakdown
git log --format="%aN" --since="$START" --until="$END" | grep -v '\[bot\]' \
  | sort | uniq -c | sort -rn | while read -r COUNT NAME; do
    echo "COMMIT|$NAME|$COUNT"
  done
echo "STATS|commits=$TOTAL_COMMITS|contributors=$CONTRIB_COUNT"
```

## Step 3: Gather PR activity

```bash
PRS_OPENED=$(gh pr list --repo FAI/FAI --state all --search "created:$START..$END" \
  --json number 2>/dev/null | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).length)" 2>/dev/null || echo "N/A")
PRS_MERGED=$(gh pr list --repo FAI/FAI --state merged --search "merged:$START..$END" \
  --json number 2>/dev/null | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).length)" 2>/dev/null || echo "N/A")
echo "PRS|opened=$PRS_OPENED|merged=$PRS_MERGED"
```

## Step 4: Gather issue activity

```bash
ISSUES_OPENED=$(gh issue list --repo FAI/FAI --state all --search "created:$START..$END" \
  --json number 2>/dev/null | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).length)" 2>/dev/null || echo "N/A")
ISSUES_CLOSED=$(gh issue list --repo FAI/FAI --state closed --search "closed:$START..$END" \
  --json number 2>/dev/null | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).length)" 2>/dev/null || echo "N/A")
echo "ISSUES|opened=$ISSUES_OPENED|closed=$ISSUES_CLOSED"
```

## Step 5: Count new primitives added

```bash
NEW_FILES=$(git log --since="$START" --until="$END" --diff-filter=A --name-only --format="" | sort -u)
NEW_AGENTS=$(echo "$NEW_FILES" | grep '^agents/.*\.agent\.md$' | wc -l)
NEW_INSTRS=$(echo "$NEW_FILES" | grep '^instructions/.*\.instructions\.md$' | wc -l)
NEW_SKILLS=$(echo "$NEW_FILES" | grep '^skills/.*/SKILL\.md$' | wc -l)
NEW_HOOKS=$(echo "$NEW_FILES" | grep '^hooks/.*/hooks\.json$' | wc -l)
NEW_PLUGINS=$(echo "$NEW_FILES" | grep '^plugins/.*/plugin\.json$' | wc -l)
NEW_WORKFLOWS=$(echo "$NEW_FILES" | grep '^workflows/.*\.md$' | grep -v README | wc -l)
NEW_PLAYS=$(echo "$NEW_FILES" | grep '^solution-plays/[0-9]' | sed 's|/.*||' | sort -u | wc -l)
TOTAL_NEW=$((NEW_AGENTS + NEW_INSTRS + NEW_SKILLS + NEW_HOOKS + NEW_PLUGINS + NEW_WORKFLOWS))
echo "PRIMITIVES|agents=$NEW_AGENTS|instrs=$NEW_INSTRS|skills=$NEW_SKILLS|hooks=$NEW_HOOKS|plugins=$NEW_PLUGINS|wf=$NEW_WORKFLOWS|total=$TOTAL_NEW"

# Top primitive authors
echo "$NEW_FILES" | grep -E '^(agents|instructions|skills|hooks|plugins)/' | while read -r F; do
  AUTHOR=$(git log --diff-filter=A --format="%aN" -- "$F" | head -1)
  echo "PRIM_AUTHOR|$AUTHOR|$F"
done | sort | uniq -c | sort -rn | head -5
```

## Step 6: Classify contributors — new vs returning

```bash
ALL_TIME=$(git log --format="%aN" --until="$START" | sort -u | grep -v '\[bot\]')
PREV_START=$(date -d "$START -1 month" +%Y-%m-%d)
PREV_END=$(date -d "$START -1 day" +%Y-%m-%d)
PREV_MONTH=$(git log --format="%aN" --since="$PREV_START" --until="$PREV_END" | sort -u | grep -v '\[bot\]')

echo "$CONTRIBUTORS" | while read -r NAME; do
  [ -z "$NAME" ] && continue
  if ! echo "$ALL_TIME" | grep -qxF "$NAME"; then
    echo "NEW|$NAME|First contribution"
  elif echo "$PREV_MONTH" | grep -qxF "$NAME"; then
    echo "REGULAR|$NAME|Active last month"
  else
    LAST=$(git log --format="%ad" --date=short --author="$NAME" --until="$START" | head -1)
    echo "RETURNING|$NAME|Last: $LAST"
  fi
done
```

## Step 7: Streak tracking

Calculate consecutive months of activity per contributor.

```bash
echo "$CONTRIBUTORS" | while read -r NAME; do
  [ -z "$NAME" ] && continue
  STREAK=0; CHECK="$END"
  while true; do
    MS=$(date -d "$(date -d "$CHECK" +%Y-%m-01)" +%Y-%m-%d)
    ME=$(date -d "$MS +1 month -1 day" +%Y-%m-%d)
    HAS=$(git log --format="%H" --author="$NAME" --since="$MS" --until="$ME" 2>/dev/null | head -1)
    [ -n "$HAS" ] && STREAK=$((STREAK + 1)) && CHECK=$(date -d "$MS -1 day" +%Y-%m-%d) || break
    [ "$STREAK" -ge 24 ] && break
  done
  echo "STREAK|$NAME|$STREAK"
done
```

**Badges:** 🌱 1mo (Newcomer), 🔥 2-3mo (On fire), ⭐ 4-6mo (Rising star), 💎 7-11mo (Consistent), 🏆 12+mo (Veteran).

## Step 8: Highlight contributions

```bash
TOP_COMMITTER=$(git log --format="%aN" --since="$START" --until="$END" | grep -v '\[bot\]' \
  | sort | uniq -c | sort -rn | head -1)
echo "TOP_COMMITTER|$TOP_COMMITTER"

gh pr list --repo FAI/FAI --state merged --search "merged:$START..$END" \
  --json number,changedFiles,author,title --limit 20 2>/dev/null | node -e "
  const prs = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  if (prs.length) {
    const top = prs.sort((a,b) => (b.changedFiles||0) - (a.changedFiles||0))[0];
    console.log('LARGEST_PR|#' + top.number + '|' + top.changedFiles + ' files|' + top.author?.login);
  }
" 2>/dev/null || echo "PR data unavailable"
```

## Step 9: Growth metrics

```bash
PREV_COMMITS=$(git log --oneline --since="$PREV_START" --until="$PREV_END" | wc -l)
PREV_CONTRIB=$(git log --format="%aN" --since="$PREV_START" --until="$PREV_END" | sort -u | grep -v '\[bot\]' | grep -c '.' || echo 0)
COMMIT_DELTA=$((TOTAL_COMMITS - PREV_COMMITS))
CONTRIB_DELTA=$((CONTRIB_COUNT - PREV_CONTRIB))
[ "$PREV_COMMITS" -gt 0 ] && COMMIT_PCT=$(( (COMMIT_DELTA * 100) / PREV_COMMITS )) || COMMIT_PCT="N/A"
[ "$PREV_CONTRIB" -gt 0 ] && CONTRIB_PCT=$(( (CONTRIB_DELTA * 100) / PREV_CONTRIB )) || CONTRIB_PCT="N/A"
echo "GROWTH|commits=$COMMIT_DELTA ($COMMIT_PCT%)|contrib=$CONTRIB_DELTA ($CONTRIB_PCT%)"
```

## Step 10: Ecosystem totals

```bash
T_AGENTS=$(ls agents/*.agent.md 2>/dev/null | wc -l)
T_INSTRS=$(ls instructions/*.instructions.md 2>/dev/null | wc -l)
T_SKILLS=$(ls -d skills/*/ 2>/dev/null | wc -l)
T_HOOKS=$(ls -d hooks/*/ 2>/dev/null | wc -l)
T_PLUGINS=$(ls -d plugins/*/ 2>/dev/null | wc -l)
T_WF=$(ls workflows/*.md 2>/dev/null | grep -v README | wc -l)
T_PLAYS=$(ls -d solution-plays/[0-9][0-9]-*/ 2>/dev/null | wc -l)
TOTAL=$((T_AGENTS + T_INSTRS + T_SKILLS + T_HOOKS + T_PLUGINS + T_WF))
echo "ECOSYSTEM|agents=$T_AGENTS|instrs=$T_INSTRS|skills=$T_SKILLS|hooks=$T_HOOKS|plugins=$T_PLUGINS|wf=$T_WF|plays=$T_PLAYS|total=$TOTAL"
```

## Step 11: Community health

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Bus factor | ≥3 | 2 | 1 |
| New contributors/mo | ≥2 | 1 | 0 |
| Issue resolution | ≥80% | 50-79% | <50% |
| Contributor retention | ≥60% | 30-59% | <30% |

```bash
git log --format="%aN" --since="$START" --until="$END" | grep -v '\[bot\]' \
  | sort | uniq -c | sort -rn | node -e "
  const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\n');
  const total = lines.reduce((s,l) => s + parseInt(l.trim()), 0);
  let acc = 0, bus = 0;
  for (const l of lines) { acc += parseInt(l.trim()); bus++; if (acc >= total * 0.8) break; }
  console.log('BUS_FACTOR=' + bus + '/' + lines.length);
"
```

## Step 12: Generate report

```markdown
# 🍊 FAI Contributors Report — [Month Year]

## Summary
| Metric | This Month | Previous | Change |
|--------|-----------|----------|--------|
| Contributors | X | Y | +Z% |
| Commits | X | Y | +Z% |
| PRs merged | X | Y | +Z |
| New primitives | X | — | +X |
| Issues closed | X | Y | +Z |

## 🆕 New Contributors
| Contributor | Commits | PRs | Focus | Badge |
|-------------|---------|-----|-------|-------|
| @new-dev | 5 | 2 | agents/ | 🌱 |

## 🏆 Top Contributors
| Rank | Contributor | Commits | PRs | Primitives | Streak | Badge |
|------|-------------|---------|-----|-----------|--------|-------|
| 🥇 | @top-dev | 45 | 8 | 15 | 6mo | 💎 |
| 🥈 | @second | 30 | 5 | 10 | 4mo | ⭐ |
| 🥉 | @third | 20 | 3 | 5 | 2mo | 🔥 |

## 🔄 Returning Contributors
| Contributor | Commits | Last Active Before | Streak |
|-------------|---------|-------------------|--------|

## New Primitives
| Type | Count | Top Author |
|------|-------|-----------|
| Agents | X | @author |
| Instructions | X | @author |
| Skills | X | @author |
| Plugins | X | @author |
| **Total** | **X** | |

## Highlights 🌟
- **Most commits:** @name (X)
- **Largest PR:** #123 by @author (X files)
- **Most primitives:** @name (X)
- **Longest streak:** @name (Xmo)

## Ecosystem Growth
| Type | Total | +This Month |
|------|-------|------------|
| Agents | X | +Y |
| Instructions | X | +Y |
| Skills | X | +Y |
| **Total** | **X** | **+Y** |

## Community Health
| Indicator | Value | Status |
|-----------|-------|--------|
| Bus factor | X | ✅/⚠️/❌ |
| New contributors | X | ✅/⚠️/❌ |
| Resolution rate | X% | ✅/⚠️/❌ |

## Thank You! 🧡
Every contribution moves FAI forward. Shout-outs to first-timers, streak holders, and consistent builders.

_Automated by FAI Contributors Report Workflow_
```

## Error handling

- `gh` CLI unavailable: skip PR/issue queries, note in report
- Date calculation differences (macOS vs Linux): use Node.js fallback
- Special characters in names: sanitize for markdown tables
- Zero activity: generate report with "no activity" message
- Bot exclusion: filter `[bot]`, `dependabot`, `github-actions`
- Report capped at 65000 chars for GitHub issue body limit
- Streaks capped at 24 months