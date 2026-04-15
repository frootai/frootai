---
name: fai-app-insights-configure
description: 'Configure Application Insights with custom AI metrics, anomaly alerts, and operational dashboards.'
---

# Application Insights Configure

## Purpose

This skill defines a production-ready workflow for configuring Application Insights for AI workloads with custom metrics, KQL-driven alerts, performance dashboards, and distributed tracing across multi-service architectures. It enforces full six-phase coverage, WAF-aligned quality gates, and reproducible delivery outcomes.

## Inputs

| Input | Description |
|---|---|
| App Insights resource | Workspace-based Application Insights instance |
| Instrumentation targets | Services to instrument (API, background workers, AI pipeline) |
| Alert rules | SLO thresholds, anomaly detection sensitivity, action groups |
| Dashboard layout | Key metrics panels, refresh intervals, role-based views |

## Prerequisites

- Log Analytics workspace provisioned.
- Application Insights resource created (workspace-based mode).
- Applications instrumented with OpenTelemetry or Application Insights SDK.
- Alert action groups configured (email, PagerDuty, Teams webhook).

## Full Phases Coverage

### Phase 1: Discover

- Inventory all services in the solution architecture.
- Identify key SLOs (latency P95, error rate, availability).
- Map AI-specific metrics to track (token usage, groundedness, latency per model call).
- Review existing telemetry gaps and blind spots.

### Phase 2: Design

- Define custom metrics for AI workloads:

```python
from opentelemetry import metrics

meter = metrics.get_meter("ai-pipeline")
token_counter = meter.create_counter("ai.tokens.consumed",
    description="Total tokens consumed by LLM calls")
latency_hist = meter.create_histogram("ai.llm.latency_ms",
    description="LLM call latency in milliseconds")

# Record metrics per call
token_counter.add(response.usage.total_tokens,
    {"model": "gpt-4o", "operation": "rag-query"})
latency_hist.record(elapsed_ms, {"model": "gpt-4o"})
```

- Design KQL alert queries:

```kql
// Alert: LLM latency P95 exceeds 3 seconds
customMetrics
| where name == "ai.llm.latency_ms"
| summarize p95=percentile(value, 95) by bin(timestamp, 5m)
| where p95 > 3000
```

- Plan dashboard panels: request rate, error rate, latency P50/P95, token burn rate, model health.

### Phase 3: Implement

- Add OpenTelemetry instrumentation to all services.
- Create custom dimensions for model, operation, and play ID.
- Configure sampling rate (100% for errors, 10% for successful requests).
- Deploy Bicep for alert rules and action groups:

```bicep
resource alertRule 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'llm-latency-p95'
  location: location
  properties: {
    severity: 2
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      allOf: [{ query: kqlQuery, threshold: 3000, operator: 'GreaterThan' }]
    }
    actions: { actionGroups: [actionGroup.id] }
  }
}
```

- Build workbook with panels for AI-specific operational views.

### Phase 4: Validate

- Generate synthetic load and verify metrics appear in Application Insights.
- Trigger alert conditions and confirm notifications arrive.
- Validate distributed traces span all services end-to-end.
- Confirm dashboard panels render correct data within 5-minute refresh.

### Phase 5: Deploy

- Deploy instrumentation updates via CI/CD to dev, then staging.
- Verify alert rules activate in staging with test traffic.
- Promote alert rules and dashboards to production.
- Validate no telemetry gaps during rollout.

### Phase 6: Operate

- Review alert noise weekly — tune thresholds to reduce false positives.
- Monitor sampling rates — increase if investigating intermittent issues.
- Track token burn rate trends for cost forecasting.
- Rotate dashboard access reviews quarterly.

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
