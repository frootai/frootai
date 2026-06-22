---
description: "Bicep Code Best Practices standards — module design, naming, parameters, outputs, testing"
applyTo: "**/*.bicep, **/parameters.json"
waf:
  - "security"
  - "reliability"
  - "cost-optimization"
  - "operational-excellence"
---

# Bicep Code Best Practices — FAI Standards

## Module Design

- One module per logical resource group (network, identity, compute, storage)
- Input parameters with @description, @allowed, @minLength, @maxLength validators
- Outputs for resource IDs, endpoints, and names — never output secrets
- Module versioning with semantic version tags in registry
- Use `existing` keyword for referencing pre-deployed resources
- Prefer Azure Verified Modules (AVM) from `br/public:avm/` registry

## Parameter Best Practices

```bicep
@description('The environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

@secure()
param apiKey string = ''

@description('Project name for resource naming')
@minLength(3)
@maxLength(24)
param projectName string
```

- @secure() for sensitive parameters — prevents logging in deployment history
- Default values for environment-specific params
- Validation decorators on all inputs
- Parameter objects for complex configurations

## Naming & Tagging

```bicep
var suffix = uniqueString(resourceGroup().id)
var tags = { environment: environment, project: 'FAI', play: playName, 'managed-by': 'bicep' }
```

- uniqueString() suffix for globally unique names
- Tag ALL resources: environment, project, play, managed-by
- Variables for computed names — never repeat logic

## Conditional Deployment

```bicep
resource pe 'Microsoft.Network/privateEndpoints@2024-01-01' = if (environment == 'prod') { ... }
var sku = environment == 'prod' ? 'standard' : 'basic'
```

- Production-only resources: private endpoints, WAF, geo-replication
- SKU selection via ternary
- Zone redundancy conditional on environment

## Security Patterns

- Managed Identity on all compute: `identity: { type: 'SystemAssigned' }`
- RBAC via roleAssignments — never access keys
- Diagnostic settings on every resource → Log Analytics
- Key Vault references for secrets

## Testing & CI

- `az bicep build` in CI — syntax and type errors
- `az deployment group what-if` for change preview
- Test all parameter combinations (dev/staging/prod)
- ARM TTK for additional validation

## Anti-Patterns

- ❌ Hardcoded names without uniqueString
- ❌ Missing tags (ungovernable)
- ❌ Deprecated API versions
- ❌ Outputting secrets
- ❌ No conditional dev/prod differentiation
- ❌ Inline definitions instead of modules

## WAF Alignment

### Security
- Managed Identity, RBAC, private endpoints, Key Vault, diagnostics

### Reliability
- Zone redundancy, health probes, multi-region DR

### Cost Optimization
- Conditional SKUs, tagging, right-sizing

### Operational Excellence
- AVM modules, CI validation, what-if, tagging
