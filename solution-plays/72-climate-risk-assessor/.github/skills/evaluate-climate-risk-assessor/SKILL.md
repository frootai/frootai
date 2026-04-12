---
name: "evaluate-climate-risk-assessor"
description: "Evaluate Climate Risk Assessor — physical risk accuracy, transition risk coverage, scenario consistency, TCFD alignment, financial impact grounding."
---

# Evaluate Climate Risk Assessor

## Prerequisites

- Deployed climate risk system (run `deploy-climate-risk-assessor` skill first)
- Test companies with known risk profiles (verified by climate consultants)
- Python 3.11+ with `azure-ai-evaluation`, `geopandas`

## Step 1: Evaluate Physical Risk Scoring

```bash
python evaluation/eval_physical_risk.py \
  --test-data evaluation/data/locations/ \
  --output evaluation/results/physical.json
```

Physical risk metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Flood Score Accuracy** | Matches WRI Aqueduct reference | Correlation > 0.85 |
| **Heat Stress Accuracy** | Matches CMIP6 projections | Within ±10% |
| **Sea Level Match** | Matches IPCC AR6 tide gauge data | Within ±0.1m |
| **Wildfire Correlation** | Matches historical fire perimeters | AUC > 0.80 |
| **Location Resolution** | Asset-level (not country-level) | 100% at lat/lon |
| **Composite Score Consistency** | Same inputs → same score | Variance < 2% |

## Step 2: Evaluate Transition Risk Analysis

```bash
python evaluation/eval_transition_risk.py \
  --test-data evaluation/data/companies/ \
  --output evaluation/results/transition.json
```

Transition risk metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Sector Coverage** | Sectors with transition risk models | > 15 sectors |
| **Carbon Price Accuracy** | NGFS scenario alignment | Matches NGFS v4 ±5% |
| **Stranded Asset Detection** | Known high-carbon assets flagged | > 90% |
| **Market Shift Signals** | Identified for relevant sectors | > 85% |
| **Opportunity Detection** | Climate opportunities identified per TCFD | > 80% |

## Step 3: Evaluate Scenario Modeling

```bash
python evaluation/eval_scenarios.py \
  --test-data evaluation/data/scenarios/ \
  --output evaluation/results/scenarios.json
```

Scenario metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Scenario Count** | Number of distinct scenarios modeled | ≥ 3 (orderly, disorderly, hot house) |
| **Time Horizon Coverage** | Short + medium + long term modeled | All 3 |
| **Scenario Differentiation** | Different scenarios produce different risk scores | Spread > 20% |
| **NGFS Alignment** | Scenarios match NGFS reference values | > 95% |
| **Pathway Consistency** | Intermediate years follow logical progression | Monotonic where expected |

## Step 4: Evaluate TCFD Report Quality

```bash
python evaluation/eval_tcfd.py \
  --test-data evaluation/data/reports/ \
  --output evaluation/results/tcfd.json
```

TCFD metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Pillar Coverage** | All 4 TCFD pillars addressed | 100% |
| **Recommendation Count** | 11 TCFD recommendations addressed | ≥ 8/11 |
| **Groundedness** | Claims reference actual data/models | > 0.85 |
| **Actionability** (LLM judge) | Recommendations are specific + implementable | > 4.0/5.0 |
| **No Greenwashing** | No unsubstantiated positive claims | 100% |
| **Financial Quantification** | Risk impacts expressed in monetary terms | > 80% of risks |

## Step 5: Evaluate Financial Impact Grounding

```bash
python evaluation/eval_financial.py \
  --test-data evaluation/data/financials/ \
  --output evaluation/results/financial.json
```

Financial metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Revenue Impact Range** | Plausible range from climate models (not LLM) | 100% grounded |
| **Cost Impact Accuracy** | Carbon pricing impact on operating costs | Within ±15% |
| **Asset Value at Risk** | Physical risk → asset impairment quantified | > 80% of exposed assets |
| **No Hallucinated Numbers** | Every financial figure traceable to source | 100% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Physical risk heatmap by location × hazard
- Transition risk matrix by factor × scenario
- TCFD pillar coverage spider chart
- Financial impact waterfall (revenue, cost, asset)
- Scenario comparison dashboard

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Physical risk correlation | > 0.85 | config/guardrails.json |
| TCFD pillar coverage | 100% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
| No hallucinated numbers | 100% | config/guardrails.json |
| Scenario differentiation | > 20% spread | config/guardrails.json |
