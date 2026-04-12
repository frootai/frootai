---
name: "tune-construction-safety-ai"
description: "Tune Construction Safety AI — PPE confidence thresholds, zone configurations, alert deduplication, incident risk factors, edge inference optimization, cost."
---

# Tune Construction Safety AI

## Prerequisites

- Deployed safety system with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune PPE Detection Thresholds

```json
// config/guardrails.json — PPE detection settings
{
  "ppe_detection": {
    "confidence_threshold": 0.80,
    "per_item_thresholds": {
      "hard_hat": 0.78,
      "safety_vest": 0.80,
      "safety_boots": 0.75,
      "gloves": 0.70,
      "safety_glasses": 0.75
    },
    "temporal_smoothing": {
      "enabled": true,
      "window_frames": 5,
      "majority_vote": true
    },
    "worker_tracking": {
      "enabled": true,
      "track_duration_sec": 30,
      "re_alert_cooldown_min": 5
    }
  }
}
```

PPE tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `confidence_threshold` | 0.80 | Lower = more detections (more false positives) |
| `gloves` threshold | 0.70 | Lower for small objects (harder to detect) |
| `temporal_smoothing` | 5 frames | More = fewer false positives, slower detection |
| `re_alert_cooldown_min` | 5 | Shorter = more repetitive alerts (fatigue risk) |

### Confidence vs Safety Trade-off
| Threshold | False Positive | False Negative | Use Case |
|-----------|---------------|----------------|----------|
| 0.95 | Very low | Medium (misses some) | Low-traffic areas |
| 0.80 (default) | Low | Low | Standard sites |
| 0.65 | Medium | Very low | High-risk zones (err on safety) |
| 0.50 | High (alert fatigue) | Minimal | Critical safety zones only |

## Step 2: Tune Hazard Zone Configuration

```json
// config/agents.json — zone settings
{
  "hazard_zones": {
    "default_ppe": ["hard_hat", "safety_vest"],
    "zone_types": {
      "crane_radius": {
        "risk_level": "critical",
        "ppe": ["hard_hat", "safety_vest", "safety_boots"],
        "max_workers": 5,
        "buffer_m": 3,
        "alert_type": "immediate_siren"
      },
      "excavation": {
        "risk_level": "high",
        "ppe": ["hard_hat", "safety_vest", "harness"],
        "fall_protection_required": true,
        "buffer_m": 2,
        "alert_type": "supervisor_notification"
      },
      "general_site": {
        "risk_level": "standard",
        "ppe": ["hard_hat", "safety_vest"],
        "alert_type": "dashboard_log"
      }
    },
    "night_shift": {
      "require_reflective_vest": true,
      "enhanced_lighting_check": true
    }
  }
}
```

Zone tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `buffer_m` (crane) | 3m | Larger = more conservative, more alerts |
| `max_workers` (crane) | 5 | Fewer = stricter access control |
| `alert_type` (critical) | immediate_siren | Options: siren, push, dashboard, email |
| `night_shift.reflective` | true | Required for low-visibility conditions |

## Step 3: Tune Alert Management

```json
// config/guardrails.json — alerting settings
{
  "alerts": {
    "max_alerts_per_hour": 10,
    "deduplication_window_min": 5,
    "aggregation": {
      "same_worker_same_violation": "suppress",
      "same_zone_multiple_workers": "aggregate"
    },
    "escalation": {
      "critical_zone_intrusion": "immediate",
      "ppe_violation_repeat": {"after_count": 3, "escalate_to": "site_manager"},
      "no_response_within_min": 10
    },
    "channels": {
      "worker": ["wearable_vibration"],
      "supervisor": ["mobile_push", "dashboard"],
      "site_manager": ["sms", "email", "dashboard"],
      "safety_officer": ["email", "daily_report"]
    }
  }
}
```

Alert tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `max_alerts_per_hour` | 10 | Higher = more alerts, risk fatigue |
| `deduplication_window_min` | 5 | Shorter = re-alert sooner on same violation |
| `escalation.repeat` | After 3 | Lower = faster escalation |
| `no_response_within_min` | 10 | Shorter = more aggressive follow-up |

## Step 4: Tune Incident Prediction

