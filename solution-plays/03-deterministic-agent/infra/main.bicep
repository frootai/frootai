targetScope = 'resourceGroup'

// 
// Deterministic Agent  Azure Infrastructure
// Deploy: az deployment group create -f main.bicep -p parameters.json
// 

@description('Azure region for all resources')
param location string = 'swedencentral'

@description('Environment: dev, staging, or prod')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Project name used for resource naming')
param projectName string = 'frootai-agent'

var suffix = uniqueString(resourceGroup().id)
var tags = { environment: environment, project: 'frootai', play: '03-deterministic-agent' }

//  Managed Identity 
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${projectName}-id-${suffix}'
  location: location
  tags: tags
}

//  Azure OpenAI (temperature=0 deterministic) 
resource openai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: '${projectName}-oai-${suffix}'
  location: location
  kind: 'OpenAI'
  tags: tags
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: '${projectName}-oai-${suffix}'
    publicNetworkAccess: 'Enabled'
  }
}

resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openai
  name: 'gpt-4o-deterministic'
  sku: { name: 'Standard', capacity: 30 }
  properties: {
    model: { format: 'OpenAI', name: 'gpt-4o', version: '2024-08-06' }
  }
}

//  Azure Content Safety (guardrails) 
resource contentSafety 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: '${projectName}-cs-${suffix}'
  location: location
  kind: 'ContentSafety'
  tags: tags
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: '${projectName}-cs-${suffix}'
    publicNetworkAccess: 'Enabled'
  }
}

//  Storage Account (conversation logs) 
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: replace('${projectName}st${suffix}', '-', '')
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource logsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'conversation-logs'
}

// Cosmos DB deterministic response cache
resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: '${projectName}-cosmos-${suffix}'
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

//  Container Apps Environment & App 
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${projectName}-law-${suffix}'
  location: location
  tags: tags
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 90 }
}

resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${projectName}-cae-${suffix}'
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
  name: '${projectName}-api-${suffix}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: { external: true, targetPort: 8000, transport: 'http' }
    }
    template: {
      containers: [
        {
          name: 'agent-api'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'AZURE_OPENAI_ENDPOINT', value: openai.properties.endpoint }
            { name: 'AZURE_OPENAI_DEPLOYMENT', value: gpt4oDeployment.name }
            { name: 'AZURE_OPENAI_TEMPERATURE', value: '0' }
            { name: 'AZURE_CONTENT_SAFETY_ENDPOINT', value: contentSafety.properties.endpoint }
            { name: 'AZURE_STORAGE_ACCOUNT', value: storage.name }
            { name: 'AZURE_COSMOS_ENDPOINT', value: cosmosDb.properties.documentEndpoint }
            { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
          ]
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 5 }
    }
  }
}

//  Outputs 
output openaiEndpoint string = openai.properties.endpoint
output contentSafetyEndpoint string = contentSafety.properties.endpoint
output storageAccountName string = storage.name
output cosmosEndpoint string = cosmosDb.properties.documentEndpoint
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
output identityClientId string = identity.properties.clientId