---
name: fai-azure-openai-setup
description: 'Set up Azure OpenAI Service with model deployments, RBAC, content filtering, and monitoring.'
---

# Azure OpenAI Setup

## Purpose

This skill defines a production-ready workflow for provisioning and configuring Azure OpenAI Service with model deployments, RBAC authorization, content filtering policies, and operational monitoring. It enforces full six-phase coverage, WAF-aligned quality gates, and reproducible delivery outcomes.

## Inputs

| Input | Description |
|---|---|
| Subscription | Azure subscription with OpenAI resource provider registered |
| Models | Models to deploy (gpt-4o, gpt-4o-mini, text-embedding-3-small) |
| Capacity | PAYG or PTU allocation per model |
| Network | Private endpoint or public with IP restrictions |

## Prerequisites

- Azure subscription with `Microsoft.CognitiveServices` provider registered.
- Resource group and region selected (check model availability by region).
- Managed Identity configured for consumer applications.
- Key Vault provisioned for any non-MI scenarios.

## Full Phases Coverage

### Phase 1: Discover

- Check model availability in target region(s).
- Estimate token throughput requirements per model (RPM, TPM).
- Determine PAYG vs PTU based on baseline utilization.
- Review content filtering requirements for the use case.

### Phase 2: Design

- Plan resource topology (single account vs multi-region with APIM load balancing).
- Design RBAC assignments:

```bicep
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openAIAccount.id, principalId, roleDefinitionId)
  scope: openAIAccount
  properties: {
    principalId: managedIdentity.properties.principalId
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd') // Cognitive Services OpenAI User
    principalType: 'ServicePrincipal'
  }
}
```

- Configure content filter policy per deployment.

### Phase 3: Implement

- Deploy Azure OpenAI account with Bicep:

```bicep
resource openAI 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: openAIName
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: openAIName
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny' }
  }
  identity: { type: 'SystemAssigned' }
}

resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  name: 'gpt-4o'
  parent: openAI
  sku: { name: 'Standard', capacity: 80 }
  properties: {
    model: { format: 'OpenAI', name: 'gpt-4o', version: '2024-11-20' }
    raiPolicyName: 'DefaultV2'
  }
}
```

- Set up private endpoint and DNS zone.
- Configure diagnostic settings to Log Analytics.
- Apply custom content filter if default is too restrictive.

### Phase 4: Validate

- Test model deployment with a sample completion request via Managed Identity.
- Verify RBAC — confirm unauthorized principals receive 403.
- Validate content filter triggers on test inputs.
- Check diagnostic logs appear in Log Analytics within 5 minutes.

### Phase 5: Deploy

- Deploy to dev via Bicep with `az deployment group create`.
- Validate throughput matches allocation (check Capacity panel).
- Promote to staging — verify private endpoint connectivity from app subnet.
- Deploy to production with monitoring dashboard active.

### Phase 6: Operate

- Monitor TPM utilization — alert at 80% of allocated capacity.
- Review content filter blocks weekly — tune custom policies if legitimate traffic is blocked.
- Track cost per model deployment vs budget.
- Rotate to latest model version during maintenance windows.

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
