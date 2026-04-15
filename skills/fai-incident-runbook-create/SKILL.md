---
name: fai-incident-runbook-create
description: "Create incident runbooks for AI failures with severity policy, triage workflow, communication templates, and recovery steps."
---

# Incident Runbook Create

## Purpose

Provide deterministic response steps for AI system incidents to reduce MTTR and communication chaos.

## Severity Policy

| Severity | Definition | Target Response |
|---------|------------|-----------------|
| Sev0 | Full outage or critical harm risk | 15 min |
| Sev1 | Major degradation, high user impact | 30 min |
| Sev2 | Partial impact or workaround exists | 2 hours |
| Sev3 | Low impact | Next business day |

## Runbook Structure

1. Detection signals
2. Triage questions
3. Immediate containment steps
4. Diagnosis checklist
5. Recovery sequence
6. Communication cadence
7. Post-incident actions

## Example Containment Block

```md
If safety violations exceed threshold:
- Enable kill switch for impacted AI feature.
- Route traffic to fallback model.
- Freeze deployments.
- Notify incident channel and on-call lead.
```

## Communication Template

```md
Status Update
- Incident: <id>
- Severity: <sev>
- User impact: <summary>
- Mitigation in progress: <actions>
- Next update: <time>
```

## Recovery Checklist

| Check | Pass Condition |
|------|----------------|
| Service restored | Core flows functional |
| Error rate normalized | Below alert threshold |
| Safety metrics stable | Within guardrail |
| Backlog processed | Queues drained |

## Postmortem Requirements

- Timeline with key timestamps
- Root cause and contributing factors
- Detection and response gaps
- Corrective and preventive actions with owners

## Troubleshooting

| Issue | Cause | Fix |
|------|-------|-----|
| Repeated incidents | No preventive actions tracked | Add owners/dates and verify closure |
| Slow triage | Unclear severity mapping | Tighten severity matrix with examples |
| Conflicting updates | Multiple channels unmanaged | Define single source of truth channel |

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
