---
description: "AI API Gateway V2 domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# AI API Gateway V2 — Domain Knowledge

This workspace implements an advanced AI API gateway — multi-provider routing (OpenAI, Anthropic, Google), semantic caching, token metering, circuit breakers, and usage analytics across multiple LLM backends.

## Gateway V2 Architecture (What the Model Gets Wrong)

### Multi-Provider Routing with Fallback
```python
PROVIDERS = {
    "primary": {"endpoint": "azure-openai", "model": "gpt-4o", "priority": 1},
    "fallback1": {"endpoint": "anthropic", "model": "claude-sonnet", "priority": 2},
    "fallback2": {"endpoint": "google", "model": "gemini-pro", "priority": 3},
}

async def route_with_fallback(request: ChatRequest) -> Response:
    for provider in sorted(PROVIDERS.values(), key=lambda p: p["priority"]):
        try:
            if circuit_breaker.is_open(provider["endpoint"]):
                continue  # Skip unhealthy provider
            response = await call_provider(provider, request)
            circuit_breaker.record_success(provider["endpoint"])
            return response
        except (RateLimitError, ServiceUnavailableError) as e:
            circuit_breaker.record_failure(provider["endpoint"])
            continue
    raise AllProvidersDownError("All LLM providers exhausted")
```

### Semantic Caching (Not Just Exact Match)
```python
# WRONG — exact string match (misses paraphrased queries)
cache_key = hash(query)

# CORRECT — semantic similarity caching
query_embedding = embed(query)
cached = vector_store.search(query_embedding, threshold=0.95)
if cached and cached.score > 0.95:
    return cached.response  # Semantic cache hit — $0 cost
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Single provider, no fallback | Provider outage = total outage | Multi-provider with priority + circuit breaker |
| Exact-match cache only | Misses "What is RAG?" vs "Explain RAG" | Semantic cache with embedding similarity |
| No circuit breaker | Keep hitting dead provider | Open circuit after 3 failures, retry after 60s |
| No per-user metering | Can't track or bill usage | Token counters per API key / user / department |
| No request/response logging | Can't debug issues | Log: model, tokens, latency, status (not content) |
| Same model for all requests | Overspend on simple queries | Route by complexity: simple→mini, complex→4o |
| No rate limiting per consumer | One consumer exhausts quota | Per-key rate limits + global quota management |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Provider endpoints, model mapping, fallback order |
| `config/guardrails.json` | Rate limits, circuit breaker thresholds, cache TTL |
| `config/model-comparison.json` | Cost/latency/quality per provider per model |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement gateway, routing, caching, circuit breaker |
| `@reviewer` | Audit failover logic, rate limiting, security |
| `@tuner` | Optimize routing rules, cache hit rate, cost per query |

## Slash Commands
`/deploy` — Deploy gateway | `/test` — Test failover | `/review` — Audit routing | `/evaluate` — Measure cost savings
