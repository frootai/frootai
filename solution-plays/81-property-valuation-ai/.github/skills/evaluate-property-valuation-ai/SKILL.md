---
name: "evaluate-property-valuation-ai"
description: "Evaluate Property Valuation AI — valuation accuracy, comp selection quality, adjustment calibration, bias testing, report quality."
---

# Evaluate Property Valuation AI

## Prerequisites

- Deployed valuation system (run `deploy-property-valuation-ai` skill first)
- Holdout test set with known sale prices (≥100 properties)
- Python 3.11+ with `scikit-learn`, `azure-ai-evaluation`

## Step 1: Evaluate Valuation Accuracy

```bash
python evaluation/eval_accuracy.py \
  --test-data evaluation/data/holdout_sales/ \
  --output evaluation/results/accuracy.json
```

Accuracy metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Median Absolute % Error** | Median of |estimate - actual| / actual | < 8% |
| **Within ±10%** | % of valuations within 10% of actual sale | > 75% |
| **Within ±15%** | % of valuations within 15% of actual sale | > 90% |
| **R²** | Coefficient of determination | > 0.85 |
| **No Systematic Bias** | Mean error near zero (not consistently high/low) | Mean error < 2% |

Accuracy by property type:
| Type | MAPE Target | Challenge |
|------|-------------|-----------|
| Single-family | < 7% | Good comp availability |
| Condo | < 8% | Building-specific factors |
| Townhouse | < 9% | Limited comps in some markets |
| Multi-family | < 12% | Income approach needed alongside comps |

## Step 2: Evaluate Comparable Selection

```bash
python evaluation/eval_comps.py \
  --test-data evaluation/data/comp_quality/ \
  --output evaluation/results/comps.json
```

Comp metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Comp Relevance** (appraiser judge) | Selected comps genuinely comparable | > 4.0/5.0 |
| **Recency** | Average age of selected comps | < 6 months |
| **Distance** | Average distance from subject | < 2 km |
| **Type Match** | Same property type as subject | 100% |
| **Sqft Similarity** | Within ±20% of subject | > 90% |
| **Comp Count** | Number of comps per valuation | ≥ 3, ≤ 7 |

## Step 3: Evaluate Adjustment Quality

```bash
python evaluation/eval_adjustments.py \
  --test-data evaluation/data/adjustments/ \
  --output evaluation/results/adjustments.json
```

Adjustment metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Net Adjustment** | Total adjustment as % of comp price | < 25% (USPAP guideline) |
| **Gross Adjustment** | Sum of absolute adjustments | < 30% |
| **Direction Accuracy** | Adjustment sign matches actual impact | > 85% |
| **Magnitude Accuracy** | Adjustment amount reasonable | Within ±30% of paired analysis |
| **No Over-Adjustment** | Single adjustment doesn't dominate | No single > 15% |

## Step 4: Evaluate Fair Lending / Bias

```bash
python evaluation/eval_bias.py \
  --test-data evaluation/data/demographics/ \
  --output evaluation/results/bias.json
```

Bias metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Disparate Impact Ratio** | Accuracy ratio across demographics | 0.80-1.25 (4/5ths rule) |
| **Geographic Parity** | Accuracy consistent across neighborhoods | Variance < 3% |
| **No Protected Features** | Model doesn't use race, ethnicity, religion | 100% excluded |
| **Proxy Variable Check** | No features highly correlated with protected class | Correlation < 0.3 |
| **ECOA Compliance** | Equal Credit Opportunity Act alignment | 100% |

## Step 5: Evaluate Report Quality

```bash
python evaluation/eval_reports.py \
  --test-data evaluation/data/reports/ \
  --output evaluation/results/reports.json
```

Report metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Groundedness** | Every claim references actual data | > 0.90 |
| **Professional Tone** | Appraisal-industry language | > 90% |
| **Comp References** | Specific comps cited with addresses | 100% |
| **Adjustment Transparency** | All adjustments explained | 100% |
| **Risk Factor Coverage** | Material risks noted (flood, condition) | > 85% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Valuation error distribution histogram
- Comp selection quality by distance/recency
- Adjustment factor calibration analysis
- Bias testing dashboard (disparate impact ratios)
- Report quality scorecard

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Median APE | < 8% | config/guardrails.json |
| Within ±10% | > 75% | config/guardrails.json |
| Net adjustment | < 25% | USPAP standard |
| Disparate impact | 0.80-1.25 | ECOA / Fair Housing |
| Groundedness | > 0.90 | fai-manifest.json |
