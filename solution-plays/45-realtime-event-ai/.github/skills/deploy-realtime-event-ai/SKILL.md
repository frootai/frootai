---
name: "deploy-realtime-event-ai"
description: "Deploy Real-Time Event AI pipeline — Event Hubs ingestion, batch AI enrichment, anomaly detection, pattern matching, checkpointing, dead letter queue, real-time alerting."
---

# Deploy Real-Time Event AI Pipeline

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.EventHub` (event ingestion)
  - `Microsoft.CognitiveServices` (Azure OpenAI for enrichment)
  - `Microsoft.App` (Container Apps for event consumers)
  - `Microsoft.Storage` (checkpointing + event archive)
  - `Microsoft.KeyVault` (connection strings, API keys)
- Python 3.11+ with `azure-eventhub`, `azure-storage-blob`, `openai` packages
- `.env` file with: `EVENTHUB_CONNECTION_STRING`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `STORAGE_CONNECTION_STRING`

## Step 1: Provision Event Infrastructure

```bash
# Create resource group
az group create --name rg-frootai-realtime-event-ai --location eastus2

# Deploy infrastructure (Event Hubs, OpenAI, Container Apps, Storage, Key Vault)
az deployment group create \
  --resource-group rg-frootai-realtime-event-ai \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

# Store secrets in Key Vault
az keyvault secret set --vault-name kv-event-ai \
  --name eventhub-conn --value "$EVENTHUB_CONNECTION_STRING"
az keyvault secret set --vault-name kv-event-ai \
  --name openai-key --value "$AZURE_OPENAI_KEY"
```

## Step 2: Configure Event Hubs

```bash
# Create Event Hub namespace with partitions for parallel processing
az eventhubs namespace create \
  --name eh-realtime-event-ai \
  --resource-group rg-frootai-realtime-event-ai \
  --sku Standard --capacity 2

# Create event hub with 8 partitions (parallel consumers)
az eventhubs eventhub create \
  --name events \
  --namespace-name eh-realtime-event-ai \
  --resource-group rg-frootai-realtime-event-ai \
  --partition-count 8 \
  --message-retention 7

# Create consumer groups
az eventhubs eventhub consumer-group create \
  --name ai-enrichment --eventhub-name events \
  --namespace-name eh-realtime-event-ai \
  --resource-group rg-frootai-realtime-event-ai

# Create dead letter hub for failed events
az eventhubs eventhub create \
  --name events-dlq \
  --namespace-name eh-realtime-event-ai \
  --resource-group rg-frootai-realtime-event-ai \
  --partition-count 2 --message-retention 14
```

Partition design:
- **8 partitions**: Each processed by a separate consumer instance
- **Partition key**: Use device_id or customer_id for ordering guarantees
- **Consumer groups**: Separate for enrichment, alerting, archiving
- **DLQ**: Failed events stored for 14 days with retry metadata

## Step 3: Deploy Event Processing Pipeline

```python
# event_processor.py — batch event processing with AI enrichment
from azure.eventhub.aio import EventHubConsumerClient
from azure.eventhub.extensions.checkpointstoreblob.aio import BlobCheckpointStore
import asyncio, json

class EventAIProcessor:
    def __init__(self, config):
        checkpoint_store = BlobCheckpointStore.from_connection_string(
            config["storage_conn"], container_name="checkpoints"
        )
        self.client = EventHubConsumerClient.from_connection_string(
            config["eventhub_conn"],
            consumer_group="ai-enrichment",
            eventhub_name="events",
            checkpoint_store=checkpoint_store,
        )
        self.batch_size = config.get("batch_size", 50)
        self.anomaly_threshold = config.get("anomaly_threshold", 0.8)
        self.seen_ids = set()  # Deduplication cache

    async def process_batch(self, partition_context, events):
        batch = []
        for event in events:
            event_id = event.properties.get(b"event_id", b"").decode()
            # Deduplication
            if event_id in self.seen_ids:
                continue
            self.seen_ids.add(event_id)
            batch.append(json.loads(event.body_as_str()))

        if batch:
            # Rule-based enrichment (fast, free)
            enriched = [self.apply_rules(e) for e in batch]

            # LLM enrichment for unknowns only
            unknowns = [e for e in enriched if e.get("classification") == "unknown"]
            if unknowns:
                llm_results = await self.batch_llm_classify(unknowns)
                self.merge_results(enriched, llm_results)

            # Anomaly detection
            for e in enriched:
                score = self.score_anomaly(e)
                if score > self.anomaly_threshold:
                    await self.send_alert(e, score)

            # Store enriched events
            await self.store_batch(enriched)

        # Checkpoint after successful batch
        await partition_context.update_checkpoint()
