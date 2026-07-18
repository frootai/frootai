targetScope = 'resourceGroup'

@description('Azure region for all resources')
param location string = 'swedencentral'

@description('Environment name (dev, staging, prod)')
param environment string = 'dev'

@description('Project name used for resource naming')
param projectName string = 'frootai-07'

@description('Primary OpenAI model for supervisor agent')
param supervisorModel string = 'gpt-4o'

@description('Secondary OpenAI model for worker agent')
param workerModel string = 'gpt-4o-mini'

var suffix = uniqueString(resourceGroup().id)
var tags = {
  environment: environment
  project: 'frootai'
  play: '07-multi-agent-service'
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'log-${projectName}-${suffix}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: 'oai-${projectName}-${suffix}'
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: 'oai-${projectName}-${suffix}'
    publicNetworkAccess: 'Enabled'
  }
}

resource supervisorDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: supervisorModel
  sku: { name: 'Standard', capacity: 20 }
  properties: {
    model: { format: 'OpenAI', name: supervisorModel, version: '2024-08-06' }
  }
}

resource workerDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: workerModel
  sku: { name: 'Standard', capacity: 30 }
  properties: {
    model: { format: 'OpenAI', name: workerModel, version: '2024-07-18' }
  }
  dependsOn: [supervisorDeployment]
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: 'cosmos-${projectName}-${suffix}'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  identity: { type: 'SystemAssigned' }
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [{ locationName: location, failoverPriority: 0 }]
    capabilities: [{ name: 'EnableServerless' }]
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosDb
  name: 'agents-db'
  properties: { resource: { id: 'agents-db' } }
}

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: cosmosDatabase
  name: 'agent-state'
  properties: {
    resource: {
      id: 'agent-state'
      partitionKey: { paths: ['/agentId'], kind: 'Hash' }
      indexingPolicy: { automatic: true, indexingMode: 'consistent' }
    }
  }
}

resource serviceBus 'Microsoft.ServiceBus/namespaces@2024-01-01' = {
  name: 'sb-${projectName}-${suffix}'
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  sku: { name: 'Standard', tier: 'Standard' }
  properties: {
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    zoneRedundant: false
  }
}

resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: 'cae-${projectName}-${suffix}'
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

resource supervisorApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'ca-supervisor-${suffix}'
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: { ingress: { external: true, targetPort: 8080 } }
    template: {
      containers: [{
        name: 'supervisor'
        image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
        resources: { cpu: json('1.0'), memory: '2Gi' }
      }]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

resource workerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'ca-worker-${suffix}'
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: { ingress: { external: false, targetPort: 8081 } }
    template: {
      containers: [{
        name: 'worker'
        image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
        resources: { cpu: json('0.5'), memory: '1Gi' }
      }]
      scale: { minReplicas: 1, maxReplicas: 10 }
    }
  }
}

output openAiEndpoint string = openAi.properties.endpoint
output cosmosEndpoint string = cosmosDb.properties.documentEndpoint
output serviceBusEndpoint string = 'sb://${serviceBus.name}.servicebus.windows.net/'
output supervisorFqdn string = supervisorApp.properties.configuration.ingress.fqdn