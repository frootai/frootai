---
name: "tune-semantic-code-search"
description: "Tune Semantic Code Search — embedding model selection, boost weights (docstring vs code vs comments), query rewriting, top-k, score threshold, indexing batch size, cost."
---

# Tune Semantic Code Search

## Prerequisites

- Deployed code search with evaluation results available
- Access to `config/openai.json`, `config/search.json`, `config/guardrails.json`
- Evaluation baseline from `evaluate-semantic-code-search` skill

## Step 1: Tune Embedding Model

```json
// config/openai.json
{
  "embedding": {
    "model": "text-embedding-3-large",
    "dimensions": 3072,
    "batch_size": 100,
    "max_chunk_tokens": 512
  },
  "query_enhancement": {
    "model": "gpt-4o-mini",
    "rewrite_queries": true,
    "expand_abbreviations": true,
    "add_code_keywords": true
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `model` | text-embedding-3-large | Small = cheaper, Large = better quality |
| `dimensions` | 3072 | Lower (e.g., 1024) = faster search, less precise |
| `max_chunk_tokens` | 512 | Higher = more context per chunk, costlier |
| `rewrite_queries` | true | Improves NL queries, slight latency add |

### Embedding Model Selection Guide
| Codebase Size | Recommended Model | Cost/month |
|--------------|-------------------|------------|
| < 10K functions | text-embedding-3-small | ~$5 |
| 10K-100K functions | text-embedding-3-large | ~$50 |
| > 100K functions | text-embedding-3-large + caching | ~$30 (cached) |

## Step 2: Tune Search Boost Weights

```json
// config/search.json
{
  "hybrid_search": {
    "keyword_weight": 0.3,
    "vector_weight": 0.7,
    "semantic_reranking": true
  },
  "field_boosts": {
    "name": 5.0,
    "signature": 3.0,
    "docstring": 3.0,
    "body": 1.0
  },
  "results": {
    "top_k": 10,
    "score_threshold": 0.5,
    "max_results_per_file": 3
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `keyword_weight` | 0.3 | Higher = better for exact function names |
| `vector_weight` | 0.7 | Higher = better for NL description queries |
| `name` boost | 5.0 | Strongly prioritize function name matches |
| `docstring` boost | 3.0 | High — closest to NL query intent |
| `body` boost | 1.0 | Low — noise in body text |
| `score_threshold` | 0.5 | Lower = more results, may include irrelevant |

### Boost Weight Tuning Guide
| Symptom | Adjustment |
|---------|------------|
| Function names not found | Increase name boost to 8.0 |
| NL queries return wrong code | Increase vector_weight to 0.8 |
| Too many irrelevant results | Raise score_threshold to 0.6 |
| Same file dominates results | Lower max_results_per_file to 2 |
| Docstring queries miss code | Increase docstring boost to 5.0 |

## Step 3: Tune Query Rewriting

```json
// config/openai.json
{
  "query_rewriting": {
    "enabled": true,
    "model": "gpt-4o-mini",
    "temperature": 0.1,
    "system_prompt": "Rewrite this natural language query into search-optimized terms. Add relevant function names, patterns, and code keywords. Keep it concise.",
    "examples": [
      { "input": "how to retry API calls", "rewritten": "retry exponential backoff API request error handling decorator" },
      { "input": "database connection pooling", "rewritten": "connection pool database session factory singleton create_engine" }
    ]
  }
}
```

Query rewriting improves:
- NL→code gap ("how do I" → actual function patterns)
- Abbreviation expansion ("auth" → "authentication authorization")
- Framework-specific terms ("ORM" → "SQLAlchemy Django ORM model")

## Step 4: Tune Indexing

```json
// config/guardrails.json
{
  "indexing": {
    "supported_languages": [".py", ".ts", ".js", ".tsx", ".jsx", ".go", ".rs", ".java", ".cs"],
    "max_file_size_kb": 100,
    "ignore_patterns": ["test_*", "*_test.*", "*.min.*", "vendor/", "node_modules/"],
    "include_tests": false,
    "batch_size": 500,
    "refresh_on_push": true,
    "full_reindex_schedule": "weekly"
  },
  "access_control": {
    "enforce_repo_permissions": true,
    "permission_cache_ttl_seconds": 300
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `include_tests` | false | true = test files searchable (doubles index) |
| `max_file_size_kb` | 100 | Higher = index large files, slower |
| `batch_size` | 500 | Higher = faster indexing, more memory |
| `full_reindex_schedule` | weekly | More frequent = fresher, more cost |
| `permission_cache_ttl` | 300s | Lower = more permission checks, slower |

## Step 5: Cost Optimization

```python
# Code search cost breakdown:
# - Embedding generation: ~$0.13/M tokens (3-large)
#   100K functions × 500 tokens avg = 50M tokens = $6.50 initial
# - AI Search instance: ~$250/month (Standard tier)
# - Incremental indexing: ~$0.50/day (push-triggered)
# - Query embedding: ~$0.001/query
# - Container Apps: ~$30/month
# - Total: ~$290/month for 100K function index

# Cost reduction:
# 1. text-embedding-3-small ($0.02/M) = $1/initial index (save 85%)
# 2. AI Search Basic tier ($75/month) for <100K docs
# 3. Cache query embeddings for repeated searches
# 4. Reduce dimensions to 1024 (smaller index)
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| Small embedding model | ~85% embedding | Lower search quality |
| AI Search Basic tier | ~70% search | Max 15 indexes, 1M docs |
| Reduced dimensions (1024) | ~50% storage | Slightly less precise |
| Exclude test files | ~40% index size | Can't search tests |
| Weekly full reindex | ~85% indexing | Less fresh index |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_relevance.py --test-data evaluation/data/
python evaluation/eval_performance.py --search-endpoint $SEARCH_ENDPOINT
python evaluation/eval_embeddings.py --test-data evaluation/data/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| NDCG@5 | baseline | +0.05-0.10 | > 0.75 |
| Recall@10 | baseline | +5-10% | > 85% |
| P95 latency | baseline | -30-50% | < 300ms |
| Monthly cost | ~$290 | ~$110-150 | < $300 |
