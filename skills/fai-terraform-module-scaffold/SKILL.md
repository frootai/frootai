---
name: fai-terraform-module-scaffold
description: |
  Scaffold Terraform module projects with variables, outputs, validation rules,
  and automated testing. Use when creating reusable infrastructure modules
  for Azure, AWS, or multi-cloud environments.
---

# Terraform Module Scaffold

Create reusable Terraform modules with validation, outputs, and testing.

## When to Use

- Creating a new Terraform module
- Moving inline resources to reusable modules
- Setting up module testing with terraform test
- Publishing modules to private registry

---

## Module Structure

```
modules/storage-account/
├── main.tf           # Resource definitions
├── variables.tf      # Input variables with validation
├── outputs.tf        # Typed outputs
├── versions.tf       # Provider constraints
├── examples/
│   └── basic/
│       └── main.tf   # Usage example
├── tests/
│   └── basic.tftest.hcl
└── README.md
```

## variables.tf

```hcl
variable "name" {
  type        = string
  description = "Storage account name"
  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.name))
    error_message = "Must be 3-24 lowercase alphanumeric characters."
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
    condition     = contains(["Standard_LRS", "Standard_ZRS", "Standard_GRS"], var.sku)
    error_message = "Must be Standard_LRS, Standard_ZRS, or Standard_GRS."
  }
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
  min_tls_version          = "TLS1_2"
  shared_access_key_enabled = false
  identity { type = "SystemAssigned" }
}
```

## outputs.tf

```hcl
output "id" { value = azurerm_storage_account.this.id }
output "name" { value = azurerm_storage_account.this.name }
output "principal_id" { value = azurerm_storage_account.this.identity[0].principal_id }
```

## Test

```hcl
run "secure_defaults" {
  command = plan
  variables { name = "sttest001"; resource_group_name = "rg-test" }
  assert {
    condition     = azurerm_storage_account.this.min_tls_version == "TLS1_2"
    error_message = "TLS must be 1.2"
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
| Module not found | Wrong source path | Use relative `../modules/` or registry URL |
| State conflict | Multiple users | Use remote backend with locking |
| Output missing | Not declared | Add output block in outputs.tf |
