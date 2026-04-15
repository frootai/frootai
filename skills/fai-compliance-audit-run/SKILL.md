---
name: fai-compliance-audit-run
description: 'Run a compliance audit against HIPAA, FedRAMP, SOC 2, and EU AI Act requirements for AI systems.'
---

# Compliance Audit Run

## Purpose

This skill defines a production-ready workflow for executing compliance audits for AI systems against regulatory frameworks including HIPAA, FedRAMP, SOC 2, and EU AI Act with evidence collection and remediation tracking. It enforces full six-phase coverage, WAF-aligned quality gates, and reproducible delivery outcomes.

## Inputs

| Input | Description |
|---|---|
| Framework | Target compliance framework (HIPAA, FedRAMP, SOC 2, EU AI Act) |
| Scope | Azure resources, AI models, data stores, and processes in scope |
| Evidence repository | Location for audit evidence (Azure Blob Storage, SharePoint) |
| Remediation tracker | Tool for tracking findings (Azure DevOps, Jira, GitHub Issues) |

## Prerequisites

- Compliance framework requirements mapped to technical controls.
- Azure Policy assignments and Microsoft Defender for Cloud enabled.
- Audit logging and monitoring configured for all in-scope resources.
- Legal/compliance team available for interpretation questions.

## Full Phases Coverage

### Phase 1: Discover

- Identify all in-scope resources, data flows, and AI models.
- Map regulatory controls to Azure technical controls.
- Review previous audit findings and remediation status.
- Confirm evidence collection automation is operational.

### Phase 2: Design

- Create control-to-evidence mapping:

| Control | Requirement | Evidence Source | Automated |
|---------|-------------|----------------|-----------|
| HIPAA §164.312(a)(1) | Access control | Azure AD sign-in logs | Yes |
| SOC 2 CC6.1 | Logical access | RBAC assignments export | Yes |
| EU AI Act Art.15 | Accuracy metrics | Evaluation pipeline results | Yes |
| FedRAMP AC-2 | Account management | Azure AD audit logs | Yes |

- Design automated evidence collection:

```bash
# Export RBAC assignments for SOC 2 CC6.1
az role assignment list --scope /subscriptions/$SUB_ID \
  --output json > evidence/rbac-assignments.json

# Export policy compliance for FedRAMP
az policy state list --subscription $SUB_ID \
  --filter "complianceState eq 'NonCompliant'" \
  --output json > evidence/policy-noncompliant.json
```

### Phase 3: Implement

- Run Azure Policy compliance scan:

```bash
# Trigger on-demand compliance evaluation
az policy state trigger-scan --subscription $SUB_ID

# Get compliance summary
az policy state summarize --subscription $SUB_ID \
  --output table
```

- Collect AI-specific evidence:

```python
# EU AI Act — collect model accuracy evidence
from frootai.evaluation import EvaluationRunner

runner = EvaluationRunner(config_path="config/evaluation.json")
results = runner.run_suite("compliance-eval")
results.export_evidence("evidence/ai-accuracy-report.json")
```

- Generate compliance report with findings categorized by severity.
- Create remediation tickets for non-compliant items.

### Phase 4: Validate

- Cross-check automated evidence against manual spot checks (10% sample).
- Verify all critical controls have evidence collected.
- Confirm remediation tickets are created for every non-compliant finding.
- Review report with compliance team before finalization.

### Phase 5: Deploy

- Execute audit in dev environment first to validate tooling.
- Run full audit in production with read-only access.
- Submit evidence package to auditors or compliance team.
- Track remediation items to resolution.

### Phase 6: Operate

- Schedule recurring audits (quarterly for SOC 2, annually for FedRAMP).
- Monitor policy compliance drift continuously via Azure Policy.
- Review and update control mappings when regulations change.
- Maintain evidence retention per regulatory requirements.

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
