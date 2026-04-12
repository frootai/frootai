---
name: "evaluate-waste-recycling-optimizer"
description: "Evaluate Waste Recycling Optimizer — classification accuracy, contamination detection, route efficiency, fill prediction, recycling rate."
---

# Evaluate Waste Recycling Optimizer

## Prerequisites

- Deployed waste system (run `deploy-waste-recycling-optimizer` skill first)
- Labeled test image dataset (≥500 images with ground truth)
- Historical route + collection data (≥30 days)
- Python 3.11+ with `scikit-learn`, `azure-ai-evaluation`

## Step 1: Evaluate Material Classification

```bash
python evaluation/eval_classification.py \
  --test-data evaluation/data/images/ \
  --model models/waste_classifier.onnx \
  --output evaluation/results/classification.json
```

Classification metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Overall Accuracy** | Correct material category | > 90% |
| **Per-Class F1** | F1 score per material type | > 85% each |
| **Confusion Rate** | Recyclable classified as non-recyclable | < 5% |
| **Reverse Confusion** | Non-recyclable classified as recyclable | < 3% |
| **Inference Latency** | Time per image (ONNX runtime) | < 100ms |
| **Edge Deployment** | Model size for on-device inference | < 50 MB |

Per-category targets:
| Category | Precision Target | Recall Target | Why |
|----------|-----------------|---------------|-----|
| Plastic PET | > 90% | > 85% | High volume, sorting revenue |
| Metal Aluminum | > 95% | > 90% | High value, easy to sort |
| Electronic Waste | > 98% | > 95% | Safety — hazardous materials |
| Hazardous | > 99% | > 95% | Critical safety classification |
| Glass | > 85% | > 80% | Color variants make it harder |

## Step 2: Evaluate Contamination Detection

```bash
python evaluation/eval_contamination.py \
  --test-data evaluation/data/contamination/ \
  --output evaluation/results/contamination.json
```

Contamination metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Detection Rate** | Known contaminated items caught | > 90% |
| **False Positive Rate** | Clean items flagged as contaminated | < 10% |
| **Severity Accuracy** | Correct severity level assignment | > 80% |
| **Hazardous Detection** | Hazardous contamination caught | > 99% |

## Step 3: Evaluate Route Optimization

```bash
python evaluation/eval_routes.py \
  --test-data evaluation/data/routes/ \
  --output evaluation/results/routes.json
```

Route metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Distance Reduction** | vs. fixed-schedule routes | > 20% savings |
| **Collection Efficiency** | kg collected per km driven | > 15% improvement |
| **Time Window Compliance** | Routes within operating hours | > 98% |
| **Bin Overflow Rate** | Bins exceeding capacity before collection | < 5% |
| **Fuel/Emissions Savings** | CO₂ reduction from optimized routes | > 15% |

## Step 4: Evaluate Fill-Level Prediction

```bash
python evaluation/eval_fill_prediction.py \
  --test-data evaluation/data/fill_levels/ \
  --output evaluation/results/fill.json
```

Fill prediction metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **MAPE** | Fill rate prediction error | < 15% |
| **Collection Trigger Accuracy** | Correctly predicted 80% threshold | > 85% |
| **False Alarm Rate** | Predicted full but actually < 50% | < 10% |
| **Missed Collection Rate** | Overflowed before predicted | < 5% |

## Step 5: Evaluate Circular Economy Metrics

```bash
python evaluation/eval_circular.py \
  --test-data evaluation/data/material_flow/ \
  --output evaluation/results/circular.json
```

Circular economy metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Overall Recovery Rate** | Material recycled / total collected | > 55% |
| **Plastic Recovery** | Plastic recycled / plastic collected | > 50% |
| **Metal Recovery** | Metal recycled / metal collected | > 70% |
| **Contamination Rejection** | Rejected at sorting facility | < 5% |
| **Material Traceability** | Items tracked through full lifecycle | > 90% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Classification confusion matrix heatmap
- Route optimization before/after comparison map
- Fill-level prediction accuracy timeline
- Material recovery Sankey diagram (collected → sorted → recycled → reused)
- Contamination rate trend by material type

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Classification accuracy | > 90% | config/guardrails.json |
| Contamination detection | > 90% | config/guardrails.json |
| Route distance savings | > 20% | config/guardrails.json |
| Overall recovery rate | > 55% | config/guardrails.json |
| Hazardous detection | > 99% | Safety requirement |
