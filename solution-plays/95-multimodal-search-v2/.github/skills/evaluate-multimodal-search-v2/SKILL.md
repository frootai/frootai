---
name: "evaluate-multimodal-search-v2"
description: "Evaluate Multimodal Search V2 — cross-modal relevance, per-modality accuracy, fusion quality, latency, content safety."
---

# Evaluate Multimodal Search V2

## Prerequisites

- Deployed multimodal search (run `deploy-multimodal-search-v2` skill first)
- Test queries with known relevant results across modalities
- Python 3.11+ with `azure-ai-evaluation`

## Step 1: Evaluate Per-Modality Search

```bash
python evaluation/eval_per_modality.py \
  --test-data evaluation/data/queries/ \
  --output evaluation/results/per_modality.json
```

Per-modality metrics:
| Metric | Text | Image | Audio | Video |
|--------|------|-------|-------|-------|
| **Precision@10** | > 85% | > 80% | > 75% | > 70% |
| **MRR** | > 0.70 | > 0.60 | > 0.55 | > 0.50 |
| **Latency p50** | < 100ms | < 200ms | < 200ms | < 300ms |

## Step 2: Evaluate Cross-Modal Retrieval

```bash
python evaluation/eval_cross_modal.py \
  --test-data evaluation/data/cross_modal/ \
  --output evaluation/results/cross_modal.json
```

Cross-modal metrics:
| Query → Index | Precision@10 | Description |
|--------------|-------------|-------------|
| Text → Image | > 70% | Find images matching text description |
| Text → Video | > 60% | Find video scenes matching text query |
| Text → Audio | > 65% | Find audio by transcript content |
| Image → Image | > 80% | Visual similarity search |
| Image → Video | > 55% | Find video with similar visual content |

## Step 3: Evaluate Late Fusion Quality

```bash
python evaluation/eval_fusion.py \
  --test-data evaluation/data/fusion/ \
  --output evaluation/results/fusion.json
```

Fusion metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Fusion vs Single-Modality** | Fused results better than any single | > 10% improvement |
| **Multi-Modal Boost** | Docs matching in 2+ modalities ranked higher | Verified |
| **No Modality Dominance** | No single modality > 60% of top results | Balanced |
| **Personalization Lift** | User-preferred modality boosts results | > 5% CTR improvement |

## Step 4: Evaluate Content Processing

```bash
python evaluation/eval_processing.py \
  --test-data evaluation/data/content/ \
  --output evaluation/results/processing.json
```

Processing metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Whisper Transcription WER** | Word Error Rate for audio | < 10% |
| **Key Frame Quality** | Representative frames capture scene content | > 85% |
| **Scene Detection Accuracy** | Scene boundaries match manual annotation | > 80% |
| **Embedding Coverage** | % of content successfully embedded | > 99% |

## Step 5: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Per-modality precision@K curves
- Cross-modal retrieval matrix heatmap
- Fusion vs single-modality comparison chart
- Latency distribution by modality
- Content processing quality dashboard

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Text Precision@10 | > 85% | config/guardrails.json |
| Cross-modal text→image | > 70% | config/guardrails.json |
| Fusion improvement | > 10% | config/guardrails.json |
| Whisper WER | < 10% | config/guardrails.json |
| Latency p50 (text) | < 100ms | config/guardrails.json |
