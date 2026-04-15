---
name: fai-update-avm-bicep
description: "Update Azure Verified Module (AVM) references in Bicep files with safe version pinning, validation, and rollback checks."
---

# FAI Update AVM Bicep

## Purpose

Use this skill to safely upgrade AVM module versions in Bicep templates while preserving deployment compatibility.

## Scope

- AVM module URI updates in br/public:* or private registries
- Version pinning strategy (no floating latest tags)
- Build validation and what-if checks
- Rollback path if schema or behavior changes

## Step 1 - Inventory Current AVM References

```bash
rg "br/(public|.*):avm/" infra/**/*.bicep -n
```

```bicep
module storage 'br/public:avm/res/storage/storage-account:0.18.0' = {
  name: 'storage'
  params: {
    name: storageName
    location: location
  }
}
```

## Step 2 - Choose Upgrade Strategy

| Strategy | When to Use | Risk |
|---------|-------------|------|
| Patch only | Security/bugfix only | Low |
| Minor upgrade | New optional params expected | Medium |
| Major upgrade | Breaking changes tolerated | High |

## Step 3 - Update Module References

```bicep
// Before
module kv 'br/public:avm/res/key-vault/vault:0.12.0' = {
  name: 'kv'
  params: {
    name: kvName
    location: location
  }
}

// After
module kv 'br/public:avm/res/key-vault/vault:0.13.1' = {
  name: 'kv'
  params: {
    name: kvName
    location: location
  }
}
```

## Step 4 - Validate Breaking Param Changes

```bash
az bicep build --file infra/main.bicep
az deployment group what-if --resource-group rg-demo --template-file infra/main.bicep --parameters @infra/main.parameters.json
```

## Step 5 - Apply in Controlled Rollout

1. Dev environment first.
2. Capture what-if output artifact.
3. Promote to staging only if no destructive drift.
4. Promote to prod with explicit approval gate.

## Validation Checklist

| Check | Expected |
|------|----------|
| All AVM modules pinned | No floating latest tags |
| Bicep build | Passes without blocking errors |
| What-if drift | No unintended deletes |
| Parameter files | Still resolve all required params |

## Troubleshooting

| Issue | Cause | Fix |
|------|-------|-----|
| New required param error | Module changed | Add missing params from module README |
| What-if shows deletes | Name/scope shift after upgrade | Align names/scopes or roll back |
| Policy deny after upgrade | New default violates policy | Override secure defaults explicitly |

## Rollback

```bash
git checkout HEAD~1 -- infra/**/*.bicep
az bicep build --file infra/main.bicep
```

## Notes

- Prefer conservative version movement (patch, then minor).
- Keep module URIs explicit and reviewed in PR.
- Store what-if output for deployment auditability.
