---
name: evaluate-cost-optimized-ai-gateway
description: "Evaluate AI Gateway — measure cache hit rate, cost savings vs direct, routing accuracy, budget enforcement, failover latency. Use when: evaluate, benchmark, FinOps review."
---

# Evaluate Cost-Optimized AI Gateway

## When to Use
- Measure semantic cache hit rate and cost savings
- Validate token budget enforcement accuracy
- Test multi-region failover and routing
- Benchmark gateway overhead vs direct API calls
- Gate deployments with FinOps thresholds

## FinOps Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Cache hit rate | ≥ 30% | Redis hit/miss ratio |
| Cost savings vs direct | ≥ 25% | Compare APIM cost to direct OpenAI cost |
| Gateway overhead (latency) | < 50ms added | Side-by-side timing |
| Budget enforcement accuracy | 100% | Test at budget boundary |
| Routing accuracy | 100% | Verify correct model per request type |
| Failover time | < 3 seconds | Disable primary, measure switchover |
| Rate limit accuracy | 100% | Test at rate boundary |
| Per-tenant cost tracking | ≤ 5% error | Compare tracked vs actual |

## Step 1: Measure Cache Hit Rate
```bash
python evaluation/eval.py --metrics cache_performance --duration 24h
```
- Send 1000 representative queries through gateway
- Track cache hits vs misses
- Group by similarity threshold (0.90, 0.95, 0.99)
- Calculate: cost with cache vs cost without cache

## Step 2: Evaluate Cost Savings
| Scenario | Direct OpenAI | Through Gateway | Savings |
|----------|-------------|----------------|---------|
| 10K requests/day, 30% cache | $50/day | $35/day | 30% |
| 10K requests/day, 50% cache | $50/day | $25/day | 50% |
| 10K requests/day, no cache | $50/day | $50 + APIM overhead | -5% |

**Break-even**: Gateway must save ≥ APIM cost ($0.003/API call) + Redis cost.

## Step 3: Test Budget Enforcement
```bash
# Send requests up to budget limit
python evaluation/test_budget.py --tier free --token-limit 100000
# Verify: requests succeed until 100K, then get 429
python evaluation/test_budget.py --tier standard --token-limit 1000000
```

## Step 4: Test Multi-Region Failover
```bash
# Disable primary region
az openai deployment delete --name gpt-4o --resource-group $PRIMARY_RG
# Verify: requests automatically route to secondary
python evaluation/test_failover.py --expect-region westus3
# Re-enable primary
```
Measure: failover time, error rate during switchover, auto-recovery.

## Step 5: Benchmark Gateway Overhead
```bash
python evaluation/benchmark.py --direct $OPENAI_ENDPOINT --gateway $APIM_URL --requests 100
```
- Compare p50/p95/p99 latency: direct vs gateway
- Gateway overhead should be < 50ms (cache lookup + policy evaluation)
- If overhead > 100ms: check Redis latency, APIM policy complexity

## Step 6: Generate FinOps Report
```bash
python evaluation/eval.py --full-report --output evaluation/finops-report.json
```

### FinOps Gate Decision
| Result | Action |
|--------|--------|
| Cache hit ≥30%, savings ≥25% | Deploy to production |
| Cache hit <15% | Tune similarity threshold, expand cache scope |
| Gateway overhead >100ms | Optimize Redis connection, simplify policies |
| Budget enforcement fails | Fix rate-limit-by-key policy |
| Failover >10s | Add health probes, reduce retry interval |

## Common Issues

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Low cache hits | Threshold too strict (0.99) | Lower to 0.95 |
| High cost despite caching | Cache TTL too short | Increase TTL for stable content |
| Budget exceeded | Race condition in counter | Use Redis atomic increment |
| Wrong region served | Weight misconfigured | Verify backend weights sum to 100 |
| APIM 500 errors | Backend timeout | Increase timeout, add circuit breaker |

## Evaluation Cadence
- **Pre-deployment**: Full benchmark + budget testing
- **Daily**: Cache hit rate, cost per tenant dashboard review
- **Weekly**: FinOps report generation, savings analysis
- **Monthly**: Re-evaluate cache TTL and similarity thresholds
- **On pricing change**: Re-calculate break-even with new Azure pricing
