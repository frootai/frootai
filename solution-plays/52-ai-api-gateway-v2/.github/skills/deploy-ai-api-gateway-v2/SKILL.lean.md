---
name: "deploy-ai-api-gateway-v2"
description: "Deploy AI API Gateway V2 — multi-provider routing (OpenAI/Anthropic/Google), semantic caching with Redis, circuit breakers, token metering, per-consumer rate limiting, APIM policies."
---

# Deploy AI API Gateway V2

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.ApiManagement` (API Management for gateway policies)
  - `Microsoft.Cache` (Redis for semantic caching)
  - `Microsoft.CognitiveServices` (Azure OpenAI — primary provider)
  - `Microsoft.App` (Container Apps for custom routing logic)
  - `Microsoft.KeyVault` (provider API keys)
- `.env` file with: `AZURE_OPENAI_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_KEY`, `REDIS_CONNECTION`

## Step 1: Provision Gateway Infrastructure

```bash
az group create --name rg-frootai-ai-gateway-v2 --location eastus2

az deployment group create \
  --resource-group rg-frootai-ai-gateway-v2 \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

# Store provider API keys in Key Vault
az keyvault secret set --vault-name kv-ai-gateway \
  --name azure-openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-ai-gateway \
  --name anthropic-key --value "$ANTHROPIC_API_KEY"
az keyvault secret set --vault-name kv-ai-gateway \
  --name google-ai-key --value "$GOOGLE_AI_KEY"
```

## Step 2: Deploy Azure API Management

```bash
# Create APIM instance with AI gateway policies
az apim create \
  --name apim-ai-gateway \
  --resource-group rg-frootai-ai-gateway-v2 \
  --publisher-email admin@contoso.com \
  --publisher-name "AI Platform Team" \
  --sku-name Developer \
  --location eastus2

# Import gateway API definition
az apim api import \
  --resource-group rg-frootai-ai-gateway-v2 \
  --service-name apim-ai-gateway \
  --path /ai \
  --specification-format OpenApi \
  --specification-path openapi/gateway-api.yaml
```

APIM policy capabilities:
- **Rate limiting**: Per-consumer key + per-provider quota
- **Token metering**: Count input/output tokens per request
- **Circuit breaker**: Open circuit on 3 consecutive failures
- **Failover**: Automatic provider rotation on error
- **Caching**: Semantic cache check before provider call

## Step 3: Deploy Semantic Cache (Redis)

```bash
# Create Redis for semantic caching
az redis create \
  --name redis-ai-gateway \
  --resource-group rg-frootai-ai-gateway-v2 \
  --sku Standard --vm-size c1 \
  --location eastus2 \
  --enable-non-ssl-port false

# Enable RediSearch module for vector similarity
az redis update \
  --name redis-ai-gateway \
  --resource-group rg-frootai-ai-gateway-v2 \
  --set "modules=[{name:'RediSearch'}]"
```

Semantic caching flow:
```python
async def cached_completion(request):
    # 1. Embed the query
    query_embedding = await embed(request.messages[-1].content)

    # 2. Search Redis for semantically similar cached responses
    cached = await redis.ft_search(
        index="cache",
        query=f"@embedding:[VECTOR_RANGE 0.05 $vec]",
        params={"vec": query_embedding},
    )

    # 3. If cache hit (similarity > 0.95), return cached response
    if cached.docs and cached.docs[0].score > 0.95:
        return CachedResponse(cached.docs[0].response, source="cache")

    # 4. Otherwise, call provider and cache the result
    response = await route_to_provider(request)
    await redis.hset(f"cache:{hash(request)}", mapping={
        "embedding": query_embedding,
        "response": response.json(),
        "ttl": config["cache_ttl"],
    })
    return response
