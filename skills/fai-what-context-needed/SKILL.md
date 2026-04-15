---
name: fai-what-context-needed
description: "Determine the minimal high-value context required for an AI task, including files, constraints, interfaces, and quality bars."
---

# FAI What Context Needed

## Goal

Identify exactly what information is required before implementation to avoid low-quality or hallucinated output.

## Context Dimensions

| Dimension | Why It Matters |
|----------|----------------|
| Code scope | Determines affected files and boundaries |
| Interfaces/contracts | Prevents breaking public APIs |
| Runtime constraints | Affects architecture and dependencies |
| Security/compliance | Prevents unsafe implementation choices |
| Quality bar | Defines done criteria |

## Step 1 - Extract Task Type

Classify the request as one of:

- Feature implementation
- Refactor
- Bug fix
- Migration
- Documentation/test generation

## Step 2 - Build Context Checklist

```json
{
  "required": [
    "entry files",
    "calling interfaces",
    "config and environment assumptions",
    "tests or evaluation criteria"
  ],
  "optional": [
    "architecture docs",
    "performance baselines",
    "release constraints"
  ]
}
```

## Step 3 - Rank by Impact

| Priority | Context Item | Impact |
|---------|---------------|--------|
| P0 | Public interface definitions | Breakage risk |
| P0 | Existing tests and expected behavior | Regression risk |
| P1 | Deployment/runtime constraints | Operability risk |
| P2 | Supporting docs | Speed/clarity improvement |

## Step 4 - Define Sufficiency Gate

Context is sufficient when:

1. Affected files are known.
2. Expected behavior is explicit.
3. Validation method is available.
4. Security and cost constraints are identified.

## Step 5 - Output Structured Context Request

```md
Need before implementation:
1) Entry point file(s)
2) Current contract/schema
3) Constraints (runtime, policy, latency)
4) Acceptance test cases
```

## Troubleshooting

| Issue | Cause | Fix |
|------|-------|-----|
| AI output too generic | Missing concrete code context | Provide file-level references and interfaces |
| Regressions after change | No behavior baseline | Add explicit acceptance tests first |
| Over-collection of context | No prioritization | Apply P0/P1/P2 ranking before reading |

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
