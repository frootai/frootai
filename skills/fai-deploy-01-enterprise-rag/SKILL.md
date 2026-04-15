---
name: fai-deploy-01-enterprise-rag
description: |
  Deploy Enterprise RAG (Play 01) with Azure OpenAI, AI Search, App Service,
  and Cosmos DB. Covers Bicep provisioning, environment promotion, smoke tests,
  and rollback procedures.
---

# Deploy Enterprise RAG (Play 01)

Production deployment workflow for the Enterprise RAG solution play.

## When to Use

- Deploying a new Enterprise RAG environment
- Promoting from dev → staging → production
- Running post-deployment smoke tests
- Rolling back a failed deployment

---

## Infrastructure Stack

| Service | Purpose | SKU |
|---------|---------|-----|
| Azure OpenAI | LLM inference + embeddings | S0 (PAYG or PTU) |
| Azure AI Search | Vector + semantic retrieval | Standard S1 |
| App Service | API hosting | P1v3 |
| Cosmos DB | Conversation history | Serverless |
| Key Vault | Secrets | Standard |
| Application Insights | Monitoring | Workspace-based |

## Deployment Steps

```bash
# 1. Deploy infrastructure
az deployment group create \
  --resource-group rg-rag-prod \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam

# 2. Deploy application code
az webapp deploy --resource-group rg-rag-prod \
  --name app-rag-prod --src-path dist/app.zip

# 3. Run smoke tests
python tests/smoke/test_rag_endpoint.py --base-url https://app-rag-prod.azurewebsites.net

# 4. Verify health
curl -s https://app-rag-prod.azurewebsites.net/health | jq .
```

## Environment Promotion

```yaml
# GitHub Actions staged deployment
jobs:
  deploy-dev:
    uses: ./.github/workflows/deploy.yml
    with: { environment: dev, resource-group: rg-rag-dev }
  deploy-staging:
    needs: deploy-dev
    uses: ./.github/workflows/deploy.yml
    with: { environment: staging, resource-group: rg-rag-staging }
  deploy-prod:
    needs: deploy-staging
    uses: ./.github/workflows/deploy.yml
    with: { environment: production, resource-group: rg-rag-prod }
```

## Smoke Tests

```python
def test_rag_query(base_url: str):
    resp = requests.post(f"{base_url}/api/chat",
        json={"message": "What is a circuit breaker pattern?"})
    assert resp.status_code == 200
    body = resp.json()
    assert "answer" in body
    assert len(body["answer"]) > 50
    assert "citations" in body

def test_health(base_url: str):
    resp = requests.get(f"{base_url}/health")
    assert resp.status_code == 200
    health = resp.json()
    assert health["status"] == "healthy"
    assert health["openai"] == "connected"
    assert health["search"] == "connected"
```

## Rollback

```bash
# Rollback to previous app version
az webapp deployment slot swap --resource-group rg-rag-prod \
  --name app-rag-prod --slot staging --target-slot production

# Or rollback infrastructure
az deployment group create --resource-group rg-rag-prod \
  --template-file infra/main.bicep --parameters @infra/rollback.bicepparam
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Search returns empty | Index not populated | Run indexer or re-index documents |
| OpenAI 403 | MI role not assigned | Grant Cognitive Services OpenAI User |
| High latency after deploy | Cold start | Warm up with health check requests |
| Smoke test fails | Config mismatch between envs | Verify App Config labels match environment |
