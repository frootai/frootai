---
name: fai-play-portfolio-summary
description: "Aggregated portfolio assessment across all solution plays — dashboard of play health, WAF coverage, technology stack analysis, cost estimation, and ecosystem maturity. Auto-closes previous summary."
on:
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
    title-prefix: "[FAI Portfolio] "
    labels: ["portfolio", "automated"]
    close-older-issues: true
timeout-minutes: 45
---

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `gold_waf_min` | 6 | Minimum WAF pillars for Gold maturity |
| `gold_commit_days` | 30 | Maximum days since last commit for Gold |
| `silver_waf_min` | 4 | Minimum WAF pillars for Silver |
| `silver_commit_days` | 90 | Maximum days since last commit for Silver |
| `stale_threshold_days` | 120 | Days without commits before flagging stale |
| `target_play_count` | 100 | Long-term target for play portfolio |
| `cost_estimate_model` | dev | Default cost estimate scale (dev/prod) |

## Step 1: Enumerate all solution plays

List all folders in `solution-plays/` matching the `NN-*` pattern:

```bash
PLAY_DIRS=$(find solution-plays -mindepth 1 -maxdepth 1 -type d -name "[0-9][0-9]-*" | sort)
TOTAL_PLAYS=$(echo "$PLAY_DIRS" | wc -l)

for DIR in $PLAY_DIRS; do
  PLAY_NUM=$(basename "$DIR" | grep -oP '^\d{2}')
  PLAY_NAME=$(basename "$DIR" | sed 's/^[0-9]*-//')
  HAS_MANIFEST=$(test -f "$DIR/fai-manifest.json" && echo "✅" || echo "❌")
  HAS_README=$(test -f "$DIR/README.md" && echo "✅" || echo "❌")
  HAS_INFRA=$(test -f "$DIR/infra/main.bicep" && echo "✅" || echo "❌")
  HAS_FROOT=$(test -f "$DIR/froot.json" && echo "✅" || echo "❌")
  LAST_COMMIT=$(git log -1 --format="%ci" -- "$DIR/" 2>/dev/null | cut -d' ' -f1)
  DAYS_SINCE=$(( ($(date +%s) - $(date -d "$LAST_COMMIT" +%s)) / 86400 ))

  echo "$PLAY_NUM | $PLAY_NAME | $HAS_MANIFEST | $HAS_README | $HAS_INFRA | $LAST_COMMIT | $DAYS_SINCE"
done
```

## Step 2: Check plugin coverage per play

For each play, verify whether a matching plugin exists that packages its primitives:

```bash
for DIR in $PLAY_DIRS; do
  PLAY_NUM=$(basename "$DIR" | grep -oP '^\d{2}')
  PLAY_NAME=$(basename "$DIR" | sed 's/^[0-9]*-//')

  # Search plugins for play references
  MATCHING_PLUGIN=""
  for PLUGIN_DIR in $(find plugins -mindepth 1 -maxdepth 1 -type d); do
    PLUGIN_FILE="$PLUGIN_DIR/plugin.json"
    if [ -f "$PLUGIN_FILE" ]; then
      PLAYS_REF=$(jq -r '.plays[]? // empty' "$PLUGIN_FILE" | grep -c "$PLAY_NUM")
      if [ "$PLAYS_REF" -gt 0 ]; then
        MATCHING_PLUGIN=$(basename "$PLUGIN_DIR")
        break
      fi
    fi
  done

  echo "$PLAY_NUM | $PLAY_NAME | ${MATCHING_PLUGIN:-none}"
done
```

Compute plugin coverage: X plays with dedicated plugins / total plays.

## Step 3: Count primitives per play

For plays with a matching plugin, quantify bundled primitives:

