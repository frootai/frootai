---
name: "tune-building-energy-optimizer"
description: "Tune Building Energy Optimizer — comfort ranges, setback temperatures, occupancy thresholds, fault detection rules, pre-conditioning lead time, cost optimization."
---

# Tune Building Energy Optimizer

## Prerequisites

- Deployed optimizer with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Comfort Ranges

```json
// config/guardrails.json — comfort settings
{
  "comfort": {
    "cooling_season": {
      "temp_f_min": 73,
      "temp_f_max": 79,
      "humidity_pct_min": 30,
      "humidity_pct_max": 60
    },
    "heating_season": {
      "temp_f_min": 68,
      "temp_f_max": 76,
      "humidity_pct_min": 30,
      "humidity_pct_max": 60
    },
    "transition_season": {
      "temp_f_min": 70,
      "temp_f_max": 77
    },
    "complaint_response": {
      "immediate_adjust_f": 2,
      "cooldown_min": 30,
      "max_adjustments_per_day": 3
    }
  }
}
```

Comfort tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `cooling temp_f_max` | 79°F | Higher = more savings, risk discomfort |
| `heating temp_f_min` | 68°F | Lower = more savings, risk cold complaints |
| `complaint immediate_adjust_f` | 2°F | Higher = faster fix, may overshoot |
| `max_adjustments_per_day` | 3 | Higher = more responsive, less stable |

### Zone Type Profiles
| Zone Type | Cooling Max | Heating Min | Reason |
|-----------|-----------|------------|--------|
| Open office | 77°F | 70°F | Standard ASHRAE 55 |
| Server room | 75°F | 64°F | Equipment tolerance |
| Conference room | 75°F | 72°F | Higher occupancy density |
| Lobby/atrium | 80°F | 65°F | Transient space, wider tolerance |
| Executive suite | 75°F | 72°F | Comfort-priority |

## Step 2: Tune Setback & Pre-Conditioning

```json
// config/agents.json — scheduling settings
{
  "scheduling": {
    "setback_temps": {
      "cooling_unoccupied_f": 85,
      "heating_unoccupied_f": 55,
      "night_setback_f": 60,
      "weekend_setback_f": 60
    },
    "pre_conditioning": {
      "lead_time_min": 30,
      "ramp_rate_f_per_min": 0.5,
      "weather_adjusted": true,
      "extreme_heat_lead_min": 60,
      "extreme_cold_lead_min": 45
    },
    "occupancy_thresholds": {
      "empty_below": 2,
      "low_below_pct": 30,
      "transition_detection_min": 15
    }
  }
}
```

Scheduling tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `cooling_unoccupied_f` | 85°F | Lower = less savings but faster recovery |
| `lead_time_min` | 30 | Longer = comfortable on arrival, more energy |
| `extreme_heat_lead_min` | 60 | Hot days need more pre-cooling time |
| `empty_below` | 2 people | Lower = more aggressive setback |

### Savings vs Comfort Trade-off
| Strategy | Energy Savings | Comfort Risk | Best For |
|----------|---------------|-------------|----------|
| Aggressive setback | 25-30% | Medium | Warehouses, labs |
| Moderate setback (default) | 15-20% | Low | Offices |
| Conservative setback | 8-12% | Minimal | Executive, client-facing |
| No setback | 0% | None | 24/7 operations |

## Step 3: Tune Occupancy Prediction

```json
// config/agents.json — occupancy settings
{
  "occupancy_prediction": {
    "model_type": "gradient_boosting",
    "data_sources": {
      "badge_in": {"weight": 0.30, "enabled": true},
      "wifi_devices": {"weight": 0.25, "enabled": true},
      "co2_levels": {"weight": 0.15, "enabled": true},
      "calendar_events": {"weight": 0.20, "enabled": true},
      "historical_pattern": {"weight": 0.10, "enabled": true}
    },
    "horizon_hours": 24,
    "update_interval_min": 15,
    "retrain_frequency": "weekly",
    "holiday_calendar": "US_federal"
  }
}
```

