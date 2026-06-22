---
description: "GitHub Actions CI/CD standards — SHA-pinned actions, minimal permissions, secrets handling, and reusable workflows."
applyTo: "**/.github/workflows/*.yml"
waf:
  - "security"
  - "operational-excellence"
---

# GitHub Actions — FAI Standards

## Reusable Workflows & Composite Actions

Extract shared CI into `workflow_call` workflows. Package multi-step logic into composite actions with typed inputs.

```yaml
# .github/workflows/reusable-deploy.yml
on:
  workflow_call:
    inputs:
      environment: { required: true, type: string }
      resource-group: { required: true, type: string }
    secrets:
      AZURE_CLIENT_ID: { required: true }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    permissions: { id-token: write, contents: read }
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: azure/login@a65d910e8af852a8061c627c456678983e180302 # v2.2.0
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      - run: az deployment group create -g ${{ inputs.resource-group }} -f infra/main.bicep
```

## OIDC for Azure — No Secrets

Never store `AZURE_CLIENT_SECRET`. Use workload identity federation — requires `id-token: write`. Register federated credential in Entra ID with subject `repo:<owner>/<repo>:environment:<env-name>`.

```yaml
permissions: { id-token: write, contents: read }
steps:
  - uses: azure/login@a65d910e8af852a8061c627c456678983e180302 # v2.2.0
    with:
      client-id: ${{ secrets.AZURE_CLIENT_ID }}
      tenant-id: ${{ vars.AZURE_TENANT_ID }}
      subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

## Security — Pinned Actions & Permissions

Pin every action to full SHA — tags are mutable. Set `permissions: read-all` at workflow level, override per-job with least privilege. Set `CODEOWNERS` on `.github/workflows/`.

```yaml
permissions: read-all
jobs:
  build:
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with: { node-version-file: .nvmrc, cache: npm }
```

## Concurrency, Matrix & Job Dependencies

```yaml
# Cancel stale PR builds, never cancel deploys
concurrency: { group: "ci-${{ github.ref }}", cancel-in-progress: true }

jobs:
  test:
    strategy:
      fail-fast: false
      matrix: { os: [ubuntu-latest, windows-latest], node: [20, 22] }
    runs-on: ${{ matrix.os }}
    timeout-minutes: 15
    steps:
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with: { node-version: "${{ matrix.node }}", cache: npm }

  build:
    needs: test
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - id: meta
        run: echo "tags=sha-${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"

  deploy-prod:
    needs: [build, integration-tests]
    environment: { name: production, url: "https://app.example.com" }
    if: github.ref == 'refs/heads/main'
```

Set `timeout-minutes` on every job. Use `needs` for ordering, `GITHUB_OUTPUT` for passing data.
## Caching & Artifacts

Prefer built-in caching on setup actions. Use `actions/cache` for custom paths. Short artifact retention to control costs.
```yaml
- uses: actions/cache@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3
  with:
    path: ~/.cache/pip
    key: pip-${{ runner.os }}-${{ hashFiles('**/requirements.txt') }}
    restore-keys: pip-${{ runner.os }}-

- uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
  with: { name: build-output, path: "dist/", retention-days: 5, if-no-files-found: error }
```

## Environment Protection & workflow_dispatch

Gate deploys with required reviewers, wait timers, and branch restrictions (Settings → Environments). Typed `workflow_dispatch` inputs for manual triggers.
```yaml
on:
  workflow_dispatch:
    inputs:
      environment: { type: choice, options: [dev, staging, production], default: dev }
      dry-run: { type: boolean, default: true }
```

## Self-Hosted Runner Hardening

- Ephemeral runners (`--ephemeral`) — fresh VM per job, no state leakage, no long-lived credentials
- Network-isolate in dedicated VNET/subnet, use runner groups with org-level restrictions
- Pin `runs-on` to labeled groups (`runs-on: [self-hosted, linux, gpu]`), never bare `self-hosted`

## Anti-Patterns

- ❌ `secrets.AZURE_CLIENT_SECRET` — use OIDC federated credentials
- ❌ `actions/checkout@v4` — mutable tag, pin to full SHA
- ❌ `permissions: write-all` — least privilege per job
- ❌ `continue-on-error: true` on security steps — masks failures
- ❌ Workflow-level `env:` for secrets — scope to the job that needs them
- ❌ Missing `concurrency` on deploy workflows — race conditions
- ❌ Caching `node_modules/` directly — cache lockfile hash instead
- ❌ `runs-on: self-hosted` without group labels — any runner picks up

## WAF Alignment

| Pillar | GitHub Actions Practice |
|--------|------------------------|
| **Security** | SHA-pinned actions, OIDC, `permissions: read-all`, Dependabot for actions, `CODEOWNERS` on workflows |
| **Reliability** | `fail-fast: false`, `timeout-minutes` on every job, `if: failure()` notifications, environment protection gates |
| **Cost** | Built-in cache on setup actions, short artifact retention, concurrency cancellation, ephemeral self-hosted runners |
| **Ops Excellence** | `workflow_call` reusable workflows, composite actions, `GITHUB_OUTPUT` chaining, status checks as branch protection |
| **Performance** | Parallel matrix jobs, dependency caching, artifact passing vs rebuilding, `paths` filter to skip irrelevant workflows |
