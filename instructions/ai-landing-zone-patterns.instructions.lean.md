---
description: "Play 02 patterns — Landing zone patterns — hub-spoke VNet, private endpoints on ALL PaaS, Managed Identity, tag enforcement, GPU quota."
applyTo: "**/*.bicep, **/*.json"
waf:
  - "reliability"
  - "security"
---

# Play 02 — AI Landing Zone Patterns — FAI Standards

## Hub-Spoke Networking

- Hub VNet hosts Azure Firewall, Bastion, VPN/ExpressRoute gateway, and shared DNS private zones
- One spoke VNet per AI workload, peered to hub with `allowForwardedTraffic: true` and `useRemoteGateways: true`
- AI spoke subnets: `snet-pe` (/24) for private endpoints, `snet-app` (/24) for compute, `snet-openai` (/27), `snet-search` (/27)
- NSG on every subnet — default deny-all inbound, explicit allow for required flows only
- UDR forces all spoke egress through Azure Firewall: `0.0.0.0/0 → AzureFirewall`

```bicep
module spokeVnet 'br/public:avm/res/network/virtual-network:0.5.2' = {
  params: {
    name: 'vnet-ai-${env}'
    addressPrefixes: ['10.1.0.0/16']
    peerings: [{ remoteVirtualNetworkResourceId: hubVnet.outputs.resourceId
                 allowForwardedTraffic: true, useRemoteGateways: true }]
    subnets: [
      { name: 'snet-pe', addressPrefix: '10.1.1.0/24' }
      { name: 'snet-app', addressPrefix: '10.1.2.0/24', networkSecurityGroupResourceId: nsg.outputs.resourceId
        routeTableResourceId: udrFirewall.outputs.resourceId }
    ]
  }
}
```

## Private Endpoints & DNS Private Zones

Every PaaS resource gets a private endpoint in `snet-pe` — no public access in stg/prd. Required DNS zones linked to hub VNet: `privatelink.openai.azure.com`, `privatelink.search.windows.net`, `privatelink.blob.core.windows.net`, `privatelink.vaultcore.azure.net`, `privatelink.cognitiveservices.azure.com`.

```bicep
module openaiPe 'br/public:avm/res/network/private-endpoint:0.9.1' = {
  params: {
    name: 'pe-oai-${namePrefix}-${env}'
    subnetResourceId: snetPe.outputs.resourceId
    privateLinkServiceConnections: [{
      privateLinkServiceId: openai.outputs.resourceId, groupIds: ['account']
    }]
    privateDnsZoneGroup: { privateDnsZoneGroupConfigs: [
      { privateDnsZoneResourceId: dnsZoneOpenai.outputs.resourceId }
    ]}
  }
}
```

## Azure Firewall — AI Service FQDNs

Allowlist only required outbound FQDNs from the AI spoke:

```bicep
rules: [
  { name: 'allow-azure-openai', sourceAddresses: ['10.1.0.0/16']
    targetFqdns: ['*.openai.azure.com', '*.cognitiveservices.azure.com']
    protocols: [{ protocolType: 'Https', port: 443 }] }
  { name: 'allow-model-registry', sourceAddresses: ['10.1.0.0/16']
    targetFqdns: ['*.huggingface.co', 'cdn-lfs-us-1.huggingface.co']
    protocols: [{ protocolType: 'Https', port: 443 }] }
]
```

## Managed Identity & RBAC

User-assigned managed identity per workload — never system-assigned for resources shared across apps:

```bicep
module uami 'br/public:avm/res/managed-identity/user-assigned-identity:0.4.1' = {
  params: { name: 'id-${namePrefix}-${env}', location: location, tags: tags }
}
```

| Principal | Resource | Role | Justification |
| --- | --- | --- | --- |
| Workload UAMI | Azure OpenAI | `Cognitive Services OpenAI User` | Data-plane only, no key access |
| Workload UAMI | AI Search | `Search Index Data Reader` | Query-only, no index mutation |
| Workload UAMI | Storage | `Storage Blob Data Reader` | Read chunks/documents |
| Workload UAMI | Key Vault | `Key Vault Secrets User` | Read secrets, no management |
| AI Search MI | Storage | `Storage Blob Data Reader` | Indexer blob crawl |
| DevOps SPN | Resource Group | `Contributor` | Deploy only — no Owner |

