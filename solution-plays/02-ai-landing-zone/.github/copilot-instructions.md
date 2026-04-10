---
description: "AI Landing Zone domain knowledge — auto-injected into every Copilot conversation in this workspace"
applyTo: "**"
---

# AI Landing Zone — Domain Knowledge

This workspace implements a production-grade AI Landing Zone on Azure — the foundational infrastructure (networking, identity, monitoring, compute) that AI workloads deploy into. This is an INFRASTRUCTURE play, not an application play.

## Landing Zone Architecture (What the Model Gets Wrong)

### Network Topology — Hub-Spoke with Private Endpoints
```
Hub VNet (10.0.0.0/16)
├── AzureFirewallSubnet (10.0.1.0/24)
├── GatewaySubnet (10.0.2.0/24)
└── BastionSubnet (10.0.3.0/24)

Spoke VNet — AI Workloads (10.1.0.0/16)
├── PrivateEndpointSubnet (10.1.1.0/24)    ← OpenAI, AI Search, Storage
├── ComputeSubnet (10.1.2.0/24)            ← AKS, Container Apps
├── IntegrationSubnet (10.1.3.0/24)        ← API Management, App Gateway
└── DataSubnet (10.1.4.0/24)               ← SQL, Cosmos DB
```

### Private Endpoints (Non-Negotiable for Enterprise)
Every AI service MUST use private endpoints. Public access = security violation.
```bicep
// ❌ WRONG — public endpoint exposed
resource openAI 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  properties: { publicNetworkAccess: 'Enabled' }  // NEVER in enterprise
}

// ✅ CORRECT — private endpoint only
resource openAI 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  properties: { publicNetworkAccess: 'Disabled' }
}
resource openAIPE 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  properties: {
    subnet: { id: privateEndpointSubnet.id }
    privateLinkServiceConnections: [{ properties: {
      privateLinkServiceId: openAI.id
      groupIds: ['account']
    }}]
  }
}
```

### Managed Identity + RBAC (Never API Keys)
```bicep
// ❌ WRONG — key-based auth
var apiKey = listKeys(openAI.id, '2024-04-01-preview').key1

// ✅ CORRECT — Managed Identity with least-privilege RBAC
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a97b65f3-24c7-4388-baec-2e87135dc908') // Cognitive Services OpenAI User
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}
```

### NSG Rules for AI Subnets
```bicep
// Private endpoint subnet: deny all inbound except VNet traffic
resource nsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  properties: {
    securityRules: [
      { name: 'DenyInternetInbound', properties: { priority: 100, direction: 'Inbound', access: 'Deny', sourceAddressPrefix: 'Internet', destinationAddressPrefix: '*', protocol: '*', sourcePortRange: '*', destinationPortRange: '*' }}
      { name: 'AllowVNetInbound', properties: { priority: 200, direction: 'Inbound', access: 'Allow', sourceAddressPrefix: 'VirtualNetwork', destinationAddressPrefix: '*', protocol: '*', sourcePortRange: '*', destinationPortRange: '*' }}
    ]
  }
}
```

## Bicep Patterns (Critical — Differs from ARM/Terraform)

| Correct (Bicep) | Wrong (Common Mistakes) |
|---------|-------|
| `param location string = resourceGroup().location` | Hardcoded `'eastus2'` |
| `resource openAI 'Microsoft.CognitiveServices/accounts@2024-04-01-preview'` | Outdated API version |
| `existing keyVault = resource ...` | Creating duplicate Key Vault |
| `output endpoint string = openAI.properties.endpoint` | Hardcoded endpoint URL |
| Use AVM modules: `br/public:avm/res/...` | Raw resource definitions |
| `@secure() param adminPassword string` | Password in plain text param |
| Conditional: `resource x = if (deployMonitoring) { ... }` | Separate template per env |

## Azure Verified Modules (AVM) — Use These, Not Raw Resources

| Resource | AVM Module | Why |
|----------|-----------|-----|
| Virtual Network | `br/public:avm/res/network/virtual-network:0.5.0` | Built-in NSG, subnet delegation, diagnostics |
| Key Vault | `br/public:avm/res/key-vault/vault:0.9.0` | Built-in private endpoint, RBAC, soft delete |
| OpenAI | `br/public:avm/res/cognitive-services/account:0.7.0` | Built-in managed identity, PE, diagnostics |
| Log Analytics | `br/public:avm/res/operational-insights/workspace:0.7.0` | Built-in retention, data export |
| Storage | `br/public:avm/res/storage/storage-account:0.14.0` | Built-in PE, encryption, lifecycle |

## Diagnostic Settings (Every Resource Must Have)
```bicep
resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'send-to-law'
  scope: openAI
  properties: {
    workspaceId: logAnalytics.id
    logs: [{ categoryGroup: 'allLogs', enabled: true }]
    metrics: [{ category: 'AllMetrics', enabled: true }]
  }
}
```

## GPU Quota and Compute SKUs

| Workload | Recommended SKU | GPU | Notes |
|----------|----------------|-----|-------|
| Fine-tuning | Standard_NC24ads_A100_v4 | A100 80GB | Check quota: `az vm list-usage` |
| Inference (high) | Standard_NC16as_T4_v3 | T4 16GB | Cost-effective for medium models |
| Inference (low) | Standard_D8s_v5 | None (CPU) | For small models, embeddings |
| AKS node pool | Standard_D16s_v5 | None | System pool — no GPU needed |

## Common Mistakes in Landing Zones

| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Public endpoints on AI services | Data exfiltration risk | Private endpoints + VNet integration |
| API key authentication | Keys can be leaked | Managed Identity + RBAC roles |
| No NSG on subnets | Uncontrolled traffic | NSG with deny-all-inbound default |
| Missing diagnostic settings | No observability | DiagnosticSettings on every resource |
| Hardcoded locations | Can't deploy multi-region | `param location string = resourceGroup().location` |
| No Key Vault for secrets | Secrets in code/config | Key Vault with RBAC, PE, soft delete |
| Over-sized SKUs | Wasted cost | Right-size: start with S1, scale to S3 |
| No budget alerts | Cost surprises | Azure Budget + Action Group alerts |
| Single subscription | Blast radius too large | Separate subs for dev/staging/prod |

## Available Specialist Agents (optional)

| Agent | Use For |
|-------|---------|
| `@builder` | Implement Bicep infrastructure, configure networking, set up RBAC |
| `@reviewer` | Audit security (PE, NSG, RBAC), compliance, WAF alignment |
| `@tuner` | Optimize SKUs, reduce cost, configure monitoring thresholds |

## Slash Commands
| Command | Action |
|---------|--------|
| `/deploy` | Validate + deploy Bicep infrastructure |
| `/test` | Run infrastructure tests (what-if, lint) |
| `/review` | Security + compliance audit |
| `/evaluate` | Evaluate cost, SKU sizing, quota availability |
