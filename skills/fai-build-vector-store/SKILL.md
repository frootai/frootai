---
name: fai-build-vector-store
description: |
  Build vector store pipelines with embedding generation, index sync, metadata
  filtering, and retrieval quality controls. Use when setting up vector search
  for RAG, recommendation, or similarity matching.
---

# Vector Store Pipeline

Build and manage vector indexes with embedding sync, filters, and quality controls.

## When to Use

- Setting up vector search for RAG pipelines
- Syncing document embeddings to a vector store
- Implementing metadata filtering on vector results
- Evaluating retrieval quality with test queries

---

## Embedding Generation

```python
def generate_embeddings(texts: list[str], model="text-embedding-3-small",
                        batch_size: int = 16) -> list[list[float]]:
    all_embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        resp = oai.embeddings.create(model=model, input=batch)
        all_embeddings.extend([d.embedding for d in resp.data])
    return all_embeddings
```

## Index Sync Pattern

```python
def sync_to_index(documents: list[dict], search_client, embed_fn):
    """Upsert documents with fresh embeddings to search index."""
    texts = [d["content"] for d in documents]
    embeddings = embed_fn(texts)
    for doc, emb in zip(documents, embeddings):
        doc["contentVector"] = emb
    search_client.merge_or_upload_documents(documents)
```

## Metadata Filtering

```python
results = search_client.search(
    search_text=None,
    vector_queries=[{"kind": "text", "text": query,
                     "fields": "contentVector", "k": 10}],
    filter="category eq 'technical' and language eq 'en'",
    select=["id", "title", "content", "category"],
)
```

## Quality Evaluation

```python
def eval_retrieval(test_pairs: list[dict], search_fn, k=5) -> dict:
    hits = 0
    for pair in test_pairs:
        results = search_fn(pair["query"], top_k=k)
        if pair["expected_id"] in [r["id"] for r in results]:
            hits += 1
    return {"recall_at_k": hits / len(test_pairs), "k": k}
```

## Store Comparison

| Store | Type | Best For |
|-------|------|----------|
| Azure AI Search | Managed | Enterprise RAG, hybrid search |
| Qdrant | Self-hosted | High-performance, filtering |
| ChromaDB | Embedded | Prototyping, local dev |
| Pinecone | Managed | Serverless, auto-scaling |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Stale embeddings | No re-sync on content change | Use change detection trigger |
| Wrong results with filter | Filter field not filterable | Mark field as filterable in schema |
| High embedding costs | Re-embedding unchanged docs | Cache embeddings, only re-embed changed |
| Dimension mismatch | Mixed models in same index | Standardize on one model per index |

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
