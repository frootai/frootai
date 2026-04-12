---
name: "evaluate-carbon-footprint-tracker"
description: "Evaluate Carbon Footprint Tracker quality — calculation accuracy, Scope 3 estimation quality, emission factor currency, reporting compliance, reduction recommendation actionability."
---

# Evaluate Carbon Footprint Tracker

## Prerequisites

- Deployed carbon tracker (run `deploy-carbon-footprint-tracker` skill first)
- Test company data with known emission baselines
- Python 3.11+ with `azure-ai-evaluation` package

## Step 1: Evaluate Calculation Accuracy

```bash
python evaluation/eval_calculations.py \
  --test-data evaluation/data/companies/ \
  --endpoint $CARBON_ENDPOINT \
  --output evaluation/results/accuracy.json
```

Calculation metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Scope 1 Accuracy** | Matches manual calculation | > 99% (deterministic) |
| **Scope 2 Location** | Correct grid factors applied | > 99% |
| **Scope 2 Market** | Supplier-specific factors used | > 95% |
| **Scope 3 Estimation** | Within range of verified data | Within ±25% |
| **Total Accuracy** | Combined all scopes | Within ±15% |
| **Data Lineage** | Every calculation traceable | 100% |

Scope accuracy expectations:
| Scope | Accuracy Level | Why |
|-------|---------------|-----|
| Scope 1 | 99%+ | Deterministic formula: fuel × factor |
| Scope 2 | 95-99% | Depends on grid factor accuracy |
| Scope 3 | 75-85% | Spend-based estimation with LLM classification |

## Step 2: Evaluate Scope 3 Classification

```bash
python evaluation/eval_scope3.py \
  --test-data evaluation/data/spend/ \
  --output evaluation/results/scope3.json
```

Scope 3 metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Spend Classification Accuracy** | Correct category assigned by LLM | > 85% |
| **Factor Selection** | Right emission factor for category | > 90% |
| **Coverage** | Spend categories with emission factors | > 95% |
| **Supplier Data Utilization** | Prefer actual over estimated | > 30% actual |

## Step 3: Evaluate Reporting Compliance

```bash
python evaluation/eval_reporting.py \
  --output evaluation/results/reporting.json
```

Reporting metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **GHG Protocol Compliance** | All required sections present | 100% |
| **CDP Alignment** | Questionnaire sections complete | > 90% |
| **TCFD Alignment** | Disclosure sections complete | > 90% |
| **Multi-Framework Consistency** | Same data across reports | 100% |
| **Emission Factor Currency** | Factors from latest year | 100% |

## Step 4: Evaluate Reduction Recommendations

```bash
python evaluation/eval_recommendations.py \
  --test-data evaluation/data/companies/ \
  --judge-model gpt-4o \
  --output evaluation/results/recommendations.json
```

Recommendation metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Relevance** (LLM judge) | Targets top emission sources | > 4.0/5.0 |
| **Actionability** (LLM judge) | Specific, implementable actions | > 4.0/5.0 |
| **ROI Estimate** | Cost-benefit reasonable | > 80% reasonable |
| **Timeframe Realism** | Implementation timeline feasible | > 85% |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Scope 1/2/3 accuracy breakdown
- LLM spend classification confusion matrix
- Reporting framework compliance checklist
- Reduction recommendation quality assessment
- Emission factor currency audit

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Scope 1 accuracy | > 99% | config/guardrails.json |
| Scope 3 estimation | Within ±25% | config/guardrails.json |
| Spend classification | > 85% | config/guardrails.json |
| GHG Protocol compliance | 100% | config/guardrails.json |
| Data lineage | 100% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
