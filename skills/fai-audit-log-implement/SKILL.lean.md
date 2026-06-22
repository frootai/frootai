---
name: fai-audit-log-implement
description: 'Implement immutable audit logging with Azure Blob Storage, Sentinel integration, and compliance evidence.'
---

# Audit Log Implement

## Purpose

This skill defines a production-ready workflow for implementing immutable audit logging for AI systems with tamper-proof storage, compliance evidence collection, and security analytics integration. It enforces full six-phase coverage, WAF-aligned quality gates, and reproducible delivery outcomes.

## Inputs

| Input | Description |
|---|---|
| Log sources | Application events, AI decisions, admin actions, data access |
| Storage target | Azure Blob Storage with immutability policies |
| Retention policy | Regulatory retention period (e.g., 7 years for SOX, 6 years for HIPAA) |
| Analytics target | Microsoft Sentinel workspace for threat detection |

## Prerequisites

- Azure Blob Storage account with immutability policy support (v2, premium or standard).
- Log Analytics workspace for Sentinel integration.
- Application logging framework configured (structured JSON).
- Compliance requirements documented (HIPAA, SOX, GDPR, SOC 2).

## Full Phases Coverage

### Phase 1: Discover

- Identify all auditable events (data access, model inference, admin changes, escalations).
- Map regulatory requirements to retention periods and immutability needs.
- Assess current logging gaps — which decisions are not captured?
- Determine log volume estimates for storage sizing.

### Phase 2: Design

- Define audit event schema:

```json
{
  "eventId": "uuid-v4",
  "timestamp": "2026-04-15T10:30:00Z",
  "actor": { "id": "user@org.com", "type": "user", "ip": "10.0.1.50" },
  "action": "model.inference",
  "resource": { "type": "gpt-4o", "id": "deployment-east" },
  "outcome": "success",
  "details": { "tokens": 1500, "latency_ms": 800 },
  "correlationId": "trace-abc123"
}
```

- Design immutability policy:

```bicep
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  name: 'default'
  parent: storageAccount
  properties: {
    containerDeleteRetentionPolicy: { enabled: true, days: 365 }
  }
}

resource auditContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: 'audit-logs'
  parent: blobService
  properties: {
    immutableStorageWithVersioning: { enabled: true }
  }
}
```

### Phase 3: Implement

- Instrument application code to emit structured audit events.
- Configure log pipeline: App → Event Hub → Stream Analytics → Blob Storage.
- Apply time-based immutability lock matching retention requirements.
- Set up Sentinel data connector for real-time security analytics:

```python
import logging, json
from datetime import datetime, timezone

audit_logger = logging.getLogger("audit")

def log_audit_event(actor, action, resource, outcome, details=None):
    event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "actor": actor,
        "action": action,
        "resource": resource,
        "outcome": outcome,
        "details": details or {}
    }
    audit_logger.info(json.dumps(event))
```

### Phase 4: Validate

- Verify audit events appear in Blob Storage within SLA (< 5 minutes).
- Confirm immutability — attempt to delete a log entry and verify it fails.
- Run Sentinel analytics rules against test audit data.
- Validate log schema compliance against regulatory requirements.

### Phase 5: Deploy

- Deploy logging infrastructure via Bicep to dev environment.
- Generate synthetic audit events and verify end-to-end pipeline.
- Promote to staging — validate with real application traffic.
- Deploy to production with parallel logging (old + new) for 48 hours.

### Phase 6: Operate

- Monitor log pipeline health — alert on ingestion delays > 5 minutes.
- Review Sentinel incident detections weekly.
- Run quarterly compliance audits against stored logs.
- Manage storage lifecycle — archive old logs to cool/archive tier.

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
