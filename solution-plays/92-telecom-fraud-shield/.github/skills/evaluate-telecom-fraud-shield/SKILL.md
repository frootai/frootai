---
name: "evaluate-telecom-fraud-shield"
description: "Evaluate Telecom Fraud Shield — fraud detection accuracy, false positive rate, detection latency, pattern coverage, subscriber impact."
---

# Evaluate Telecom Fraud Shield

## Prerequisites

- Deployed fraud shield (run `deploy-telecom-fraud-shield` skill first)
- Labeled fraud dataset (known fraud + legitimate CDRs)
- Python 3.11+ with `scikit-learn`, `azure-ai-evaluation`

## Step 1: Evaluate Detection Accuracy

```bash
python evaluation/eval_detection.py \
  --test-data evaluation/data/labeled_cdrs/ \
  --output evaluation/results/detection.json
```

Detection metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Precision** | Flagged cases that are actually fraud | > 80% |
| **Recall** | Actual fraud cases detected | > 95% |
| **F1 Score** | Balance of precision + recall | > 0.85 |
| **False Positive Rate** | Legitimate calls blocked/flagged | < 0.1% |
| **Detection Latency** | CDR received → alert generated | < 5 seconds |

By fraud type:
| Type | Recall Target | Precision Target | Why Different |
|------|-------------|-----------------|---------------|
| SIM Swap | > 98% | > 70% | Critical — financial loss, prefer over-detection |
| IRSF | > 95% | > 85% | Known number ranges, high accuracy possible |
| Wangiri | > 90% | > 75% | Pattern-based, some legitimate short calls |
| Subscription | > 85% | > 80% | Requires longer observation window |
| Anomaly (ML) | > 80% | > 60% | Catch-all for unknown patterns |

## Step 2: Evaluate Velocity Detection

```bash
python evaluation/eval_velocity.py \
  --test-data evaluation/data/velocity_tests/ \
  --output evaluation/results/velocity.json
```

Velocity metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Burst Detection** | Rapid-fire fraud caught | > 99% |
| **Normal Subscriber Pass** | Legitimate high-volume users not blocked | > 99.5% |
| **Counter Accuracy** | Redis counts match actual CDR volume | > 99.9% |
| **Latency** | Velocity check response time | < 10ms |

## Step 3: Evaluate Subscriber Impact

```bash
python evaluation/eval_impact.py \
  --test-data evaluation/data/subscriber_impact/ \
  --output evaluation/results/impact.json
```

Impact metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Wrongful Block Rate** | Legitimate subscribers blocked | < 0.01% |
| **Block-to-Resolution Time** | Hours from block to investigation complete | < 4 hours |
| **Revenue Protected** | Fraud losses prevented | > $X/month (varies) |
| **Customer Complaints from Fraud** | Complaints due to fraud incidents | Decreasing trend |
| **SLA Compliance** | Detection + response within SLA | > 99% |

## Step 4: Evaluate Investigation Reports

```bash
python evaluation/eval_reports.py \
  --test-data evaluation/data/investigation/ \
  --output evaluation/results/reports.json
```

Report metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Groundedness** | Report references actual CDR evidence | > 0.90 |
| **Completeness** | All relevant CDRs included in case | > 95% |
| **Actionability** | Clear recommendation (block/release/investigate) | > 90% |
| **Pattern Explanation** | Fraud pattern clearly described | > 85% |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Precision-recall curve per fraud type
- Velocity detection latency histogram
- False positive analysis by subscriber segment
- Revenue impact dashboard
- Pattern coverage matrix (detected vs undetected types)

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Recall (fraud) | > 95% | config/guardrails.json |
| False positive | < 0.1% | config/guardrails.json |
| Detection latency | < 5 sec | config/guardrails.json |
| Wrongful block | < 0.01% | Subscriber SLA |
| Groundedness | > 0.90 | fai-manifest.json |
