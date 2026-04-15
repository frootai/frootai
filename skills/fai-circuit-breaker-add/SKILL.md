---
name: fai-circuit-breaker-add
description: 'Add circuit breaker pattern for Azure OpenAI calls with exponential backoff and fallback behavior.'
---

# Circuit Breaker Add

## Purpose

This skill defines a production-ready workflow for implementing the circuit breaker pattern for LLM API calls with configurable failure thresholds, exponential backoff, half-open state probing, and graceful fallback. It enforces full six-phase coverage, WAF-aligned quality gates, and reproducible delivery outcomes.

## Inputs

| Input | Description |
|---|---|
| Protected endpoint | Azure OpenAI or other LLM API endpoint |
| Failure threshold | Number of consecutive failures to trip the breaker (default: 5) |
| Recovery timeout | Seconds before half-open probe attempt (default: 30) |
| Fallback strategy | Cached response, smaller model, or graceful error message |

## Prerequisites

- Application using Azure OpenAI SDK or REST API.
- Retry policy already configured (the circuit breaker wraps retries).
- Fallback model deployment available (e.g., gpt-4o-mini as backup).
- Monitoring configured to track circuit state transitions.

## Full Phases Coverage

### Phase 1: Discover

- Identify which API calls need circuit protection (LLM inference, embedding, search).
- Review current failure patterns — what triggers cascading failures?
- Determine acceptable failure budgets per call type.
- Assess fallback options (cached answers, smaller model, queue-and-retry).

### Phase 2: Design

- Define circuit breaker state machine:

| State | Behavior |
|-------|----------|
| **Closed** | Requests flow normally; failures counted |
| **Open** | All requests short-circuit to fallback; timer starts |
| **Half-Open** | One probe request sent; success → Closed, failure → Open |

- Design the implementation:

```python
import time, threading

class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=30):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.state = "closed"  # closed, open, half-open
        self.last_failure_time = 0
        self._lock = threading.Lock()

    def can_execute(self):
        with self._lock:
            if self.state == "closed":
                return True
            if self.state == "open":
                if time.time() - self.last_failure_time >= self.recovery_timeout:
                    self.state = "half-open"
                    return True
                return False
            return True  # half-open: allow one probe
```

### Phase 3: Implement

- Wrap LLM calls with the circuit breaker:

```python
def call_llm_with_breaker(prompt, breaker, fallback_fn):
    if not breaker.can_execute():
        return fallback_fn(prompt)
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o", messages=[{"role": "user", "content": prompt}]
        )
        breaker.record_success()
        return response
    except Exception as e:
        breaker.record_failure()
        if not breaker.can_execute():
            return fallback_fn(prompt)
        raise
```

- Implement fallback strategy (smaller model, cached response):

```python
def fallback_to_mini(prompt):
    return openai_client.chat.completions.create(
        model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}]
    )
```

- Add telemetry for circuit state transitions.

### Phase 4: Validate

- Test closed → open transition by simulating consecutive failures.
- Verify half-open probe sends exactly one request.
- Confirm fallback returns acceptable responses.
- Load test to verify circuit breaker doesn't add measurable latency in closed state.

### Phase 5: Deploy

- Deploy to dev with aggressive thresholds (failure=2, timeout=10s) for easy testing.
- Promote to staging with production thresholds.
- Deploy to production — verify circuit stays closed under normal load.
- Monitor first 24 hours for any false trips.

### Phase 6: Operate

- Alert on circuit open events — investigate root cause.
- Review failure thresholds quarterly — adjust based on observed patterns.
- Track fallback usage rate — high rates indicate upstream reliability issues.
- Test circuit breaker with chaos engineering drills.

## WAF-Aligned Quality Gates

### Reliability

- Retry, timeout, and fallback behavior are validated.
- Dependency health checks and alerting are active.
- Degraded operation paths are tested and documented.

### Security

- Secrets are externalized via Key Vault or Managed Identity.
- Least-privilege RBAC is enforced on all resources.
- Audit trails capture all critical operations.

### Cost Optimization

- Resource sizing is evidence-based and right-sized.
- Expensive operations are measured and optimized.
- Budget alerts are configured per resource group.

### Operational Excellence

- CI/CD pipelines validate before every deployment.
- Runbooks and rollback procedures are current and tested.
- Metrics and traces support rapid root-cause diagnosis.

### Performance Efficiency

- SLO targets are explicit, monitored, and alerted.
- Hot paths are benchmarked under realistic load.
- Operational overhead is minimized.

### Responsible AI

- Content safety filters are applied where AI is used.
- Model outputs are transparent and explainable to users.
- Human escalation exists for high-impact or ambiguous decisions.

## Deliverables

| Artifact | Purpose |
|---|---|
| Implementation artifacts | Code, config, and infrastructure files |
| Validation evidence | Test results, compliance checks, quality metrics |
| Rollback guide | Step-by-step reversal and mitigation procedures |
| Operate handoff | Monitoring setup, ownership, and escalation paths |

## Completion Checklist

- [ ] Phase 1 discovery documented with scope and success criteria.
- [ ] Phase 2 design approved with tradeoff rationale.
- [ ] Phase 3 implementation reviewed and merged.
- [ ] Phase 4 validation passed with evidence collected.
- [ ] Phase 5 staged rollout completed through all environments.
- [ ] Phase 6 operate handoff accepted by operations team.

## Troubleshooting

### Symptom: Deployment fails in staging but works in dev

- Compare environment configuration (feature flags, network rules, RBAC).
- Verify service principal permissions match between environments.
- Check for region-specific resource availability differences.

### Symptom: Quality metrics degrade after deployment

- Compare baseline metrics with post-deployment measurements.
- Check for configuration drift between environments.
- Roll back and isolate the change that caused degradation.

### Symptom: Monitoring gaps or missing telemetry

- Verify instrumentation is deployed to all service instances.
- Check sampling rates — increase temporarily for debugging.
- Confirm diagnostic settings route to the correct Log Analytics workspace.

## Definition of Done

The skill is complete when all six phases have objective evidence, quality gates pass, and another engineer can reproduce outcomes without tribal knowledge.

## Metadata

- Category: Infrastructure
- WAF Pillars: Reliability, Security, Operational Excellence
- Maintainer: FAI Skill System
- Review cadence: Quarterly and after major platform changes
