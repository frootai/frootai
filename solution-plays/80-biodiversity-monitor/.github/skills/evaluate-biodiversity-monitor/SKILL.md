---
name: "evaluate-biodiversity-monitor"
description: "Evaluate Biodiversity Monitor — species ID accuracy (image+audio), population estimates, invasive detection, habitat assessment, camera trap efficiency."
---

# Evaluate Biodiversity Monitor

## Prerequisites

- Deployed biodiversity system (run `deploy-biodiversity-monitor` skill first)
- Expert-verified species observation dataset
- Python 3.11+ with `scikit-learn`, `azure-ai-evaluation`

## Step 1: Evaluate Image-Based Species ID

```bash
python evaluation/eval_image_id.py \
  --test-data evaluation/data/camera_traps/ \
  --output evaluation/results/image_id.json
```

Image ID metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Top-1 Accuracy** | Correct species as first prediction | > 85% |
| **Top-3 Accuracy** | Correct species in top 3 predictions | > 95% |
| **Empty Frame Filter** | Correctly rejects empty frames | > 95% |
| **Per-Taxon F1** | F1 score per species group | Mammals > 85%, Birds > 80% |
| **Geo-Spatial Validation** | Unexpected species correctly flagged | > 90% |
| **Inference Latency** | Time per image classification | < 200ms |

## Step 2: Evaluate Audio-Based Species ID

```bash
python evaluation/eval_audio_id.py \
  --test-data evaluation/data/recordings/ \
  --output evaluation/results/audio_id.json
```

Audio ID metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Species Detection Rate** | Known species calls identified | > 80% |
| **False Positive Rate** | Non-species sounds classified as species | < 10% |
| **Multi-Species Separation** | Correctly separates overlapping calls | > 70% |
| **SNR Robustness** | Accuracy at SNR < 10dB | > 60% |
| **Call Type Classification** | Song vs call vs alarm correctly labeled | > 75% |

## Step 3: Evaluate Population Tracking

```bash
python evaluation/eval_population.py \
  --test-data evaluation/data/surveys/ \
  --output evaluation/results/population.json
```

Population metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Occupancy Estimate Accuracy** | vs. intensive ground-truth survey | Within ±15% |
| **Detection Probability** | Calibrated detection prob per species | Correlation > 0.80 |
| **Trend Direction Accuracy** | Increasing/decreasing/stable correct | > 80% |
| **Abundance Index Correlation** | Relative abundance matches capture-recapture | r > 0.75 |
| **Minimum Survey Compliance** | ≥5 surveys per site per season | > 90% sites |

## Step 4: Evaluate Invasive Species Detection

```bash
python evaluation/eval_invasive.py \
  --test-data evaluation/data/invasive/ \
  --output evaluation/results/invasive.json
```

Invasive metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Watchlist Detection** | Known invasive species caught | > 95% |
| **Range Expansion Alert** | Unexpected range correctly flagged | > 85% |
| **False Alarm Rate** | Native species flagged as invasive | < 5% |
| **Alert Response Time** | Time from detection to notification | < 1 hour |

## Step 5: Evaluate Conservation Reports

```bash
python evaluation/eval_reports.py \
  --test-data evaluation/data/reports/ \
  --output evaluation/results/reports.json
```

Report metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Groundedness** | Claims reference actual observation data | > 0.90 |
| **Conservation Priority Accuracy** | Priority ranking matches expert | > 80% |
| **Actionability** (expert judge) | Recommendations are implementable | > 85% |
| **Data Completeness** | All monitored species included | 100% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Species ID confusion matrix (image + audio combined)
- Population trend dashboard per species
- Invasive species alert log with verification status
- Habitat health index map
- Camera trap efficiency analysis (images/detection ratio)

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Image species ID (top-1) | > 85% | config/guardrails.json |
| Audio species detection | > 80% | config/guardrails.json |
| Invasive watchlist detection | > 95% | config/guardrails.json |
| Population trend accuracy | > 80% | config/guardrails.json |
| Groundedness | > 0.90 | fai-manifest.json |
