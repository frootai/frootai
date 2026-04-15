---
name: fai-tune-18-prompt-management
description: "Tune Play 18 prompt management with version gates, A/B split, rollback policy, and template lint checks."
---

# FAI Tune - Play 18: Prompt Management

## TuneKit Config Layout

solution-plays/18-prompt-management/config/
├── prompts.json
├── experiments.json
├── safety.json
└── rollout.json

## Step 1 - Validate Core Configuration

```json
// config/experiments.json
{
  "active_prompt": "v12",
  "ab_test": {
    "enabled": true,
    "variant_a": "v12",
    "variant_b": "v13",
    "traffic_split": [50, 50],
    "min_sample": 200
  },
  "promotion_rule": {
    "metric": "task_success",
    "delta_min": 0.03
  }
}
```

## Step 2 - Tune Critical Parameters

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `traffic_split` | sum=100 | [50,50] | Use 90/10 for safer rollout. |
| `min_sample` | 50-5000 | 200 | Increase for low-variance confidence. |
| `delta_min` | 0.01-0.20 | 0.03 | Required improvement to promote variant. |
| `rollback_window_h` | 1-168 | 24 | Auto-revert if quality drops. |

## Step 3 - Add Evaluation Gates

```json
{
  "evaluation": {
    "enabled": true,
    "dataset": "evaluation/test-cases.jsonl",
    "sample_size": 200,
    "gates": {
      "quality_min": 0.80,
      "safety_min": 0.90,
      "latency_p95_ms_max": 2000
    }
  }
}
```

```python
import json

def validate_gate(metrics, gates):
    failures = []
    if metrics.get("quality", 0) < gates["quality_min"]:
        failures.append("quality")
    if metrics.get("safety", 0) < gates["safety_min"]:
        failures.append("safety")
    if metrics.get("latency_p95_ms", 999999) > gates["latency_p95_ms_max"]:
        failures.append("latency")
    if failures:
        raise SystemExit(f"Gate failed: {', '.join(failures)}")
    print("PASS: all gates met")
```

## Step 4 - Add Cost Controls

```json
{
  "cost_controls": {
    "daily_budget_usd": 500,
    "monthly_budget_usd": 10000,
    "alert_thresholds": [50, 75, 90],
    "throttle_on_budget_breach": true
  }
}
```

## Validation Checklist

| Check | Expected | Command |
|-------|----------|---------|
| A/B enabled | true or false by plan | `jq '.ab_test.enabled' config/experiments.json` |
| Traffic split sum | 100 | `jq '.ab_test.traffic_split | add' config/experiments.json` |
| Promotion delta | >= 0.01 | `jq '.promotion_rule.delta_min' config/experiments.json` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No significant winner | Sample size too small | Increase min_sample and run longer. |
| Quality regression after promotion | Gate too weak | Raise delta_min and add groundedness gate. |
| Inconsistent outputs | Prompt templates not pinned | Pin version and lock template variables. |

## Rollback Plan

1. Restore previous config from git tag.
2. Revert model or routing changes first.
3. Re-run evaluation gate on rollback commit.
4. Promote rollback only if safety and quality gates pass.
