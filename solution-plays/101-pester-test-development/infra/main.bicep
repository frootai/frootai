// =========================================================================
// Play 101: Pester Test Development
// Infrastructure: Storage for test artifacts + Log Analytics for test telemetry
// NOTE: Pester tests run locally or in CI/CD pipelines. This infrastructure
// is OPTIONAL — only needed if you want centralized test artifact storage.
// =========================================================================

@description('Environment name (dev, staging, prod)')
param environmentName string = 'dev'

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Project name for resource naming')
param projectName string = 'pester-tests'

// ── Variables ──
var prefix = '${projectName}-${environmentName}'
var tags = {
  environment: environmentName
  project: projectName
  play: '101'
  purpose: 'pester-test-artifacts'
  managedBy: 'frootai-bicep'
}

// ── Storage Account for test artifacts (coverage reports, test results) ──
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: replace('${prefix}sa', '-', '')
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    encryption: {
      services: {
        blob: { enabled: true, keyType: 'Account' }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

// ── Blob container for JaCoCo coverage reports ──
resource coverageContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: '${storageAccount.name}/default/coverage-reports'
  properties: { publicAccess: 'None' }
}

// ── Blob container for NUnit test results ──
resource testResultsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: '${storageAccount.name}/default/test-results'
  properties: { publicAccess: 'None' }
}

// ── Log Analytics for test execution telemetry (optional) ──
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-law'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ── Outputs ──
output storageAccountName string = storageAccount.name
output coverageContainerUrl string = '${storageAccount.properties.primaryEndpoints.blob}coverage-reports'
output testResultsContainerUrl string = '${storageAccount.properties.primaryEndpoints.blob}test-results'
output logAnalyticsWorkspaceId string = logAnalytics.id

// ── Metadata ──
metadata play = {
  id: '101'
  name: 'Pester Test Development'
  description: 'Optional infrastructure for centralized test artifact storage (JaCoCo + NUnit XML)'
  note: 'Pester tests run locally or in CI/CD. This Bicep is only needed for centralized artifact retention.'
}
