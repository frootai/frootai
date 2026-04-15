---
name: fai-deploy-07-multi-agent-service
description: |
  Deploy Play 07 Multi-Agent Service with Azure Container Apps, Redis, Cosmos DB, and Azure OpenAI. Covers agent orchestrator provisioning, inter-agent communication, health checks, and rollback.
---

# Deploy Multi-Agent Service (Play 07)

Production deployment workflow for this solution play.

## When to Use

- Deploying a multi-agent orchestration platform
- Setting up AutoGen/Semantic Kernel agent teams
- Promoting agent service from dev → staging → prod
- Validating agent delegation and conflict resolution

---

## Infrastructure Stack

| Service | Purpose | SKU |
|---------|---------|-----|
| Azure Container Apps | Agent runtime hosting | Consumption |
| Azure OpenAI | LLM inference for agents | S0 |
| Redis Cache | Agent session state | C1 |
| Cosmos DB | Conversation + task history | Serverless |
| Service Bus | Inter-agent messaging | Standard |
| Application Insights | Agent telemetry + traces | Workspace-based |

## Deployment Steps

```bash
# 1. Deploy infrastructure
az deployment group create \
  --resource-group rg-agents-prod \
  --template-file infra/main.bicep \
  --parameters environment=prod

# 2. Build and push container image
az acr build --registry cracragentsprod \
  --image agent-service:$(git rev-parse --short HEAD) .

# 3. Deploy to Container Apps
az containerapp update \
  --resource-group rg-agents-prod \
  --name ca-agent-orchestrator \
  --image cracragentsprod.azurecr.io/agent-service:$(git rev-parse --short HEAD)

# 4. Run agent delegation smoke test
python tests/smoke/test_agent_delegation.py \
  --endpoint https://ca-agent-orchestrator.azurecontainerapps.io \
  --scenario builder-reviewer-handoff
```

## Rollback Procedure

```bash
# Revert to previous container revision
az containerapp revision list \
  --resource-group rg-agents-prod \
  --name ca-agent-orchestrator --query "[1].name" -o tsv | \
  xargs -I {} az containerapp ingress traffic set \
  --resource-group rg-agents-prod --name ca-agent-orchestrator \
  --revision-weight {}=100
```

## Health Check

```bash
curl -s https://ca-agent-orchestrator.azurecontainerapps.io/health | jq .
# Expected: {"status":"healthy","agents":3,"redis":"connected","llm":"connected"}
```

## Troubleshooting

### Agent delegation loops infinitely

Check max-rounds config in orchestrator. Set explicit termination conditions per agent role. Monitor token usage per round.

### Inter-agent latency exceeds SLA

Use Service Bus sessions for ordered delivery. Scale Redis to Premium tier. Check Container Apps min-replicas.

### Agent produces inconsistent outputs

Pin temperature=0 and seed for deterministic agents. Add structured-output JSON schemas. Enable conversation history truncation.

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
