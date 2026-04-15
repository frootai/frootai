---
name: fai-github-actions-ai-pipeline
description: "Build GitHub Actions AI pipelines with build, test, safety, evaluation, and deployment approval gates."
---

# GitHub Actions AI Pipeline

## Pipeline Goals

- Validate code quality and tests
- Run AI-specific evaluation and safety checks
- Enforce approval before production deployment

## Reference Workflow

```yaml
name: ai-ci-cd
on:
  pull_request:
  push:
    branches: [main]

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test

  ai-eval:
    runs-on: ubuntu-latest
    needs: build-test
    steps:
      - uses: actions/checkout@v4
      - run: python evaluation/run_eval.py --threshold-file evaluation/thresholds.json

  deploy-prod:
    if: github.ref == 'refs/heads/main'
    needs: ai-eval
    environment: production
    runs-on: ubuntu-latest
    steps:
      - run: echo "deploy"
```

## Required Gates

| Gate | Requirement |
|------|-------------|
| Unit/integration tests | Pass |
| AI quality eval | Meets thresholds |
| Safety eval | No blocking violations |
| Secrets scan | Pass |
| Production deploy | Manual approval |

## Hardening

- Use OIDC over long-lived cloud secrets.
- Pin third-party actions to trusted SHAs.
- Split CI and CD permissions.
- Upload eval artifacts for auditability.

## Troubleshooting

| Issue | Cause | Fix |
|------|-------|-----|
| Eval gate flaky | Non-deterministic dataset | Pin test set and seeds |
| Secret leakage risk | Plain env secrets | Move to OIDC + key vault references |
| Deploy race conditions | Concurrent runs | Use workflow concurrency control |

## Advanced Implementation Notes

### Operational Guardrails

- Define measurable SLOs before rollout.
- Capture baseline metrics and compare deltas post-change.
- Add alert thresholds with explicit on-call ownership.
- Use environment-specific overrides for dev/staging/prod.

### CI/CD and Validation Expansion

```bash
# Example verification sequence
npm run lint
npm test
npm run build
```

```json
{
  "quality_gate": {
    "required": true,
    "min_score": 0.8,
    "block_on_failure": true
  }
}
```

### Security and Compliance Checks

| Control | Requirement |
|--------|-------------|
| Secret handling | No plaintext secrets in repo |
| Access model | Least privilege role assignments |
| Logging | Redact sensitive data before persistence |
| Auditability | Keep immutable trace of critical actions |

### Performance and Cost Notes

- Budget requests and tokens per endpoint/class of workload.
- Profile p95 and p99 latency as separate objectives.
- Add caching only where correctness is preserved.
- Use periodic reports to catch drift in cost/quality.

### Extended Troubleshooting

| Symptom | Likely Cause | Recommended Action |
|--------|--------------|--------------------|
| Validation gate failures | Threshold too strict or wrong baseline | Recalibrate using a fixed reference dataset |
| Unexpected regressions | Missing scenario coverage | Add targeted regression tests and rerun |
| Production-only issues | Environment mismatch | Diff environment config and identity settings |
| Slow recovery during incidents | Unclear ownership/runbook steps | Add explicit owner and sequence in runbook |
