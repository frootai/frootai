---
name: "tune-realtime-event-ai"
description: "Tune Real-Time Event AI — batch size, anomaly thresholds, LLM-to-rule ratio, consumer scaling, alert aggregation, checkpoint intervals, cost optimization."
---

# Tune Real-Time Event AI

## Prerequisites

- Deployed event pipeline with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-realtime-event-ai` skill

## Step 1: Tune Event Processing

### Batch and Checkpoint Configuration
```json
// config/agents.json
{
  "processing": {
    "batch_size": 50,
    "max_wait_time_seconds": 5,
    "checkpoint_interval_batches": 10,
    "dedup_cache_size": 100000,
    "dedup_cache_ttl_seconds": 3600
  },
  "consumers": {
    "min_replicas": 2,
    "max_replicas": 8,
    "scale_up_threshold": 100,
    "scale_down_delay_seconds": 300,
    "partition_count": 8
  },
  "dlq": {
    "enabled": true,
    "max_retry_count": 3,
    "retry_delay_seconds": 30,
    "retention_days": 14
  }
}
```

Tuning levers:
| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| `batch_size` | 50 | 10-500 | Larger = higher throughput, higher latency |
| `max_wait_time_seconds` | 5 | 1-30 | Lower = faster at low volume, more overhead |
| `checkpoint_interval_batches` | 10 | 1-100 | Higher = fewer writes, more reprocessing on crash |
| `dedup_cache_size` | 100K | 10K-1M | Larger = more memory, better dedup |
| `scale_up_threshold` | 100 | 10-1000 | Lower = faster scaling, more replicas |

### Batch Size Optimization
| Batch Size | Throughput | P50 Latency | LLM Efficiency | Memory |
|-----------|-----------|-------------|----------------|--------|
| 10 | ~500 evt/s | ~50ms | Low (small batches) | Low |
| 50 | ~1000 evt/s | ~100ms | Good | Moderate |
| 200 | ~2000 evt/s | ~300ms | Best | High |
| 500 | ~3000 evt/s | ~800ms | Best | Very high |

Recommendation: Start with 50, increase if throughput < target and latency budget allows.

## Step 2: Tune Anomaly Detection

### Threshold Configuration
```json
// config/guardrails.json
{
  "anomaly": {
    "detection_method": "rolling_zscore",
    "sigma_threshold": 3.0,
    "alert_threshold": 0.8,
    "window_size": 1000,
    "min_window_fill": 100,
    "adaptive": {
      "enabled": true,
      "decay_rate": 0.001,
      "seasonal_adjustment": false,
      "seasonal_period": 86400
    }
  },
  "pattern_matching": {
    "enabled": true,
    "rules_file": "config/patterns.json",
    "max_pattern_depth": 5,
    "correlation_window_seconds": 60
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `sigma_threshold` | 3.0 | Lower = more sensitive, more false positives |
| `alert_threshold` | 0.8 | Lower = earlier alerts, more noise |
| `window_size` | 1000 | Larger = more stable baseline, slower adaptation |
| `decay_rate` | 0.001 | Higher = faster adaptation to new baseline |
| `seasonal_adjustment` | false | true = handle daily/weekly patterns |
| `correlation_window_seconds` | 60 | Larger = detect slower correlations |

### Anomaly Threshold Tuning Guide
| Symptom | Adjustment |
|---------|-----------|
| Too many false positives (>5%) | Increase sigma_threshold to 3.5-4.0 |
| Missing real anomalies (<90% recall) | Decrease sigma_threshold to 2.5 |
| Alerts for seasonal patterns | Enable seasonal_adjustment |
| Slow baseline adaptation | Increase decay_rate to 0.01 |
| Noisy baselines | Increase window_size to 5000 |

## Step 3: Tune LLM Enrichment

### LLM Configuration
```json
// config/openai.json
{
  "enrichment": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 100,
    "batch_size": 50,
    "system_prompt": "Classify the following event into one of: normal_reading, sensor_fault, anomaly, maintenance, configuration_change. Return JSON: {class, confidence}."
  },
  "rules": {
    "priority": "rules_first",
    "llm_fallback_threshold": 0.7,
    "max_llm_rate": 0.10,
    "cache_llm_results": true,
    "cache_ttl_seconds": 3600
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `model` | gpt-4o-mini | gpt-4o for higher accuracy, mini for cost |
| `batch_size` | 50 | Larger batches = fewer API calls, higher latency |
| `max_llm_rate` | 0.10 (10%) | Cap on % of events sent to LLM |
| `cache_llm_results` | true | Avoid re-classifying similar events |
| `llm_fallback_threshold` | 0.7 | Rule confidence below this → LLM |

### Rule vs LLM Decision Table
| Scenario | Method | Why |
|----------|--------|-----|
| Known event types (>90% of traffic) | Rules | Free, instant, deterministic |
| New/unknown event types (<10%) | LLM batch | Accurate but expensive |
| Ambiguous events (rule confidence <0.7) | LLM | Rules uncertain, LLM resolves |
| High-volume burst | Rules only | LLM can't keep up |
| New category discovery | LLM → add rule | LLM classifies, then codify as rule |

## Step 4: Tune Alert Aggregation

```json
// config/alerts.json
{
  "aggregation": {
    "enabled": true,
    "window_seconds": 60,
    "min_events_to_alert": 3,
    "group_by": ["device_id", "classification"],
    "cooldown_seconds": 300,
    "max_alerts_per_hour": 20
  },
  "severity": {
    "critical": { "threshold": 0.95, "channels": ["pagerduty", "teams", "email"] },
    "high": { "threshold": 0.85, "channels": ["teams", "email"] },
    "medium": { "threshold": 0.75, "channels": ["teams"] },
    "low": { "threshold": 0.60, "channels": ["log_only"] }
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `min_events_to_alert` | 3 | Higher = fewer alerts, may miss single anomalies |
| `cooldown_seconds` | 300 | Higher = fewer duplicates, may miss new incidents |
| `max_alerts_per_hour` | 20 | Prevents alert fatigue |
| `group_by` | device_id, classification | Group related events into one alert |
| Severity thresholds | 0.60-0.95 | Adjust per business criticality |

## Step 5: Cost Optimization

```python
# Real-time event AI cost breakdown (1M events/day):
# - Event Hubs Standard: ~$22/month (1 TU)
# - LLM enrichment (10% of events, gpt-4o-mini): ~$3/day
# - Container Apps (2 replicas): ~$60/month
# - Storage (checkpoints + archive): ~$5/month
# - Total: ~$180/month for 1M events/day

# Cost reduction strategies:
# 1. Reduce LLM rate from 10% to 5% with better rules
# 2. Use gpt-4o-mini instead of gpt-4o (90% cheaper)
# 3. Cache LLM classifications (reduce repeat calls by 40%)
# 4. Batch larger (200 events) to reduce API overhead
# 5. Scale consumers to 0 during low-traffic periods
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| LLM rate 10%→5% | ~50% LLM cost | Need more rules coverage |
| gpt-4o-mini for enrichment | ~90% per LLM call | Slightly lower accuracy |
| Cache LLM results | ~40% LLM calls | Stale classifications possible |
| Larger batch size | ~20% API overhead | Higher latency per event |
| Scale to 0 off-peak | ~30% compute | Cold start on first event |
| Event Hub Basic tier | ~60% EH cost | No consumer groups (single consumer) |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_throughput.py --test-data evaluation/data/
python evaluation/eval_enrichment.py --test-data evaluation/data/
python evaluation/eval_anomaly.py --test-data evaluation/data/
python evaluation/eval_reliability.py --test-data evaluation/data/
python evaluation/eval_alerts.py --test-data evaluation/data/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Throughput | baseline | +30-50% | > 1000 evt/s |
| Anomaly F1 | baseline | +5-10% | > 85% |
| False positive rate | baseline | -3-5% | < 5% |
| LLM usage rate | ~10% | ~5% | < 10% |
| Alert precision | baseline | +10-15% | > 85% |
| Cost per 1M events | baseline | -30-40% | < $10/day |
