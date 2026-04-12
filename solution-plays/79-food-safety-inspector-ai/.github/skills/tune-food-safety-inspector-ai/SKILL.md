---
name: "tune-food-safety-inspector-ai"
description: "Tune Food Safety Inspector AI — critical limits, alert thresholds, pattern sensitivity, traceability depth, inspection scheduling, cost optimization."
---

# Tune Food Safety Inspector AI

## Prerequisites

- Deployed food safety system with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Critical Limits

```json
// config/guardrails.json — HACCP critical limits
{
  "critical_limits": {
    "cold_storage": {
      "temperature_f_max": 40,
      "warning_threshold_f": 38,
      "humidity_pct_max": 85,
      "door_open_ignore_sec": 120
    },
    "cooking": {
      "internal_temp_f_min": 165,
      "hold_time_sec_min": 15,
      "poultry_temp_f": 165,
      "ground_meat_temp_f": 155,
      "fish_temp_f": 145
    },
    "cooling": {
      "stage1_135_to_70_max_min": 120,
      "stage2_70_to_41_max_hours": 4
    },
    "hot_holding": {
      "temperature_f_min": 135
    },
    "receiving": {
      "refrigerated_temp_f_max": 41,
      "frozen_temp_f_max": 0
    }
  }
}
```

Critical limit tuning:
| CCP | Parameter | FDA Limit | Our Default | Adjustable? |
|-----|-----------|-----------|-------------|------------|
| Cold Storage | Temp | ≤ 41°F | ≤ 40°F | Yes (tighter is safer) |
| Cooking (poultry) | Internal temp | ≥ 165°F | ≥ 165°F | No (regulatory minimum) |
| Cooking (ground meat) | Internal temp | ≥ 155°F | ≥ 155°F | No |
| Cooling Stage 1 | 135→70°F | ≤ 2 hours | ≤ 120 min | No |
| Hot Holding | Temp | ≥ 135°F | ≥ 135°F | No |
| Receiving | Temp | ≤ 41°F | ≤ 41°F | No |

> **Safety note:** Cooking temps are FDA-mandated minimums — never lower them.

## Step 2: Tune Alert Configuration

```json
// config/guardrails.json — alerting settings
{
  "alerts": {
    "violation_alert_channels": ["email", "sms", "teams"],
    "warning_at_pct_of_limit": 90,
    "escalation_after_min": 15,
    "cooldown_between_alerts_min": 5,
    "door_open_debounce_sec": 120,
    "sensor_heartbeat_interval_min": 5,
    "dead_sensor_alert_after_min": 15,
    "batch_mode": false,
    "severity_levels": {
      "critical": "CCP limit exceeded",
      "warning": "Within 10% of limit",
      "info": "Pattern detected, no immediate violation"
    }
  }
}
```

Alert tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `warning_at_pct_of_limit` | 90% | Lower = earlier warning, more alerts |
| `escalation_after_min` | 15 | Shorter = faster escalation, risk alert fatigue |
| `door_open_debounce_sec` | 120 | Shorter = more false alerts from door opening |
| `dead_sensor_alert_after_min` | 15 | Shorter = catch sensor failures faster |

## Step 3: Tune Pattern Detection

```json
// config/agents.json — pattern analysis settings
{
  "pattern_detection": {
    "min_history_months": 3,
    "recurring_threshold_count": 3,
    "trend_window_days": 30,
    "trend_slope_alert": 0.5,
    "seasonal_comparison": true,
    "shift_pattern_check": true,
    "correlated_ccp_check": true,
    "report_frequency": "weekly"
  }
}
```

Pattern tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `recurring_threshold_count` | 3 | Lower = flag sooner, higher = fewer patterns |
| `trend_slope_alert` | 0.5°F/week | Lower = catch slower trends (more sensitive) |
| `seasonal_comparison` | true | Compare same month prior year |
| `shift_pattern_check` | true | Check if violations cluster by work shift |

