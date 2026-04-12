---
name: "tune-telecom-fraud-shield"
description: "Tune Telecom Fraud Shield — fraud thresholds, velocity limits, IRSF ranges, SIM swap indicators, anomaly sensitivity, false positive reduction."
---

# Tune Telecom Fraud Shield

## Prerequisites

- Deployed fraud shield with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune SIM Swap Detection

```json
// config/agents.json — SIM swap settings
{
  "sim_swap": {
    "min_indicators": 3,
    "indicators": {
      "new_imei": {"weight": 1.0, "always_check": true},
      "location_jump_km": {"threshold": 100, "weight": 0.8},
      "high_value_multiplier": {"threshold": 5, "weight": 0.9},
      "premium_number_call": {"weight": 1.0},
      "inactivity_hours": {"threshold": 24, "weight": 0.6}
    },
    "action_on_detect": "block_immediately",
    "high_value_subscriber_threshold": 2,
    "notify_subscriber_sms": true,
    "investigation_sla_hours": 4
  }
}
```

SIM swap tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `min_indicators` | 3 | Lower (2) = catch more swaps, more false positives |
| `location_jump_km` | 100 | Lower = detect closer swaps (risk flagging travel) |
| `high_value_multiplier` | 5× | Lower = trigger on smaller anomalies |
| `high_value_subscriber_threshold` | 2 indicators | Stricter for high-value accounts |

## Step 2: Tune IRSF Rules

```json
// config/guardrails.json — IRSF settings
{
  "irsf": {
    "high_risk_ranges": ["882", "883", "979"],
    "auto_update_source": "gsma_irsf_database",
    "update_frequency": "weekly",
    "rules": {
      "max_international_calls_per_hour": 10,
      "max_premium_calls_per_day": 3,
      "max_charge_per_call_usd": 50,
      "block_on_critical_range": true,
      "flag_on_high_range": true,
      "subscriber_whitelist_enabled": true
    },
    "test_call_detection": {
      "enabled": true,
      "pattern": "1 call to premium → wait 5 min → burst",
      "block_on_burst": true
    }
  }
}
```

IRSF tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `max_international_calls_per_hour` | 10 | Lower = stricter, may block business travelers |
| `max_premium_calls_per_day` | 3 | Lower = catch smaller-scale IRSF |
| `subscriber_whitelist_enabled` | true | Allows known travelers to bypass limits |

## Step 3: Tune Velocity Limits

```json
// config/guardrails.json — velocity settings
{
  "velocity": {
    "default_limits": {
      "calls_per_minute": 5,
      "calls_per_15_min": 30,
      "calls_per_hour": 100,
      "international_per_hour": 10,
      "sms_per_minute": 10,
      "sms_per_hour": 200
    },
    "subscriber_segmentation": {
      "consumer": {"multiplier": 1.0},
      "business": {"multiplier": 3.0},
      "enterprise": {"multiplier": 5.0},
      "prepaid": {"multiplier": 0.7}
    },
    "adaptive_baseline": {
      "enabled": true,
      "lookback_days": 30,
      "std_dev_multiplier": 3
    },
    "cooldown_after_violation_min": 30
  }
}
```

Velocity tuning:
| Segment | Calls/min | Calls/hour | International/hour | Rationale |
|---------|----------|-----------|-------------------|-----------|
| Consumer | 5 | 100 | 10 | Normal personal usage |
| Business | 15 | 300 | 30 | Call centers, sales teams |
| Enterprise | 25 | 500 | 50 | PBX, automated systems |
| Prepaid | 3 | 70 | 7 | Higher fraud risk segment |

## Step 4: Tune Anomaly Model

