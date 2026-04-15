---
name: fai-deploy-11-ai-landing-zone-advanced
description: |
  Deploy Play 11 AI Landing Zone Advanced with hub-spoke networking, private endpoints, Azure Policy, and monitoring. Covers governance guardrails, network isolation, and platform-team handoff.
---

# Deploy AI Landing Zone Advanced (Play 11)

Production deployment workflow for this solution play.

## When to Use

- Deploying enterprise AI landing zone with private networking
- Setting up hub-spoke topology for AI workloads
- Applying Azure Policy governance guardrails
- Promoting landing zone from dev → prod subscription

---

## Infrastructure Stack

| Service | Purpose | SKU |
|---------|---------|-----|
| Virtual Network (Hub) | Central connectivity + firewall | Standard |
| Virtual Network (Spoke) | AI workload isolation | Standard |
| Private Endpoints | OpenAI + Search + Storage | Standard |
| Azure Policy | Governance guardrails | Built-in + custom |
| Azure Monitor | Platform diagnostics | Workspace-based |
| Key Vault | Platform secrets | Premium (HSM) |

## Deployment Steps

```bash
# 1. Deploy hub network
az deployment sub create \
  --location eastus2 \
  --template-file infra/hub/main.bicep \
  --parameters infra/hub/main.bicepparam

# 2. Deploy spoke for AI workloads
az deployment group create \
  --resource-group rg-ai-spoke-prod \
  --template-file infra/spoke/main.bicep \
  --parameters environment=prod hubVnetId=$HUB_VNET_ID

# 3. Apply Azure Policy assignments
az policy assignment create \
  --name ai-governance \
  --policy-set-definition /providers/Microsoft.Authorization/policySetDefinitions/ai-landing-zone \
  --scope /subscriptions/$SUB_ID

# 4. Validate private endpoint connectivity
python tests/smoke/test_private_endpoints.py \
  --resource-group rg-ai-spoke-prod \
  --endpoints openai,search,storage,keyvault
```

## Rollback Procedure

```bash
# Remove spoke (preserve hub)
az group delete --name rg-ai-spoke-prod --yes --no-wait

# Remove policy assignments
az policy assignment delete --name ai-governance \
  --scope /subscriptions/$SUB_ID
```

## Health Check

```bash
# Verify private endpoint resolution
nslookup cog-openai-prod.openai.azure.com
# Expected: 10.x.x.x (private IP, not public)

az network private-endpoint list -g rg-ai-spoke-prod -o table
```

## Troubleshooting

### Private endpoint DNS not resolving

Check private DNS zone link to spoke VNet. Verify A record exists. Use az network private-dns record-set a list.

### Policy blocking legitimate deployments

Create exemptions for specific resource groups. Use "Audit" mode before "Deny". Check policy evaluation order.

### Hub-spoke peering connectivity fails

Verify peering status is "Connected" on both sides. Check allow-forwarded-traffic and allow-gateway-transit settings.

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
