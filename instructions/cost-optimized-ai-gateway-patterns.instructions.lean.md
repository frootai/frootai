---
description: "Play 14 patterns — AI gateway patterns — APIM policies, semantic cache, token metering, multi-backend retry, budget enforcement."
applyTo: "**/*.xml, **/*.bicep"
waf:
  - "reliability"
  - "security"
---

# Play 14 — Cost-Optimized AI Gateway Patterns — FAI Standards

## APIM as AI Gateway

Azure API Management fronts all LLM traffic. Enforce rate limiting, quotas, and subscription keys per consumer team. Use APIM policies for header injection, response caching, and backend circuit breaking — never expose OpenAI endpoints directly.

```xml
<!-- APIM inbound policy: rate limit + quota per subscription -->
<inbound>
  <rate-limit-by-key calls="60" renewal-period="60"
    counter-key="@(context.Subscription.Id)" />
  <quota-by-key calls="10000" bandwidth="50000" renewal-period="86400"
    counter-key="@(context.Subscription.Id)" />
  <set-header name="api-key" exists-action="override">
    <value>{{aoai-key}}</value>
  </set-header>
</inbound>
```

## Model Routing by Complexity

Classify prompt complexity before dispatching. Route simple queries (FAQ, classification, extraction) to `gpt-4o-mini` (~$0.15/1M input tokens). Escalate multi-step reasoning, code generation, and long-context to `gpt-4o`. A lightweight classifier avoids spending premium tokens on trivial requests.

```python
from openai import AzureOpenAI

COMPLEXITY_THRESHOLD = 0.6

async def route_request(prompt: str, client: AzureOpenAI) -> str:
    score = await classify_complexity(prompt, client)  # 0.0-1.0
    deployment = "gpt-4o" if score > COMPLEXITY_THRESHOLD else "gpt-4o-mini"
    response = await client.chat.completions.create(
        model=deployment,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=config["max_tokens"],
        stream=True,
    )
    return response

async def classify_complexity(prompt: str, client: AzureOpenAI) -> float:
    """Classify with gpt-4o-mini — costs <0.01c per classification."""
    result = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": "Rate complexity 0.0-1.0. Return only the number."},
                  {"role": "user", "content": prompt}],
        max_tokens=5, temperature=0,
    )
    return float(result.choices[0].message.content.strip())
```

## Semantic Caching with Redis

Hash prompt embeddings to find semantically equivalent past queries. Cosine similarity > 0.98 = cache hit. Saves full round-trip LLM cost on repeated or near-duplicate questions. TTL from config — stale cache is worse than no cache.

```python
import hashlib, numpy as np, redis.asyncio as redis

cache = redis.Redis(host=config["redis_host"], ssl=True)

async def get_or_generate(prompt: str, embedding: list[float]) -> str:
    cache_key = f"sem:{hashlib.sha256(prompt.encode()).hexdigest()[:16]}"
    cached = await cache.get(cache_key)
    if cached:
        return cached.decode()
    # Check semantic neighbors via vector similarity index
    neighbors = await vector_search(embedding, top_k=1, threshold=0.98)
    if neighbors:
        return neighbors[0].response
    response = await call_llm(prompt)
    await cache.setex(cache_key, config["cache_ttl_seconds"], response)
    await store_embedding(embedding, response)
    return response
```

## Token Metering Middleware

Track prompt/completion tokens per tenant and endpoint. Emit to Application Insights as custom metrics. Without metering you cannot attribute cost, detect abuse, or enforce budgets.

```python
from opentelemetry import metrics

meter = metrics.get_meter("ai-gateway")
token_counter = meter.create_counter("ai.tokens.total", description="LLM tokens consumed")

async def metered_completion(tenant_id: str, endpoint: str, **kwargs):
    response = await client.chat.completions.create(**kwargs)
    usage = response.usage
    token_counter.add(usage.prompt_tokens, {"tenant": tenant_id, "endpoint": endpoint, "type": "prompt"})
    token_counter.add(usage.completion_tokens, {"tenant": tenant_id, "endpoint": endpoint, "type": "completion"})
    return response
```

## PTU vs PAYG Routing

Route to Provisioned Throughput Units first — they're pre-paid, so unused capacity is wasted money. Overflow to Pay-As-You-Go when PTU returns 429. APIM backend pool with priority routing handles this transparently.

