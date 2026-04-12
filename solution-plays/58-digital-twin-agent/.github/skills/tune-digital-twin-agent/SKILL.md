---
name: "tune-digital-twin-agent"
description: "Tune Digital Twin Agent — NL query schema injection, RUL model features, sensor refresh rate, telemetry retention, twin lifecycle, cost optimization."
---

# Tune Digital Twin Agent

## Prerequisites

- Deployed digital twin with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune NL→DTDL Queries

```json
// config/openai.json
{
  "nl_query": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 500,
    "include_schema_in_prompt": true,
    "schema_detail_level": "properties+relationships",
    "few_shot_examples": 3
  },
  "prediction_explanation": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 500
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `include_schema_in_prompt` | true | MUST be true — LLM needs schema for correct property names |
| `schema_detail_level` | properties+relationships | "full" includes telemetry defs, costs more tokens |
| `few_shot_examples` | 3 | More examples = better accuracy, more tokens |
| Prediction `model` | gpt-4o-mini | Good enough for explanations, save cost |

### Query Accuracy Tuning
| Symptom | Adjustment |
|---------|------------|
| Wrong property names | Ensure schema is in prompt with exact DTDL names |
| Can't traverse relationships | Add relationship examples to few-shot |
| Numeric filter errors | Add comparison examples (>, <, BETWEEN) |
| Aggregation failures | Add GROUP BY examples |

## Step 2: Tune Predictive Maintenance

```json
// config/guardrails.json
{
  "predictive_maintenance": {
    "telemetry_lookback_days": 30,
    "features": ["temperature_mean", "temperature_std", "vibration_peak", "power_trend", "run_hours"],
    "rul_critical_threshold_days": 7,
    "rul_warning_threshold_days": 30,
    "prediction_frequency": "daily",
    "model_retrain_frequency": "monthly",
    "confidence_threshold": 0.75
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `telemetry_lookback_days` | 30 | More data = better prediction, more compute |
| `rul_critical_threshold_days` | 7 | Lower = fewer false urgent alerts |
| `prediction_frequency` | daily | More frequent = earlier detection, higher cost |
| `confidence_threshold` | 0.75 | Higher = fewer predictions, more accurate |
| Feature list | 5 features | Add domain-specific (oil pressure, cycle count) |

## Step 3: Tune Sensor Configuration

```json
// config/agents.json
{
  "iot_ingestion": {
    "telemetry_interval_seconds": 30,
    "batch_size": 100,
    "event_driven_updates": true,
    "threshold_alerts": {
      "temperature": { "warning": 75, "critical": 90 },
      "vibration": { "warning": 5.0, "critical": 8.0 },
      "power": { "warning_deviation": 0.20 }
    }
  },
  "telemetry_archive": {
    "destination": "adx",
    "retention_days": 365,
    "hot_cache_days": 30,
    "compression": true
  },
  "twin_lifecycle": {
    "statuses": ["active", "maintenance", "decommissioned"],
    "auto_decommission_after_days": 90,
    "alert_on_status_change": true
  }
}
```

Sensor tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `telemetry_interval_seconds` | 30 | Lower = more granular, more IoT Hub messages |
| `event_driven_updates` | true | false = poll-based (higher latency) |
| Threshold alerts | Configurable | Adjust per machine type |
| `retention_days` | 365 | Longer = more training data, more storage |
| `hot_cache_days` | 30 | More = faster queries, more ADX cost |

## Step 4: Cost Optimization

```python
# Digital Twin Agent cost breakdown:
# - Azure Digital Twins: ~$0.001 per operation = ~$30/month (1M ops)
# - IoT Hub S1: ~$25/month (400K messages/day)
# - ADX Dev cluster: ~$150/month (telemetry archive)
# - Azure Functions (IoT→Twins): ~$5/month
# - OpenAI (NL queries + predictions): ~$10/month
# - Container Apps: ~$30/month
# - Total: ~$250/month for 100-device factory

# Cost reduction:
# 1. ADX Dev tier (no SLA) for dev/test = $150 saved
# 2. Longer telemetry intervals (60s vs 30s) = 50% IoT cost
# 3. gpt-4o-mini for explanations = 90% LLM savings
# 4. Compress telemetry in ADX = 60% storage savings
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| ADX Dev tier | ~$150/month | No SLA |
| 60s telemetry interval | ~50% IoT cost | Less granular data |
| gpt-4o-mini for explanations | ~90% LLM cost | Simpler explanations |
| ADX compression | ~60% storage | Slightly slower queries |
| Weekly predictions (not daily) | ~85% prediction cost | Later detection |

## Step 5: Verify Tuning Impact

```bash
python evaluation/eval_queries.py --test-data evaluation/data/queries/
python evaluation/eval_rul.py --test-data evaluation/data/maintenance/
python evaluation/eval_sync.py

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| NL query accuracy | baseline | +10-15% | > 85% |
| RUL MAE | baseline | -2-3 days | < 5 days |
| Sync latency | baseline | -30% | < 5s |
| Monthly cost | ~$250 | ~$120-150 | < $300 |
