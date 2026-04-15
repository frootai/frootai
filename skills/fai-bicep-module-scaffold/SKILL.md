---
name: fai-bicep-module-scaffold
description: |
  Scaffold reusable Bicep modules with typed parameters, secure defaults, test hooks,
  and versioning. Use when creating infrastructure modules that follow AVM conventions
  and need what-if validation before deployment.
---

# Bicep Module Scaffold

Create reusable Bicep modules with typed parameters, secure defaults, and deployment tests.

## When to Use

- Creating a new reusable infrastructure module
- Standardizing resource provisioning across teams
- Building modules that pass Azure Policy checks
- Publishing modules to a Bicep registry

---

## Module Template

```bicep
// modules/storage-account.bicep
@description('Name of the storage account (3-24 chars, lowercase+numbers)')
@minLength(3)
@maxLength(24)
param name string

@description('Azure region')
param location string = resourceGroup().location

@description('Storage SKU')
@allowed(['Standard_LRS', 'Standard_ZRS', 'Standard_GRS'])
param skuName string = 'Standard_ZRS'

@description('Enable public blob access')
param allowBlobPublicAccess bool = false

@description('Tags')
param tags object = {}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  kind: 'StorageV2'
  sku: { name: skuName }
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    allowBlobPublicAccess: allowBlobPublicAccess
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

@description('Resource ID of the storage account')
output id string = storageAccount.id

@description('Name of the storage account')
output name string = storageAccount.name

@description('Primary blob endpoint')
output blobEndpoint string = storageAccount.properties.primaryEndpoints.blob

@description('Principal ID of the managed identity')
output principalId string = storageAccount.identity.principalId
```

## Consumer Example

```bicep
// main.bicep
module storage 'modules/storage-account.bicep' = {
  name: 'storage-deploy'
  params: {
    name: 'staidocs${uniqueString(resourceGroup().id)}'
    skuName: 'Standard_ZRS'
    tags: { env: 'prod', owner: 'platform' }
  }
}

output storageId string = storage.outputs.id
```

## What-If Validation

```bash
# Validate module without deploying
az deployment group what-if \
  --resource-group rg-test \
  --template-file main.bicep \
  --parameters name=sttest01 skuName=Standard_LRS

# Build to check syntax
az bicep build --file modules/storage-account.bicep --stdout > /dev/null
```

## Registry Publishing

```bash
# Publish to Azure Container Registry (Bicep registry)
az bicep publish \
  --file modules/storage-account.bicep \
  --target br:myregistry.azurecr.io/bicep/storage-account:1.0.0
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Module breaks consumers | Unstable parameter contract | Version module, preserve backward-compatible defaults |
| Policy denial on deploy | Defaults violate org policy | Align defaults (disable public access, enforce TLS 1.2) |
| What-if shows unexpected deletes | Missing conditional resources | Add `if` condition for optional sub-resources |
| Registry push fails | Auth not configured | `az acr login --name myregistry` before publish |
