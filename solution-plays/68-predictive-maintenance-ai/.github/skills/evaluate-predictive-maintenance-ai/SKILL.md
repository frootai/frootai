---
name: "evaluate-predictive-maintenance-ai"
description: "Evaluate Predictive Maintenance AI quality — RUL accuracy (MAE), false alarm rate, critical failure detection, downtime reduction, root cause quality."
---

# Evaluate Predictive Maintenance AI

## Prerequisites

- Deployed maintenance AI (run `deploy-predictive-maintenance-ai` skill first)
- Historical failure records for backtesting
- Python 3.11+ with `scikit-learn`, `azure-ai-evaluation` packages

## Step 1: Evaluate RUL Prediction Accuracy

```bash
python evaluation/eval_rul.py \
  --test-data evaluation/data/historical-failures/ \
  --endpoint $MAINTENANCE_ENDPOINT \
  --output evaluation/results/rul.json
```

RUL metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **MAE (days)** | Mean Absolute Error of RUL prediction | < 5 days |
| **RMSE (days)** | Root Mean Square Error | < 8 days |
| **Critical Detection** | Failures within 7 days correctly flagged urgent | > 95% |
| **False Alarm Rate** | Healthy equipment flagged for maintenance | < 10% |
| **Confidence Calibration** | High confidence = accurate prediction | Correlation > 0.7 |

RUL accuracy by equipment type:
| Equipment Type | Target MAE | Challenge |
|---------------|-----------|----------|
| Pumps | < 4 days | Gradual degradation, good sensors |
| Compressors | < 6 days | Multiple failure modes |
| Motors | < 5 days | Bearing wear well-understood |
| Valves | < 7 days | Intermittent failures harder |

## Step 2: Evaluate Feature Quality

```bash
python evaluation/eval_features.py \
  --output evaluation/results/features.json
```

Feature metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Feature Importance** | Top features match domain knowledge | > 80% alignment |
| **Sensor Coverage** | All required sensors providing data | > 95% |
| **Data Freshness** | Telemetry within expected interval | > 98% on-time |
| **Missing Data Handling** | Gaps interpolated or flagged | 100% handled |

## Step 3: Evaluate Downtime Impact

```bash
python evaluation/eval_downtime.py \
  --baseline evaluation/data/baseline-downtime.json \
  --output evaluation/results/downtime.json
```

Downtime metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Unplanned Downtime Reduction** | vs reactive maintenance | > 40% |
| **Maintenance Cost Reduction** | vs time-based schedule | > 20% |
| **Mean Time Between Failures** | MTBF improvement | > 25% increase |
| **Spare Parts Optimization** | Right parts pre-ordered | > 80% |

## Step 4: Evaluate Root Cause Analysis

```bash
python evaluation/eval_root_cause.py \
  --test-data evaluation/data/failures/ \
  --judge-model gpt-4o \
  --output evaluation/results/root_cause.json
```

Root cause metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Cause Identification** (LLM judge) | Correct failure mode identified | > 75% |
| **Actionability** (LLM judge) | Recommended actions are specific, doable | > 4.0/5.0 |
| **Parts Accuracy** | Correct parts listed for repair | > 70% |
| **Repair Time Estimate** | Within 30% of actual repair time | > 70% |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- RUL error distribution histogram
- Feature importance ranked by predictive power
- Confusion matrix: urgent/planned/monitor vs actual
- Downtime reduction trend line
- Root cause analysis quality per equipment type

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| RUL MAE | < 5 days | config/guardrails.json |
| Critical detection | > 95% | config/guardrails.json |
| False alarm rate | < 10% | config/guardrails.json |
| Downtime reduction | > 40% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
