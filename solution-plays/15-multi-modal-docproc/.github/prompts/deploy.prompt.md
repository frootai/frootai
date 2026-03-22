# Deploy to Azure

> Slash command: /deploy
> Deploys the Enterprise RAG solution to Azure using Bicep IaC.

## Steps
1. Validate all config files exist: config/openai.json, config/search.json, config/chunking.json, config/guardrails.json
2. Run `az bicep build --file infra/main.bicep` to validate the template
3. Create resource group if not exists: `az group create --name rg-enterprise-rag --location eastus2`
4. Deploy infrastructure: `az deployment group create --resource-group rg-enterprise-rag --template-file infra/main.bicep --parameters infra/parameters.json`
5. Verify all resources have private endpoints enabled
6. Verify managed identity assignments are correct
7. Deploy application code to Container Apps
8. Run smoke test: POST /api/ask with test question

## Pre-flight Checks
- [ ] Azure CLI authenticated (`az account show`)
- [ ] Correct subscription selected
- [ ] Sufficient quota for Azure OpenAI (GPT-4o)
- [ ] AI Search service SKU supports semantic ranker (S1+ or free tier with preview)

## Rollback
If deployment fails, run: `az deployment group cancel --resource-group rg-enterprise-rag`
