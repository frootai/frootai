---
name: fai-bicep-module-create
description: 'Create a reusable Bicep module with typed parameters, conditions, outputs, and AVM alignment.'
---

# Bicep Module Create

## Purpose

This skill defines a production-ready workflow for creating reusable Bicep modules following Azure Verified Modules (AVM) conventions with typed parameters, conditional deployments, outputs, and testing. It enforces full six-phase coverage, WAF-aligned quality gates, and reproducible delivery outcomes.

## Inputs

| Input | Description |
|---|---|
| Resource type | Azure resource to encapsulate (e.g., cognitiveServices/accounts) |
| Module scope | Resource group, subscription, or management group deployment |
| Parameters | Required and optional parameters with types, defaults, and constraints |
| AVM alignment | Whether to follow AVM naming, structure, and interface patterns |

## Prerequisites

- Bicep CLI installed (`az bicep install` or standalone).
- Azure subscription for deployment validation.
- Understanding of the target resource's ARM API schema.
- AVM module index reviewed for existing modules.

## Full Phases Coverage

### Phase 1: Discover

- Check AVM module index — does a verified module already exist?
- Review the ARM API spec for the target resource type.
- Identify required vs optional properties.
- Determine deployment scope (resourceGroup, subscription, managementGroup).

### Phase 2: Design

- Define the module interface:

```bicep
// modules/cognitive-services.bicep
@description('Name of the Cognitive Services account')
param name string

@description('Location for the resource')
param location string = resourceGroup().location

@description('SKU name')
@allowed(['F0', 'S0', 'S1'])
param skuName string = 'S0'

@description('Enable public network access')
param publicNetworkAccess bool = false

@description('Tags to apply')
param tags object = {}
```

- Define outputs for downstream consumers:

```bicep
output id string = account.id
output endpoint string = account.properties.endpoint
output principalId string = account.identity.principalId
```

### Phase 3: Implement

- Create the module file with full resource definition:

```bicep
resource account 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: name
  location: location
  kind: 'OpenAI'
  sku: { name: skuName }
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: name
    publicNetworkAccess: publicNetworkAccess ? 'Enabled' : 'Disabled'
    networkAcls: {
      defaultAction: publicNetworkAccess ? 'Allow' : 'Deny'
    }
  }
}
```

- Add conditional resources (private endpoint, diagnostic settings).
- Create a `main.bicep` consumer example showing module invocation.
- Add `bicepconfig.json` with linting rules.

### Phase 4: Validate

- Run `az bicep build` — zero errors, zero warnings.
- Run `az bicep lint` with strict rules enabled.
- Execute `az deployment group what-if` to validate against a real subscription.
- Test with minimum parameters and with all optional parameters.

```bash
az deployment group what-if \
  --resource-group rg-test \
  --template-file modules/cognitive-services.bicep \
  --parameters name=test-oai skuName=S0
```

### Phase 5: Deploy

- Deploy to a dev resource group and verify resource creation.
- Validate outputs are correct (endpoint, principalId).
- Test module consumption from a parent template.
- Publish to internal Bicep registry if applicable.

### Phase 6: Operate

- Version the module and track breaking changes in CHANGELOG.md.
- Monitor for new API versions — update `@api-version` annually.
- Review parameter defaults when Azure pricing or features change.
- Run automated deployment tests in CI/CD pipeline.

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
