#!/bin/bash
# Deploy Enterprise RAG to Azure
# Skill: deploy-azure

set -euo pipefail

RG_NAME="${AZURE_RG:-rg-enterprise-rag}"
LOCATION="${AZURE_LOCATION:-eastus2}"
TEMPLATE="../../infra/main.bicep"
PARAMS="../../infra/parameters.json"

echo "🔍 Validating Bicep template..."
az bicep build --file "$TEMPLATE"

echo "📦 Creating resource group: $RG_NAME in $LOCATION..."
az group create --name "$RG_NAME" --location "$LOCATION" --output none

echo "🚀 Deploying infrastructure..."
az deployment group create \
  --resource-group "$RG_NAME" \
  --template-file "$TEMPLATE" \
  --parameters "$PARAMS" \
  --output table

echo "✅ Deployment complete."
echo "🔗 Verify resources: az resource list --resource-group $RG_NAME --output table"
