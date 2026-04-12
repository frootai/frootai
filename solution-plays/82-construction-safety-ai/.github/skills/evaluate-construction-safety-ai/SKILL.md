---
name: "evaluate-construction-safety-ai"
description: "Evaluate Construction Safety AI — PPE detection accuracy, zone intrusion detection, incident prediction, alert effectiveness, compliance reporting."
---

# Evaluate Construction Safety AI

## Prerequisites

- Deployed safety system (run `deploy-construction-safety-ai` skill first)
- Labeled test video with known PPE violations
- Python 3.11+ with `azure-ai-evaluation`, `ultralytics`

## Step 1: Evaluate PPE Detection Accuracy

```bash
python evaluation/eval_ppe.py \
  --test-data evaluation/data/ppe_images/ \
  --model models/ppe_detector_v1.onnx \
  --output evaluation/results/ppe.json
```

PPE detection metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **mAP@0.5** | Mean Average Precision at IoU 0.5 | > 85% |
| **Hard Hat Detection** | Correct hard hat / no hard hat | > 90% |
| **Vest Detection** | Correct vest / no vest | > 88% |
| **False Positive Rate** | PPE present but flagged missing | < 8% |
| **False Negative Rate** | PPE missing but not flagged | < 5% |
| **Inference Latency** | Per-frame on edge device | < 100ms |
| **Low-Light Accuracy** | Accuracy in dim / IR conditions | > 75% |

Per-PPE item targets:
| PPE Item | Precision | Recall | Why Different |
|----------|-----------|--------|---------------|
| Hard hat | > 92% | > 90% | Critical safety item, high visibility |
| Safety vest | > 88% | > 85% | Color variants, occlusion by tools |
| Safety boots | > 80% | > 78% | Often occluded by materials |
| Gloves | > 75% | > 72% | Small objects, hardest to detect |

## Step 2: Evaluate Zone Intrusion Detection

```bash
python evaluation/eval_zones.py \
  --test-data evaluation/data/zone_videos/ \
  --output evaluation/results/zones.json
```

Zone metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Intrusion Detection Rate** | Unauthorized entry detected | > 95% |
| **False Alarm Rate** | Authorized worker flagged | < 10% |
| **Detection Latency** | Time from entry to alert | < 5 seconds |
| **Worker Count Accuracy** | Correct count in hazard zone | > 90% |
| **Zone Boundary Accuracy** | Correct zone assignment | > 95% |

## Step 3: Evaluate Incident Prediction

```bash
python evaluation/eval_prediction.py \
  --test-data evaluation/data/incidents/ \
  --output evaluation/results/prediction.json
```

Prediction metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Risk Level Accuracy** | Predicted vs actual incident occurrence | > 70% |
| **High-Risk Period Detection** | Correctly identifies peak risk windows | > 75% |
| **False Alarm Rate** | High risk predicted, no incident | < 30% |
| **Lead Time** | Prediction before incident | > 2 hours |
| **Factor Attribution** | Top factors match post-incident analysis | > 65% |

## Step 4: Evaluate Alert Effectiveness

```bash
python evaluation/eval_alerts.py \
  --test-data evaluation/data/alerts/ \
  --output evaluation/results/alerts.json
```

Alert metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Alert Delivery Time** | Detection to supervisor notification | < 30 seconds |
| **Alert Deduplication** | Same worker not alerted repeatedly | > 90% deduped |
| **Actionability** | Alert has clear corrective action | > 90% |
| **Escalation Accuracy** | Critical alerts reach site manager | 100% |
| **Alert Fatigue Score** | Alerts per hour (lower = better) | < 10/hour |

## Step 5: Evaluate Compliance Reporting

```bash
python evaluation/eval_compliance.py \
  --test-data evaluation/data/reports/ \
  --output evaluation/results/compliance.json
```

Compliance metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **OSHA Checklist Coverage** | Required items audited | > 95% |
| **Report Groundedness** | Claims reference actual detections | > 0.90 |
| **Trend Accuracy** | Week-over-week compliance trend | > 85% |
| **No Fabricated Data** | Every statistic traceable to detections | 100% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- PPE detection confusion matrix per item type
- Zone intrusion timeline with response times
- Incident risk prediction vs actuals scatter plot
- Alert volume trend with fatigue analysis
- Compliance scorecard by zone and shift

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| PPE mAP@0.5 | > 85% | config/guardrails.json |
| Zone intrusion detection | > 95% | config/guardrails.json |
| Alert delivery | < 30 sec | config/guardrails.json |
| False negative (PPE missing) | < 5% | Safety-critical requirement |
| Groundedness | > 0.90 | fai-manifest.json |
