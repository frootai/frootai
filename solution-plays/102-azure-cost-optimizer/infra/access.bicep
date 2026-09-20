targetScope = 'subscription'

@description('Managed identity principal ID emitted by the solution application deployment.')
param principalId string

@description('Resource group containing the existing Microsoft Foundry account.')
param foundryAccountResourceGroupName string

@description('Existing Microsoft Foundry account name.')
param foundryAccountName string

var readerRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'acdd72a7-3385-48ef-bd42-f606fba81ae7')
var costManagementReaderRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '72fafb9e-0641-4937-9268-a91bfd8191a3')

resource analysisReaderAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, principalId, readerRoleId)
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: readerRoleId
  }
}

resource costManagementReaderAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, principalId, costManagementReaderRoleId)
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: costManagementReaderRoleId
  }
}

module foundryAccess 'foundry-access.bicep' = {
  name: 'aco-foundry-access'
  scope: resourceGroup(foundryAccountResourceGroupName)
  params: {
    foundryAccountName: foundryAccountName
    principalId: principalId
  }
}

output analysisReaderAssignmentId string = analysisReaderAccess.id
output costManagementReaderAssignmentId string = costManagementReaderAccess.id
output foundryDeveloperAssignmentId string = foundryAccess.outputs.assignmentId