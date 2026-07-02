# Recipe 2: Deploy a Solution Play to Azure

> End-to-end deployment of FrootAI solution-play infra to Azure: Bicep validation, prod health checks, multi-env promotion, rollback.

## What You'll Build

A deployed Azure environment for any FrootAI solution play (01–68):

- Azure OpenAI + AI Search via Bicep
- Container Apps or Functions with health probes
- Private Endpoints, VNet, Managed Identity
- Tags for cost tracking + WAF compliance
- Post-deploy evaluation gates

## Prerequisites

| Requirement | Install / Verify | Minimum Version |
|-------------|-----------------|-----------------|
| Azure CLI | `az version` | 2.60+ |
| Bicep CLI | `az bicep version` | 0.25+ |
| Azure subscription | `az account show` | Active, with Contributor role |
| Node.js | `node --version` | 22+ |
| FrootAI repo | `npm run validate:primitives` | 0 errors |

Install missing tools:

```bash
# Azure CLI (Windows)
winget install Microsoft.AzureCLI

# Bicep (bundled with Azure CLI)
az bicep install

# Login and set subscription
az login
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

## Pre-Deployment Checklist

Run before every deployment; all must pass:

```bash
# 1. Confirm Azure authentication
az account show --query "{Name:name, ID:id, State:state}" -o table

# 2. Validate Bicep compiles
az bicep build -f solution-plays/01-enterprise-rag/infra/main.bicep

# 3. Validate all primitives
npm run validate:primitives

# 4. Confirm manifest wiring
node engine/index.js solution-plays/01-enterprise-rag/fai-manifest.json --status

# 5. Scan for leaked secrets
bash hooks/frootai-secrets-scanner/scan-secrets.sh
```

## Step 1: Create the Resource Group

Use one resource group per play for isolation and cost tracking:

```bash
PLAY="01-enterprise-rag"
ENV="dev"
LOCATION="eastus2"
RG="rg-frootai-${PLAY}-${ENV}"

az group create \
  --name "$RG" \
  --location "$LOCATION" \
  --tags play="$PLAY" environment="$ENV" managed-by="frootai"
```

## Step 2: Configure Environment Parameters

Copy the play template per environment:

```bash
cp solution-plays/${PLAY}/infra/parameters.json \
   solution-plays/${PLAY}/infra/parameters.${ENV}.json
```

Edit `parameters.dev.json` with env-specific values:

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": { "value": "dev" },
    "location": { "value": "eastus2" },
    "openAiSkuName": { "value": "S0" },
    "openAiModelName": { "value": "gpt-4o-mini" },
    "openAiModelVersion": { "value": "2024-07-18" },
    "openAiCapacity": { "value": 30 },
    "searchServiceSku": { "value": "basic" },
    "containerAppMinReplicas": { "value": 0 },
    "containerAppMaxReplicas": { "value": 2 }
  }
}
```

Prod uses higher SKUs/capacity:

```json
{
  "parameters": {
    "environmentName": { "value": "prod" },
    "openAiModelName": { "value": "gpt-4o" },
    "openAiModelVersion": { "value": "2024-11-20" },
    "openAiCapacity": { "value": 120 },
    "searchServiceSku": { "value": "standard" },
    "containerAppMinReplicas": { "value": 2 },
    "containerAppMaxReplicas": { "value": 10 }
  }
}
```

## Step 3: Preview with What-If

Always preview first; investigate any unexpected deletions:

```bash
az deployment group what-if \
  --resource-group "$RG" \
  --template-file "solution-plays/${PLAY}/infra/main.bicep" \
  --parameters "solution-plays/${PLAY}/infra/parameters.${ENV}.json" \
  --mode Incremental
```

Interpret output:
- **Create** (green): expected new resources
- **Modify** (yellow): verify intent
- **Delete** (red): investigate before proceeding
- **NoChange**: already desired state

## Step 4: Deploy Infrastructure

