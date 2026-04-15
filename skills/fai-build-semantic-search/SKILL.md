---
name: fai-build-semantic-search
description: |
  Implement semantic search with text embeddings, hybrid ranking, cross-encoder
  reranking, and retrieval quality evaluation. Use when building knowledge
  retrieval beyond keyword matching.
---

# Semantic Search Implementation

Build search that understands meaning using embeddings, hybrid ranking, and reranking.

## When to Use

- Keyword search returns irrelevant results for natural language
- Building knowledge retrieval for RAG pipelines
- Combining keyword precision with semantic understanding
- Evaluating and tuning search relevance

---

## Architecture

```
Query -> [BM25 Keyword] --+
                           +--> Hybrid Merge -> Rerank -> Top K
Query -> [Vector Search] --+
```

## Hybrid Search Query

```python
from azure.search.documents import SearchClient

def hybrid_search(query: str, client: SearchClient, top_k: int = 10):
    return client.search(
        search_text=query,
        vector_queries=[{"kind": "text", "text": query,
                         "fields": "contentVector", "k": top_k, "weight": 0.7}],
        query_type="semantic",
        semantic_configuration_name="default",
        top=top_k,
        select=["id", "title", "content", "source"],
    )
```

## Cross-Encoder Reranking

```python
def rerank(query: str, candidates: list[dict], top_k: int = 5):
    scored = [({**doc, "rerank_score": cross_encoder(query, doc["content"])})
              for doc in candidates]
    return sorted(scored, key=lambda x: x["rerank_score"], reverse=True)[:top_k]
```

## Retrieval Evaluation

```python
def evaluate_retrieval(test_queries, search_fn, k=5):
    hits, mrr = 0, 0.0
    for row in test_queries:
        ids = [r["id"] for r in search_fn(row["query"], top_k=k)]
        if row["relevant_id"] in ids:
            hits += 1
            mrr += 1.0 / (ids.index(row["relevant_id"]) + 1)
    n = len(test_queries)
    return {"recall@k": hits/n, "mrr@k": mrr/n, "k": k}
```

## Tuning Guide

| Parameter | Default | When to Change |
|-----------|---------|---------------|
| Vector weight | 0.7 | Lower for exact-match domains |
| Chunk size | 512 | Reduce for precision |
| Top K | 10 | Increase for recall |
| Reranker | Off | Enable for quality-critical |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Wrong semantic results | Low vector weight | Increase weight or add reranker |
| Exact-match fails | Vector doesn't handle IDs | Increase keyword weight |
| Slow queries | Reranker on all results | Rerank top-20, return top-5 |
| Low recall | Chunk boundaries | Increase overlap |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Start simple, add complexity when needed | Avoid over-engineering |
| Automate repetitive tasks | Consistency and speed |
| Document decisions and tradeoffs | Future reference for the team |
| Validate with real data | Don't rely on synthetic tests alone |
| Review with peers | Fresh eyes catch blind spots |
| Iterate based on feedback | First version is never perfect |

## Quality Checklist

- [ ] Requirements clearly defined
- [ ] Implementation follows project conventions
- [ ] Tests cover happy path and error paths
- [ ] Documentation updated
- [ ] Peer reviewed
- [ ] Validated in staging environment

## Related Skills

- `fai-implementation-plan-generator` — Planning and milestones
- `fai-review-and-refactor` — Code review patterns
- `fai-quality-playbook` — Engineering quality standards
