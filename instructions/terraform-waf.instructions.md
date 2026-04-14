---
description: "Terraform standards — latest providers, modular design, state safety, and secrets management."
applyTo: "**/*.tf, **/*.tfvars"
waf:
  - "operational-excellence"
  - "security"
  - "reliability"
---

# Terraform — FAI Standards

## Project Structure

```
infra/
├── main.tf              # Root module — orchestrates child modules
├── variables.tf         # Input variables with validation blocks
├── outputs.tf           # Outputs for downstream consumers
├── providers.tf         # Provider config + required_providers
├── backend.tf           # Remote state backend
├── locals.tf            # Computed values, naming conventions
├── moved.tf             # Refactoring moves (never break state)
├── imports.tf           # Brownfield import blocks
├── .tflint.hcl          # Linter rules
├── modules/
│   ├── networking/      # VNet, subnets, NSGs, private endpoints
│   ├── compute/         # VMs, VMSS, AKS, Container Apps
│   └── data/            # Storage, Cosmos DB, SQL, Redis
└── environments/
    ├── dev.tfvars
    ├── staging.tfvars
    └── prod.tfvars
```

- One root module per deployment unit — never mix unrelated resources
- `environments/*.tfvars` for per-env overrides, never `terraform.tfvars` in repo root
- Modules in `modules/` are reusable — no hardcoded environment-specific values

## Provider Pinning

```hcl
terraform {
  required_version = ">= 1.9.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"     # Pessimistic — allows 4.x patches, blocks 5.0
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.0"
    }
  }
}
```

- Pin `required_version` to minimum Terraform CLI — prevents drift across team
- Use pessimistic constraint `~>` to allow patches, block majors
- Run `terraform init -upgrade` explicitly when bumping — never auto-upgrade in CI

## Module Design

```hcl
# modules/compute/variables.tf
variable "sku" {
  type        = string
  description = "VM SKU size"
  validation {
    condition     = can(regex("^Standard_", var.sku))
    error_message = "SKU must start with 'Standard_'."
  }
}

variable "instance_count" {
  type = number
  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 100
    error_message = "instance_count must be 1-100."
  }
}

# modules/compute/outputs.tf — output ALL useful attributes
output "principal_id" {
  value       = azurerm_linux_virtual_machine.main.identity[0].principal_id
  description = "Managed identity principal ID for RBAC assignments"
}

output "private_ip" {
  value = azurerm_network_interface.main.private_ip_address
}
```

- Every variable has `type`, `description`, and `validation` where constraints exist
- Modules output all attributes consumers might need — principal IDs, IPs, resource IDs
- Never expose `sensitive = true` outputs unless downstream requires them

## Locals for Computed Values

```hcl
locals {
  name_prefix = "${var.project}-${var.environment}"
  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
    CostCenter  = var.cost_center
  }
  # Conditional logic belongs in locals, not inline
  sku_tier = var.environment == "prod" ? "Premium" : "Standard"
}
```

## State Management

```hcl
# backend.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "stterraformstate"
    container_name       = "tfstate"
    key                  = "networking.tfstate"
    use_oidc             = true          # Federated identity — no storage keys
  }
}
```

- One state file per deployment unit — networking, compute, data separated
- Enable blob versioning + soft delete on state storage account
- State locking via Azure Blob lease — never disable with `-lock=false`
- Use workspaces only for identical environments, not structurally different stacks

## Sensitive Variables

```hcl
variable "db_password" {
  type      = string
  sensitive = true   # Redacted from plan/apply output and state CLI
}
```

- Mark secrets `sensitive = true` — Terraform redacts from CLI output
- Feed via `TF_VAR_db_password` env var in CI, never in `.tfvars` files
- Prefer Key Vault data sources over passing secrets as variables when possible

## Moved and Import Blocks

```hcl
# moved.tf — refactor without destroy/recreate
moved {
  from = azurerm_resource_group.legacy
  to   = module.platform.azurerm_resource_group.main
}

# imports.tf — adopt existing resources
import {
  to = azurerm_resource_group.main
  id = "/subscriptions/SUB_ID/resourceGroups/rg-existing"
}
```

- `moved` blocks let you restructure modules without state surgery
- `import` blocks (TF 1.5+) replace `terraform import` CLI — declarative, reviewable in PR
- Always run `terraform plan` after adding moved/import to verify no destroy

## CI/CD Workflow

```yaml
# plan on PR, apply on merge to main
- terraform fmt -check -recursive
- terraform init -backend-config=environments/prod.backend.hcl
- terraform validate
- terraform plan -var-file=environments/prod.tfvars -out=tfplan
- checkov -d . --framework terraform --soft-fail-on LOW
- tflint --recursive
# manual approval gate for prod
- terraform apply tfplan
```

- `plan -out=tfplan` then `apply tfplan` — guarantees reviewed plan is what applies
- Never run `apply -auto-approve` in production pipelines
- Use OIDC / workload identity federation for CI auth — no service principal secrets

## Linting and Security Scanning

```hcl
# .tflint.hcl
plugin "azurerm" {
  enabled = true
  version = "0.27.0"
  source  = "github.com/terraform-linters/tflint-ruleset-azurerm"
}

rule "terraform_naming_convention" {
  enabled = true
  format  = "snake_case"
}
```

- `tflint` catches provider-specific issues (deprecated SKUs, invalid regions)
- `checkov` / `tfsec` for security posture — misconfigured NSGs, public IPs, missing encryption
- `terraform-docs` auto-generates module README from variables/outputs — run in pre-commit

## Testing with Terratest

```go
func TestNetworkingModule(t *testing.T) {
    opts := &terraform.Options{
        TerraformDir: "../modules/networking",
        Vars: map[string]interface{}{
            "environment": "test",
            "location":    "eastus2",
        },
    }
    defer terraform.Destroy(t, opts)
    terraform.InitAndApply(t, opts)

    vnetId := terraform.Output(t, opts, "vnet_id")
    assert.Contains(t, vnetId, "/virtualNetworks/")
}
```

- Terratest deploys real infrastructure in isolated subscription, then destroys
- Run in CI on a schedule (nightly), not on every PR — cost and time
- Use `defer Destroy` to guarantee cleanup even on test failure

## Anti-Patterns

- ❌ `terraform apply -auto-approve` in production — bypasses review
- ❌ Storing `.tfstate` locally or in git — state contains secrets, needs locking
- ❌ Hardcoding subscription IDs, tenant IDs, or secrets in `.tf` files
- ❌ Wildcard provider constraints (`version = ">= 3.0"`) — allows breaking upgrades
- ❌ One monolithic state file for entire infrastructure — blast radius too large
- ❌ `terraform taint` instead of `moved` blocks — causes unnecessary destroy/recreate
- ❌ Skipping `terraform plan` review — apply without plan is blind deployment
- ❌ Using `count` for complex conditional resources — use `for_each` with maps instead
- ❌ Inline provider blocks in modules — providers must be passed from root

## WAF Alignment

| Pillar | Terraform Practice |
|--------|--------------------|
| **Security** | OIDC auth for CI, `sensitive = true` on secrets, checkov/tfsec scanning, Key Vault data sources |
| **Reliability** | Remote state with locking, `moved` blocks for safe refactoring, `plan -out` for deterministic apply |
| **Operational Excellence** | `terraform-docs` generation, tflint in pre-commit, fmt/validate in CI, environment-specific tfvars |
| **Cost Optimization** | Right-sized SKUs via variable validation, `locals` for conditional tier selection, Terratest in isolated sub |
| **Performance Efficiency** | Parallelism tuning (`-parallelism=20`), targeted plans (`-target`), split state for independent deploy |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
