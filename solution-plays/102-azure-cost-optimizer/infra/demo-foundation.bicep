targetScope = 'subscription'

param resourceGroupName string
param location string = 'eastus2'
param tags object

@minLength(3)
@maxLength(18)
@description('Lowercase solution prefix. Globally unique resources receive a deterministic suffix.')
param prefix string

@minLength(3)
@maxLength(32)
param foundryProjectName string = 'aco-solution'

resource group 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module resources 'demo-resources.bicep' = {
  name: 'aco-demo-resources'
  scope: group
  params: {
    location: location
    tags: tags
    prefix: prefix
    foundryProjectName: foundryProjectName
  }
}

module access 'access.bicep' = {
  name: 'aco-demo-analysis-access'
  params: {
    principalId: resources.outputs.identityPrincipalId
    foundryAccountResourceGroupName: group.name
    foundryAccountName: resources.outputs.foundryAccountName
  }
}

output resources object = resources.outputs.configuration