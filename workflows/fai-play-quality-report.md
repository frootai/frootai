---
name: FAI-play-quality-report
description: "Weekly quality scan of all solution plays — scores DevKit completeness, TuneKit validation, SpecKit presence, documentation quality, dependency health, security posture, and assigns an overall A-F grade with cross-play comparison."
on:
  schedule:
    - cron: "0 10 * * 1"
  workflow_dispatch:
    inputs:
      play_filter:
        description: "Specific play number (e.g., 01) or empty for all"
        type: string
        required: false
      grade_threshold:
        description: "Minimum passing grade (A-F)"
        type: string
        required: false
        default: "C"
permissions:
  contents: read
  issues: write
engine: copilot
tools:
  bash: true
safe-outputs:
  create-issue:
    max: 1
    title-prefix: "[FAI Play Quality] "
    labels: ["quality-report", "automated"]
    close-older-issues: true
timeout-minutes: 30
---

## Step 1: Enumerate plays

```bash
FILTER="${{ inputs.play_filter }}"
if [ -n "$FILTER" ]; then
  PLAYS=$(ls -d solution-plays/${FILTER}-*/ 2>/dev/null)
else
  PLAYS=$(ls -d solution-plays/[0-9][0-9]-*/ 2>/dev/null)
fi
PLAY_COUNT=$(echo "$PLAYS" | grep -c '/' || echo 0)
echo "Scanning $PLAY_COUNT plays"
```

## Step 2: Define quality dimensions

| # | Dimension | Category | Weight | Checks |
|---|-----------|----------|--------|--------|
| 1 | Manifest | SpecKit | 20% | fai-manifest.json structure and fields |
| 2 | DevKit | DevKit | 15% | Agents and instructions linked to play |
| 3 | TuneKit | TuneKit | 15% | Eval config, guardrails, tuning |
| 4 | Infrastructure | SpecKit | 10% | Bicep files, security, diagnostics |
| 5 | Documentation | DevKit | 15% | README quality and completeness |
| 6 | Test coverage | DevKit | 10% | Test files, eval results |
| 7 | Dependencies | Ops | 5% | Package health, lock files |
| 8 | Security | Security | 10% | Secrets, auth patterns |

**Grade scale:** A (90-100) ✅, B (80-89) ✅, C (70-79) ⚠️, D (60-69) ⚠️, F (0-59) ❌.

## Step 3: Score — Manifest completeness (20%)

```bash
for PLAY_DIR in $PLAYS; do
  SLUG=$(basename "$PLAY_DIR")
  MANIFEST="$PLAY_DIR/fai-manifest.json"
  [ ! -f "$MANIFEST" ] && echo "MANIFEST|$SLUG|0|Missing" && continue
  node -e "
    const m = require('./$MANIFEST');
    let s = 0, n = [];
    if (m.play === '$SLUG') s += 10; else n.push('play mismatch');
    if (/^\d+\.\d+\.\d+$/.test(m.version)) s += 10; else n.push('bad semver');
    if (m.context?.knowledge?.length > 0) s += 10; else n.push('no knowledge');
    if (m.context?.waf?.length > 0) s += 10; else n.push('no WAF');
    if (m.primitives?.guardrails) s += 10; else n.push('no guardrails');
    if (m.primitives?.agents?.length > 0) s += 10; else n.push('no agents');
    const g = m.primitives?.guardrails || {};
    if (g.groundedness?.threshold >= 0.7) s += 10; else n.push('groundedness low');
    if (g.safety?.threshold >= 0.8) s += 10; else n.push('safety low');
    if (m.primitives?.instructions?.length > 0) s += 10; else n.push('no instructions');
    if (m.primitives?.hooks?.length > 0) s += 10; else n.push('no hooks');
    console.log('MANIFEST|$SLUG|' + s + '|' + (n.length ? n.join('; ') : 'complete'));
  "
done
```

## Step 4: Score — DevKit completeness (15%)

```bash
for PLAY_DIR in $PLAYS; do
  SLUG=$(basename "$PLAY_DIR"); SCORE=0
  [ -d "$PLAY_DIR/.github" ] && SCORE=$((SCORE + 20))
  [ -d "$PLAY_DIR/.github/agents" ] && SCORE=$((SCORE + 10))
  [ -d "$PLAY_DIR/.github/instructions" ] && SCORE=$((SCORE + 10))
  AGENTS=$(grep -rl "$SLUG" agents/*.agent.md 2>/dev/null | wc -l)
  [ "$AGENTS" -ge 1 ] && SCORE=$((SCORE + 20))
  [ "$AGENTS" -ge 3 ] && SCORE=$((SCORE + 10))
  INSTRS=$(grep -rl "$SLUG" instructions/*.instructions.md 2>/dev/null | wc -l)
  [ "$INSTRS" -ge 1 ] && SCORE=$((SCORE + 20))
  [ "$INSTRS" -ge 2 ] && SCORE=$((SCORE + 10))
  echo "DEVKIT|$SLUG|$SCORE|agents=$AGENTS instrs=$INSTRS"
done
```

