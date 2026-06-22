---
description: "Azure Bicep AVM (Azure Verified Modules) standards — module usage, parameter patterns, WAF-aligned infrastructure."
applyTo: "**/*.bicep, **/parameters.json"
waf:
  - "security"
  - "reliability"
  - "cost-optimization"
  - "operational-excellence"
---

# Azure Bicep AVM — FAI Standards

## Module Selection

- Prefer Azure Verified Modules (AVM) from `br/public:avm/` registry over custom modules
- Check AVM registry: `https://aka.ms/avm/bicep/modules` for available modules
- Pin module versions: `br/public:avm/res/cognitive-services/account:0.7.0` — never use `latest`
- For resources without AVM: write custom modules following AVM patterns (interface, tests, docs)

## Parameter Patterns

```bicep
// CORRECT: Typed, documented, validated parameters
@description('The environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('The Azure region for deployment')
param location string = resourceGroup().location

@description('The project name used for resource naming')
@minLength(3)
@maxLength(24)
param projectName string

@secure()
@description('Optional: Override API key (prefer Managed Identity)')
param apiKey string = ''
```

- Use `@description` on ALL parameters — this generates documentation automatically
- Use `@allowed`, `@minLength`, `@maxLength`, `@minValue`, `@maxValue` for validation
- Mark sensitive params with `@secure()` — prevents logging in deployment history
- Provide sensible defaults where possible (location, environment='dev')
- Use parameter files (parameters.json) for environment-specific values

## Naming Convention

```bicep
var suffix = uniqueString(resourceGroup().id)
var resourcePrefix = '${projectName}-${environment}'
var tags = {
  environment: environment
  project: 'FAI'
  play: playName
  'managed-by': 'bicep'
}
```

- Use `uniqueString()` suffix for globally unique names (storage, cognitive services)
- Include environment in resource names: `FAI-rag-dev-oai-abc123`
- Tag ALL resources: environment, project, play, managed-by
- Use variables for computed names — don't repeat naming logic

## Conditional Resources

```bicep
// Production gets private endpoints, dev gets public access
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-01-01' = if (environment == 'prod') {
  name: '${resourcePrefix}-pe-oai'
  location: location
  properties: {
    subnet: { id: subnetId }
    privateLinkServiceConnections: [{ /* ... */ }]
  }
}

// SKU based on environment
var searchSku = environment == 'prod' ? 'standard' : 'basic'
```

## Security Patterns

- Enable Managed Identity on all compute resources (Container Apps, Functions, App Service)
- Configure RBAC with `roleAssignments` — use built-in role definition IDs
- Enable diagnostic settings on ALL resources → central Log Analytics workspace
- Private endpoints for data-plane operations in production
- Key Vault for secrets — never store in Bicep parameters or outputs

## Module Composition

```bicep
// Compose AVM modules with custom wiring
module openai 'br/public:avm/res/cognitive-services/account:0.7.0' = {
  name: 'deploy-openai'
  params: {
    name: '${resourcePrefix}-oai-${suffix}'
    location: location
    kind: 'OpenAI'
    sku: 'S0'
    tags: tags
    managedIdentities: { systemAssigned: true }
    diagnosticSettings: [{ workspaceResourceId: logAnalytics.id }]
  }
}
```

## Output Patterns

- Output resource IDs, endpoints, and names needed by dependent deployments
- Never output secrets — use Key Vault references instead
- Use `@description` on outputs for documentation

## Testing

- Validate with `az bicep build` in CI — catches syntax and type errors
- Use `what-if` deployment for change preview before apply
- Test with different parameter combinations (dev/staging/prod)
- Validate AVM module versions are not deprecated

## Anti-Patterns

- ❌ Hardcoding resource names without uniqueString (collision risk)
- ❌ Missing tags on resources (ungovernable, no cost attribution)
- ❌ Using `latest` API versions (breaking changes on update)
- ❌ Outputting secrets (appear in deployment history)
- ❌ Not using conditional resources for dev/prod differentiation
- ❌ Copy-pasting resource definitions instead of using modules

## WAF Alignment

### Security
- Managed Identity, RBAC, private endpoints (prod), Key Vault, diagnostic settings

### Reliability
- Zone redundancy (prod), backup configuration, health probes, multi-region (DR)

### Cost Optimization
- Conditional SKUs (Basic dev, Standard prod), auto-scale, tagging for cost attribution

### Operational Excellence
- AVM modules, parameter files, CI validation, what-if previews, tagging, diagnostic logs
