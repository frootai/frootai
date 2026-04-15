---
name: fai-tune-14-cost-optimized-ai-gateway
description: "Tune Play 14 (Cost-Optimized AI Gateway) model routing rules, token budgets, caching policies, and APIM rate limiting."
---

# FAI Tune — Play 14: Cost-Optimized AI Gateway

## TuneKit Configuration Files

```
solution-plays/14-cost-optimized-ai-gateway/config/
├── routing.json          # Model routing rules and priorities
├── budgets.json          # Token and cost budget configuration
├── caching.json          # Semantic and response caching
├── rate-limiting.json    # APIM rate limiting policies
└── guardrails.json       # Cost and quality thresholds
```

## Step 1 — Configure Model Routing

```json
// config/routing.json
{
  "routing_strategy": "complexity_based",
  "models": [
    {
      "name": "gpt-4o-mini",
      "priority": 1,
      "cost_per_1k_input": 0.00015,
      "cost_per_1k_output": 0.0006,
      "max_tokens": 128000,
      "route_when": ["simple_qa", "classification", "summarization"],
      "complexity_threshold": 0.5
    },
    {
      "name": "gpt-4o",
      "priority": 2,
      "cost_per_1k_input": 0.0025,
      "cost_per_1k_output": 0.01,
      "max_tokens": 128000,
      "route_when": ["reasoning", "code_generation", "analysis"],
      "complexity_threshold": 0.8
    },
    {
      "name": "gpt-4o-realtime",
      "priority": 3,
      "cost_per_1k_input": 0.005,
      "cost_per_1k_output": 0.02,
      "route_when": ["voice", "realtime"],
      "enabled": false
    }
  ],
  "fallback_model": "gpt-4o-mini",
  "complexity_classifier": "gpt-4o-mini",
  "classifier_max_tokens": 50
}
```

**Routing strategies:**

| Strategy | Description | Best For |
|----------|-------------|----------|
| `complexity_based` | Classify query complexity then route | Mixed workloads |
| `round_robin` | Alternate between models | Load distribution |
| `cost_first` | Always try cheapest model first | Budget-constrained |
| `quality_first` | Always use best model | Quality-critical |
| `latency_first` | Route to fastest available | Real-time apps |

## Step 2 — Set Token and Cost Budgets

```json
// config/budgets.json
{
  "budgets": {
    "per_request": {
      "max_input_tokens": 4096,
      "max_output_tokens": 2048,
      "max_total_tokens": 6144
    },
    "per_user_per_day": {
      "max_tokens": 100000,
      "max_cost_usd": 5.00,
      "max_requests": 500
    },
    "per_team_per_month": {
      "max_tokens": 10000000,
      "max_cost_usd": 1000.00,
      "alert_at_percent": [50, 75, 90]
    },
    "global_per_day": {
      "max_cost_usd": 500.00,
      "emergency_shutdown_usd": 1000.00
    }
  },
  "budget_exceeded_action": "reject_with_message",
  "budget_exceeded_message": "Daily token budget exceeded. Please try again tomorrow or contact your admin."
}
```

## Step 3 — Configure Semantic Caching

```json
// config/caching.json
{
  "semantic_cache": {
    "enabled": true,
    "similarity_threshold": 0.95,
    "embedding_model": "text-embedding-3-small",
    "cache_backend": "redis",
    "cache_ttl_hours": 24,
    "max_cache_size_mb": 500
  },
  "exact_cache": {
    "enabled": true,
    "cache_ttl_hours": 1,
    "max_entries": 10000
  },
  "cache_exclusions": [
    { "pattern": "temperature > 0.5" },
    { "pattern": "contains_pii" }
  ]
}
```

## Step 4 — Set APIM Rate Limiting

```json
// config/rate-limiting.json
{
  "global": {
    "requests_per_minute": 1000,
    "tokens_per_minute": 500000
  },
  "per_subscription": {
    "free_tier": { "rpm": 10, "tpm": 10000 },
    "standard": { "rpm": 100, "tpm": 100000 },
    "premium": { "rpm": 500, "tpm": 500000 }
  },
  "retry_after_header": true,
  "rate_limit_by": "subscription_key",
  "burst_allowance_percent": 20
}
```

## Guardrails

```json
// config/guardrails.json
{
  "cost": {
    "daily_budget_usd": 500,
    "monthly_budget_usd": 10000,
    "model_cost_ratio_mini_vs_4o": 0.7,
    "cache_hit_rate_min": 0.30
  },
  "quality": {
    "min_routing_accuracy": 0.90,
    "max_fallback_rate": 0.10,
    "user_satisfaction_min": 4.0
  },
  "performance": {
    "max_gateway_latency_ms": 100,
    "max_cache_lookup_ms": 50,
    "max_routing_decision_ms": 200
  }
}
```

## Validation Checklist

| Check | Expected | Command |
|-------|----------|---------|
| Routing strategy | complexity_based | `jq '.routing_strategy' config/routing.json` |
| Semantic cache | enabled | `jq '.semantic_cache.enabled' config/caching.json` |
| Daily budget | <=500 USD | `jq '.cost.daily_budget_usd' config/guardrails.json` |
| Cache hit rate | >=30% | Monitor via Application Insights |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Costs higher than expected | Routing sending too much to gpt-4o | Lower `complexity_threshold` to route more to mini |
| Low cache hit rate | Similarity threshold too high | Lower `similarity_threshold` to 0.92 |
| Rate limit errors for users | Per-subscription limits too low | Increase RPM/TPM for the tier |
| Quality complaints | Too aggressive cost routing | Switch from `cost_first` to `complexity_based` |
