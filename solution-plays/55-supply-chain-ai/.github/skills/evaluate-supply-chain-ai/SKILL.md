---
name: "evaluate-supply-chain-ai"
description: "Evaluate Supply Chain AI quality — forecast MAPE/RMSE, supplier risk precision, inventory optimization savings, anomaly detection accuracy, external signal correlation."
---

# Evaluate Supply Chain AI

## Prerequisites

- Deployed supply chain pipeline (run `deploy-supply-chain-ai` skill first)
- Historical data for backtesting (min 12 months)
- Python 3.11+ with `scikit-learn`, `prophet`, `azure-ai-evaluation` packages

## Step 1: Prepare Evaluation Dataset

```bash
mkdir -p evaluation/data
# Backtesting: use last 3 months as holdout, train on prior 12 months
# evaluation/data/backtest-config.json
# {
#   "train_end": "2025-09-30",
#   "test_start": "2025-10-01",
#   "test_end": "2025-12-31",
#   "products": ["SKU-001", "SKU-002", "SKU-003"],
#   "suppliers": ["SUP-001", "SUP-002"]
# }
```

## Step 2: Evaluate Forecast Accuracy

```bash
python evaluation/eval_forecast.py \
  --backtest-config evaluation/data/backtest-config.json \
  --output evaluation/results/forecast.json
```

Forecast metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **MAPE** | Mean Absolute Percentage Error | < 15% |
| **RMSE** | Root Mean Square Error | Context-dependent |
| **Bias** | Systematic over/under prediction | < 5% |
| **CI Calibration** | % of actuals within 95% CI | > 90% |
| **Seasonal Capture** | Correctly models seasonality | > 85% |
| **Anomaly Detection Recall** | True anomalies caught | > 80% |

Forecast accuracy by product category:
| Category | Expected MAPE | Challenge |
|----------|--------------|----------|
| Stable demand (staples) | < 10% | Low variability |
| Seasonal (apparel, toys) | < 20% | Strong seasonal patterns |
| Promotional (electronics) | < 25% | Spike-driven, external signals key |
| New products (no history) | < 40% | Cold start problem |

## Step 3: Evaluate Supplier Risk

```bash
python evaluation/eval_supplier_risk.py \
  --test-data evaluation/data/suppliers/ \
  --output evaluation/results/supplier_risk.json
```

Supplier risk metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Risk Score Accuracy** | Matches historical outcomes | > 80% |
| **Recommendation Quality** | Maintain/diversify/replace correct | > 85% |
| **Early Warning** | Risk flagged before disruption | > 70% |
| **Factor Weighting** | Individual factors calibrated | Correlation > 0.6 |
| **Concentration Alert** | Single-source risk flagged | 100% |

## Step 4: Evaluate Inventory Optimization

```bash
python evaluation/eval_inventory.py \
  --test-data evaluation/data/inventory/ \
  --output evaluation/results/inventory.json
```

Inventory metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Service Level Achieved** | Orders filled from stock | > 95% |
| **Stockout Rate** | Out-of-stock occurrences | < 3% |
| **Overstock Rate** | Excess inventory (>2x safety stock) | < 10% |
| **Inventory Turns** | Annual turnover ratio | Improve by 10%+ |
| **Carrying Cost Reduction** | vs manual planning | > 15% savings |

## Step 5: Evaluate Anomaly Explanations

```bash
python evaluation/eval_explanations.py \
  --test-data evaluation/data/anomalies/ \
  --judge-model gpt-4o \
  --output evaluation/results/explanations.json
```

Explanation metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Relevance** (LLM judge) | Explanation addresses the anomaly | > 4.0/5.0 |
| **Actionability** (LLM judge) | Suggests what to do about it | > 3.5/5.0 |
| **Evidence Grounding** | Uses external signal data | > 80% |
| **Cause Accuracy** | Correct root cause identified | > 70% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| MAPE | < 15% | config/guardrails.json |
| CI calibration | > 90% | config/guardrails.json |
| Supplier risk accuracy | > 80% | config/guardrails.json |
| Service level | > 95% | config/guardrails.json |
| Stockout rate | < 3% | config/guardrails.json |
