---
name: fai-tune-15-multi-modal-docproc
description: "Tune Play 15 multi-modal document processing with OCR, vision model selection, extraction confidence, and fallback routing."
---

# FAI Tune - Play 15: Multi-Modal Document Processing

## TuneKit Config Layout

solution-plays/15-multi-modal-docproc/config/
├── ocr.json
├── vision.json
├── extraction.json
└── guardrails.json

## Step 1 - Validate Core Configuration

```json
// config/vision.json
{
  "primary_model": "gpt-4o",
  "fallback_model": "gpt-4o-mini",
  "max_pages": 40,
  "image_preprocessing": {
    "deskew": true,
    "denoise": true,
    "dpi_min": 150
  },
  "extraction": {
    "confidence_threshold": 0.82,
    "human_review_threshold": 0.70
  }
}
```

## Step 2 - Tune Critical Parameters

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `confidence_threshold` | 0.60-0.95 | 0.82 | Increase to reduce false positives. |
| `max_pages` | 1-200 | 40 | Lower for latency and cost. |
| `dpi_min` | 100-300 | 150 | Higher improves OCR quality. |
| `fallback_model` | gpt-4o-mini,gpt-4.1-mini | gpt-4o-mini | Choose lowest cost that passes quality. |

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
| Confidence threshold | 0.60-0.95 | `jq '.extraction.confidence_threshold' config/vision.json` |
| Human review threshold | < confidence threshold | `jq '.extraction.human_review_threshold' config/vision.json` |
| Max pages cap | <= 200 | `jq '.max_pages' config/vision.json` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Missing fields in output | Threshold too high | Reduce confidence_threshold by 0.05 and re-evaluate. |
| High latency | Large documents and no fallback | Lower max_pages and enable lighter fallback model. |
| High cost | All requests using premium model | Route low-complexity docs to fallback model. |

## Rollback Plan

1. Restore previous config from git tag.
2. Revert model or routing changes first.
3. Re-run evaluation gate on rollback commit.
4. Promote rollback only if safety and quality gates pass.
