---
name: fai-evaluation-regression
description: "Weekly evaluation regression detection — compares play eval scores against baselines, flags quality degradation across groundedness, coherence, relevance, safety, and cost metrics, applies statistical significance testing, and blocks releases on critical regressions."
on:
  schedule:
    - cron: "0 11 * * 1"
  workflow_dispatch:
    inputs:
      play_number:
        description: "Specific play to evaluate (e.g., 01). Leave empty for all."
        type: string
        required: false
      threshold_delta:
        description: "Minimum score drop to flag as regression (0.0-1.0)"
        type: string
        required: false
        default: "0.05"
      baseline_window:
        description: "Number of previous evaluations for moving average"
        type: string
        required: false
        default: "4"
permissions:
  contents: read
  issues: write
engine: copilot
tools:
  bash: true
safe-outputs:
  create-issue:
    max: 1
    title-prefix: "[FAI Eval Regression] "
    labels: ["evaluation", "quality", "automated"]
    close-older-issues: true
timeout-minutes: 30
---

## Step 1: Configure parameters

```bash
PLAY_FILTER="${{ inputs.play_number }}"
DELTA="${{ inputs.threshold_delta || '0.05' }}"
WINDOW="${{ inputs.baseline_window || '4' }}"
REPORT_DATE=$(date +%Y-%m-%d)
```

**Tracked metrics:**

| Metric | Default Threshold | Action | Description |
|--------|------------------|--------|-------------|
| `groundedness` | 0.80 | block | Factual accuracy against sources |
| `coherence` | 0.70 | warn | Logical consistency and flow |
| `relevance` | 0.75 | warn | Answer pertinence to query |
| `fluency` | 0.70 | warn | Language quality |
| `safety` | 0.90 | block | Harmful content detection |
| `cost_per_request` | $0.05 | warn | Average token cost |

## Step 2: Enumerate target plays

```bash
if [ -n "$PLAY_FILTER" ]; then
  PLAYS=$(ls -d solution-plays/${PLAY_FILTER}-* 2>/dev/null)
  [ -z "$PLAYS" ] && echo "ERROR: No play '$PLAY_FILTER'" && exit 1
else
  PLAYS=$(ls -d solution-plays/[0-9][0-9]-*/ 2>/dev/null)
fi
PLAY_COUNT=$(echo "$PLAYS" | wc -l)
echo "Evaluating $PLAY_COUNT plays"
```

## Step 3: Extract guardrail baselines

Read `fai-manifest.json` per play and extract `primitives.guardrails` thresholds.

```bash
for PLAY_DIR in $PLAYS; do
  MANIFEST="$PLAY_DIR/fai-manifest.json"
  [ ! -f "$MANIFEST" ] && echo "SKIP|$(basename $PLAY_DIR)|No manifest" && continue
  node -e "
    const m = require('./$MANIFEST');
    const g = m.primitives?.guardrails || {};
    Object.entries(g).forEach(([k, v]) => {
      const t = typeof v === 'object' ? v.threshold : v;
      const a = typeof v === 'object' ? v.action : 'warn';
      console.log('BASELINE|$(basename $PLAY_DIR)|' + k + '|' + t + '|' + a);
    });
  "
done
```

## Step 4: Locate evaluation results

Search for result files per play in priority order.

```bash
for PLAY_DIR in $PLAYS; do
  SLUG=$(basename "$PLAY_DIR")
  RESULTS=""
  for F in "$PLAY_DIR"/config/evaluation-results-*.json; do [ -f "$F" ] && RESULTS="$RESULTS $F"; done
  [ -f "$PLAY_DIR/config/evaluation-results.json" ] && RESULTS="$RESULTS $PLAY_DIR/config/evaluation-results.json"
  [ -f "$PLAY_DIR/config/last-eval.json" ] && RESULTS="$RESULTS $PLAY_DIR/config/last-eval.json"
  for F in "$PLAY_DIR"/*.eval.json; do [ -f "$F" ] && RESULTS="$RESULTS $F"; done
  [ -z "$RESULTS" ] && echo "NO_DATA|$SLUG" || echo "FOUND|$SLUG|$(echo $RESULTS | wc -w) files"
done
```

## Step 5: Parse evaluation scores

Extract metric scores from the most recent result file per play.

```bash
for PLAY_DIR in $PLAYS; do
  SLUG=$(basename "$PLAY_DIR")
  LATEST=$(ls -t "$PLAY_DIR"/config/evaluation-results*.json 2>/dev/null | head -1)
  [ -z "$LATEST" ] && continue
  node -e "
    const r = require('./$LATEST');
    const scores = r.scores || r.metrics || r;
    Object.entries(scores).forEach(([m, v]) => {
      const val = typeof v === 'object' ? v.score || v.value : v;
      if (typeof val === 'number') console.log('SCORE|$SLUG|' + m + '|' + val.toFixed(4));
    });
  "
done
```

## Step 6: Compare scores against thresholds

| Condition | Status | Action |
|-----------|--------|--------|
| `actual >= threshold` | 🟢 Pass | None |
| `actual < threshold` AND `action=warn` | 🟡 Below | Warning |
| `actual < threshold` AND `action=block` | 🔴 REGRESSION | Block release |
| `actual < (threshold - delta)` | 🔴 CRITICAL | Immediate fix |

For each play-metric pair, compute the delta and classify.

## Step 7: Detect trend regressions

For plays with multiple historical result files, compute moving averages over the baseline window.

