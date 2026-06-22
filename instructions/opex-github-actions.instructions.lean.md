---
description: "GitHub Actions operational excellence — reusable workflows, matrix testing, artifact management."
applyTo: "**/.github/workflows/*.yml"
waf:
  - "operational-excellence"
---

# Operational Excellence — CI/CD — FAI Standards

> Deployment pipeline design, environment protection, deployment gates, rollback automation, DORA metrics, and release management for GitHub Actions workflows.

## Pipeline Stages

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci --ignore-scripts && npm run build
      - uses: actions/upload-artifact@v4
        with: { name: build-${{ github.sha }}, path: dist/, retention-days: 7 }
  test:
    needs: build
    strategy: { matrix: { node: [20, 22] } }
    steps: [{ run: "npm test -- --coverage --ci" }]
  scan:
    needs: build
    steps:
      - uses: github/codeql-action/analyze@v3
      - run: npm audit --audit-level=high
  deploy-staging:
    needs: [test, scan]
    environment: { name: staging }
    steps: [{ run: "az webapp deploy --name $APP_NAME-staging --src-path dist.zip" }]
  deploy-prod:
    needs: deploy-staging
    environment: { name: production }
    steps: [{ run: "az webapp deployment slot swap --name $APP_NAME --slot staging" }]
```

## Environment Protection

- **staging**: auto-approve, branch policy `main, release/*`
- **production**: 2 reviewers, 15-min wait timer, `main` only, deployment gate for Lighthouse + smoke

## Deployment Gates

```yaml
  gate-checks:
    needs: deploy-staging
    steps:
      - run: |
          for ep in /health /api/status; do
            curl -sf "$STAGING_URL$ep" || { echo "FAIL: $ep"; exit 1; }
          done
      - uses: treosh/lighthouse-ci-action@v12
        with: { urls: "${{ env.STAGING_URL }}", budgetPath: .github/lighthouse-budget.json }
      - run: npx artillery run tests/load.yml --target $STAGING_URL --ensure "p99<500"
```

## Rollback & Post-Deploy Verification

```yaml
  post-deploy-verify:
    needs: deploy-prod
    steps:
      - id: verify
        run: |
          for i in $(seq 1 10); do
            curl -sf "$PROD_URL/health" && echo "healthy=true" >> $GITHUB_OUTPUT && exit 0; sleep 15
          done
          echo "healthy=false" >> $GITHUB_OUTPUT
      - if: steps.verify.outputs.healthy != 'true'
        run: |
          az webapp deployment slot swap --name $APP_NAME --slot staging --action reset
          gh issue create --title "Auto-rollback: ${{ github.sha }}" --body "Health check failed."
```

## Infra Validation

```yaml
  infra-validate:
    steps:
      - run: az bicep build --file infra/main.bicep --stdout > /dev/null
      - id: whatif
        run: |
          az deployment group what-if --resource-group $RG_NAME \
            --template-file infra/main.bicep --parameters infra/params/$ENV.bicepparam > whatif.txt
          grep -q "Delete" whatif.txt && echo "has_deletes=true" >> $GITHUB_OUTPUT || true
      - if: steps.whatif.outputs.has_deletes == 'true'
        run: echo "::error::Resource deletions detected. Manual approval required." && exit 1
```

## Dependency Updates & Release Channels

Use Dependabot or Renovate for automated dependency PRs. Pin major versions — auto-merge patch/minor, manual review for major. Tag-driven releases: `-beta`/`-rc` tags → preview channel, clean semver → stable. Generate changelogs with `git-cliff` or `release-please` from conventional commits.

```yaml
  release:
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - id: channel
        run: |
          [[ "${GITHUB_REF#refs/tags/}" == *-beta* || "${GITHUB_REF#refs/tags/}" == *-rc* ]] \
            && echo "prerelease=true" >> $GITHUB_OUTPUT || echo "prerelease=false" >> $GITHUB_OUTPUT
      - uses: orhun/git-cliff-action@v4
        with: { config: cliff.toml, args: --latest --strip header }
      - uses: softprops/action-gh-release@v2
        with: { body_path: CHANGELOG.md, prerelease: "${{ steps.channel.outputs.prerelease }}" }
```

## DORA Metrics & Incident Response

Track deployment frequency, lead time, MTTR, and change failure rate. Post deployment events to a metrics API. On failure: Slack `#incidents` + PagerDuty critical alert.

```yaml
  dora-metrics:
    if: always()
    needs: [deploy-prod, post-deploy-verify]
    steps:
      - run: |
          curl -X POST "$METRICS_ENDPOINT/deployments" -H "Content-Type: application/json" \
            -d '{"sha":"${{ github.sha }}","result":"${{ needs.post-deploy-verify.result }}"}'
      - if: needs.post-deploy-verify.result == 'failure'
        run: curl -X POST "$SLACK_WEBHOOK" -d '{"text":"Deploy failed. Auto-rollback executed."}'
```

## Anti-Patterns

- ❌ Single-stage pipeline — no isolation, no rollback point
- ❌ `if: always()` on deploy steps — deploys broken builds
- ❌ No environment protection — any contributor can push to prod
- ❌ Manual rollback — MTTR hours vs seconds
- ❌ Skipping what-if — accidental resource deletion
- ❌ `npm install` vs `npm ci` — non-reproducible builds
- ❌ No artifact pinning — staging tests build A, prod deploys build B

## WAF Alignment

| Pillar | CI/CD Practice |
| --- | --- |
| **Reliability** | Automated rollback, slot swap zero-downtime, retry on transient errors |
| **Security** | CodeQL + Trivy scan stage, `npm audit`, OIDC auth (no stored creds) |
| **Cost Optimization** | Artifact retention 7 days, parallel matrix shards, self-hosted GPU runners |
| **Operational Excellence** | DORA metrics, deployment frequency dashboards, conventional commits |
| **Performance Efficiency** | Lighthouse budget gates, Artillery p99 thresholds, dependency caching |
| **Responsible AI** | Eval pipeline gate before AI deploy, content safety regression tests |
