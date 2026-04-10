# AI-Powered Deployment Workflow

> Layer 3 — Agentic Workflow. Compiles to GitHub Actions for automated Azure deployment.

## Trigger
On push to `main` branch after PR merge, when files in `solution-plays/01-enterprise-rag/infra/` are modified.

## Steps

1. **Checkout** the main branch
2. **Validate Bicep**: Run `az bicep build` to verify template syntax
3. **Validate configs**: Run `tune-config.sh` to verify production readiness
4. **Deploy to staging**: Deploy to staging resource group first
5. **Smoke test**: Run health check against staging endpoint
6. **Deploy to production**: If staging passes, deploy to production
7. **Post-deploy verification**: Verify all endpoints respond correctly

## Permissions
- read: contents
- write: deployments

## Environment Protection
- Staging: auto-deploy on merge
- Production: requires manual approval

## Compiled GitHub Action

```yaml
name: AI Deploy
on:
  push:
    branches: [main]
    paths: ['solution-plays/01-enterprise-rag/infra/**']

permissions:
  contents: read
  id-token: write  # For Azure OIDC auth

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Validate Bicep
        run: az bicep build --file solution-plays/01-enterprise-rag/infra/main.bicep

      - name: Deploy to Staging
        run: |
          az deployment group create \
            --resource-group rg-enterprise-rag-staging \
            --template-file solution-plays/01-enterprise-rag/infra/main.bicep \
            --parameters solution-plays/01-enterprise-rag/infra/parameters.json

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval
    steps:
      - uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy to Production
        run: |
          az deployment group create \
            --resource-group rg-enterprise-rag \
            --template-file solution-plays/01-enterprise-rag/infra/main.bicep \
            --parameters solution-plays/01-enterprise-rag/infra/parameters.json
```
