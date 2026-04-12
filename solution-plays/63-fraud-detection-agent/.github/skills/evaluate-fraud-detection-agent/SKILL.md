---
name: "evaluate-fraud-detection-agent"
description: "Evaluate Fraud Detection Agent quality — precision/recall per layer, false positive rate, detection latency, graph coverage, explanation quality, feedback loop effectiveness."
---

# Evaluate Fraud Detection Agent

## Prerequisites

- Deployed fraud detection (run `deploy-fraud-detection-agent` skill first)
- Test dataset with labeled transactions (fraud/legitimate)
- Python 3.11+ with `scikit-learn`, `azure-ai-evaluation` packages

## Step 1: Evaluate Detection Accuracy

```bash
python evaluation/eval_detection.py \
  --test-data evaluation/data/transactions/ \
  --endpoint $DETECTION_ENDPOINT \
  --output evaluation/results/detection.json
```

Detection metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Precision** | True fraud / all flagged | > 85% |
| **Recall** | True fraud detected / all actual fraud | > 95% |
| **F1 Score** | Harmonic mean | > 90% |
| **False Positive Rate** | Legit transactions blocked | < 1% |
| **Detection by Layer** | Which layer caught what | Track |

Detection by layer:
| Layer | Expected Coverage | Latency |
|-------|-------------------|--------|
| Rules | 30% of fraud (known patterns) | < 1ms |
| ML | 60% of remaining (statistical) | < 50ms |
| Graph | 80% of ring fraud (network) | < 500ms |
| **Combined** | **> 95% recall** | **< 55ms avg** |

## Step 2: Evaluate Latency

```bash
python evaluation/eval_latency.py \
  --endpoint $DETECTION_ENDPOINT \
  --output evaluation/results/latency.json
```

Latency metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Rules Latency** | Rule engine decision time | < 1ms |
| **ML Latency** | Model inference time | < 50ms |
| **Graph Latency** | Network analysis (when triggered) | < 500ms |
| **End-to-End P95** | 95th percentile total | < 100ms |
| **Throughput** | Transactions per second | > 1000 TPS |

## Step 3: Evaluate Graph Analysis

```bash
python evaluation/eval_graph.py \
  --test-data evaluation/data/networks/ \
  --output evaluation/results/graph.json
```

Graph metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Ring Detection** | Known fraud rings identified | > 90% |
| **Mule Detection** | Mule accounts flagged | > 85% |
| **Coordinated Attack** | Multi-sender patterns caught | > 80% |
| **False Ring Rate** | Legit networks flagged | < 5% |

## Step 4: Evaluate Explanations

```bash
python evaluation/eval_explanations.py \
  --test-data evaluation/data/ \
  --judge-model gpt-4o \
  --output evaluation/results/explanations.json
```

Explanation metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Factor Count** | Decision factors per block | ≥ 2 |
| **Regulatory Compliance** | PSD2 Art. 70 compliant | 100% |
| **Actionability** (LLM judge) | Analyst can act on explanation | > 4.0/5.0 |
| **Accuracy** | Factors match actual detection layer | > 90% |

## Step 5: Evaluate Feedback Loop

```bash
python evaluation/eval_feedback.py \
  --output evaluation/results/feedback.json
```

Feedback metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Analyst Agreement** | Analyst confirms AI decision | > 85% |
| **False Positive Resolution** | FPs reduced after retrain | > 20% reduction |
| **Feedback Coverage** | % of flagged txns reviewed | > 80% |
| **Retrain Cadence** | Model retrained on feedback | Weekly |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Recall | > 95% | config/guardrails.json |
| False positive rate | < 1% | config/guardrails.json |
| E2E latency P95 | < 100ms | config/guardrails.json |
| Explanation compliance | 100% (PSD2) | config/guardrails.json |
| Ring detection | > 90% | config/guardrails.json |
