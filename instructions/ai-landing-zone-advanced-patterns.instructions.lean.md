---
description: "Play 11 patterns — Advanced landing zone — multi-region, ExpressRoute, Azure Firewall, Policy as Code, Defender for Cloud."
applyTo: "**/*.bicep"
waf:
  - "reliability"
  - "security"
---

# Play 11 — AI Landing Zone Advanced Patterns — FAI Standards

## Multi-Region Deployment

Active-active topology with paired regions. Deploy AI workloads to two+ regions behind Azure Front Door. Each region hosts its own AKS cluster, OpenAI endpoint, and data tier.

```bicep
// Multi-region hub-spoke with VNet peering
resource vnetPrimary 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: 'vnet-ai-eastus2'
  location: 'eastus2'
  properties: {
    addressSpace: { addressPrefixes: ['10.0.0.0/16'] }
    subnets: [
      { name: 'snet-aks', properties: { addressPrefix: '10.0.0.0/20' } }
      { name: 'snet-pe', properties: { addressPrefix: '10.0.16.0/24', privateEndpointNetworkPolicies: 'Enabled' } }
    ]
  }
}

resource peeringToSecondary 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2024-05-01' = {
  parent: vnetPrimary
  name: 'peer-to-westus3'
  properties: {
    remoteVirtualNetwork: { id: vnetSecondary.id }
    allowForwardedTraffic: true
    allowGatewayTransit: false
    useRemoteGateways: false
  }
}
```

## Global Load Balancing — Azure Front Door

```bicep
resource frontDoor 'Microsoft.Cdn/profiles@2024-09-01' = {
  name: 'afd-ai-global'
  location: 'global'
  sku: { name: 'Premium_AzureFrontDoor' }  // Required for Private Link origins
}

resource originGroup 'Microsoft.Cdn/profiles/originGroups@2024-09-01' = {
  parent: frontDoor
  name: 'og-ai-api'
  properties: {
    loadBalancingSettings: { sampleSize: 4, successfulSamplesRequired: 3 }
    healthProbeSettings: { probePath: '/health', probeProtocol: 'Https', probeIntervalInSeconds: 30 }
  }
}
```

Failover: set priority-based routing — primary region weight 100, secondary weight 1. Front Door auto-fails over when health probes detect 3+ consecutive failures.

## AKS with GPU Node Pools

```bash
# GPU node pool for model inference — NC-series (T4) or ND-series (A100)
az aks nodepool add \
  --resource-group rg-ai-prod \
  --cluster-name aks-ai-eastus2 \
  --name gpupool \
  --node-count 2 \
  --node-vm-size Standard_NC24ads_A100_v4 \
  --node-taints "sku=gpu:NoSchedule" \
  --labels workload=inference \
  --zones 1 2 3 \
  --max-pods 30 \
  --enable-cluster-autoscaler \
  --min-count 1 --max-count 6

# Install NVIDIA device plugin (required for GPU scheduling)
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.17.0/deployments/static/nvidia-device-plugin.yml
```

Taint GPU nodes to prevent non-GPU workloads from scheduling there. Use `tolerations` + `nodeSelector` in inference pod specs.

## Azure Policy for AI Governance

```bicep
// Deny public network access on Cognitive Services accounts
resource denyPublicAI 'Microsoft.Authorization/policyAssignments@2024-05-01' = {
  name: 'deny-public-ai-endpoints'
  properties: {
    policyDefinitionId: '/providers/Microsoft.Authorization/policyDefinitions/0725b4dd-7e76-479c-a735-68e7ee23d5be'
    displayName: 'Deny public network access on Cognitive Services'
    enforcementMode: 'Default'
  }
}

// Enforce CMK encryption on all storage accounts
resource enforceCMK 'Microsoft.Authorization/policyAssignments@2024-05-01' = {
  name: 'enforce-cmk-storage'
  properties: {
    policyDefinitionId: '/providers/Microsoft.Authorization/policyDefinitions/b5ec538c-daa0-4006-8596-35468b9148e8'
    displayName: 'Storage accounts must use customer-managed keys'
    enforcementMode: 'Default'
  }
}
```

Additional policies to assign: deny HTTP-only traffic, require private endpoints for Key Vault, enforce diagnostic settings on all AI resources.

## Private DNS Zones at Scale

Centralize private DNS in the hub VNet. Link spoke VNets to shared zones:

