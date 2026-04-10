# AI-Powered Deployment Workflow — Document Understanding V2

> Layer 3 — Agentic Workflow. Compiles to GitHub Actions for automated Azure deployment.

## Trigger
On push to `main` branch after PR merge, when files in `solution-plays/38-document-understanding-v2/infra/` are modified.

## Steps

1. **Checkout** the main branch
2. **Validate Bicep**: Run `az bicep build` to verify template syntax
3. **Validate configs**: Run `tune-config.sh` to verify production readiness
4. **Deploy to staging**: Deploy to staging resource group first
5. **Smoke test**: Run health check against staging endpoint
6. **Evaluate**: Run `evaluation/eval.py` against staging
7. **Deploy to production**: If staging passes all quality gates
8. **Post-deploy verification**: Verify all endpoints respond correctly

## Quality Gates
- Bicep compiles without errors
- All config JSON files parse correctly
- Content safety enabled in guardrails.json
- Groundedness ≥ 0.85
- Safety = 0 failures
- Cost per query ≤ $0.05

## Compiled GitHub Action

```yaml
name: AI Deploy — Document Understanding V2
on:
  push:
    branches: [main]
    paths: ['solution-plays/38-document-understanding-v2/infra/**']

permissions:
  contents: read
  id-token: write

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate Bicep
        run: az bicep build --file solution-plays/38-document-understanding-v2/infra/main.bicep
      - name: Validate Configs
        run: |
          for f in solution-plays/38-document-understanding-v2/config/*.json; do
            python3 -c "import json; json.load(open('$f'))"
          done

  deploy-staging:
    needs: validate
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - name: Deploy to Staging
        run: |
          az deployment group create \
            --resource-group rg-document-understanding-v2-staging \
            --template-file solution-plays/38-document-understanding-v2/infra/main.bicep \
            --parameters solution-plays/38-document-understanding-v2/infra/parameters.json

  evaluate:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install azure-ai-evaluation openai
      - name: Run Evaluation
        run: python solution-plays/38-document-understanding-v2/evaluation/eval.py
        env:
          AZURE_OPENAI_ENDPOINT: ${{ secrets.AZURE_OPENAI_ENDPOINT }}

  deploy-production:
    needs: evaluate
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - name: Deploy to Production
        run: |
          az deployment group create \
            --resource-group rg-document-understanding-v2 \
            --template-file solution-plays/38-document-understanding-v2/infra/main.bicep \
            --parameters solution-plays/38-document-understanding-v2/infra/parameters.json \
            --parameters environment=prod
```
