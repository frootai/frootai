---
name: "deploy-101-pester-test-modernization"
description: "Deploy Pester Test Modernization."
---
# Deploy Pester Test Modernization
## Step 1: Prerequisites
- Azure CLI, required Azure service access
## Step 2: Execute
az deployment group create -g rg-frootai-pester-test-modernization -f infra/main.bicep
## Step 3: Verify
