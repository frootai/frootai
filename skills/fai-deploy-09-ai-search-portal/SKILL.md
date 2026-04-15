---
name: fai-deploy-09-ai-search-portal
description: |
  Deploy Play 09 AI Search Portal with Azure AI Search, Static Web Apps, Azure OpenAI, and Blob Storage. Covers index provisioning, semantic ranking setup, search UI deployment, and rollback.
---

# Deploy AI Search Portal (Play 09)

Production deployment workflow for this solution play.

## When to Use

- Deploying an AI-powered search portal
- Setting up Azure AI Search with semantic ranking
- Promoting search infrastructure from dev → prod
- Validating search relevance before production traffic

---

## Infrastructure Stack

| Service | Purpose | SKU |
|---------|---------|-----|
| Azure AI Search | Vector + semantic search | Standard S1 |
| Static Web Apps | Search portal UI | Standard |
| Azure OpenAI | Embeddings + reranking | S0 |
| Blob Storage | Document source | Standard LRS |
| Key Vault | API keys | Standard |
| Application Insights | Search analytics | Workspace-based |

## Deployment Steps

```bash
# 1. Deploy infrastructure
az deployment group create \
  --resource-group rg-search-prod \
  --template-file infra/main.bicep \
  --parameters environment=prod

# 2. Create/update search index with semantic config
az search index create --resource-group rg-search-prod \
  --service-name srch-portal-prod \
  --name docs-index \
  --fields @infra/search-schema.json

# 3. Run indexer to populate data
az search indexer run --resource-group rg-search-prod \
  --service-name srch-portal-prod --name blob-indexer

# 4. Deploy search portal UI
az staticwebapp deploy --name swa-search-prod \
  --app-location ./src --output-location ./dist

# 5. Run search relevance tests
python tests/smoke/test_search_relevance.py \
  --endpoint https://srch-portal-prod.search.windows.net \
  --queries tests/fixtures/relevance-queries.json \
  --min-ndcg 0.78
```

## Rollback Procedure

```bash
# Revert index to previous schema version
az search index create --resource-group rg-search-prod \
  --service-name srch-portal-prod \
  --name docs-index \
  --fields @infra/search-schema-previous.json

# Revert UI
az staticwebapp deploy --name swa-search-prod \
  --deployment-token $SWA_TOKEN --app-location ./dist-previous
```

## Health Check

```bash
curl -s "https://srch-portal-prod.search.windows.net/indexes/docs-index/docs?api-version=2024-07-01&search=*&\$count=true" \
  -H "api-key: $SEARCH_KEY" | jq '.["@odata.count"]'
```

## Troubleshooting

### Search relevance drops after index update

Compare scoring profiles. Verify semantic configuration is enabled. Re-run relevance benchmark with golden queries.

### Indexer fails or stalls

Check Blob Storage connection. Verify skillset configuration. Monitor indexer status with az search indexer status.

### Embedding dimension mismatch

Ensure index vector field dimensions match the embedding model. text-embedding-ada-002=1536, text-embedding-3-small=1536.

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
