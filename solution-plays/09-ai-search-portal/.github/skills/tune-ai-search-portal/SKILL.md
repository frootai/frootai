---
name: tune-ai-search-portal
description: "Tune AI Search Portal — optimize scoring profiles, boost functions, indexer schedule, caching strategy, embedding model selection. Use when: tune, optimize."
---

# Tune AI Search Portal

## When to Use
- Optimize search relevance via scoring profiles
- Tune hybrid search weights (keyword vs vector vs semantic)
- Configure boost functions for freshness, popularity, category
- Optimize indexer schedule and throughput
- Select best embedding model for cost vs quality

## Tuning Dimensions

### Dimension 1: Scoring Profile Optimization

| Boost Type | Parameter | Range | Impact |
|-----------|-----------|-------|--------|
| Field boost | title weight | 2.0-5.0 | Title matches ranked higher |
| Freshness | date decay | linear/exponential | Recent content preferred |
| Magnitude | popularity score | 1.0-3.0 | Popular docs ranked higher |
| Tag boost | category match | 1.5-3.0 | Category-filtered results boosted |
| Distance | geo proximity | 1.0-2.0 | Nearby results preferred |

**Scoring profile template**:
```json
{
  "name": "production-scoring",
  "text": { "weights": { "title": 3.0, "content": 1.0 } },
  "functions": [
    { "type": "freshness", "fieldName": "date", "boost": 2.0, "interpolation": "linear", "freshness": { "boostingDuration": "P30D" } },
    { "type": "magnitude", "fieldName": "viewCount", "boost": 1.5, "magnitude": { "boostingRangeStart": 0, "boostingRangeEnd": 1000 } }
  ]
}
```

### Dimension 2: Hybrid Search Weight Tuning

| Configuration | Keyword | Vector | Semantic | Best For |
|--------------|---------|--------|----------|----------|
| Keyword-heavy | 0.6 | 0.2 | 0.2 | Exact term matching (codes, IDs) |
| Balanced | 0.33 | 0.33 | 0.34 | General-purpose search |
| Vector-heavy | 0.2 | 0.5 | 0.3 | Conceptual/semantic queries |
| Semantic-first | 0.2 | 0.2 | 0.6 | Natural language questions |

**Diagnostic**: Compare NDCG@10 across configurations to find optimal weights.

### Dimension 3: Index Configuration

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Replicas | 1 | 1-12 | More = higher read throughput |
| Partitions | 1 | 1-12 | More = larger index capacity |
| Analyzer | standard | standard/custom/language | Language-specific = better recall |
| Synonym maps | None | 0-5 maps | Improves zero-result rate |

**Scaling rule**: queries/second ÷ 15 = required replicas (approximate).

### Dimension 4: Embedding Model Selection

| Model | Dimensions | Cost/1M tokens | Quality | Latency |
|-------|-----------|----------------|---------|---------|
| text-embedding-3-large | 3072 | $0.13 | Highest | ~50ms |
| text-embedding-3-small | 1536 | $0.02 | Good | ~30ms |
| text-embedding-ada-002 | 1536 | $0.10 | Legacy | ~40ms |

**Recommendation**: Start with text-embedding-3-large for quality, switch to small if cost is critical and quality delta < 5%.

### Dimension 5: Cost Optimization

| Component | Cost Driver | Optimization |
|-----------|------------|-------------|
| AI Search | Replicas × partitions × tier | Right-size: Standard S1 with 1 replica for dev |
| Embeddings | Documents × reindex frequency | Incremental indexing, not full reindex |
| Storage | Document volume | Archive old versions, compress |
| Queries | QPS × complexity | Cache frequent queries in Redis |

**Monthly cost estimate** (100K documents, 10K queries/day):
- AI Search S1 (1 replica): ~$250/mo
- Embeddings (monthly reindex): ~$50/mo
- Storage: ~$20/mo
- **Total: ~$320/mo**

## Production Readiness Checklist
- [ ] NDCG@10 ≥ 0.7 on relevance test set
- [ ] Zero-result rate < 5%
- [ ] Query latency p95 < 500ms
- [ ] Scoring profile configured and tested
- [ ] Hybrid search weights optimized for content type
- [ ] Synonym maps deployed for common terms
- [ ] Indexer running reliably on schedule
- [ ] Search analytics logging enabled
- [ ] Autocomplete configured and responsive
- [ ] Access control verified (RBAC, API keys rotated)

## Output: Tuning Report
After tuning, compare before/after:
- NDCG@10 delta
- Zero-result rate change
- Query latency improvement
- Cost per query change
- Hybrid weight recommendations
