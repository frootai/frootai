---
name: fai-marketplace-health
description: "Weekly marketplace integrity check — validates all plugin.json files, verifies referenced primitives exist, detects orphaned plugins, and regenerates marketplace.json if needed."
on:
  schedule:
    - cron: "0 9 * * 3"
  workflow_dispatch: {}
permissions:
  contents: read
  issues: write
  pull-requests: write
engine: copilot
tools:
  bash: true
safe-outputs:
  create-issue:
    max: 1
    title-prefix: "[FAI Marketplace] "
    labels: ["marketplace", "automated"]
    close-older-issues: true
  create-pull-request:
    max: 1
    draft: true
    title-prefix: "[auto] Marketplace regeneration — "
    labels: ["automated", "marketplace"]
timeout-minutes: 20
---

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `stale_plugin_days` | 90 | Days without commits before a plugin is flagged stale |
| `min_items_per_plugin` | 1 | Minimum bundled items for a valid plugin |
| `max_items_per_plugin` | 50 | Maximum bundled items before complexity warning |
| `marketplace_freshness_hours` | 48 | Maximum age of marketplace.json before regeneration |
| `quality_score_threshold` | 60 | Minimum quality score (0-100) to pass health check |
| `required_plugin_files` | `plugin.json, README.md` | Files every plugin directory must contain |

## Step 1: Discover all plugin directories

Enumerate every directory under `plugins/` and classify:

```bash
ALL_DIRS=$(find plugins -mindepth 1 -maxdepth 1 -type d | sort)
PLUGIN_COUNT=$(echo "$ALL_DIRS" | wc -l)

for DIR in $ALL_DIRS; do
  PLUGIN_NAME=$(basename "$DIR")
  HAS_JSON=$(test -f "$DIR/plugin.json" && echo "yes" || echo "no")
  HAS_README=$(test -f "$DIR/README.md" && echo "yes" || echo "no")
  echo "$PLUGIN_NAME | $HAS_JSON | $HAS_README"
done
```

Classify each directory:
- **Complete:** Has both `plugin.json` and `README.md`
- **Partial:** Has `plugin.json` but missing `README.md`
- **Orphaned:** Directory exists but no `plugin.json`

## Step 2: Validate plugin.json schema compliance

For each plugin with a `plugin.json`, validate required fields:

```bash
for DIR in $(find plugins -mindepth 1 -maxdepth 1 -type d); do
  PLUGIN_FILE="$DIR/plugin.json"
  if [ ! -f "$PLUGIN_FILE" ]; then continue; fi

  NAME=$(jq -r '.name // empty' "$PLUGIN_FILE")
  VERSION=$(jq -r '.version // empty' "$PLUGIN_FILE")
  AUTHOR=$(jq -r '.author.name // empty' "$PLUGIN_FILE")

  ERRORS=""
  [ -z "$NAME" ] && ERRORS="$ERRORS missing name;"
  [ -z "$(jq -r '.description // empty' "$PLUGIN_FILE")" ] && ERRORS="$ERRORS missing description;"
  [ -z "$VERSION" ] && ERRORS="$ERRORS missing version;"
  [ -z "$AUTHOR" ] && ERRORS="$ERRORS missing author.name;"
  [ -z "$(jq -r '.license // empty' "$PLUGIN_FILE")" ] && ERRORS="$ERRORS missing license;"
  echo "$VERSION" | grep -qP '^\d+\.\d+\.\d+' || ERRORS="$ERRORS invalid semver;"
  DIR_NAME=$(basename "$DIR")
  [ "$NAME" != "$DIR_NAME" ] && ERRORS="$ERRORS name/dir mismatch;"

  echo "$DIR_NAME | ${ERRORS:-OK}"
done
```

| Schema Field | Required | Validation Rule |
|-------------|----------|-----------------|
| `name` | Yes | Must match parent directory name, kebab-case |
| `description` | Yes | 10-500 characters |
| `version` | Yes | Valid semver (X.Y.Z) |
| `author.name` | Yes | Non-empty string |
| `license` | Yes | Valid SPDX identifier |
| `agents/instructions/skills/hooks[]` | No | Each path must resolve to existing file/directory |
| `plays[]` | No | Each play number must match a `solution-plays/NN-*` directory |

## Step 3: Verify primitive reference integrity

For each plugin, resolve every referenced path and check existence:

