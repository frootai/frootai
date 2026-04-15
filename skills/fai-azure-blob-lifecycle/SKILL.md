---
name: fai-azure-blob-lifecycle
description: |
  Configure Azure Blob Storage lifecycle policies for automatic tiering, retention
  enforcement, legal hold, and archival cost optimization. Use when managing large-scale
  blob data with cost and compliance requirements.
---

# Azure Blob Lifecycle Management

Automate blob tiering, retention, and deletion with lifecycle management policies.

## When to Use

- Managing large volumes of blob data (logs, documents, backups)
- Reducing storage costs by tiering cold data to Cool/Archive
- Enforcing retention policies for compliance (HIPAA, SOX, GDPR)
- Setting up immutable storage for audit trails

---

## Lifecycle Policy

```json
{
  "rules": [
    {
      "name": "cool-after-30-days",
      "type": "Lifecycle",
      "definition": {
        "filters": { "blobTypes": ["blockBlob"], "prefixMatch": ["documents/"] },
        "actions": {
          "baseBlob": { "tierToCool": { "daysAfterModificationGreaterThan": 30 } }
        }
      }
    },
    {
      "name": "archive-after-90-days",
      "type": "Lifecycle",
      "definition": {
        "filters": { "blobTypes": ["blockBlob"], "prefixMatch": ["documents/"] },
        "actions": {
          "baseBlob": { "tierToArchive": { "daysAfterModificationGreaterThan": 90 } }
        }
      }
    },
    {
      "name": "delete-old-versions",
      "type": "Lifecycle",
      "definition": {
        "filters": { "blobTypes": ["blockBlob"] },
        "actions": {
          "version": { "delete": { "daysAfterCreationGreaterThan": 365 } }
        }
      }
    }
  ]
}
```

## Bicep Deployment

```bicep
resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  name: 'default'
  parent: storageAccount
  properties: {
    policy: {
      rules: [
        {
          name: 'cool-after-30'
          type: 'Lifecycle'
          definition: {
            filters: { blobTypes: ['blockBlob'], prefixMatch: ['documents/'] }
            actions: {
              baseBlob: { tierToCool: { daysAfterModificationGreaterThan: 30 } }
            }
          }
        }
      ]
    }
  }
}
```

## Immutable Storage for Compliance

```bash
# Enable versioning (required for immutability)
az storage account blob-service-properties update \
  --account-name $ACCOUNT --enable-versioning true

# Set time-based immutability policy (7 years for SOX)
az storage container immutability-policy create \
  --account-name $ACCOUNT --container-name audit-logs \
  --period 2556  # days (~7 years)
```

## Cost Optimization Table

| Tier | Cost (per GB/mo) | Access Cost | Use Case |
|------|-----------------|-------------|----------|
| Hot | $$$ | Low | Active data, frequent reads |
| Cool | $$ | Medium | Infrequent access (>30 days) |
| Cold | $ | Higher | Rare access (>90 days) |
| Archive | ¢ | Very High + rehydration delay | Compliance, long-term backup |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Unexpected data deletion | Aggressive delete rule | Increase retention days and add soft delete safety net |
| Tiering not happening | Policy not applied or wrong prefix | Verify prefixMatch and check policy execution logs |
| Stuck in archive tier | Rehydration not started | Use SetBlobTier with rehydration priority (Standard/High) |
| Compliance audit failure | No immutability proof | Enable immutable storage with legal hold on audit containers |
