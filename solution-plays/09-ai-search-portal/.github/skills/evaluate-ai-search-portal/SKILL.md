---
name: evaluate-ai-search-portal
description: "Evaluate AI Search Portal — test search relevance (NDCG@10), query latency, zero-result rate, click-through rate, autocomplete acceptance. Use when: evaluate."
---

# Evaluate AI Search Portal

## When to Use
- Evaluate search relevance quality across query types
- Measure query latency and throughput
- Track zero-result rate and identify coverage gaps
- Validate autocomplete and suggestion quality
- Gate deployments with relevance thresholds

## Quality Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| NDCG@10 | ≥ 0.7 | Normalized Discounted Cumulative Gain on top 10 |
| MRR | ≥ 0.6 | Mean Reciprocal Rank of first relevant result |
| Zero-result rate | < 5% | Queries returning 0 results |
| Query latency (p50) | < 200ms | 50th percentile response time |
| Query latency (p95) | < 500ms | 95th percentile response time |
| Autocomplete latency | < 100ms | Suggestion response time |
| Click-through rate | ≥ 40% | Users clicking a result |
| Semantic ranking lift | ≥ 15% | NDCG improvement vs keyword-only |

## Step 1: Prepare Relevance Test Set
Create judged query-document pairs:
```json
{"query": "azure container deployment", "relevant_docs": ["doc-123", "doc-456"], "relevance_levels": [3, 2]}
{"query": "kubernetes scaling policies", "relevant_docs": ["doc-789", "doc-012"], "relevance_levels": [3, 1]}
{"query": "pricing calculator", "relevant_docs": ["doc-345"], "relevance_levels": [3]}
```
Minimum: 50 judged queries across different categories and intents.

## Step 2: Evaluate Search Relevance
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics relevance
```
- NDCG@10: Are the best results near the top?
- MRR: Is the first relevant result high enough?
- Precision@5: What % of top 5 are relevant?
- Compare keyword-only vs hybrid vs semantic

## Step 3: Evaluate Query Latency
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics latency
```
- p50, p95, p99 latency per query type
- Latency breakdown: network + query parsing + index lookup + ranking
- Cold-start latency vs warm latency
- Latency under load (concurrent queries)

## Step 4: Analyze Zero-Result Queries
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics coverage
```
- Identify queries that return 0 results
- Categorize: missing content vs query mismatch vs synonym gap
- Build synonym maps for common zero-result terms
- Add missing content to knowledge base

## Step 5: Evaluate Autocomplete Quality
- Test prefix queries (2-4 character prefixes)
- Measure suggestion relevance (does top suggestion match intent?)
- Test fuzzy matching (typos: "kubernetse" → "kubernetes")
- Measure acceptance rate (users selecting a suggestion)

## Step 6: Generate Quality Report
```bash
python evaluation/eval.py --all --output evaluation/report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy to production |
| NDCG < 0.6 | Tune scoring profiles, add boost functions |
| Zero-result > 10% | Expand content, add synonym maps |
| Latency p95 > 1s | Check index size, optimize query, add replicas |
| Semantic lift < 10% | Verify semantic config, check content quality |

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Relevant docs ranked low | No scoring profile | Add boost for title matches |
| Vector search dominates | Hybrid weights wrong | Balance vector:keyword to 0.5:0.5 |
| Old content ranked high | No date boost | Add freshness boost in scoring |
| Autocomplete irrelevant | Wrong suggester fields | Use title + category only |
| Slow under load | Single replica | Add replicas for read throughput |
| Facet counts inaccurate | Index not refreshed | Check indexer schedule |

## Evaluation Cadence
- **Pre-deployment**: Full relevance evaluation suite
- **Weekly**: Review search analytics, zero-result queries
- **Monthly**: Re-judge relevance with updated test queries
- **On index change**: Compare NDCG before/after schema change
- **On content update**: Verify new content is indexed and ranked
