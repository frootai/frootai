---
name: fai-tune-11-ai-landing-zone-advanced
description: "Tune Play 11 (AI Landing Zone Advanced) hub-spoke topology, private DNS, governance policies, and network segmentation."
---

# FAI Tune — Play 11: AI Landing Zone Advanced

## TuneKit Configuration Files

```
solution-plays/11-ai-landing-zone-advanced/config/
├── networking.json       # Hub-spoke VNET, NSG, and DNS config
├── governance.json       # Azure Policy and RBAC assignments
├── private-endpoints.json# Private endpoint mappings
├── monitoring.json       # Diagnostic settings and alerts
└── guardrails.json       # Compliance and security thresholds
```

## Step 1 — Validate Hub-Spoke Network Config

```json
// config/networking.json
{
  "hub_vnet": {
    "address_space": "10.0.0.0/16",
    "subnets": {
      "firewall": "10.0.1.0/24",
      "bastion": "10.0.2.0/24",
      "shared-services": "10.0.3.0/24",
      "dns-resolver": "10.0.4.0/24"
    }
  },
  "spoke_vnets": {
    "ai-workload": {
      "address_space": "10.1.0.0/16",
      "subnets": {
        "compute": "10.1.1.0/24",
        "data": "10.1.2.0/24",
        "endpoints": "10.1.3.0/24"
      }
    }
  },
  "peering": {
    "allow_forwarded_traffic": true,
    "allow_gateway_transit": true,
    "use_remote_gateways": false
  },
  "dns": {
    "private_dns_zones": [
      "privatelink.openai.azure.com",
      "privatelink.search.windows.net",
      "privatelink.cognitiveservices.azure.com",
      "privatelink.vaultcore.azure.net"
    ],
    "custom_dns_servers": []
  }
}
```

## Step 2 — Configure Governance Policies

```json
// config/governance.json
{
  "azure_policies": [
    { "name": "deny-public-endpoints", "effect": "Deny", "scope": "subscription" },
    { "name": "require-managed-identity", "effect": "Deny", "scope": "subscription" },
    { "name": "require-diagnostic-settings", "effect": "DeployIfNotExists", "scope": "subscription" },
    { "name": "allowed-locations", "effect": "Deny", "params": { "listOfAllowedLocations": ["eastus", "eastus2", "westus2"] } },
    { "name": "require-encryption-at-rest", "effect": "Deny", "scope": "subscription" }
  ],
  "rbac": {
    "ai_developers": ["Cognitive Services User", "Search Index Data Reader"],
    "ai_admins": ["Cognitive Services Contributor", "Key Vault Administrator"],
    "platform_team": ["Owner", "Network Contributor"]
  },
  "resource_naming": {
    "convention": "{org}-{env}-{service}-{region}",
    "example": "contoso-prod-aoai-eastus"
  }
}
```

## Step 3 — Set Private Endpoint Mappings

```json
// config/private-endpoints.json
{
  "endpoints": [
    { "service": "Azure OpenAI", "subresource": "account", "dns_zone": "privatelink.openai.azure.com" },
    { "service": "AI Search", "subresource": "searchService", "dns_zone": "privatelink.search.windows.net" },
    { "service": "Key Vault", "subresource": "vault", "dns_zone": "privatelink.vaultcore.azure.net" },
    { "service": "Storage", "subresource": "blob", "dns_zone": "privatelink.blob.core.windows.net" },
    { "service": "Cosmos DB", "subresource": "sql", "dns_zone": "privatelink.documents.azure.com" }
  ],
  "subnet": "endpoints",
  "auto_approval": true
}
```

## Step 4 — Set Guardrails

```json
// config/guardrails.json
{
  "security": {
    "public_endpoints_allowed": false,
    "managed_identity_required": true,
    "key_vault_for_secrets": true,
    "encryption_at_rest": true,
    "tls_minimum_version": "1.2"
  },
  "compliance": {
    "data_residency_regions": ["eastus", "eastus2"],
    "audit_log_retention_days": 365,
    "diagnostic_settings_required": true
  },
  "cost": {
    "budget_alert_thresholds": [50, 75, 90, 100],
    "max_monthly_spend_usd": 50000,
    "auto_shutdown_non_prod": true
  }
}
```

## Validation Checklist

| Check | Expected | Command |
|-------|----------|---------|
| Public endpoints | Denied | `jq '.security.public_endpoints_allowed' config/guardrails.json` |
| Managed Identity | Required | `jq '.security.managed_identity_required' config/guardrails.json` |
| Private DNS zones | >=4 | `jq '.dns.private_dns_zones | length' config/networking.json` |
| Governance policies | >=5 | `jq '.azure_policies | length' config/governance.json` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| DNS resolution failures | Private DNS zone not linked | Link DNS zones to hub and spoke VNETs |
| Cannot access AI services | Private endpoint not provisioned | Check `private-endpoints.json` mapping |
| Policy conflicts | Conflicting deny/audit effects | Use DeployIfNotExists for auto-remediation |
| High costs | Non-prod running 24/7 | Enable `auto_shutdown_non_prod: true` |
