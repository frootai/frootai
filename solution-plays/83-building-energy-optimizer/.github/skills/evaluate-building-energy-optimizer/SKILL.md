---
name: "evaluate-building-energy-optimizer"
description: "Evaluate Building Energy Optimizer — energy savings, occupancy prediction, comfort compliance, fault detection, sustainability metrics."
---

# Evaluate Building Energy Optimizer

## Prerequisites

- Deployed optimizer (run `deploy-building-energy-optimizer` skill first)
- Baseline energy data (pre-optimization, ≥30 days)
- Python 3.11+ with `azure-ai-evaluation`, `scikit-learn`

## Step 1: Evaluate Energy Savings

```bash
python evaluation/eval_energy.py \
  --baseline-data evaluation/data/baseline_energy/ \
  --optimized-data evaluation/data/optimized_energy/ \
  --output evaluation/results/energy.json
```

Energy metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Total Energy Savings** | kWh reduction vs baseline | > 15% |
| **HVAC Energy Savings** | HVAC-specific reduction | > 20% |
| **Peak Demand Reduction** | Peak kW reduction | > 10% |
| **Energy per Occupied Hour** | kWh per zone-hour with occupancy | < baseline |
| **No Rebound Effect** | Savings sustained over 90+ days | Stable ±3% |

## Step 2: Evaluate Occupancy Prediction

```bash
python evaluation/eval_occupancy.py \
  --test-data evaluation/data/occupancy/ \
  --output evaluation/results/occupancy.json
```

Occupancy metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **MAPE** | Occupancy count prediction error | < 20% |
| **Empty Zone Detection** | Correctly identifies unoccupied zones | > 90% |
| **Transition Accuracy** | Catches occupancy changes (arrive/depart) | > 85% |
| **Calendar Integration** | Meeting room prediction from calendar | > 80% |
| **Weekend/Holiday** | Correctly predicts low/no occupancy | > 95% |

## Step 3: Evaluate Comfort Compliance

```bash
python evaluation/eval_comfort.py \
  --test-data evaluation/data/comfort/ \
  --output evaluation/results/comfort.json
```

Comfort metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **ASHRAE 55 Compliance** | Occupied hours within comfort range | > 90% |
| **Complaint Rate** | Comfort complaints per 1000 occupied hours | < 2 |
| **Setback Recovery Time** | Time from setback to comfort after occupancy | < 30 min |
| **Over-Cooling Rate** | Zones cooled below 73°F unnecessarily | < 5% |
| **Humidity Compliance** | Within 30-60% RH | > 85% |

## Step 4: Evaluate Fault Detection

```bash
python evaluation/eval_faults.py \
  --test-data evaluation/data/faults/ \
  --output evaluation/results/faults.json
```

Fault detection metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Detection Rate** | Known faults correctly identified | > 85% |
| **False Positive Rate** | Normal operation flagged as fault | < 10% |
| **Detection Latency** | Time from fault onset to detection | < 2 hours |
| **Severity Accuracy** | Correct severity classification | > 80% |
| **Actionable Recommendation** | Fix suggestion provided with fault | > 90% |

## Step 5: Evaluate Sustainability Reporting

```bash
python evaluation/eval_sustainability.py \
  --test-data evaluation/data/reports/ \
  --output evaluation/results/sustainability.json
```

Reporting metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **CO₂ Reduction Accuracy** | Calculated vs metered emissions reduction | Within ±10% |
| **Energy Star Score** | Building energy performance rating | Improved vs baseline |
| **Report Groundedness** | Claims reference actual meter data | > 0.90 |
| **Savings Attribution** | Savings correctly attributed to optimization actions | > 85% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Energy savings waterfall (baseline → optimized by category)
- Occupancy prediction accuracy by zone type
- Comfort compliance heatmap by zone × hour
- Fault detection timeline with resolution tracking
- CO₂ reduction trend line

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Energy savings | > 15% | config/guardrails.json |
| ASHRAE 55 compliance | > 90% | ASHRAE Standard 55 |
| Fault detection | > 85% | config/guardrails.json |
| Setback recovery | < 30 min | config/guardrails.json |
| Groundedness | > 0.90 | fai-manifest.json |
