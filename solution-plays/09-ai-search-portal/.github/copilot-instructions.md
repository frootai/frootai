---
description: "AI Search Portal domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# AI Search Portal — Domain Knowledge

This workspace implements an Azure AI Search-powered search portal — hybrid search, semantic ranking, faceted navigation, and autocomplete for enterprise document discovery.

## AI Search Architecture (What the Model Gets Wrong)

### Hybrid Search (Not Vector-Only, Not BM25-Only)
```python
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizableTextQuery

# WRONG — vector-only (misses keyword matches like product codes)
results = client.search(vector_queries=[VectorizableTextQuery(text=query, ...)])

# WRONG — BM25-only (misses semantic meaning)
results = client.search(search_text=query)

# CORRECT — hybrid with semantic reranking
results = client.search(
    search_text=query,                       # BM25 keyword
    vector_queries=[VectorizableTextQuery(text=query, k_nearest_neighbors=50, fields="contentVector")],
    query_type="semantic",                    # Semantic reranking
    semantic_configuration_name="default",
    top=10,
    select=["title", "content", "url", "lastModified"],
    facets=["category", "department", "fileType"],
    highlight_fields="content",
)
```

### Index Schema Design
| Field | Type | Searchable | Filterable | Facetable | Key |
|-------|------|-----------|------------|-----------|-----|
| id | Edm.String | No | No | No | Yes |
| title | Edm.String | Yes | No | No | No |
| content | Edm.String | Yes | No | No | No |
| contentVector | Collection(Edm.Single) | No | No | No | No |
| category | Edm.String | No | Yes | Yes | No |
| department | Edm.String | No | Yes | Yes | No |
| fileType | Edm.String | No | Yes | Yes | No |
| lastModified | Edm.DateTimeOffset | No | Yes | No | No |
| url | Edm.String | No | No | No | No |

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Vector-only search | Misses exact matches (IDs, codes) | Hybrid: BM25 + vector + semantic |
| No semantic configuration | Reranking not active | Create semantic config in index |
| Wrong analyzer | Poor tokenization for domain terms | Use custom analyzer for technical content |
| No facets | Users can't filter results | Add facetable fields (category, department) |
| No highlighting | Users can't see match context | Use `highlight_fields` parameter |
| Stale index | Documents updated but index isn't | Configure indexer schedule or push API |
| No autocomplete | Users must type full queries | Enable autocomplete with suggester |
| Embedding model mismatch | Query embedding differs from index | Same model for indexing AND querying |

### Scoring Profiles
```json
{
  "name": "recency-boost",
  "text": { "weights": { "title": 3, "content": 1 } },
  "functions": [{
    "type": "freshness",
    "fieldName": "lastModified",
    "boost": 2,
    "parameters": { "boostingDuration": "P30D" }
  }]
}
```

## Evaluation Targets
| Metric | Target |
|--------|--------|
| Search relevance (NDCG@10) | >= 0.7 |
| Query latency (p95) | < 500ms |
| Zero-result rate | < 5% |
| Click-through rate | >= 30% |
| Autocomplete acceptance | >= 40% |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/search.json` | search_type, top_k, scoring_profile, semantic_config |
| `config/openai.json` | embedding model for vectorization |
| `config/guardrails.json` | content filters, access control |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Design search index, configure hybrid search, build UI |
| `@reviewer` | Audit search relevance, security, access control |
| `@tuner` | Optimize scoring profiles, indexer performance, caching |

## Slash Commands
`/deploy` — Deploy search portal | `/test` — Test search quality | `/review` — Audit relevance | `/evaluate` — Measure search metrics
