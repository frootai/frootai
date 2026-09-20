targetScope = 'resourceGroup'

@description('Managed identity principal ID for the solution application.')
param principalId string

@description('Existing Microsoft Foundry account name.')
param foundryAccountName string

var azureAiDeveloperRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '53ca6127-db72-4b80-b1b0-d745d6d5456d')

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: foundryAccountName
}

resource foundryDeveloperAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundryAccount.id, principalId, azureAiDeveloperRoleId)
  scope: foundryAccount
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: azureAiDeveloperRoleId
  }
}

output assignmentId string = foundryDeveloperAccess.id