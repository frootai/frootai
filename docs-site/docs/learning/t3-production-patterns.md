---
sidebar_position: 16
title: "T3: Production Patterns"
description: "Taking AI to production — the AI application stack, hosting patterns, API gateways, resilience, cost control, monitoring, and the production readiness checklist."
---

# T3: Production Patterns

The gap between an AI demo and a production AI system is **enormous**. Demos ignore latency, cost, reliability, security, and quality monitoring. This module covers the architecture patterns that bridge that gap. For the security layer, see [T2: Responsible AI](./t2-responsible-ai.md). For infrastructure deployment, see [O5: Infrastructure](./o5-infrastructure.md).

## The AI Application Architecture Stack

Every production AI application follows this layered architecture:

```
┌──────────────────────────────────────┐
│  CLIENT (Web, Mobile, Teams, API)    │
├──────────────────────────────────────┤
│  API GATEWAY (APIM, rate limits,     │
│  auth, semantic caching, metering)   │
├──────────────────────────────────────┤
│  ORCHESTRATION (Semantic Kernel,     │
│  LangChain, custom — routing,        │
│  prompt construction, tool calls)    │
├──────────────────────────────────────┤
│  AI SERVICES (Azure OpenAI,          │
│  AI Search, Content Safety,          │
│  Document Intelligence)              │
├──────────────────────────────────────┤
│  DATA (Cosmos DB, Blob Storage,      │
│  SQL, vector indexes)                │
├──────────────────────────────────────┤
│  PLATFORM (Entra ID, Key Vault,      │
│  Monitor, Private Endpoints)         │
└──────────────────────────────────────┘
```

## Hosting Patterns Decision Matrix

:::info Container Apps Is the Sweet Spot
For most AI applications, **Azure Container Apps** offers the best balance: built-in scaling, no cluster management, WebSocket support, and simple deployment. Only choose AKS when you need GPU node pools or fine-grained control, and Functions when you have pure event-driven workloads.
:::

| Aspect | **Container Apps** | **AKS** | **App Service** | **Functions** | **Copilot Studio** |
|--------|-------------------|---------|-----------------|---------------|-------------------|
| Complexity | Medium | High | Low | Low | Very Low |
| Auto-scaling | ✅ KEDA-based | ✅ HPA/KEDA | ✅ Rule-based | ✅ Event-driven | ✅ Managed |
| GPU Support | ❌ | ✅ | ❌ | ❌ | ❌ |
| WebSocket | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cold Start | ~2-5s | None | ~5-10s | ~1-10s | None |
| Min Cost (dev) | ~$15/mo | ~$200/mo | ~$13/mo | Pay-per-use | Per-message |
| Best For | Most AI apps | GPU/ML serving | Simple web apps | Event processing | No-code bots |
| Max Concurrency | 300/instance | Unlimited | 100/instance | 200/instance | Managed |

**Decision flow:** Need GPU? → AKS. Event-driven/stateless? → Functions. Low-code bot? → Copilot Studio. Everything else? → **Container Apps**.

## API Gateway for AI

Azure API Management (APIM) provides critical AI-specific capabilities:

```
Client ──▶ APIM ──▶ Backend Pool (multiple Azure OpenAI instances)
             │
             ├─ Rate Limiting (per user/tenant/IP)
             ├─ Semantic Caching (similarity > 0.95 → return cached)
             ├─ Token Metering (track usage per consumer)
             ├─ Load Balancing (round-robin across regions)
             ├─ Circuit Breaker (failover on 429/503)
             └─ Authentication (Entra ID token validation)
```

**Key policies for AI workloads:**

```xml
<!-- Rate limiting by token consumption -->
<rate-limit-by-key
  calls="100" renewal-period="60"
  counter-key="@(context.Subscription.Id)" />

<!-- Semantic caching -->
<azure-openai-semantic-cache-store duration="300" />

<!-- Token metering (emit to Event Hub) -->
<azure-openai-emit-token-metric>
  <dimension name="Subscription" value="@(context.Subscription.Id)" />
</azure-openai-emit-token-metric>
```