```bash
DEPLOY_NAME="frootai-${PLAY}-$(date +%Y%m%d-%H%M%S)"

az deployment group create \
  --resource-group "$RG" \
  --template-file "solution-plays/${PLAY}/infra/main.bicep" \
  --parameters "solution-plays/${PLAY}/infra/parameters.${ENV}.json" \
  --name "$DEPLOY_NAME" \
  --mode Incremental \
  --verbose
```

Capture outputs for app config:

```bash
# Extract key outputs
OPENAI_ENDPOINT=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" \
  --query "properties.outputs.openAiEndpoint.value" -o tsv)
SEARCH_ENDPOINT=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" \
  --query "properties.outputs.searchEndpoint.value" -o tsv)
APP_URL=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" \
  --query "properties.outputs.applicationUrl.value" -o tsv)

echo "OpenAI:  $OPENAI_ENDPOINT"
echo "Search:  $SEARCH_ENDPOINT"
echo "App:     $APP_URL"
```

## Step 5: Deploy Application Code

For Container Apps:

```bash
APP_NAME="ca-frootai-${PLAY}-${ENV}"
ACR_NAME="acrfrootai${ENV}"

# Build and push container image
az acr build \
  --registry "$ACR_NAME" \
  --image "frootai-${PLAY}:latest" \
  --file "solution-plays/${PLAY}/Dockerfile" \
  "solution-plays/${PLAY}/"

# Update the container app with the new image
az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --image "${ACR_NAME}.azurecr.io/frootai-${PLAY}:latest"
```

For Azure Functions:

```bash
FUNC_NAME="func-frootai-${PLAY}-${ENV}"

cd "solution-plays/${PLAY}/functions"
func azure functionapp publish "$FUNC_NAME" --python
```

## Step 6: Health Checks and Smoke Tests

```bash
# Shallow health check — is the app running?
curl -sf "${APP_URL}/health" | jq .
# Expected: {"status":"healthy","version":"1.0.0"}

# Deep readiness check — are all dependencies connected?
curl -sf "${APP_URL}/health/ready" | jq .
# Expected: {"status":"ready","openai":"connected","search":"connected"}

# Smoke test — send a real query
curl -sf -X POST "${APP_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the onboarding process?"}' | jq '.answer | length'
# Expected: non-zero (answer has content)
```

## Step 7: Post-Deployment Evaluation

Run live-deploy evaluation:

```bash
# Validate manifest wiring post-deploy
node engine/index.js "solution-plays/${PLAY}/fai-manifest.json" --status

# Run quality gate evaluation
node engine/index.js "solution-plays/${PLAY}/fai-manifest.json" --eval
```

All guardrails in `fai-manifest.json` must pass before completion.

## Step 8: Tag Resources for Cost Tracking

```bash
RG_ID=$(az group show -n "$RG" --query id -o tsv)

az tag update --resource-id "$RG_ID" --operation merge --tags \
  play="$PLAY" \
  environment="$ENV" \
  version="1.0.0" \
  waf="aligned" \
  deployed-at="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  deployed-by="$(az account show --query user.name -o tsv)"
```

## Rollback Procedure

### Option A: Redeploy Previous Version

```bash
# List recent deployments
az deployment group list -g "$RG" \
  --query "reverse(sort_by([].{Name:name, Time:properties.timestamp, State:properties.provisioningState}, &Time))" \
  -o table

# Redeploy the last known-good deployment
az deployment group create \
  --resource-group "$RG" \
  --template-file "solution-plays/${PLAY}/infra/main.bicep" \
  --parameters "solution-plays/${PLAY}/infra/parameters.${ENV}.json" \
  --name "rollback-$(date +%Y%m%d-%H%M%S)"
```

### Option B: Container App Revision Rollback

```bash
# List revisions
az containerapp revision list -n "$APP_NAME" -g "$RG" -o table

# Activate a previous revision and deactivate current
az containerapp ingress traffic set -n "$APP_NAME" -g "$RG" \
  --revision-weight "ca-frootai-01-dev--prev-rev=100"
```