```bash
for PLUGIN_DIR in $(find plugins -mindepth 1 -maxdepth 1 -type d); do
  PLUGIN_FILE="$PLUGIN_DIR/plugin.json"
  if [ ! -f "$PLUGIN_FILE" ]; then continue; fi

  AGENT_COUNT=$(jq '[.agents // [] | length] | add' "$PLUGIN_FILE")
  INSTR_COUNT=$(jq '[.instructions // [] | length] | add' "$PLUGIN_FILE")
  SKILL_COUNT=$(jq '[.skills // [] | length] | add' "$PLUGIN_FILE")
  HOOK_COUNT=$(jq '[.hooks // [] | length] | add' "$PLUGIN_FILE")
  TOTAL_ITEMS=$((AGENT_COUNT + INSTR_COUNT + SKILL_COUNT + HOOK_COUNT))

  echo "$(basename $PLUGIN_DIR) | A:$AGENT_COUNT I:$INSTR_COUNT S:$SKILL_COUNT H:$HOOK_COUNT | Total:$TOTAL_ITEMS"
done
```

## Step 4: Assess WAF coverage per play

For each play with a manifest, read the WAF pillar configuration:

```bash
WAF_PILLARS="security reliability cost-optimization operational-excellence performance-efficiency responsible-ai"

for DIR in $PLAY_DIRS; do
  MANIFEST="$DIR/fai-manifest.json"
  if [ ! -f "$MANIFEST" ]; then continue; fi

  PLAY_NUM=$(basename "$DIR" | grep -oP '^\d{2}')
  COVERED=$(jq -r '.context.waf[]?' "$MANIFEST" 2>/dev/null | wc -l)
  PILLAR_LIST=$(jq -r '.context.waf[]?' "$MANIFEST" 2>/dev/null | tr '\n' ', ' | sed 's/,$//')

  echo "$PLAY_NUM | $COVERED/6 | $PILLAR_LIST"
done
```

Build a coverage heatmap showing which pillars are most/least covered across all plays:

| Pillar | Plays Covering | Percentage | Coverage Band |
|--------|---------------|------------|---------------|
| Security | X/101 | Y% | 🟢 > 80%, 🟡 50-80%, 🔴 < 50% |
| Reliability | X/101 | Y% | 🟢/🟡/🔴 |
| Cost Optimization | X/101 | Y% | 🟢/🟡/🔴 |
| Operational Excellence | X/101 | Y% | 🟢/🟡/🔴 |
| Performance Efficiency | X/101 | Y% | 🟢/🟡/🔴 |
| Responsible AI | X/101 | Y% | 🟢/🟡/🔴 |

## Step 5: Technology stack analysis

Parse infrastructure and dependencies across all plays to build a technology frequency map:

```bash
# Azure service frequency
for DIR in $PLAY_DIRS; do
  if [ -f "$DIR/infra/main.bicep" ]; then
    grep -oP "Microsoft\.\w+/\w+" "$DIR/infra/main.bicep"
  fi
done | sort | uniq -c | sort -rn

# Model usage frequency
for DIR in $PLAY_DIRS; do
  if [ -f "$DIR/fai-manifest.json" ]; then
    jq -r '.infrastructure.models[]? // empty' "$DIR/fai-manifest.json"
  fi
done | sort | uniq -c | sort -rn

# Language/framework frequency
for DIR in $PLAY_DIRS; do
  [ -f "$DIR/package.json" ] && echo "Node.js"
  [ -f "$DIR/requirements.txt" ] && echo "Python"
  [ -f "$DIR/go.mod" ] && echo "Go"
  [ -f "$DIR/pom.xml" ] && echo "Java"
done | sort | uniq -c | sort -rn
```

| Category | Top 5 Technologies | Play Count |
|----------|--------------------|------------|
| Azure Services | AI Search, OpenAI, Container Apps, Cosmos DB, Functions | varies |
| AI Models | gpt-4o, gpt-4o-mini, text-embedding-3-large | varies |
| Languages | Python, TypeScript, Bicep | varies |
| Frameworks | Semantic Kernel, LangChain, FastAPI | varies |

## Step 6: Cost estimation summary

For plays with infrastructure definitions, estimate dev-scale monthly costs:

