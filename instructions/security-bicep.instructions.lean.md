---
description: "Bicep security standards — @secure() parameters, private endpoints, Managed Identity, diagnostic settings."
applyTo: "**/*.bicep"
waf:
  - "security"
---

# Bicep Security Patterns — FAI Standards

## Managed Identity
Prefer user-assigned for shared identity; system-assigned for single-resource lifecycle.
```bicep
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${workloadName}-${env}', location: location
}
resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName, location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${uami.id}': {} } }
  properties: { siteConfig: { minTlsVersion: '1.2', ftpsState: 'Disabled', httpsOnly: true } }
}
```
## RBAC — Least Privilege
Never assign Owner/Contributor for data-plane. Use named variables for role GUIDs.
```bicep
var cogServicesOpenAIUser = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
resource openaiRbac 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openai.id, uami.id, cogServicesOpenAIUser)
  scope: openai
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cogServicesOpenAIUser)
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}
```
## Key Vault — RBAC Mode + Purge Protection
```bicep
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${workloadName}-${env}', location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: tenant().tenantId
    enableRbacAuthorization: true       // Always RBAC — never access policies
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true         // Required for CMK
    networkAcls: { defaultAction: 'Deny', bypass: 'AzureServices' }
  }
}
// Reference secrets without exposing values in App Service
resource appCfg 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: app, name: 'appsettings'
  properties: { API_KEY: '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/api-key)' }
}
```
## Secure Parameters & Conditional Auth
```bicep
@secure()
param sqlAdminPassword string
@secure()
param apiKey string = ''              // Empty default — never commit real values
var useIdentityAuth = empty(apiKey)   // Prefer Managed Identity when no key provided
```
## Private Endpoints & Conditional Deployment
```bicep
param deployPe bool = env == 'prod'   // Private endpoints only in production
resource pe 'Microsoft.Network/privateEndpoints@2023-11-01' = if (deployPe) {
  name: 'pe-${openai.name}', location: location
  properties: {
    subnet: { id: peSubnet.id }
    privateLinkServiceConnections: [{
      name: 'plsc-${openai.name}'
      properties: { privateLinkServiceId: openai.id, groupIds: ['account'] }
    }]
  }
}
resource dnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.openai.azure.com', location: 'global'
}
```
## Network Security
Default-deny NSG with explicit HTTPS allow. Use service tags over raw CIDRs.
```bicep
resource nsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: 'nsg-${subnetName}', location: location
  properties: { securityRules: [
    { name: 'AllowHttpsIn', properties: { priority: 100, direction: 'Inbound', access: 'Allow', protocol: 'Tcp', sourceAddressPrefix: 'Internet', destinationAddressPrefix: 'VirtualNetwork', sourcePortRange: '*', destinationPortRange: '443' } }
    { name: 'DenyAllIn', properties: { priority: 4096, direction: 'Inbound', access: 'Deny', protocol: '*', sourceAddressPrefix: '*', destinationAddressPrefix: '*', sourcePortRange: '*', destinationPortRange: '*' } }
  ]}
}
```
## Diagnostic Settings
```bicep
resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-${openai.name}', scope: openai
  properties: {
    workspaceId: logAnalytics.id
    logs: [{ categoryGroup: 'allLogs', enabled: true, retentionPolicy: { enabled: true, days: 90 } }]
    metrics: [{ category: 'AllMetrics', enabled: true, retentionPolicy: { enabled: true, days: 90 } }]
  }
}
```
## Customer-Managed Keys
```bicep
resource cmkStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName, location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${uami.id}': {} } }
  properties: { encryption: {
    keySource: 'Microsoft.Keyvault'
    identity: { userAssignedIdentity: uami.id }
    keyvaultproperties: { keyname: 'storage-cmk', keyvaulturi: kv.properties.vaultUri }
  }}
}
```
## Azure Policy, Defender & Resource Locks
```bicep
resource policyAssign 'Microsoft.Authorization/policyAssignments@2024-04-01' = {
  name: 'deny-cogsvcs-public'
  properties: {
    policyDefinitionId: '/providers/Microsoft.Authorization/policyDefinitions/0725b4dd-7e76-479c-a735-68e7ee23d5be'
    displayName: 'Deny public network access — Cognitive Services'
    enforcementMode: 'Default'
  }
}
resource defenderKv 'Microsoft.Security/pricings@2024-01-01' = {
  name: 'KeyVaults', properties: { pricingTier: 'Standard' }
}
resource kvLock 'Microsoft.Authorization/locks@2020-05-01' = if (env == 'prod') {
  name: 'lock-${kv.name}', scope: kv
  properties: { level: 'CanNotDelete', notes: 'Remove lock before deletion' }
}
```
## Anti-Patterns
- ❌ Access policies on Key Vault — use `enableRbacAuthorization: true`
- ❌ `@secure()` params with hardcoded secrets as defaults
- ❌ Contributor/Owner for data-plane — use scoped data roles (Blob Data Reader, Cognitive Services User)
- ❌ `publicNetworkAccess: 'Enabled'` in prod — use private endpoints + firewall
- ❌ Missing `enablePurgeProtection` on Key Vaults used for CMK
- ❌ Diagnostic settings without retention — logs grow unbounded
- ❌ Hardcoded role GUIDs without variable names — unreadable, error-prone
- ❌ `'*'` in NSG source/destination — scope to service tags or CIDR

## WAF Alignment
| Pillar | Bicep Security Practice |
|--------|------------------------|
| Security | Managed Identity, private endpoints, RBAC least privilege, Key Vault RBAC, TLS 1.2+, NSG deny-all default |
| Reliability | Soft delete + purge protection, diagnostic settings for alerting, resource locks on critical infra |
| Cost | Conditional deployment (`if` guards), right-sized SKUs via params, Standard vs Premium KV by env |
| Operations | Diagnostics to Log Analytics, Azure Policy enforcement, Defender for Cloud, naming conventions |
| Responsible AI | Content Safety policy assignments, audit logs for AI model access, RBAC separation deployers vs consumers |
