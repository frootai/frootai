---
name: fai-azure-cosmos-modeling
description: |
  Model Cosmos DB containers with partition key strategy, RU budgets, indexing policies,
  and consistency levels. Use when designing NoSQL data models for AI applications
  with high throughput and global distribution requirements.
---

# Cosmos DB Data Modeling

Design Cosmos DB containers with optimal partitioning, indexing, and consistency for AI workloads.

## When to Use

- Designing a new Cosmos DB data model for an AI application
- Optimizing partition keys to avoid hot partitions
- Tuning RU consumption with selective indexing
- Choosing consistency levels for multi-region deployments

---

## Container Design

```bicep
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [{ locationName: location, failoverPriority: 0 }]
    capabilities: [{ name: 'EnableServerless' }]  // or use provisioned throughput
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  name: 'appdb'
  parent: cosmosAccount
  properties: { resource: { id: 'appdb' } }
}

resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/sqlContainers@2024-05-15' = {
  name: 'events'
  parent: database
  properties: {
    resource: {
      id: 'events'
      partitionKey: { paths: ['/tenantId'], kind: 'Hash', version: 2 }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [{ path: '/category/?' }, { path: '/timestamp/?' }]
        excludedPaths: [{ path: '/payload/*' }, { path: '/"_etag"/?' }]
      }
      defaultTtl: 7776000  // 90 days in seconds
    }
    options: { autoscaleSettings: { maxThroughput: 10000 } }
  }
}
```

## Partition Key Selection

| Pattern | Good Key | Why |
|---------|----------|-----|
| Multi-tenant SaaS | `/tenantId` | Even distribution, natural isolation |
| IoT telemetry | `/deviceId` | High cardinality, co-located reads |
| E-commerce | `/customerId` | Most queries scoped to one customer |
| Chat/session | `/sessionId` | Co-locates conversation history |
| **Avoid** | `/status`, `/country` | Low cardinality → hot partitions |

## Query with SDK

```python
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential

client = CosmosClient(
    url="https://cosmos-prod.documents.azure.com:443/",
    credential=DefaultAzureCredential()
)
container = client.get_database_client("appdb").get_container_client("events")

# Efficient: partition key in query
items = container.query_items(
    query="SELECT * FROM c WHERE c.tenantId = @tenant AND c.category = @cat",
    parameters=[
        {"name": "@tenant", "value": "tenant-123"},
        {"name": "@cat", "value": "inference"},
    ],
    partition_key="tenant-123",  # Single-partition query = low RU
)

for item in items:
    print(f"{item['id']}: {item['category']}")
```

## Indexing Policy Optimization

Exclude large fields and fields you never filter/sort on:

```json
{
  "indexingMode": "consistent",
  "includedPaths": [
    { "path": "/category/?" },
    { "path": "/timestamp/?" },
    { "path": "/status/?" }
  ],
  "excludedPaths": [
    { "path": "/payload/*" },
    { "path": "/embedding/*" },
    { "path": "/*" }
  ]
}
```

**Rule of thumb:** Exclude everything, then include only paths you query on. This can reduce write RU by 50%+.

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Hot partitions (429s on some) | Low-cardinality partition key | Choose high-cardinality key, use hierarchical partitioning |
| High RU charges | Cross-partition queries or over-indexing | Add partition key to queries, trim indexing policy |
| Stale reads in multi-region | Consistency level too weak | Upgrade from Eventual to Session or Bounded Staleness |
| TTL not deleting expired items | defaultTtl not set or ttl field missing | Set defaultTtl on container, add ttl field to documents |
