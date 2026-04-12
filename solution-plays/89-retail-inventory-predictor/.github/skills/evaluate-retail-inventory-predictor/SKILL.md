---
name: "evaluate-retail-inventory-predictor"
description: "Evaluate Retail Inventory Predictor — forecast accuracy, stockout rate, overstock levels, replenishment timeliness, promotion effect accuracy."
---

# Evaluate Retail Inventory Predictor

## Prerequisites

- Deployed inventory predictor (run `deploy-retail-inventory-predictor` skill first)
- Holdout sales data (≥30 days actual vs predicted)
- Python 3.11+ with `scikit-learn`, `azure-ai-evaluation`

## Step 1: Evaluate Forecast Accuracy

```bash
python evaluation/eval_forecast.py \
  --test-data evaluation/data/sales_holdout/ \
  --output evaluation/results/forecast.json
```

Forecast metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **MAPE** | Mean Absolute Percentage Error | < 20% |
| **WMAPE** | Weighted MAPE (volume-weighted) | < 15% |
| **Bias** | Mean error (positive = over-forecast) | Within ±5% |
| **Forecast Value Added** | Better than naive (last week's sales) | > 15% improvement |
| **Promotion Lift Accuracy** | Actual vs predicted promotion lift | Within ±20% |

By demand pattern:
| Pattern | MAPE Target | Model |
|---------|-------------|-------|
| Fast movers (>5 units/day) | < 15% | LightGBM |
| Regular movers (1-5/day) | < 25% | LightGBM/Prophet |
| Slow movers (<1/day) | < 40% | Croston |
| New products (no history) | < 50% | Category-level baseline |

## Step 2: Evaluate Inventory Health

```bash
python evaluation/eval_inventory.py \
  --test-data evaluation/data/inventory_snapshots/ \
  --output evaluation/results/inventory.json
```

Inventory metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Stockout Rate** | % SKU-store-days with zero stock | < 3% |
| **Overstock Rate** | % SKU-stores with >90 days supply | < 10% |
| **Days of Supply** | Average inventory coverage | 14-28 days |
| **Inventory Turnover** | Annual turns | > 8x (category-dependent) |
| **Dead Stock %** | Items with no sales in 90 days | < 5% |

## Step 3: Evaluate Replenishment Quality

```bash
python evaluation/eval_replenishment.py \
  --test-data evaluation/data/purchase_orders/ \
  --output evaluation/results/replenishment.json
```

Replenishment metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Reorder Timeliness** | Orders placed before stockout | > 95% |
| **Order Quantity Accuracy** | Actual vs recommended qty match | Within ±20% |
| **Service Level Achieved** | Fill rate (demand met from stock) | > 95% |
| **Emergency Order Rate** | Rush orders due to unexpected stockout | < 5% |
| **Supplier Lead Time Accuracy** | Actual vs estimated lead time | Within ±1 day |

## Step 4: Evaluate Promotion Modeling

```bash
python evaluation/eval_promotions.py \
  --test-data evaluation/data/promotion_results/ \
  --output evaluation/results/promotions.json
```

Promotion metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Lift Prediction Accuracy** | Predicted vs actual sales lift | Within ±20% |
| **Post-Promo Dip Captured** | Correctly predicts demand dip after promo | > 75% |
| **Promo Stockout Rate** | Out of stock during promotion | < 2% |
| **Cannibalization Detection** | Cross-product effects identified | > 60% |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Forecast accuracy by demand pattern heatmap
- Stockout timeline per store
- Overstock aging analysis
- Replenishment timeliness Gantt chart
- Promotion lift predicted vs actual scatter plot

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| WMAPE | < 15% | config/guardrails.json |
| Stockout rate | < 3% | config/guardrails.json |
| Service level | > 95% | config/guardrails.json |
| Overstock rate | < 10% | config/guardrails.json |
| Promo stockout | < 2% | config/guardrails.json |
