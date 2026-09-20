targetScope = 'resourceGroup'

@description('Azure region selected by the Play 102 ordered availability policy.')
param location string = 'eastus2'

@description('Short environment name used for tags and resource names.')
@allowed([
  'dev'
  'demo'
])
param environmentName string = 'demo'

@description('Project prefix used for resource names.')
@minLength(3)
@maxLength(20)
param projectName string = 'aco'

@description('Container image pinned by digest for an approved deployment.')
param containerImage string

@description('Microsoft Entra tenant that authenticates dashboard users.')
param tenantId string

@allowed([
  'container-apps-easy-auth'
  'public-anonymous-demo'
])
@description('Hosted access mode. Entra Easy Auth is the default. public-anonymous-demo is an explicit time-bounded solution exception.')
param authMode string = 'container-apps-easy-auth'

@description('Microsoft Entra application client ID for the hosted dashboard API.')
param entraClientId string = ''

@description('Allowed audience exposed by the Microsoft Entra application.')
param entraAudience string = ''

@secure()
@description('Microsoft Entra application client secret used only by Container Apps authentication.')
param entraClientSecret string = ''

@allowed([
  'query'
  'cost-details'
  'exports'
])
@description('Cost evidence source. exports reads scheduled export files and makes no Query API calls.')
param costSource string = 'query'

@description('Application Insights connection string for OpenTelemetry traces. Empty disables tracing.')
@secure()
param applicationInsightsConnectionString string = ''

@description('Azure AI Content Safety endpoint. Empty leaves the deterministic checks as the only content gate.')
param contentSafetyEndpoint string = ''

@description('Publish the read-only MCP endpoint at /mcp. It serves real cost evidence, so it inherits the same authorization as the API.')
param mcpEnabled bool = false

@description('Acknowledge that /mcp is reachable without sign-in. Required only when mcpEnabled is true and authMode is not container-apps-easy-auth.')
param mcpAllowAnonymous bool = false

@minValue(0)
@maxValue(1440)
@description('Minutes between background evidence refreshes. 0 disables scheduled refresh; values below 15 are ignored by the app to bound provider calls.')
param refreshIntervalMinutes int = 0

@description('Azure OpenAI endpoint used only for semantic-cache embeddings. Empty disables semantic caching.')
param embeddingEndpoint string = ''
param embeddingDeployment string = 'text-embedding-3-small'

@minValue(50)
@maxValue(99)
@description('Semantic cache cosine threshold in hundredths. 82 reuses paraphrases while keeping different questions apart.')
param semanticCacheThresholdPercent int = 88

@description('Private blob endpoint holding normalized evidence and report objects.')
param blobEndpoint string = ''

@description('Cosmos DB endpoint holding scope-partitioned hot state and the published revision pointer.')
param cosmosEndpoint string = ''

param blobContainerName string = 'normalized-evidence'
param cosmosDatabaseName string = 'aci'
param cosmosContainerName string = 'snapshots'

@description('Principal ID of the managed identity that collects evidence when hosted.')
param collectorPrincipalId string = ''

@description('Authorized Azure subscription analyzed by this solution deployment.')
param analysisSubscriptionId string

@description('Existing Microsoft Foundry project endpoint.')
param foundryProjectEndpoint string

@description('Existing Foundry project model deployment name.')
param foundryModelDeploymentName string

@allowed(['foundry', 'azure-openai', 'none'])
param intelligenceProvider string = 'foundry'

@description('Existing Azure Container Registry name in this resource group.')
param registryName string

@description('Resource group of the reused Azure Container Registry.')
param registryResourceGroupName string = resourceGroup().name

param managedIdentityName string = 'aco-final-identity'
param managedEnvironmentName string = 'aco-final-environment'

@description('Explicit user object IDs permitted to view this private demo.')
@minLength(1)
param allowedObjectIds array

@description('User object IDs permitted to refresh cost evidence.')
@minLength(1)
param operatorObjectIds array

@description('Expected HTTPS application origin, configured after the generated hostname is known.')
param publicOrigin string = 'https://pending.invalid'

param containerAppName string = 'aco-final'

@description('Resource tags used for ownership, expiry, and cost tracking.')
param tags object = {}

var suffix = uniqueString(resourceGroup().id)
var resourceTags = union(tags, {
  application: 'azure-cost-optimizer'
  environment: environmentName
  play: '102-azure-cost-optimizer'
  managedBy: 'bicep'
})

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  scope: resourceGroup(registryResourceGroupName)
  name: registryName
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: managedIdentityName
}

