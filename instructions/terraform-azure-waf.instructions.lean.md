---
description: "Terraform Azure standards — AVM modules, CALMS framework, modular design."
applyTo: "**/*.tf"
waf:
  - "operational-excellence"
  - "security"
---

# Terraform for Azure — FAI Standards

## AzureRM Provider Configuration

```hcl
terraform {
  required_version = ">= 1.9"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
    azuread = { source = "hashicorp/azuread", version = "~> 3.0" }
    azapi   = { source = "azure/azapi",       version = "~> 2.0" }
  }
}

provider "azurerm" {
  features {
    key_vault { purge_soft_delete_on_destroy = false }
    resource_group { prevent_deletion_if_contains_resources = true }
  }
  skip_provider_registration = true # Use pre-registered providers in enterprise
  use_oidc                   = true # GitHub Actions OIDC — never store SP secrets
}
```

## Remote Backend (Azure Storage)

```hcl
backend "azurerm" {
  resource_group_name  = "rg-terraform-state"
  storage_account_name = "sttfstate${var.environment}"
  container_name       = "tfstate"
  key                  = "${var.project_name}/${var.environment}.tfstate"
  use_oidc             = true
}
```

Lock file (`terraform.lock.hcl`) must be committed. State container uses RBAC — no access keys.

## Resource Naming & Tagging

```hcl
locals {
  name_prefix = "${var.project}-${var.environment}-${var.region_short}"
  common_tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
    CostCenter  = var.cost_center
    Owner       = var.owner_email
  }
}

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.name_prefix}"
  location = var.location
  tags     = local.common_tags
}
```

Follow Azure CAF abbreviations: `rg-`, `st`, `kv-`, `appi-`, `log-`, `vnet-`, `snet-`, `pep-`, `id-`.

## Managed Identity for Provider Auth

```hcl
resource "azurerm_user_assigned_identity" "app" {
  name                = "id-${local.name_prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
}

resource "azurerm_role_assignment" "app_kv_reader" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}
```

Never use service principal secrets. Use OIDC for CI/CD, Managed Identity for workloads.

## Data Sources for Existing Resources

```hcl
data "azurerm_client_config" "current" {}
data "azurerm_subscription" "current" {}
data "azurerm_key_vault" "shared" {
  name                = "kv-shared-${var.environment}"
  resource_group_name = "rg-shared-${var.environment}"
}
```

Reference shared infra via `data` blocks — never import or re-create landing zone resources.

## Key Vault Integration

```hcl
resource "azurerm_key_vault" "main" {
  name                       = "kv-${local.name_prefix}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  enable_rbac_authorization  = true
  purge_protection_enabled   = true
  soft_delete_retention_days = 90
  tags                       = local.common_tags
}

resource "azurerm_key_vault_secret" "api_key" {
  name         = "openai-api-key"
  value        = var.openai_api_key
  key_vault_id = azurerm_key_vault.main.id
}
```

Mark secrets `sensitive = true` in variables. Never output secret values.

## Lifecycle Rules

```hcl
resource "azurerm_key_vault" "main" {
  # ...
  lifecycle {
    prevent_destroy = true # Protect production KV from accidental deletion
  }
}

resource "azurerm_kubernetes_cluster" "main" {
  # ...
  lifecycle {
    ignore_changes = [default_node_pool[0].node_count] # Managed by autoscaler
  }
}
```

## Private Endpoint Pattern

```hcl
resource "azurerm_private_endpoint" "kv" {
  name                = "pep-kv-${local.name_prefix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = azurerm_subnet.private_endpoints.id

  private_service_connection {
    name                           = "psc-kv"
    private_connection_resource_id = azurerm_key_vault.main.id
    subresource_names              = ["vault"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.kv.id]
  }
}
```

All data-plane services (Key Vault, Storage, OpenAI, AI Search) require private endpoints in prod.

## Diagnostic Settings

```hcl
resource "azurerm_monitor_diagnostic_setting" "kv" {
  name                       = "diag-kv-to-law"
  target_resource_id         = azurerm_key_vault.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log { category_group = "allLogs" }
  metric { category = "AllMetrics" }
}
```

Apply diagnostic settings to every deployed resource — use a module to DRY up.

## Azure Policy Assignments

```hcl
resource "azurerm_resource_group_policy_assignment" "require_tags" {
  name                 = "require-cost-center-tag"
  resource_group_id    = azurerm_resource_group.main.id
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/1e30110a-5ceb-460c-a204-c1c3969c6d62"

  parameters = jsonencode({ tagName = { value = "CostCenter" } })
}
```

## AzureAD Provider for RBAC

```hcl
resource "azuread_group" "ai_developers" {
  display_name     = "sg-${var.project}-ai-developers"
  security_enabled = true
}

resource "azurerm_role_assignment" "ai_devs_contributor" {
  scope                = azurerm_resource_group.main.id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azuread_group.ai_developers.object_id
}
```

## Conditional Deployments

```hcl
resource "azurerm_private_endpoint" "openai" {
  count    = var.environment == "prod" ? 1 : 0
  name     = "pep-oai-${local.name_prefix}"
  # ... private endpoints only in prod
}

resource "azurerm_monitor_diagnostic_setting" "all" {
  for_each           = { for r in local.monitored_resources : r.name => r }
  name               = "diag-${each.key}"
  target_resource_id = each.value.id
  # ...
}
```

## AzAPI Provider for Preview Features

```hcl
resource "azapi_resource" "ai_service" {
  type      = "Microsoft.CognitiveServices/accounts@2024-10-01"
  name      = "oai-${local.name_prefix}"
  parent_id = azurerm_resource_group.main.id
  location  = azurerm_resource_group.main.location
  body = {
    kind = "OpenAI"
    sku  = { name = var.openai_sku }
    properties = {
      customSubDomainName = "oai-${local.name_prefix}"
      publicNetworkAccess = var.environment == "prod" ? "Disabled" : "Enabled"
    }
  }
  tags = local.common_tags
}
```

Use AzAPI when AzureRM doesn't yet support a resource type or API version.

## Anti-Patterns

- ❌ Storing `.tfstate` locally or in git — always use remote backend with RBAC
- ❌ Hardcoding subscription IDs, tenant IDs, or secrets in `.tf` files
- ❌ Using `access_key` for storage backend — use OIDC or Managed Identity
- ❌ Skipping `lifecycle { prevent_destroy }` on Key Vault, databases, storage
- ❌ Creating resources in the default provider subscription without explicit scope
- ❌ Using `depends_on` when implicit dependencies via resource references suffice
- ❌ Disabling soft delete or purge protection on Key Vault
- ❌ Deploying without diagnostic settings — blind to failures in production

## WAF Alignment

| Pillar | Terraform Practice |
|---|---|
| **Security** | OIDC auth, Managed Identity, Key Vault RBAC, private endpoints, no secrets in state |
| **Reliability** | `prevent_destroy` on stateful resources, zone-redundant SKUs, state locking |
| **Cost** | `count`/`for_each` for env-conditional resources, right-sized SKUs via variables |
| **Ops Excellence** | Remote state, `terraform plan` in CI, policy-as-code, diagnostic settings |
| **Performance** | Parallelism (`-parallelism=30`), data sources over imports, module caching |
| **Responsible AI** | Content Safety on OpenAI resources, audit logs via diagnostic settings |
