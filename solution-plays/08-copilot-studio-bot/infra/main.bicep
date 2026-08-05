// Copilot Studio Bot (Play 08) — Azure Infrastructure
// FrootAI Solution Play — Bicep IaC Template
// Deploy with: az deployment group create -g rg-frootai-{env} -f infra/main.bicep -p infra/parameters.json

targetScope = 'resourceGroup'

// ─── PARAMETERS ──────────────────────────────────────────────────

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Resource name prefix')
param prefix string = 'copilot-stud'

@description('Tags applied to all resources')
param tags object = {
  project: 'frootai'
  play: '08'
  playName: 'Copilot Studio Bot'
  environment: environment
  managedBy: 'bicep'
  createdDate: utcNow('yyyy-MM-dd')
}

// ─── VARIABLES ───────────────────────────────────────────────────

var uniqueSuffix = uniqueString(resourceGroup().id, prefix)
var resourcePrefix = '${prefix}-${environment}'
var isProduction = environment == 'prod'

// ─── LOG ANALYTICS WORKSPACE ─────────────────────────────────────

@description('Log Analytics workspace for monitoring and diagnostics')
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${resourcePrefix}-logs'
  location: location
  tags: tags
  properties: {
    sku: {
      name: isProduction ? 'PerGB2018' : 'PerGB2018'
    }
    retentionInDays: isProduction ? 90 : 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

// ─── APPLICATION INSIGHTS ────────────────────────────────────────

@description('Application Insights for application monitoring and telemetry')
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${resourcePrefix}-insights'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    RetentionInDays: isProduction ? 90 : 30
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ─── KEY VAULT ───────────────────────────────────────────────────

@description('Azure Key Vault for secret management')
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${prefix}-${uniqueSuffix}'
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: isProduction ? 90 : 7
    enablePurgeProtection: isProduction
    networkAcls: {
      defaultAction: isProduction ? 'Deny' : 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// ─── AZURE OPENAI ────────────────────────────────────────────────

@description('Azure OpenAI Service for AI model inference')
resource openai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: '${resourcePrefix}-openai'
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    customSubDomainName: '${prefix}-${uniqueSuffix}'
    publicNetworkAccess: isProduction ? 'Disabled' : 'Enabled'
    networkAcls: {
      defaultAction: isProduction ? 'Deny' : 'Allow'
    }
  }
}

// ─── OPENAI MODEL DEPLOYMENTS ────────────────────────────────────

@description('GPT-4o model deployment for generation')
resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openai
  name: 'gpt-4o'
  sku: {
    name: 'GlobalStandard'
    capacity: isProduction ? 30 : 10
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o'
      version: '2024-11-20'
    }
  }
}

@description('Embedding model deployment for vector search')
resource embeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openai
  name: 'text-embedding-3-large'
  sku: {
    name: 'Standard'
    capacity: isProduction ? 120 : 30
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'text-embedding-3-large'
      version: '1'
    }
  }
  dependsOn: [gpt4oDeployment]
}

// ─── STORAGE ACCOUNT ─────────────────────────────────────────────

@description('Storage account for data and artifacts')
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'st${replace(prefix, '-', '')}${uniqueSuffix}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: isProduction ? 'Standard_GRS' : 'Standard_LRS'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    networkAcls: {
      defaultAction: isProduction ? 'Deny' : 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// ─── RBAC ROLE ASSIGNMENTS ───────────────────────────────────────

@description('Cognitive Services OpenAI User role for the app')
var cognitiveServicesOpenAIUser = 'a97b65f3-24c7-4388-baec-2e87135dc908'

@description('Key Vault Secrets User role for the app')
var keyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'

@description('Storage Blob Data Reader role for the app')
var storageBlobDataReader = '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'

// ─── DIAGNOSTIC SETTINGS ─────────────────────────────────────────

@description('Diagnostic settings for Azure OpenAI')
resource openaiDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'openai-diagnostics'
  scope: openai
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { categoryGroup: 'allLogs', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

@description('Diagnostic settings for Key Vault')
resource kvDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'kv-diagnostics'
  scope: keyVault
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { categoryGroup: 'allLogs', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}

// ─── OUTPUTS ─────────────────────────────────────────────────────

@description('Azure OpenAI endpoint URL')
output openaiEndpoint string = openai.properties.endpoint

@description('Key Vault URI')
output keyVaultUri string = keyVault.properties.vaultUri

@description('Application Insights connection string')
output appInsightsConnectionString string = appInsights.properties.ConnectionString

@description('Storage account name')
output storageAccountName string = storage.name

@description('Log Analytics workspace ID')
output logAnalyticsWorkspaceId string = logAnalytics.id

@description('OpenAI principal ID (for RBAC)')
output openaiPrincipalId string = openai.identity.principalId