```bicep
// APIM backend pool — PTU primary, PAYG fallback
resource backendPool 'Microsoft.ApiManagement/service/backends@2023-09-01-preview' = {
  name: 'aoai-pool'
  properties: {
    type: 'Pool'
    pool: {
      services: [
        { id: ptuBackend.id, priority: 1, weight: 10 }   // PTU — always try first
        { id: paygBackend.id, priority: 2, weight: 5 }    // PAYG — overflow only
      ]
    }
  }
}
```

## Prompt Compression

Strip redundant whitespace, remove filler instructions already baked into system prompts, and truncate context windows to relevant chunks only. A 30% token reduction at 100K requests/day saves thousands monthly.

```python
import re

def compress_prompt(text: str, max_context_tokens: int = 3000) -> str:
    text = re.sub(r'\n{3,}', '\n\n', text)        # collapse blank lines
    text = re.sub(r'[ \t]{2,}', ' ', text)          # collapse whitespace
    text = re.sub(r'(?i)\b(please|kindly)\b ', '', text)  # strip filler
    tokens = tokenizer.encode(text)
    if len(tokens) > max_context_tokens:
        tokens = tokens[:max_context_tokens]
    return tokenizer.decode(tokens)
```

## Response Streaming

Stream SSE chunks to the client as they arrive from the LLM. Perceived latency drops from 5-15s (full response) to <500ms (first token). APIM must forward chunked transfer-encoding without buffering.

## Retry with Fallback Endpoints

Primary → secondary region → PAYG fallback. Respect `Retry-After` headers from 429s. Jittered exponential backoff: `delay = min(base * 2^attempt + random(0, base), max_delay)`. Three attempts max before returning a graceful degradation response.

## Cost Allocation Dashboards

Emit `tenant_id`, `team`, `endpoint`, `model`, and `token_count` dimensions on every request. Build Azure Monitor workbooks grouping cost by team and endpoint. Alert at 80% budget threshold — auto-throttle at 95%.

```python
# Budget enforcement — check before every LLM call
async def enforce_budget(tenant_id: str, estimated_tokens: int) -> bool:
    usage = await get_monthly_usage(tenant_id)
    budget = config["budgets"].get(tenant_id, config["default_budget"])
    if usage + estimated_tokens > budget * 0.95:
        logger.warning("Budget threshold reached", extra={"tenant": tenant_id, "usage": usage})
        raise BudgetExceededError(tenant_id, usage, budget)
    return True
```

## FinOps Practices

- Tag every Azure resource with `cost-center`, `team`, `environment`
- Review PTU utilization weekly — downsize if <60% sustained
- Set Azure Cost Management budgets with action groups (email → throttle → block)
- Compare PAYG spend vs PTU break-even monthly (PTU wins at >66% utilization)
- Rotate model versions on schedule — newer models often cheaper per token

## Anti-Patterns

- ❌ Exposing OpenAI endpoints without APIM — no rate limiting, no metering, no fallback
- ❌ Sending all traffic to gpt-4o regardless of complexity — 10x cost for FAQ queries
- ❌ Caching without TTL — stale responses served indefinitely after model updates
- ❌ No token metering — impossible to attribute cost or detect runaway prompts
- ❌ Ignoring PTU utilization — paying for provisioned capacity that sits idle
- ❌ Logging full prompts/responses — storage cost explosion + PII exposure
- ❌ Hardcoded model names — can't rotate deployments without code changes
- ❌ No budget enforcement — single tenant can exhaust shared capacity

## WAF Alignment

| Pillar | Implementation |
|---|---|
| **Cost Optimization** | Model routing by complexity, semantic caching, PTU-first with PAYG overflow, prompt compression, per-tenant budgets with auto-throttle |
| **Reliability** | APIM backend pool with priority failover, retry with jittered backoff, circuit breaker on 429/500, graceful degradation response |
| **Security** | APIM subscription keys + managed identity to backends, Key Vault for API keys, no direct OpenAI exposure, Content Safety on outputs |
| **Performance** | SSE streaming for first-token latency, Redis semantic cache, prompt compression reducing token count 20-30% |
| **Operational Excellence** | Token metering per tenant/endpoint, cost allocation dashboards, budget alerts at 80%/95%, weekly PTU utilization reviews |
| **Responsible AI** | Content Safety filtering on all outputs, PII redaction before logging, per-tenant audit trail of model usage |
