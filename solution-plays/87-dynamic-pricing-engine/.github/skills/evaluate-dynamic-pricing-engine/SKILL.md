---
name: "evaluate-dynamic-pricing-engine"
description: "Evaluate Dynamic Pricing Engine — revenue impact, elasticity accuracy, fairness compliance, A/B test validity, competitor alignment."
---

# Evaluate Dynamic Pricing Engine

## Prerequisites

- Deployed pricing engine (run `deploy-dynamic-pricing-engine` skill first)
- Baseline revenue data (pre-optimization, ≥30 days)
- Python 3.11+ with `azure-ai-evaluation`, `scipy`

## Step 1: Evaluate Revenue Impact

```bash
python evaluation/eval_revenue.py \
  --baseline evaluation/data/baseline_revenue/ \
  --optimized evaluation/data/optimized_revenue/ \
  --output evaluation/results/revenue.json
```

Revenue metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Revenue Lift** | Increase vs static pricing | > 5% |
| **Margin Improvement** | Margin per unit change | > 3% |
| **Conversion Rate** | Maintained or improved | No decrease > 2% |
| **Cart Abandonment** | Not increased by dynamic pricing | No increase > 3% |
| **Customer Lifetime Value** | Long-term customer retention | No decrease |

## Step 2: Evaluate Elasticity Model

```bash
python evaluation/eval_elasticity.py \
  --test-data evaluation/data/price_experiments/ \
  --output evaluation/results/elasticity.json
```

Elasticity metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Prediction Accuracy** | MAPE of demand prediction at given price | < 15% |
| **Direction Accuracy** | Price up → demand down (correct direction) | > 95% |
| **Cross-Product** | Correctly models substitution effects | > 75% |
| **Seasonal Adaptation** | Accuracy across seasons | Variance < 5% |
| **Feature Importance** | Top features match domain expectations | Expert validated |

## Step 3: Evaluate Pricing Fairness

```bash
python evaluation/eval_fairness.py \
  --test-data evaluation/data/pricing_logs/ \
  --output evaluation/results/fairness.json
```

Fairness metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **No Demographic Discrimination** | Same price regardless of user demographics | 100% |
| **Session Consistency** | Same price within a session | 100% |
| **Surge Cap Compliance** | Never exceeds 2x multiplier | 100% |
| **Margin Floor Compliance** | Never below 15% margin | 100% |
| **Daily Change Limit** | Never exceeds ±10% per day | 100% |
| **Price Gouging Protection** | No >50% increase during emergencies | 100% |

## Step 4: Evaluate A/B Testing

```bash
python evaluation/eval_ab_tests.py \
  --test-data evaluation/data/ab_results/ \
  --output evaluation/results/ab_tests.json
```

A/B metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Statistical Significance** | Tests reach p < 0.05 before decision | > 90% of tests |
| **Sample Size Adequacy** | ≥1000 sessions per variant | 100% |
| **Randomization Quality** | Even traffic split verified | Chi-square p > 0.05 |
| **Revenue Decision Accuracy** | Winner actually generates more revenue | > 85% |

## Step 5: Evaluate Competitor Alignment

```bash
python evaluation/eval_competitors.py \
  --test-data evaluation/data/competitor_prices/ \
  --output evaluation/results/competitors.json
```

Competitor metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Data Freshness** | Competitor prices < 24 hours old | > 90% |
| **Market Position Maintained** | Stays within ±10% of competitive set | > 85% |
| **No Undercutting Race** | Floor prevents unsustainable discounting | 100% |
| **Coverage** | Competitors tracked per product | ≥ 2 |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Revenue lift waterfall (static → dynamic by product category)
- Elasticity model accuracy scatter plot
- Fairness compliance checklist
- A/B test results dashboard
- Competitor positioning chart

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Revenue lift | > 5% | config/guardrails.json |
| No demographic discrimination | 100% | Responsible AI / legal |
| Margin floor | ≥ 15% | config/guardrails.json |
| Surge cap | ≤ 2x | config/guardrails.json |
| Daily change limit | ≤ 10% | config/guardrails.json |
