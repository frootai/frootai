---
name: "tune-precision-agriculture-agent"
description: "Tune Precision Agriculture Agent — NDVI thresholds, stress classification, irrigation scheduling, yield model features, variable-rate prescriptions, cost optimization."
---

# Tune Precision Agriculture Agent

## Prerequisites

- Deployed agriculture agent with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune NDVI & Vegetation Index Thresholds

```json
// config/guardrails.json — vegetation index settings
{
  "vegetation_indices": {
    "ndvi_stress_threshold": 0.3,
    "ndvi_healthy_min": 0.5,
    "ndvi_delta_alert": -0.15,
    "ndwi_drought_threshold": 0.1,
    "evi_dense_canopy_use": true,
    "cloud_mask_confidence": 0.8,
    "min_clear_pixels_pct": 60
  }
}
```

NDVI tuning by crop type:
| Crop | Stress Threshold | Healthy Min | Peak NDVI |
|------|-----------------|-------------|-----------|
| Corn | 0.35 | 0.55 | 0.85 |
| Wheat | 0.30 | 0.50 | 0.80 |
| Soybean | 0.30 | 0.50 | 0.75 |
| Rice (paddy) | 0.25 | 0.45 | 0.70 |
| Cotton | 0.30 | 0.45 | 0.70 |

| Parameter | Default | Impact |
|-----------|---------|--------|
| `ndvi_stress_threshold` | 0.3 | Lower = fewer alerts (risk missing stress) |
| `ndvi_delta_alert` | -0.15/week | More negative = only catch severe declines |
| `min_clear_pixels_pct` | 60% | Lower = accept cloudier images (noisier) |

## Step 2: Tune Stress Classification

```json
// config/agents.json — stress detection settings
{
  "stress_classification": {
    "method": "ensemble",
    "models": ["spectral_rules", "custom_vision", "random_forest"],
    "confidence_threshold": 0.65,
    "require_temporal_confirmation": true,
    "temporal_lookback_weeks": 3,
    "correlate_with_weather": true,
    "correlate_with_soil": true,
    "stress_priority": ["pest", "disease", "drought", "nutrient", "waterlogging"]
  }
}
```

Classification tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `confidence_threshold` | 0.65 | Lower = more detections (more false positives) |
| `require_temporal_confirmation` | true | false = faster detection, risk false alarms |
| `correlate_with_weather` | true | Eliminates weather-caused false positives |
| `temporal_lookback_weeks` | 3 | Shorter = faster detection, less context |

### Stress Diagnosis Decision Tree
| Observation | + Weather | + Soil | Diagnosis |
|------------|-----------|--------|-----------|
| NDVI drop + low NDWI | High temp, no rain | Low moisture | Drought |
| Patchy NDVI, random | Normal weather | Normal soil | Pest |
| Circular NDVI decline | Humid, warm | Normal | Disease |
| Uniform yellowing | Normal | Low N | Nitrogen deficiency |
| Low spots stressed | Recent heavy rain | Saturated | Waterlogging |

## Step 3: Tune Irrigation Scheduling

```json
// config/agents.json — irrigation settings
{
  "irrigation": {
    "method": "variable_rate",
    "zone_size_m": 30,
    "soil_moisture_target_pct": 65,
    "wilting_point_pct": 25,
    "field_capacity_pct": 85,
    "rain_forecast_window_days": 3,
    "rain_discount_factor": 0.8,
    "irrigation_efficiency_pct": 85,
    "scheduling": {
      "min_interval_hours": 24,
      "max_deficit_mm": 30,
      "night_irrigation_preferred": true
    }
  }
}
```

Irrigation tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `soil_moisture_target_pct` | 65% | Higher = more water, lower water stress risk |
| `rain_discount_factor` | 0.8 | Lower = trust forecast less, irrigate more conservatively |
| `irrigation_efficiency_pct` | 85% | Lower = apply more to compensate for loss |
| `zone_size_m` | 30m | Smaller = finer variable-rate, more complex |

