---
name: tune-agentic-rag
description: "Tune Agentic RAG — optimize source routing weights, iteration thresholds, self-evaluation sensitivity, semantic cache, cost per query. Use when: tune, optimize retrieval."
---

# Tune Agentic RAG

## When to Use
- Optimize source routing (which source for which query type)
- Tune iteration limits and self-evaluation thresholds
- Configure semantic cache for maximum hit rate
- Reduce cost per query while maintaining quality
- Balance retrieval depth vs response latency

## Tuning Dimensions

### Dimension 1: Source Routing Optimization

| Source | Default Priority | When to Use | Cost per Call |
|--------|-----------------|-------------|--------------|
| AI Search (KB) | 1 (primary) | Internal knowledge, policy, docs | ~$0.003 |
| Bing Web Search | 2 (fallback) | Current events, external info | ~$0.005 |
| SQL Database | 3 (specific) | Customer data, order status | ~$0.001 |
| Custom API | 4 (specialized) | Domain-specific real-time data | Varies |

**Routing optimization**:
- Add query classifiers to route directly (skip unnecessary sources)
- Cache source selection decisions for similar query patterns
- Monitor: which sources are called but results never used? → deprioritize

### Dimension 2: Iteration Threshold Tuning

| Parameter | Conservative | Balanced | Aggressive |
|-----------|-------------|---------|-----------|
| `max_retrieval_hops` | 5 | 3 | 1 |
| `min_groundedness` | 0.95 | 0.85 | 0.75 |
| `early_stop_confidence` | 0.98 | 0.92 | 0.85 |
| Quality | Highest | Good | Fastest |
| Cost | Highest | Moderate | Lowest |
| Latency | Highest | Moderate | Lowest |

**Tuning methodology**:
1. Start balanced (3 hops, 0.85 groundedness)
2. If quality too low: increase hops and raise groundedness threshold
3. If cost too high: reduce hops, accept slightly lower quality
4. Track: queries that exhaust max hops (indicate poor source coverage)

### Dimension 3: Self-Evaluation Tuning

| Setting | Description | Impact |
|---------|-------------|--------|
| Strict (0.95) | Agent almost always iterates | High quality, high cost |
| Moderate (0.85) | Agent stops when reasonably grounded | Good balance |
| Relaxed (0.75) | Agent stops early, faster responses | Lower quality, lower cost |

**Anti-patterns**:
- Self-eval too strict → agent always uses max hops (expensive)
- Self-eval too relaxed → agent responds with insufficient context (low quality)
- Solution: calibrate on test set where you know the correct number of hops

### Dimension 4: Semantic Cache Optimization

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Similarity threshold | 0.92 | 0.85-0.98 | Lower = more hits, risk wrong cache |
| TTL | 1 hour | 5min-24hr | Longer = more hits, stale risk |
| Max entries | 50K | 10K-500K | More = higher Redis cost |
| Embedding model | text-embedding-3-small | small/large | Small = faster lookup |

**Expected savings**: 40-60% cost reduction on repeated query patterns.

### Dimension 5: Cost Per Query Optimization

| Scenario | Hops | Sources | Cache | Cost |
|----------|------|---------|-------|------|
| Simple FAQ (cache hit) | 0 | 0 | ✅ | ~$0.00 |
| Simple FAQ (cache miss) | 1 | KB only | No | ~$0.01 |
| Standard query | 2 | KB + 1 more | No | ~$0.03 |
| Complex multi-source | 3 | KB + Web + DB | No | ~$0.05 |
| Max iteration | 5+ | All sources | No | ~$0.10+ |

**Monthly estimate** (10K queries/day):
- Without optimization: ~$15,000/mo (all queries 3 hops)
- With cache (40% hit): ~$9,000/mo (40% savings)
- With routing + cache: ~$6,000/mo (60% savings)

## Production Readiness Checklist
- [ ] Source routing accuracy ≥ 90%
- [ ] Average hops < 2.0 per query
- [ ] Self-evaluation calibrated (matches actual quality)
- [ ] Cache hit rate ≥ 40%
- [ ] Cost per query < $0.05 average
- [ ] Groundedness ≥ 0.90
- [ ] Citations accurate (≥ 95%)
- [ ] Max iteration limit enforced
- [ ] Response latency < 10s at p95

## Output: Tuning Report
After tuning, compare:
- Source routing accuracy improvement
- Average hops reduction
- Cache hit rate and cost savings
- Cost per query reduction
- Quality delta (groundedness/relevance)