```bash
TOTAL_REFS=0; VALID_REFS=0; BROKEN_REFS=0; BROKEN_LIST=""

for DIR in $(find plugins -mindepth 1 -maxdepth 1 -type d); do
  PLUGIN_FILE="$DIR/plugin.json"
  if [ ! -f "$PLUGIN_FILE" ]; then continue; fi
  PLUGIN_NAME=$(basename "$DIR")

  # Check all reference types
  for TYPE in agents instructions skills hooks; do
    for REF in $(jq -r ".${TYPE}[]? // empty" "$PLUGIN_FILE"); do
      TOTAL_REFS=$((TOTAL_REFS + 1))
      EXISTS="no"
      case "$TYPE" in
        agents|instructions) [ -f "$REF" ] && EXISTS="yes" ;;
        skills) [ -d "$REF" ] && [ -f "$REF/SKILL.md" ] && EXISTS="yes" ;;
        hooks) [ -d "$REF" ] && [ -f "$REF/hooks.json" ] && EXISTS="yes" ;;
      esac
      if [ "$EXISTS" = "yes" ]; then
        VALID_REFS=$((VALID_REFS + 1))
      else
        BROKEN_REFS=$((BROKEN_REFS + 1))
        BROKEN_LIST="$BROKEN_LIST\n$PLUGIN_NAME → $REF"
      fi
    done
  done
done

INTEGRITY_PCT=$((VALID_REFS * 100 / TOTAL_REFS))
```

## Step 4: Detect orphaned and empty plugins

Identify plugins that should be cleaned up or completed:

```bash
ORPHANED=""
EMPTY=""
OVERSIZED=""

for DIR in $(find plugins -mindepth 1 -maxdepth 1 -type d); do
  PLUGIN_NAME=$(basename "$DIR")
  PLUGIN_FILE="$DIR/plugin.json"

  # No plugin.json — orphaned
  if [ ! -f "$PLUGIN_FILE" ]; then
    ORPHANED="$ORPHANED $PLUGIN_NAME"
    continue
  fi

  # Count total items
  ITEM_COUNT=$(jq '[(.agents // []), (.instructions // []), (.skills // []), (.hooks // [])] | flatten | length' "$PLUGIN_FILE")

  [ "$ITEM_COUNT" -eq 0 ] && EMPTY="$EMPTY $PLUGIN_NAME"
  [ "$ITEM_COUNT" -gt 50 ] && OVERSIZED="$OVERSIZED $PLUGIN_NAME"
done
```

| Issue Type | Detection | Recommendation |
|-----------|-----------|---------------|
| Orphaned directory | No `plugin.json` | Add `plugin.json` or remove directory |
| Empty plugin | 0 items referenced | Add primitives or remove plugin |
| Missing README | Has `plugin.json` but no `README.md` | Create README with usage instructions |
| Oversized plugin | > 50 items | Consider splitting into focused sub-plugins |
| All refs broken | Every path is missing | Likely renamed — update paths or remove |

## Step 5: Plugin staleness detection

Check commit recency for each plugin directory:

```bash
for DIR in $(find plugins -mindepth 1 -maxdepth 1 -type d); do
  PLUGIN_NAME=$(basename "$DIR")
  LAST_COMMIT=$(git log -1 --format="%ci" -- "$DIR/" 2>/dev/null)
  if [ -n "$LAST_COMMIT" ]; then
    DAYS_AGO=$(( ($(date +%s) - $(date -d "$LAST_COMMIT" +%s)) / 86400 ))
    STATUS="🟢"
    [ "$DAYS_AGO" -gt 60 ] && STATUS="🟡"
    [ "$DAYS_AGO" -gt 90 ] && STATUS="🔴"
    echo "$PLUGIN_NAME | $DAYS_AGO days | $STATUS"
  else
    echo "$PLUGIN_NAME | No history | ⚫"
  fi
done
```

## Step 6: Compute plugin quality scores

Score each plugin on a 0-100 scale based on multiple signals:

| Signal | Weight | Score Logic |
|--------|--------|-------------|
| Schema compliance | 25% | 100 if all required fields valid, -20 per missing field |
| Reference integrity | 25% | (valid_refs / total_refs) × 100 |
| Documentation | 15% | 100 if README.md exists with 50+ lines, 50 for short README, 0 if missing |
| Item count | 10% | 100 if 3-20 items, 70 if 1-2 or 21-50, 0 if empty or 50+ |
| Freshness | 15% | 100 if < 30d, 70 if 30-60d, 40 if 60-90d, 0 if 90d+ |
| Category assigned | 10% | 100 if category present and valid, 0 if missing |

**Quality Score = Σ(signal_score × weight)**

| Range | Grade | Action |
|-------|-------|--------|
| 80-100 | 🟢 A | No action needed |
| 60-79 | 🟡 B | Minor improvements recommended |
| 40-59 | 🟠 C | Needs attention within 2 weeks |
| 0-39 | 🔴 D | Critical — fix or remove |