```bash
# Create and link private DNS zones for AI services
for zone in "privatelink.openai.azure.com" "privatelink.cognitiveservices.azure.com" \
  "privatelink.search.windows.net" "privatelink.vaultcore.azure.net"; do
  az network private-dns zone create -g rg-hub-dns -n "$zone"
  az network private-dns link vnet create -g rg-hub-dns -n "link-eastus2" \
    -z "$zone" -v "$VNET_ID" --registration-enabled false
done
```

Never create per-spoke DNS zones — causes split-brain resolution. One zone, multiple VNet links.

## DDoS Protection & Defender for Cloud

- Enable Azure DDoS Network Protection on hub VNet (covers all linked spoke VNets)
- Enable Microsoft Defender for Cloud: Defender for Containers, Defender for Key Vault, Defender for Resource Manager
- Configure continuous export to Log Analytics for SIEM integration
- Set Secure Score target ≥ 85% — remediate Critical/High findings within 48h

## Key Rotation Automation

```bash
# Key Vault rotation policy — auto-rotate every 90 days, notify 30 days before expiry
az keyvault key rotation-policy update --vault-name kv-ai-prod \
  --name key-openai-cmk \
  --value '{
    "lifetimeActions": [{"trigger":{"timeBeforeExpiry":"P30D"},"action":{"type":"Rotate"}}],
    "attributes": {"expiryTime":"P90D"}
  }'
```

Wire Event Grid subscription on `Microsoft.KeyVault.KeyNearExpiry` to trigger app config refresh. Never manually rotate — policy-driven only.

## Cost Management

- Deploy Azure Budgets per resource group: alert at 80% (email), auto-shutdown dev at 100%
- Use Azure Advisor cost recommendations weekly — right-size underutilized GPU VMs
- PTU reservations for predictable inference loads (>60% utilization threshold)
- Tag all resources: `costCenter`, `environment`, `play` — enforce via Azure Policy
- Review Cosmos RU consumption monthly — switch to serverless for <10K RU/s workloads

## Disaster Recovery

| Metric | Target | Implementation |
| --- | --- | --- |
| RTO | ≤ 15 min | Front Door auto-failover + standby AKS in secondary region |
| RPO | ≤ 5 min | Cosmos DB multi-region writes, Storage GRS replication |
| Failover test | Monthly | Chaos Studio fault injection on primary region |

Backup: Velero for AKS state, Azure Backup for VMs, geo-redundant Key Vault with soft-delete (90-day retention).

## Compliance Frameworks

- **SOC 2 Type II**: Continuous monitoring via Defender for Cloud regulatory compliance dashboard
- **ISO 27001**: Map controls to Azure Policy initiatives (`ISO 27001:2013` built-in)
- **HIPAA**: Audit logging on all AI resources, BAA in place, PHI encryption at rest (CMK) and in transit (TLS 1.3)
- Use Azure Purview for data classification — auto-label sensitive data before AI pipeline ingestion

## Anti-Patterns

- ❌ Single-region deployment for production AI workloads — no DR capability
- ❌ Per-spoke private DNS zones — causes resolution conflicts and split-brain
- ❌ GPU node pools without taints — non-GPU pods consume expensive compute
- ❌ Manual key rotation — missed rotations become audit findings
- ❌ DDoS Basic (default) on production VNets — no SLA, no telemetry, no rapid response
- ❌ Skipping policy enforcement during "fast" deployments — tech debt compounds
- ❌ No budget alerts — GPU costs can 10x overnight from autoscaler misconfiguration

## WAF Alignment

| Pillar | Play 11 Implementation |
| --- | --- |
| **Reliability** | Active-active multi-region, Front Door health probes, Chaos Studio monthly tests, RTO ≤15min / RPO ≤5min |
| **Security** | DDoS Network Protection, Defender for Cloud, private endpoints everywhere, CMK enforcement, key auto-rotation |
| **Cost Optimization** | Budgets + Advisor, PTU for steady-state, GPU autoscaler bounds, resource tagging for chargeback |
| **Operational Excellence** | Policy-as-code governance, centralized DNS, automated compliance dashboards, Event Grid-driven rotation |
| **Performance Efficiency** | AKS GPU pools with zone-spread, Front Door caching, VNet peering low-latency cross-region |
| **Responsible AI** | Content Safety on all endpoints, audit logging for compliance, data classification before AI ingestion |
