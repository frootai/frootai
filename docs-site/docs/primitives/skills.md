---
sidebar_position: 3
title: Skills
description: Multi-step procedures in SKILL.md folders that teach Copilot how to accomplish specific tasks — from deployment to evaluation to debugging.
---

# Skills

Skills are **multi-step procedures** that teach Copilot how to accomplish a specific task. Unlike instructions (passive coding standards) or agents (interactive personas), skills are invoked on demand and guide Copilot through a sequence of concrete actions.

## How Skills Differ

| Aspect | Instruction | Agent | Skill |
|--------|-------------|-------|-------|
| Activation | Auto by glob | User invokes `@agent` | User invokes or agent delegates |
| Content | Rules and standards | Personality + tools | Step-by-step procedure |
| Structure | Single `.md` file | Single `.agent.md` file | Folder with `SKILL.md` |
| Purpose | "How to write code" | "Who answers" | "How to accomplish a task" |
| Assets | None | None | Optional templates, scripts, examples |

## Folder Structure

Every skill lives in its own folder under `skills/`. The folder name **must match** the `name` field in the SKILL.md frontmatter:

```
skills/
  fai-deploy-container-app/
    SKILL.md                    # Required — the skill procedure
    templates/                  # Optional — scaffolding templates
      container-app.bicep
    scripts/                    # Optional — automation scripts
      deploy.sh
    examples/                   # Optional — example outputs
      successful-deployment.md
```

:::warning Name Must Match Folder
The `name` field in SKILL.md frontmatter must exactly equal the parent folder name. Validation will reject mismatches.
:::

## Frontmatter Schema

```yaml title="skills/fai-deploy-container-app/SKILL.md"
---
name: "fai-deploy-container-app"
description: "Deploys a FrootAI solution play to Azure Container Apps with managed identity, Key Vault integration, and health probes."
---
```

| Field | Required | Validation |
|-------|----------|------------|
| `name` | ✅ | Must be kebab-case, must match parent folder name |
| `description` | ✅ | 10–1024 characters |

## Writing a Complete Skill

A production skill has numbered steps, runnable code blocks, verification checks, and a troubleshooting table. Skills should be **150+ lines** with detailed guidance:

```markdown title="skills/fai-deploy-container-app/SKILL.md"
---
name: "fai-deploy-container-app"
description: "Deploys a FrootAI solution play to Azure Container Apps with managed identity, Key Vault integration, and health probes."
---

# Deploy to Azure Container Apps

## Purpose

Deploy any FrootAI solution play as a containerized service on Azure Container Apps.

## Prerequisites

- Azure CLI installed and logged in (`az login`)
- Docker installed (for building the container image)
- Azure subscription with Contributor access

## Step 1: Set Environment Variables

​```bash
PLAY_NUM="01"
PLAY_NAME="enterprise-rag"
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
| Health probe fails | Wrong port or path | Check Bicep targetPort |
```

## Naming Conventions

| Pattern | Example | Use Case |
|---------|---------|----------|
| `fai-build-*` | `fai-build-rag-pipeline` | Create something from scratch |
| `fai-deploy-*` | `fai-deploy-container-app` | Deploy to Azure |
| `fai-evaluate-*` | `fai-evaluate-rag-quality` | Run quality evaluation |
| `fai-tune-*` | `fai-tune-model-params` | Optimize configurations |
| `fai-scaffold-*` | `fai-scaffold-play` | Generate boilerplate |
| `fai-debug-*` | `fai-debug-context-wiring` | Diagnostic procedures |

All folder and file names must be **lowercase-hyphen**.

## Bundled Assets

Skills can optionally include templates, scripts, and examples:

```
fai-deploy-container-app/
  SKILL.md               # Required
  templates/              # Bicep, JSON, YAML templates
  scripts/                # Executable scripts (bash, PowerShell)
  examples/               # Example outputs for reference
```

:::info Size Limit
Bundled assets should total under 5MB per skill folder.
:::

## Wiring into Plays and Plugins

Reference skills in a play's `fai-manifest.json`:

```json
{
  "primitives": {
    "skills": [
      "../../skills/fai-deploy-container-app/",
      "./.github/skills/run-semantic-review/"
    ]
  }
}
```

Or in a plugin's `plugin.json`:

```json
{
  "skills": ["../../skills/fai-deploy-container-app/"]
}
```

## Validation

```bash
npm run validate:primitives
```

Checks that every skill has:
- `name` matching parent folder name (kebab-case)
- `description` between 10–1024 characters
- `SKILL.md` file exists in the folder

## See Also

- [Create a Skill Guide](/docs/guides/create-skill) — step-by-step tutorial
- [Plugins](/docs/primitives/plugins) — bundle skills into distributable packages
- [Primitives Overview](/docs/concepts/primitives) — all 6 primitive types