### Option C: Destroy and Recreate (dev only)

```bash
# Delete the entire resource group — DEV ONLY, never in production
az group delete -n "$RG" --yes --no-wait
```

## Cost Estimation

Estimate monthly cost before deploy:

| Resource | Dev SKU | Dev Cost/mo | Prod SKU | Prod Cost/mo |
|----------|---------|-------------|----------|--------------|
| Azure OpenAI (GPT-4o-mini) | S0, 30K TPM | ~$15 | S0, 120K TPM | ~$150 |
| Azure AI Search | Basic | ~$70 | Standard S1 | ~$250 |
| Container Apps | 0-2 replicas | ~$0-20 | 2-10 replicas | ~$50-200 |
| Azure Monitor | Default | ~$5 | Log Analytics 5GB/day | ~$35 |
| Key Vault | Standard | ~$1 | Standard + HSM | ~$5 |
| **Total estimated** | | **~$90** | | **~$640** |

Use Azure Pricing Calculator for exact numbers: https://azure.microsoft.com/pricing/calculator/

## Multi-Environment Promotion

Promote dev → staging → prod:

```bash
# Deploy to dev
ENV="dev" && RG="rg-frootai-${PLAY}-${ENV}"
az deployment group create -g "$RG" -f infra/main.bicep -p "infra/parameters.dev.json"

# Run evaluation — must pass before promoting
node engine/index.js "solution-plays/${PLAY}/fai-manifest.json" --eval

# Promote to staging (identical infra, higher capacity)
ENV="staging" && RG="rg-frootai-${PLAY}-${ENV}"
az group create -n "$RG" -l "$LOCATION" --tags environment=staging play="$PLAY"
az deployment group create -g "$RG" -f infra/main.bicep -p "infra/parameters.staging.json"

# Promote to production (requires manual approval in CI/CD)
ENV="prod" && RG="rg-frootai-${PLAY}-${ENV}"
az deployment group create -g "$RG" -f infra/main.bicep -p "infra/parameters.prod.json"
```

## Validation

After deploy, verify all:

- [ ] `az resource list -g "$RG" -o table` shows expected resources
- [ ] Health endpoint returns `{"status":"healthy"}`
- [ ] Readiness endpoint confirms all dependencies connected
- [ ] Smoke test query returns a non-empty answer
- [ ] `node engine/index.js <manifest> --eval` — all quality gates pass
- [ ] Resource tags include play, environment, version, and waf fields
- [ ] Azure Monitor shows no error-level alerts

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `InsufficientQuota` on OpenAI | TPM quota exceeded for region | Request quota increase in Azure Portal or switch region |
| `ResourceNotFound` in what-if | Resource group doesn't exist | Run `az group create` (Step 1) first |
| Container App returns 502 | Image pull failed or app crashed | Check `az containerapp logs show -n $APP_NAME -g $RG` |
| Health check timeout | Private endpoint DNS not resolving | Verify VNet integration and DNS zone links |
| Deployment stuck in `Running` | ARM template waiting on dependency | Check deployment operations: `az deployment operation group list -g $RG -n $DEPLOY_NAME` |
| Search index empty after deploy | Indexer hasn't run yet | Trigger manually: `az search indexer run -n <indexer> --service-name <search>` |

## Best Practices

1. **Always run what-if first** — never deploy without previewing changes
2. **Use named deployments** — include timestamp for traceability and rollback
3. **One resource group per play per environment** — isolate cost and resources
4. **Tag everything** — play, environment, version, WAF status, deployment timestamp
5. **Use Managed Identity** — never store keys in env vars or config files
6. **Private Endpoints for all PaaS** — no public network access in production
7. **Evaluate after every deploy** — quality gates are the final step
8. **Parameters in version control** — never hardcode secrets; use Key Vault references
9. **Start small, scale on evidence** — deploy dev SKUs first, right-size from metrics
10. **Automate in CI/CD** — manual deployments are for learning; production uses pipelines
