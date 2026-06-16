---
description: "Cloud Adoption Framework — Network domain. Hub-spoke, Azure Firewall, ExpressRoute, Private DNS Resolver, NSGs, Private Endpoints, DDoS Std, Bastion. Enforced by CAF-N-003..011."
applyTo: "**/*.bicep, **/*.bicepparam, **/parameters.json, **/*.tf, **/*.tfvars, **/azure.yaml"
caf:
  - "network"
---

# CAF — Network Domain

When authoring or reviewing IaC for the **Network** plane, enforce these standards. Aligned to FAI's `caf-validator/checks/network.py` (CAF-N-003..011, 9 checks).

## CAF-N-003 — Centralized egress via Azure Firewall / NVA
- For workloads in a spoke VNet, egress to the internet MUST route through `Microsoft.Network/azureFirewalls` (or an NVA) in the hub
- UDR on the spoke MUST set `0.0.0.0/0` next-hop to the firewall private IP
- Forbidden: spoke VNet with a public IP on a non-firewall NIC

## CAF-N-004 — ExpressRoute / VPN Gateway for hybrid
- Hybrid connectivity MUST use `Microsoft.Network/expressRouteCircuits` or `Microsoft.Network/virtualNetworkGateways` with `vpnType=RouteBased`
- No site-to-site over public internet without ExpressRoute or VPN gateway

## CAF-N-005 — Centralized DNS with Private DNS Resolver
- Private DNS zones (`Microsoft.Network/privateDnsZones`) MUST be linked to the hub VNet
- For workloads needing custom on-prem resolution, deploy `Microsoft.Network/dnsResolvers` with inbound + outbound endpoints

## CAF-N-006 — NSGs on every subnet with default-deny
- Every `Microsoft.Network/virtualNetworks/subnets` MUST have an attached `networkSecurityGroup`
- NSG rules MUST include an explicit default-deny rule (priority ≥ 4000, `*` source/destination, action=Deny)
- Forbidden: subnet with no NSG, or NSG without an explicit deny rule

## CAF-N-007 — NSG flow logs + Traffic Analytics
- Every NSG MUST have `Microsoft.Network/networkWatchers/flowLogs` enabled
- Flow logs MUST forward to a Log Analytics workspace with Traffic Analytics enabled

## CAF-N-008 — L7 with Application Gateway / Front Door + WAF
- Public-facing HTTP(S) workloads MUST sit behind `Microsoft.Network/applicationGateways` (with `sku.tier=WAF_v2`) or `Microsoft.Cdn/profiles` (Front Door Premium with WAF policy)
- WAF policy MUST be in `Prevention` mode for production (not `Detection`)

## CAF-N-009 — Private Endpoints + publicNetworkAccess=Disabled
- PaaS resources (Storage, Key Vault, SQL, Cosmos, AI Search, OpenAI, etc.) MUST have at least one `Microsoft.Network/privateEndpoints` AND `publicNetworkAccess: 'Disabled'`
- Forbidden: PaaS resource with `publicNetworkAccess: 'Enabled'` in production

## CAF-N-010 — DDoS Protection Standard
- VNets carrying public-facing workloads MUST link to a `Microsoft.Network/ddosProtectionPlans` resource
- DDoS Standard is mandatory for any subscription with Application Gateway or Front Door

## CAF-N-011 — Bastion for VM admin; no public RDP/SSH
- VM admin access MUST go through `Microsoft.Network/bastionHosts`
- Forbidden: NSG rule allowing public source to ports 22 or 3389
- Forbidden: VM NIC with `publicIPAddress` configured for admin access

## Authoring discipline

- Default to hub-spoke topology — do NOT deploy standalone VNets for production workloads
- All subnet ranges MUST come from a planned address space; document in `parameters.json` comments
- For new VNets, ALWAYS create the matching NSG + flow log resources in the same template
