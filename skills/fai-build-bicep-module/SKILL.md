---
name: fai-build-bicep-module
description: |
  Create production-ready Bicep modules with security defaults, policy alignment,
  conditional resources, and what-if testing. Use when building Azure infrastructure
  modules for Key Vault, Cognitive Services, or other AI resources.
---

# Build Bicep Module

Create production Bicep modules with secure defaults, policy compliance, and testing.

## When to Use

- Building infrastructure modules for Azure AI resources
- Standardizing resource provisioning with secure defaults
- Modules need to pass organizational Azure Policy assignments
- Publishing to a shared Bicep registry

---

## Module Structure

```
modules/
├── key-vault/
│   ├── main.bicep           # Module definition
│   ├── main.bicepparam       # Default parameters
│   └── tests/
│       └── main.test.bicep   # Deployment test
├── cognitive-services/
│   ├── main.bicep
│   └── tests/
│       └── main.test.bicep
└── README.md
```

## Key Vault Module Example

```bicep
// modules/key-vault/main.bicep
@description('Key Vault name')
@minLength(3)
@maxLength(24)
param name string

@description('Azure region')
param location string = resourceGroup().location

@description('Enable RBAC authorization (recommended over access policies)')
param enableRbacAuthorization bool = true

@description('Disable public network access')
param publicNetworkAccess bool = false

@description('Soft delete retention in days')
@minValue(7)
@maxValue(90)
param softDeleteRetentionInDays int = 90

param tags object = {}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: enableRbacAuthorization
    enableSoftDelete: true
    softDeleteRetentionInDays: softDeleteRetentionInDays
    enablePurgeProtection: true
    publicNetworkAccess: publicNetworkAccess ? 'Enabled' : 'Disabled'
  }
}

output id string = keyVault.id
output name string = keyVault.name
output uri string = keyVault.properties.vaultUri
```

## Deployment Test

```bicep
// modules/key-vault/tests/main.test.bicep
targetScope = 'resourceGroup'

module testDeployment '../main.bicep' = {
  name: 'kv-test-${uniqueString(resourceGroup().id)}'
  params: {
    name: 'kv-test-${uniqueString(resourceGroup().id)}'
    enableRbacAuthorization: true
    publicNetworkAccess: false
    tags: { env: 'test' }
  }
}
```

## Validation Pipeline

```bash
# Lint all modules
az bicep lint --file modules/key-vault/main.bicep

# Build (syntax check)
az bicep build --file modules/key-vault/main.bicep --stdout > /dev/null

# What-if (dry run against real subscription)
az deployment group what-if \
  --resource-group rg-test \
  --template-file modules/key-vault/tests/main.test.bicep
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Policy denial on deploy | Defaults violate org policy | Align defaults: disable public access, enable RBAC |
| What-if shows deletes | Conditional resources missing | Use `if` parameter for optional sub-resources |
| Consumer compilation error | Breaking param change | Version modules, keep defaults backward-compatible |
| Registry push auth error | Not logged into ACR | Run `az acr login` before `az bicep publish` |
