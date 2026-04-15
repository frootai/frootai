---
name: fai-tune-17-ai-observability
description: "Tune Play 17 observability settings for traces, semantic metrics, alert thresholds, and log retention policy."
---

# FAI Tune - Play 17: AI Observability

## TuneKit Config Layout

solution-plays/17-ai-observability/config/
├── tracing.json
├── metrics.json
├── alerts.json
└── retention.json

## Step 1 - Validate Core Configuration

```json
// config/metrics.json
{
  "sampling_rate": 1.0,
  "capture_prompt": true,
  "capture_completion": true,
  "redact_pii": true,
  "slo": {
    "latency_p95_ms": 1800,
    "error_rate_max": 0.02,
    "groundedness_min": 0.80
  }
}
```

## Step 2 - Tune Critical Parameters

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `sampling_rate` | 0.01-1.0 | 1.0 | Reduce in prod for cost if volume is high. |
| `latency_p95_ms` | 200-5000 | 1800 | Set per endpoint class. |
| `error_rate_max` | 0.001-0.10 | 0.02 | Alert above this threshold. |
| `groundedness_min` | 0.60-0.95 | 0.80 | Raise for regulated workloads. |

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
| PII redaction | true | `jq '.redact_pii' config/metrics.json` |
| P95 latency objective | <= 5000 | `jq '.slo.latency_p95_ms' config/metrics.json` |
| Error rate objective | <= 0.10 | `jq '.slo.error_rate_max' config/metrics.json` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No traces in dashboard | Sampling disabled or exporter misconfigured | Set sampling_rate > 0 and verify exporter endpoint. |
| Alert fatigue | Threshold too strict | Tune error_rate_max and add debounce windows. |
| Compliance risk in logs | PII redaction disabled | Set redact_pii true and re-run log scan. |

## Rollback Plan

1. Restore previous config from git tag.
2. Revert model or routing changes first.
3. Re-run evaluation gate on rollback commit.
4. Promote rollback only if safety and quality gates pass.