```

## Step 4: Deploy Multi-Provider Router

```python
# router.py — priority-based routing with circuit breakers
class MultiProviderRouter:
    def __init__(self, config):
        self.providers = [
            {"name": "azure-openai", "endpoint": config["openai_endpoint"], "priority": 1, "cost_per_1k": 0.005},
            {"name": "anthropic", "endpoint": "https://api.anthropic.com", "priority": 2, "cost_per_1k": 0.008},
            {"name": "google", "endpoint": "https://generativelanguage.googleapis.com", "priority": 3, "cost_per_1k": 0.004},
        ]
        self.circuit_breakers = {p["name"]: CircuitBreaker(
            failure_threshold=config.get("cb_failures", 3),
            recovery_timeout=config.get("cb_recovery_seconds", 60),
        ) for p in self.providers}

    async def route(self, request):
        for provider in sorted(self.providers, key=lambda p: p["priority"]):
            cb = self.circuit_breakers[provider["name"]]
            if cb.is_open:
                continue  # Skip — circuit is open (provider unhealthy)
            try:
                response = await self.call_provider(provider, request)
                cb.record_success()
                return response
            except (RateLimitError, ServiceUnavailableError):
                cb.record_failure()
                continue
        raise AllProvidersDownError()
```

## Step 5: Deploy Complexity-Based Model Routing

```python
# complexity_router.py — smart model selection based on query complexity
class ComplexityRouter:
    async def select_model(self, request):
        query = request.messages[-1].content
        complexity = self.classify(query)

        if complexity == "simple":
            return "gpt-4o-mini"   # $0.15/M tokens — FAQ, classification
        elif complexity == "medium":
            return "gpt-4o"        # $2.50/M tokens — analysis, summarization
        else:
            return "gpt-4o"        # Full model for complex reasoning

    def classify(self, query):
        word_count = len(query.split())
        has_complex = any(w in query.lower() for w in ["analyze", "compare", "evaluate", "design"])
        if word_count < 20 and not has_complex: return "simple"
        if word_count > 100 or has_complex: return "complex"
        return "medium"
```

## Step 6: Deploy Token Metering

```python
# metering.py — per-consumer token tracking
class TokenMeter:
    async def meter(self, consumer_key, request, response):
        usage = {
            "consumer": consumer_key,
            "timestamp": datetime.utcnow().isoformat(),
            "model": response.model,
            "provider": response.provider,
            "input_tokens": response.usage.prompt_tokens,
            "output_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
            "cost": self.calculate_cost(response),
            "latency_ms": response.latency_ms,
            "cached": response.from_cache,
        }
        await self.store_usage(usage)
```

## Step 7: Verify Deployment

```bash
# Health check
curl https://apim-ai-gateway.azure-api.net/ai/health

# Test routing
curl -X POST https://apim-ai-gateway.azure-api.net/ai/chat/completions \
  -H "Ocp-Apim-Subscription-Key: $APIM_KEY" \
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello"}]}'

# Test cache hit
curl -X POST ... -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello"}]}'
# Second call should return from cache (check X-Cache header)

# Test failover (simulate primary failure)
curl -X POST https://apim-ai-gateway.azure-api.net/ai/test/failover
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| APIM healthy | `curl /health` | 200 + all providers status |
| Primary routing | Normal request | Routed to azure-openai |
| Failover | Simulate primary failure | Routes to anthropic |
| Semantic cache | Identical query twice | Second returns from cache |
| Circuit breaker | 3 failures | Provider marked unhealthy |
| Rate limiting | Exceed limit | 429 with Retry-After |
| Token metering | Check usage endpoint | Token counts per consumer |
| Complexity routing | Simple vs complex query | mini vs 4o model selected |
| Key Vault | Provider keys | Resolved via managed identity |

## Rollback Procedure

```bash
# Revert APIM policy to previous version
az apim api release create \
  --resource-group rg-frootai-ai-gateway-v2 \
  --service-name apim-ai-gateway \
  --api-id ai-gateway --notes "rollback"

# Reset circuit breakers
curl -X POST https://apim-ai-gateway.azure-api.net/ai/admin/reset-circuits
```
