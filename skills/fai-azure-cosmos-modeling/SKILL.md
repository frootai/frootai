---
name: fai-azure-cosmos-modeling
description: Design Cosmos DB data models with optimal partition keys, Request Unit (RU) estimation, vector search embedding storage, and analytical workload isolation — exceeding relational DB performance on RAG and time-series queries.
---

# FAI Azure Cosmos DB Modeling

Designs Cosmos DB schemas that maximize throughput, minimise cross-partition queries, and integrate vector search for RAG workloads. Prevents data model mistakes: wrong partition key causing hot partitions, no analytical isolation leading to OLTP query degradation, and oversized RU provisioning.

## When to Invoke

| Signal | Example |
|--------|---------|
| Query latency is high | Conversation history queries touching 100M docs |
| RU usage spikes unpredictably | Partition is hot; some sessions timeout |
| Vector search results are slow | 10M embeddings in same partition as chat history |
| Analytical queries block OLTP | Long-running aggregation on prod container |

## Workflow

### Step 1 — Partition Key Selection

```python
def analyze_partition_distribution(documents: list[dict]) -> dict:
    """Score potential partition keys."""
    scores = {}
    
    # Candidate 1: userId (high cardinality)
    user_ids = len(set(d["userId"] for d in documents))
    avg_docs_per_user = len(documents) / user_ids
    scores["userId"] = {
        "cardinality": user_ids,
        "avg_docs_per_partition": avg_docs_per_user,
        "hot_partition_risk": "LOW" if avg_docs_per_user < 1000 else "HIGH",
    }
    
    # Candidate 2: date (temporal)
    dates = len(set(d["date"][:10] for d in documents))
    avg_docs_per_date = len(documents) / dates
    scores["date"] = {
        "cardinality": dates,
        "avg_docs_per_partition": avg_docs_per_date,
        "hot_partition_risk": "MEDIUM",  # Today's partition is always hot
    }
    
    # Candidate 3: category (low cardinality) — AVOID
    categories = len(set(d["category"] for d in documents))
    scores["category"] = {
        "cardinality": categories,
        "risk": "DO NOT USE — too few partitions will cause imbalance"
    }
    
    return {k: v for k, v in sorted(scores.items(), 
            key=lambda x: x[1].get("cardinality", 0), reverse=True)}
```

### Step 2 — Container Design for RAG

```python
from azure.cosmos import CosmosClient

client = CosmosClient(COSMOS_ENDPOINT, DefaultAzureCredential())
database = client.get_database_client(DATABASE_NAME)

# Container 1: Embeddings (vector search heavy)
embeddings_container = database.create_container(
    id="embeddings",
    partition_key="/user_id",       # Separate by user for multi-tenancy
    indexing_policy={
        "indexingMode": "consistent",
        "included_paths": [
            {"path": "/user_id"},
            {"path": "/vector_.*",  "kind": "VectorIndex"},
        ],
        "vector_indexes": [{
            "path": "/vector_embedding",
            "dimensions": 3072,
            "similarity": "cosine",
        }]
    }
)

# Container 2: Conversation history (OLTP)
history_container = database.create_container(
    id="conversations",
    partition_key="/session_id",    # One session = one partition
    indexing_policy={
        "included_paths": [
            {"path": "/session_id"},
            {"path": "/timestamp"},
        ]
    }
)

# Container 3: Aggregated metrics (analytical workload isolation)
metrics_container = database.create_container(
    id="metrics",
    partition_key="/date",          # Temporal partitioning
    throughput=400,                 # Shared throughput for analytics
)
```

### Step 3 — RU Estimation

```python
def estimate_daily_rus(
    sessions_per_day: int = 1000,
    embeddings_per_session: int = 10,
    history_lookback_days: int = 30,
) -> dict:
    """Estimate daily RU consumption."""
    
    # Embedding search: 2 RU per query
    embedding_searches = sessions_per_day * embeddings_per_session
    embedding_rue = embedding_searches * 2
    
    # History read (paginate through chat): 3 RU per page * sessions
    history_pages = sessions_per_day * 3
    history_rue = history_pages * 3
    
    # Daily aggregation query: 100 RU once per day
    aggregation_rue = 100
    
    total_hourly = (embedding_rue + history_rue + aggregation_rue) / 24
    total_daily = embedding_rue + history_rue + aggregation_rue
    
    return {
        "embedding_searches_daily": embedding_searches,
        "embedding_rue": embedding_rue,
        "history_rue": history_rue,
        "aggregation_rue": aggregation_rue,
        "total_daily_rue": total_daily,
        "recommended_provisioned_rue": total_daily * 1.3,  # 30% headroom
    }

est = estimate_daily_rus()
print(f"Estimated daily RU: {est['total_daily_rue']}")
print(f"Recommended provisioned: {est['recommended_provisioned_rue']}")
```

### Step 4 — Query Patterns and Indexes

```python
# Pattern 1: Vector similarity search (5 most relevant)
vector_query = """
    SELECT c.id, c.text, VectorDistance(c.vector_embedding, @input_vector) as distance
    FROM c
    WHERE c.user_id = @user_id
    ORDER BY distance
    OFFSET 0 LIMIT 5
"""

# Pattern 2: Conversation history with pagination
history_query = """
    SELECT c.id, c.message, c.role, c.timestamp
    FROM c
    WHERE c.session_id = @session_id
    ORDER BY c.timestamp DESC
    OFFSET @offset LIMIT 20
"""

# Add composite index for pattern 2
indexing_policy = {
    "composite_indexes": [[
        {"path": "/session_id", "order": "ascending"},
        {"path": "/timestamp", "order": "descending"},
    ]]
}
```

### Step 5 — Partition Size and Lifecycle

```bicep
// infra/cosmos-containers.bicep
param databaseName string
param containerName string

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  name: '${accountName}/${databaseName}/${containerName}'
  properties: {
    resource: {
      id: containerName
      partitionKey: { paths: ['/user_id'] }
      maxClientForwardedByteSize: 100  // Keep partitions < 100GB
      indexingPolicy: { indexingMode: 'consistent' }
    }
    options: { throughput: 4000 }
  }
}

// Time-to-live: auto-delete old embeddings after 90 days
resource ttl 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/ttl@2023-04-15' = {
  name: '${containerName}/default'
  properties: {
    ttl: 7776000  // 90 days in seconds
  }
}
```

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Performance Efficiency | Vector indexes enable <100ms similarity search on 10M embeddings |
| Cost Optimization | Correct partition key avoids hot partitions and RU waste |
| Reliability | Temporal partitioning (analytics isolated) prevents OLTP query interference |

## Compatible Solution Plays

- **Play 01** — Enterprise RAG (conversation + embedding storage)
- **Play 20** — Real-Time Analytics (time-series data)
- **Play 02** — AI Landing Zone (shared database infrastructure)

## Notes

- Partition key should have cardinality >= number of documents / 10GB partition max
- Vector indexes require dimension count to match embedding model output exactly
- Hot partition risk increases if avg docs per partition > 1000; consider multiple partition keys
- TTL policy prevents unbounded container growth for conversation history
