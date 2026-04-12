---
name: "tune-ai-infrastructure-optimizer"
description: "Tune AI Infrastructure Optimizer — utilization thresholds, cost anomaly sensitivity, analysis frequency, GPU migration criteria, auto-scale triggers, SKU mapping."
---

# Tune AI Infrastructure Optimizer

## Prerequisites

- Deployed optimizer with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Utilization Thresholds

```json
// config/guardrails.json
{
  "right_sizing": {
    "cpu_underutilized_p95": 30,
    "cpu_overutilized_p95": 80,
    "gpu_underutilized_avg": 30,
    "memory_underutilized_pct": 40,
    "analysis_period_days": 30,
    "min_data_points": 500,
    "exclude_dev_resources": true
  },
  "cost_anomaly": {
    "daily_deviation_threshold_pct": 20,
    "weekly_deviation_threshold_pct": 15,
    "lookback_days": 30,
    "alert_channels": ["teams", "email"],
    "auto_investigate": true
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `cpu_underutilized_p95` | 30% | Lower = more aggressive downsizing |
| `gpu_underutilized_avg` | 30% | GPU is expensive — 30% is already generous |
| `daily_deviation_threshold_pct` | 20% | Lower = more anomaly alerts |
| `analysis_period_days` | 30 | Longer = more stable recommendations |
| `exclude_dev_resources` | true | false = analyze dev too (may have spiky patterns) |

### Threshold Tuning Guide
| Symptom | Adjustment |
|---------|------------|
| Too many downsize recommendations | Raise cpu_underutilized to 20% |
| Missing under-utilized GPUs | Lower gpu_underutilized to 20% |
| Too many cost alerts (noise) | Raise daily_deviation to 30% |
| Missing real cost spikes | Lower daily_deviation to 15% |
| Recommendations too aggressive | Increase analysis_period to 60 days |

## Step 2: Tune GPU-to-CPU Migration Criteria

```json
// config/agents.json
{
  "gpu_optimization": {
    "migration_threshold_avg_gpu": 30,
    "suggest_smaller_gpu_at": 50,
    "workload_types": {
      "inference": { "gpu_threshold": 40, "alternative": "cpu_with_onnx" },
      "training": { "gpu_threshold": 20, "alternative": "smaller_gpu" },
      "batch": { "gpu_threshold": 30, "alternative": "spot_instances" }
    },
    "onnx_conversion_supported": ["pytorch", "tensorflow", "huggingface"]
  }
}
```

GPU optimization guide:
| GPU Util | Workload | Recommendation | Savings |
|----------|----------|---------------|--------|
| < 20% | Inference | ONNX on CPU | ~80% |
| 20-40% | Inference | Smaller GPU (T4 vs A100) | ~50% |
| < 30% | Training | Spot instances for batch | ~60% |
| 40-70% | Any | Current GPU appropriate | — |
| > 70% | Any | Well-utilized | — |

## Step 3: Tune Auto-Scale Recommendations

```json
// config/agents.json
{
  "auto_scaling": {
    "recommend_when_cpu_p95_gt": 70,
    "scale_up_threshold": 70,
    "scale_down_threshold": 30,
    "cooldown_minutes": 5,
    "max_replicas_multiplier": 3,
    "scale_to_zero": false,
    "queue_based_scaling": true
  }
}
```

Auto-scale tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `scale_up_threshold` | 70% CPU | Lower = scale earlier (more cost) |
| `scale_down_threshold` | 30% CPU | Higher = scale down faster (save more) |
| `cooldown_minutes` | 5 | Lower = more responsive but more churn |
| `max_replicas_multiplier` | 3x | Higher = handle bigger spikes |
| `scale_to_zero` | false | true for dev/test (saves 100% idle cost) |

## Step 4: Tune Analysis Frequency

```json
// config/agents.json
{
  "scheduling": {
    "full_analysis": "weekly",
    "cost_anomaly_check": "daily",
    "gpu_utilization_check": "daily",
    "report_generation": "weekly",
    "auto_apply_safe_recommendations": false
  }
}
```

## Step 5: Cost of the Optimizer Itself

```python
# Infrastructure Optimizer cost:
# - Container Apps (1 replica): ~$30/month
# - Azure Monitor API calls: ~$5/month (within free tier for most)
# - Cost Management API: free
# - LLM explanations (gpt-4o-mini): ~$2/month
# - Total: ~$37/month
#
# Expected savings: 20-40% of AI workload spend
# If AI spend = $5000/month → $1000-2000 saved → ROI = 27-54x
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| Weekly analysis (not daily) | ~70% API cost | Slower detection |
| gpt-4o-mini for explanations | ~90% LLM cost | Simpler explanations |
| Exclude dev resources | ~40% analysis time | Dev not optimized |
| Auto-apply safe recommendations | ~100% manual effort | Risk of unexpected changes |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_rightsizing.py --subscription $SUBSCRIPTION_ID
python evaluation/eval_anomalies.py --subscription $SUBSCRIPTION_ID
python evaluation/eval_autoscale.py
python evaluation/eval_savings.py --baseline evaluation/data/baseline-costs.json

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Total savings | 0% | 20-40% | > 20% |
| GPU savings | 0% | 30-60% | > 30% |
| Anomaly detection | baseline | > 90% | > 90% |
| ROI | N/A | > 10x | > 10x |
