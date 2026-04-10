---
name: deploy-landing-zone
description: "Deploy AI Landing Zone to Azure — validate Bicep with AVM modules, deploy hub-spoke networking, configure private endpoints, set up RBAC, enable monitoring. Use when: deploy, provision, Bicep, infrastructure, landing zone, networking."
---

# Deploy AI Landing Zone to Azure

## When to Use
- User asks to deploy landing zone infrastructure
- User asks to provision networking, VNets, private endpoints
- User asks to set up Bicep deployment
- User mentions azd, az deployment, infrastructure

## Step 1: Validate Bicep Templates

```bash
# Lint for best practices
az bicep lint --file infra/main.bicep

# Build to check compilation
az bicep build --file infra/main.bicep

# What-if (dry run — shows what will be created/modified)
az deployment sub what-if \
  --location eastus2 \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json
```

## Step 2: Deploy Hub Network

```bash
# Create management group or subscription scope
az deployment sub create \
  --location eastus2 \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --name deploy-landing-zone-$(date +%Y%m%d)
```

### Key Resources Deployed
| Resource | Purpose | AVM Module |
|----------|---------|-----------|
| Hub VNet | Central connectivity (firewall, gateway, bastion) | `avm/res/network/virtual-network` |
| Spoke VNet | AI workload isolation | `avm/res/network/virtual-network` |
| VNet Peering | Hub ↔ Spoke connectivity | (built into VNet module) |
| Azure Firewall | Egress filtering, FQDN rules | `avm/res/network/azure-firewall` |
| Key Vault | Secrets, certificates | `avm/res/key-vault/vault` |
| Log Analytics | Centralized logging | `avm/res/operational-insights/workspace` |
| NSGs | Subnet-level traffic control | `avm/res/network/network-security-group` |

## Step 3: Configure Private Endpoints

For each AI service, create a private endpoint in the PrivateEndpointSubnet:

```bash
# Verify private endpoints are created
az network private-endpoint list \
  --resource-group rg-ai-landing-zone \
  --query "[].{Name:name, Status:privateLinkServiceConnections[0].privateLinkServiceConnectionState.status}" \
  -o table
```

Expected: All endpoints show `Approved` status.

## Step 4: Configure RBAC

```bash
# List current role assignments
az role assignment list --resource-group rg-ai-landing-zone -o table

# Verify least-privilege: no Owner/Contributor on production resources
# Expected roles:
#   Cognitive Services OpenAI User (for apps accessing OpenAI)
#   Search Index Data Reader (for apps querying search)
#   Storage Blob Data Reader (for apps reading documents)
#   Key Vault Secrets User (for apps reading secrets)
```

## Step 5: Verify Networking

```bash
# Check VNet peering status
az network vnet peering list --resource-group rg-hub --vnet-name vnet-hub -o table

# Check NSG rules
az network nsg rule list --resource-group rg-ai-landing-zone --nsg-name nsg-private-endpoints -o table

# Check DNS resolution for private endpoints
nslookup oai-frootai.openai.azure.com  # Should resolve to 10.1.1.x (private IP)
```

## Step 6: Enable Monitoring

```bash
# Verify diagnostic settings on all resources
az monitor diagnostic-settings list --resource /subscriptions/.../openai -o table

# Check Log Analytics workspace is receiving data
az monitor log-analytics query \
  --workspace ws-ai-landing-zone \
  --analytics-query "AzureDiagnostics | take 10" \
  --timespan PT1H
```

## Step 7: Smoke Tests

```bash
# Test private endpoint connectivity from within VNet
az containerapp exec --name app-test --resource-group rg-ai-landing-zone \
  --command "curl -s https://oai-frootai.openai.azure.com/openai/models?api-version=2024-04-01-preview"

# Test Key Vault access
az keyvault secret list --vault-name kv-ai-landing-zone -o table
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Private endpoint DNS not resolving | Private DNS zone not linked to VNet | Link DNS zone to spoke VNet |
| NSG blocking traffic | Missing allow rule for VNet | Add AllowVNetInbound rule |
| RBAC permission denied | Wrong role assigned | Verify role matches service needs |
| Firewall blocking egress | Missing FQDN rule | Add service FQDN to firewall rules |
| Peering not connected | Peering not in Connected state | Re-create peering in both directions |
| Bicep deployment failed | Missing parameter | Check parameters.json completeness |
| Quota exceeded | Region capacity full | Request quota increase or change region |