| Cost Tier | Monthly Range | Plays |
|-----------|--------------|-------|
| 💚 Low (< $50/mo) | $10-50 | Simple function-based plays |
| 💛 Medium ($50-200/mo) | $50-200 | Standard RAG, single-agent |
| 🧡 High ($200-500/mo) | $200-500 | Multi-agent, GPU workloads |
| ❤️ Premium (> $500/mo) | $500+ | Multi-region, high-throughput |

Aggregate: estimated total portfolio cost at dev scale, median play cost.

## Step 7: Complexity distribution

Classify each play by implementation complexity:

| Complexity | Criteria | Count |
|-----------|----------|-------|
| 🟢 Starter | ≤ 3 Azure services, ≤ 5 primitives, single-model | X |
| 🟡 Intermediate | 4-6 services, 6-15 primitives, multi-model | Y |
| 🔴 Advanced | 7+ services, 15+ primitives, multi-agent or multi-region | Z |

## Step 8: Gap analysis

Identify missing verticals and use cases not yet covered by any play:

| Vertical | Covered Plays | Gap |
|----------|--------------|-----|
| Healthcare | NN-hipaa-compliant-ai | FHIR integration, clinical NLP |
| Finance | NN-financial-analysis | Real-time fraud detection, RegTech |
| Manufacturing | — | Predictive maintenance, quality vision |
| Education | — | Adaptive learning, assessment AI |
| Retail | NN-recommendation | Inventory optimization, demand forecast |
| Government | NN-gov-cloud-ai | FedRAMP compliance patterns |
| Legal | — | Contract analysis, case research |
| Media | NN-content-generation | Video analysis, content moderation |

Compute gap score: covered verticals / total target verticals.

## Step 9: Compute ecosystem maturity scores

Define maturity levels with strict criteria:

| Level | Criteria | All Must Be True |
|-------|----------|-----------------|
| 🏆 Gold | Full ecosystem integration | Manifest ✅, Plugin ✅, WAF 6/6, Commits < 30d, Relevance ✅ |
| 🥈 Silver | Strong but incomplete | Manifest ✅, Plugin ✅, WAF ≥ 4/6, Commits < 90d |
| 🥉 Bronze | Partial implementation | Manifest OR Plugin, Some WAF | 
| ⬜ Unrated | Minimal | Missing manifest and plugin |

```bash
GOLD=0; SILVER=0; BRONZE=0; UNRATED=0

for DIR in $PLAY_DIRS; do
  HAS_MANIFEST=$(test -f "$DIR/fai-manifest.json" && echo 1 || echo 0)
  HAS_PLUGIN=0  # determined from Step 2
  WAF_COUNT=0   # determined from Step 4
  DAYS_SINCE=0  # determined from Step 1

  if [ "$HAS_MANIFEST" -eq 1 ] && [ "$HAS_PLUGIN" -eq 1 ] && [ "$WAF_COUNT" -ge 6 ] && [ "$DAYS_SINCE" -le 30 ]; then
    GOLD=$((GOLD + 1))
  elif [ "$HAS_MANIFEST" -eq 1 ] && [ "$HAS_PLUGIN" -eq 1 ] && [ "$WAF_COUNT" -ge 4 ] && [ "$DAYS_SINCE" -le 90 ]; then
    SILVER=$((SILVER + 1))
  elif [ "$HAS_MANIFEST" -eq 1 ] || [ "$HAS_PLUGIN" -eq 1 ]; then
    BRONZE=$((BRONZE + 1))
  else
    UNRATED=$((UNRATED + 1))
  fi
done
```

## Step 10: Find previous relevance check results

Search closed issues for play-specific relevance assessments:

```bash
for DIR in $PLAY_DIRS; do
  PLAY_NUM=$(basename "$DIR" | grep -oP '^\d{2}')
  RELEVANCE=$(gh issue list --search "Play Relevance $PLAY_NUM" --state all --limit 1 --json title,body \
    | jq -r '.[0].body // "No assessment"' | grep -oP '(Still Relevant|Needs Update|Consider Retiring)' | head -1)
  echo "$PLAY_NUM | ${RELEVANCE:-Not assessed}"
done
```

