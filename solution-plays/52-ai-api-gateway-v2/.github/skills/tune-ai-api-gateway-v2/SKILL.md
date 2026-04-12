---
name: "tune-ai-api-gateway-v2"
description: "Tune AI API Gateway V2 — provider routing priority, semantic cache TTL, circuit breaker thresholds, complexity routing rules, rate limit quotas, cost optimization."
---

# Tune AI API Gateway V2

## Prerequisites

- Deployed gateway with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/model-comparison.json`
- Evaluation baseline from `evaluate-ai-api-gateway-v2` skill

## Step 1: Tune Provider Routing

### Provider Configuration
```json
// config/openai.json
{
  "providers": [
    {
      "name": "azure-openai",
      "endpoint": "${AZURE_OPENAI_ENDPOINT}",
      "priority": 1,
      "models": {
        "gpt-4o": { "cost_per_1k_input": 2.50, "cost_per_1k_output": 10.00, "max_tokens": 128000 },
        "gpt-4o-mini": { "cost_per_1k_input": 0.15, "cost_per_1k_output": 0.60, "max_tokens": 128000 }
      },
      "rate_limit_rpm": 500
    },
    {
      "name": "anthropic",
      "endpoint": "https://api.anthropic.com/v1",
      "priority": 2,
      "models": {
        "claude-sonnet": { "cost_per_1k_input": 3.00, "cost_per_1k_output": 15.00 }
      },
      "rate_limit_rpm": 200
    },
    {
      "name": "google",
      "endpoint": "https://generativelanguage.googleapis.com/v1beta",
      "priority": 3,
      "models": {
        "gemini-pro": { "cost_per_1k_input": 1.25, "cost_per_1k_output": 5.00 }
      },
      "rate_limit_rpm": 300
    }
  ],
  "default_model": "gpt-4o",
  "complexity_routing": {
    "enabled": true,
    "simple_model": "gpt-4o-mini",
    "complex_model": "gpt-4o",
    "word_threshold": 20,
    "complex_keywords": ["analyze", "compare", "evaluate", "design", "synthesize"]
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| Provider priority | 1/2/3 | Lower = tried first |
| `simple_model` | gpt-4o-mini | Cheap model for simple queries |
| `word_threshold` | 20 | Queries shorter than this → simple model |
| `complex_keywords` | 5 words | Presence triggers complex model |
| `rate_limit_rpm` | 500/200/300 | Per-provider rate cap |

## Step 2: Tune Semantic Cache

```json
// config/guardrails.json
{
  "cache": {
    "enabled": true,
    "similarity_threshold": 0.95,
    "ttl_seconds": 3600,
    "max_cache_size_mb": 500,
    "cache_by_model": true,
    "exclude_patterns": ["current time", "today's date", "latest news"],
    "embedding_model": "text-embedding-3-small"
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `similarity_threshold` | 0.95 | Lower = more hits but risk wrong responses |
| `ttl_seconds` | 3600 (1hr) | Higher = more hits, staler data |
| `max_cache_size_mb` | 500 | More = higher memory, better hit rate |
| `cache_by_model` | true | false = share cache across models |
| `exclude_patterns` | 3 patterns | Time-sensitive queries bypass cache |

### Cache TTL Tuning Guide
| Content Type | Recommended TTL | Why |
|-------------|----------------|-----|
| Static knowledge | 24h | Doesn't change frequently |
| Code generation | 1h | Context-dependent |
| Analysis | 4h | Moderate freshness need |
| Real-time data | DISABLED | Must be current |
| Translations | 7d | Very stable content |

## Step 3: Tune Circuit Breakers

```json
// config/guardrails.json
{
  "circuit_breaker": {
    "failure_threshold": 3,
    "recovery_timeout_seconds": 60,
    "half_open_max_requests": 2,
    "success_threshold_to_close": 2,
    "monitored_errors": ["429", "500", "502", "503", "timeout"]
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `failure_threshold` | 3 | Lower = faster failover but more sensitive |
| `recovery_timeout_seconds` | 60 | Lower = try recovery sooner |
| `half_open_max_requests` | 2 | More = more thorough recovery check |
| `monitored_errors` | 5 types | Add/remove error codes to monitor |

## Step 4: Tune Rate Limiting

```json
// config/guardrails.json
{
  "rate_limiting": {
    "per_consumer": {
      "requests_per_minute": 60,
      "tokens_per_minute": 100000,
      "tokens_per_day": 2000000
    },
    "global": {
      "requests_per_minute": 500,
      "tokens_per_minute": 1000000
    },
    "burst": {
      "enabled": true,
      "burst_limit": 10,
      "burst_window_seconds": 10
    }
  }
}
```

Rate limit tiers:
| Tier | RPM | TPM | TPD | Use Case |
|------|-----|-----|-----|----------|
| Free | 10 | 10K | 100K | Trial users |
| Dev | 60 | 100K | 2M | Development |
| Pro | 200 | 500K | 10M | Production |
| Enterprise | 1000 | 2M | Unlimited | Enterprise agreement |

## Step 5: Cost Optimization

```python
# AI API Gateway cost optimization:
# 
# 1. Complexity routing (saves 40-60%)
#    Simple queries → gpt-4o-mini ($0.15/M) vs gpt-4o ($2.50/M)
#    If 60% of queries are simple: 60% × 94% savings = 56% total savings
#
# 2. Semantic caching (saves 25-40%)
#    30% cache hit rate × 100% cost avoidance = 30% savings
#
# 3. Provider cost arbitrage
#    Route non-critical to cheapest provider (Google Gemini $1.25/M)
#
# Combined savings:
# Baseline: $10/1K requests (all gpt-4o)
# + Complexity routing: $4.40 (56% saved)
# + Semantic caching: $3.08 (30% of remaining saved)
# + Provider arbitrage: $2.77 (10% of remaining saved)
# Total: $2.77/1K requests = 72% savings
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| Complexity routing | ~56% | Simple queries lower quality |
| Semantic caching | ~30% | Stale responses possible |
| Provider arbitrage | ~10% | Different model capabilities |
| **Combined** | **~72%** | Requires careful tuning |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_routing.py --gateway-endpoint $GATEWAY_ENDPOINT
python evaluation/eval_cache.py --gateway-endpoint $GATEWAY_ENDPOINT
k6 run evaluation/load-test.js --vus 50 --duration 60s
python evaluation/eval_cost.py --usage-data evaluation/data/usage.json

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Cache hit rate | 0% | 30%+ | > 30% |
| Cost per 1K requests | $10.00 | $2.77 | < $5.00 |
| Failover success | baseline | > 99% | > 99% |
| P95 latency (cached) | N/A | < 500ms | < 500ms |
| Error rate | baseline | < 0.5% | < 1% |
