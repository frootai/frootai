---
name: fai-feature-flag-ai
description: "Implement AI feature flags with progressive rollout, kill switches, audience targeting, and evaluation-driven promotion."
---

# Feature Flag AI

## Goal

Safely ship AI capabilities with controlled exposure and fast rollback.

## Flag Model

```json
{
  "flag": "ai_summarization_v2",
  "enabled": false,
  "rollout": {
    "percentage": 5,
    "strategy": "sticky-user",
    "segments": ["internal", "beta-customers"]
  },
  "kill_switch": true,
  "expires_on": "2026-12-31"
}
```

## Rollout Stages

| Stage | Traffic | Gate |
|------|---------|------|
| Canary | 1-5% | No critical safety or latency regressions |
| Beta | 10-25% | Quality metrics stable |
| Broad | 50-100% | Cost and reliability within targets |

## Runtime Guard

```ts
if (!flags.isEnabled('ai_summarization_v2', userContext)) {
  return fallbackSummary(text);
}
return aiSummary(text);
```

## Promotion Rules

- Promote only if:
  - Quality >= baseline + 3%
  - Safety violations do not increase
  - P95 latency within SLO
  - Cost/request within budget

## Rollback Rules

- Trigger immediate disable if:
  - Safety incident severity high
  - Error rate exceeds threshold
  - Budget spike beyond cap

## Validation Checklist

| Check | Expected |
|------|----------|
| Kill switch works | Immediate disable in runtime |
| Sticky assignment | User sees stable variant |
| Audit log | Flag changes recorded |
| Expiry policy | Old flags cleaned up |

## Troubleshooting

| Issue | Cause | Fix |
|------|-------|-----|
| Inconsistent user experience | Non-sticky assignment | Enable sticky strategy by user id |
| Flag debt accumulation | No expiry process | Add expires_on and monthly cleanup |
| Unsafe full rollout | Missing gates | Enforce promotion checks before percentage increase |

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
