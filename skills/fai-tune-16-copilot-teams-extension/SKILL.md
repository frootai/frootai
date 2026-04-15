---
name: fai-tune-16-copilot-teams-extension
description: "Tune Play 16 Teams extension behavior with command routing, intent matching, adaptive card payloads, and auth flow."
---

# FAI Tune - Play 16: Copilot Teams Extension

## TuneKit Config Layout

solution-plays/16-copilot-teams-extension/config/
├── intents.json
├── commands.json
├── cards.json
└── auth.json

## Step 1 - Validate Core Configuration

```json
// config/intents.json
{
  "intent_threshold": 0.78,
  "max_candidates": 4,
  "fallback_intent": "help",
  "command_timeout_ms": 6000,
  "adaptive_card": {
    "max_actions": 5,
    "truncate_text_at": 1400
  }
}
```

## Step 2 - Tune Critical Parameters

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `intent_threshold` | 0.60-0.95 | 0.78 | Lower improves recall, may reduce precision. |
| `max_candidates` | 1-10 | 4 | More candidates may improve hit rate. |
| `command_timeout_ms` | 1000-15000 | 6000 | Set by downstream SLA. |
| `max_actions` | 1-10 | 5 | Too many actions hurts usability. |

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
| Intent threshold | 0.60-0.95 | `jq '.intent_threshold' config/intents.json` |
| Adaptive card actions | <= 5 recommended | `jq '.adaptive_card.max_actions' config/intents.json` |
| Timeout | <= 15000ms | `jq '.command_timeout_ms' config/intents.json` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Wrong command triggered | Threshold too low | Increase intent_threshold by 0.03. |
| Card rendering errors | Payload too large | Reduce truncate_text_at and optional fields. |
| Auth failures | Token expiry/claims mismatch | Validate auth.json and token refresh flow. |

## Rollback Plan

1. Restore previous config from git tag.
2. Revert model or routing changes first.
3. Re-run evaluation gate on rollback commit.
4. Promote rollback only if safety and quality gates pass.
