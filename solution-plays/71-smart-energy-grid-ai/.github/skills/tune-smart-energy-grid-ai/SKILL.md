---
name: "tune-smart-energy-grid-ai"
description: "Tune Smart Energy Grid AI — forecast model parameters, renewable dispatch thresholds, demand response pricing, anomaly sensitivity, cost optimization."
---

# Tune Smart Energy Grid AI

## Prerequisites

- Deployed grid AI system with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Load Forecasting Model

```json
// config/agents.json — forecast configuration
{
  "forecast": {
    "model_type": "ensemble",
    "ensemble_weights": {
      "prophet": 0.3,
      "lightgbm": 0.5,
      "lstm": 0.2
    },
    "horizon_hours": 24,
    "retrain_cadence": "weekly",
    "features": [
      "historical_load", "temperature", "humidity",
      "solar_irradiance", "wind_speed", "day_of_week",
      "hour_of_day", "is_holiday", "local_events"
    ],
    "lookback_days": 365,
    "update_frequency_min": 15
  }
}
```

Forecast tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `ensemble_weights` | LightGBM-heavy | Adjust based on MAPE per model |
| `horizon_hours` | 24 | Longer = lower accuracy, more planning time |
| `retrain_cadence` | weekly | More frequent = adapts faster, higher compute |
| `lookback_days` | 365 | Too short = miss seasonality, too long = stale patterns |
| `update_frequency_min` | 15 | Real-time (1 min) vs batch (60 min) trade-off |

### Seasonal Tuning Guide
| Season | Key Feature | Adjustment |
|--------|------------|------------|
| Summer | Solar irradiance + AC load | Weight solar features higher |
| Winter | Heating load + short daylight | Weight temperature + hour-of-day |
| Spring/Fall | Variable weather | Increase ensemble diversity |
| Event days | Concerts, sports | Enable event feature, increase weight |

## Step 2: Tune Renewable Dispatch

```json
// config/agents.json — dispatch optimization
{
  "dispatch": {
    "priority_order": ["solar", "wind", "battery", "hydro", "gas_peaker"],
    "curtailment_thresholds": {
      "grid_frequency_hz_max": 50.5,
      "battery_soc_max_pct": 95,
      "oversupply_margin_pct": 15
    },
    "battery_management": {
      "min_soc_pct": 20,
      "max_charge_rate_kw": 500,
      "peak_discharge_hours": [17, 18, 19, 20],
      "cycle_limit_per_day": 2
    },
    "gas_peaker_conditions": {
      "min_deficit_kw": 1000,
      "min_duration_hours": 1,
      "startup_time_min": 15,
      "ramp_rate_kw_per_min": 100
    }
  }
}
```

Dispatch tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `grid_frequency_hz_max` | 50.5 | Lower = curtail sooner (safer), higher = use more renewable |
| `battery_soc_max_pct` | 95% | Higher = risk degradation, lower = waste capacity |
| `peak_discharge_hours` | 17-20 | Match to actual peak demand hours |
| `min_deficit_kw` | 1000 | Lower = use gas more often (expensive), higher = risk brownout |

## Step 3: Tune Demand Response Pricing

```json
// config/agents.json — demand response
{
  "demand_response": {
    "peak_threshold_kw": 8000,
    "price_signal_tiers": [
      {"tier": "normal", "price_kwh": 0.12, "below_kw": 6000},
      {"tier": "high", "price_kwh": 0.25, "below_kw": 8000},
      {"tier": "critical", "price_kwh": 0.50, "above_kw": 8000}
    ],
    "large_consumer_threshold_kw": 500,
    "notification_lead_time_min": 30,
    "max_curtailment_pct": 20,
    "incentive_rebate_pct": 15
  }
}
```

Pricing tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `peak_threshold_kw` | 8000 | Lower = more demand response events (consumer fatigue) |
| `critical price_kwh` | $0.50 | Higher = stronger signal, may upset consumers |
| `notification_lead_time_min` | 30 | Shorter = less response, longer = more planning |
| `max_curtailment_pct` | 20% | Higher = more peak shaving, risk service disruption |
| `incentive_rebate_pct` | 15% | Higher = more participation, higher cost |