```bash
# Assign Cognitive Services OpenAI User to workload UAMI
az role assignment create \
  --assignee-object-id "$(az identity show -n id-ailz-prd -g rg-ailz-prd --query principalId -o tsv)" \
  --role "Cognitive Services OpenAI User" \
  --scope "$(az cognitiveservices account show -n oai-ailz-prd -g rg-ailz-prd --query id -o tsv)" \
  --assignee-principal-type ServicePrincipal
```

## Key Vault & Diagnostic Settings

- Key Vault per environment — RBAC authorization model, soft-delete + purge protection enabled in stg/prd
- Diagnostic settings on every resource → shared Log Analytics workspace (90-day retention minimum):

```bicep
resource diagOpenai 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-${openai.name}'
  scope: openai
  properties: {
    workspaceId: logAnalytics.id
    logs: [{ categoryGroup: 'allLogs', enabled: true }]
    metrics: [{ category: 'AllMetrics', enabled: true }]
  }
}
```

## Resource Naming & Environment Parameters

Convention: `{type}-{workload}-{env}` — e.g., `rg-ailz-prd`, `oai-ailz-prd`, `srch-ailz-prd`, `kv-ailz-prd`, `vnet-hub-prd`, `afw-hub-prd`, `law-ailz-prd`, `id-ailz-prd`. Separate `.bicepparam` files per environment:

```bicep
using './main.bicep'
param env = 'prd'
param location = 'eastus2'
param openaiCapacity = 80            // PTU for prd, PAYG for dev
param searchSku = 'standard'         // basic for dev
param firewallSku = 'Standard'       // Basic for dev
param enablePrivateEndpoints = true  // false acceptable in dev only
param budgetAmount = 5000            // monthly USD alert threshold
param tags = { environment: 'prd', workload: 'ai-landing-zone', costCenter: 'AI-Platform' }
```

## Budget Alerts

```bicep
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'budget-${namePrefix}-${env}'
  properties: {
    amount: budgetAmount
    category: 'Cost'
    timeGrain: 'Monthly'
    timePeriod: { startDate: '2026-01-01' }
    notifications: {
      actual80:    { enabled: true, threshold: 80, contactEmails: alertEmails }
      forecast100: { enabled: true, threshold: 100, thresholdType: 'Forecasted', contactEmails: alertEmails }
    }
  }
}
```

## Anti-Patterns

- ❌ Public endpoints on OpenAI / AI Search / Storage in stg/prd — always use private endpoints
- ❌ System-assigned identity shared across workloads — use one UAMI per workload boundary
- ❌ `Cognitive Services Contributor` at runtime — grants key regeneration; use `OpenAI User` (data-plane only)
- ❌ Flat single VNet — no segmentation, no centralized egress control, blast radius is entire network
- ❌ Missing DNS private zones — private endpoint resolves to public IP without A-record in the zone
- ❌ Key Vault access policies — use RBAC authorization model for auditable, conditional access
- ❌ No diagnostic settings — invisible throttling (HTTP 429), quota exhaustion, unauthorized access attempts
- ❌ Hardcoded CIDRs in modules — parameterize address spaces in `.bicepparam` for multi-env reuse
- ❌ No budget alerts — PTU reservations accrue silently; $10k+ surprise invoices
- ❌ `Owner` role on Cognitive Services — violates least privilege, enables key rotation and network rule changes

## WAF Alignment

| Pillar | AI Landing Zone Implementation |
| --- | --- |
| **Security** | Private endpoints on all PaaS, Firewall egress FQDN filtering, UAMI with least-privilege RBAC, Key Vault RBAC mode, NSG deny-all default |
| **Reliability** | Zone-redundant Firewall + hub VNet, DNS private zones linked to hub, PE connectivity health probes |
| **Cost Optimization** | Budget alerts at 80%/100%, Basic Firewall SKU for dev, PAYG→PTU promotion path, parameterized SKUs per env |
| **Operational Excellence** | Centralized Log Analytics, diagnostic settings on every resource, AVM Bicep modules, `.bicepparam` per env, CI/CD pipelines |
| **Performance Efficiency** | VNet-injected traffic avoids public internet latency, co-located spoke + PaaS in same region, right-sized PE subnets |
| **Responsible AI** | Content Safety service behind private endpoint, 90-day audit log retention, RBAC prevents unauthorized model endpoint access |