```json
// config/agents.json — anomaly settings
{
  "anomaly_detection": {
    "model_type": "isolation_forest",
    "contamination": 0.01,
    "alert_threshold": 0.80,
    "review_threshold": 0.60,
    "features": [
      "calls_per_day_ratio", "unique_destinations_ratio",
      "international_pct", "premium_pct", "avg_duration_ratio",
      "time_of_day_unusual", "new_device", "roaming_new_country"
    ],
    "retrain_frequency": "weekly",
    "per_subscriber_baseline": true,
    "baseline_lookback_days": 30,
    "min_history_for_baseline": 7
  }
}
```

Anomaly tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `alert_threshold` | 0.80 | Lower = more alerts (more false positives) |
| `contamination` | 0.01 | Higher = more sensitive, risk over-detection |
| `per_subscriber_baseline` | true | false = global baseline (miss individual patterns) |
| `retrain_frequency` | weekly | More frequent = adapt faster to pattern changes |

## Step 5: Tune Alert Routing & Actions

```json
// config/agents.json — alert settings
{
  "alert_routing": {
    "actions_by_severity": {
      "critical": {
        "action": "block_immediately",
        "notify": ["fraud_team_sms", "subscriber_sms"],
        "investigation_sla_hours": 4,
        "auto_escalate_after_hours": 2
      },
      "high": {
        "action": "flag_and_monitor",
        "notify": ["fraud_dashboard"],
        "investigation_sla_hours": 8
      },
      "medium": {
        "action": "log_and_monitor",
        "notify": ["daily_report"],
        "investigation_sla_hours": 24
      }
    },
    "false_positive_feedback": {
      "enabled": true,
      "retrain_on_feedback": true,
      "min_feedback_for_retrain": 50
    }
  }
}
```

## Step 6: Tune Model Configuration

```json
// config/openai.json
{
  "investigation_report": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 1500
  },
  "pattern_explanation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 300
  },
  "daily_summary": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 800
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Investigation report | gpt-4o | Evidence-grade reporting for fraud cases |
| Pattern explanation | gpt-4o-mini | Structured alert context |
| Daily summary | gpt-4o-mini | Routine dashboard report |

## Step 7: Cost Optimization

```python
# Telecom Fraud Shield cost per month:
# Streaming:
#   - Event Hubs Standard (2 TUs): ~$44/month
#   - Stream Analytics (6 SUs): ~$450/month
# ML:
#   - Azure ML endpoint (anomaly scoring): ~$50/month
#   - Retraining (weekly): ~$10/month
# Caching:
#   - Redis C1 (velocity counters): ~$55/month
# LLM:
#   - Investigation reports (gpt-4o, ~50/month): ~$3/month
#   - Daily summaries (gpt-4o-mini): ~$0.30/month
# Infrastructure:
#   - Container Apps: ~$15/month
#   - Cosmos DB Serverless: ~$10/month
#   - Functions: ~$5/month
# Total: ~$642/month
# ROI: Prevents $50K-500K+ monthly fraud losses

# Cost reduction:
# 1. Stream Analytics → Azure Functions (self-managed rules): save ~$400/month
# 2. Redis Basic (if <500 subscribers): save ~$30/month
# 3. Batch anomaly scoring (not real-time): save ~$40/month ML
# 4. Shared Event Hubs across plays: save ~$30/month
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Functions instead of SA | ~$400/month | Self-managed windowing logic |
| Redis Basic | ~$30/month | Lower throughput, single node |
| Batch scoring | ~$40/month | Minutes delay for ML anomaly detection |
| Shared Event Hubs | ~$30/month | Multi-tenant complexity |

## Step 8: Verify Tuning Impact

```bash
python evaluation/eval_detection.py --test-data evaluation/data/labeled_cdrs/
python evaluation/eval_velocity.py --test-data evaluation/data/velocity_tests/
python evaluation/eval_impact.py --test-data evaluation/data/subscriber_impact/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Fraud recall | baseline | > 95% | > 95% |
| False positive | baseline | < 0.1% | < 0.1% |
| Detection latency | baseline | < 5 sec | < 5 sec |
| Wrongful block | baseline | < 0.01% | < 0.01% |
| Monthly cost | ~$642 | ~$200 | < $700 |
