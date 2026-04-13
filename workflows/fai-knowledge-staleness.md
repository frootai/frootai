---
name: FAI-knowledge-staleness
description: "Monthly check for stale FROOT knowledge modules — scores staleness across docs, plays, primitives, and schemas using a weighted multi-signal algorithm. Generates a freshness dashboard with automated update suggestions."
on:
  schedule:
    - cron: "0 8 1 * *"
  workflow_dispatch: {}
permissions:
  contents: read
  issues: write
engine: copilot
tools:
  github:
    toolsets: [repos]
  bash: true
safe-outputs:
  create-issue:
    max: 1
    title-prefix: "[FAI Staleness] "
    labels: ["staleness", "automated"]
    close-older-issues: true
timeout-minutes: 20
---

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `docs_fresh_days` | 30 | Days for "Fresh" status on knowledge modules |
| `docs_aging_days` | 90 | Days for "Aging" status (beyond this = Stale) |
| `play_fresh_days` | 60 | Days for "Active" status on solution plays |
| `play_aging_days` | 120 | Days for "Aging" status on plays |
| `primitive_stale_days` | 180 | Days without changes before a primitive is stale |
| `schema_stale_days` | 90 | Days without changes before a schema is stale |
| `health_weight_docs` | 40 | Weight for knowledge modules in overall score |
| `health_weight_plays` | 30 | Weight for solution plays |
| `health_weight_primitives` | 20 | Weight for standalone primitives |
| `health_weight_schemas` | 10 | Weight for schemas |

## Step 1: Check knowledge module freshness

For each `.md` file in `docs/`, compute days since last modification:

```bash
echo "Module | Category | Last Modified | Days | Status"
echo "-------|----------|--------------|------|-------"

for FILE in docs/*.md; do
  [ ! -f "$FILE" ] && continue
  MODULE=$(basename "$FILE" .md)
  LAST_DATE=$(git log -1 --format="%ci" -- "$FILE" 2>/dev/null | cut -d' ' -f1)
  if [ -z "$LAST_DATE" ]; then
    DAYS="N/A"
    STATUS="⚫ No history"
  else
    DAYS=$(( ($(date +%s) - $(date -d "$LAST_DATE" +%s)) / 86400 ))
    if [ "$DAYS" -le 30 ]; then STATUS="🟢 Fresh"
    elif [ "$DAYS" -le 90 ]; then STATUS="🟡 Aging"
    else STATUS="🔴 Stale"
    fi
  fi

  # Determine FROOT category
  CATEGORY="Unknown"
  case "$MODULE" in
    *Foundation*|*GenAI*|*LLM*|*Glossary*|*Agentic*) CATEGORY="F-series" ;;
    *RAG*|*Prompt*|*Deterministic*) CATEGORY="R-series" ;;
    *Semantic*|*Copilot*|*MCP*|*Azure-AI*|*Infra*) CATEGORY="O-series" ;;
    *Fine-Tuning*|*Responsible*|*Production*) CATEGORY="T-series" ;;
  esac

  echo "$MODULE | $CATEGORY | $LAST_DATE | $DAYS | $STATUS"
done
```

Classify by FROOT taxonomy:

| Series | Modules | Description |
|--------|---------|-------------|
| **F-series (Foundations)** | GenAI-Foundations, LLM-Landscape, AI-Glossary, GitHub-Agentic-OS | Core AI knowledge |
| **R-series (Reasoning)** | RAG-Architecture, Prompt-Engineering, Deterministic-AI | Reasoning patterns |
| **O-series (Orchestration)** | Semantic-Kernel, Copilot-Ecosystem, MCP-Tools, Azure-AI-Foundry, AI-Infrastructure | Integration layer |
| **T-series (Transformation)** | Fine-Tuning-MLOps, Responsible-AI-Safety, Production-Patterns | Production readiness |

## Step 2: Check solution play freshness

For each play folder, compute last commit recency:

