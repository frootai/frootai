---
name: deploy-ai-landing-zone-advanced
description: "Deploy Advanced Landing Zone — multi-region Bicep with management groups, Azure Firewall, NAT Gateway, DNS zones, Azure Policy, Defender for Cloud. Use when: deploy, provision, configure enterprise infrastructure."
---

# Deploy AI Landing Zone Advanced

## When to Use
- Deploy enterprise-grade multi-region Azure infrastructure
- Configure management group hierarchy with Azure Policy
- Set up hub-spoke networking with Azure Firewall and NAT Gateway
- Configure private DNS zones for AI service endpoints
- Enable Defender for Cloud with compliance standards

## Prerequisites
1. Azure CLI authenticated with **tenant-level** permissions: `az account show`
2. Bicep CLI: `az bicep version`
3. Owner role on target management group (or Contributor + User Access Admin)
4. Azure AD Global Admin or Privileged Role Admin (for MG creation)
5. Sufficient quota in target regions for Firewall, NAT Gateway

## Step 1: Validate Bicep Templates
```bash
az bicep lint -f infra/main.bicep
az bicep build -f infra/main.bicep
az deployment mg validate --management-group-id $MG_ID --location eastus2 \
  --template-file infra/main.bicep --parameters infra/parameters.json
```

## Step 2: Deploy Management Group Hierarchy
```
Root MG
├── Platform MG
│   ├── Identity (Azure AD, Entra ID)
│   ├── Management (Log Analytics, Automation)
│   └── Connectivity (Hub VNet, Firewall, DNS)
├── Landing Zones MG
│   ├── Corp (Internal workloads)
│   ├── Online (Internet-facing)
│   └── AI Workloads (GPU, AI services)
└── Sandboxes MG
    └── Dev/Test (relaxed policies)
```

## Step 3: Deploy Hub Network
| Resource | Configuration | Purpose |
|----------|--------------|---------|
| Hub VNet | 10.0.0.0/16 | Central connectivity |
| Azure Firewall | Premium SKU, IDPS enabled | Traffic inspection |
| NAT Gateway | Standard SKU, 2+ public IPs | Outbound internet |
| VPN/ExpressRoute Gateway | VpnGw2 / ErGw1Az | Hybrid connectivity |
| Bastion Host | Standard SKU | Secure admin access |

## Step 4: Deploy Spoke Networks
```bash
az deployment group create --resource-group $SPOKE_RG \
  --template-file infra/spoke.bicep \
  --parameters spokeName=ai-workload-01 addressPrefix=10.1.0.0/16
```
Spoke subnets: AI Services (private endpoints), Compute (AKS/Container Apps), Data (Storage/DB), Management.

## Step 5: Configure Private DNS Zones
| DNS Zone | Purpose |
|----------|---------|
| `privatelink.openai.azure.com` | Azure OpenAI |
| `privatelink.search.windows.net` | AI Search |
| `privatelink.cognitiveservices.azure.com` | Cognitive Services |
| `privatelink.blob.core.windows.net` | Blob Storage |
| `privatelink.vaultcore.azure.net` | Key Vault |

## Step 6: Deploy Azure Policy Assignments
| Policy | Effect | Scope |
|--------|--------|-------|
| Require private endpoints | Deny | Landing Zones MG |
| Require managed identity | Deny | Landing Zones MG |
| Require encryption at rest | Deny | All MGs |
| Audit public network access | Audit | All MGs |
| Require diagnostic settings | DeployIfNotExists | All MGs |
| Allowed locations | Deny | Landing Zones MG |

## Step 7: Enable Defender for Cloud
- Enable for all resource types (Servers, Storage, SQL, Containers, Key Vault)
- Compliance: CIS Azure Benchmark, NIST 800-53, ISO 27001
- Security contacts + alert notifications
- Just-in-Time VM access + adaptive application controls

## Step 8: Post-Deployment Verification
- [ ] Management group hierarchy matches design
- [ ] Hub VNet with Firewall and NAT Gateway operational
- [ ] Spoke VNets peered and DNS resolving
- [ ] Policy compliance dashboard showing no violations
- [ ] Defender for Cloud reporting (no critical findings)
- [ ] Firewall rules verified (allow AI services, block unauthorized)
- [ ] Diagnostic settings forwarding to central Log Analytics

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| MG deployment fails | Insufficient permissions | Need Owner on parent MG |
| Policy conflict | Existing policy at higher scope | Check inherited assignments |
| DNS resolution fails | VNet not linked to DNS zone | Link spoke VNet to private DNS |
| Firewall blocks AI traffic | Missing FQDN rule | Add *.openai.azure.com rule |
| Peering fails | Overlapping CIDR | Ensure unique address space per VNet |
| Defender false positives | Default rules too strict | Tune alert suppression |
