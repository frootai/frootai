# Play 52 — AI API Gateway V2

Intelligent AI API gateway — multi-provider routing (Azure OpenAI, Anthropic, Google) with priority-based failover, semantic caching via Redis (embedding similarity), circuit breakers, complexity-based model routing (simple→mini, complex→4o), per-consumer token metering, rate limiting tiers, and cost attribution dashboards.

## Architecture

| Component | Azure Service | Purpose |
|-----------|--------------|---------|
| Gateway | Azure API Management | Policy enforcement, rate limiting, routing |
| Semantic Cache | Azure Redis (RediSearch) | Embedding-based response caching |
| Primary Provider | Azure OpenAI | GPT-4o + GPT-4o-mini |
| Fallback Providers | Anthropic, Google | Claude Sonnet, Gemini Pro |
| Routing Logic | Azure Container Apps | Complexity classification, failover |
| Metering | Cosmos DB / App Insights | Per-consumer token + cost tracking |
| Secrets | Azure Key Vault | Provider API keys |

## How It Differs from Related Plays

| Aspect | Play 14 (Cost-Optimized Gateway) | **Play 52 (AI Gateway V2)** |
|--------|----------------------------------|----------------------------|
| Providers | Azure OpenAI only | **Multi-provider (OpenAI + Anthropic + Google)** |
| Caching | Exact-match | **Semantic caching (embedding similarity)** |
| Routing | Cost-based model selection | **Complexity-based + priority failover** |
| Resilience | Basic retry | **Circuit breakers with half-open recovery** |
| Metering | Basic token counting | **Per-consumer with cost attribution** |
| Rate Limiting | Simple RPM | **Tiered (Free/Dev/Pro/Enterprise) + burst** |

## DevKit Structure

```
52-ai-api-gateway-v2/
├── agent.md                              # Root orchestrator with handoffs
├── .github/
│   ├── copilot-instructions.md           # Domain knowledge (<150 lines)
│   ├── agents/
│   │   ├── builder.agent.md              # Gateway + routing + caching
│   │   ├── reviewer.agent.md             # Failover + security + rate limits
│   │   └── tuner.agent.md                # Cache TTL + routing + cost
│   ├── prompts/
│   │   ├── deploy.prompt.md              # Deploy gateway + providers
│   │   ├── test.prompt.md                # Test failover + cache
│   │   ├── review.prompt.md              # Audit security + circuits
│   │   └── evaluate.prompt.md            # Measure cost savings
│   ├── skills/
│   │   ├── deploy-ai-api-gateway-v2/     # APIM + Redis + multi-provider
│   │   ├── evaluate-ai-api-gateway-v2/   # Cache hit, failover, cost, latency
│   │   └── tune-ai-api-gateway-v2/       # Provider priority, cache, circuits
│   └── instructions/
│       └── ai-api-gateway-v2-patterns.instructions.md
├── config/                               # TuneKit
│   ├── openai.json                       # Provider endpoints, model costs
│   ├── guardrails.json                   # Cache, circuit breaker, rate limits
│   └── model-comparison.json             # Cost/quality/latency per provider
├── infra/                                # Bicep IaC
│   ├── main.bicep
│   └── parameters.json
└── spec/                                 # SpecKit
    └── fai-manifest.json
```

## Quick Start

```bash
# 1. Deploy gateway with providers
/deploy

# 2. Test failover and caching
/test

# 3. Audit security and circuit breakers
/review

# 4. Measure cost savings and cache hit rate
/evaluate
```

## Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Failover Success | > 99% | Automatic provider switch on failure |
| Cache Hit Rate | > 30% | Semantic cache responses served |
| Cost Reduction | > 50% | vs single-provider no-cache baseline |
| P95 Latency (cached) | < 500ms | Cached response delivery |
| Error Rate | < 1% | 4xx + 5xx responses |
| Rate Limit Accuracy | 100% | Quota enforcement per consumer |

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| **Reliability** | Multi-provider failover, circuit breakers, half-open recovery |
| **Security** | Provider keys in Key Vault, per-consumer API keys, APIM policies |
| **Cost Optimization** | Complexity routing (mini for simple), semantic caching, provider arbitrage |
| **Performance Efficiency** | <10ms cache lookup, parallel provider health checks |
| **Operational Excellence** | Per-consumer metering, cost dashboards, usage analytics |
| **Responsible AI** | Rate limiting prevents abuse, content safety at gateway level |
