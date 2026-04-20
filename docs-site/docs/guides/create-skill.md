---
sidebar_position: 2
title: Create a Skill
description: Build a standalone skill folder with SKILL.md — a self-contained, reusable procedure that Copilot can invoke on demand.
---

# Create a Skill

Build a complete skill folder with `SKILL.md`, optional bundled assets, play wiring, and validation.

## Prerequisites

- FrootAI repo cloned
- Node.js 22+
- VS Code with GitHub Copilot Chat

## Step 1: Choose a Skill Name

Use kebab-case. The folder name **must match** the `name` field in SKILL.md frontmatter:

```bash
SKILL_NAME="fai-deploy-container-app"
```

## Step 2: Scaffold with the CLI

```bash
node scripts/scaffold-primitive.js skill
```

Follow the prompts:
- **Name:** `fai-deploy-container-app` (kebab-case)
- **Description:** "Deploy a FrootAI play to Azure Container Apps with Bicep" (10–1024 chars)

Or create manually:

```bash
mkdir -p skills/${SKILL_NAME}
```

## Step 3: Understand Folder Structure

```
skills/
  fai-deploy-container-app/
    SKILL.md                    # Required — the skill procedure
    templates/                  # Optional — scaffolding templates
    scripts/                    # Optional — automation scripts
    examples/                   # Optional — example outputs
```

:::info Size Limit
Bundled assets should total under 5MB per skill folder.
:::

## Step 4: Write the Frontmatter

```yaml title="SKILL.md"
---
name: "fai-deploy-container-app"
description: "Deploys a FrootAI solution play to Azure Container Apps with managed identity, Key Vault integration, and health probes."
---
```

| Field | Required | Validation |
|-------|----------|------------|
| `name` | ✅ | Must be kebab-case, must match parent folder name exactly |
| `description` | ✅ | 10–1024 characters |

## Step 5: Write the Skill Body

A good skill has numbered steps, runnable code blocks, verification checks, and a troubleshooting table. Aim for **150+ lines**:

```markdown
# Deploy to Azure Container Apps

## Purpose
Deploy any FrootAI solution play as a containerized service on Azure Container Apps.

## Prerequisites
- Azure CLI installed and logged in (`az login`)
- Docker installed
- Azure subscription with Contributor access

## Step 1: Set Environment Variables
​```bash
PLAY_NUM="01"
RG="rg-frootai-${PLAY_NAME}"
LOCATION="eastus2"
​```

## Step 2: Create Resources
​```bash
az group create --name $RG --location $LOCATION
az acr create --name $ACR_NAME --resource-group $RG --sku Basic
​```

## Verification
1. Health endpoint returns 200
2. Container app has 1+ running replicas

## Troubleshooting
| Problem | Cause | Fix |
|---------|-------|-----|
| Image pull fails | ACR auth not configured | Enable managed identity |
```

## Step 6: Add Bundled Scripts (Optional)

Skills can bundle executable scripts:

```bash title="scripts/deploy.sh"
#!/usr/bin/env bash
set -euo pipefail

PLAY_NUM="${1:?Usage: deploy.sh <play-num> <play-name> <location>}"
PLAY_NAME="${2:?}"
LOCATION="${3:-eastus2}"

echo "Deploying Play ${PLAY_NUM}: ${PLAY_NAME} to ${LOCATION}..."
az group create --name "rg-frootai-${PLAY_NAME}" --location "$LOCATION" --output none
echo "✅ Deployment complete"
```

## Step 7: Wire into a Play

```json title="fai-manifest.json"
{
  "primitives": {
    "skills": ["../../skills/fai-deploy-container-app/"]
  }
}
```

## Step 8: Validate

```bash
npm run validate:primitives
```

## Naming Conventions

| Pattern | Example | Use Case |
|---------|---------|----------|
| `fai-build-*` | `fai-build-rag-pipeline` | Create from scratch |
| `fai-deploy-*` | `fai-deploy-container-app` | Deploy to Azure |
| `fai-evaluate-*` | `fai-evaluate-rag-quality` | Run evaluation |
| `fai-scaffold-*` | `fai-scaffold-play` | Generate boilerplate |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "name doesn't match folder" | Make `name` and folder identical |
| "description too short" | Expand to a full sentence (10+ chars) |
| Copilot doesn't find the skill | Move to `skills/fai-your-skill/SKILL.md` |
| Plugin doesn't list the skill | Use `../../skills/fai-your-skill/` with trailing slash |

## See Also

- [Skills Reference](/docs/primitives/skills) — full skill specification
- [Package a Plugin](/docs/guides/package-plugin) — bundle skills into plugins
