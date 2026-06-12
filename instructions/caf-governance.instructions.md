---
description: "Cloud Adoption Framework — Governance domain. Tagging standards, allowed-regions, allowed-SKUs, resource locks, deployIfNotExists guardrails. Enforced by CAF-G-003..008."
applyTo: "**/*.bicep, **/*.bicepparam, **/parameters.json, **/*.tf, **/*.tfvars, **/azure.yaml"
caf:
  - "governance"
---

# CAF — Governance Domain

When authoring or reviewing IaC for the **Governance** plane, enforce these standards. Aligned to FAI's `caf-validator/checks/governance.py` (CAF-G-003..008, 5 enforceable checks).

## CAF-G-003 — Corporate tagging standard via Azure Policy
- MG-scope or subscription-scope templates MUST assign the `Require tag and its value on resources` policy (built-in `1e30110a-5ceb-460c-a204-c1c3969c6d62`) for each required tag
- Standard required tag set: `costcenter`, `workload`, `environment`, `owner`, `dataClassification`
- Forbidden: deploying resources at sub-scope without inheriting these tags

## CAF-G-004 — Restrict allowed regions via Azure Policy
- MG-scope subscriptions MUST assign the `Allowed locations` policy (built-in `e56962a6-4747-49cd-b67b-bf8b01975c4c`)
- Policy parameters MUST list the explicit set of approved regions (e.g. `['westeurope', 'northeurope']`)
- Forbidden: empty / wildcard allowed-regions in production

## CAF-G-005 — Restrict allowed SKUs via Azure Policy
- MG-scope subscriptions MUST assign the `Allowed virtual machine size SKUs` policy (`cccc23c7-8427-4f53-ad12-b6a63eb452b3`) AND the `Allowed storage account SKUs` policy
- SKU lists MUST be parameterized in the assignment, NOT hardcoded in the policy

## CAF-G-007 — Resource locks on production-critical resources
- Production resources MUST have `Microsoft.Authorization/locks` with `level: 'CanNotDelete'` (minimum) or `'ReadOnly'` (for immutable resources)
- Targets that MUST be locked: Key Vault, Storage Accounts with retention data, Log Analytics workspaces, Recovery Services Vaults
- Forbidden: production Key Vault without a `CanNotDelete` lock

## CAF-G-008 — auditIfNotExists / deployIfNotExists guardrails
- MG-scope deployments SHOULD assign at least one `auditIfNotExists` or `deployIfNotExists` policy
- Recommended set: enforce diagnostic settings on Key Vault, App Service, SQL, Storage
- Forbidden: production MG without any DINE policies

## Authoring discipline

- Tags are infrastructure — declare them in `params.json`, not as inline literals scattered through resources
- Use Bicep `targetScope = 'managementGroup'` for governance assignments — never assign at resource-group scope
- When adding a new resource type to a template, check that it inherits tags from the parent RG (or declares its own)
