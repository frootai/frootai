---
name: "evaluate-ai-knowledge-management"
description: "Evaluate AI Knowledge Management quality — capture rate, dedup accuracy, taxonomy coverage, expertise finder precision, freshness compliance, retrieval relevance."
---

# Evaluate AI Knowledge Management

## Prerequisites

- Deployed KM system (run `deploy-ai-knowledge-management` skill first)
- Test knowledge sources with labeled content
- Python 3.11+ with `azure-ai-evaluation` package

## Step 1: Evaluate Knowledge Capture

```bash
python evaluation/eval_capture.py \
  --test-data evaluation/data/sources/ \
  --endpoint $KM_ENDPOINT \
  --output evaluation/results/capture.json
```

Capture metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Capture Rate** | Knowledge items extracted / source content | > 80% |
| **Extraction Quality** (LLM judge) | Capturing useful knowledge, not noise | > 4.0/5.0 |
| **Multi-Source Coverage** | All source types producing items | 100% |
| **Entity Extraction** | Named entities correctly identified | > 85% |
| **Taxonomy Accuracy** | Correct category/subcategory assigned | > 80% |

## Step 2: Evaluate Deduplication

```bash
python evaluation/eval_dedup.py \
  --test-data evaluation/data/duplicates/ \
  --output evaluation/results/dedup.json
```

Dedup metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Duplicate Detection** | True duplicates caught | > 95% |
| **False Positive Rate** | Unique items incorrectly rejected | < 3% |
| **Near-Duplicate Handling** | Paraphrased content caught | > 85% |
| **Merge Quality** | Best version kept when merging | > 90% |

## Step 3: Evaluate Expertise Finder

```bash
python evaluation/eval_expertise.py \
  --output evaluation/results/expertise.json
```

Expertise metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Expert Relevance** | Found person actually knows the topic | > 80% |
| **Coverage** | Topics with at least 1 identified expert | > 70% |
| **Ranking Quality** | Top expert is truly most knowledgeable | > 75% |
| **Fairness** | No demographic bias in expert identification | Verified |

## Step 4: Evaluate Freshness

```bash
python evaluation/eval_freshness.py \
  --output evaluation/results/freshness.json
```

Freshness metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Stale Content Rate** | Items past TTL / total items | < 10% |
| **Review Compliance** | Stale items reviewed on schedule | > 80% |
| **Auto-Archive** | Expired items archived (not served) | 100% |

## Step 5: Evaluate Retrieval Relevance

```bash
python evaluation/eval_retrieval.py \
  --test-data evaluation/data/queries/ \
  --output evaluation/results/retrieval.json
```

Retrieval metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **NDCG@5** | Search result quality | > 0.70 |
| **MRR** | First relevant result position | > 0.60 |
| **Usage Rate** | Knowledge used in answers | > 50% |
| **Helpful Rating** | User marks answer as helpful | > 4.0/5.0 |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Capture rate | > 80% | config/guardrails.json |
| Duplicate detection | > 95% | config/guardrails.json |
| Expert relevance | > 80% | config/guardrails.json |
| Stale content | < 10% | config/guardrails.json |
| NDCG@5 | > 0.70 | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
