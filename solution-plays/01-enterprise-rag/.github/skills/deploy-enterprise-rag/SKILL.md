---
name: deploy-enterprise-rag
description: "Deploy Enterprise RAG to Azure — provision AI Search + OpenAI + Storage with AVM Bicep, configure indexes, deploy application, run smoke tests. Use when: deploy, provision, infrastructure, Azure, Bicep, azd, CI/CD."
---

# Deploy Enterprise RAG to Azure

## When to Use
- User asks to deploy the RAG solution to Azure
- User asks to provision infrastructure (AI Search, OpenAI, Storage)
- User asks to set up CI/CD for the RAG pipeline
- User mentions Bicep, azd, deployment, infrastructure

## Step 1: Validate Bicep Templates

```bash
az bicep lint --file infra/main.bicep
az bicep build --file infra/main.bicep
az deployment group what-if \
  --resource-group rg-enterprise-rag \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam
```

## Step 2: Deploy Infrastructure

### Using Azure Developer CLI (recommended)
```bash
azd init
azd up --environment dev
```

### Using Azure CLI directly
```bash
az group create --name rg-enterprise-rag --location eastus2
az deployment group create \
  --resource-group rg-enterprise-rag \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam
```

## Step 3: Configure Azure AI Search Index

Required index fields:

| Field | Type | Purpose |
|-------|------|---------|
| id | Edm.String | Chunk identifier |
| content | Edm.String | Chunk text (searchable, filterable) |
| content_vector | Collection(Edm.Single) | Embedding vector (3072 dims for text-embedding-3-large) |
| source | Edm.String | Source document name |
| page | Edm.Int32 | Page number |
| chunk_index | Edm.Int32 | Position within document |

Enable semantic configuration with "default" profile for reranking.

## Step 4: Deploy Models on Azure OpenAI

| Model | Deployment Name | Purpose | SKU |
|-------|----------------|---------|-----|
| gpt-4o | gpt-4o | Chat completion + grounded answers | Standard (30 TPM) |
| text-embedding-3-large | text-embedding-3-large | Document + query embedding | Standard (120 TPM) |

CRITICAL: Query embedding model MUST match the index embedding model. Mismatch = 0 results.

## Step 5: Configure RBAC (Managed Identity)

```bash
# Get the app's managed identity
APP_IDENTITY=$(az containerapp show --name app-rag --resource-group rg-enterprise-rag --query identity.principalId -o tsv)

# Assign roles
az role assignment create --assignee $APP_IDENTITY --role "Cognitive Services OpenAI User" --scope /subscriptions/.../openai
az role assignment create --assignee $APP_IDENTITY --role "Search Index Data Reader" --scope /subscriptions/.../search
az role assignment create --assignee $APP_IDENTITY --role "Storage Blob Data Reader" --scope /subscriptions/.../storage
```

## Step 6: Run Evaluation Pipeline

```bash
python evaluation/eval.py --config config/guardrails.json
# Groundedness: ≥0.8, Relevance: ≥0.7, Coherence: ≥0.8
```

## Step 7: Smoke Test

```bash
curl https://app-rag.azurecontainerapps.io/health
curl -X POST https://app-rag.azurecontainerapps.io/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the company policy on remote work?"}'
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | No RBAC role assigned | Assign Cognitive Services OpenAI User role |
| 404 Model Not Found | Deployment name mismatch | Check config/openai.json matches Azure portal |
| 429 Rate Limited | Exceeded TPM quota | Increase capacity or add retry with backoff |
| Search returns 0 | Embedding model mismatch | Same model for indexing AND querying |
| Low groundedness | Chunks too large | Reduce chunk_size in config/chunking.json |
| Bicep lint errors | Missing parameters | Verify main.bicepparam has all required values |

## CI/CD Templates
Reference `.github/workflows/rag-ci-github.yml` for GitHub Actions pipeline.
