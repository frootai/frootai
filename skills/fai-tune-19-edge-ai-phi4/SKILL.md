---
name: fai-tune-19-edge-ai-phi4
description: "Tune Play 19 edge deployment for Phi-4 with quantization, device constraints, and offline fallback behavior."
---

# FAI Tune - Play 19: Edge AI Phi-4

## TuneKit Config Layout

solution-plays/19-edge-ai-phi4/config/
├── model.json
├── runtime.json
├── device.json
└── offline.json

## Step 1 - Validate Core Configuration

```json
// config/model.json
{
  "model_id": "phi-4-mini-instruct",
  "quantization": "int4",
  "context_length": 4096,
  "max_new_tokens": 512,
  "target_runtime": "onnxruntime",
  "cpu_threads": 4,
  "memory_budget_mb": 2048
}
```

## Step 2 - Tune Critical Parameters

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `quantization` | fp16,int8,int4 | int4 | Int4 for smallest footprint. |
| `context_length` | 512-8192 | 4096 | Reduce for low-memory devices. |
| `cpu_threads` | 1-16 | 4 | Tune for battery and latency. |
| `memory_budget_mb` | 512-8192 | 2048 | Hard cap to avoid OOM. |

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
| Quantization mode | int4 or int8 for edge | `jq '.quantization' config/model.json` |
| Memory budget | <= device RAM budget | `jq '.memory_budget_mb' config/model.json` |
| Offline mode | enabled | `jq '.offline_enabled' config/offline.json` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| OOM on startup | Model too large for device | Use int4 and lower context_length. |
| Slow inference | Threading mismatch | Tune cpu_threads and disable background jobs. |
| No response when offline | Fallback disabled | Enable offline.json fallback templates. |

## Rollback Plan

1. Restore previous config from git tag.
2. Revert model or routing changes first.
3. Re-run evaluation gate on rollback commit.
4. Promote rollback only if safety and quality gates pass.
