---
name: evaluate-semantic-search-engine
description: "Evaluate Semantic Search Engine — measure NDCG@10, MRR, zero-result rate, query latency, personalization lift, embedding quality. Use when: evaluate, benchmark search quality."
---

# Evaluate Semantic Search Engine

## When to Use
- Measure search relevance (NDCG@10, MRR, Precision@K)
- Track zero-result rate and identify coverage gaps
- Benchmark query latency under load
- Evaluate personalization effectiveness
- Gate deployments with search quality thresholds

## Search Quality Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| NDCG@10 | ≥ 0.75 | Normalized DCG on judged queries |
| MRR | ≥ 0.65 | Mean Reciprocal Rank |
| Precision@5 | ≥ 0.60 | Relevant in top 5 / 5 |
| Zero-result rate | < 3% | Queries returning 0 results |
| Query latency (p50) | < 150ms | Median response time |
| Query latency (p95) | < 400ms | Tail latency |
| Personalization lift | ≥ 10% | NDCG with vs without personalization |
| Query expansion recall lift | ≥ 15% | Recall with vs without expansion |
| Embedding quality | cosine similarity > 0.8 for similar docs | Embedding coherence test |

## Step 1: Prepare Judged Query Set
```json
{"query": "how to deploy containers", "relevant_docs": ["doc-k8s-101", "doc-aci-guide"], "levels": [3, 2]}
{"query": "machine learning model training", "relevant_docs": ["doc-ml-pipeline", "doc-fine-tuning"], "levels": [3, 3]}
```
Minimum: 100 judged queries with relevance levels (0=irrelevant, 1=partial, 2=relevant, 3=highly relevant).

## Step 2: Evaluate Relevance Metrics
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics relevance
```
- NDCG@10 across all queries
- Per-category breakdown (which topics have low relevance?)
- Compare: keyword-only vs vector-only vs hybrid vs hybrid+semantic

## Step 3: Evaluate Query Expansion
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics query_expansion
```
- Compare recall with and without expansion
- Track which expansion method helps most (synonym, LLM, spelling)
- Identify over-expansion (irrelevant results from too-broad terms)

## Step 4: Evaluate Personalization
- Run same queries with/without user profiles
- Measure NDCG lift from personalization
- Verify: personalization doesn't create filter bubbles
- Test: new user (no profile) still gets good results

## Step 5: Performance Under Load
```bash
python evaluation/benchmark.py --endpoint $SEARCH_API --rps 100 --duration 300s
```
- p50, p95, p99 latency at various QPS
- Throughput ceiling (max QPS before degradation)
- Impact of query expansion on latency

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy to production |
| NDCG < 0.65 | Tune scoring profiles, improve embeddings |
| Zero-result > 5% | Add synonym maps, expand content coverage |
| Latency p95 > 800ms | Add replicas, optimize query complexity |
| Personalization <5% lift | Improve user profile signals |

## Evaluation Cadence
- **Pre-deployment**: Full judged query evaluation (100+ queries)
- **Weekly**: Zero-result rate, latency monitoring
- **Monthly**: Re-judge top 50 queries, update relevance labels
- **On index change**: Compare NDCG before/after

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Relevant doc ranked low | No field boost on title | Add title_weight=3.0 in scoring profile |
| Embedding search misses exact matches | Vector-only search | Enable hybrid (BM25 + vector) |
| Query expansion returns noise | LLM too creative | Add "only closely related terms" to prompt |
| Personalization hurts new users | No cold-start fallback | Use global popularity for users with <5 interactions |
| Index stale | Indexer schedule not set | Enable incremental indexing every 5 min |
| High latency on complex queries | Query expansion on every query | Expand only zero-result queries |

## CI/CD Quality Gates
```yaml
- name: NDCG Quality Gate
  run: python evaluation/eval.py --metrics relevance --ci-gate --ndcg-threshold 0.75
- name: Zero-Result Gate
  run: python evaluation/eval.py --metrics coverage --ci-gate --max-zero-rate 0.03
- name: Latency Gate
  run: python evaluation/eval.py --metrics latency --ci-gate --p95-max 400
```
