---
name: "tune-fraud-detection-agent"
description: "Tune Fraud Detection Agent — rule thresholds, ML model calibration, graph analysis depth, velocity windows, explanation format, feedback loop retrain schedule, cost."
---

# Tune Fraud Detection Agent

## Prerequisites

- Deployed fraud detection with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Rule Engine

```json
// config/guardrails.json
{
  "rules": {
    "velocity_max_1min": 5,
    "velocity_max_1hr": 20,
    "amount_multiplier": 3.0,
    "new_device_limit": 500,
    "geo_impossible_min_hours": 2,
    "high_risk_merchants": ["crypto_exchange", "gambling", "wire_transfer"],
    "blocked_countries": []
  },
  "thresholds": {
    "block": 0.90,
    "review": 0.70,
    "allow": 0.30,
    "per_type": {
      "card_present": { "block": 0.95, "review": 0.80 },
      "card_not_present": { "block": 0.85, "review": 0.65 },
      "wire_transfer": { "block": 0.80, "review": 0.60 }
    }
  }
}
```

Rule tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `velocity_max_1min` | 5 | Lower = catches burst fraud, more FP |
| `amount_multiplier` | 3.0 | Lower = catches smaller anomalies |
| `new_device_limit` | $500 | Lower = more blocks on new devices |
| Per-type thresholds | Vary | Wire transfers need lower (riskier) |

### Threshold Tuning Guide
| Symptom | Adjustment |
|---------|------------|
| Too many false positives (>1%) | Raise block threshold to 0.95 |
| Fraud getting through (<95% recall) | Lower review threshold to 0.60 |
| Wire fraud missed | Lower wire_transfer.block to 0.75 |
| Alert fatigue | Raise review threshold, enable auto-resolve for low-risk |

## Step 2: Tune ML Model

```json
// config/agents.json
{
  "ml_model": {
    "model_path": "models/fraud-detector-v3.pkl",
    "feature_set": ["amount", "velocity_1min", "velocity_1hr", "time_of_day", "merchant_risk", "device_age", "distance_from_home", "avg_amount_ratio"],
    "retrain_schedule": "weekly",
    "retrain_min_feedback": 100,
    "class_weight": "balanced",
    "oversampling": "smote"
  },
  "graph_analysis": {
    "enabled": true,
    "trigger_threshold": 0.5,
    "max_hops": 5,
    "ring_detection": true,
    "mule_detection": true,
    "coordinated_window_minutes": 30
  }
}
```

ML tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `class_weight` | balanced | Handles imbalanced fraud/legit ratio |
| `oversampling` | SMOTE | Generates synthetic fraud examples |
| `retrain_schedule` | weekly | More frequent = adapts to new patterns |
| `trigger_threshold` | 0.5 | Lower = more transactions get graph analysis |
| `max_hops` | 5 | Higher = deeper ring detection, slower |

## Step 3: Tune Graph Analysis

```json
// config/agents.json
{
  "graph_analysis": {
    "ring_min_nodes": 3,
    "mule_indicators": {
      "min_incoming_count_24h": 5,
      "max_hold_time_hours": 2,
      "withdrawal_ratio": 0.9
    },
    "coordinated_attack": {
      "min_senders": 3,
      "window_minutes": 30,
      "amount_variance_max": 0.2
    }
  }
}
```

Graph tuning:
| Pattern | Parameter | Default | Impact |
|---------|-----------|---------|--------|
| Ring | `min_nodes` | 3 | Lower = catch smaller rings |
| Mule | `min_incoming_count_24h` | 5 | Lower = more mule alerts |
| Mule | `max_hold_time_hours` | 2 | Higher = catch slower mules |
| Coordinated | `min_senders` | 3 | Lower = more coordinated alerts |

## Step 4: Tune Explanations

```json
// config/openai.json
{
  "explanation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 300,
    "format": "factors_list",
    "include_regulatory_notice": true,
    "regulatory_framework": "PSD2"
  }
}
```

## Step 5: Cost Optimization

```python
# Fraud detection cost breakdown:
# - Rule engine: $0 (local compute)
# - ML model: $0 (local inference)
# - Graph analysis (5-10% of txns): ~$0.001/query (Cosmos DB RU)
# - LLM explanation (only blocks+reviews): ~$0.001/explanation
# - Event Hubs: ~$22/month (1 TU)
# - Container Apps (2 replicas): ~$60/month
# - Cosmos DB (graph + audit): ~$25/month
# - Total: ~$110/month for 1M transactions/day

# Cost reduction:
# 1. Rule + ML handle 90% (free) — graph only for uncertain
# 2. gpt-4o-mini for explanations (already done)
# 3. Reduce graph trigger threshold (fewer graph queries)
# 4. Cosmos DB autoscale (lower RU during off-peak)
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| Graph only for ML score >0.5 | ~50% graph cost | Miss some network fraud |
| gpt-4o-mini explanations | ~90% LLM cost | Simpler explanations |
| Cosmos autoscale | ~40% DB cost | Variable throughput |
| Batch feedback processing | ~30% | Delayed retraining |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_detection.py --test-data evaluation/data/transactions/
python evaluation/eval_latency.py --endpoint $DETECTION_ENDPOINT
python evaluation/eval_graph.py --test-data evaluation/data/networks/
python evaluation/eval_explanations.py --test-data evaluation/data/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Recall | baseline | +2-5% | > 95% |
| False positive rate | baseline | -0.5-1% | < 1% |
| E2E latency | baseline | -20% | < 100ms |
| Ring detection | baseline | +5-10% | > 90% |
| Monthly cost | ~$110 | ~$70-90 | < $150 |
