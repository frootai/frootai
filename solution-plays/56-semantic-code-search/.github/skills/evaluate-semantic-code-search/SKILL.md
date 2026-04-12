---
name: "evaluate-semantic-code-search"
description: "Evaluate Semantic Code Search quality — NDCG, recall, MRR, search latency, index freshness, access control, embedding model quality."
---

# Evaluate Semantic Code Search

## Prerequisites

- Deployed code search (run `deploy-semantic-code-search` skill first)
- Test query dataset with relevance judgments
- Python 3.11+ with `azure-ai-evaluation` package

## Step 1: Prepare Evaluation Dataset

```bash
mkdir -p evaluation/data
# Each test: NL query + relevant code paths (judged by developers)
# evaluation/data/query-001.json
# {
#   "query": "How to handle authentication errors in Python",
#   "relevant_results": ["src/auth/error_handler.py:15", "src/middleware/auth.py:42"],
#   "irrelevant_results": ["src/utils/string.py:10"],
#   "category": "error-handling"
# }
```

Test categories:
- **API patterns**: Auth, error handling, retry, pagination (10 queries)
- **Data patterns**: Parsing, validation, serialization (10 queries)
- **Architecture**: Design patterns, factories, singletons (5 queries)
- **Function name search**: Exact function name lookup (10 queries)
- **Natural language**: Descriptive queries (10 queries)
- **Cross-language**: Same concept in Python vs TypeScript (5 queries)

## Step 2: Evaluate Search Relevance

```bash
python evaluation/eval_relevance.py \
  --test-data evaluation/data/ \
  --search-endpoint $SEARCH_ENDPOINT \
  --output evaluation/results/relevance.json
```

Relevance metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **NDCG@5** | Normalized DCG at top 5 results | > 0.75 |
| **NDCG@10** | Normalized DCG at top 10 | > 0.70 |
| **Recall@10** | Relevant results found in top 10 | > 85% |
| **MRR** | Mean Reciprocal Rank (first relevant result) | > 0.65 |
| **Precision@5** | Relevant / total in top 5 | > 60% |

Relevance by query type:
| Query Type | Expected NDCG@5 | Challenge |
|-----------|-----------------|----------|
| Function name (exact) | > 0.90 | Keyword search handles well |
| Docstring match | > 0.80 | Semantic + keyword |
| NL description | > 0.65 | Depends on embedding quality |
| Cross-language concept | > 0.55 | Hardest — same meaning, diff syntax |

## Step 3: Evaluate Search Performance

```bash
python evaluation/eval_performance.py \
  --search-endpoint $SEARCH_ENDPOINT \
  --output evaluation/results/performance.json
```

Performance metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **P50 Latency** | Median search time | < 100ms |
| **P95 Latency** | 95th percentile | < 300ms |
| **Index Size** | Total indexed code chunks | Track |
| **Index Freshness** | Time from push to searchable | < 60s |
| **Throughput** | Queries per second | > 50 QPS |

## Step 4: Evaluate Embedding Quality

```bash
python evaluation/eval_embeddings.py \
  --test-data evaluation/data/ \
  --output evaluation/results/embeddings.json
```

Embedding metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Cosine Similarity (relevant)** | Similarity between query and relevant code | > 0.7 |
| **Cosine Similarity (irrelevant)** | Similarity between query and irrelevant | < 0.4 |
| **Separation** | Gap between relevant and irrelevant | > 0.3 |
| **Cross-language similarity** | Same function in Python vs JS | > 0.6 |

## Step 5: Evaluate Access Control

```bash
python evaluation/eval_access.py \
  --search-endpoint $SEARCH_ENDPOINT \
  --output evaluation/results/access.json
```

Access control metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Unauthorized access blocked** | Private repo results filtered | 100% |
| **Authorized access allowed** | Permitted repos returned | 100% |
| **Cross-repo isolation** | No leakage between repos | 100% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| NDCG@5 | > 0.75 | config/guardrails.json |
| Recall@10 | > 85% | config/guardrails.json |
| P95 latency | < 300ms | config/guardrails.json |
| Index freshness | < 60s | config/guardrails.json |
| Access control | 100% | config/guardrails.json |
