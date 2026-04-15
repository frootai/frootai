---
name: fai-deploy-14-cost-optimized-ai-gateway
description: |
  Deploy Play 14 Cost-Optimized AI Gateway with Azure API Management, Azure OpenAI multi-region, Redis cache, and token metering. Covers routing rules, caching layer, budget enforcement, and rollback.
---

# Deploy Cost-Optimized AI Gateway (Play 14)

Production deployment workflow for this solution play.

## When to Use

- Deploying an AI gateway with model routing
- Setting up multi-region Azure OpenAI load balancing
- Enabling semantic caching for cost reduction
- Enforcing per-team/per-app token budgets

---

## Infrastructure Stack

| Service | Purpose | SKU |
|---------|---------|-----|
| API Management | Gateway + rate limiting | Standard v2 |
| Azure OpenAI (multi-region) | LLM backends | S0 × N regions |
| Redis Cache | Semantic response cache | Premium P1 |
| Cosmos DB | Token usage metering | Serverless |
| Key Vault | Backend API keys | Standard |
| Application Insights | Gateway analytics | Workspace-based |

## Deployment Steps

```bash
# 1. Deploy infrastructure
az deployment group create \
  --resource-group rg-gateway-prod \
  --template-file infra/main.bicep \
  --parameters environment=prod regions="eastus2,westus3,swedencentral"

# 2. Configure APIM policies
az apim api import --resource-group rg-gateway-prod \
  --service-name apim-gateway-prod \
  --path /openai --specification-format OpenApiJson \
  --specification-path infra/openai-api-spec.json

# 3. Deploy routing + caching policies
az apim api policy set --resource-group rg-gateway-prod \
  --service-name apim-gateway-prod --api-id openai \
  --xml-policy @infra/policies/routing-cache.xml

# 4. Run cost-optimization validation
python tests/smoke/test_gateway_routing.py \
  --endpoint https://apim-gateway-prod.azure-api.net \
  --verify-cache-hits --verify-budget-enforcement \
  --max-cost-per-1k-tokens 0.015
```

## Rollback Procedure

```bash
# Revert APIM policies to previous version
az apim api policy set --resource-group rg-gateway-prod \
  --service-name apim-gateway-prod --api-id openai \
  --xml-policy @infra/policies/routing-cache-previous.xml

# Flush Redis cache if poisoned
az redis force-reboot --resource-group rg-gateway-prod \
  --name redis-gateway-prod --reboot-type AllNodes
```

## Health Check

```bash
curl -s https://apim-gateway-prod.azure-api.net/health \
  -H "Ocp-Apim-Subscription-Key: $APIM_KEY" | jq .
# Expected: {"status":"healthy","backends":3,"cache":"connected","metering":"active"}
```

## Troubleshooting

### All traffic going to one region

Check APIM routing policy weight distribution. Verify all backend endpoints are healthy. Check circuit-breaker thresholds.

### Cache hit rate below 30%

Tune semantic similarity threshold (default 0.95). Increase cache TTL for stable queries. Check Redis memory vs eviction policy.

### Token budget exceeded but not blocking

Verify Cosmos DB metering writes are succeeding. Check APIM policy condition for budget check. Verify rate-limit-by-key is active.

## Post-Deploy Checklist

- [ ] All infrastructure resources provisioned and healthy
- [ ] Application deployed and responding on all endpoints
- [ ] Smoke tests passing with expected thresholds
- [ ] Monitoring dashboards showing baseline metrics
- [ ] Alerts configured for error rate, latency, and cost
- [ ] Rollback procedure tested and documented
- [ ] Incident ownership and escalation path confirmed
- [ ] Post-deploy review scheduled within 24 hours

## Definition of Done

Deployment is complete when infrastructure is provisioned, application is serving traffic, smoke tests pass, monitoring is active, and another engineer can reproduce the process from this skill alone.
