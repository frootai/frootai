---
name: fai-azure-blob-lifecycle
description: Design and apply Azure Blob Storage lifecycle management policies with tiering to cool/archive, retention rules, and delete-after-N-days automation — reducing storage costs by 70% without manual archival work.
---

# FAI Azure Blob Lifecycle

Creates lifecycle management policies for Azure Blob Storage that automatically tier cold blobs to cool/archive storage and delete expired data. Prevents the common setup mistake: storing everything in hot tier and manually moving objects months later — instead, automate the transition on creation date or last access time.

## When to Invoke

| Signal | Example |
|--------|---------|
| Storage bill is growing unbounded | All blobs remain in hot tier indefinitely |
| Manual archival process exists | Quarterly script to move "old" blobs to archive |
| Compliance requires data deletion | GDPR right-to-be-forgotten after N days |
| RAG chunk storage is expensive | 300GB of embeddings in hot tier |

## Workflow

### Step 1 — Audit Current Blob Population

```python
from azure.storage.blob import BlobServiceClient
from azure.identity import DefaultAzureCredential
from collections import defaultdict
from datetime import datetime, timedelta

client = BlobServiceClient(
    account_url=f"https://{STORAGE_ACCOUNT}.blob.core.windows.net",
    credential=DefaultAzureCredential(),
)

distribution = defaultdict(int)
size_by_tier = defaultdict(lambda: {"count": 0, "bytes": 0})

for container in client.list_containers():
    for blob in client.get_container_client(container.name).list_blobs():
        tier = blob.blob_tier or "hot"
        age_days = (datetime.utcnow() - blob.last_modified).days
        distribution[tier] += 1
        size_by_tier[tier]["count"] += 1
        size_by_tier[tier]["bytes"] += blob.size
        if age_days > 90:
            print(f"{blob.name} ({tier}) — {age_days} days old, {blob.size} bytes")

print(f"\nTier distribution: {dict(distribution)}")
for tier, stats in size_by_tier.items():
    mb = stats["bytes"] / 1024 / 1024
    print(f"  {tier}: {stats['count']} blobs, {mb:.0f} MB")
```

### Step 2 — Define Lifecycle Policy

```json
{
  "rules": [
    {
      "name": "auto-archive-raw-embeddings",
      "enabled": true,
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "baseBlob": {
            "tierToCool": { "daysAfterModificationGreaterThan": 30 },
            "tierToArchive": { "daysAfterModificationGreaterThan": 90 },
            "delete": { "daysAfterModificationGreaterThan": 365 }
          },
          "snapshot": {
            "delete": { "daysAfterCreationGreaterThan": 30 }
          }
        },
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["documents/embeddings/"],
          "blobIndexMatch": [
            {
              "name": "archive-eligible",
              "op": "==",
              "value": "true"
            }
          ]
        }
      }
    }
  ]
}
```

### Step 3 — Apply Policy via Bicep

```bicep
param storageAccountName string
param lifecyclePolicyJson string = loadTextContent('lifecycle-policy.json')

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

resource managementPolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-01-01' = {
  name: 'default'
  parent: storageAccount
  properties: {
    policy: json(lifecyclePolicyJson)
  }
}
```

### Step 4 — Cost Impact Analysis

```python
def estimate_annual_savings(
    hot_gb: float,
    cool_gb: float,
    archive_gb: float,
    region: str = "East US"
) -> dict:
    # Pricing per GB/month (as of Apr 2026)
    prices = {
        "hot": 0.0184,      # $0.0184/GB/month
        "cool": 0.0099,     # $0.0099/GB/month (46% savings)
        "archive": 0.00099, # $0.00099/GB/month (95% savings)
    }
    
    monthly = {
        "hot": hot_gb * prices["hot"],
        "cool": cool_gb * prices["cool"],
        "archive": archive_gb * prices["archive"],
    }
    
    # Baseline: everything in hot
    baseline_monthly = (hot_gb + cool_gb + archive_gb) * prices["hot"]
    
    return {
        "monthly_cost_tiered": sum(monthly.values()),
        "monthly_cost_all_hot": baseline_monthly,
        "annual_savings": (baseline_monthly - sum(monthly.values())) * 12,
    }

savings = estimate_annual_savings(hot_gb=100, cool_gb=200, archive_gb=500)
print(f"Annual savings: ${savings['annual_savings']:.2f}")
```

### Step 5 — Monitor Policy Execution

```kusto
// Azure Data Explorer / Log Analytics query
StorageBlobLogs
| where OperationName == "TransferBlobToCool" or OperationName == "TransferBlobToArchive"
| summarize
    cool_transfers = countif(OperationName == "TransferBlobToCool"),
    archive_transfers = countif(OperationName == "TransferBlobToArchive"),
    total_bytes_moved = sum(tobigint(RequestBodyLength))
    by bin(TimeGenerated, 1d)
| project
    TimeGenerated,
    cool_transfers,
    archive_transfers,
    total_bytes_moved = total_bytes_moved / 1024 / 1024 / 1024
```

## Lifecycle Action Reference

| Action | Trigger | Use Case | Cost |
|--------|---------|----------|------|
| tierToCool | 30 days post-modification | Backup, cold analytics | 46% cheaper |
| tierToArchive | 90 days post-modification | Legal hold, compliance archive | 95% cheaper |
| delete | 365+ days old | GDPR/CCPA right-to-be-forgotten | Zero |

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Cost Optimization | Automatic tiering reduces storage bill by 60-70% without manual work |
| Reliability | Policy rules can be versioned in IaC; rollback by re-applying prior policy |

## Compatible Solution Plays

- **Play 01** — Enterprise RAG (chunk storage cost reduction)
- **Play 02** — AI Landing Zone (centralized storage lifecycle)
- **Play 52** — FinOps AI Dashboard (cost tracking per tier)

## Notes

- Lifecycle policies execute once daily; changes apply at next evaluation cycle (end of day UTC)
- Transitioning a blob to archive incurs an early deletion charge if on hot tier < 30 days or cool < 90 days
- Use blob index tags (Step 2, `blobIndexMatch`) for fine-grained policies without naming conventions
- Archive tier requires rehydration (0-15 hours) before access — don't archive hot-path data
