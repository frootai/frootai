---
name: "evaluate-network-optimization-agent"
description: "Evaluate Network Optimization Agent — traffic forecast accuracy, routing efficiency, SLA compliance, equipment failure prediction, 5G slice performance."
---

# Evaluate Network Optimization Agent

## Prerequisites

- Deployed network optimizer (run `deploy-network-optimization-agent` skill first)
- Baseline network performance data (pre-optimization)
- Python 3.11+ with `azure-ai-evaluation`, `networkx`

## Step 1: Evaluate Traffic Forecasting

```bash
python evaluation/eval_traffic.py \
  --test-data evaluation/data/traffic_history/ \
  --output evaluation/results/traffic.json
```

Traffic metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **MAPE** | Traffic prediction error per link | < 15% |
| **Peak Detection** | Correctly predicts peak traffic hours | > 85% |
| **Event Spike Handling** | Accuracy during special events | < 25% MAPE |
| **Horizon Degradation** | Accuracy at 1h vs 4h | < 2× degradation |

## Step 2: Evaluate Routing Optimization

```bash
python evaluation/eval_routing.py \
  --baseline evaluation/data/baseline_routing/ \
  --optimized evaluation/data/optimized_routing/ \
  --output evaluation/results/routing.json
```

Routing metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Max Link Utilization** | Highest link utilization in network | < 80% |
| **Utilization Balance** | Std dev of link utilizations (lower = more balanced) | < 15% |
| **Average Latency** | Weighted average path latency | Improved vs baseline |
| **Redundancy Paths** | Nodes with ≥2 disjoint paths | 100% |
| **Packet Loss** | End-to-end packet loss rate | < 0.01% |

## Step 3: Evaluate SLA Compliance

```bash
python evaluation/eval_sla.py \
  --test-data evaluation/data/sla_metrics/ \
  --output evaluation/results/sla.json
```

SLA metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Latency SLA** | % time within latency target | > 99.5% |
| **Availability** | Network uptime | > 99.95% |
| **Throughput SLA** | Committed bandwidth delivered | > 99% |
| **Jitter** | Latency variation | < 5ms |
| **5G Slice SLA** | Per-slice SLA compliance | > 99% per slice |

## Step 4: Evaluate Predictive Maintenance

```bash
python evaluation/eval_maintenance.py \
  --test-data evaluation/data/equipment_failures/ \
  --output evaluation/results/maintenance.json
```

Maintenance metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Failure Prediction Accuracy** | Predicted failures that occurred | > 75% |
| **False Alarm Rate** | Healthy equipment flagged at risk | < 15% |
| **Lead Time** | Days of warning before failure | > 7 days |
| **RUL Accuracy** | Remaining Useful Life estimation error | Within ±30% |
| **Unplanned Downtime Reduction** | vs no predictive maintenance | > 40% |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Traffic forecast accuracy by link and time of day
- Link utilization heatmap (before/after optimization)
- SLA compliance dashboard per slice type
- Equipment health timeline with prediction markers
- Network topology with utilization overlay

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Max link utilization | < 80% | config/guardrails.json |
| Latency SLA compliance | > 99.5% | config/guardrails.json |
| Availability | > 99.95% | Telecom SLA standard |
| Failure prediction | > 75% | config/guardrails.json |
| Traffic MAPE | < 15% | config/guardrails.json |
