---
name: "webhook-ai-event"
description: "Set up webhooks for AI system events: evaluation results, safety alerts, cost alerts"
---

# Webhook AI Event Handling

Wire Azure Event Grid to a FastAPI webhook endpoint that reacts to AI lifecycle events — model deployments, evaluation completions, budget breaches, and content safety alerts. Includes HMAC signature validation, idempotency, dead-letter queuing, and fan-out to multiple subscribers.

## Event Schema

All AI events follow a unified envelope pushed through Event Grid:

```json
{
  "id": "evt_a1b2c3d4",
  "source": "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{acct}",
  "type": "FAI.Model.DeploymentCompleted",
  "time": "2026-04-14T08:30:00Z",
  "subject": "/deployments/gpt-4o-2024-08-06",
  "data": {
    "deploymentName": "gpt-4o-2024-08-06",
    "modelVersion": "2024-08-06",
    "provisionedCapacity": 50,
    "region": "eastus2"
  },
  "dataVersion": "1.0"
}
```

Event types: `FAI.Model.DeploymentCompleted`, `FAI.Evaluation.Completed`, `FAI.Budget.ThresholdExceeded`, `FAI.ContentSafety.Alert`, `FAI.Evaluation.DriftDetected`.

## config/webhooks.json

```json
{
  "endpoint": "https://ai-events.contoso.com/hooks/ai-events",
  "hmacSecret": "${WEBHOOK_HMAC_SECRET}",
  "maxDeliveryAttempts": 5,
  "deadLetterContainer": "failed-events",
  "eventTtlMinutes": 1440,
  "subscribers": [
    { "name": "slack-alerts", "url": "https://hooks.slack.com/services/T00/B00/xxx", "events": ["FAI.Budget.ThresholdExceeded", "FAI.ContentSafety.Alert"] },
    { "name": "eval-dashboard", "url": "https://eval.internal/ingest", "events": ["FAI.Evaluation.Completed", "FAI.Evaluation.DriftDetected"] },
    { "name": "ops-pager", "url": "https://pagerduty.com/integration/abc", "events": ["FAI.ContentSafety.Alert"] }
  ]
}
```

## Webhook Endpoint (FastAPI)

```python
import hashlib, hmac, json, os, httpx
from fastapi import FastAPI, Request, HTTPException, Header
from azure.cosmos.aio import CosmosClient

app = FastAPI()
HMAC_SECRET = os.environ["WEBHOOK_HMAC_SECRET"].encode()
SUBSCRIBERS: list[dict] = json.loads(open("config/webhooks.json").read())["subscribers"]

# --- Cosmos DB for idempotency ---
cosmos = CosmosClient(os.environ["COSMOS_ENDPOINT"], os.environ["COSMOS_KEY"])
db = cosmos.get_database_client("ai-events")
idempotency = db.get_container_client("processed-events")

def verify_signature(payload: bytes, signature: str) -> bool:
    expected = hmac.new(HMAC_SECRET, payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)

async def already_processed(event_id: str) -> bool:
    try:
        await idempotency.read_item(event_id, partition_key=event_id)
        return True
    except Exception:
        return False

async def mark_processed(event_id: str, event_type: str):
    await idempotency.upsert_item({"id": event_id, "type": event_type, "status": "done"})

@app.post("/hooks/ai-events")
async def receive_event(
    request: Request,
    x_eg_signature: str = Header(..., alias="x-eg-signature"),
):
    body = await request.body()

    # Event Grid validation handshake
    events = json.loads(body)
    if events and events[0].get("eventType") == "Microsoft.EventGrid.SubscriptionValidationEvent":
        code = events[0]["data"]["validationCode"]
        return {"validationResponse": code}

    # HMAC signature check
    if not verify_signature(body, x_eg_signature):
        raise HTTPException(status_code=403, detail="Invalid signature")

    for event in events:
        event_id = event["id"]
        event_type = event["eventType"]

        # Idempotency — skip duplicates from Event Grid retries
        if await already_processed(event_id):
            continue

        # Fan-out to matching subscribers
        async with httpx.AsyncClient(timeout=10) as client:
            for sub in SUBSCRIBERS:
                if event_type in sub["events"]:
                    try:
                        resp = await client.post(sub["url"], json=event)
                        resp.raise_for_status()
                    except httpx.HTTPError:
                        pass  # Dead-letter handled by Event Grid retry policy

        await mark_processed(event_id, event_type)

    return {"accepted": len(events)}
```

