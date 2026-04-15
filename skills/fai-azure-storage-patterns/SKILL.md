---
name: fai-azure-storage-patterns
description: |
  Apply Azure Storage design patterns for blobs, queues, tables, and files with
  lifecycle management, private access, SAS policies, and replication strategies.
  Use when designing storage architecture for AI data pipelines.
---

# Azure Storage Patterns

Design patterns for blobs, queues, tables, and files with security and lifecycle management.

## When to Use

- Designing blob storage for AI training data and document pipelines
- Implementing queue-based async processing patterns
- Setting up storage with private endpoints and SAS policies
- Configuring lifecycle tiering for cost optimization

---

## Bicep: Hardened Storage Account

```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_ZRS' }
  identity: { type: 'SystemAssigned' }
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false    // Force AAD/MI auth
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny' }
    supportsHttpsTrafficOnly: true
  }
}
```

## Pattern 1: Blob Upload with MI

```python
from azure.storage.blob import BlobServiceClient
from azure.identity import DefaultAzureCredential

client = BlobServiceClient(
    account_url="https://storageai.blob.core.windows.net",
    credential=DefaultAzureCredential(),
)

container = client.get_container_client("documents")
with open("report.pdf", "rb") as f:
    container.upload_blob("reports/2026/report.pdf", f, overwrite=True,
        metadata={"category": "invoice", "processed": "false"})
```

## Pattern 2: Queue-Based Async Processing

```python
from azure.storage.queue import QueueServiceClient
import json, base64

queue_client = QueueServiceClient(
    account_url="https://storageai.queue.core.windows.net",
    credential=DefaultAzureCredential(),
).get_queue_client("processing-tasks")

# Enqueue
message = json.dumps({"blob": "reports/2026/report.pdf", "action": "embed"})
queue_client.send_message(base64.b64encode(message.encode()).decode())

# Dequeue and process
for msg in queue_client.receive_messages(max_messages=5, visibility_timeout=60):
    task = json.loads(base64.b64decode(msg.content))
    process(task)
    queue_client.delete_message(msg)
```

## Pattern 3: SAS Token with Short Expiry

```python
from azure.storage.blob import generate_blob_sas, BlobSasPermissions
from datetime import datetime, timedelta, timezone

sas = generate_blob_sas(
    account_name="storageai",
    container_name="documents",
    blob_name="reports/2026/report.pdf",
    account_key=None,  # Use user delegation key with MI instead
    permission=BlobSasPermissions(read=True),
    expiry=datetime.now(timezone.utc) + timedelta(hours=1),
)
url = f"https://storageai.blob.core.windows.net/documents/reports/2026/report.pdf?{sas}"
```

## Lifecycle Management

```json
{
  "rules": [
    { "name": "cool-30d", "type": "Lifecycle", "definition": {
        "filters": { "blobTypes": ["blockBlob"], "prefixMatch": ["documents/"] },
        "actions": { "baseBlob": { "tierToCool": { "daysAfterModificationGreaterThan": 30 }}}
    }},
    { "name": "archive-90d", "type": "Lifecycle", "definition": {
        "filters": { "blobTypes": ["blockBlob"], "prefixMatch": ["documents/"] },
        "actions": { "baseBlob": { "tierToArchive": { "daysAfterModificationGreaterThan": 90 }}}
    }}
  ]
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Unexpected cost growth | No lifecycle tiering | Add Cool/Archive transitions |
| 403 on blob access | Shared key disabled, MI role missing | Grant Storage Blob Data Contributor |
| SAS token abuse | Long expiry or broad permissions | Use user delegation SAS with 1-hour max |
| Queue poison messages | No max dequeue count | Set dequeueCount limit, move to poison queue |