```bash
PLAY_FRESH=0; PLAY_AGING=0; PLAY_STALE=0

for DIR in $(find solution-plays -mindepth 1 -maxdepth 1 -type d -name "[0-9][0-9]-*" | sort); do
  PLAY_NUM=$(basename "$DIR" | grep -oP '^\d{2}')
  PLAY_NAME=$(basename "$DIR" | sed 's/^[0-9]*-//')
  LAST_DATE=$(git log -1 --format="%ci" -- "$DIR/" 2>/dev/null | cut -d' ' -f1)

  if [ -z "$LAST_DATE" ]; then
    STATUS="⚫"
    DAYS="N/A"
  else
    DAYS=$(( ($(date +%s) - $(date -d "$LAST_DATE" +%s)) / 86400 ))
    if [ "$DAYS" -le 60 ]; then
      STATUS="🟢"; PLAY_FRESH=$((PLAY_FRESH + 1))
    elif [ "$DAYS" -le 120 ]; then
      STATUS="🟡"; PLAY_AGING=$((PLAY_AGING + 1))
    else
      STATUS="🔴"; PLAY_STALE=$((PLAY_STALE + 1))
    fi
  fi

  # Also count commits in last 90 days for activity signal
  RECENT_COMMITS=$(git log --since="90 days ago" --oneline -- "$DIR/" 2>/dev/null | wc -l)

  echo "$PLAY_NUM | $PLAY_NAME | $LAST_DATE | $DAYS | $RECENT_COMMITS commits (90d) | $STATUS"
done
```

## Step 3: Check primitive freshness

Scan each primitive category for stale files:

```bash
for CATEGORY in agents instructions; do
  case "$CATEGORY" in
    agents) PATTERN="*.agent.md"; THRESHOLD=180 ;;
    instructions) PATTERN="*.instructions.md"; THRESHOLD=180 ;;
  esac

  FRESH=0; AGING=0; STALE=0
  for FILE in $CATEGORY/$PATTERN; do
    [ ! -f "$FILE" ] && continue
    LAST_DATE=$(git log -1 --format="%ci" -- "$FILE" 2>/dev/null | cut -d' ' -f1)
    if [ -n "$LAST_DATE" ]; then
      DAYS=$(( ($(date +%s) - $(date -d "$LAST_DATE" +%s)) / 86400 ))
      if [ "$DAYS" -le 90 ]; then FRESH=$((FRESH + 1))
      elif [ "$DAYS" -le "$THRESHOLD" ]; then AGING=$((AGING + 1))
      else STALE=$((STALE + 1))
      fi
    fi
  done
  echo "$CATEGORY | Fresh:$FRESH Aging:$AGING Stale:$STALE"
done

# Skills — check directory-level freshness
SKILL_FRESH=0; SKILL_AGING=0; SKILL_STALE=0
for DIR in $(find skills -mindepth 1 -maxdepth 1 -type d); do
  LAST_DATE=$(git log -1 --format="%ci" -- "$DIR/" 2>/dev/null | cut -d' ' -f1)
  if [ -n "$LAST_DATE" ]; then
    DAYS=$(( ($(date +%s) - $(date -d "$LAST_DATE" +%s)) / 86400 ))
    if [ "$DAYS" -le 90 ]; then SKILL_FRESH=$((SKILL_FRESH + 1))
    elif [ "$DAYS" -le 180 ]; then SKILL_AGING=$((SKILL_AGING + 1))
    else SKILL_STALE=$((SKILL_STALE + 1))
    fi
  fi
done

# Schemas — shorter threshold since they should evolve more actively
SCHEMA_FRESH=0; SCHEMA_AGING=0; SCHEMA_STALE=0
for FILE in schemas/*.json; do
  [ ! -f "$FILE" ] && continue
  LAST_DATE=$(git log -1 --format="%ci" -- "$FILE" 2>/dev/null | cut -d' ' -f1)
  if [ -n "$LAST_DATE" ]; then
    DAYS=$(( ($(date +%s) - $(date -d "$LAST_DATE" +%s)) / 86400 ))
    if [ "$DAYS" -le 45 ]; then SCHEMA_FRESH=$((SCHEMA_FRESH + 1))
    elif [ "$DAYS" -le 90 ]; then SCHEMA_AGING=$((SCHEMA_AGING + 1))
    else SCHEMA_STALE=$((SCHEMA_STALE + 1))
    fi
  fi
done

# Engine modules
ENGINE_FRESH=0; ENGINE_AGING=0; ENGINE_STALE=0
for FILE in engine/*.js engine/*.ts; do
  [ ! -f "$FILE" ] && continue
  LAST_DATE=$(git log -1 --format="%ci" -- "$FILE" 2>/dev/null | cut -d' ' -f1)
  if [ -n "$LAST_DATE" ]; then
    DAYS=$(( ($(date +%s) - $(date -d "$LAST_DATE" +%s)) / 86400 ))
    if [ "$DAYS" -le 30 ]; then ENGINE_FRESH=$((ENGINE_FRESH + 1))
    elif [ "$DAYS" -le 60 ]; then ENGINE_AGING=$((ENGINE_AGING + 1))
    else ENGINE_STALE=$((ENGINE_STALE + 1))
    fi
  fi
done
```