## Step 5: Score — TuneKit validation (15%)

```bash
for PLAY_DIR in $PLAYS; do
  SLUG=$(basename "$PLAY_DIR"); SCORE=0
  [ -d "$PLAY_DIR/config" ] && SCORE=$((SCORE + 15))
  [ -f "$PLAY_DIR/config/evaluation-config.json" ] && SCORE=$((SCORE + 20))
  EVALS=$(ls "$PLAY_DIR"/config/evaluation-results*.json 2>/dev/null | wc -l)
  [ "$EVALS" -ge 1 ] && SCORE=$((SCORE + 25))
  [ -f "$PLAY_DIR/fai-manifest.json" ] && node -e "
    const m=require('./$PLAY_DIR/fai-manifest.json');
    console.log(m.primitives?.guardrails ? 'HAS_GUARD' : 'NO_GUARD');
  " 2>/dev/null | grep -q 'HAS_GUARD' && SCORE=$((SCORE + 20))
  [ -f "$PLAY_DIR/config/openai.json" ] && SCORE=$((SCORE + 10))
  [ -f "$PLAY_DIR/config/guardrails.json" ] && SCORE=$((SCORE + 10))
  echo "TUNEKIT|$SLUG|$SCORE|evals=$EVALS"
done
```

## Step 6: Score — Infrastructure (10%)

```bash
for PLAY_DIR in $PLAYS; do
  SLUG=$(basename "$PLAY_DIR"); SCORE=0
  BICEP="$PLAY_DIR/infra/main.bicep"
  if [ -f "$BICEP" ]; then
    SCORE=30
    RES=$(grep -c '^resource ' "$BICEP" 2>/dev/null || echo 0)
    [ "$RES" -ge 1 ] && SCORE=$((SCORE + 15))
    [ "$RES" -ge 3 ] && SCORE=$((SCORE + 10))
    grep -q '@secure()' "$BICEP" 2>/dev/null && SCORE=$((SCORE + 15))
    grep -q 'diagnosticSettings' "$BICEP" 2>/dev/null && SCORE=$((SCORE + 15))
    grep -q 'tags' "$BICEP" 2>/dev/null && SCORE=$((SCORE + 15))
  fi
  echo "INFRA|$SLUG|$SCORE"
done
```

## Step 7: Score — Documentation quality (15%)

```bash
for PLAY_DIR in $PLAYS; do
  SLUG=$(basename "$PLAY_DIR"); SCORE=0
  README="$PLAY_DIR/README.md"
  if [ -f "$README" ]; then
    LINES=$(wc -l < "$README")
    [ "$LINES" -ge 20 ] && SCORE=$((SCORE + 15))
    [ "$LINES" -ge 100 ] && SCORE=$((SCORE + 10))
    grep -qi 'architecture\|diagram' "$README" 2>/dev/null && SCORE=$((SCORE + 10))
    grep -qi 'prerequisite\|requirement' "$README" 2>/dev/null && SCORE=$((SCORE + 10))
    grep -qi 'deploy\|setup' "$README" 2>/dev/null && SCORE=$((SCORE + 10))
    grep -q '```' "$README" 2>/dev/null && SCORE=$((SCORE + 10))
    grep -qi 'TODO\|PLACEHOLDER' "$README" 2>/dev/null || SCORE=$((SCORE + 15))
  fi
  [ -f "$PLAY_DIR/froot.json" ] && SCORE=$((SCORE + 10))
  echo "DOCS|$SLUG|$SCORE"
done
```

## Step 8: Score — Test coverage (10%)

```bash
for PLAY_DIR in $PLAYS; do
  SLUG=$(basename "$PLAY_DIR"); SCORE=0
  TESTS=$(find "$PLAY_DIR" -name '*test*' -o -name '*spec*' -o -name '*.eval.*' 2>/dev/null | wc -l)
  [ "$TESTS" -ge 1 ] && SCORE=$((SCORE + 30))
  [ "$TESTS" -ge 3 ] && SCORE=$((SCORE + 20))
  LATEST=$(ls -t "$PLAY_DIR"/config/evaluation-results*.json 2>/dev/null | head -1)
  [ -n "$LATEST" ] && SCORE=$((SCORE + 30))
  echo "TESTS|$SLUG|$SCORE|files=$TESTS"
