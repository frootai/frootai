---
name: fai-build-github-workflow
description: |
  Design GitHub Actions workflows with quality gates, OIDC auth, matrix strategies,
  reusable workflows, and staged deployment controls. Use when setting up CI/CD
  for AI applications or infrastructure deployments.
---

# GitHub Actions Workflow Patterns

Build CI/CD workflows with quality gates, secure auth, and staged deployments.

## When to Use

- Setting up CI/CD for a new AI application
- Adding quality gates (lint, test, scan) before deployment
- Implementing staged rollout (dev → staging → prod)
- Using OIDC for keyless Azure authentication

---

## Pattern 1: CI with Quality Gates

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: ruff check .
      - run: pytest --cov=src --cov-report=xml
```

## Pattern 2: OIDC Azure Deploy

```yaml
name: Deploy
on: { push: { branches: [main] } }
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - run: az deployment group create -g rg-prod -f infra/main.bicep
```

## Pattern 3: Reusable Workflow

```yaml
# .github/workflows/deploy-template.yml
on:
  workflow_call:
    inputs:
      environment: { required: true, type: string }
      resource-group: { required: true, type: string }

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - run: az deployment group create -g ${{ inputs.resource-group }} -f infra/main.bicep
```

## Pattern 4: Staged Deployment

```yaml
jobs:
  deploy-dev:
    uses: ./.github/workflows/deploy-template.yml
    with: { environment: dev, resource-group: rg-dev }
    secrets: inherit
  deploy-prod:
    needs: deploy-dev
    uses: ./.github/workflows/deploy-template.yml
    with: { environment: production, resource-group: rg-prod }
    secrets: inherit
```

## Security Checklist

| Check | Requirement |
|-------|-------------|
| Permissions | Least-privilege `permissions:` block |
| Secrets | Use OIDC over stored credentials |
| Action pinning | Pin by SHA, not tag |
| Environments | Require approval for production |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| OIDC login fails | Federated credential missing | Configure in Entra ID app registration |
| Secret not available | Wrong environment scope | Check secret is on correct environment |
| Matrix too slow | Too many combinations | Limit to critical combos, use fail-fast |
