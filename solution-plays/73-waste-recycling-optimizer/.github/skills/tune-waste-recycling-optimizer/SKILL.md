---
name: "tune-waste-recycling-optimizer"
description: "Tune Waste Recycling Optimizer — classification thresholds, contamination sensitivity, route parameters, collection scheduling, recovery targets, cost optimization."
---

# Tune Waste Recycling Optimizer

## Prerequisites

- Deployed waste system with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Classification Model

```json
// config/guardrails.json — classification settings
{
  "classification": {
    "confidence_threshold": 0.75,
    "low_confidence_action": "manual_sort",
    "category_overrides": {
      "electronic_waste": {"confidence_threshold": 0.60, "reason": "safety-critical"},
      "hazardous": {"confidence_threshold": 0.50, "reason": "always err on caution"}
    },
    "model_format": "onnx",
    "max_inference_ms": 100,
    "augmentation": {
      "rotation": 15,
      "brightness": 0.2,
      "flip_horizontal": true
    }
  }
}
```

Classification tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `confidence_threshold` | 0.75 | Lower = more auto-sorted (risk misclassification) |
| `electronic_waste` threshold | 0.60 | Lower = catch more e-waste (critical safety) |
| `hazardous` threshold | 0.50 | Must stay low — safety-critical |
| `max_inference_ms` | 100 | Higher allows larger model (better accuracy) |

### Confidence vs. Action Matrix
| Confidence | Category | Action |
|-----------|----------|--------|
| > 0.90 | Any | Auto-sort to material bin |
| 0.75-0.90 | Recyclable | Auto-sort with logging |
| 0.75-0.90 | Hazardous/E-waste | Manual inspection |
| 0.50-0.75 | Any | Manual sort queue |
| < 0.50 | Any | Reject to general waste |

## Step 2: Tune Contamination Detection

```json
// config/guardrails.json — contamination settings
{
  "contamination": {
    "thresholds": {
      "food_residue": 0.30,
      "liquid_presence": 0.20,
      "mixed_materials": 0.40,
      "hazardous_label": 0.10
    },
    "batch_rejection_threshold": 0.15,
    "contamination_rate_alert": 0.10,
    "auto_reject_on_hazardous": true
  }
}
```

Contamination tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `food_residue` threshold | 0.30 | Lower = reject more (cleaner output, more waste) |
| `hazardous_label` threshold | 0.10 | Keep very low — safety-critical |
| `batch_rejection_threshold` | 15% | If >15% of batch contaminated, reject entire batch |
| `auto_reject_on_hazardous` | true | Never auto-sort if hazardous detected |

## Step 3: Tune Route Optimization

```json
// config/agents.json — route settings
{
  "route_optimization": {
    "fill_level_collection_trigger_pct": 70,
    "max_stops_per_route": 40,
    "operating_hours": {"start": "06:00", "end": "18:00"},
    "truck_capacity_kg": 8000,
    "zone_partitioning": true,
    "consider_traffic": true,
    "priority_locations": ["hospitals", "schools", "restaurants"],
    "collection_frequency": {
      "commercial": "daily",
      "residential": "twice_weekly",
      "industrial": "on_demand"
    }
  }
}
```

Route tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `fill_level_collection_trigger_pct` | 70% | Lower = collect more often (less overflow, higher cost) |
| `max_stops_per_route` | 40 | Higher = longer route, fewer trucks needed |
| `consider_traffic` | true | false = faster solve, suboptimal real-world routes |
| `priority_locations` | hospitals, schools | Collect these first regardless of fill level |

### Collection Frequency Profiles
| Zone Type | Default | Adjust When |
|-----------|---------|-------------|
| Commercial | Daily | High food waste → twice daily |
| Residential | Twice weekly | Hot season → 3× weekly (organic decomposition) |
| Industrial | On-demand (sensor) | Predictable output → fixed schedule cheaper |
| Events | Ad-hoc | Post-event cleanup within 4 hours |

## Step 4: Tune Recovery Targets

```json
// config/agents.json — circular economy targets
{
  "recovery_targets": {
    "plastic": {"target": 0.50, "current": null, "benchmark": 0.45},
    "metal": {"target": 0.70, "current": null, "benchmark": 0.65},
    "paper": {"target": 0.65, "current": null, "benchmark": 0.60},
    "glass": {"target": 0.80, "current": null, "benchmark": 0.75},
    "organic": {"target": 0.60, "current": null, "benchmark": 0.50},
    "overall": {"target": 0.55, "current": null, "benchmark": 0.50}
  },
  "reporting": {
    "cadence": "monthly",
    "include_trends": true,
    "benchmark_source": "EU Waste Framework Directive"
  }
}
```

| Material | Target | EU Benchmark | Lever to Improve |
|----------|--------|-------------|-----------------|
| Plastic | 50% | 45% | Better sorting + contamination reduction |
| Metal | 70% | 65% | Magnetic separation efficiency |
| Paper | 65% | 60% | Reduce liquid contamination |
| Glass | 80% | 75% | Color sorting accuracy |
| Organic | 60% | 50% | Source separation education |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "analytics_narrative": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 2000
  },
  "anomaly_report": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 500
  },
  "collection_summary": {
    "model": "gpt-4o-mini",
    "temperature": 0.1,
    "max_tokens": 300
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Analytics narrative | gpt-4o | Quality monthly reporting for stakeholders |
| Anomaly report | gpt-4o-mini | Simple pattern detection, high volume |
| Collection summary | gpt-4o-mini | Routine daily summaries |

## Step 6: Cost Optimization

```python
# Waste Recycling Optimizer cost breakdown:
# Computer Vision:
#   - Custom Vision training: ~$2/1000 images (one-time)
#   - ONNX inference: FREE (runs on-device or Container Apps)
# IoT & Routing:
#   - IoT Hub S1: ~$25/month (500 bins × 6 reports/day)
#   - Azure Maps: ~$15/month (route optimization queries)
# LLM (analytics only):
#   - gpt-4o (monthly report): ~$0.30/month
#   - gpt-4o-mini (daily summaries): ~$3/month
# Infrastructure:
#   - Container Apps: ~$15/month
#   - Cosmos DB Serverless: ~$10/month
#   - Storage: ~$5/month
# Total: ~$73/month

# Cost reduction:
# 1. ONNX on-device = zero inference cost (already planned)
# 2. Reduce IoT report frequency (6/day → 4/day = save 33% IoT)
# 3. Batch route optimization (hourly → per-shift = save 60% Maps)
# 4. Skip LLM for routine summaries (template-based = save $3/month)
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| ONNX edge inference | ~$50/month vs cloud vision | Requires edge device |
| Reduce IoT frequency | ~$8/month | Slower fill-level updates |
| Batch routing | ~$9/month Maps | Less real-time route adaptation |
| Template summaries | ~$3/month LLM | Less natural language quality |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_classification.py --test-data evaluation/data/images/
python evaluation/eval_contamination.py --test-data evaluation/data/contamination/
python evaluation/eval_routes.py --test-data evaluation/data/routes/
python evaluation/eval_fill_prediction.py --test-data evaluation/data/fill_levels/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Classification accuracy | baseline | > 90% | > 90% |
| Route distance savings | baseline | > 20% | > 20% |
| Recovery rate | baseline | > 55% | > 55% |
| Contamination detection | baseline | > 90% | > 90% |
| Monthly cost | ~$73 | ~$55 | < $80 |
