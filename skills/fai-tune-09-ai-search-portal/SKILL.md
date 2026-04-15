---
name: fai-tune-09-ai-search-portal
description: "Tune Play 09 (AI Search Portal) semantic ranking, scoring profiles, suggesters, and index schema for optimal relevance."
---

# FAI Tune — Play 09: AI Search Portal

## TuneKit Configuration Files

```
solution-plays/09-ai-search-portal/config/
├── index.json            # Index schema and field definitions
├── ranking.json          # Semantic ranking and scoring profiles
├── suggester.json        # Autocomplete and suggestion config
├── skillset.json         # AI enrichment pipeline config
└── guardrails.json       # Quality and performance thresholds
```

## Step 1 — Validate Index Schema

```json
// config/index.json
{
  "name": "search-portal-index",
  "fields": [
    { "name": "id", "type": "Edm.String", "key": true, "filterable": true },
    { "name": "title", "type": "Edm.String", "searchable": true, "analyzer": "en.microsoft" },
    { "name": "content", "type": "Edm.String", "searchable": true, "analyzer": "en.microsoft" },
    { "name": "content_vector", "type": "Collection(Edm.Single)", "dimensions": 1536, "vectorSearchProfile": "hnsw-profile" },
    { "name": "category", "type": "Edm.String", "filterable": true, "facetable": true },
    { "name": "last_updated", "type": "Edm.DateTimeOffset", "sortable": true, "filterable": true }
  ],
  "vectorSearch": {
    "algorithms": [{ "name": "hnsw", "kind": "hnsw", "parameters": { "m": 4, "efConstruction": 400, "efSearch": 500 } }],
    "profiles": [{ "name": "hnsw-profile", "algorithm": "hnsw", "vectorizer": "text-embedding" }]
  },
  "semantic": {
    "configurations": [{
      "name": "semantic-config",
      "prioritizedFields": {
        "titleField": { "fieldName": "title" },
        "contentFields": [{ "fieldName": "content" }]
      }
    }]
  }
}
```

## Step 2 — Tune Semantic Ranking

```json
// config/ranking.json
{
  "default_search_mode": "hybrid",
  "semantic_reranker": true,
  "semantic_configuration": "semantic-config",
  "scoring_profiles": [
    {
      "name": "freshness-boost",
      "functions": [
        { "type": "freshness", "fieldName": "last_updated", "boost": 2.0, "parameters": { "boostingDuration": "P30D" } }
      ]
    },
    {
      "name": "category-boost",
      "text": { "weights": { "title": 3.0, "content": 1.0 } }
    }
  ],
  "top_k": 10,
  "min_score_threshold": 0.5,
  "vector_weight": 0.5,
  "text_weight": 0.5
}
```

**Tuning checklist:**

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `top_k` | 5-50 | 10 | More results = better recall, slower response |
| `vector_weight` | 0.0-1.0 | 0.5 | Higher for semantic similarity search |
| `text_weight` | 0.0-1.0 | 0.5 | Higher for keyword/exact match search |
| Freshness `boost` | 1.0-5.0 | 2.0 | Higher prioritizes recent documents |

## Step 3 — Configure Suggesters

```json
// config/suggester.json
{
  "suggesters": [{
    "name": "default-suggester",
    "sourceFields": ["title", "category"],
    "searchMode": "analyzingInfixMatching"
  }],
  "autocomplete": {
    "enabled": true,
    "min_characters": 3,
    "max_suggestions": 5,
    "highlight_matches": true,
    "fuzzy_matching": true
  }
}
```

## Step 4 — Set Guardrails

```json
// config/guardrails.json
{
  "performance": {
    "max_query_latency_ms": 500,
    "max_indexing_latency_minutes": 15,
    "cache_popular_queries": true,
    "cache_ttl_minutes": 60
  },
  "quality": {
    "min_ndcg_at_10": 0.75,
    "min_precision_at_5": 0.80,
    "zero_results_rate_max": 0.05
  },
  "cost": {
    "max_search_units": 3,
    "max_documents": 1000000,
    "max_index_size_gb": 50
  }
}
```

## Validation Checklist

| Check | Expected | Command |
|-------|----------|---------|
| Semantic reranker | true | `jq '.semantic_reranker' config/ranking.json` |
| Search mode | hybrid | `jq '.default_search_mode' config/ranking.json` |
| Query latency | <=500ms | Monitor via Application Insights |
| NDCG@10 | >=0.75 | Run relevance evaluation |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Irrelevant results | Text-only search | Enable semantic reranker and hybrid mode |
| Slow queries | Large index, no caching | Enable `cache_popular_queries` and add scoring profiles |
| Zero results | Strict matching | Enable fuzzy matching in suggester |
| High costs | Over-provisioned SUs | Right-size search units based on QPS |