## Step 4: Tune Anomaly Detection

```json
// config/guardrails.json — anomaly settings
{
  "anomaly_detection": {
    "method": "isolation_forest",
    "contamination": 0.02,
    "sensitivity_overrides": {
      "frequency_hz": {"threshold": 0.2, "severity": "critical"},
      "voltage_v": {"threshold_pct": 10, "severity": "high"},
      "load_kw": {"sigma": 3, "severity": "medium"}
    },
    "alert_cooldown_min": 5,
    "escalation_after_min": 15,
    "auto_response_enabled": true
  }
}
```

Anomaly tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `contamination` | 0.02 | Higher = more sensitive (more false positives) |
| `frequency_hz threshold` | ±0.2 Hz | Tighter = catch more subtle issues |
| `alert_cooldown_min` | 5 | Shorter = more alerts (noise risk) |
| `auto_response_enabled` | true | false = human-in-the-loop (slower, safer) |

## Step 5: Tune LLM Configuration

```json
// config/openai.json
{
  "anomaly_explanation": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 500,
    "system_prompt_includes": ["sensor_data", "grid_topology", "historical_context"]
  },
  "demand_response_recommendation": {
    "model": "gpt-4o-mini",
    "temperature": 0.1,
    "max_tokens": 300
  },
  "report_generation": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 2000
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Anomaly explanation | gpt-4o | Critical accuracy — grid safety depends on it |
| Demand response | gpt-4o-mini | Simpler pattern matching, cost-sensitive |
| Report generation | gpt-4o | Quality reporting for grid operators |

## Step 6: Cost Optimization

```python
# Smart Energy Grid AI cost per day:
# Sensor data ingestion:
#   - IoT Hub S1 (400K msg/day): ~$25/month
#   - Event Hubs Standard (1 TU): ~$22/month
#   - Data Explorer Dev: ~$130/month (Standard: ~$450/month)
# ML / Forecast:
#   - Azure ML compute (4h/week training): ~$30/month
#   - Model serving (Container Apps): ~$15/month
# LLM (anomaly explanations + recommendations):
#   - gpt-4o (~20 explanations/day × $0.03): ~$18/month
#   - gpt-4o-mini (~50 recommendations/day × $0.002): ~$3/month
# Total: ~$243/month (dev) | ~$563/month (prod with Standard ADX)

# Cost reduction strategies:
# 1. Use Data Explorer Dev SKU for non-production (save $320/month)
# 2. Batch forecast updates (15-min → 60-min reduces compute 75%)
# 3. Cache anomaly explanations for similar patterns (save 50% LLM)
# 4. Use gpt-4o-mini for non-critical explanations (save 90% LLM)
# 5. IoT Hub Basic tier if no cloud-to-device messaging needed
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| ADX Dev SKU | ~$320/month | No SLA, single node |
| Batch forecasts (60 min) | ~$22/month compute | Less responsive to rapid changes |
| Cache explanations | ~$9/month LLM | May miss novel anomaly patterns |
| gpt-4o-mini everywhere | ~$15/month LLM | Lower quality explanations |
| IoT Hub Basic | ~$15/month | No cloud-to-device commands |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_forecast.py --test-data evaluation/data/load_history/
python evaluation/eval_anomaly.py --test-data evaluation/data/anomalies/
python evaluation/eval_dispatch.py --test-data evaluation/data/dispatch/
python evaluation/eval_demand_response.py --test-data evaluation/data/demand_response/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Forecast MAPE | baseline | < 5% | < 5% |
| Anomaly detection | baseline | > 95% | > 95% |
| Renewable utilization | baseline | > 92% | > 92% |
| Peak shaving | baseline | > 15% | > 15% |
| Monthly cost | ~$563 | ~$300 | < $400 |
