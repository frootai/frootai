---
description: "Semantic Search Engine domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Semantic Search Engine — Domain Knowledge

This workspace implements a semantic search engine — vector embeddings, hybrid search (BM25 + vector + semantic reranking), personalized scoring profiles, faceted navigation, and autocomplete.

## Semantic Search Architecture (What the Model Gets Wrong)

### Embedding Pipeline
```python
# WRONG — embed at query time only (index has no vectors)
query_vector = embed(query)
results = keyword_search(query)  # BM25 only

# CORRECT — embed documents at index time, embed queries at search time
# Index time:
for doc in documents:
    doc["vector"] = embed_model.encode(doc["content"])  # text-embedding-3-large
    search_client.upload_documents([doc])

# Query time:
results = search_client.search(
    search_text=query,                                    # BM25
    vector_queries=[VectorizableTextQuery(text=query, k_nearest_neighbors=50, fields="vector")],
    query_type="semantic", semantic_configuration_name="default",  # Reranking
    top=10, select=["title", "content", "url"],
)
```

### Scoring Profile Design
```json
{
  "name": "recency-relevance",
  "text": { "weights": { "title": 5, "content": 1, "tags": 3 } },
  "functions": [
    { "type": "freshness", "fieldName": "lastModified", "boost": 3, "parameters": { "boostingDuration": "P30D" } },
    { "type": "magnitude", "fieldName": "viewCount", "boost": 2, "parameters": { "boostingRangeStart": 0, "boostingRangeEnd": 1000 } }
  ]
}
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Keyword-only search | Misses semantic meaning ("car" won't match "vehicle") | Hybrid: BM25 + vector + semantic reranking |
| No scoring profiles | All results equal weight | Boost by recency, popularity, field importance |
| Wrong embedding model | Query uses different model than index | Same model for indexing AND querying |
| No faceted navigation | Users can't filter results | Add filterable + facetable fields |
| Stale index | New docs not searchable | Indexer schedule or push API on content change |
| No zero-result handling | Blank page frustrates users | Suggest related queries, show popular content |
| No query analytics | Don't know what users search for | Log queries, track zero-result rate, top queries |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/search.json` | Scoring profiles, top_k, semantic config, facets |
| `config/openai.json` | Embedding model selection |
| `config/guardrails.json` | Result quality thresholds, content filtering |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Design index schema, scoring profiles, hybrid search, UI |
| `@reviewer` | Audit relevance, security, access control, data freshness |
| `@tuner` | Optimize scoring, embedding model, indexer performance |

## Slash Commands
`/deploy` — Deploy search engine | `/test` — Test search quality | `/review` — Audit relevance | `/evaluate` — Measure NDCG + zero-result rate
