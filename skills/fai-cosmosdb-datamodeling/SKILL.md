---
name: fai-cosmosdb-datamodeling
description: |
  Design Cosmos DB data models with partition strategies, RU optimization,
  indexing policies, and change feed patterns. Use when modeling NoSQL data
  for AI applications needing low-latency global access.
---

# Cosmos DB Data Modeling

Design high-performance Cosmos DB schemas with optimal partitioning and indexing.

## When to Use

- Modeling data for AI apps needing sub-10ms reads
- Designing multi-tenant containers with partition isolation
- Optimizing RU consumption with selective indexing
- Implementing change feed for event-driven processing

---

## Container Design

```bicep
resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/sqlContainers@2024-05-15' = {
  name: 'conversations'
  parent: database
  properties: {
    resource: {
      id: 'conversations'
      partitionKey: { paths: ['/userId'], kind: 'Hash', version: 2 }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [{ path: '/timestamp/?' }, { path: '/status/?' }]
        excludedPaths: [{ path: '/messages/*' }, { path: '/*' }]
      }
      defaultTtl: 7776000
    }
    options: { autoscaleSettings: { maxThroughput: 4000 } }
  }
}
```

## Document Patterns

```json
{
  "id": "conv-abc123",
  "userId": "user-42",
  "title": "RAG pipeline help",
  "status": "active",
  "timestamp": "2026-04-15T10:30:00Z",
  "messages": [
    {"role": "user", "content": "How do I chunk documents?", "ts": "..."},
    {"role": "assistant", "content": "Use recursive splitting at 512 tokens...", "ts": "..."}
  ],
  "metadata": {"model": "gpt-4o", "tokens": 1500}
}
```

## Query Patterns

```python
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential

client = CosmosClient(url, DefaultAzureCredential())
container = client.get_database_client("appdb").get_container_client("conversations")

# Single-partition query (efficient: ~2 RU)
items = container.query_items(
    query="SELECT * FROM c WHERE c.userId = @uid AND c.status = 'active'",
    parameters=[{"name": "@uid", "value": "user-42"}],
    partition_key="user-42",
)

# Cross-partition aggregation (expensive: use sparingly)
stats = container.query_items(
    query="SELECT VALUE COUNT(1) FROM c WHERE c.timestamp > @since",
    parameters=[{"name": "@since", "value": "2026-04-01T00:00:00Z"}],
    enable_cross_partition_query=True,
)
```

## Change Feed for Event Processing

```python
from azure.cosmos import ChangeFeedPolicy

# Process new/updated documents as events
for item in container.query_items_change_feed(
    partition_key_range_id="0", is_start_from_beginning=False
):
    if item.get("status") == "completed":
        trigger_evaluation(item["id"])
```

## Partition Key Selection

| Pattern | Key | Cardinality | RU Impact |
|---------|-----|-------------|-----------|
| Per-user data | /userId | High | Low (scoped reads) |
| Chat sessions | /sessionId | High | Low |
| Multi-tenant | /tenantId | Medium-High | Low |
| Time-series | /deviceId | High | Low |
| **Avoid** | /status | Very Low | Hot partition |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Hot partition 429s | Low-cardinality key | Use high-cardinality partition key |
| High RU on writes | Over-indexing | Exclude large/unqueried paths |
| Stale reads | Eventually consistent | Use Session or Strong consistency |
| Document too large | Unbounded arrays | Cap message array, use continuation docs |
