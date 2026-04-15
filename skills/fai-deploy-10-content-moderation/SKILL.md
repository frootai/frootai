---
name: fai-deploy-10-content-moderation
description: |
  Deploy Play 10 Content Moderation with Azure Content Safety, Azure OpenAI, Functions, and Cosmos DB. Covers safety filter provisioning, severity threshold tuning, and moderation pipeline deployment.
---

# Deploy Content Moderation (Play 10)

Production deployment workflow for this solution play.

## When to Use

- Deploying a content moderation pipeline
- Setting up Azure Content Safety with custom categories
- Promoting moderation filters from dev → prod
- Validating moderation accuracy with test datasets

---

## Infrastructure Stack

| Service | Purpose | SKU |
|---------|---------|-----|
| Azure Content Safety | Text + image moderation | S0 |
| Azure OpenAI | Prompt Shields + groundedness | S0 |
| Azure Functions | Moderation pipeline API | Consumption |
| Cosmos DB | Moderation audit log | Serverless |
| Key Vault | API keys | Standard |
| Application Insights | Moderation telemetry | Workspace-based |

## Deployment Steps

```bash
# 1. Deploy infrastructure
az deployment group create \
  --resource-group rg-moderation-prod \
  --template-file infra/main.bicep \
  --parameters environment=prod

# 2. Configure content safety thresholds
az cognitiveservices account update \
  --resource-group rg-moderation-prod \
  --name cs-moderation-prod \
  --custom-domain cs-moderation-prod

# 3. Deploy moderation Functions
func azure functionapp publish func-moderation-prod

# 4. Run moderation accuracy benchmark
python tests/smoke/test_moderation_pipeline.py \
  --endpoint https://func-moderation-prod.azurewebsites.net \
  --test-set tests/fixtures/moderation-samples.jsonl \
  --min-precision 0.95 --min-recall 0.90
```

## Rollback Procedure

```bash
# Revert Functions to previous version
az functionapp deployment slot swap \
  --resource-group rg-moderation-prod \
  --name func-moderation-prod \
  --slot staging --target-slot production

# Revert severity thresholds to safe defaults
python scripts/reset-safety-thresholds.py --env prod --preset strict
```

## Health Check

```bash
curl -s https://func-moderation-prod.azurewebsites.net/api/health | jq .
# Expected: {"status":"healthy","contentSafety":"connected","categories":["hate","violence","self-harm","sexual"]}
```

## Troubleshooting

### False positive rate too high

Lower severity thresholds from Strict to Medium. Add custom blocklist exceptions for domain terms. Test with representative samples.

### Moderation latency exceeds 500ms

Use async moderation with Service Bus queue. Batch small texts. Check Content Safety region proximity.

### Prompt Shields blocking legitimate requests

Tune jailbreak detection sensitivity. Whitelist known safe prompt patterns. Add fallback to permissive mode for low-risk categories.

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