done
```

## Step 9: Score — Dependency health (5%)

```bash
for PLAY_DIR in $PLAYS; do
  SLUG=$(basename "$PLAY_DIR"); SCORE=50
  if [ -f "$PLAY_DIR/package.json" ]; then
    SCORE=20
    [ -f "$PLAY_DIR/package-lock.json" ] && SCORE=$((SCORE + 30))
    DEPS=$(node -e "console.log(Object.keys(require('./$PLAY_DIR/package.json').dependencies||{}).length)" 2>/dev/null)
    [ "$DEPS" -lt 20 ] && SCORE=$((SCORE + 30))
    SCORE=$((SCORE + 20))
  elif [ -f "$PLAY_DIR/requirements.txt" ] || [ -f "$PLAY_DIR/pyproject.toml" ]; then
    SCORE=80
  fi
  echo "DEPS|$SLUG|$SCORE"
done
```

## Step 10: Score — Security posture (10%)

```bash
for PLAY_DIR in $PLAYS; do
  SLUG=$(basename "$PLAY_DIR"); SCORE=100
  SECRETS=$(grep -rlP '(sk-[a-zA-Z0-9]{20}|AKIA[0-9A-Z]{16}|DefaultEndpointsProtocol=)' "$PLAY_DIR" 2>/dev/null | wc -l)
  SCORE=$((SCORE - SECRETS * 25))
  grep -rl 'api_key\|AzureKeyCredential' "$PLAY_DIR" 2>/dev/null | head -1 > /dev/null 2>&1 \
    && ! grep -rl 'DefaultAzureCredential' "$PLAY_DIR" 2>/dev/null | head -1 > /dev/null 2>&1 \
    && SCORE=$((SCORE - 15))
  [ -f "$PLAY_DIR/infra/main.bicep" ] && ! grep -q '@secure()' "$PLAY_DIR/infra/main.bicep" 2>/dev/null \
    && SCORE=$((SCORE - 10))
  [ "$SCORE" -lt 0 ] && SCORE=0
  echo "SECURITY|$SLUG|$SCORE"
done
```

## Step 11: Calculate overall grades

Apply dimension weights and compute letter grade per play.

```bash
node -e "
  const w = {manifest:.20, devkit:.15, tunekit:.15, infra:.10, docs:.15, tests:.10, deps:.05, security:.10};
  // Read dimension scores from previous steps
  // weighted = sum(score[dim] * w[dim])
  // grade = weighted >= 90 ? 'A' : >= 80 ? 'B' : >= 70 ? 'C' : >= 60 ? 'D' : 'F'
"
```

## Step 12: Check marketplace plugin coverage

```bash
for PLAY_DIR in $PLAYS; do
  SLUG=$(basename "$PLAY_DIR")
  MATCH=$(grep -rl "\"$SLUG\"" plugins/*/plugin.json 2>/dev/null | head -1)
  [ -n "$MATCH" ] && echo "PLUGIN_OK|$SLUG" || echo "PLUGIN_MISSING|$SLUG"
done
```

## Step 13: Generate quality report

```markdown
# 🍊 FAI Play Quality Report — [Date]

## Summary
- **Total plays:** X | **A:** N | **B:** N | **C:** N | **D:** N | **F:** N
- **Average score:** XX.X/100

## Scorecard
| # | Play | Manif. | DevKit | Tune | Infra | Docs | Tests | Deps | Sec. | Score | Grade |
|---|------|--------|--------|------|-------|------|-------|------|------|-------|-------|
| 01 | Enterprise RAG | 100 | 90 | 85 | 80 | 95 | 70 | 100 | 100 | 91.5 | A |
| 02 | Landing Zone | 90 | 70 | 60 | 100 | 80 | 50 | 80 | 95 | 78.5 | C |

## Manifest Validation
| Play | Score | Missing Fields |
|------|-------|---------------|
| 01 | 100 | — |
| 15 | 30 | guardrails, hooks, safety threshold |

## DevKit Coverage
| Play | Agents | Instructions | .github/ | Score |
|------|--------|-------------|----------|-------|

## TuneKit Readiness
| Play | Config | Eval Data | Guardrails | Score |
|------|--------|-----------|------------|-------|

## Marketplace Coverage
| Play | Plugin | Name |
|------|--------|------|

## Top 3 Action Items
1. **Play NN:** [Most impactful improvement] (+XX boost)
2. **Play NN:** [Second priority]
3. **Play NN:** [Third priority]

_Automated by FAI Play Quality Report Workflow_
```

## Error handling

- Empty play directory or `.gitkeep` only: score 0 across all dimensions
- Invalid `fai-manifest.json`: log parse error, score manifest as 0
- File stat failures: skip check and note
- Report >65000 chars: truncate tables, link to gist
- Previous comparison skipped if no prior quality issue exists
- Always generate report even if some plays fail to scan