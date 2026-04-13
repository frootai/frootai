---
description: "Bicep infrastructure-as-code standards aligned with Azure WAF pillars — Azure Verified Modules, secure parameter handling, tagging conventions, production deployment patterns, and cost-aware resource configuration."
applyTo: "**/*.bicep, **/*.bicepparam, **/parameters.json"
waf:
  - "security"
  - "reliability"
  - "cost-optimization"
  - "operational-excellence"
  - "performance-efficiency"
---

# Bicep — FAI WAF-Aligned Standards

When writing or reviewing Bicep templates in FAI projects, enforce these standards.

## Security (WAF: Security Pillar)

- NEVER hardcode secrets in Bicep files — use `@secure()` decorator on all secret parameters
- Use Key Vault references for secrets: `keyVaultSecretUri` or `getSecret()` function
- Enable Managed Identity for all services — avoid key-based authentication
- Set `publicNetworkAccess: 'Disabled'` and use Private Endpoints for all PaaS services in production
- Enable diagnostic settings (`Microsoft.Insights/diagnosticSettings`) on every resource
- Use `@allowed()` decorator to constrain parameter values to valid options
- Never use `*` in RBAC role assignments — assign specific roles to specific principals

## Reliability (WAF: Reliability Pillar)

- Deploy to multiple availability zones where supported: `zones: ['1', '2', '3']`
- Use `dependsOn` only when implicit dependencies are insufficient — Bicep auto-detects most
- Set `minCapacity` and `maxCapacity` for auto-scaling resources
- Add health probes on all load-balanced resources
- Use deployment conditions (`if`) to handle optional resources cleanly
- Set `location` parameter with default `resourceGroup().location` — never hardcode regions

## Cost Optimization (WAF: Cost Pillar)

- Default to the smallest viable SKU — use parameters to allow scaling up per environment
- Use `@description()` decorator on every parameter to explain cost implications
- Set `sku` as a parameter with environment-specific defaults: `dev` uses basic, `prod` uses standard
- Tag every resource with: `environment`, `costCenter`, `project`, `managedBy`
- Use consumption-based SKUs (Serverless, Functions) for variable workloads
- Add budget alerts in Bicep: `Microsoft.Consumption/budgets` resource

## Operational Excellence (WAF: OpEx Pillar)

- Every parameter MUST have `@description()` explaining its purpose
- Use `lowerCamelCase` for parameter and variable names, `PascalCase` for resource symbolic names
- Group related parameters with consistent naming prefixes: `searchServiceName`, `searchServiceSku`
- Use Azure Verified Modules (AVM) from `br/public:` registry where available
- Version-pin AVM references: `br/public:avm/res/search/search-service:0.7.1` not `:latest`
- Use modules (`module` keyword) for reusable infrastructure components
- Set `targetScope` explicitly at the top of every file

## Performance (WAF: Performance Pillar)

- Configure appropriate SKU tiers for expected throughput
- Set `capacity` and `replicaCount` parameters for AI Search and OpenAI
- Use integrated caching where available (Azure APIM, Azure Front Door)
- Configure CDN for static content delivery

## Naming Conventions

```bicep
// Parameters: lowerCamelCase with @description
@description('Name of the Azure AI Search service')
param searchServiceName string

// Variables: lowerCamelCase
var resourceGroupName = 'rg-${projectName}-${environment}'

// Resources: PascalCase symbolic names
resource SearchService 'Microsoft.Search/searchServices@2024-06-01-preview' = {
  name: searchServiceName
  location: location
  // ...
}
```

## Required Tags (All Resources)

```bicep
param environment string
param projectName string
param costCenter string = 'ai-platform'

var commonTags = {
  environment: environment
  project: projectName
  costCenter: costCenter
  managedBy: 'FAI-bicep'
  createdDate: utcNow('yyyy-MM-dd')
}

resource MyResource '...' = {
  // ...
  tags: commonTags
}
```

## Template Structure

```bicep
// 1. Target scope
targetScope = 'resourceGroup'

// 2. Parameters (with @description and @allowed where appropriate)
// 3. Variables
// 4. Existing resource references
// 5. New resources (ordered by dependency)
// 6. Modules
// 7. Outputs
```
