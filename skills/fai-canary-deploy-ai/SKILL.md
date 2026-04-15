---
name: fai-canary-deploy-ai
description: 'Implement canary deployment for AI model updates with traffic splitting and rollback on quality drop.'
---

# Canary Deploy AI

## Purpose

This skill defines a production-ready workflow for implementing canary deployment strategies for AI model updates with traffic splitting, quality monitoring, automated rollback, and progressive promotion. It enforces full six-phase coverage, WAF-aligned quality gates, and reproducible delivery outcomes.

## Inputs

| Input | Description |
|---|---|
| Model versions | Current (baseline) and new (canary) model deployment names |
| Traffic split | Initial canary percentage (typically 5-10%) |
| Quality metrics | Metrics to compare (latency, groundedness, user satisfaction) |
| Rollback threshold | Quality delta that triggers automatic rollback |

## Prerequisites

- Azure API Management or Azure Front Door for traffic splitting.
- Baseline model deployment with established quality metrics.
- New model deployment provisioned and tested in staging.
- Monitoring pipeline capturing per-request quality scores.

## Full Phases Coverage

### Phase 1: Discover

- Establish baseline quality metrics from current production model.
- Define canary success criteria (e.g., latency within 10%, groundedness ≥ baseline).
- Determine traffic split schedule (5% → 25% → 50% → 100%).
- Identify rollback triggers and automation requirements.

### Phase 2: Design

- Configure APIM traffic splitting policy:

```xml
<set-backend-service id="canary-split">
  <value>
    @{
      var random = new Random().Next(1, 101);
      return random <= 10
        ? "https://oai-canary.openai.azure.com"
        : "https://oai-baseline.openai.azure.com";
    }
  </value>
</set-backend-service>
```

- Design quality comparison dashboard:

```kql
customMetrics
| where name in ("ai.groundedness", "ai.latency_ms")
| extend model_version = tostring(customDimensions["model_version"])
| summarize avg_score=avg(value), p95=percentile(value, 95)
  by model_version, bin(timestamp, 15m)
```

### Phase 3: Implement

- Deploy canary model version alongside baseline.
- Configure traffic splitting at the gateway layer.
- Instrument requests to tag model version in telemetry:

```python
def route_request(request):
    import random
    version = "canary" if random.randint(1, 100) <= CANARY_PERCENT else "baseline"
    response = call_model(request, deployment=version)
    track_metric("ai.response", response.quality_score,
                 dimensions={"model_version": version})
    return response
```

- Set up automated rollback trigger on quality degradation.

### Phase 4: Validate

- Verify traffic split ratios match configuration (±2%).
- Confirm both model versions return correct telemetry tags.
- Test rollback automation — simulate quality drop and verify canary is disabled.
- Validate that rollback drains in-flight canary requests gracefully.

### Phase 5: Deploy

- Start canary at 5% traffic in production.
- Monitor quality delta for 4 hours before increasing.
- Promote to 25% if quality is within tolerance.
- Continue to 50% → 100% with 4-hour observation windows.
- If any stage fails, execute automated rollback.

### Phase 6: Operate

- Track canary deployment frequency and success rate.
- Maintain rollback runbook and test quarterly.
- Review quality thresholds after each canary cycle — tighten if false negatives observed.
- Archive canary comparison reports for model governance.

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
