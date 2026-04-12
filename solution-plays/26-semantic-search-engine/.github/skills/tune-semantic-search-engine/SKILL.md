---
name: tune-semantic-search-engine
description: "Tune Semantic Search Engine — optimize scoring profiles, embedding model, query expansion strategy, personalization weights, index configuration, cost per query. Use when: tune, optimize search."
---

# Tune Semantic Search Engine

## When to Use
- Optimize scoring profiles for better relevance ranking
- Select best embedding model for quality vs cost
- Tune query expansion strategy (synonym vs LLM)
- Configure personalization weights and decay
- Reduce cost per query at scale

## Tuning Dimensions

### Dimension 1: Scoring Profile Optimization

| Boost Type | Parameter | Range | Impact |
|-----------|-----------|-------|--------|
| Title match | title_weight | 2.0-5.0 | Title matches ranked higher |
| Freshness | date_boost | 1.5-3.0, 30-365 day decay | Recent content preferred |
| Popularity | click_count_boost | 1.0-2.0 | More-clicked results boosted |
| Source authority | source_weight | 1.0-3.0 | Official docs > user content |
| Category match | category_boost | 1.5-2.5 | Category-filtered boost |

**Tuning method**: Run NDCG@10 on judged queries with each profile variation. Pick the profile with highest NDCG.

### Dimension 2: Embedding Model Selection

| Model | Dims | Cost/1M | NDCG | Latency | Best For |
|-------|------|---------|------|---------|---------|
| text-embedding-3-large | 3072 | $0.13 | Highest | ~50ms | Quality-critical search |
| text-embedding-3-small | 1536 | $0.02 | Good | ~30ms | Cost-optimized, high volume |
| text-embedding-ada-002 | 1536 | $0.10 | Legacy | ~40ms | Existing indexes (no re-embed) |

**Decision**: Start with 3-large. If NDCG delta <3% vs 3-small → switch to save 85% on embedding cost.

### Dimension 3: Query Expansion Strategy

| Method | Recall Lift | Precision Impact | Cost | Latency |
|--------|------------|-----------------|------|---------|
| None | Baseline | Baseline | $0 | 0ms |
| Synonym map | +10% | Neutral | $0 | 0ms |
| Spelling correction | +5% | Positive | $0 | 5ms |
| LLM expansion (gpt-4o-mini) | +20% | Slight negative | $0.01 | 200ms |
| Combined (synonym + LLM) | +25% | Slight negative | $0.01 | 200ms |

**Recommendation**: Synonym map (free, always on) + LLM expansion only for zero-result queries.

### Dimension 4: Personalization Configuration

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Profile weight | 0.2 | 0.0-0.5 | Higher = more personalized results |
| Click history window | 30 days | 7-90 days | Longer = more data, staler |
| Preference decay | Linear, 30-day half-life | 7-90 day | Faster decay = more responsive |
| Cold-start fallback | Global popularity | Popularity/Recent | For users with no profile |
| Filter bubble prevention | 20% serendipity | 10-30% | Random results to prevent echo chamber |

### Dimension 5: Cost Per Query

| Component | Cost | Optimization |
|-----------|------|-------------|
| AI Search query | ~$0.003/query | Optimize query complexity, use filters |
| Embedding (query) | ~$0.00002/query | Minimal — single embedding per query |
| LLM expansion | ~$0.01/query (if used) | Only on zero-result, not every query |
| Personalization | ~$0.001/query | Cache user profiles in Redis |
| **Total** | **~$0.004/query** (no LLM) | **~$0.014 (with LLM expansion)** |

**Monthly at scale** (1M queries/day):
- Without expansion: ~$3,600/mo
- With expansion on zero-result (5%): ~$5,100/mo
- With expansion on all: ~$14,400/mo → NOT recommended for all queries

## Production Readiness Checklist
- [ ] NDCG@10 ≥ 0.75 on judged query set
- [ ] Zero-result rate < 3%
- [ ] Query latency p95 < 400ms
- [ ] Scoring profiles configured and tested
- [ ] Embedding model selected (quality vs cost decision documented)
- [ ] Query expansion: synonym map always on, LLM on zero-result only
- [ ] Personalization tested (lift ≥ 10%, no filter bubble)
- [ ] Multi-tenant isolation verified
- [ ] Index refresh schedule configured
- [ ] Monitoring: NDCG trending, zero-result rate, latency

## Output: Tuning Report
After tuning, compare:
- NDCG@10 improvement
- Zero-result rate reduction
- Query latency change
- Personalization lift
- Cost per query optimization

## Tuning Playbook
1. **Baseline**: Run 100 judged queries, record NDCG/MRR/latency
2. **Scoring**: Test 3 scoring profile variants, pick highest NDCG
3. **Embedding**: Compare 3-large vs 3-small on same queries
4. **Expansion**: Enable synonym map, measure recall lift
5. **Personalization**: Test with/without for returning users
6. **Cost**: Calculate cost per query at target volume
7. **Re-baseline**: Run same 100 queries, compare before/after
