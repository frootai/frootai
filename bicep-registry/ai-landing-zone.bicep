// FrootAI Bicep Registry — AI Landing Zone Module
// Reusable module for deploying a secure AI Landing Zone on Azure
// Usage: module aiLandingZone 'br:ghcr.io/frootai/frootai/bicep/ai-landing-zone:1.0' = { ... }

@description('Resource group location')
param location string = resourceGroup().location

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Project name for resource naming')
param projectName string

@description('Enable private endpoints on all services')
param enablePrivateEndpoints bool = true

@description('Log Analytics workspace ID for diagnostic settings')
param logAnalyticsWorkspaceId string = ''

// ─── Naming Convention ───
var prefix = '${projectName}-${environment}'
var tags = {
  environment: environment
  project: projectName
  managedBy: 'frootai-bicep-registry'
  wafAligned: 'true'
}

// ─── Key Vault (secrets management) ───
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${take(replace(prefix, '-', ''), 20)}kv'
  location: location
  tags: tags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    networkAcls: enablePrivateEndpoints ? {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    } : {
      defaultAction: 'Allow'
    }
  }
}

// ─── Managed Identity ───
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-identity'
  location: location
  tags: tags
}

// ─── Azure OpenAI ───
resource openai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: '${prefix}-openai'
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: '${prefix}-openai'
    publicNetworkAccess: enablePrivateEndpoints ? 'Disabled' : 'Enabled'
    networkAcls: enablePrivateEndpoints ? {
      defaultAction: 'Deny'
    } : {
      defaultAction: 'Allow'
    }
  }
}

// ─── GPT-4o-mini Deployment ───
resource gpt4oMiniDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openai
  name: 'gpt-4o-mini'
  sku: {
    name: 'GlobalStandard'
    capacity: environment == 'prod' ? 30 : 10
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o-mini'
      version: '2024-07-18'
    }
  }
}

// ─── Application Insights ───
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${prefix}-insights'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspaceId != '' ? logAnalyticsWorkspaceId : null
  }
}

// ─── Diagnostic Settings on OpenAI ───
resource openaiDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (logAnalyticsWorkspaceId != '') {
  name: '${prefix}-openai-diag'
  scope: openai
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      { category: 'Audit', enabled: true }
      { category: 'RequestResponse', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

// ─── Outputs ───
output openaiEndpoint string = openai.properties.endpoint
output keyVaultUri string = keyVault.properties.vaultUri
output managedIdentityId string = managedIdentity.id
output managedIdentityClientId string = managedIdentity.properties.clientId
output appInsightsConnectionString string = appInsights.properties.ConnectionString
