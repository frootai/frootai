---
name: bicep-module-create
description: "Create reusable Bicep modules, parameter files, and registry packages — standardize Azure infrastructure and reduce deployment drift"
---

# Bicep Module Create

Create reusable, composable Bicep modules following Azure Verified Module (AVM) patterns with proper parameter design, conditional resources, registry publishing, and environment-specific parameter files.

## Module Structure

Organize infra code with a root orchestrator and child modules:

```
infra/
├── main.bicep                  # Root orchestrator — composes modules
├── main.bicepparam             # Default parameters
├── dev.bicepparam              # Dev environment overrides
├── prod.bicepparam             # Prod environment overrides
├── bicepconfig.json            # Linter rules + module aliases
└── modules/
    ├── ai-search.bicep         # One module per logical resource group
    ├── openai.bicep
    ├── key-vault.bicep
    ├── monitoring.bicep
    └── networking.bicep
```

File naming: lowercase-hyphen, noun-based (`key-vault.bicep` not `createKeyVault.bicep`). One resource concern per module file.

## Parameter Design

Separate required from optional. Use decorators for validation and documentation:

```bicep
// modules/openai.bicep

@description('Azure region for all resources')
param location string

@description('Base name used to generate resource names')
@minLength(3)
@maxLength(20)
param baseName string

@description('SKU for the Cognitive Services account')
@allowed(['S0', 'S1'])
param skuName string = 'S0'

@description('Model deployments to create')
param deployments array = []

@secure()
@description('Optional customer-managed key for encryption')
param cmkKeyUri string = ''

@description('Tags applied to all resources')
param tags object = {}

@description('Enable public network access')
param enablePublicAccess bool = false
```

Rules: put required params first, group by concern, always add `@description`. Use `@secure()` for keys/secrets — never log or output them. Default optional params to safe values (empty string, false, empty object).

## Resource Declarations with Conditions

Use ternary and conditional `if` to toggle resources:

```bicep
// modules/key-vault.bicep

param enablePurgeProtection bool = true
param enablePrivateEndpoint bool = false
param vnetSubnetId string = ''

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${baseName}'
  location: location
  tags: tags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: tenant().tenantId
    enableSoftDelete: true
    enablePurgeProtection: enablePurgeProtection
    enableRbacAuthorization: true
    publicNetworkAccess: enablePrivateEndpoint ? 'Disabled' : 'Enabled'
  }
}

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = if (enablePrivateEndpoint) {
  name: 'pe-${vault.name}'
  location: location
  properties: {
    subnet: { id: vnetSubnetId }
    privateLinkServiceConnections: [
      {
        name: 'kv-link'
        properties: {
          privateLinkServiceId: vault.id
          groupIds: ['vault']
        }
      }
    ]
  }
}
```

Pattern: gate expensive or environment-specific resources with `if (condition)`. Reference dependent params together — if `enablePrivateEndpoint` is true, `vnetSubnetId` must be non-empty.

## Output Declarations

Expose only what the parent orchestrator needs. Never output secrets:

```bicep
@description('Resource ID of the Key Vault')
output vaultId string = vault.id

@description('Key Vault name for RBAC assignments')
output vaultName string = vault.name

@description('Key Vault URI for SDK configuration')
output vaultUri string = vault.properties.vaultUri
```

## Root Orchestrator

The `main.bicep` composes child modules and threads outputs between them:

```bicep
targetScope = 'resourceGroup'

param location string = resourceGroup().location
param baseName string
param environment string
@secure()
param cmkKeyUri string = ''

var isProduction = environment == 'prod'
var tags = { project: 'fai', environment: environment, managedBy: 'bicep' }

module vault 'modules/key-vault.bicep' = {
  name: 'deploy-key-vault'
  params: {
    location: location
    baseName: baseName
    tags: tags
    enablePurgeProtection: isProduction
    enablePrivateEndpoint: isProduction
    vnetSubnetId: isProduction ? networking.outputs.subnetId : ''
  }
}

module openai 'modules/openai.bicep' = {
  name: 'deploy-openai'
  params: {
    location: location
    baseName: baseName
    tags: tags
    cmkKeyUri: cmkKeyUri
  }
}

output keyVaultUri string = vault.outputs.vaultUri
output openaiEndpoint string = openai.outputs.endpoint
```

