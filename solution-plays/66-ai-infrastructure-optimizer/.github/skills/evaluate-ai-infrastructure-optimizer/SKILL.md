---
name: "evaluate-ai-infrastructure-optimizer"
description: "Evaluate AI Infrastructure Optimizer quality — recommendation accuracy, savings realized, anomaly detection precision, GPU analysis coverage, auto-scale effectiveness."
---

# Evaluate AI Infrastructure Optimizer

## Prerequisites

- Deployed optimizer (run `deploy-ai-infrastructure-optimizer` skill first)
- Baseline cost data for comparison (30+ days)
- Python 3.11+ with `azure-mgmt-costmanagement` package

## Step 1: Evaluate Right-Sizing Accuracy

```bash
python evaluation/eval_rightsizing.py \
  --subscription $SUBSCRIPTION_ID \
  --output evaluation/results/rightsizing.json
```

Right-sizing metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Recommendation Accuracy** | Downsized resources perform within SLA | > 90% |
| **Savings Realized** | Actual savings vs predicted | Within 15% |
| **No Performance Degradation** | P95 latency unchanged after resize | 100% |
| **GPU Optimization Rate** | Under-utilized GPUs identified | > 85% |
| **Coverage** | Resources analyzed / total resources | > 95% |

Right-sizing validation:
| Scenario | Expected Outcome |
|----------|------------------|
| CPU p95 < 20% on D16s | Recommend D8s (50% savings) |
| GPU avg < 30% on NC24 | Recommend CPU-only or NC4 |
| CPU p95 > 80% on D4s | Recommend D8s (upsize) or auto-scale |
| Storage < 30% used | Recommend Cool tier |

## Step 2: Evaluate Cost Anomaly Detection

```bash
python evaluation/eval_anomalies.py \
  --subscription $SUBSCRIPTION_ID \
  --output evaluation/results/anomalies.json
```

Anomaly metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Detection Rate** | Known anomalies caught | > 90% |
| **False Positive Rate** | Normal spikes incorrectly flagged | < 10% |
| **Detection Latency** | Time from anomaly to alert | < 1 hour |
| **Severity Accuracy** | Correct critical/high/medium | > 85% |
| **Root Cause** | Identifies cost driver | > 70% |

## Step 3: Evaluate Auto-Scaling Recommendations

```bash
python evaluation/eval_autoscale.py \
  --output evaluation/results/autoscale.json
```

Auto-scale metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Rule Correctness** | Scale rules match actual demand | > 85% |
| **Over-provisioning Reduction** | Idle replicas identified | > 80% |
| **Scale-up Response** | Recommendation before overload | > 90% |
| **Cost Impact** | Savings from right-scaled auto-scale | Track |

## Step 4: Evaluate Overall Savings

```bash
python evaluation/eval_savings.py \
  --baseline evaluation/data/baseline-costs.json \
  --current evaluation/data/current-costs.json \
  --output evaluation/results/savings.json
```

Savings metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Total Monthly Savings** | Dollar reduction vs baseline | > 20% |
| **Compute Savings** | VM/Container right-sizing | > 25% |
| **GPU Savings** | GPU utilization optimization | > 30% |
| **Storage Savings** | Tier optimization | > 15% |
| **ROI** | Savings / optimizer cost | > 10x |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Right-sizing recommendations with before/after comparison
- Cost anomaly timeline with root cause analysis
- GPU utilization heatmap across resources
- Auto-scale rule recommendations with projected savings
- Monthly savings trend line

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Recommendation accuracy | > 90% | config/guardrails.json |
| Total savings | > 20% | config/guardrails.json |
| Anomaly detection | > 90% | config/guardrails.json |
| No perf degradation | 100% | config/guardrails.json |
| GPU identification | > 85% | config/guardrails.json |
