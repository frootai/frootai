---
name: deploy-cost-optimized-ai-gateway
description: "Deploy AI Gateway — configure APIM with semantic caching (Redis), token budgets per tenant, multi-region load balancing, model routing policies. Use when: deploy, provision, configure gateway."
---

# Deploy Cost-Optimized AI Gateway

## When to Use
- Deploy APIM as an AI gateway fronting Azure OpenAI endpoints
- Configure semantic caching with Redis for cost reduction
- Set up per-tenant token budgets and rate limiting
- Configure multi-region load balancing with failover
- Deploy model routing policies (model selection by request type)

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Bicep CLI: `az bicep version`
3. Azure OpenAI deployed in 2+ regions (for load balancing)
4. Redis Cache resource (for semantic caching)
5. APIM instance (Developer tier for dev, Standard for production)

## Step 1: Validate Infrastructure
```bash
az bicep lint -f infra/main.bicep
az bicep build -f infra/main.bicep
```
Verify resources:
- API Management (Standard v2 for production throughput)
- Azure Cache for Redis (Premium for persistence + geo-replication)
- Azure OpenAI (multi-region: eastus2 + westus3)
- Azure Monitor (request analytics, cost tracking)
- Key Vault (OpenAI keys, APIM subscription keys)

## Step 2: Deploy Azure Resources
```bash
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```

## Step 3: Configure APIM Policies
| Policy | Purpose | APIM Policy Fragment |
|--------|---------|---------------------|
| Semantic cache lookup | Check Redis before calling OpenAI | `<cache-lookup-value>` with embedding similarity |
| Semantic cache store | Store response in Redis after OpenAI call | `<cache-store-value>` with TTL |
| Token budget check | Enforce per-tenant token limits | `<rate-limit-by-key>` on subscription |
| Model routing | Route to appropriate model by request type | `<choose>` based on request header/body |
| Load balancing | Distribute across regions | `<retry>` with multiple backends |
| Rate limiting | Prevent abuse | `<rate-limit>` per subscription |

## Step 4: Configure Semantic Caching
```xml
<!-- APIM inbound policy for semantic cache -->
<inbound>
  <cache-lookup-value key="@(context.Request.Body.As<string>())" 
    variable-name="cachedResponse" />
  <choose>
    <when condition="@(context.Variables.ContainsKey("cachedResponse"))">
      <return-response>
        <set-body>@((string)context.Variables["cachedResponse"])</set-body>
      </return-response>
    </when>
  </choose>
</inbound>
```
- Embedding similarity threshold: 0.95 (very similar queries get cached response)
- Cache TTL: 1 hour (shorter for dynamic data, longer for static)
- Cache key: hash of embedding vector of the user prompt

## Step 5: Configure Token Budgets
| Tier | Monthly Token Budget | Rate Limit | Model Access |
|------|---------------------|-----------|-------------|
| Free | 100K tokens | 10 req/min | gpt-4o-mini only |
| Standard | 1M tokens | 60 req/min | gpt-4o-mini + gpt-4o |
| Enterprise | 10M tokens | 300 req/min | All models + priority |

## Step 6: Configure Multi-Region Load Balancing
```json
// config/gateway.json
{
  "backends": [
    { "region": "eastus2", "endpoint": "https://oai-eastus2.openai.azure.com", "weight": 60, "priority": 1 },
    { "region": "westus3", "endpoint": "https://oai-westus3.openai.azure.com", "weight": 40, "priority": 2 }
  ],
  "failover": { "enabled": true, "retryCount": 2, "retryInterval": "1s" }
}
```

## Step 7: Smoke Test
```bash
# Test routing
curl -X POST https://$APIM_URL/openai/deployments/gpt-4o/chat/completions \
  -H "api-key: $SUB_KEY" -d '{"messages":[{"role":"user","content":"Hello"}]}'

# Test cache hit (repeat same query)
curl -X POST https://$APIM_URL/openai/deployments/gpt-4o/chat/completions \
  -H "api-key: $SUB_KEY" -d '{"messages":[{"role":"user","content":"Hello"}]}'
# Should return faster (cache hit)

# Test budget enforcement
python scripts/test_budget.py --sub-key $FREE_KEY --tokens 200000  # Should reject at 100K
```

## Post-Deployment Verification
- [ ] APIM routing to Azure OpenAI working
- [ ] Semantic cache returning hits for similar queries
- [ ] Token budgets enforced per subscription tier
- [ ] Multi-region failover tested (disable primary, verify secondary)
- [ ] Rate limiting active per subscription
- [ ] Cost analytics dashboard showing per-tenant usage
- [ ] Monitoring alerts for budget thresholds (80%, 90%, 100%)

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| All cache misses | Similarity threshold too high | Lower from 0.99 to 0.95 |
| Wrong model served | Routing policy not matching | Check `<choose>` conditions in APIM |
| Budget not enforced | Missing rate-limit policy | Add `<rate-limit-by-key>` to inbound |
| Failover not working | No retry policy | Add `<retry>` with backend list |
| High latency through APIM | Cache lookup overhead | Optimize Redis connection, use Premium tier |
| 429 errors from OpenAI | TPM quota exceeded | Add more regions or request quota increase |