## Step 4: Azure SDK version checking

For docs referencing Azure SDKs, check whether the documented versions are still current:

```bash
# Extract version references from docs
for FILE in docs/*.md; do
  grep -oP '@azure/[\w-]+@[\d.]+' "$FILE" 2>/dev/null
  grep -oP 'azure-[\w-]+==[\d.]+' "$FILE" 2>/dev/null
done | sort -u
```

| Package Pattern | Stale If | Check Against |
|----------------|----------|---------------|
| `@azure/*` (Node) | > 2 minor behind | npm registry |
| `azure-*` (Python) | > 2 minor behind | PyPI |
| `Microsoft.CognitiveServices` | API > 1 year old | Azure RP |

Flag any documented SDK version that is more than 2 minor versions behind current stable.

## Step 5: Module dependency graph

Map which modules reference each other and identify broken cross-references:

```bash
for FILE in docs/*.md; do
  MODULE=$(basename "$FILE" .md)
  REFS=$(grep -oP '\[.*?\]\((?!http)[\w/-]+\.md\)' "$FILE" 2>/dev/null | grep -oP '[\w/-]+\.md' | sort -u)
  for REF in $REFS; do
    if [ -f "docs/$REF" ]; then
      echo "$MODULE → $REF (✅)"
    else
      echo "$MODULE → $REF (❌ broken)"
    fi
  done
done
```

Build a reference count for each module — modules referenced by many others are higher priority for freshness.

| Module | Referenced By | Priority Multiplier |
|--------|-------------|---------------------|
| ≥ 5 references | High-dependency | 2.0x staleness urgency |
| 1-4 references | Standard | 1.0x |
| 0 references | Standalone | 0.8x |

## Step 6: Compute staleness scores

Calculate per-category and overall health scores:

**Per-category formula:**
```
Category Score = (Fresh × 1.0 + Aging × 0.5 + Stale × 0.0) / Total × 100
```

**Overall health score (weighted):**
```
Overall = (Docs Score × 0.40) + (Plays Score × 0.30) + (Primitives Score × 0.20) + (Schemas Score × 0.10)
```

| Score Range | Health Rating | Action |
|-------------|--------------|--------|
| 80-100% | 🟢 Healthy | Maintenance mode — review quarterly |
| 60-79% | 🟡 Needs Attention | Schedule update sprint within 2 weeks |
| 40-59% | 🟠 At Risk | Immediate triage — assign owners |
| 0-39% | 🔴 Critical | Emergency refresh needed |

## Step 7: Generate automated update suggestions

For each stale item, produce a specific actionable recommendation:

| Stale Item Type | Suggestion |
|----------------|------------|
| Knowledge module | Review for accuracy against current Azure docs |
| Solution play | Check dependency versions, Bicep API versions, model references |
| Agent file | Verify `tools` and `model` frontmatter fields |
| Schema file | Check against latest FAI Protocol spec for new fields |

## Step 8: Error handling

