---
name: fai-import-iac
description: |
  Import existing Azure resources into Bicep or Terraform state with resource
  mapping, state reconciliation, and drift detection. Use when bringing
  manually-created resources under IaC management.
---

# Import IaC Resources

Import existing Azure resources into Bicep or Terraform for governance.

## When to Use

- Bringing manually-created resources under IaC control
- Migrating from ARM JSON to Bicep
- Importing click-ops resources into Terraform state
- Detecting drift between IaC and actual state

---

## Bicep Import

```bash
# Export existing resource to Bicep
az group export --resource-group rg-prod --include-parameter-default-value > exported.json

# Convert ARM JSON to Bicep
az bicep decompile --file exported.json

# Or generate Bicep for a specific resource
az resource show --ids $RESOURCE_ID --query "{name:name, type:type, properties:properties}" > resource.json
```

## Terraform Import

```bash
# Import existing resource into state
terraform import azurerm_storage_account.main /subscriptions/.../storageAccounts/stprod

# Generate config from state
terraform plan -generate-config-out=generated.tf

# Verify no changes needed
terraform plan  # Should show "No changes"
```

## Import Workflow

```
1. Inventory → List all resources in target RG
2. Map → Match to Bicep/TF resource types
3. Import → Bring into state
4. Validate → Plan shows no drift
5. Iterate → Fix parameter mismatches
6. Commit → Check in IaC files
```

## Drift Detection

```bash
# Bicep: What-if shows drift
az deployment group what-if --resource-group rg-prod --template-file main.bicep

# Terraform: Plan shows drift
terraform plan  # Any non-empty plan = drift
```

## Common Import Issues

```python
IMPORT_MAPPING = {
    "Microsoft.Storage/storageAccounts": "azurerm_storage_account",
    "Microsoft.CognitiveServices/accounts": "azurerm_cognitive_account",
    "Microsoft.KeyVault/vaults": "azurerm_key_vault",
    "Microsoft.Search/searchServices": "azurerm_search_service",
    "Microsoft.Web/sites": "azurerm_linux_web_app",
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Import fails | Resource type not supported | Check provider docs for import support |
| Plan shows changes after import | Config doesn't match actual | Update config to match current state |
| State conflict | Resource already in state | Use `terraform state rm` then reimport |
| Decompile produces warnings | ARM features not in Bicep | Fix manually after decompile |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Start simple, add complexity when needed | Avoid over-engineering |
| Automate repetitive tasks | Consistency and speed |
| Document decisions and tradeoffs | Future reference for the team |
| Validate with real data | Don't rely on synthetic tests alone |
| Review with peers | Fresh eyes catch blind spots |
| Iterate based on feedback | First version is never perfect |

## Quality Checklist

- [ ] Requirements clearly defined
- [ ] Implementation follows project conventions
- [ ] Tests cover happy path and error paths
- [ ] Documentation updated
- [ ] Peer reviewed
- [ ] Validated in staging environment

## Related Skills

- `fai-implementation-plan-generator` — Planning and milestones
- `fai-review-and-refactor` — Code review patterns
- `fai-quality-playbook` — Engineering quality standards
