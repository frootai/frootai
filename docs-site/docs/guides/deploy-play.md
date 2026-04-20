---
sidebar_position: 5
title: Deploy a Play
description: End-to-end guide for deploying FrootAI solution play infrastructure to Azure — from Bicep validation through production health checks.
---

# Deploy a Play

Deploy a FrootAI solution play to Azure with Bicep infrastructure, health checks, evaluation gates, and cost tracking.

## Prerequisites

| Requirement | Verify | Minimum Version |
|-------------|--------|-----------------|
| Azure CLI | `az version` | 2.60+ |
| Bicep CLI | `az bicep version` | 0.25+ |
| Azure subscription | `az account show` | Contributor role |
| Node.js | `node --version` | 22+ |

```bash
az login
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

## Step 1: Pre-Deployment Checklist

```bash
# Validate Bicep compiles
az bicep build -f solution-plays/01-enterprise-rag/infra/main.bicep

# Validate all primitives
npm run validate:primitives

# Scan for leaked secrets
bash hooks/fai-secrets-scanner/scan-secrets.sh
```

## Step 2: Create the Resource Group

```bash
PLAY="01-enterprise-rag"
ENV="dev"
LOCATION="eastus2"
RG="rg-frootai-${PLAY}-${ENV}"

az group create --name "$RG" --location "$LOCATION" \
  --tags play="$PLAY" environment="$ENV" managed-by="frootai"
```

## Step 3: Preview with What-If

:::warning Always Preview First
Never deploy without running `what-if` to check for unexpected resource deletions.
:::

```bash
az deployment group what-if \
  --resource-group "$RG" \
  --template-file "solution-plays/${PLAY}/infra/main.bicep" \
  --parameters "solution-plays/${PLAY}/infra/parameters.${ENV}.json" \
  --mode Incremental
```

## Step 4: Deploy Infrastructure

```bash
DEPLOY_NAME="frootai-${PLAY}-$(date +%Y%m%d-%H%M%S)"

az deployment group create \
  --resource-group "$RG" \
  --template-file "solution-plays/${PLAY}/infra/main.bicep" \
  --parameters "solution-plays/${PLAY}/infra/parameters.${ENV}.json" \
  --name "$DEPLOY_NAME" --mode Incremental
```

## Step 5: Deploy Application Code

For Container Apps:

```bash
ACR_NAME="acrfrootai${ENV}"
az acr build --registry "$ACR_NAME" \
  --image "frootai-${PLAY}:latest" \
  "solution-plays/${PLAY}/"
```

## Step 6: Health Checks

```bash
APP_URL=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" \
  --query "properties.outputs.applicationUrl.value" -o tsv)

curl -sf "${APP_URL}/health" | jq .
# Expected: {"status":"healthy","version":"1.0.0"}
```

## Step 7: Post-Deployment Evaluation

```bash
node engine/index.js "solution-plays/${PLAY}/fai-manifest.json" --eval
```

All guardrails must pass before the deployment is complete.

## Cost Estimation

| Resource | Dev Cost/mo | Prod Cost/mo |
|----------|-------------|--------------|
| Azure OpenAI (GPT-4o-mini) | ~$15 | ~$150 |
| Azure AI Search | ~$70 | ~$250 |
| Container Apps | ~$0-20 | ~$50-200 |
| **Total estimated** | **~$90** | **~$640** |

## Rollback

```bash
# Redeploy previous version
az deployment group create --resource-group "$RG" \
  --template-file "solution-plays/${PLAY}/infra/main.bicep" \
  --parameters "solution-plays/${PLAY}/infra/parameters.${ENV}.json" \
  --name "rollback-$(date +%Y%m%d-%H%M%S)"
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `InsufficientQuota` on OpenAI | Request quota increase or switch region |
| Container App returns 502 | Check `az containerapp logs show` |
| Health check timeout | Verify VNet integration and DNS |

## See Also

- [Evaluate a Play](/docs/guides/evaluate-play) — quality gate evaluation
- [Workflows](/docs/primitives/workflows) — CI/CD automation
- [Cost Optimization WAF](/docs/concepts/well-architected) — cost pillar