| Failure | Recovery |
|---------|----------|
| Git log fails for a file | Use filesystem mtime as fallback |
| No git history at all | Skip time-based analysis, score 0% |
| Docs directory empty | Report "No modules found", score 0% |
| Date parsing fails | Flag as "⚠️ Date error" |

Always produce a report. Mark sections with insufficient data.

## Step 9: Generate staleness report

Create a comprehensive freshness dashboard issue:

```markdown
# 🍊 FAI Knowledge Staleness Report — YYYY-MM-DD

## Overall Health: 72% 🟡 Needs Attention

| Category | Score | Fresh | Aging | Stale | Weight |
|----------|-------|-------|-------|-------|--------|
| Knowledge Modules | 65% | 6 | 4 | 5 | 40% |
| Solution Plays | 78% | 45 | 15 | 8 | 30% |
| Primitives | 82% | 380 | 55 | 24 | 20% |
| Schemas | 60% | 3 | 2 | 2 | 10% |

## Knowledge Modules (docs/)

| Module | Category | Last Modified | Days | Refs | Status |
|--------|----------|--------------|------|------|--------|
| GenAI-Foundations.md | F-series | 2026-03-15 | 22 | 8 | 🟢 Fresh |
| LLM-Landscape.md | F-series | 2026-01-10 | 86 | 5 | 🟡 Aging |
| RAG-Architecture.md | R-series | 2025-12-01 | 126 | 12 | 🔴 Stale ⚠️ |
| Prompt-Engineering.md | R-series | 2026-02-20 | 45 | 7 | 🟡 Aging |
| Semantic-Kernel.md | O-series | 2026-03-28 | 9 | 4 | 🟢 Fresh |
| ... | ... | ... | ... | ... | ... |

**Summary:** 6 fresh, 4 aging, 5 stale out of 15 modules
**High-priority stale:** RAG-Architecture (12 cross-references, 126 days old)

## Solution Plays

| # | Play | Last Commit | Days | Recent Commits (90d) | Status |
|---|------|-------------|------|---------------------|--------|
| 01 | Enterprise RAG | 2026-04-04 | 2 | 14 | 🟢 Active |
| 02 | AI Landing Zone | 2026-04-01 | 5 | 8 | 🟢 Active |
| 15 | Legacy Migration | 2025-11-20 | 137 | 0 | 🔴 Stale |
| ... | ... | ... | ... | ... | ... |

**Summary:** 45 active, 15 aging, 8 stale out of 68 plays

## Primitive Freshness

| Category | Total | Fresh | Aging | Stale | Score |
|----------|-------|-------|-------|-------|-------|
| Agents | 201 | 160 | 30 | 11 | 87% 🟢 |
| Instructions | 176 | 140 | 25 | 11 | 87% 🟢 |
| Skills | 282 | 210 | 50 | 22 | 83% 🟢 |
| Schemas | 7 | 3 | 2 | 2 | 57% 🟠 |
| Engine | 12 | 8 | 3 | 1 | 79% 🟡 |

## SDK Version Drift

| Package | Documented | Latest | Gap | Module |
|---------|-----------|--------|-----|--------|
| @azure/openai | 1.0.0 | 1.2.3 | 2 minor | LLM-Landscape |
| azure-ai-inference | 1.0.0b1 | 1.0.0 | GA released | Azure-AI-Foundry |

## Broken Cross-References

| Source Module | Target | Status |
|--------------|--------|--------|
| RAG-Architecture → old-embeddings.md | Missing | ❌ |

## Recommended Actions

| Priority | Action | Target | Days Stale |
|----------|--------|--------|------------|
| 🔴 High | Refresh RAG-Architecture.md | docs/ | 126 days |
| 🔴 High | Update Play 15 or archive | solution-plays/ | 137 days |
| 🟡 Medium | Update LLM-Landscape.md | docs/ | 86 days |
| 🟡 Medium | Review stale schemas | schemas/ | 95 days |
| 🟢 Low | Update SDK references | docs/ | Minor drift |

## Generated by FAI Workflow Engine — _Next scan: first day of next month at 08:00 UTC_
```
