---
name: "evaluate-visual-product-search"
description: "Evaluate Visual Product Search — visual match accuracy, multi-modal quality, search latency, click-through rate, content safety."
---

# Evaluate Visual Product Search

## Prerequisites

- Deployed visual search (run `deploy-visual-product-search` skill first)
- Test query images with known matching products
- Python 3.11+ with `azure-ai-evaluation`

## Step 1: Evaluate Visual Match Quality

```bash
python evaluation/eval_visual_match.py \
  --test-data evaluation/data/query_images/ \
  --output evaluation/results/visual_match.json
```

Visual match metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Precision@5** | Correct product in top 5 results | > 70% |
| **Precision@10** | Correct product in top 10 results | > 85% |
| **MRR** | Mean Reciprocal Rank (correct product rank) | > 0.60 |
| **Category Match** | Same product category in top results | > 90% |
| **Color Match** | Same dominant color in top results | > 80% |
| **Visual Similarity** (human judge) | Results look visually similar | > 4.0/5.0 |

By product category:
| Category | Precision@5 Target | Challenge |
|----------|-------------------|-----------|
| Shoes | > 75% | Shape + color + style matters |
| Clothing | > 65% | Fabric texture hard to match |
| Furniture | > 70% | Shape + material + color |
| Electronics | > 80% | Distinctive shapes, fewer variations |
| Jewelry | > 60% | Fine detail, reflective surfaces |

## Step 2: Evaluate Multi-Modal Search

```bash
python evaluation/eval_multimodal.py \
  --test-data evaluation/data/multimodal_queries/ \
  --output evaluation/results/multimodal.json
```

Multi-modal metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Text Refinement Accuracy** | "blue version" returns blue variant | > 75% |
| **Attribute Override** | Text overrides conflicting image attribute | > 80% |
| **Fusion Quality** | Multi-modal results better than image-only | Precision@5 +10% |
| **No Text Dominance** | Image still primary signal | Image weight ≥ 0.5 |

## Step 3: Evaluate Search Performance

```bash
python evaluation/eval_performance.py \
  --endpoint $SEARCH_ENDPOINT \
  --output evaluation/results/performance.json
```

Performance metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Latency p50** | Median search response time | < 200ms |
| **Latency p95** | 95th percentile | < 500ms |
| **Throughput** | Queries per second | > 50 QPS |
| **Index Size** | Catalog products indexed | > 99% |
| **Upload Processing** | Time to process query image | < 300ms |

## Step 4: Evaluate Click-Through & Conversion

```bash
python evaluation/eval_engagement.py \
  --test-data evaluation/data/click_logs/ \
  --output evaluation/results/engagement.json
```

Engagement metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Click-Through Rate** | % searches with at least one click | > 40% |
| **Add-to-Cart Rate** | Clicked product added to cart | > 15% |
| **Conversion Rate** | Search → purchase | > 5% |
| **Zero Results Rate** | Searches returning no relevant results | < 5% |

## Step 5: Evaluate Content Safety

```bash
python evaluation/eval_safety.py \
  --test-data evaluation/data/safety_probes/ \
  --output evaluation/results/safety.json
```

Safety metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Unsafe Upload Blocked** | Inappropriate images rejected | 100% |
| **False Rejection** | Legitimate product images wrongly blocked | < 2% |
| **No Adult Content Results** | Search never returns inappropriate products | 100% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

Report includes:
- Precision@K curves by product category
- Multi-modal vs image-only comparison chart
- Search latency distribution histogram
- Click-through funnel analysis
- Content safety audit log

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Precision@10 | > 85% | config/guardrails.json |
| Latency p50 | < 200ms | config/guardrails.json |
| Click-through rate | > 40% | config/guardrails.json |
| Unsafe content blocked | 100% | Content Safety |
| Zero results rate | < 5% | config/guardrails.json |
