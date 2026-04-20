---
sidebar_position: 6
title: Workflows
description: Multi-step automated processes defined in YAML — orchestrating agents, tools, and evaluation pipelines into reproducible CI/CD-style flows.
---

# Workflows

Workflows are **multi-step automated processes** defined in `.yml` files. They orchestrate agents, tools, and evaluation pipelines into reproducible flows — similar to GitHub Actions but designed for AI-specific operations like evaluation, deployment, and quality gate enforcement.

## What Workflows Do

| Use Case | Example |
|----------|---------|
| **Evaluation** | Run groundedness + relevance + safety checks on every push |
| **Deployment** | Validate → build → deploy → health check → evaluate |
| **Quality Gates** | Block merge if evaluation scores drop below thresholds |
| **Content Sync** | Regenerate marketplace, rebuild knowledge index |
| **Multi-Agent** | Chain builder → reviewer → tuner for solution plays |

## Workflow Structure

Workflows live in `.github/workflows/` (for GitHub Actions) or `workflows/` (for standalone FrootAI workflows):

```yaml title=".github/workflows/evaluate-play.yml"
name: Evaluate Solution Play

on:
  push:
    paths:
      - 'solution-plays/**'
      - 'evaluation/**'
  pull_request:
    paths:
      - 'solution-plays/**'

jobs:
  evaluate:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        play: ['01-enterprise-rag', '03-deterministic-agent', '07-multi-agent']
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Validate manifest
        run: node engine/index.js solution-plays/${{ matrix.play }}/fai-manifest.json --status

      - name: Run FAI Engine evaluation
        run: node engine/index.js solution-plays/${{ matrix.play }}/fai-manifest.json --eval

      - name: Upload evaluation report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: eval-report-${{ matrix.play }}
          path: evaluation/reports/${{ matrix.play }}.json
```

## FrootAI Workflow Types

### Evaluation Workflow

Runs quality checks against solution play guardrails:

```yaml
name: Quality Gate
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run validate:primitives
      - run: node engine/index.js solution-plays/01-enterprise-rag/fai-manifest.json --eval
```

### Deployment Workflow

Validates infrastructure and deploys to Azure:

```yaml
name: Deploy Play
on:
  push:
    branches: [main]
    paths: ['solution-plays/01-*/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate Bicep
        run: az bicep build -f solution-plays/01-enterprise-rag/infra/main.bicep
      - name: What-If Preview
        run: az deployment group what-if --resource-group $RG --template-file infra/main.bicep
      - name: Deploy
        run: az deployment group create --resource-group $RG --template-file infra/main.bicep
```

### Consistency Workflow

Ensures data integrity across all distribution channels:

```yaml
name: Consistency Check
on: [push]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run validate:primitives
      - run: node scripts/validate-consistency.js
      - run: node scripts/sync-content.js --check
```

## Referencing in fai-manifest.json

Wire workflows into a solution play:

```json title="fai-manifest.json"
{
  "primitives": {
    "workflows": [
      "./.github/workflows/evaluate-play.yml",
      "./.github/workflows/deploy.yml"
    ]
  }
}
```

:::tip Conventional Commits
Use conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`) with workflows. This enables automated changelog generation and semantic versioning via the release pipeline.
:::

## Multi-Agent Workflow Pattern

Chain the builder → reviewer → tuner triad:

```yaml
name: Play Lifecycle
on:
  workflow_dispatch:
    inputs:
      play:
        description: 'Play number (e.g., 01)'
        required: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Build phase
        run: echo "Building play ${{ inputs.play }}"

  review:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Review phase
        run: npm run validate:primitives

  tune:
    needs: review
    runs-on: ubuntu-latest
    steps:
      - name: Tune phase
        run: node engine/index.js solution-plays/${{ inputs.play }}-*/fai-manifest.json --eval
```

## Best Practices

1. **Trigger on paths** — only run workflows when relevant files change
2. **Use matrix strategies** — test multiple plays in parallel
3. **Upload artifacts** — save evaluation reports for audit trails
4. **Gate on evaluation** — block merges when quality scores drop
5. **Use conventional commits** — enable automated release flows
6. **Keep workflows focused** — one job per concern (validate, deploy, evaluate)

## See Also

- [Evaluate a Play Guide](/docs/guides/evaluate-play) — evaluation pipeline setup
- [Deploy a Play Guide](/docs/guides/deploy-play) — deployment workflow
- [FAI Protocol](/docs/concepts/fai-protocol) — how workflows wire into plays
