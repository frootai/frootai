---
name: "tune-network-optimization-agent"
description: "Tune Network Optimization Agent — utilization caps, latency SLAs, maintenance thresholds, routing weights, 5G slice allocation, cost optimization."
---

# Tune Network Optimization Agent

## Prerequisites

- Deployed network optimizer with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Utilization & SLA Targets

```json
// config/guardrails.json — network SLAs
{
  "sla_targets": {
    "max_link_utilization_pct": 80,
    "latency_sla_ms": {
      "critical": 5,
      "real_time": 20,
      "best_effort": 100
    },
    "availability_pct": 99.95,
    "packet_loss_max_pct": 0.01,
    "jitter_max_ms": 5,
    "min_redundancy_paths": 2,
    "headroom_for_burst_pct": 20
  }
}
```

Utilization tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `max_link_utilization_pct` | 80% | Lower = more headroom, more capacity needed |
| `latency critical` | 5ms | For URLLC slices (autonomous, surgery) |
| `latency real_time` | 20ms | Voice/video quality threshold |
| `min_redundancy_paths` | 2 | Higher = more resilient, more complex routing |

### SLA Profiles by Traffic Class
| Traffic Class | Latency | Packet Loss | Jitter | Priority |
|--------------|---------|-------------|--------|----------|
| URLLC (critical) | < 5ms | < 0.001% | < 1ms | 1 (highest) |
| Real-time (voice/video) | < 20ms | < 0.01% | < 5ms | 2 |
| Interactive (web/gaming) | < 50ms | < 0.1% | < 10ms | 3 |
| Best effort (email/backup) | < 100ms | < 1% | N/A | 4 (lowest) |

## Step 2: Tune Traffic Forecasting

```json
// config/agents.json — traffic forecast settings
{
  "traffic_forecast": {
    "model_type": "lstm",
    "horizon_hours": 4,
    "update_frequency_min": 15,
    "retrain_frequency": "daily",
    "features": [
      "traffic_lag_1h", "traffic_lag_24h", "traffic_lag_168h",
      "hour_of_day", "day_of_week", "is_weekend",
      "active_subscribers", "event_nearby"
    ],
    "lookback_hours": 168,
    "per_link_model": true,
    "aggregate_fallback": true
  }
}
```

Forecast tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `horizon_hours` | 4 | Longer = more planning time, lower accuracy |
| `update_frequency_min` | 15 | Faster = more responsive, more compute |
| `per_link_model` | true | false = one model for all links (less accurate, cheaper) |

## Step 3: Tune Routing Optimization

```json
// config/agents.json — routing settings
{
  "routing": {
    "optimization_objective": "multi_objective",
    "weights": {
      "utilization_balance": 0.40,
      "latency": 0.35,
      "redundancy": 0.25
    },
    "re_optimize_trigger": {
      "utilization_delta_pct": 10,
      "link_failure": true,
      "new_demand": true,
      "periodic_min": 60
    },
    "dampening_factor": 0.7,
    "k_shortest_paths": 3,
    "ecmp_enabled": true,
    "traffic_engineering": {
      "method": "segment_routing",
      "max_segments": 4
    }
  }
}
```

Routing tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| Utilization vs latency vs redundancy | 40/35/25 | Adjust per network priority |
| `dampening_factor` | 0.7 | Higher = fewer route changes (more stable) |
| `re_optimize trigger` | 10% delta | Lower = more frequent re-routing |
| `ecmp_enabled` | true | Equal-cost multi-path for load balancing |

## Step 4: Tune Predictive Maintenance

```json
// config/guardrails.json — maintenance settings
{
  "predictive_maintenance": {
    "failure_probability_alert": 0.70,
    "failure_probability_critical": 0.90,
    "metrics_thresholds": {
      "temperature_c": {"warning": 65, "critical": 80},
      "error_rate_pct": {"warning": 0.1, "critical": 1.0},
      "cpu_pct": {"warning": 80, "critical": 95},
      "memory_pct": {"warning": 85, "critical": 95}
    },
    "rul_min_days_for_scheduled": 14,
    "maintenance_window": "02:00-06:00",
    "auto_failover_on_critical": true,
    "spare_equipment_threshold": 2
  }
}
```

