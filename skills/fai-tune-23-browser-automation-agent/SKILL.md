---
name: fai-tune-23-browser-automation-agent
description: "Tune Play 23 browser automation with selector strategy, retry policy, anti-flake waits, and safety restrictions."
---

# FAI Tune - Play 23: Browser Automation Agent

## TuneKit Config Layout

solution-plays/23-browser-automation-agent/config/
├── selectors.json
├── retries.json
├── waits.json
└── safety.json

## Step 1 - Validate Core Configuration

```json
// config/retries.json
{
  "max_action_retries": 3,
  "retry_backoff_ms": [200, 600, 1200],
  "navigation_timeout_ms": 20000,
  "element_timeout_ms": 8000,
  "screenshot_on_failure": true,
  "abort_on_dialog": false
}
```

## Step 2 - Tune Critical Parameters

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `max_action_retries` | 0-10 | 3 | Increase for unstable pages only. |
| `navigation_timeout_ms` | 1000-120000 | 20000 | Tune per site/network. |
| `element_timeout_ms` | 500-60000 | 8000 | Avoid flaky tests from short waits. |
| `strict_selectors` | true,false | true | Prefer role/testid over CSS chains. |

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
| Retry count | 0-10 | `jq '.max_action_retries' config/retries.json` |
| Failure screenshots | true | `jq '.screenshot_on_failure' config/retries.json` |
| Timeout sanity | element < navigation | `jq '.element_timeout_ms < .navigation_timeout_ms' config/retries.json` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Frequent flaky failures | Insufficient waits/selectors | Use role/testid selectors and increase element timeout. |
| Runs too slow | Overly defensive waits | Lower timeout and remove unnecessary retries. |
| Unsafe actions executed | Safety policy missing | Add denylist in safety.json for destructive actions. |

## Rollback Plan

1. Restore previous config from git tag.
2. Revert model or routing changes first.
3. Re-run evaluation gate on rollback commit.
4. Promote rollback only if safety and quality gates pass.
