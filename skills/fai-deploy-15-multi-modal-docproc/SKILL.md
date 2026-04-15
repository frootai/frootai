---
name: fai-deploy-15-multi-modal-docproc
description: |
  Deploy Play 15 Multi-Modal Document Processing with GPT-4o Vision, Azure Document Intelligence, Blob Storage, and App Service. Covers vision model deployment, multi-format pipeline, accuracy benchmarks, and rollback.
---

# Deploy Multi-Modal Document Processing (Play 15)

Production deployment workflow for this solution play.

## When to Use

- Deploying a multi-modal document processing pipeline
- Setting up GPT-4o Vision for image + PDF analysis
- Promoting document pipeline from dev → prod
- Validating extraction accuracy across document formats

---

## Infrastructure Stack

| Service | Purpose | SKU |
|---------|---------|-----|
| Azure OpenAI (GPT-4o) | Vision + text analysis | S0 |
| Azure Document Intelligence | OCR fallback | S0 |
| Blob Storage | Document ingestion | Standard LRS |
| App Service | Processing API | P2v3 |
| Cosmos DB | Extraction results | Serverless |
| Application Insights | Processing telemetry | Workspace-based |

## Deployment Steps

```bash
# 1. Deploy infrastructure
az deployment group create \
  --resource-group rg-multimodal-prod \
  --template-file infra/main.bicep \
  --parameters environment=prod gptModel=gpt-4o

# 2. Deploy processing API
az webapp deploy --resource-group rg-multimodal-prod \
  --name app-multimodal-prod --src-path dist/api.zip

# 3. Run multi-format accuracy test
python tests/smoke/test_multimodal_extraction.py \
  --endpoint https://app-multimodal-prod.azurewebsites.net \
  --formats pdf,png,jpeg,tiff,docx \
  --sample-dir tests/fixtures/multi-format-docs \
  --min-accuracy 0.88

# 4. Validate vision model responses
python tests/smoke/test_vision_quality.py \
  --endpoint https://oai-multimodal-prod.openai.azure.com \
  --images tests/fixtures/sample-images \
  --min-groundedness 0.85
```

## Rollback Procedure

```bash
# Revert API to previous version
az webapp deployment slot swap \
  --resource-group rg-multimodal-prod \
  --name app-multimodal-prod \
  --slot staging --target-slot production

# Fallback to OCR-only mode
az webapp config appsettings set \
  --resource-group rg-multimodal-prod \
  --name app-multimodal-prod \
  --settings VISION_ENABLED=false OCR_FALLBACK=true
```

## Health Check

```bash
curl -s https://app-multimodal-prod.azurewebsites.net/health | jq .
# Expected: {"status":"healthy","vision":"enabled","ocr":"connected","formats":["pdf","png","jpeg","tiff","docx"]}
```

## Troubleshooting

### Vision model returns hallucinated content

Lower temperature to 0. Add structured output schema. Validate against OCR ground truth. Use detail=low for layout analysis.

### Processing timeout on large documents

Split documents into page batches. Set per-page timeout to 15s. Use async processing with Service Bus for documents >20 pages.

### Format not supported error

Check supported formats list. Convert unsupported formats (HEIC→JPEG) in preprocessing. Fallback to OCR for text-heavy documents.

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
