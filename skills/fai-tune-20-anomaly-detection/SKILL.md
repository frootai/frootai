---
name: fai-tune-20-anomaly-detection
description: "Tune Play 20 anomaly detection with window sizing, seasonality handling, threshold calibration, and alert suppression."
---

# FAI Tune - Play 20: Anomaly Detection

## TuneKit Config Layout

solution-plays/20-anomaly-detection/config/
├── detector.json
├── windows.json
├── thresholds.json
└── alerts.json

## Step 1 - Validate Core Configuration

```json
// config/detector.json
{
  "algorithm": "spectral_residual",
  "sensitivity": 0.85,
  "lookback_window": 288,
  "seasonality": "daily",
  "min_anomaly_duration": 3,
  "cooldown_minutes": 15
}
```

## Step 2 - Tune Critical Parameters

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `sensitivity` | 0.50-0.99 | 0.85 | Lower to reduce false positives. |
| `lookback_window` | 24-10000 | 288 | Must cover seasonal pattern. |
| `min_anomaly_duration` | 1-60 | 3 | Suppress spikes/noise. |
| `cooldown_minutes` | 0-240 | 15 | Avoid repeated alerts for same event. |

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
| Sensitivity | 0.50-0.99 | `jq '.sensitivity' config/detector.json` |
| Lookback window | >= one season | `jq '.lookback_window' config/detector.json` |
| Cooldown set | >= 5 minutes recommended | `jq '.cooldown_minutes' config/detector.json` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Too many alerts | Sensitivity too high | Reduce sensitivity and increase min_anomaly_duration. |
| Missed incidents | Threshold too strict | Increase sensitivity by 0.03 and re-test. |
| Duplicate notifications | No cooldown | Set cooldown_minutes to 15-30. |

## Rollback Plan

1. Restore previous config from git tag.
2. Revert model or routing changes first.
3. Re-run evaluation gate on rollback commit.
4. Promote rollback only if safety and quality gates pass.