```bash
for PLAY_DIR in $PLAYS; do
  SLUG=$(basename "$PLAY_DIR")
  FILES=$(ls -t "$PLAY_DIR"/config/evaluation-results*.json 2>/dev/null | head -$WINDOW)
  COUNT=$(echo "$FILES" | grep -c '.' || echo 0)
  [ "$COUNT" -lt 2 ] && echo "TREND_SKIP|$SLUG|<2 data points" && continue
  node -e "
    const fs = require('fs');
    const files = '$FILES'.trim().split('\n');
    const history = {};
    files.forEach(f => {
      const s = JSON.parse(fs.readFileSync(f, 'utf8')).scores || {};
      Object.entries(s).forEach(([m, v]) => {
        const val = typeof v === 'object' ? v.score : v;
        if (typeof val === 'number') { history[m] = history[m] || []; history[m].push(val); }
      });
    });
    Object.entries(history).forEach(([m, vals]) => {
      if (vals.length < 2) return;
      let drops = 0;
      for (let i = 1; i < vals.length; i++) { if (vals[i] < vals[i-1]) drops++; else break; }
      const avg = vals.reduce((a,b) => a+b, 0) / vals.length;
      const trend = drops >= 2 ? '↘️ Declining' : vals[0] > avg ? '↗️ Improving' : '→ Stable';
      console.log('TREND|$SLUG|' + m + '|' + trend + '|drops=' + drops);
    });
  "
done
```

**Trend classification:** ↗️ latest > avg = Improving; → within ±0.02 = Stable; ↘️ 2+ drops = Declining; ⬇️ 3+ drops AND below threshold = Critical.

## Step 8: Statistical significance testing

For metrics with ≥4 data points, apply a z-test (95% confidence, |z| > 1.96).

```bash
node -e "
  function zTest(values) {
    if (values.length < 4) return { significant: false };
    const latest = values[0], rest = values.slice(1);
    const mean = rest.reduce((a,b) => a+b, 0) / rest.length;
    const variance = rest.reduce((a,b) => a + (b - mean) ** 2, 0) / rest.length;
    const stddev = Math.sqrt(variance);
    if (stddev === 0) return { significant: false, z: 0 };
    const z = (latest - mean) / stddev;
    return { significant: Math.abs(z) > 1.96, z: z.toFixed(3), mean: mean.toFixed(4) };
  }
  console.log('z-test applied to metrics with 4+ historical points');
"
```

Flag statistically significant drops as `⚠️ p<0.05` in the report.

## Step 9: Cross-play comparison leaderboard

Rank plays by each metric to surface top performers and laggards.

```bash
node -e "
  const metrics = ['groundedness', 'coherence', 'relevance', 'safety'];
  // Aggregate scores from Step 5 output, rank per metric
  metrics.forEach(m => {
    console.log('LEADERBOARD|' + m);
    // Sort plays by score descending, assign medals
  });
"
```

Identify plays >1 standard deviation below the cross-play average as "Needs Attention."

## Step 10: CI/CD integration check

| Check | Expected | Purpose |
|-------|----------|---------|
| `evaluation-config.json` exists | Required | Automated eval pipeline |
| Config has `dataset` path | Required | Eval dataset defined |
| Config has `metrics[]` | Required | Which metrics to evaluate |
| Baseline file exists | Recommended | Regression comparison |
| Results <7 days old | Recommended | Fresh data |

## Step 11: Baseline management

If no regression detected and scores improved, mark baseline for update.

```json
{
  "play": "01-enterprise-rag",
  "updated": "2026-04-06",
  "window": 4,
  "metrics": {
    "groundedness": { "mean": 0.87, "stddev": 0.03, "min": 0.82, "max": 0.91 },
    "coherence": { "mean": 0.78, "stddev": 0.05, "min": 0.72, "max": 0.85 }
  }
}
```

Baselines are committed separately — this workflow does not auto-commit.

## Step 12: Generate regression report

```markdown
# 🍊 FAI Evaluation Regression Report — [Date]

## Summary
- **Plays evaluated:** X / Y total
- **Plays with eval data:** Z
- **Regressions detected:** W (X critical, Y warnings)
- **Trend alerts:** M declining metrics

## Regression Alerts 🔴
| Play | Metric | Threshold | Actual | Delta | Trend | Sig. |
|------|--------|-----------|--------|-------|-------|------|
| 01 | Coherence | 0.70 | 0.65 | -0.05 | ↘️ | p<0.05 |

## Quality Leaderboard 🏆
| Rank | Play | Ground. | Coher. | Relev. | Safety | Avg |
|------|------|---------|--------|--------|--------|-----|
| 🥇 | Play 03 | 0.95 | 0.92 | 0.94 | 0.98 | 0.95 |
| 🥈 | Play 01 | 0.90 | 0.85 | 0.88 | 0.95 | 0.90 |

## Trend Analysis
| Play | Metric | Direction | Drops | Moving Avg |
|------|--------|-----------|-------|-----------|
| 01 | groundedness | ↗️ | +3 | 0.88 |
| 07 | coherence | ↘️ | -2 | 0.74 |

## Plays Without Evaluation Data ⚠️
| Play | Missing | Recommendation |
|------|---------|---------------|
| 15 | evaluation-config.json | Create eval config |

## CI/CD Readiness
| Play | Config | Dataset | Baseline | Fresh | Ready |
|------|--------|---------|----------|-------|-------|
| 01 | ✅ | ✅ | ✅ | 3d | ✅ |
| 02 | ✅ | ✅ | ❌ | 12d | ⚠️ |

## Recommendations
1. Fix 🔴 regressions before next release
2. Set up eval pipelines for uncovered plays
3. Update baselines for consistently improving plays
4. Investigate declining trends even if above threshold
```

## Error handling

- Invalid `fai-manifest.json`: skip play, log parse error
- Unexpected eval schema: extract what's possible, flag unknown fields
- No plays with data: generate report with "no data" section
- Date parse failures: fall back to file modification time
- Report capped at 65000 chars for GitHub issue body limit