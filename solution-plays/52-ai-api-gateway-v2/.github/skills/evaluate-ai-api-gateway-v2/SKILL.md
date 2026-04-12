---
name: "evaluate-ai-api-gateway-v2"
description: "Evaluate AI API Gateway V2 — cache hit rate, failover reliability, cost savings, latency distribution, rate limiting accuracy, provider health."
---

# Evaluate AI API Gateway V2

## Prerequisites

- Deployed gateway (run `deploy-ai-api-gateway-v2` skill first)
- Test traffic generator (k6 or locust)
- Access to APIM analytics + Redis metrics

## Step 1: Evaluate Routing Reliability

```bash
python evaluation/eval_routing.py \
  --gateway-endpoint $GATEWAY_ENDPOINT \
  --output evaluation/results/routing.json
```

Routing metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Failover Success** | Successful provider switch on failure | > 99% |
| **Circuit Breaker Accuracy** | Opens on unhealthy, closes on recovery | > 95% |
| **Recovery Time** | Time from circuit open to re-test | < 60s |
| **Provider Distribution** | Traffic % per provider (normal state) | Primary > 90% |
| **All-Providers-Down Handling** | Graceful error when all fail | 100% |

## Step 2: Evaluate Semantic Cache

```bash
python evaluation/eval_cache.py \
  --gateway-endpoint $GATEWAY_ENDPOINT \
  --output evaluation/results/cache.json
```

Cache metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Cache Hit Rate** | % of requests served from cache | > 30% |
| **Semantic Match Accuracy** | Correct cache hits (not stale/wrong) | > 95% |
| **Cache Latency** | Time for cache lookup | < 10ms |
| **Cost Savings from Cache** | Avoided API costs | > 25% |
| **False Hit Rate** | Wrong cached response served | < 1% |
| **Cache TTL Compliance** | Expired entries not served | 100% |

Cache evaluation scenarios:
| Scenario | Expected |
|----------|----------|
| Exact same query | Cache hit |
| Paraphrased query (0.95+ similarity) | Cache hit |
| Different topic query | Cache miss |
| Expired cache entry | Cache miss, re-fetch |
| Cache with different model | Cache miss (model-specific) |

## Step 3: Evaluate Performance

```bash
k6 run evaluation/load-test.js --vus 50 --duration 60s
```

Performance metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **P50 Latency** | Median response time | < 200ms (cached) / < 2s (live) |
| **P95 Latency** | 95th percentile | < 500ms (cached) / < 5s (live) |
| **P99 Latency** | Tail latency | < 1s (cached) / < 8s (live) |
| **Throughput** | Requests per second | > 100 RPS |
| **Error Rate** | 4xx + 5xx responses | < 1% |

## Step 4: Evaluate Cost Efficiency

```bash
python evaluation/eval_cost.py \
  --usage-data evaluation/data/usage.json \
  --output evaluation/results/cost.json
```

Cost metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Blended Cost per 1K Tokens** | Weighted average across providers | < $0.008 |
| **Complexity Routing Savings** | Cost reduction from mini routing | > 40% |
| **Cache Savings** | Cost avoided by cache hits | > 25% |
| **Total Cost Reduction** | vs single-provider no-cache | > 50% |
| **Cost Attribution** | Per-consumer cost tracking accuracy | 100% |

Cost comparison:
| Scenario | Cost per 1K Requests | Savings |
|----------|---------------------|--------|
| Single provider (gpt-4o) | $5.00 | Baseline |
| Multi-provider (failover) | $4.80 | 4% |
| + Complexity routing (mini) | $2.50 | 50% |
| + Semantic caching (30% hit) | $1.75 | **65%** |

## Step 5: Evaluate Rate Limiting

```bash
python evaluation/eval_rate_limits.py \
  --gateway-endpoint $GATEWAY_ENDPOINT \
  --output evaluation/results/rate_limits.json
```

Rate limiting metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Limit Enforcement** | 429 returned when quota exceeded | 100% |
| **Retry-After Accuracy** | Correct retry delay in header | > 95% |
| **Per-Consumer Isolation** | One consumer's limit doesn't affect others | 100% |
| **Global Quota** | Protects total provider capacity | Verified |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Failover success | > 99% | config/guardrails.json |
| Cache hit rate | > 30% | config/guardrails.json |
| P95 latency (cached) | < 500ms | config/guardrails.json |
| Cost reduction | > 50% | config/guardrails.json |
| Error rate | < 1% | config/guardrails.json |
