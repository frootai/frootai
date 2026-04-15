---
name: fai-build-terraform-module
description: |
  Author Terraform modules with input validation, typed outputs, secure defaults,
  and automated testing. Use when building reusable infrastructure modules.
---

# Terraform Module Patterns

Build reusable, testable Terraform modules with validation and secure defaults.

## When to Use

- Creating reusable infrastructure modules
- Standardizing provisioning across teams
- Building for a private Terraform registry
- Testing infrastructure changes before apply

---

## Module Structure

```
modules/storage-account/
  main.tf
  variables.tf
  outputs.tf
  versions.tf
  tests/main.tftest.hcl
```

## variables.tf

```hcl
variable "name" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.name))
    error_message = "3-24 lowercase alphanumeric."
  }
}

variable "location" {
  type    = string
  default = "eastus2"
}

variable "sku" {
  type    = string
  default = "Standard_ZRS"
  validation {
    condition     = contains(["Standard_LRS","Standard_ZRS","Standard_GRS"], var.sku)
    error_message = "Invalid SKU."
  }
}

variable "public_access" {
  type    = bool
  default = false
}
```

## main.tf

```hcl
resource "azurerm_storage_account" "this" {
  name                     = var.name
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = replace(var.sku, "Standard_", "")
  allow_nested_items_to_be_public = var.public_access
  shared_access_key_enabled       = false
  min_tls_version                 = "TLS1_2"
  identity { type = "SystemAssigned" }
}
```

## outputs.tf

```hcl
output "id" { value = azurerm_storage_account.this.id }
output "name" { value = azurerm_storage_account.this.name }
output "blob_endpoint" { value = azurerm_storage_account.this.primary_blob_endpoint }
output "principal_id" { value = azurerm_storage_account.this.identity[0].principal_id }
```

## Test

```hcl
run "defaults_are_secure" {
  command = plan
  variables { name = "sttest001"; resource_group_name = "rg-test" }
  assert {
    condition     = azurerm_storage_account.this.min_tls_version == "TLS1_2"
    error_message = "TLS must be 1.2"
  }
  assert {
    condition     = azurerm_storage_account.this.allow_nested_items_to_be_public == false
    error_message = "Public access must be disabled"
  }
}
```

```bash
terraform test
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Validation error | Input doesn't match constraint | Check regex in variables.tf |
| State conflict | No remote backend | Use remote state with locking |
| Drift after apply | Manual portal changes | Run plan in CI to detect |
| Breaking consumers | Changed output names | Version modules, keep old outputs |