## AVM (Azure Verified Modules) Pattern

Reference AVM modules from the public registry instead of hand-rolling common resources:

```bicep
module storageAccount 'br/public:avm/res/storage/storage-account:0.14.0' = {
  name: 'deploy-storage'
  params: {
    name: 'st${replace(baseName, '-', '')}'
    location: location
    kind: 'StorageV2'
    skuName: isProduction ? 'Standard_GRS' : 'Standard_LRS'
    tags: tags
  }
}
```

Pin AVM versions explicitly (`0.14.0` not `latest`). Check https://aka.ms/avm for the catalog. Use AVM for storage, networking, Key Vault, monitoring — write custom modules only for app-specific composition.

## Environment Parameter Files

Use `.bicepparam` files to bind values per environment:

```bicep
// dev.bicepparam
using './main.bicep'

param baseName = 'fai-dev'
param environment = 'dev'
```

```bicep
// prod.bicepparam
using './main.bicep'

param baseName = 'fai-prod'
param environment = 'prod'
param cmkKeyUri = readEnvironmentVariable('CMK_KEY_URI', '')
```

Use `readEnvironmentVariable()` for secrets in CI/CD — never hardcode keys in param files.

## Publishing to a Module Registry

Push reusable modules to an Azure Container Registry for cross-team sharing:

```bash
# Create a registry for modules (one-time)
az acr create -n crBicepModules -g rg-shared --sku Basic

# Publish a module with a semver tag
az bicep publish \
  --file modules/key-vault.bicep \
  --target br:crbicepmodules.azurecr.io/bicep/modules/key-vault:1.2.0

# Consume in another project via bicepconfig.json alias
```

```json
// bicepconfig.json
{
  "moduleAliases": {
    "br": {
      "corp": { "registry": "crbicepmodules.azurecr.io", "modulePath": "bicep/modules" }
    }
  }
}
```

Then reference as `module vault 'br/corp:key-vault:1.2.0'`.

## Testing with What-If

Validate deployments before applying:

```bash
# Preflight validation — catches schema and quota errors
az deployment group validate \
  -g rg-fai-dev -f infra/main.bicep -p infra/dev.bicepparam

# What-if — shows exact resource changes without deploying
az deployment group what-if \
  -g rg-fai-dev -f infra/main.bicep -p infra/dev.bicepparam

# Deploy after review
az deployment group create \
  -g rg-fai-dev -f infra/main.bicep -p infra/dev.bicepparam
```

Run `validate` in PR checks (fast, catches syntax/schema). Run `what-if` in CD pipeline before approval gate.

## Linter Configuration

Configure `bicepconfig.json` to enforce quality:

```json
{
  "analyzers": {
    "core": {
      "rules": {
        "no-hardcoded-env-urls": { "level": "error" },
        "no-unused-params": { "level": "error" },
        "no-unused-vars": { "level": "warning" },
        "prefer-interpolation": { "level": "warning" },
        "secure-parameter-default": { "level": "error" },
        "use-recent-api-versions": { "level": "warning", "maxAllowedAgeInDays": 730 },
        "explicit-values-for-loc-params": { "level": "warning" },
        "use-safe-access": { "level": "warning" }
      }
    }
  }
}
```

Key rules: `secure-parameter-default` blocks default values on `@secure()` params. `no-hardcoded-env-urls` catches `.windows.net` literals (use `environment()` instead). `use-recent-api-versions` flags stale API versions older than 2 years.

## Checklist

- [ ] One module per resource concern, flat `modules/` folder
- [ ] All params have `@description`, secrets have `@secure()`
- [ ] Conditional resources gated with `if (param)`, not commented out
- [ ] Outputs expose IDs/names/URIs only — never secrets
- [ ] AVM used for standard resources, custom modules for composition
- [ ] `.bicepparam` per environment, secrets via `readEnvironmentVariable()`
- [ ] `bicepconfig.json` linter rules enforced, `secure-parameter-default` = error
- [ ] `what-if` runs in CI before deployment approval gate
- [ ] Module registry versions pinned with semver tags