Maintenance tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `failure_probability_alert` | 0.70 | Lower = earlier warning, more false alarms |
| `rul_min_days_for_scheduled` | 14 | Shorter = tighter maintenance windows |
| `auto_failover_on_critical` | true | Automatic traffic rerouting on predicted failure |

## Step 5: Tune 5G Resource Allocation

```json
// config/agents.json — 5G slice settings
{
  "network_slices": {
    "embb": {
      "priority": 2,
      "min_bandwidth_pct": 40,
      "max_bandwidth_pct": 80,
      "latency_target_ms": 20
    },
    "urllc": {
      "priority": 1,
      "min_bandwidth_pct": 10,
      "max_bandwidth_pct": 30,
      "latency_target_ms": 1,
      "preemption_enabled": true
    },
    "mmtc": {
      "priority": 3,
      "min_bandwidth_pct": 5,
      "max_bandwidth_pct": 30,
      "latency_target_ms": 100
    },
    "admission_control": {
      "enabled": true,
      "reject_if_min_not_available": true,
      "overbooking_factor": 1.2
    }
  }
}
```

Slice tuning:
| Slice | Min BW | Max BW | Latency | Preemption |
|-------|--------|--------|---------|-----------|
| URLLC | 10% | 30% | 1ms | Yes — can take from eMBB/mMTC |
| eMBB | 40% | 80% | 20ms | No |
| mMTC | 5% | 30% | 100ms | No |

## Step 6: Tune Model Configuration

```json
// config/openai.json
{
  "anomaly_analysis": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 500
  },
  "network_report": {
    "model": "gpt-4o",
    "temperature": 0.2,
    "max_tokens": 2000
  },
  "alert_explanation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 300
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Anomaly analysis | gpt-4o | Complex multi-signal network correlation |
| Network report | gpt-4o | NOC-grade quality reporting |
| Alert explanation | gpt-4o-mini | High volume, structured alerts |

## Step 7: Cost Optimization

```python
# Network Optimization Agent cost per month:
# Data:
#   - IoT Hub S1 (shared): ~$25/month
#   - Data Explorer Dev: ~$130/month
#   - Event Hubs: ~$11/month
# ML:
#   - Azure ML (traffic model, daily): ~$30/month
#   - Failure prediction model: ~$10/month
# LLM:
#   - Anomaly analysis (gpt-4o, ~20/month): ~$0.60
#   - Network reports (gpt-4o, weekly): ~$0.40
#   - Alert explanations (gpt-4o-mini, ~100/month): ~$0.10
# Infrastructure:
#   - Container Apps: ~$15/month
#   - Cosmos DB Serverless: ~$10/month
#   - Functions (alert engine): ~$5/month
# Total: ~$237/month

# Cost reduction:
# 1. Shared ADX across network regions: save ~$100/month
# 2. Aggregate traffic model (not per-link): save ~$15/month ML
# 3. Re-optimize hourly instead of every 15 min: save ~$3/month Functions
# 4. Batch maintenance predictions weekly: save ~$7/month ML
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Shared ADX | ~$100/month | Multi-tenant queries |
| Aggregate model | ~$15/month | Less accurate per-link |
| Hourly optimization | ~$3/month | Slower response to congestion |
| Weekly maintenance | ~$7/month | Less frequent health checks |

## Step 8: Verify Tuning Impact

```bash
python evaluation/eval_traffic.py --test-data evaluation/data/traffic_history/
python evaluation/eval_routing.py --baseline evaluation/data/baseline_routing/ --optimized evaluation/data/optimized_routing/
python evaluation/eval_sla.py --test-data evaluation/data/sla_metrics/
python evaluation/eval_maintenance.py --test-data evaluation/data/equipment_failures/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Max utilization | baseline | < 80% | < 80% |
| Latency SLA | baseline | > 99.5% | > 99.5% |
| Failure prediction | baseline | > 75% | > 75% |
| Traffic MAPE | baseline | < 15% | < 15% |
| Monthly cost | ~$237 | ~$120 | < $300 |
