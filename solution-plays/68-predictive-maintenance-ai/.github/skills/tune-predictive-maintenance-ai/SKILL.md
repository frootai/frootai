---
name: "tune-predictive-maintenance-ai"
description: "Tune Predictive Maintenance AI — RUL thresholds, feature selection, sensor sampling, model retrain frequency, alert aggregation, cost of downtime vs maintenance."
---

# Tune Predictive Maintenance AI

## Prerequisites

- Deployed maintenance AI with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune RUL Thresholds

```json
// config/guardrails.json
{
  "rul_thresholds": {
    "urgent": 7,
    "planned": 30,
    "monitor": 90,
    "per_equipment": {
      "pump": { "urgent": 5, "planned": 21 },
      "compressor": { "urgent": 7, "planned": 30 },
      "motor": { "urgent": 7, "planned": 28 }
    }
  },
  "alerts": {
    "urgent_channels": ["pagerduty", "teams", "email"],
    "planned_channels": ["teams", "email"],
    "aggregate_window_hours": 4,
    "max_alerts_per_day": 10
  },
  "confidence": {
    "min_for_action": 0.7,
    "flag_low_confidence": true
  }
}
```

Threshold tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `urgent` | 7 days | Lower = fewer urgent alerts, risk late |
| `planned` | 30 days | Higher = more lead time for parts |
| `min_for_action` | 0.7 | Lower = more alerts, higher coverage |
| `aggregate_window_hours` | 4 | Higher = fewer alerts, batch notifications |
| Per-equipment thresholds | Vary | Critical equipment gets lower (more urgent) |

### Threshold Tuning Guide
| Symptom | Adjustment |
|---------|------------|
| Too many false alarms (>10%) | Raise confidence min to 0.8, increase urgent to 5 |
| Missing critical failures | Lower urgent to 5, lower confidence to 0.6 |
| Alert fatigue | Aggregate by equipment group, raise max_alerts |
| Parts not ready in time | Increase planned threshold to 45 days |

## Step 2: Tune Feature Selection

```json
// config/agents.json
{
  "features": {
    "vibration": ["rms", "peak", "kurtosis", "trend"],
    "temperature": ["mean", "max", "anomaly_count", "trend"],
    "operating": ["hours", "hours_since_maintenance", "duty_cycle", "start_stop"],
    "cross_sensor": ["vib_temp_correlation"],
    "custom": []
  },
  "sensor_sampling": {
    "vibration_hz": 1,
    "temperature_hz": 0.1,
    "pressure_hz": 0.1,
    "current_hz": 1,
    "oil_quality_hz": 0.000012
  },
  "data_retention": {
    "raw_telemetry_days": 90,
    "features_days": 365,
    "predictions_days": 730
  }
}
```

Feature tuning:
| Symptom | Adjustment |
|---------|------------|
| Poor bearing failure prediction | Add spectral analysis features (FFT peaks) |
| Missing thermal failures | Add temperature rate-of-change feature |
| Over-maintenance of low-duty | Include duty_cycle as top feature |
| Noisy predictions | Reduce features, use PCA |

## Step 3: Tune Model Retraining

```json
// config/agents.json
{
  "model": {
    "type": "gradient_boosting",
    "retrain_schedule": "quarterly",
    "min_failure_samples": 20,
    "validation_split": 0.2,
    "retrain_on_feedback": true,
    "degradation_threshold": 0.05
  },
  "explanation": {
    "model": "gpt-4o",
    "temperature": 0.2,
    "include_parts_list": true,
    "include_repair_time": true
  }
}
```

Model tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `retrain_schedule` | quarterly | More frequent = adapts to new patterns faster |
| `min_failure_samples` | 20 | Lower = retrain sooner, risk overfitting |
| `degradation_threshold` | 0.05 | Retrain if MAE increases by >5% |
| `retrain_on_feedback` | true | Auto-trigger retrain when analyst provides feedback |

## Step 4: Cost Optimization

```python
# Predictive Maintenance cost breakdown:
# - IoT Hub S1: ~$25/month (400K messages/day)
# - ADX Dev cluster: ~$150/month (telemetry storage)
# - ML training (quarterly): ~$10/retrain
# - LLM root cause (gpt-4o): ~$0.02/analysis
# - Container Apps: ~$30/month
# - Total: ~$215/month for 100 equipment assets
#
# Value delivered:
# - Avoided unplanned downtime: $5K-50K per incident
# - Reduced maintenance cost: 20-30% vs time-based
# - Extended equipment life: 15-25% longer between overhauls
# - ROI: typically 10-50x within first year
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| ADX Dev tier | ~$100/month | No SLA |
| Lower sensor sampling | ~40% IoT cost | Less granular data |
| gpt-4o-mini for analysis | ~90% LLM cost | Simpler root cause |
| Weekly predictions (not daily) | ~85% prediction cost | Later detection |

## Step 5: Verify Tuning Impact

```bash
python evaluation/eval_rul.py --test-data evaluation/data/historical-failures/
python evaluation/eval_features.py
python evaluation/eval_downtime.py --baseline evaluation/data/baseline-downtime.json
python evaluation/eval_root_cause.py --test-data evaluation/data/failures/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| RUL MAE | baseline | -2-3 days | < 5 days |
| Critical detection | baseline | +5-10% | > 95% |
| False alarm rate | baseline | -5% | < 10% |
| Downtime reduction | 0% | 40-60% | > 40% |
| Monthly cost | ~$215 | ~$120-150 | < $250 |
