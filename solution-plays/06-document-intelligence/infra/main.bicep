// Document Intelligence (Play 06) — Azure Infrastructure
// FrootAI Solution Play — Bicep IaC Template
// Deploy with: az deployment group create -g rg-frootai-{env} -f infra/main.bicep -p infra/parameters.json

targetScope = 'resourceGroup'

// ─── PARAMETERS ──────────────────────────────────────────────────

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Azure region for all resources')
param location string = 'swedencentral'

@description('Resource name prefix')
param prefix string = 'document-int'

@description('Tags applied to all resources')
param tags object = {
  project: 'frootai'
  play: '06'
  playName: 'Document Intelligence'
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
    allowSharedKeyAccess: false
    networkAcls: {
      defaultAction: isProduction ? 'Deny' : 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// ─── DOCUMENT WORKLOAD DATA ─────────────────────────────────────

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: '${resourcePrefix}-cosmos-${uniqueSuffix}'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  identity: { type: 'SystemAssigned' }
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [{ locationName: location, failoverPriority: 0 }]
    capabilities: [{ name: 'EnableServerless' }]
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    publicNetworkAccess: 'Enabled'
    ipRules: [{ ipAddressOrRange: '0.0.0.0' }]
  }
}

resource search 'Microsoft.Search/searchServices@2024-06-01-preview' = {
  name: '${resourcePrefix}-search-${uniqueSuffix}'
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  sku: { name: 'standard' }
  properties: {
    hostingMode: 'default'
    replicaCount: 1
    partitionCount: 1
    semanticSearch: 'standard'
    publicNetworkAccess: 'enabled'
  }
}

resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${resourcePrefix}-identity-${uniqueSuffix}'
  location: location
  tags: tags
}

resource containerEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${resourcePrefix}-env-${uniqueSuffix}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${resourcePrefix}-api-${uniqueSuffix}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${appIdentity.id}': {} }
  }
  properties: {
    managedEnvironmentId: containerEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['https://frootai.dev']
          allowedMethods: ['GET', 'POST']
          allowedHeaders: ['content-type', 'authorization']
        }
      }
    }
    template: {
      containers: [{
        name: 'document-api'
        image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [
          { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
          { name: 'AZURE_OPENAI_ENDPOINT', value: openai.properties.endpoint }
          { name: 'AZURE_STORAGE_ACCOUNT', value: storage.name }
          { name: 'AZURE_COSMOS_ENDPOINT', value: cosmosDb.properties.documentEndpoint }
          { name: 'AZURE_SEARCH_ENDPOINT', value: 'https://${search.name}.search.windows.net' }
          { name: 'AZURE_CLIENT_ID', value: appIdentity.properties.clientId }
        ]
      }]
      scale: { minReplicas: isProduction ? 1 : 0, maxReplicas: isProduction ? 10 : 3 }
    }
  }
}

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
output cosmosEndpoint string = cosmosDb.properties.documentEndpoint
output searchEndpoint string = 'https://${search.name}.search.windows.net'
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn

@description('Log Analytics workspace ID')
output logAnalyticsWorkspaceId string = logAnalytics.id

@description('OpenAI principal ID (for RBAC)')
output openaiPrincipalId string = openai.identity.principalId
