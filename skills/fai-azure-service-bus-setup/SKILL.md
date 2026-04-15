---
name: fai-azure-service-bus-setup
description: |
  Configure Azure Service Bus queues and topics with dead-letter handling, sessions,
  retry policies, and throughput tuning. Use when building reliable messaging for
  AI pipeline orchestration, async processing, or event-driven architectures.
---

# Azure Service Bus Setup

Configure Service Bus for reliable async messaging with DLQ, sessions, and throughput tuning.

## When to Use

- Building async AI processing pipelines (submit → process → notify)
- Implementing reliable task queues with at-least-once delivery
- Ordering messages with sessions (e.g., per-user conversation history)
- Handling poison messages with dead-letter queues

---

## Bicep Provisioning

```bicep
resource sbNamespace 'Microsoft.ServiceBus/namespaces@2024-01-01' = {
  name: sbName
  location: location
  sku: { name: 'Premium', tier: 'Premium', capacity: 1 }
  identity: { type: 'SystemAssigned' }
  properties: {
    publicNetworkAccess: 'Disabled'
    minimumTlsVersion: '1.2'
    zoneRedundant: true
  }
}

resource queue 'Microsoft.ServiceBus/namespaces/queues@2024-01-01' = {
  name: 'ai-processing'
  parent: sbNamespace
  properties: {
    maxDeliveryCount: 10
    lockDuration: 'PT1M'
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P7D'
    requiresSession: false
    maxSizeInMegabytes: 5120
  }
}

resource topic 'Microsoft.ServiceBus/namespaces/topics@2024-01-01' = {
  name: 'ai-events'
  parent: sbNamespace
  properties: {
    defaultMessageTimeToLive: 'P7D'
    maxSizeInMegabytes: 5120
  }
}
```

## Python Producer

```python
from azure.servicebus import ServiceBusClient, ServiceBusMessage
from azure.identity import DefaultAzureCredential
import json

client = ServiceBusClient(
    fully_qualified_namespace="sb-prod.servicebus.windows.net",
    credential=DefaultAzureCredential(),
)

with client.get_queue_sender("ai-processing") as sender:
    message = ServiceBusMessage(
        json.dumps({"task": "embed-document", "blob_url": "https://..."}),
        content_type="application/json",
        subject="embedding",
        application_properties={"priority": "high"},
    )
    sender.send_messages(message)
```

## Python Consumer with Error Handling

```python
with client.get_queue_receiver("ai-processing", max_wait_time=30) as receiver:
    for msg in receiver:
        try:
            data = json.loads(str(msg))
            process_task(data)
            receiver.complete_message(msg)
        except TransientError:
            receiver.abandon_message(msg)  # Retry later
        except PoisonMessageError:
            receiver.dead_letter_message(msg, reason="Unprocessable",
                error_description="Failed after max retries")
```

## Dead Letter Queue Processing

```python
# Process DLQ messages for investigation
dlq_receiver = client.get_queue_receiver(
    "ai-processing", sub_queue=ServiceBusSubQueue.DEAD_LETTER, max_wait_time=10
)

with dlq_receiver:
    for msg in dlq_receiver:
        print(f"DLQ reason: {msg.dead_letter_reason}")
        print(f"DLQ error: {msg.dead_letter_error_description}")
        # Log, alert, or resubmit after fixing
        dlq_receiver.complete_message(msg)
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Messages stuck in DLQ | maxDeliveryCount too low or unhandled errors | Increase maxDeliveryCount, add error handling patterns |
| Poison message loop | No dead-letter on unprocessable content | Add explicit dead_letter_message call for known-bad data |
| Throughput bottleneck | Single consumer, lock contention | Add concurrent receivers, increase lock duration |
| Session ordering broken | Messages sent without session ID | Set session_id on messages when requiresSession=true |