## Step 7: Check marketplace.json freshness and accuracy

Compare the generated `marketplace.json` against actual plugin directories:

```bash
MARKETPLACE_PLUGIN_COUNT=$(jq '.plugins | length' marketplace.json)
ACTUAL_PLUGIN_COUNT=$(find plugins -mindepth 1 -maxdepth 1 -type d -exec test -f {}/plugin.json \; -print | wc -l)
MARKETPLACE_GENERATED=$(jq -r '.generated' marketplace.json)
MARKETPLACE_AGE=$(( ($(date +%s) - $(date -d "$MARKETPLACE_GENERATED" +%s)) / 3600 ))

MISMATCH=$((ACTUAL_PLUGIN_COUNT - MARKETPLACE_PLUGIN_COUNT))
NEEDS_REGEN="no"
[ "$MISMATCH" -ne 0 ] && NEEDS_REGEN="yes"
[ "$MARKETPLACE_AGE" -gt 48 ] && NEEDS_REGEN="yes"
```

If regeneration is needed:

```bash
node scripts/generate-marketplace.js
```

## Step 8: Version compatibility matrix

Check that plugins reference compatible primitive versions:

```bash
for DIR in $(find plugins -mindepth 1 -maxdepth 1 -type d); do
  PLUGIN_FILE="$DIR/plugin.json"
  if [ ! -f "$PLUGIN_FILE" ]; then continue; fi

  PLUGIN_VERSION=$(jq -r '.version' "$PLUGIN_FILE")
  MIN_ENGINE=$(jq -r '.engines.fai // "any"' "$PLUGIN_FILE")
  echo "$(basename $DIR) | v$PLUGIN_VERSION | engine: $MIN_ENGINE"
done
```

## Step 9: Error handling

| Failure | Recovery |
|---------|----------|
| `plugin.json` has invalid JSON | Log parse error, skip plugin, count as schema failure |
| `jq` command fails | Fall back to `node -e` for JSON parsing |
| Git history unavailable | Skip freshness checks, score freshness as 50 |
| `generate-marketplace.js` fails | Report failure, do not create PR |
| Too many broken refs (>50%) | Flag as critical, suggest bulk path audit |

Always produce a health report even with partial data.

## Step 10: Generate health report

Create an issue with the full marketplace health dashboard:

```markdown
# 🍊 FAI Marketplace Health Report — YYYY-MM-DD

## Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total plugin directories | 77 | — |
| Valid plugins (with plugin.json) | 75 | 🟢 |
| Orphaned directories | 2 | 🟡 |
| Empty plugins | 0 | 🟢 |
| Average quality score | 82/100 | 🟢 A |

## Schema Validation

| Result | Count | Percentage |
|--------|-------|------------|
| ✅ All fields valid | 70 | 93% |
| ⚠️ Missing optional fields | 3 | 4% |
| ❌ Missing required fields | 2 | 3% |

## Reference Integrity

| Metric | Value |
|--------|-------|
| Total references | 487 |
| Valid (file exists) | 481 (98.8%) |
| Broken (file missing) | 6 (1.2%) |

**Broken references:**
- `enterprise-rag → agents/old-name.agent.md` (renamed?)
- `ai-landing-zone → skills/deprecated-skill/` (removed?)

## Quality Scores

| Grade | Count | Plugins |
|-------|-------|---------|
| 🟢 A (80-100) | 60 | — |
| 🟡 B (60-79) | 12 | plugin-x, plugin-y |
| 🟠 C (40-59) | 2 | plugin-z |
| 🔴 D (0-39) | 1 | needs-cleanup |

## Staleness

| Status | Count | Plugins |
|--------|-------|---------|
| 🟢 Fresh (< 30d) | 55 | — |
| 🟡 Aging (30-60d) | 15 | — |
| 🔴 Stale (60d+) | 5 | list-here |

## Marketplace.json Status

| Check | Result |
|-------|--------|
| Plugin count match | 75 listed / 75 actual ✅ |
| Generated age | 12h ago ✅ |
| Regeneration needed | No |

## Action Items

| Priority | Action | Plugin |
|----------|--------|--------|
| 🔴 | Fix broken references | enterprise-rag |
| 🟡 | Add README.md | plugin-z |
| 🟡 | Remove orphaned directory | old-experiment/ |

## Auto-Fix Applied
- [x] Marketplace.json regenerated (if needed)
- [ ] Draft PR created with updated marketplace.json
```

If marketplace.json was regenerated, create a draft PR with the updated file.