```json
// config/agents.json — prediction settings
{
  "incident_prediction": {
    "model_type": "gradient_boosting",
    "risk_factors": {
      "time_of_day": {"peak_hours": [14, 16], "multiplier": 1.3},
      "weather": {"rain": 1.5, "wind_above_40mph": 2.0, "heat_above_95F": 1.8},
      "day_of_week": {"friday_pm": 1.3, "monday_am": 1.2},
      "ppe_violation_rate_above": {"threshold": 0.10, "multiplier": 1.5},
      "new_worker_pct_above": {"threshold": 0.30, "multiplier": 1.4},
      "concurrent_trades_above": {"threshold": 5, "multiplier": 1.3}
    },
    "prediction_window_hours": 4,
    "update_frequency_min": 30,
    "alert_on_level": "elevated"
  }
}
```

Risk factor calibration:
| Factor | Default Multiplier | Calibrate From |
|--------|-------------------|---------------|
| Afternoon fatigue | 1.3× (2-4 PM) | Site incident history |
| Rain | 1.5× | OSHA construction weather data |
| High wind | 2.0× (>40 mph) | Crane/scaffolding incidents |
| New workers >30% | 1.4× | Industry statistics |

## Step 5: Tune Edge Inference

```json
// config/agents.json — edge device settings
{
  "edge_inference": {
    "model": "yolov8m",
    "model_format": "onnx",
    "input_size": 640,
    "half_precision": true,
    "baseline_fps": 2,
    "motion_triggered_fps": 5,
    "motion_sensitivity": 0.3,
    "batch_size": 1,
    "device": "cuda",
    "max_gpu_memory_mb": 2048,
    "fallback_to_cloud": true,
    "cloud_fallback_latency_ms": 500
  }
}
```

| Parameter | Default | Impact |
|-----------|---------|--------|
| `baseline_fps` | 2 | Higher = more compute, better coverage |
| `motion_triggered_fps` | 5 | Higher = catch fast events, more power |
| `half_precision` | true | false = slightly better accuracy, 2× slower |
| `model` | yolov8m | yolov8s = faster/less accurate, yolov8l = slower/more accurate |

## Step 6: Tune Model Configuration

```json
// config/openai.json
{
  "incident_report": {
    "model": "gpt-4o",
    "temperature": 0.2,
    "max_tokens": 1500
  },
  "trend_analysis": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 500
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
| Incident report | gpt-4o | OSHA-grade reporting quality |
| Trend analysis | gpt-4o-mini | Pattern summarization |
| Daily summary | gpt-4o-mini | Routine site status |

## Step 7: Cost Optimization

```python
# Construction Safety AI cost per site per month:
# Edge device:
#   - GPU edge device (Jetson/DGX): ~$50/mo amortized
#   - Power + connectivity: ~$20/mo
# Cloud:
#   - IoT Hub S1 (shared): ~$25/month
#   - Event Hubs: ~$11/month
#   - Custom Vision (retraining): ~$10/month
#   - Container Apps (dashboard): ~$15/month
#   - Cosmos DB Serverless: ~$5/month
#   - Storage (video clips): ~$10/month
# LLM:
#   - Incident reports (gpt-4o, ~5/month): ~$0.50
#   - Daily summaries (gpt-4o-mini, 30/month): ~$0.30
# Total per site: ~$147/month

# Cost reduction:
# 1. Shared IoT Hub across sites: save ~$20/site
# 2. Reduce video clip retention (7 days vs 30): save ~$7/month
# 3. Lower FPS baseline (1 FPS): save ~30% edge compute
# 4. CPU-only inference (no GPU): save ~$30/mo, add 200ms latency
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Shared IoT Hub | ~$20/site | Multi-tenant complexity |
| Shorter retention | ~$7/month | Less historical evidence |
| Lower FPS | ~$15/month edge | May miss fast events |
| CPU inference | ~$30/month | 200ms→400ms latency |

## Step 8: Verify Tuning Impact

```bash
python evaluation/eval_ppe.py --test-data evaluation/data/ppe_images/
python evaluation/eval_zones.py --test-data evaluation/data/zone_videos/
python evaluation/eval_prediction.py --test-data evaluation/data/incidents/
python evaluation/eval_alerts.py --test-data evaluation/data/alerts/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| PPE mAP@0.5 | baseline | > 85% | > 85% |
| Zone intrusion detection | baseline | > 95% | > 95% |
| Alert delivery | baseline | < 30s | < 30s |
| Alert fatigue | baseline | < 10/hr | < 10/hr |
| Cost per site/month | ~$147 | ~$100 | < $200 |
