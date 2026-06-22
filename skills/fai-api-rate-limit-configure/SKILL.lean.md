---
name: fai-api-rate-limit-configure
description: 'Configure API rate limiting with Azure APIM policies, throttling tiers, and retry headers.'
---

# API Rate Limit Configure

## Purpose

This skill defines a production-ready workflow for configuring API rate limiting with Azure API Management policies including throttling tiers, retry-after headers, quota enforcement, and burst-handling strategies. It enforces full six-phase coverage, WAF-aligned quality gates, and reproducible delivery outcomes.

## Inputs

| Input | Description |
|---|---|
| APIM instance | Azure API Management resource name and resource group |
| Rate tiers | Requests-per-second limits per subscription tier (free, standard, premium) |
| Quota settings | Daily/monthly call quotas per product |
| Retry policy | Retry-After header behavior and client guidance |

## Prerequisites

- Azure API Management instance provisioned (Consumption, Standard v2, or Premium).
- Backend API registered as an APIM API.
- Subscription keys or OAuth2 configured for consumer authentication.
- Monitoring baseline captured (current RPS, error rates).

## Full Phases Coverage

### Phase 1: Discover

- Audit current API usage patterns (peak RPS, burst profiles, consumer distribution).
- Identify business tiers and their SLA commitments.
- Review backend capacity limits (Azure OpenAI TPM, database DTUs).
- Map upstream dependencies that need protection.

### Phase 2: Design

- Define rate-limit tiers per product:

```xml
<!-- APIM rate-limit-by-key policy -->
<rate-limit-by-key calls="10" renewal-period="1"
  counter-key="@(context.Subscription.Id)"
  increment-condition="@(context.Response.StatusCode >= 200 && context.Response.StatusCode < 400)" />
```

- Configure quota policy for daily/monthly limits:

```xml
<quota-by-key calls="1000" renewal-period="86400"
  counter-key="@(context.Subscription.Id)" />
```

- Design retry-after response headers for throttled clients:

```xml
<return-response>
  <set-status code="429" reason="Too Many Requests" />
  <set-header name="Retry-After" exists-action="override">
    <value>@(context.Variables.GetValueOrDefault<int>("retry-after", 30).ToString())</value>
  </set-header>
</return-response>
```

### Phase 3: Implement

- Apply rate-limit policies at the product, API, and operation levels.
- Configure different limits per tier (free: 10 RPS, standard: 100 RPS, premium: 1000 RPS).
- Add IP-based rate limiting for unauthenticated endpoints.
- Implement circuit breaker for backend overload protection.
- Add Application Insights custom metrics for throttle events.

### Phase 4: Validate

- Load test at 120% of configured limits to verify 429 responses.
- Confirm Retry-After headers return correct delay values.
- Verify quota counters reset at the expected renewal period.
- Test that premium tier is not affected when free tier is throttled.
- Check Application Insights for throttle event telemetry.

### Phase 5: Deploy

- Apply policies to dev APIM instance and verify with synthetic traffic.
- Promote to staging — validate with a subset of real traffic.
- Roll out to production using gradual policy deployment.
- Monitor 429 rates and error budgets during first 24 hours.
- Rollback to previous policy revision if error rate exceeds threshold.

### Phase 6: Operate

- Alert on sustained 429 rates above 5% of total traffic.
- Review tier utilization monthly — adjust limits based on growth.
- Track backend saturation vs. APIM throttle rates for capacity planning.
- Update policies when new backend capacity is provisioned.

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
