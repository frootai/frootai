# Recipe 10: Create a Custom Skill

> Build a standalone skill folder with `SKILL.md` — a self-contained, reusable capability that Copilot can invoke on demand.

## What You'll Build

A complete skill folder with `SKILL.md`, optional assets, play wiring, and validation. You’ll write a multi-step procedure that teaches Copilot a specific task, test it interactively, and publish it to the marketplace.

## What Are Skills?

Skills are **multi-step procedures** that teach Copilot how to accomplish a specific task. Unlike instructions (passive coding standards) or agents (interactive personas), skills are invoked on demand and guide Copilot through concrete steps.

| Aspect | Instruction | Agent | Skill |
|--------|-------------|-------|-------|
| Activation | Auto by glob | User invokes `@agent` | User invokes or agent delegates |
| Content | Rules and standards | Personality + tools | Step-by-step procedure |
| Structure | Single `.md` file | Single `.agent.md` file | Folder with `SKILL.md` |
| Purpose | "How to write code" | "Who answers" | "How to accomplish a task" |
| Assets | None | None | Optional templates, scripts, examples |

## Prerequisites

- FrootAI repo cloned
- Node.js 22+ (validation/scaffolding)
- VS Code with GitHub Copilot Chat

## Steps

### 1. Choose a skill name

Use kebab-case with `frootai-`; the folder name **must match** the `name` field in SKILL.md frontmatter:

```bash
SKILL_NAME="frootai-deploy-container-app"
```

### 2. Scaffold with the CLI

```bash
node scripts/scaffold-primitive.js skill
```

Use:
- **Name:** `frootai-deploy-container-app` (kebab-case, `frootai-` prefix)
- **Description:** "Deploy a FrootAI play to Azure Container Apps with Bicep" (10–1024 chars)

This creates the folder automatically. Or create it manually:

```bash
mkdir -p skills/${SKILL_NAME}
```

### 3. Understand the skill folder structure

```
skills/
  frootai-deploy-container-app/
    SKILL.md                    # Required — the skill procedure
    templates/                  # Optional — scaffolding templates
      container-app.bicep
      env-template.json
    scripts/                    # Optional — automation scripts
      deploy.sh
    examples/                   # Optional — example outputs
      successful-deployment.md
```

**Size limit:** Bundled assets should total under 5MB.

### 4. Write the SKILL.md frontmatter

```yaml
---
name: "frootai-deploy-container-app"
description: "Deploys a FrootAI solution play to Azure Container Apps with managed identity, Key Vault integration, and health probes."
---
```

| Field | Required | Validation |
|-------|----------|------------|
| `name` | Yes | Must be kebab-case, must match parent folder name exactly |
| `description` | Yes | 10–1024 characters |

### 5. Write the complete skill body

A good skill has numbered steps, runnable code blocks, verification checks, and a troubleshooting table. Example:

```markdown
---
name: "frootai-deploy-container-app"
description: "Deploys a FrootAI solution play to Azure Container Apps with managed identity, Key Vault integration, and health probes."
---

# Deploy to Azure Container Apps

## Purpose

Deploy any FrootAI solution play as a containerized service on Azure Container
Apps with production-grade configuration: managed identity for auth, Key Vault
for secrets, health probes for reliability, and Application Insights for
observability.

## Prerequisites

- Azure CLI installed and logged in (`az login`)
- Docker installed (for building the container image)
- A solution play with a `Dockerfile` in `src/`
- Azure subscription with Contributor access

## Step 1: Set Environment Variables

```bash
PLAY_NUM="01"
PLAY_NAME="enterprise-rag"
RG="rg-frootai-${PLAY_NAME}"
LOCATION="eastus2"
ACR_NAME="acrfrootai${PLAY_NUM}"
APP_NAME="ca-${PLAY_NAME}"
ENV_NAME="cae-frootai"
```

## Step 2: Create the Resource Group and Container Registry

```bash
az group create --name $RG --location $LOCATION
az acr create --name $ACR_NAME --resource-group $RG --sku Basic --admin-enabled false
```

## Step 3: Build and Push the Container Image

```bash
cd solution-plays/${PLAY_NUM}-${PLAY_NAME}/src
az acr build --registry $ACR_NAME --image ${PLAY_NAME}:latest .
```

## Step 4: Deploy with Bicep

```bash
az deployment group create \
  --resource-group $RG \
  --template-file ../infra/main.bicep \
  --parameters \
    appName=$APP_NAME \
    environmentName=$ENV_NAME \
    registryName=$ACR_NAME \
    imageName="${ACR_NAME}.azurecr.io/${PLAY_NAME}:latest"
```

## Step 5: Verify Deployment

```bash
# Check container app status
az containerapp show --name $APP_NAME --resource-group $RG --query "properties.runningStatus"

# Test health endpoint
APP_URL=$(az containerapp show --name $APP_NAME --resource-group $RG --query "properties.configuration.ingress.fqdn" -o tsv)
curl -s "https://${APP_URL}/health" | jq .
```

Expected output:
```json
{"status": "healthy", "version": "1.0.0", "play": "01-enterprise-rag"}
```

## Step 6: Enable Application Insights

```bash
az containerapp update --name $APP_NAME --resource-group $RG \
  --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=secretref:appinsights-cs"