## Step 11: Error handling

| Failure | Recovery |
|---------|----------|
| Play directory unreadable | Skip play, note as "Error" in matrix |
| Manifest JSON invalid | List as "❌ Invalid" in manifest column |
| Git history unavailable | Use file timestamps, note approximation |
| Plugin search timeout | Report "Plugin check incomplete" |
| GitHub API rate limit | Report partial results, note missing data |

Always produce a report. Mark incomplete sections with "⚠️ Partial data".

## Step 12: Generate portfolio dashboard

Create an issue with the comprehensive portfolio view:

```markdown
# 🍊 FAI Play Portfolio Summary — YYYY-MM-DD

## Overview

| Metric | Value |
|--------|-------|
| Total Plays | 101 |
| Gold 🏆 | 12 (18%) |
| Silver 🥈 | 28 (41%) |
| Bronze 🥉 | 20 (29%) |
| Unrated ⬜ | 8 (12%) |
| Average WAF Score | 4.2/6 |
| Plugin Coverage | 82/101 (81%) |
| Plays  with manifest | 93/101 (92%) |
| Median play cost (dev) | $85/mo |
| Portfolio target | 101/100 (101%) |

## Maturity Distribution

## Play-by-Play Matrix

| # | Play | Manifest | Plugin | Items | WAF | Cost | Last Commit | Maturity |
|---|------|----------|--------|-------|-----|------|-------------|----------|
| 01 | Enterprise RAG | ✅ | ✅ (7) | 7 | 6/6 | 💛 | 2d ago | 🏆 |
| 02 | AI Landing Zone | ✅ | ✅ (17) | 17 | 5/6 | 💚 | 5d ago | 🥈 |
| 03 | Conversational Bot | ✅ | ✅ (8) | 8 | 6/6 | 💛 | 12d ago | 🏆 |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

## WAF Coverage Heatmap

| Pillar | Count | Pct | Coverage |
|--------|-------|-----|----------|
| Security | 86/101 | 85% | 🟢 ████████░░ |
| Reliability | 77/101 | 76% | 🟡 ████████░░ |
| Cost Optimization | 72/101 | 71% | 🟡 ███████░░░ |
| Operational Excellence | 82/101 | 81% | 🟢 ████████░░ |
| Performance Efficiency | 60/101 | 59% | 🟡 ██████░░░░ |
| Responsible AI | 67/101 | 66% | 🟡 ███████░░░ |

## Technology Stack (Top 5)

| Technology | Plays Using |
|-----------|-------------|
| Azure OpenAI | 52 (76%) |
| Azure AI Search | 35 (51%) |
| Container Apps | 28 (41%) |
| Python | 45 (66%) |
| gpt-4o | 48 (71%) |

## Complexity Distribution

| Level | Count | Percentage |
|-------|-------|------------|
| 🟢 Starter | 22 | 32% |
| 🟡 Intermediate | 30 | 44% |
| 🔴 Advanced | 16 | 24% |

## Gap Analysis — Missing Verticals

| Vertical | Status | Priority |
|----------|--------|----------|
| Manufacturing | ❌ No plays | High |
| Education | ❌ No plays | Medium |
| Legal | ❌ No plays | Medium |
| Agriculture | ❌ No plays | Low |

## Recommendations

1. **Upgrade to Gold:** 8 Silver plays are within reach (need WAF or freshness)
2. **Add manifests:** 8 plays missing fai-manifest.json
3. **Create plugins:** 14 plays without dedicated marketplace plugins
4. **WAF gaps:** Performance Efficiency is weakest pillar (59%) — add caching guidance
5. **New verticals:** Manufacturing and Education are high-priority gaps
6. **Stale plays:** 5 plays with no commits in 90+ days need renovation

## Generated by FAI Workflow Engine
_Run `/play-relevance` on individual plays for detailed assessment_
```
