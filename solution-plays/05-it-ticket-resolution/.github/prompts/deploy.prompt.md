---
mode: "agent"
agent: "builder"
description: "Deploy It Ticket Resolution (Play 05) to Azure"
tools: ["terminal", "file", "read", "edit"]
---

# Deploy It Ticket Resolution to Azure

You are deploying the FrootAI It Ticket Resolution solution play (Play 05) to Azure.

## Prerequisites Check
Before deploying, verify the following:
1. Azure CLI is installed and authenticated: `az account show`
2. Azure Developer CLI is installed: `azd version`
3. Bicep CLI is available: `az bicep version`
4. You have Contributor + User Access Administrator on the target subscription
5. The target resource group exists or you have permission to create it
6. All config files are valid JSON: verify with `node -e "require('./config/openai.json')"`

## Step 1: Validate Infrastructure
Lint and build the Bicep template to catch errors before deployment:
```bash
az bicep lint -f infra/main.bicep
az bicep build -f infra/main.bicep
```
Review the generated ARM template in `infra/main.json` for correctness.

## Step 2: Deploy Infrastructure
Deploy all Azure resources defined in the Bicep template:
```bash
az deployment group create \
  --resource-group rg-frootai-${ENVIRONMENT} \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=${ENVIRONMENT}
```
Or use Azure Developer CLI for full-stack deployment:
```bash
azd up --environment ${ENVIRONMENT}
```

## Step 3: Configure Application
After infrastructure is deployed:
1. Set application configuration from `config/*.json` files
2. Configure Managed Identity role assignments (auto-done by Bicep if defined)
3. Upload any required seed data or knowledge bases
4. Set environment variables for the application runtime

## Step 4: Smoke Test
Run basic health checks to verify deployment:
```bash
# Check API health endpoint
curl -s https://${APP_URL}/health | jq .

# Verify Azure OpenAI connectivity
curl -s https://${APP_URL}/api/test | jq .status

# Check all dependent services
curl -s https://${APP_URL}/health/dependencies | jq .
```

## Step 5: Run Evaluation
After deployment, run the evaluation pipeline to verify quality:
```bash
python evaluation/eval.py --environment ${ENVIRONMENT}
```
All metrics must pass thresholds defined in `config/guardrails.json`.

## Step 6: Monitor
After successful deployment:
1. Verify Application Insights is receiving telemetry
2. Check Log Analytics for error-free startup logs
3. Confirm alert rules are active (error rate, latency p99)
4. Verify auto-scale rules are configured (if applicable)

## Rollback Procedure
If deployment fails or quality checks don't pass:
```bash
# Rollback to previous deployment
az deployment group create \
  --resource-group rg-frootai-${ENVIRONMENT} \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=${ENVIRONMENT} \
  --rollback-on-error
```

## Post-Deployment Checklist
- [ ] Health endpoint returns 200
- [ ] All dependent services are healthy
- [ ] Evaluation metrics pass thresholds
- [ ] Application Insights receiving data
- [ ] Alert rules are active
- [ ] DNS/routing is configured correctly
- [ ] SSL certificate is valid
- [ ] CORS settings are correct for frontend origins