```

## Verification

Run these checks to confirm a successful deployment:

1. Health endpoint returns 200: `curl -sf https://${APP_URL}/health`
2. Container app has 1+ running replicas: `az containerapp replica list ...`
3. Application Insights receiving telemetry: check the Azure Portal

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Image pull fails | ACR auth not configured | Enable managed identity on Container App, grant AcrPull role |
| Health probe fails | Wrong port or path | Check `main.bicep` targetPort matches Dockerfile EXPOSE |
| 503 on ingress | App crashing on startup | Check logs: `az containerapp logs show --name $APP_NAME -g $RG` |
| Key Vault access denied | Missing RBAC | Grant Key Vault Secrets User to the Container App identity |
```

### 6. Skill naming conventions

| Pattern | Example | Use Case |
|---------|---------|----------|
| `frootai-build-*` | `frootai-build-rag-pipeline` | Create something from scratch |
| `frootai-deploy-*` | `frootai-deploy-container-app` | Deploy to Azure |
| `frootai-evaluate-*` | `frootai-evaluate-rag-quality` | Run quality evaluation |
| `frootai-tune-*` | `frootai-tune-model-params` | Optimize configurations |
| `frootai-scaffold-*` | `frootai-scaffold-play` | Generate boilerplate |
| `frootai-mcp-*` | `frootai-mcp-add-tool` | MCP server operations |
| `frootai-migrate-*` | `frootai-migrate-to-v2` | Version migrations |
| `frootai-debug-*` | `frootai-debug-context-wiring` | Diagnostic procedures |

### 7. Add bundled scripts (optional)

Skills can bundle executable scripts Copilot runs during execution:

**scripts/deploy.sh:**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy.sh <play-number> <play-name> <location>
PLAY_NUM="${1:?Usage: deploy.sh <play-num> <play-name> <location>}"
PLAY_NAME="${2:?}"
LOCATION="${3:-eastus2}"

RG="rg-frootai-${PLAY_NAME}"
ACR_NAME="acrfrootai${PLAY_NUM}"

echo "Deploying Play ${PLAY_NUM}: ${PLAY_NAME} to ${LOCATION}..."

az group create --name "$RG" --location "$LOCATION" --output none
az acr create --name "$ACR_NAME" --resource-group "$RG" --sku Basic --output none

echo "Building container image..."
az acr build --registry "$ACR_NAME" \
  --image "${PLAY_NAME}:latest" \
  "solution-plays/${PLAY_NUM}-${PLAY_NAME}/src"

echo "Deploying infrastructure..."
az deployment group create \
  --resource-group "$RG" \
  --template-file "solution-plays/${PLAY_NUM}-${PLAY_NAME}/infra/main.bicep" \
  --output none

echo "✅ Deployment complete"
```

### 8. Wire into a plugin (optional)

Reference your skill in a plugin's `plugin.json`:

```json
{
  "name": "container-app-deployer",
  "description": "Deploy FrootAI plays to Azure Container Apps",
  "version": "1.0.0",
  "author": { "name": "FrootAI" },
  "license": "MIT",
  "skills": ["../../skills/frootai-deploy-container-app/"],
  "agents": [],
  "instructions": []
}
```

### 9. Wire into a play manifest (optional)

Reference play-specific skills in the play's `fai-manifest.json`:

```json
{
  "primitives": {
    "skills": [
      "./.github/skills/run-semantic-review/",
      "../../skills/frootai-deploy-container-app/"
    ]
  }
}
```

### 10. Validate

```bash
# Run the full primitive validator
npm run validate:primitives

# Verify skill structure manually
node -e "
const fs = require('fs');
const path = require('path');
const skillDir = 'skills/frootai-deploy-container-app';
const skillFile = path.join(skillDir, 'SKILL.md');

if (!fs.existsSync(skillDir)) { console.log('❌ Skill folder missing'); process.exit(1); }
if (!fs.existsSync(skillFile)) { console.log('❌ SKILL.md missing'); process.exit(1); }

const content = fs.readFileSync(skillFile, 'utf8');
const parts = content.split('---');
if (parts.length < 3) { console.log('❌ Missing frontmatter'); process.exit(1); }

const fm = parts[1];
const nameMatch = fm.match(/name:\s*['\"]?([^'\"\n]+)/);
const descMatch = fm.match(/description:\s*['\"]?([^'\"\n]+)/);
const folderName = path.basename(skillDir);

if (!nameMatch) { console.log('❌ Missing name field'); process.exit(1); }
if (!descMatch) { console.log('❌ Missing description field'); process.exit(1); }
if (nameMatch[1].trim() !== folderName) {
  console.log('❌ name \"' + nameMatch[1].trim() + '\" does not match folder \"' + folderName + '\"');
  process.exit(1);
}

const desc = descMatch[1].trim();
if (desc.length < 10 || desc.length > 1024) {
  console.log('❌ Description length ' + desc.length + ' outside 10-1024 range');
  process.exit(1);
}

console.log('✅ Skill is valid');
console.log('   Name: ' + nameMatch[1].trim());
console.log('   Desc: ' + desc.substring(0, 60) + '...');
"
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Validator: "name doesn't match folder" | `name` in frontmatter differs from folder | Make them identical (both kebab-case) |
| Validator: "description too short" | Under 10 characters | Expand to a full sentence |
| Copilot doesn't find the skill | Skill not in `skills/` root | Move to `skills/frootai-your-skill/SKILL.md` |
| Bundled script won't execute | Missing `chmod +x` | Add `chmod +x scripts/deploy.sh` to Step 1 |
| Plugin doesn't list the skill | Path wrong in plugin.json | Use `../../skills/frootai-your-skill/` with trailing slash |

## Best Practices

1. **One task per skill** — "Deploy to Container Apps" not "Deploy + Monitor + Scale"
2. **Number your steps** — sequential, each building on the previous
3. **Include verification** — every skill ends with a way to confirm success
4. **Show, don't tell** — runnable code blocks, not abstract descriptions
5. **Add troubleshooting** — the 5 most common errors users will hit
6. **Keep steps atomic** — each step should be completable independently
7. **Bundle sparingly** — only include assets the skill actually references
8. **Name matches folder** — the `name` frontmatter field must equal the parent folder name exactly
