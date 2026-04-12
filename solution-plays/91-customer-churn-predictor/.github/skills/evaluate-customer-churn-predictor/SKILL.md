---
name: "evaluate-customer-churn-predictor"
description: "Evaluate Customer Churn Predictor — prediction accuracy, calibration, explainability quality, retention effectiveness, fairness."
---

# Evaluate Customer Churn Predictor

## Prerequisites

- Deployed churn predictor (run `deploy-customer-churn-predictor` skill first)
- Holdout test set with known churn outcomes (≥3 months follow-up)
- Python 3.11+ with `scikit-learn`, `azure-ai-evaluation`

## Step 1: Evaluate Prediction Accuracy

```bash
python evaluation/eval_accuracy.py \
  --test-data evaluation/data/holdout/ \
  --output evaluation/results/accuracy.json
```

Accuracy metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **AUC-ROC** | Area under ROC curve | > 0.85 |
| **Precision (high risk)** | High-risk customers who actually churn | > 60% |
| **Recall (high risk)** | Churners correctly identified as high risk | > 75% |
| **F1 Score** | Harmonic mean of precision + recall | > 0.65 |
| **Calibration** | Predicted 70% risk = ~70% actually churn | Brier score < 0.15 |

By customer segment:
| Segment | AUC Target | Challenge |
|---------|-----------|-----------|
| Enterprise | > 0.88 | Fewer customers, more complex signals |
| Mid-market | > 0.85 | Standard |
| SMB | > 0.80 | Higher natural churn, noisier signals |

## Step 2: Evaluate Explainability

```bash
python evaluation/eval_explainability.py \
  --test-data evaluation/data/explanations/ \
  --output evaluation/results/explainability.json
```

Explainability metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Driver Accuracy** | Top 3 drivers match actual churn reasons | > 70% |
| **Human Readability** | CSM team understands explanations | > 4.0/5.0 |
| **Actionability** | Drivers suggest specific retention actions | > 80% |
| **SHAP Consistency** | Same customer → same top drivers | 100% |

## Step 3: Evaluate Retention Effectiveness

```bash
python evaluation/eval_retention.py \
  --test-data evaluation/data/retention_outcomes/ \
  --output evaluation/results/retention.json
```

Retention metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Retention Lift** | Churn reduction vs no-action control | > 15% |
| **Action Conversion** | % customers who respond to retention offer | > 25% |
| **ROI** | Revenue saved / retention cost | > 3:1 |
| **False Positive Cost** | Retention spend on customers who wouldn't churn anyway | < 30% of budget |
| **Time to Action** | Hours from prediction to first retention contact | < 48 hours |

## Step 4: Evaluate Fairness

```bash
python evaluation/eval_fairness.py \
  --test-data evaluation/data/demographics/ \
  --output evaluation/results/fairness.json
```

Fairness metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Segment Parity** | Similar accuracy across customer segments | AUC variance < 0.05 |
| **No Demographic Bias** | Risk not correlated with protected attributes | Correlation < 0.1 |
| **Equal Retention Access** | All segments receive proportional retention actions | Disparity < 10% |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- ROC curve with operating point
- Calibration plot (predicted vs actual churn rate)
- SHAP summary plot (feature importance)
- Retention lift by playbook type
- Cohort risk distribution histogram

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| AUC-ROC | > 0.85 | config/guardrails.json |
| Retention lift | > 15% | config/guardrails.json |
| ROI | > 3:1 | config/guardrails.json |
| Calibration | Brier < 0.15 | config/guardrails.json |
| Segment parity | AUC var < 0.05 | Responsible AI |
