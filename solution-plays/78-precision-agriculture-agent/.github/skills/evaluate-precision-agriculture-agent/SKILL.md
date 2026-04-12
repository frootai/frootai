---
name: "evaluate-precision-agriculture-agent"
description: "Evaluate Precision Agriculture Agent — NDVI accuracy, stress detection, pest/disease classification, irrigation efficiency, yield prediction."
---

# Evaluate Precision Agriculture Agent

## Prerequisites

- Deployed agriculture agent (run `deploy-precision-agriculture-agent` skill first)
- Ground-truth field data (GPS-tagged observations)
- Python 3.11+ with `scikit-learn`, `rasterio`, `azure-ai-evaluation`

## Step 1: Evaluate Crop Health Monitoring

```bash
python evaluation/eval_crop_health.py \
  --test-data evaluation/data/fields/ \
  --output evaluation/results/crop_health.json
```

Crop health metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **NDVI Accuracy** | Matches ground-truth spectrometer readings | Correlation > 0.90 |
| **Stress Zone Detection** | Known stressed areas identified | > 85% |
| **False Alarm Rate** | Healthy areas flagged as stressed | < 10% |
| **Temporal Consistency** | Week-to-week NDVI changes plausible | No jumps > 0.2 |
| **Cloud Mask Accuracy** | Correctly identifies cloud-covered pixels | > 95% |

## Step 2: Evaluate Stress Classification

```bash
python evaluation/eval_stress.py \
  --test-data evaluation/data/stress_samples/ \
  --output evaluation/results/stress.json
```

Stress classification metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Overall Accuracy** | Correct stress cause identified | > 80% |
| **Drought Detection** | Correctly identifies water stress | > 85% |
| **Pest Detection** | Correctly identifies pest damage | > 75% |
| **Disease Detection** | Correctly identifies disease | > 75% |
| **Nutrient Deficiency** | Correctly identifies N/P/K deficiency | > 70% |
| **Confusion Matrix** | Pest vs disease distinction | < 15% confusion |

## Step 3: Evaluate Irrigation Optimization

```bash
python evaluation/eval_irrigation.py \
  --test-data evaluation/data/irrigation/ \
  --output evaluation/results/irrigation.json
```

Irrigation metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Water Savings** | vs. uniform irrigation baseline | > 20% |
| **Stress Prevention** | Fields don't reach wilting point | > 95% |
| **Variable-Rate Accuracy** | Zone-level prescription matches need | Within ±15% |
| **Weather Integration** | Rain forecast reduces irrigation | > 90% adjusted |
| **Over-Irrigation Rate** | Excess water applied | < 10% |

## Step 4: Evaluate Yield Prediction

```bash
python evaluation/eval_yield.py \
  --test-data evaluation/data/yield_history/ \
  --output evaluation/results/yield.json
```

Yield metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **MAPE** | Mean Absolute Percentage Error | < 15% |
| **R²** | Coefficient of determination | > 0.75 |
| **Early Season Accuracy** | Prediction at 50% growth stage | < 25% MAPE |
| **Late Season Accuracy** | Prediction at 80% growth stage | < 10% MAPE |
| **By Crop Type** | Accuracy varies by crop | Within targets per crop |

## Step 5: Evaluate Recommendation Quality

```bash
python evaluation/eval_recommendations.py \
  --test-data evaluation/data/recommendations/ \
  --output evaluation/results/recommendations.json
```

Recommendation metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Agronomic Validity** (expert judge) | Recommendation is scientifically sound | > 85% |
| **Actionability** | Farmer can execute the recommendation | > 90% |
| **Timeliness** | Recommendation arrives before critical window | > 95% |
| **No Harmful Advice** | No recommendations that damage crop/soil | 100% |
| **Groundedness** | Based on actual sensor/imagery data | > 0.85 |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- NDVI accuracy scatter plot (predicted vs ground truth)
- Stress classification confusion matrix
- Irrigation savings comparison chart
- Yield prediction error by growth stage
- Variable-rate prescription map visualization

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| NDVI correlation | > 0.90 | config/guardrails.json |
| Stress detection | > 85% | config/guardrails.json |
| Water savings | > 20% | config/guardrails.json |
| Yield MAPE | < 15% | config/guardrails.json |
| No harmful advice | 100% | Responsible AI |