## Event Grid + Dead-Letter (Bicep)

```bicep
param location string = resourceGroup().location
param webhookUrl string
param storageAccountName string

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource deadLetterContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: '${storageAccountName}/default/failed-events'
}

resource eventGridTopic 'Microsoft.EventGrid/topics@2024-06-01-preview' = {
  name: 'egt-ai-events'
  location: location
  properties: {
    inputSchema: 'EventGridSchema'
  }
}

resource subscription 'Microsoft.EventGrid/topics/eventSubscriptions@2024-06-01-preview' = {
  parent: eventGridTopic
  name: 'sub-ai-webhook'
  properties: {
    destination: {
      endpointType: 'WebHook'
      properties: {
        endpointUrl: webhookUrl
        maxEventsPerBatch: 10
        preferredBatchSizeInKilobytes: 64
      }
    }
    filter: {
      includedEventTypes: [
        'FAI.Model.DeploymentCompleted'
        'FAI.Evaluation.Completed'
        'FAI.Budget.ThresholdExceeded'
        'FAI.ContentSafety.Alert'
        'FAI.Evaluation.DriftDetected'
      ]
    }
    retryPolicy: {
      maxDeliveryAttempts: 5
      eventTimeToLiveInMinutes: 1440
    }
    deadLetterDestination: {
      endpointType: 'StorageBlob'
      properties: {
        resourceId: storage.id
        blobContainerName: 'failed-events'
      }
    }
  }
}

output topicEndpoint string = eventGridTopic.properties.endpoint
output topicKey string = listKeys(eventGridTopic.id, '2024-06-01-preview').key1
```

## Publishing Events (Python Helper)

```python
from azure.eventgrid import EventGridPublisherClient, EventGridEvent
from azure.identity import DefaultAzureCredential
import os, uuid, datetime

client = EventGridPublisherClient(
    os.environ["EVENT_GRID_ENDPOINT"],
    DefaultAzureCredential(),
)

def publish_ai_event(event_type: str, subject: str, data: dict):
    client.send([
        EventGridEvent(
            id=str(uuid.uuid4()),
            event_type=event_type,
            subject=subject,
            data=data,
            data_version="1.0",
            event_time=datetime.datetime.now(datetime.timezone.utc),
        )
    ])

# Example: budget threshold crossed
publish_ai_event(
    event_type="FAI.Budget.ThresholdExceeded",
    subject="/budgets/gpt-4o-monthly",
    data={"currentSpend": 4200.50, "threshold": 4000, "currency": "USD", "model": "gpt-4o"},
)
```

## Monitoring Event Delivery

Query Event Grid delivery metrics and dead-letter backlog with KQL:

```kql
// Failed deliveries in last 24h
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.EVENTGRID"
| where Category == "DeliveryFailures"
| summarize FailCount=count() by bin(TimeGenerated, 1h), resultDescription_s
| render timechart

// Dead-letter volume by event type
StorageBlobLogs
| where OperationName == "PutBlob" and Uri contains "failed-events"
| extend eventType = extract("eventType\":\"([^\"]+)", 1, ResponseBody)
| summarize Count=count() by eventType, bin(TimeGenerated, 1h)
```

Alert rule: fire when `DeliveryFailures > 10` in any 15-minute window or dead-letter container grows beyond 100 blobs.

## Checklist

- [ ] HMAC secret stored in Key Vault, injected via `WEBHOOK_HMAC_SECRET` env var
- [ ] Cosmos DB container has TTL (30 days) on idempotency records
- [ ] Event Grid retry set to 5 attempts / 24h TTL with storage dead-letter
- [ ] Fan-out subscribers configured in `config/webhooks.json` — no hardcoded URLs
- [ ] KQL alert for delivery failures and dead-letter growth wired to Action Group
- [ ] Validation handshake responds to `SubscriptionValidationEvent` for Event Grid setup