### Pattern Response Actions
| Pattern Type | Default Action | Escalation |
|-------------|---------------|------------|
| Recurring CCP | Equipment inspection request | 3rd occurrence → maintenance ticket |
| Trending toward limit | Warning + increased monitoring | 5 days from limit → corrective action |
| Shift-correlated | Staff retraining notice | 3rd shift pattern → supervisor review |
| Seasonal | Pre-season equipment check | Jun→Aug → double cooling capacity check |

## Step 4: Tune Traceability

```json
// config/agents.json — traceability settings
{
  "traceability": {
    "lot_tracking_fields": ["lot_number", "supplier", "farm_origin",
      "harvest_date", "transport_temp_log", "receiving_date", "storage_location"],
    "retention_days": 730,
    "one_up_one_back": true,
    "auto_link_products": true,
    "trace_execution_target_min": 30,
    "recall_drill_frequency": "quarterly",
    "fsma_204_compliance": true
  }
}
```

| Parameter | Default | Impact |
|-----------|---------|--------|
| `retention_days` | 730 (2 years) | Longer = more storage cost, better trace history |
| `trace_execution_target_min` | 30 | FDA expects trace within hours; 30 min is excellent |
| `recall_drill_frequency` | quarterly | FDA recommends at least annually |
| `fsma_204_compliance` | true | Required for high-risk foods after 2026 |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "pattern_analysis": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 500
  },
  "inspection_report": {
    "model": "gpt-4o",
    "temperature": 0.2,
    "max_tokens": 2000
  },
  "corrective_action": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 300
  },
  "trend_explanation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 200
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Pattern analysis | gpt-4o | Complex multi-signal correlation |
| Inspection report | gpt-4o | Quality regulatory-grade reporting |
| Corrective action | gpt-4o-mini | Templated responses |
| Trend explanation | gpt-4o-mini | Straightforward data interpretation |

## Step 6: Cost Optimization

```python
# Food Safety Inspector AI cost per facility per month:
# IoT sensors:
#   - IoT Hub S1: ~$25/month (shared, 400K msg/day)
#   - 10 sensors × 4 readings/hour: ~120K msg/month
# Compute:
#   - Event Hubs: ~$11/month (1 TU)
#   - Azure Functions (violation alerts): ~$5/month
# LLM:
#   - Pattern analysis (gpt-4o, weekly × $0.03): ~$0.12
#   - Inspection reports (gpt-4o, monthly × $0.10): ~$0.10
#   - Corrective actions (gpt-4o-mini, ~20/month × $0.001): ~$0.02
# Infrastructure:
#   - Container Apps: ~$15/month
#   - Cosmos DB Serverless: ~$10/month
# Total per facility: ~$66/month

# Cost reduction:
# 1. IoT Hub Basic tier (no C2D needed): save ~$10/month
# 2. Reduce sensor frequency (4/hour → 2/hour): save 50% IoT
# 3. Batch patterns monthly instead of weekly: save 75% LLM
# 4. Shared infra across facilities: save ~60% per facility
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| IoT Hub Basic | ~$10/month | No cloud-to-device commands |
| Reduce frequency | ~$12/month | Slower violation detection |
| Monthly patterns | ~$0.09/month | Less timely pattern analysis |
| Multi-facility sharing | ~$40/facility | Requires multi-tenant design |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_detection.py --test-data evaluation/data/inspections/
python evaluation/eval_patterns.py --test-data evaluation/data/patterns/
python evaluation/eval_traceability.py --test-data evaluation/data/lots/
python evaluation/eval_recall.py --test-data evaluation/data/recall_drills/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Violation detection | baseline | > 99% | > 99% |
| Alert latency | baseline | < 60s | < 60s |
| Pattern detection | baseline | > 85% | > 85% |
| Trace completeness | baseline | > 95% | > 95% |
| Cost per facility | ~$66 | ~$45 | < $80 |