## Resilience Patterns

### Retry with Exponential Backoff

All external API calls need retry logic. Default: **3 retries at 1s / 2s / 4s with jitter**:

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10)
)
async def call_openai(prompt: str) -> str:
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        timeout=30
    )
    return response.choices[0].message.content
```

### Circuit Breaker

When a downstream service fails repeatedly, stop calling it temporarily:

| State | Behavior | Transition |
|-------|----------|------------|
| **Closed** | Requests pass through normally | → Open after N failures |
| **Open** | Requests fail immediately (return fallback) | → Half-Open after timeout |
| **Half-Open** | Allow one test request | → Closed if success, Open if failure |

### Fallback Strategy

```
Primary: Azure OpenAI (East US)
  ↓ 429/503?
Fallback 1: Azure OpenAI (West US)
  ↓ 429/503?
Fallback 2: Cached response (semantic match)
  ↓ No cache hit?
Fallback 3: "I'm currently experiencing high demand. Please try again."
```

:::warning Never Return Raw Errors
Never expose raw model errors or stack traces to users. Always return a user-friendly fallback message. Log the full error internally with a correlation ID for debugging.
:::

## Cost Control Patterns

| Pattern | Savings | Implementation |
|---------|---------|----------------|
| **Model routing** | 60-80% | GPT-4o-mini for simple queries, GPT-4o for complex |
| **Semantic caching** | 30-50% | Cache responses for similar queries (cosine > 0.95) |
| **Token budgets** | 20-40% | Set `max_tokens` per request type |
| **Prompt compression** | 10-30% | Remove redundant instructions from prompts |
| **Off-peak scheduling** | 10-20% | Batch non-urgent work to low-traffic hours |

**Model routing example** — classify query complexity, then route:

```python
async def route_model(query: str) -> str:
    # Simple: factual lookup, formatting, classification
    if is_simple_query(query):
        return "gpt-4o-mini"  # ~$0.15/1M input tokens
    # Complex: reasoning, analysis, multi-step
    return "gpt-4o"           # ~$2.50/1M input tokens
```

## Monitoring & Observability

### Custom AI Metrics

Track these in Application Insights with **correlation IDs**:

| Metric | What to Track | Alert Threshold |
|--------|--------------|-----------------|
| **Latency** | P50, P95, P99 per model | P95 > 5s |
| **Token usage** | Input + output tokens per request | > budget by 20% |
| **Groundedness** | Evaluation score per response | < 4.0 average |
| **Error rate** | 429s, 503s, content filter blocks | > 5% |
| **Cost** | Daily/weekly/monthly spend | > budget by 10% |

## Production Readiness Checklist

| Category | ✅ Required |
|----------|------------|
| **Security** | Managed Identity, Key Vault, RBAC, private endpoints, content filtering |
| **Reliability** | Retry (3x exponential), circuit breaker, fallback responses, health endpoint |
| **Performance** | Streaming responses, semantic caching, model routing, async I/O |
| **Cost** | Token budgets, model routing, rate limiting, spending alerts |
| **Monitoring** | Application Insights, custom AI metrics, correlation IDs, dashboards |
| **Compliance** | Content safety enabled, audit logging, PII redaction, data residency |
| **Operations** | CI/CD pipeline, IaC (Bicep), blue-green deploy, runbooks |
| **Evaluation** | Automated eval pipeline, groundedness ≥ 4.0, A/B testing |

## Key Takeaways

1. **Layer your architecture** — gateway, orchestration, services, data, platform
2. **Container Apps for most workloads** — AKS only for GPU, Functions only for events
3. **Retry everything** — 3 retries, exponential backoff, always have a fallback
4. **Route by complexity** — GPT-4o-mini handles 70%+ of queries at 10% of the cost
5. **Monitor AI-specific metrics** — latency, tokens, groundedness, not just HTTP status codes

Previous: [T2: Responsible AI](./t2-responsible-ai.md). Explore the [Solution Plays Overview](../solution-plays/overview.md) for production-ready implementations of these patterns.
