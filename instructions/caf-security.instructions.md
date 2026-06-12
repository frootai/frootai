---
description: "Cloud Adoption Framework — Security domain. Defender for Cloud, Sentinel, CMK, Key Vault rotation, Azure Policy initiatives, Defender for Endpoint, data-classification tags. Enforced by CAF-S-001..010."
applyTo: "**/*.bicep, **/*.bicepparam, **/parameters.json, **/*.tf, **/*.tfvars, **/azure.yaml"
caf:
  - "security"
---

# CAF — Security Domain

When authoring or reviewing IaC for the **Security** plane, enforce these standards. Aligned to FAI's `caf-validator/checks/security.py` (CAF-S-001..010, 9 enforceable checks).

## CAF-S-001 — Defender for Cloud Standard plans
- `Microsoft.Security/pricings` for `VirtualMachines`, `AppServices`, `SqlServers`, `StorageAccounts`, `KeyVaults`, `Containers`, `Arm` MUST be on `pricingTier: 'Standard'` in production
- Forbidden: leaving a plan on `Free` for any production-tier subscription

## CAF-S-002 — Sentinel SIEM integration
- Tenant SOC subscriptions MUST deploy `Microsoft.OperationsManagement/solutions` with `name` starting `SecurityInsights(`
- Sentinel MUST be linked to the central Log Analytics workspace from CAF-O-001

## CAF-S-003 — Defender regulatory-compliance baselines
- Management-group-scope subscriptions MUST assign at least one regulatory initiative (`Azure Security Benchmark`, `NIST SP 800-53`, `PCI DSS`, or `ISO 27001`)
- Use `Microsoft.Authorization/policyAssignments` with `policyDefinitionId` pointing to the initiative

## CAF-S-004 — CMK encryption for sensitive workloads
- Storage / SQL / Cosmos / Disk Encryption Sets for sensitive workloads MUST use customer-managed keys
- Required pattern:
  ```bicep
  encryption: {
    keySource: 'Microsoft.Keyvault'
    keyvaultproperties: { keyname: ..., keyvaulturi: ..., keyversion: ... }
  }
  ```

## CAF-S-005 — Secrets in Key Vault + managed-identity fetch
- All workload secrets MUST live in `Microsoft.KeyVault/vaults`
- Workload identity (system-assigned or user-assigned) MUST have `get`/`list` on the vault's secrets
- Forbidden: secrets in App Settings, environment variables baked into images, or repo files

## CAF-S-006 — Azure Policy initiatives at MG scope
- MG-scope subscriptions MUST assign at least one `Microsoft.Authorization/policySetDefinitions` (initiative) — not individual policies
- The initiative SHOULD include built-in policies for Tag enforcement (see CAF-G-003) and SKU restrictions (CAF-G-005)

## CAF-S-008 — Defender for Endpoint on VMs + AKS
- VMs and AKS clusters MUST have Defender for Endpoint integration enabled via Defender for Cloud
- AKS clusters MUST have `defenderProfile: { enabled: true }`

## CAF-S-009 — Key rotation policy on KV keys
- Customer-managed keys in Key Vault MUST have a `rotationPolicy` (Bicep: `Microsoft.KeyVault/vaults/keys` with `rotationPolicy` property)
- Rotation cadence: ≤ 1 year (default 90 days for high-sensitivity)

## CAF-S-010 — Data classification + retention tags
- Every storage-class resource (Storage Account, SQL, Cosmos, Data Lake, AI Search) MUST carry tags:
  - `dataClassification`: one of `Public`, `Internal`, `Confidential`, `Restricted`
  - `retentionDays`: integer
- Forbidden: storage resources with no classification tag in production

## Authoring discipline

- Default to CMK for any new storage resource in production templates — only fall back to PMK for ephemeral dev/test
- Always co-deploy `Microsoft.Security/pricings` with the workload, never assume it's pre-enabled at subscription level
- Reference the secrets URI via `getSecret()` or `reference()` — never `concat()` against a literal secret name