resource containerEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: managedEnvironmentName
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: resourceTags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: registry.properties.loginServer
          identity: identity.id
        }
      ]
      secrets: authMode == 'container-apps-easy-auth' ? [
        {
          name: 'entra-client-secret'
          value: entraClientSecret
        }
      ] : []
      ingress: {
        allowInsecure: false
        external: true
        targetPort: 8080
        transport: 'auto'
      }
    }
    template: {
      containers: [
        {
          name: 'azure-cost-optimizer'
          image: containerImage
          env: [
            {
              name: 'ACI_HOSTING_PROFILE'
              value: 'hosted_demo'
            }
            {
              name: 'ACI_AUTO_REFRESH'
              value: 'false'
            }
            {
              name: 'ACI_AUTH_MODE'
              value: authMode
            }
            {
              name: 'ACI_SEMANTIC_CACHE_THRESHOLD'
              value: '0.${semanticCacheThresholdPercent}'
            }
            {
              name: 'ACI_EMBEDDING_ENDPOINT'
              value: embeddingEndpoint
            }
            {
              name: 'ACI_EMBEDDING_DEPLOYMENT'
              value: embeddingDeployment
            }
            {
              name: 'ACI_COST_SOURCE'
              value: costSource
            }
            {
              name: 'ACI_REFRESH_INTERVAL_MINUTES'
              value: string(refreshIntervalMinutes)
            }
            {
              name: 'ACI_MCP_ENABLED'
              value: string(mcpEnabled)
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: applicationInsightsConnectionString
            }
            {
              name: 'ACI_CONTENT_SAFETY_ENDPOINT'
              value: contentSafetyEndpoint
            }
            {
              name: 'ACI_MCP_ALLOW_ANONYMOUS'
              value: string(mcpAllowAnonymous)
            }
            {
              name: 'ACI_BLOB_ENDPOINT'
              value: blobEndpoint
            }
            {
              name: 'ACI_BLOB_CONTAINER'
              value: blobContainerName
            }
            {
              name: 'ACI_COSMOS_ENDPOINT'
              value: cosmosEndpoint
            }
            {
              name: 'ACI_COSMOS_DATABASE'
              value: cosmosDatabaseName
            }
            {
              name: 'ACI_COSMOS_CONTAINER'
              value: cosmosContainerName
            }
            {
              name: 'ACI_COLLECTOR_PRINCIPAL_ID'
              value: collectorPrincipalId
            }
            {
              name: 'ACI_TENANT_ID'
              value: tenantId
            }
            {
              name: 'ACI_ALLOWED_OBJECT_IDS'
              value: join(allowedObjectIds, ',')
            }
            {
              name: 'ACI_OPERATOR_OBJECT_IDS'
              value: join(operatorObjectIds, ',')
            }
            {
              name: 'ACI_PUBLIC_ORIGIN'
              value: publicOrigin
            }
            {
              name: 'ACI_DATA_PROFILE'
              value: 'live'
            }
            {
              name: 'ACI_AI_PROVIDER'
              value: intelligenceProvider
            }
            {
              name: 'ACI_EXTENDED_COLLECTION_ENABLED'
              value: 'false'
            }
            {
              name: 'ACI_SUBSCRIPTION_ID'
              value: analysisSubscriptionId
            }
            {
              name: 'AZURE_AI_PROJECT_ENDPOINT'
              value: foundryProjectEndpoint
            }
            {
              name: 'AZURE_AI_MODEL_DEPLOYMENT_NAME'
              value: foundryModelDeploymentName
            }
            {
              name: 'AZURE_CLIENT_ID'
              value: identity.properties.clientId
            }
            {
              name: 'ASPNETCORE_URLS'
              value: 'http://+:8080'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health/ready'
                port: 8080
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health/live'
                port: 8080
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

resource auth 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  parent: app
  name: 'current'
  properties: authMode == 'container-apps-easy-auth' ? {
    platform: {
      enabled: true
    }
    globalValidation: {
      requireAuthentication: true
      unauthenticatedClientAction: 'Return401'
      excludedPaths: [
        '/'
        '/index.html'
        '/assets/*'
        '/favicon.svg'
        '/auth/config'
        '/health/live'
        '/health/ready'
      ]
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraClientId
          clientSecretSettingName: 'entra-client-secret'
          openIdIssuer: '${environment().authentication.loginEndpoint}${tenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [
            entraAudience
            entraClientId
          ]
        }
      }
    }
  } : {
    platform: {
      enabled: false
    }
    globalValidation: {
      requireAuthentication: false
      unauthenticatedClientAction: 'AllowAnonymous'
    }
  }
}

output applicationUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output managedIdentityClientId string = identity.properties.clientId
output managedIdentityPrincipalId string = identity.properties.principalId
output managedIdentityResourceId string = identity.id
output containerAppName string = app.name
