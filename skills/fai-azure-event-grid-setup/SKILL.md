---
name: fai-azure-event-grid-setup
description: |
  Configure Azure Event Grid topics and subscriptions with dead-lettering, retry policies,
  subject filters, and secure webhook delivery. Use when building event-driven architectures
  for AI pipelines or system integration.
---

# Azure Event Grid Setup

Configure Event Grid for reliable event-driven architecture with filtering, retries, and dead-letters.

## When to Use

- Building event-driven AI pipelines (document uploaded → process → index)
- Integrating Azure services via events (Blob → Function → Search)
- Implementing pub/sub patterns with filtering and fanout
- Setting up dead-letter queues for failed event delivery

---

## Bicep Provisioning

```bicep
resource topic 'Microsoft.EventGrid/topics@2024-06-01-preview' = {
  name: topicName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    inputSchema: 'CloudEventSchemaV1_0'
    publicNetworkAccess: 'Disabled'
  }
}

resource subscription 'Microsoft.EventGrid/topics/eventSubscriptions@2024-06-01-preview' = {
  name: 'process-documents'
  parent: topic
  properties: {
    destination: {
      endpointType: 'AzureFunction'
      properties: { resourceId: functionId }
    }
    filter: {
      subjectBeginsWith: '/documents/'
      subjectEndsWith: '.pdf'
      advancedFilters: [{
        operatorType: 'StringIn'
        key: 'data.category'
        values: ['invoice', 'contract', 'report']
      }]
    }
    retryPolicy: { maxDeliveryAttempts: 30, eventTimeToLiveInMinutes: 1440 }
    deadLetterDestination: {
      endpointType: 'StorageBlob'
      properties: {
        resourceId: storageAccount.id
        blobContainerName: 'dead-letters'
      }
    }
  }
}
```

## Publishing Events

```python
from azure.eventgrid import EventGridPublisherClient
from azure.core.messaging import CloudEvent
from azure.identity import DefaultAzureCredential

client = EventGridPublisherClient(
    endpoint="https://topic-prod.eastus-1.eventgrid.azure.net",
    credential=DefaultAzureCredential()
)

event = CloudEvent(
    type="FrootAI.Documents.Uploaded",
    source="/documents/invoices",
    data={"blobUrl": "https://storage.blob.core.windows.net/docs/inv-001.pdf",
          "category": "invoice", "pages": 5},
)

client.send([event])
```

## Event-Driven Pipeline Pattern

```
Blob Upload → Event Grid → Function (extract) → Event Grid → Function (embed) → AI Search
                                                                                      ↓
                                              Dead Letter ← retry failures ← Event Grid
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Dropped events | No dead-letter configured | Enable dead-letter destination on storage |
| Events not matching | Filter too restrictive | Check subject/advanced filters, test with broad filter first |
| Webhook 403 | Validation handshake failed | Implement CloudEvents validation endpoint |
| Duplicate processing | No idempotency in handler | Use event ID for deduplication in consumer |