| Source | Weight | Add When |
|--------|--------|----------|
| Badge-in | 0.30 | Always (if available) |
| WiFi devices | 0.25 | Open offices (BYOD) |
| CO2 levels | 0.15 | Real-time override for bad predictions |
| Calendar | 0.20 | Conference rooms + meeting-heavy buildings |
| Historical | 0.10 | Baseline when other sources incomplete |

## Step 4: Tune Fault Detection

```json
// config/guardrails.json — fault detection settings
{
  "fault_detection": {
    "stuck_valve": {"temp_divergence_f": 5, "duration_min": 60},
    "simultaneous_heat_cool": {"detection_delay_min": 5},
    "excessive_runtime": {"max_hours_per_day": 20, "consecutive_days": 3},
    "energy_anomaly": {"std_dev_threshold": 2.0, "rolling_window_days": 30},
    "sensor_drift": {"max_divergence_f": 5},
    "alert_channels": ["facilities_email", "bms_dashboard"],
    "auto_create_ticket": true,
    "ticket_system": "servicenow"
  }
}
```

Fault tuning:
| Fault | Default | Tighter (more sensitive) | Looser (fewer alerts) |
|-------|---------|------------------------|---------------------|
| Stuck valve | 5°F / 60 min | 3°F / 30 min | 7°F / 90 min |
| Energy anomaly | 2σ | 1.5σ | 3σ |
| Sensor drift | 5°F | 3°F | 8°F |
| Runtime | 20h/day × 3 days | 18h × 2 days | 22h × 5 days |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "sustainability_report": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 2000
  },
  "anomaly_explanation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 400
  },
  "fault_recommendation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 300
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Sustainability report | gpt-4o | Stakeholder-facing quality |
| Anomaly explanation | gpt-4o-mini | Pattern-based, routine |
| Fault recommendation | gpt-4o-mini | Standard maintenance actions |

## Step 6: Cost Optimization

```python
# Building Energy Optimizer cost per building per month:
# Sensors:
#   - IoT Hub S1 (shared): ~$25/month
#   - Digital Twins: ~$10/month (small building model)
# Compute:
#   - Data Explorer Dev: ~$130/month
#   - Azure ML (occupancy model): ~$15/month
#   - Functions (setpoint engine): ~$5/month
# LLM:
#   - Sustainability reports (gpt-4o, monthly): ~$0.10
#   - Anomaly explanations (gpt-4o-mini, ~20/month): ~$0.04
# Infrastructure:
#   - Container Apps: ~$15/month
#   - Cosmos DB Serverless: ~$5/month
# Total per building: ~$205/month
# ROI: 15-20% energy savings on typical $5K-20K/month energy bill = $750-4000 savings

# Cost reduction:
# 1. Skip Digital Twins (use simple zone config): save ~$10/month
# 2. Data Explorer Dev (already cheapest): N/A
# 3. Batch occupancy predictions (1/hour vs 15 min): save ~$5/month
# 4. Template-based reports instead of LLM: save ~$0.10/month (negligible)
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Skip Digital Twins | ~$10/month | No 3D visualization |
| Hourly predictions | ~$5/month | Less responsive to changes |
| Shared infra (multi-bldg) | ~40% per building | Multi-tenant complexity |
| ROI reference | 15-20% energy bill | Payback: 1-3 months typically |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_energy.py --baseline-data evaluation/data/baseline_energy/ --optimized-data evaluation/data/optimized_energy/
python evaluation/eval_occupancy.py --test-data evaluation/data/occupancy/
python evaluation/eval_comfort.py --test-data evaluation/data/comfort/
python evaluation/eval_faults.py --test-data evaluation/data/faults/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Energy savings | baseline | > 15% | > 15% |
| ASHRAE 55 compliance | baseline | > 90% | > 90% |
| Fault detection | baseline | > 85% | > 85% |
| Occupancy MAPE | baseline | < 20% | < 20% |
| Monthly cost | ~$205 | ~$180 | < $250 |
