targetScope = 'resourceGroup'

// 
// AI Landing Zone  Network & Security Infrastructure
// Deploy: az deployment group create -f main.bicep -p parameters.json
// 

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Environment: dev, staging, or prod')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Address prefix for the virtual network (CIDR)')
param vnetAddressPrefix string = '10.0.0.0/16'

var suffix = uniqueString(resourceGroup().id)
var tags = { environment: environment, project: 'frootai', play: '02-ai-landing-zone' }

//  Network Security Group 
resource nsg 'Microsoft.Network/networkSecurityGroups@2024-01-01' = {
  name: 'frootai-lz-nsg-${suffix}'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'DenyAllInbound'
        properties: {
          priority: 4096
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
      {
        name: 'AllowVnetInbound'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: '*'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

//  Virtual Network 
resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: 'frootai-lz-vnet-${suffix}'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: [vnetAddressPrefix] }
    subnets: [
      {
        name: 'ai-services'
        properties: {
          addressPrefix: cidrSubnet(vnetAddressPrefix, 24, 0)
          networkSecurityGroup: { id: nsg.id }
        }
      }
      {
        name: 'private-endpoints'
        properties: {
          addressPrefix: cidrSubnet(vnetAddressPrefix, 24, 1)
          networkSecurityGroup: { id: nsg.id }
        }
      }
      {
        name: 'compute'
        properties: {
          addressPrefix: cidrSubnet(vnetAddressPrefix, 24, 2)
          networkSecurityGroup: { id: nsg.id }
          delegations: [
            {
              name: 'containerApps'
              properties: { serviceName: 'Microsoft.App/environments' }
            }
          ]
        }
      }
    ]
  }
}

//  Private DNS Zones 
resource dnsOpenAI 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.openai.azure.com'
  location: 'global'
  tags: tags
}

resource dnsOpenAILink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: dnsOpenAI
  name: 'openai-vnet-link'
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}

resource dnsSearch 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.search.windows.net'
  location: 'global'
  tags: tags
}

resource dnsSearchLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: dnsSearch
  name: 'search-vnet-link'
  location: 'global'
  properties: {
    virtualNetwork: { id: vnet.id }
    registrationEnabled: false
  }
}

//  Key Vault 
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'frootai-kv-${suffix}'
  location: location
  tags: tags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny', bypass: 'AzureServices' }
  }
}

//  Log Analytics Workspace 
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'frootai-lz-law-${suffix}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 90
  }
}

//  Managed Identity 
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'frootai-lz-id-${suffix}'
  location: location
  tags: tags
}

//  Outputs 
output vnetId string = vnet.id
output aiServicesSubnetId string = vnet.properties.subnets[0].id
output privateEndpointsSubnetId string = vnet.properties.subnets[1].id
output computeSubnetId string = vnet.properties.subnets[2].id
output keyVaultUri string = keyVault.properties.vaultUri
output logAnalyticsWorkspaceId string = logAnalytics.id
output identityClientId string = identity.properties.clientId
output dnsOpenAIZoneId string = dnsOpenAI.id
output dnsSearchZoneId string = dnsSearch.id