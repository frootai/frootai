@description('Azure region selected by the ordered Play 102 preflight.')
param location string

@description('Globally unique Azure Container Registry name.')
param registryName string

@description('Resource tags used for ownership, expiry, and cost tracking.')
param tags object

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  tags: union(tags, {
    application: 'azure-cost-optimizer'
    play: '102-azure-cost-optimizer'
    managedBy: 'bicep'
  })
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    dataEndpointEnabled: false
    publicNetworkAccess: 'Enabled'
    policies: {
      quarantinePolicy: {
        status: 'disabled'
      }
      retentionPolicy: {
        days: 7
        status: 'disabled'
      }
      trustPolicy: {
        status: 'disabled'
        type: 'Notary'
      }
    }
  }
}

output registryName string = registry.name
output registryLoginServer string = registry.properties.loginServer