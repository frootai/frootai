---
name: "evaluate-content-moderation-v2"
description: "Evaluate Content Moderation V2 quality — precision/recall per category, false positive rate, latency per modality, human review efficiency, appeal fairness."
---

# Evaluate Content Moderation V2

## Prerequisites

- Deployed moderation pipeline (run `deploy-content-moderation-v2` skill first)
- Test dataset with labeled content (safe/unsafe per category)
- Python 3.11+ with `azure-ai-evaluation`, `azure-ai-contentsafety` packages

## Step 1: Prepare Evaluation Dataset

```bash
mkdir -p evaluation/data
# Each test: content + ground-truth labels
# evaluation/data/content-001.json
# {
#   "text": "Sample content...",
#   "images": ["test/images/sample.jpg"],
#   "expected_action": "block",
#   "expected_category": "violence",
#   "expected_severity": 6,
#   "modality": "text+image"
# }
```

Test categories:
- **Violence**: Physical harm, weapons, gore (15 samples)
- **Hate speech**: Discriminatory language, slurs (15 samples)
- **Sexual**: Explicit, suggestive content (10 samples)
- **Self-harm**: Suicide, self-injury references (10 samples)
- **Benign**: Safe content that looks edgy (20 samples — false positive test)
- **Custom**: Domain-specific violations (10 samples)
- **Multi-modal**: Text + image combined (10 samples)

## Step 2: Evaluate Classification Accuracy

```bash
python evaluation/eval_accuracy.py \
  --test-data evaluation/data/ \
  --endpoint $MODERATION_ENDPOINT \
  --output evaluation/results/accuracy.json
```

Accuracy metrics per category:
| Metric | Category | Target |
|--------|----------|--------|
| **Precision** | Violence | > 95% |
| **Precision** | Hate speech | > 93% |
| **Precision** | Sexual | > 95% |
| **Precision** | Self-harm | > 95% |
| **Recall** | Violence | > 98% |
| **Recall** | Hate speech | > 95% |
| **Recall** | Sexual | > 98% |
| **Recall** | Self-harm | > 98% |
| **False Positive Rate** | Overall | < 3% |
| **F1 Score** | Weighted average | > 95% |

## Step 3: Evaluate Per-Modality Performance

```bash
python evaluation/eval_modality.py \
  --test-data evaluation/data/ \
  --output evaluation/results/modality.json
```

Modality metrics:
| Modality | Latency Target | Accuracy Target | Notes |
|----------|---------------|-----------------|-------|
| Text | < 200ms | > 96% | Fastest modality |
| Image | < 500ms | > 94% | Resolution affects speed |
| Video (per frame) | < 500ms | > 92% | Sample rate configurable |
| Multi-modal | < 1s | > 93% | Parallel processing |

## Step 4: Evaluate Human Review Queue

```bash
python evaluation/eval_review_queue.py \
  --output evaluation/results/review.json
```

Review queue metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Queue Wait Time** | Time in queue before review | < 1 hour |
| **Reviewer Agreement** | Reviewers agree with AI decision | > 85% |
| **Overturn Rate** | Human overturns AI decision | < 15% |
| **Appeal Success Rate** | Appeals overturned | 5-15% (healthy range) |
| **Throughput** | Reviews per hour per reviewer | > 20 |

## Step 5: Evaluate Custom Categories

```bash
python evaluation/eval_custom.py \
  --test-data evaluation/data/custom/ \
  --output evaluation/results/custom.json
```

Custom category metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Blocklist Hit Rate** | Custom terms correctly blocked | > 99% |
| **Blocklist False Positive** | Non-matching content blocked | < 1% |
| **Domain Coverage** | Domain violations detected | > 90% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md \
  --thresholds config/guardrails.json
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Precision (violence) | > 95% | config/guardrails.json |
| Recall (self-harm) | > 98% | config/guardrails.json |
| False positive rate | < 3% | config/guardrails.json |
| Text latency | < 200ms | config/guardrails.json |
| Queue wait time | < 1 hour | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
