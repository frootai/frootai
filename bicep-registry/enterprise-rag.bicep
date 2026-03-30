// FrootAI Bicep Registry — Enterprise RAG Module
// Deploys a complete RAG pipeline: AI Search + OpenAI + Container Apps
// Usage: module rag 'br:ghcr.io/frootai/frootai/bicep/enterprise-rag:1.0' = { ... }

@description('Resource group location')
param location string = resourceGroup().location

@description('Environment (dev, prod)')
@allowed(['dev', 'prod'])
param environment string = 'dev'

@description('Project name')
param projectName string

@description('OpenAI resource name (existing)')
param openaiName string

@description('Search service SKU')
@allowed(['basic', 'standard', 'standard2'])
param searchSku string = environment == 'prod' ? 'standard' : 'basic'

var prefix = '${projectName}-${environment}'
var tags = {
  environment: environment
  project: projectName
  pattern: 'enterprise-rag'
  managedBy: 'frootai-bicep-registry'
}

// ─── Azure AI Search ───
resource search 'Microsoft.Search/searchServices@2024-06-01-preview' = {
  name: '${prefix}-search'
  location: location
  tags: tags
  sku: { name: searchSku }
  properties: {
    replicaCount: environment == 'prod' ? 2 : 1
    partitionCount: 1
    hostingMode: 'default'
    semanticSearch: 'standard'
    publicNetworkAccess: 'enabled'
  }
}

// ─── Container Apps Environment ───
resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  tags: tags
  properties: {
    zoneRedundant: environment == 'prod'
  }
}

// ─── Storage Account (document ingestion) ───
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: '${take(replace(prefix, '-', ''), 20)}docs'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: environment == 'prod' ? 'Standard_GRS' : 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

// ─── Blob Container ───
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource docsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'documents'
  properties: {
    publicAccess: 'None'
  }
}

output searchEndpoint string = 'https://${search.name}.search.windows.net'
output searchAdminKey string = search.listAdminKeys().primaryKey
output containerEnvId string = containerEnv.id
output storageConnectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${az.environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'
