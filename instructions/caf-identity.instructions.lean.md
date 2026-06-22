---
description: "Cloud Adoption Framework — Identity domain. Entra ID, managed identities, custom RBAC, PIM, Conditional Access, and Entra log centralization patterns enforced by CAF-I-001..011."
applyTo: "**/*.bicep, **/*.bicepparam, **/parameters.json, **/*.tf, **/*.tfvars, **/azure.yaml"
caf:
  - "identity"
---

# CAF — Identity Domain

When authoring or reviewing IaC for the **Identity** plane, enforce these standards. Aligned to FAI's `caf-validator/checks/identity.py` (CAF-I-001..011).

## In-template checks (the validator enforces these on your IaC)

### CAF-I-006 — Managed identities for Azure-to-Azure auth
- Every compute resource that calls another Azure service MUST declare a `SystemAssigned` or `UserAssigned` identity block
- Forbidden: connection strings or SAS tokens for Azure-to-Azure auth
- Required pattern:
  ```bicep
  identity: { type: 'SystemAssigned' }
  ```

### CAF-I-007 — Custom RBAC with scoped assignments
- `Microsoft.Authorization/roleAssignments` MUST reference a `roleDefinitionId` (full resource ID), NOT a literal role name
- `principalId` MUST be a parameter or `reference()` — NEVER a hardcoded GUID
- Assignments MUST be scoped to the smallest resource group / resource that needs them — never subscription-wide unless intentional

### CAF-I-010 — Entra audit + sign-in log centralization
- A `Microsoft.Insights/diagnosticSettings` resource MUST forward Entra audit + sign-in logs to a Log Analytics workspace
- Retention period: minimum 90 days for sign-in logs, 365 days for audit logs

## Out-of-template (tenant-scope) reminders

These CAF controls live in Entra ID admin, NOT in your IaC. Validator marks them N_A but you still own the configuration:

- **CAF-I-001** Single-tenant policy — set at organization-governance level
- **CAF-I-002** On-prem AD sync — configured in Entra Connect / Cloud Sync admin
- **CAF-I-003** MFA enforcement — Conditional Access policy in Entra
- **CAF-I-004** PIM activation policy — Entra Privileged Identity Management
- **CAF-I-005** Conditional Access policies — Entra ID
- **CAF-I-008** Break-glass accounts — Entra-tenant procedure
- **CAF-I-009** Identity Protection risk policies — Entra
- **CAF-I-011** Access reviews — recurring governance process

## Authoring discipline

- Prefer `SystemAssigned` identity over `UserAssigned` unless the same identity is shared across resources
- Never embed credentials in `parameters.json` — use Key Vault references with managed identity fetch
- Pin RBAC role definition IDs to the canonical Azure built-in role GUIDs OR your custom role's full ARM ID