### Crop Water Requirement by Stage
| Growth Stage | Water Need (mm/day) | Duration (days) |
|-------------|--------------------|-----------------| 
| Germination | 3 | 10-14 |
| Vegetative | 5 | 30-40 |
| Flowering | 7 (peak) | 15-20 |
| Grain Fill | 6 | 20-30 |
| Maturity | 3 (declining) | 15-20 |

## Step 4: Tune Yield Prediction

```json
// config/agents.json — yield model settings
{
  "yield_prediction": {
    "model_type": "gradient_boosting",
    "features": ["ndvi_timeseries", "weather_history", "soil_data",
                  "crop_type", "planting_date", "fertilizer_applied"],
    "ndvi_resolution": "weekly",
    "prediction_start_growth_pct": 30,
    "retrain_cadence": "post_harvest",
    "ensemble_with_historical_avg": true,
    "historical_weight": 0.2
  }
}
```

| Parameter | Default | Impact |
|-----------|---------|--------|
| `ndvi_resolution` | weekly | bi-weekly = less data, less compute |
| `prediction_start_growth_pct` | 30% | Earlier = less accurate but more lead time |
| `ensemble_with_historical_avg` | true | Stabilizes predictions in data-sparse regions |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "recommendation_generation": {
    "model": "gpt-4o",
    "temperature": 0.2,
    "max_tokens": 500
  },
  "anomaly_explanation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 300
  },
  "report_generation": {
    "model": "gpt-4o-mini",
    "temperature": 0.3,
    "max_tokens": 1000
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Recommendation | gpt-4o | Critical: wrong advice can damage crops |
| Anomaly explanation | gpt-4o-mini | Simpler pattern matching |
| Report generation | gpt-4o-mini | Routine summaries |

## Step 6: Cost Optimization

```python
# Precision Agriculture Agent cost per field per month:
# Imagery:
#   - Sentinel-2: FREE (Copernicus Open Access Hub, 5-day revisit)
#   - Drone imagery processing: ~$5/flight (if using drone)
# Sensors:
#   - IoT Hub S1: ~$25/month (shared across fields)
#   - Soil sensors: ~$2/month per sensor (hardware amortized)
# Compute:
#   - NDVI calculation: ~$0.01/image (Azure Functions)
#   - Custom Vision: ~$2/1000 images
#   - Azure ML (yield model): ~$10/month (shared training)
# LLM:
#   - Recommendations (gpt-4o, ~4/month × $0.03): ~$0.12
#   - Reports (gpt-4o-mini, weekly): ~$0.04
# Infrastructure:
#   - Data Explorer Dev: ~$130/month (shared)
#   - Container Apps: ~$15/month
# Total per field: ~$15-25/month + shared infra

# Cost reduction:
# 1. Sentinel-2 (free) instead of commercial satellite imagery
# 2. Process only changed areas (delta NDVI) — save 60% compute
# 3. Reduce IoT report frequency (4/day → 2/day = 50% savings)
# 4. Batch yield predictions (weekly, not daily)
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Sentinel-2 (free) | vs $500/image commercial | 10m resolution vs 30cm |
| Delta NDVI processing | ~60% compute | May miss subtle changes |
| Reduce IoT frequency | ~50% IoT cost | Less granular soil data |
| Shared infra (multi-field) | ~80% per field | Requires multi-tenant design |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_crop_health.py --test-data evaluation/data/fields/
python evaluation/eval_stress.py --test-data evaluation/data/stress_samples/
python evaluation/eval_irrigation.py --test-data evaluation/data/irrigation/
python evaluation/eval_yield.py --test-data evaluation/data/yield_history/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| NDVI correlation | baseline | > 0.90 | > 0.90 |
| Stress detection | baseline | > 85% | > 85% |
| Water savings | baseline | > 20% | > 20% |
| Yield MAPE | baseline | < 15% | < 15% |
| Cost per field/month | ~$25 | ~$15 | < $30 |
