---
name: fai-deploy-06-document-intelligence
description: |
  Deploy Play 06 Document Intelligence with Azure Document Intelligence, Blob Storage, Cosmos DB, and App Service. Covers OCR model provisioning, document queue setup, extraction accuracy validation, and rollback.
---

# Deploy Document Intelligence (Play 06)

Production deployment workflow for this solution play.

## When to Use

- Deploying a Document Intelligence extraction pipeline
- Setting up OCR + custom model training environments
- Promoting document processing from dev → staging → prod
- Validating extraction accuracy before production release

---

## Infrastructure Stack

| Service | Purpose | SKU |
|---------|---------|-----|
| Azure Document Intelligence | OCR + custom extraction | S0 |
| Blob Storage | Document ingestion queue | Standard LRS |
| Cosmos DB | Extracted data store | Serverless |
| App Service | Processing API | P1v3 |
| Key Vault | API keys + connection strings | Standard |
| Application Insights | Processing telemetry | Workspace-based |

## Deployment Steps

```bash
# 1. Deploy infrastructure
az deployment group create \
  --resource-group rg-docint-prod \
  --template-file infra/main.bicep \
  --parameters environment=prod

# 2. Train custom extraction model (if applicable)
az cognitiveservices account deployment create \
  --resource-group rg-docint-prod \
  --name cog-docint-prod \
  --deployment-name custom-invoice-model \
  --model-name prebuilt-invoice --model-version 2024-02-29

# 3. Deploy processing API
az webapp deploy --resource-group rg-docint-prod \
  --name app-docint-prod --src-path dist/api.zip

# 4. Run extraction accuracy test
python tests/smoke/test_extraction.py \
  --endpoint https://app-docint-prod.azurewebsites.net \
  --sample-dir tests/fixtures/sample-documents \
  --min-accuracy 0.92
```

## Rollback Procedure

```bash
# Revert to previous API version
az webapp deployment slot swap \
  --resource-group rg-docint-prod \
  --name app-docint-prod \
  --slot staging --target-slot production

# Revert model version if custom model regressed
az cognitiveservices account deployment create \
  --resource-group rg-docint-prod \
  --name cog-docint-prod \
  --deployment-name custom-invoice-model \
  --model-name prebuilt-invoice --model-version 2023-07-31
```

## Health Check

```bash
curl -s https://app-docint-prod.azurewebsites.net/health | jq .
# Expected: {"status":"healthy","ocr":"connected","storage":"connected","db":"connected"}
```

## Troubleshooting

### Extraction accuracy below threshold

Compare training data distribution vs production documents. Check image quality/DPI. Retrain with representative samples.

### Queue backpressure causing timeouts

Scale App Service plan or add queue-based processing with Service Bus. Set per-document timeout to 30s.

### Custom model training fails

Verify labeled dataset has ≥5 samples per field. Check region availability for Document Intelligence custom models.

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
