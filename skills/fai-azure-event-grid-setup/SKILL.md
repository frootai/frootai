---
name: fai-azure-event-grid-setup
description: Configure Azure Event Grid for event-driven AI pipelines with topic subscriptions, dead-letter queues, retry policies, and role-based filtering — routing document uploads to embeddings to RAG queries without polling.
---

# FAI Azure Event Grid

Sets up Event Grid topics and subscriptions for event-driven AI workflows. Routes blob uploads to embedding pipelines, model evaluations to notification services, and failures to dead-letter queues. Prevents the friction of polling-based workflows: wasted compute, race conditions, and N-minute latency before action.

## When to Invoke

| Signal | Example |
|--------|---------|
| Polling for new documents exists | Cron job checks blob storage every 5 minutes |
| End-to-end latency is high | Document uploaded at 10:00, indexed at 10:05 |
| Failure handling is manual | Failed embeding jobs accumulate in a folder |
| Cross-service coordination is complex | Embedding → RAG index → refresh dashboard |

## Workflow

### Step 1 — Create Event Grid Topic

```bicep
// infra/event-grid.bicep
param location string
param topicName string

resource topic 'Microsoft.EventGrid/topics@2023-12-15-preview' = {
  name: topicName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    publicNetworkAccess: 'Disabled'
    inputSchema: 'CloudEventSchema'
  }
}

// System topic for Blob Storage events
resource blobTopic 'Microsoft.EventGrid/systemTopics@2023-12-15-preview' = {
  name: '${storageAccountName}-blob-topic'
  location: location
  properties: {
    source: storageAccountId
    topicType: 'Microsoft.Storage.StorageAccounts'
  }
}
```

### Step 2 — Define Subscriptions

```bicep
// Subscription 1: Route blob uploads to embedding pipeline
resource embeddingSubscription 'Microsoft.EventGrid/topics/eventSubscriptions@2023-12-15-preview' = {
  parent: blobTopic
  name: 'to-embedding-queue'
  properties: {
    destination: {
      endpointType: 'ServiceBusQueue'
      properties: {
        resourceId: embeddingQueueId
      }
    }
    filter: {
      subjectBeginsWith: '/blobServices/default/containers/documents'
      subjectEndsWith: '.pdf'
      includedEventTypes: ['Microsoft.Storage.BlobCreated']
    }
    retryPolicy: {
      maxDeliveryAttempts: 30
      eventTimeToLiveInMinutes: 1440  // 24 hours
    }
    deadLetterDestination: {
      endpointType: 'StorageBlob'
      properties: {
        resourceId: deadLetterStorageId
        blobContainerName: 'event-grid-deadletter'
      }
    }
  }
}

// Subscription 2: Route completion events to notification service
resource notificationSubscription 'Microsoft.EventGrid/topics/eventSubscriptions@2023-12-15-preview' = {
  parent: topic
  name: 'to-notifications'
  properties: {
    destination: {
      endpointType: 'WebHook'
      properties: {
        endpointUrl: 'https://notification-service.azurewebsites.net/webhooks/embedding-complete'
      }
    }
    filter: {
      advancedFilters: [
        {
          operatorType: 'StringIn'
          key: 'data.status'
          values: ['completed']
        },
        {
          operatorType: 'NumberGreaterThan'
          key: 'data.embedding_count'
          value: 100
        }
      ]
    }
  }
}
```

### Step 3 — Emit Custom Events

```python
from azure.eventgrid import EventGridPublisherClient, CloudEvent
from azure.identity import DefaultAzureCredential
import json

client = EventGridPublisherClient(
    endpoint=EVENT_GRID_ENDPOINT,
    credential=DefaultAzureCredential(),
)

# Publish embedding completion event
event = CloudEvent(
    type="ai.embedding.completed",
    source="/embeddings/batch-001",
    data={
        "batch_id": "batch-001",
        "document_id": "doc-12345",
        "embedding_count": 250,
        "status": "completed",
        "duration_ms": 3420,
        "cost_usd": 0.15,
    }
)

client.send(event)
```

### Step 4 — Dead-Letter Queue Processing

```python
from azure.storage.queue import QueueClient
from azure.identity import DefaultAzureCredential
import json

queue_client = QueueClient(
    account_url=f"https://{STORAGE_ACCOUNT}.queue.core.windows.net",
    queue_name="eventgrid-deadletter",
    credential=DefaultAzureCredential(),
)

def process_deadletter():
    """Retry or log failed events."""
    while True:
        message = queue_client.receive_message()
        if not message:
            break
        
        event_data = json.loads(message.content)
        print(f"Dead-lettered event: {event_data['data']['eventType']}")
        print(f"  Reason: {event_data.get('deadLetterReason')}")
        print(f"  Details: {event_data.get('deadLetterErrorCode')}")
        
        # Log to monitoring system or retry with backoff
        queue_client.delete_message(message)
```

### Step 5 — Test Event Distribution

```bash
# Send test event
az eventgrid topic event-subscription test \
  --resource-group $RG_NAME \
  --topic-name $TOPIC_NAME

# Verify events in dead-letter storage
az storage blob list \
  --account-name $DLQ_STORAGE \
  --container-name event-grid-deadletter \
  --query "[].name"

# Monitor subscription metrics
az monitor metrics list \
  --resource "/subscriptions/$SUB_ID/resourceGroups/$RG_NAME/providers/Microsoft.EventGrid/topics/$TOPIC_NAME" \
  --metric MatchedEventCount DeliveryFailureCount \
  --interval PT5M
```

## Event Filter Patterns

| Filter | Example | Use Case |
|--------|---------|----------|
| Subject prefix | `/documents/raw` | Only documents in specific folder |
| Event type | `Microsoft.Storage.BlobCreated` | Only new uploads, not deletes |
| Advanced filter | `data.priority = "high"` | Route based on custom event properties |

## Retry and Dead-Letter Strategy

| Setting | Default | Recommended |
|---------|---------|------------|
| Max delivery attempts | 30 | 30 (exponential backoff to 3600s) |
| Event TTL minutes | 1440 (24h) | 1440 (let Event Grid store for 24h) |
| Dead-letter on first failure | false | true (capture and inspect failures) |

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Reliability | Exponential backoff + dead-letter prevents event loss; retry policy handles transient failures |
| Operational Excellence | Event Grid logs all deliveries; audit trail for compliance |
| Performance Efficiency | Event-driven avoids polling overhead; triggers fire in <5s of event publish |

## Compatible Solution Plays

- **Play 01** — Enterprise RAG (document upload → embedding pipeline)
- **Play 07** — Multi-Agent Service (async agent coordination)
- **Play 20** — Real-Time Analytics (event ingestion)

## Notes

- CloudEventSchema is recommended (vs. EventGridSchema) for CNCF interoperability
- Advanced filters support StringIn, NumberGreaterThan, NumberLessThan, BoolEquals, StringBeginsWith
- Webhook subscriptions require HTTPS and validation handshake on creation
- Dead-letter storage must have a Managed Identity role assignment: `Storage Blob Data Contributor`
