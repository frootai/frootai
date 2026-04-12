---
name: tune-cost-optimized-ai-gateway
description: "Tune AI Gateway — optimize cache TTL and similarity threshold, PTU vs pay-as-you-go, routing weights, budget tiers, cost per 1K tokens. Use when: tune, optimize, FinOps."
---

# Tune Cost-Optimized AI Gateway

## When to Use
- Optimize semantic cache parameters for maximum savings
- Decide PTU (Provisioned Throughput Units) vs pay-as-you-go
- Tune multi-region routing weights based on traffic patterns
- Configure budget tiers and rate limits per tenant
- Minimize cost per 1K tokens through the gateway

## Tuning Dimensions

### Dimension 1: Semantic Cache Optimization

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Similarity threshold | 0.95 | 0.85-0.99 | Lower = more hits, risk of wrong cached answer |
| Cache TTL | 1 hour | 5min-24hr | Longer = more hits, risk of stale data |
| Max cache entries | 100K | 10K-1M | More = more VRAM, higher hit rate |
| Embedding model | text-embedding-3-small | small/large | Small = cheaper + faster cache lookup |
| Cache scope | Per-tenant | Global/Per-tenant | Global = higher hit rate, shared privacy risk |

**Tuning methodology**:
1. Start with threshold=0.95, TTL=1h
2. Monitor cache hit rate for 7 days
3. If hits <20%: lower threshold to 0.92, increase TTL
4. If stale responses reported: reduce TTL, raise threshold
5. Target: 30-50% hit rate = 30-50% cost savings

### Dimension 2: PTU vs Pay-As-You-Go Decision

| Factor | PTU | Pay-As-You-Go |
|--------|-----|---------------|
| Pricing | Fixed monthly | Per-token |
| Best for | Predictable, high-volume | Variable, bursty |
| Latency | Guaranteed | Best-effort |
| Commitment | 1-month minimum | None |
| Break-even | ~30K TPM sustained | Below 30K TPM |

**Decision matrix**:
| Monthly Volume | Recommendation | Why |
|---------------|---------------|-----|
| <1M tokens/day | Pay-as-you-go | PTU overhead not justified |
| 1M-10M tokens/day | PTU for base + PAYG for burst | Hybrid = cost + flexibility |
| >10M tokens/day | PTU (committed) | Significant savings + guaranteed throughput |

### Dimension 3: Routing Weight Optimization

| Strategy | Configuration | When to Use |
|----------|--------------|-------------|
| Weighted round-robin | 60/40 primary/secondary | General traffic distribution |
| Latency-based | Route to fastest region | Latency-sensitive applications |
| Cost-based | Route to cheapest region | Pure FinOps optimization |
| Capacity-based | Route to lowest utilization | Prevent throttling |
| Compliance-based | Route by data residency | GDPR/HIPAA requirements |

**Dynamic weight tuning**:
- Monitor TPM utilization per region
- If region A >80% TPM: shift 20% weight to region B
- If region B has lower pricing tier: shift non-latency-critical traffic there

### Dimension 4: Budget Tier Configuration

| Tier | Budget | Rate | Model | % of Users |
|------|--------|------|-------|-----------|
| Free | 100K tok/mo | 10/min | mini only | 60% |
| Standard | 1M tok/mo | 60/min | mini + 4o | 30% |
| Premium | 10M tok/mo | 300/min | All | 8% |
| Enterprise | Unlimited | 1000/min | All + priority | 2% |

**Cost allocation**: Track per-tenant usage in Redis sorted sets for O(1) budget checks.

### Dimension 5: End-to-End Cost Optimization

**Monthly cost breakdown** (100K requests/day, avg 500 tokens/request):

| Component | Without Gateway | With Gateway (30% cache) | Savings |
|-----------|----------------|--------------------------|---------|
| Azure OpenAI (gpt-4o) | $7,500 | $5,250 | $2,250 |
| APIM (Standard v2) | — | $300 | — |
| Redis (Premium P1) | — | $400 | — |
| Embedding (cache key) | — | $20 | — |
| **Total** | **$7,500** | **$5,970** | **$1,530 (20%)** |

**With 50% cache hit**: Total drops to $4,470 — **$3,030 savings (40%)**.

**Optimization levers**:
1. Increase cache hit rate (threshold + TTL tuning)
2. Route simple queries to gpt-4o-mini (80% cheaper)
3. Use PTU for base load (30% cheaper than PAYG)
4. Enforce budgets to prevent runaway costs
5. Compress prompts before caching (reduces Redis memory)

## Production Readiness Checklist
- [ ] Cache hit rate ≥ 30% observed over 7 days
- [ ] Cost savings ≥ 20% vs direct API calls
- [ ] Gateway overhead < 50ms p95
- [ ] PTU vs PAYG decision documented with break-even analysis
- [ ] Budget tiers enforce correctly at boundaries
- [ ] Multi-region failover tested (< 3s switchover)
- [ ] Per-tenant cost tracking accurate (< 5% error)
- [ ] Rate limiting active and tested
- [ ] FinOps dashboard showing real-time cost allocation
- [ ] Budget alerts at 80%/90%/100% thresholds

## Output: Tuning Report
After tuning, compare:
- Cache hit rate improvement
- Cost per 1K tokens reduction (before vs after)
- Gateway overhead change
- PTU recommendation with break-even analysis
- Budget tier adjustment recommendations
