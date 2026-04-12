---
name: "evaluate-smart-energy-grid-ai"
description: "Evaluate Smart Energy Grid AI — forecast accuracy, anomaly detection, renewable dispatch efficiency, demand response effectiveness."
---

# Evaluate Smart Energy Grid AI

## Prerequisites

- Deployed grid AI system (run `deploy-smart-energy-grid-ai` skill first)
- Historical test data with known outcomes (at least 30 days)
- Python 3.11+ with `scikit-learn`, `pandas`, `azure-ai-evaluation`

## Step 1: Evaluate Load Forecasting Accuracy

```bash
python evaluation/eval_forecast.py \
  --test-data evaluation/data/load_history/ \
  --model models/load_forecast_v1.pkl \
  --output evaluation/results/forecast.json
```

Forecast metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **MAPE** | Mean Absolute Percentage Error | < 5% |
| **RMSE** | Root Mean Squared Error | < 200 kW |
| **Peak Load Error** | Accuracy at daily peaks | < 8% |
| **Ramp Error** | Accuracy during load ramps (morning, evening) | < 10% |
| **Confidence Interval Coverage** | 95% CI actually contains actuals | > 90% |
| **Horizon Degradation** | MAPE at 1h vs 24h vs 48h | < 2x degradation |

Forecast by time segment:
| Segment | MAPE Target | Why Harder |
|---------|-------------|-----------|
| Overnight (00-06) | < 3% | Stable, predictable baseload |
| Morning ramp (06-09) | < 8% | Rapid load increase, weather-dependent |
| Midday (09-16) | < 5% | Solar generation peaks, variable |
| Evening peak (16-21) | < 7% | Highest load, critical accuracy |
| Weekend | < 4% | Different consumption patterns |

## Step 2: Evaluate Anomaly Detection

```bash
python evaluation/eval_anomaly.py \
  --test-data evaluation/data/anomalies/ \
  --model models/grid_anomaly_v1.pkl \
  --output evaluation/results/anomaly.json
```

Anomaly metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Detection Rate** | Known anomalies correctly flagged | > 95% |
| **False Positive Rate** | Normal events incorrectly flagged | < 5% |
| **Detection Latency** | Time from anomaly to detection | < 60 seconds |
| **Severity Classification** | Correct severity (low/medium/high/critical) | > 85% |
| **Root Cause Accuracy** | LLM explanation matches actual cause | > 70% |

## Step 3: Evaluate Renewable Dispatch

```bash
python evaluation/eval_dispatch.py \
  --test-data evaluation/data/dispatch/ \
  --output evaluation/results/dispatch.json
```

Dispatch metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Renewable Utilization** | % of available renewable energy used | > 92% |
| **Curtailment Rate** | % of renewable energy wasted | < 5% |
| **Gas Peaker Usage** | Hours per day on fossil fuel backup | < 4 hours |
| **Grid Frequency Stability** | Frequency within ±0.2 Hz of 50 Hz | > 99.5% |
| **Battery Cycle Efficiency** | Round-trip charge/discharge efficiency | > 85% |

## Step 4: Evaluate Demand Response

```bash
python evaluation/eval_demand_response.py \
  --test-data evaluation/data/demand_response/ \
  --output evaluation/results/demand_response.json
```

Demand response metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Peak Shaving %** | Peak reduction vs no-response baseline | > 15% |
| **Response Rate** | Large consumers who reduce load within deadline | > 70% |
| **Price Signal Accuracy** | Price tier matches actual grid stress | > 85% |
| **Notification Timeliness** | Alerts sent ≥30 min before peak | > 95% |

## Step 5: Evaluate LLM Explanations

```bash
python evaluation/eval_explanations.py \
  --test-data evaluation/data/explanations/ \
  --endpoint $OPENAI_ENDPOINT \
  --output evaluation/results/explanations.json
```

LLM metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Groundedness** | Explanation references actual sensor data | > 0.85 |
| **Actionability** (LLM judge) | Recommendation is specific + executable | > 4.0/5.0 |
| **Technical Accuracy** | Grid domain terminology used correctly | > 90% |
| **Safety** | No hallucinated actions that risk grid stability | 100% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Forecast error heatmap by hour-of-day × day-of-week
- Anomaly ROC curve with operating point
- Renewable dispatch timeline visualization
- Demand response peak shaving comparison
- LLM explanation quality distribution

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| MAPE | < 5% | config/guardrails.json |
| Anomaly detection | > 95% | config/guardrails.json |
| Renewable utilization | > 92% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
| Grid frequency stability | > 99.5% | NERC standard |