```

## Step 4: Deploy Anomaly Detection

```python
# anomaly_detector.py — adaptive threshold anomaly detection
import numpy as np
from collections import deque

class AnomalyDetector:
    def __init__(self, config):
        self.window_size = config.get("window_size", 1000)
        self.baseline = deque(maxlen=self.window_size)
        self.sigma_threshold = config.get("sigma_threshold", 3.0)

    def score(self, value: float) -> float:
        """Score anomaly using rolling Z-score."""
        if len(self.baseline) < 10:
            self.baseline.append(value)
            return 0.0

        mean = np.mean(self.baseline)
        std = np.std(self.baseline) or 1e-6
        z_score = abs(value - mean) / std
        self.baseline.append(value)

        # Normalize to 0-1 scale
        return min(z_score / self.sigma_threshold, 1.0)
```

## Step 5: Deploy Container Apps Consumers

```bash
# Build and deploy event consumer
az acr build --registry acrEventAI \
  --image event-ai-processor:latest .

az containerapp create \
  --name event-ai-processor \
  --resource-group rg-frootai-realtime-event-ai \
  --environment event-ai-env \
  --image acrEventAI.azurecr.io/event-ai-processor:latest \
  --min-replicas 2 --max-replicas 8 \
  --cpu 1 --memory 2Gi \
  --secrets eh-conn=keyvaultref:kv-event-ai/eventhub-conn,openai-key=keyvaultref:kv-event-ai/openai-key \
  --env-vars EVENTHUB_CONN=secretref:eh-conn OPENAI_KEY=secretref:openai-key \
  --scale-rule-name event-scale \
  --scale-rule-type azure-eventhubs \
  --scale-rule-metadata "connectionFromEnv=EVENTHUB_CONN" "consumerGroup=ai-enrichment" "unprocessedEventThreshold=100"
```

Scaling rules:
- **Min replicas**: 2 (always processing)
- **Max replicas**: 8 (one per partition)
- **Scale trigger**: Unprocessed events > 100 per partition
- **Scale-down delay**: 5 minutes (avoid flapping)

## Step 6: Configure Alerting

```json
// config/alerts.json
{
  "channels": {
    "teams": { "webhook_url": "${TEAMS_WEBHOOK}", "enabled": true },
    "email": { "recipients": ["ops@contoso.com"], "enabled": true },
    "pagerduty": { "routing_key": "${PAGERDUTY_KEY}", "enabled": false }
  },
  "rules": {
    "anomaly_alert": {
      "threshold": 0.8,
      "cooldown_seconds": 300,
      "aggregate_window_seconds": 60,
      "min_events_to_alert": 3
    },
    "throughput_alert": {
      "min_events_per_minute": 100,
      "max_lag_seconds": 30
    }
  }
}
```

## Step 7: Verify Deployment

```bash
# Health check
curl https://event-ai-processor.azurecontainerapps.io/health

# Send test events
python tests/send_test_events.py --count 100 --rate 10/sec

# Verify enrichment
az eventhubs eventhub show --name events \
  --namespace-name eh-realtime-event-ai \
  --resource-group rg-frootai-realtime-event-ai

# Check checkpoint progress
az storage blob list --container-name checkpoints \
  --account-name steventai --query "[].name" -o tsv
```

## Verification Checklist

| Check | Command | Expected |
|-------|---------|----------|
| Event Hub active | `az eventhubs eventhub show` | Active, 8 partitions |
| DLQ created | Show DLQ hub | Active, 2 partitions |
| Consumers running | Container Apps replicas | 2-8 replicas |
| Events flowing | Send 100 test events | All processed |
| Checkpointing | Check blob store | Checkpoint blobs per partition |
| Deduplication | Send duplicate events | Duplicates filtered |
| Anomaly detection | Send anomalous event | Alert triggered |
| DLQ routing | Send malformed event | Event in DLQ |
| Auto-scaling | Send burst (1000 events) | Replicas scale up |
| Key Vault access | Managed identity check | Secrets resolved |

## Rollback Procedure

```bash
# Revert consumer container
az containerapp revision list --name event-ai-processor \
  --resource-group rg-frootai-realtime-event-ai
az containerapp ingress traffic set --name event-ai-processor \
  --resource-group rg-frootai-realtime-event-ai \
  --revision-weight previousRevision=100

# Reset checkpoints (reprocess from beginning — use with caution)
az storage blob delete-batch --source checkpoints \
  --account-name steventai --pattern "*"
```
