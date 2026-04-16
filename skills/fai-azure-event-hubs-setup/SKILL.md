---
name: fai-azure-event-hubs-setup
description: Configure Azure Event Hubs for real-time data ingestion with stream processing, auto-scaling, Managed Identity auth, and consumer groups — enabling AI workload telemetry at millions of events/second.
---

# FAI Azure Event Hubs

Sets up Event Hubs namespaces with topics (hubs), consumer groups for parallel processing, auto-scaling, and Managed Identity access. Ingests traces, metrics, model outputs, and custom events from distributed AI services. Prevents Kafka SPOF and manual queue management.

## When to Invoke

| Signal | Example |
|--------|---------|
| High-volume telemetry source | Millions of requests/sec from AKS cluster |
| Multiple consumers need same data | Metrics pipeline + machine learning pipeline both need events |
| Manual queue scaling | Message queue grows faster than infrastructure |
| No stream processing pipeline | Events arrive but are not aggregated or transformed |

## Workflow

### Step 1 — Create Event Hubs Namespace

```bicep
// infra/event-hubs.bicep
param location string
param namespaceName string

resource namespace 'Microsoft.EventHub/namespaces@2023-01-01-preview' = {
  name: namespaceName
  location: location
  sku: {
    name: 'Standard'
    capacity: 1
  }
  identity: { type: 'SystemAssigned' }
  properties: {
    publicNetworkAccess: 'Disabled'
    minimumTlsVersion: '1.2'
    zoneRedundant: true
  }
}

// Event Hubs (topics)
resource telemetryHub 'Microsoft.EventHub/namespaces/eventhubs@2023-01-01-preview' = {
  parent: namespace
  name: 'ai-telemetry'
  properties: {
    messageRetentionInDays: 7
    partitionCount: 32        // Auto-scale across partitions
    captureDescription: {
      enabled: true
      encoding: 'Avro'
      destination: {
        name: 'EventHubArchive.AzureBlockBlob'
        properties: {
          storageAccountResourceId: storageAccountId
          blobContainer: 'event-hubs-archive'
          archiveNameFormat: '{Namespace}/{EventHub}/{PartitionId}/{Year}/{Month}/{Day}/{Hour}/{Minute}/{Second}'
        }
      }
    }
  }
}
```

### Step 2 — Create Consumer Groups

```bash
# Consumer group for real-time metrics processor
az eventhubs eventhub consumer-group create \
  --resource-group $RG_NAME \
  --namespace-name $EH_NAMESPACE \
  --eventhub-name ai-telemetry \
  --name metrics-processor

# Consumer group for ML feature extraction
az eventhubs eventhub consumer-group create \
  --resource-group $RG_NAME \
  --namespace-name $EH_NAMESPACE \
  --eventhub-name ai-telemetry \
  --name ml-feature-extractor

# Consumer group for audit/compliance logging
az eventhubs eventhub consumer-group create \
  --resource-group $RG_NAME \
  --namespace-name $EH_NAMESPACE \
  --eventhub-name ai-telemetry \
  --name audit-logger
```

### Step 3 — Send Events via Python

```python
from azure.eventhub import EventHubProducerClient, EventData
from azure.identity import DefaultAzureCredential
import json
import time

producer = EventHubProducerClient(
    fully_qualified_namespace=f"{EH_NAMESPACE}.servicebus.windows.net",
    eventhub_name="ai-telemetry",
    credential=DefaultAzureCredential(),
)

def send_completion_event(request_id: str, latency_ms: int, tokens: int):
    event_data = EventData(
        json.dumps({
            "type": "completion",
            "request_id": request_id,
            "timestamp": time.time(),
            "latency_ms": latency_ms,
            "tokens": tokens,
        })
    )
    
    # Batch send for throughput
    with producer:
        batch = producer.create_batch()
        batch.add(event_data)
        producer.send_batch(batch)
```

### Step 4 — Stream Processing with Azure Stream Analytics

```asql
-- Azure Stream Analytics job query
SELECT
    System.Timestamp('10 second') as window_end,
    COUNT(*) as event_count,
    AVG(latency_ms) as avg_latency,
    MAX(latency_ms) as max_latency,
    SUM(tokens) as total_tokens
INTO
    output_metrics_table
FROM
    event_hub_input TIMESTAMP BY timestamp
GROUP BY
    TumblingWindow(second, 10)
```

### Step 5 — Consumer Group Monitoring

```python
from azure.eventhub import EventHubConsumerClient
from azure.identity import DefaultAzureCredential

consumer = EventHubConsumerClient(
    fully_qualified_namespace=f"{EH_NAMESPACE}.servicebus.windows.net",
    consumer_group="metrics-processor",
    eventhub_name="ai-telemetry",
    credential=DefaultAzureCredential(),
)

def on_event(partition_context, event):
    print(f"Received event from partition {partition_context.partition_id}: {event.body_as_json()}")
    partition_context.update_latest_offset_and_checkpoint(event)

def on_error(partition_context, error):
    print(f"Error in partition {partition_context.partition_id}: {error}")

# Start consuming
consumer.receive(on_event=on_event, on_error=on_error, starting_position="@latest")
```

## Event Hub Scaling Reference

| Metric | Standard (1 TU) | Standard (10 TU) | Premium |
|--------|-----------------|-------------------|---------|
| Max ingress MB/s | 1 MB/s | 10 MB/s | 100 MB/s |
| Max partitions | 32 | 32 | 100 |
| Consumer groups | 20 | 20 | 1000 |
| Retention days | 1-7 | 1-7 | 1-90 |

## Consumer Group Lag Monitoring

```python
from azure.eventhub.aio import EventHubConsumerClient
import asyncio

async def check_consumer_lag():
    client = EventHubConsumerClient(
        fully_qualified_namespace=f"{EH_NAMESPACE}.servicebus.windows.net",
        consumer_group="metrics-processor",
        eventhub_name="ai-telemetry",
        credential=DefaultAzureCredential(),
    )
    
    partition_ids = await client.get_partition_ids()
    
    async with client:
        for pid in partition_ids:
            properties = await client.get_partition_properties(pid)
            last_offset = properties.last_enqueued_offset
            # Consumer lag = (last_offset - consumer_checkpoint) / last_offset
            print(f"Partition {pid}: {properties.last_enqueued_event_number} events")
```

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Performance Efficiency | Event Hubs handles 3M+ events/sec; partitioning enables parallel consumer scaling |
| Reliability | Consumer group offset tracking prevents duplicate/missed message processing |
| Operational Excellence | Archive to Blob Storage enables forensics; auto-scaling handles burst traffic |

## Compatible Solution Plays

- **Play 20** — Real-Time Analytics (event ingestion)
- **Play 17** — AI Observability (metrics collection)
- **Play 05** — IT Ticket Resolution (ticket event stream)

## Notes

- Partition count (Step 1, `partitionCount=32`) must match expected throughput; higher = more parallel consumers
- Consumer group lag indicates processing speed; lag > message retention duration loses events
- Capture feature (Step 1, `captureDescription`) auto-archives to Storage; useful for replay/forensics
- Starting position `@latest` skips backlog; use `@earliest` for catch-up processing
