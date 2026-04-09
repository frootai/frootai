---
name: "deploy-101-pester-test-development"
description: "Deploy Pester Test Development."
---
# Deploy Pester Test Development
## Step 1: Prerequisites
- Azure CLI, required Azure service access
## Step 2: Execute
az deployment group create -g rg-frootai-pester-test-development -f infra/main.bicep
## Step 3: Verify
