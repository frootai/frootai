---
name: fai-health-check-implement
description: "Implement layered health checks for AI services including liveness, readiness, dependencies, and degraded mode reporting."
---

# Health Check Implement

## Health Model

| Endpoint | Purpose |
|---------|---------|
| /health/live | Process is running |
| /health/ready | App can serve requests |
| /health/deps | Dependency status details |

## Response Schema

```json
{
  "status": "healthy",
  "timestamp": "2026-04-14T10:00:00Z",
  "checks": {
    "openai": "healthy",
    "search": "healthy",
    "redis": "degraded"
  },
  "degraded_mode": true
}
```

## Example (Node/Express)

```ts
app.get('/health/live', (_req, res) => res.status(200).json({ status: 'alive' }));

app.get('/health/ready', async (_req, res) => {
  const checks = await runReadinessChecks();
  const unhealthy = Object.values(checks).some(v => v === 'unhealthy');
  res.status(unhealthy ? 503 : 200).json({ status: unhealthy ? 'unhealthy' : 'healthy', checks });
});
```

## Best Practices

- Keep liveness cheap and dependency-free.
- Keep readiness dependency-aware.
- Include degraded mode semantics.
- Add timeout per dependency probe.

## Validation Checklist

| Check | Expected |
|------|----------|
| Liveness endpoint | Always fast and stable |
| Readiness endpoint | Reflects dependency failures |
| Probe timeout | Prevents hanging checks |
| Status codes | 200 healthy, 503 unhealthy |

## Troubleshooting

| Issue | Cause | Fix |
|------|-------|-----|
| Readiness always unhealthy | Blocking optional dependency | Mark optional dependencies as degraded, not failed |
| Probe latency spikes | Serial dependency checks | Run probes in parallel with timeouts |
| False healthy state | Cached stale probe results | Add short TTL and fresh probes for readiness |

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
