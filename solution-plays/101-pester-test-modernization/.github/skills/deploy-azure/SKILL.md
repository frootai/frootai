---
name: "deploy-azure"
description: "Deploy Pester Test Modernization (Play 101) infrastructure and application to Azure"
---

# Deploy Azure — Pester Test Modernization

## Overview
This skill deploys the Pester Test Modernization solution play to Azure using Bicep infrastructure-as-code and Azure Developer CLI.

## Prerequisites
- Azure CLI v2.60+ authenticated (`az login`)
- Azure Developer CLI v1.9+ (`azd version`)
- Bicep CLI v0.28+ (`az bicep version`)
- Contributor + User Access Administrator role on target subscription
- Resource providers registered: Microsoft.CognitiveServices, Microsoft.Search, Microsoft.Web

## Step 1: Validate Infrastructure
```bash
cd infra/
az bicep lint -f main.bicep
az bicep build -f main.bicep
echo "Bicep validation passed"
```

## Step 2: Create Resource Group
```bash
RESOURCE_GROUP="rg-frootai-${ENVIRONMENT:-dev}"
LOCATION="${AZURE_LOCATION:-eastus2}"
az group create --name $RESOURCE_GROUP --location $LOCATION --tags project=frootai environment=${ENVIRONMENT:-dev} play=100
```

## Step 3: Deploy Infrastructure
```bash
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=${ENVIRONMENT:-dev} \
  --name "deploy-play-100-$(date +%Y%m%d%H%M)"
```

## Step 4: Configure Application
```bash
# Get deployment outputs
OUTPUTS=$(az deployment group show --resource-group $RESOURCE_GROUP --name deploy-play-100* --query properties.outputs -o json)
APP_URL=$(echo $OUTPUTS | jq -r '.appUrl.value')
echo "Application URL: $APP_URL"
```

## Step 5: Smoke Test
```bash
curl -sf "$APP_URL/health" | jq .
if [ $? -ne 0 ]; then echo "FAIL: Health check failed"; exit 1; fi
echo "Deployment successful"
```

## Step 6: Run Post-Deploy Evaluation
```bash
python evaluation/eval.py --endpoint $APP_URL --config config/guardrails.json
```

## Rollback
```bash
az deployment group create --resource-group $RESOURCE_GROUP --template-file infra/main.bicep --parameters infra/parameters.json --rollback-on-error
```

## Verification Checklist
- [ ] Bicep compiles without errors
- [ ] All resources deployed successfully
- [ ] Health endpoint returns 200
- [ ] Managed Identity role assignments active
- [ ] Application Insights receiving telemetry
- [ ] Evaluation metrics pass thresholds

## Troubleshooting
- **Bicep compile error:** Check for missing parameter values in parameters.json
- **RBAC error:** Ensure deployment identity has User Access Administrator role
- **Quota error:** Request quota increase or switch to a different Azure region
- **Timeout:** Increase deployment timeout, check for large resource graphs
- **DNS not resolving:** Wait 5-10 minutes for DNS propagation after deployment
- **Health check 503:** Check application logs in Application Insights for startup errors
