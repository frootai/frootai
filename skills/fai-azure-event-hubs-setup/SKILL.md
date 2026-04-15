---
name: fai-azure-event-hubs-setup
description: |
  Configure Azure Event Hubs with partition tuning, capture to storage, checkpointing,
  and consumer group management. Use when building high-throughput streaming pipelines
  for AI telemetry, real-time analytics, or event processing.
---

# Azure Event Hubs Setup

Configure Event Hubs for high-throughput streaming with partitions, capture, and consumer groups.

## When to Use

- Ingesting high-volume telemetry from AI applications
- Building real-time analytics pipelines with streaming data
- Implementing event sourcing patterns
- Connecting to Apache Kafka-compatible workloads

---

## Bicep Provisioning

```bicep
resource namespace 'Microsoft.EventHub/namespaces@2024-01-01' = {
  name: namespaceName
  location: location
  sku: { name: 'Standard', tier: 'Standard', capacity: 2 }
  identity: { type: 'SystemAssigned' }
  properties: {
    publicNetworkAccess: 'Disabled'
    minimumTlsVersion: '1.2'
  }
}

resource eventHub 'Microsoft.EventHub/namespaces/eventhubs@2024-01-01' = {
  name: 'ai-telemetry'
  parent: namespace
  properties: {
    partitionCount: 8
    messageRetentionInDays: 7
    captureDescription: {
      enabled: true
      encoding: 'Avro'
      intervalInSeconds: 300
      sizeLimitInBytes: 314572800  // 300 MB
      destination: {
        name: 'EventHubArchive.AzureBlockBlob'
        properties: {
          storageAccountResourceId: storageAccount.id
          blobContainer: 'event-capture'
          archiveNameFormat: '{Namespace}/{EventHub}/{PartitionId}/{Year}/{Month}/{Day}/{Hour}/{Minute}/{Second}'
        }
      }
    }
  }
}

resource consumerGroup 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2024-01-01' = {
  name: 'analytics-processor'
  parent: eventHub
}
```

## Python Producer

```python
from azure.eventhub import EventHubProducerClient, EventData
from azure.identity import DefaultAzureCredential
import json

producer = EventHubProducerClient(
    fully_qualified_namespace="evh-prod.servicebus.windows.net",
    eventhub_name="ai-telemetry",
    credential=DefaultAzureCredential(),
)

async with producer:
    batch = await producer.create_batch()
    batch.add(EventData(json.dumps({
        "model": "gpt-4o", "tokens": 1500,
        "latency_ms": 800, "timestamp": "2026-04-15T10:30:00Z"
    })))
    await producer.send_batch(batch)
```

## Python Consumer with Checkpointing

```python
from azure.eventhub import EventHubConsumerClient
from azure.eventhub.extensions.checkpointstoreblob import BlobCheckpointStore
from azure.identity import DefaultAzureCredential

checkpoint_store = BlobCheckpointStore(
    blob_account_url="https://storage.blob.core.windows.net",
    container_name="checkpoints",
    credential=DefaultAzureCredential(),
)

consumer = EventHubConsumerClient(
    fully_qualified_namespace="evh-prod.servicebus.windows.net",
    eventhub_name="ai-telemetry",
    consumer_group="analytics-processor",
    credential=DefaultAzureCredential(),
    checkpoint_store=checkpoint_store,
)

async def on_event(partition_context, event):
    data = json.loads(event.body_as_str())
    process_telemetry(data)
    await partition_context.update_checkpoint(event)

async with consumer:
    await consumer.receive(on_event=on_event, starting_position="-1")
```

## Partition Sizing Guide

| Throughput | Partitions | Notes |
|-----------|-----------|-------|
| < 1 MB/s | 2 | Minimum for HA |
| 1-10 MB/s | 4-8 | Standard workloads |
| 10-50 MB/s | 16-32 | High throughput |
| > 50 MB/s | 32+ or Premium | Consider Dedicated tier |

**Important:** Partition count cannot be changed after creation on Standard tier.

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Consumer lag growing | Partitions too few or slow processing | Increase partitions (requires recreate) or optimize consumer |
| Capture files missing | Capture interval not elapsed | Wait for interval or reduce intervalInSeconds |
| Duplicate events | Missing checkpoint after processing | Always checkpoint after successful processing |
| Throttling (429) | Throughput units exceeded | Scale up TU or switch to Premium/Dedicated |
