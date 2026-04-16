---
name: fai-azure-data-explorer
description: Configure Azure Data Explorer for real-time telemetry ingestion with KQL queries, time-series aggregations, and interactive dashboards — analyzing AI workload metrics and traces at petabyte scale.
---

# FAI Azure Data Explorer

Provisions Azure Data Explorer (Kusto) for real-time telemetry analysis of AI workloads. Ingests AI metrics, traces, logs, and custom events at scale; enables KQL queries for latency analysis, token usage trends, and cost attribution. Prevents the friction of Log Analytics limitations on large-scale time-series data.

## When to Invoke

| Signal | Example |
|--------|---------|
| Log Analytics query times out | 30-day retention of 1TB/day ingestion exceeds limits |
| Token/cost attribution needed | "Which customers consumed the most GPT-4o tokens?" |
| Real-time alerting required | Detect anomalies in inference latency in < 5 seconds |
| Custom telemetry beyond logs | Model A/B test metrics, embedding quality scores |

## Workflow

### Step 1 — Create Data Explorer Cluster

```bicep
// infra/data-explorer.bicep
param clusterName string
param location string = 'eastus'

resource cluster 'Microsoft.Kusto/clusters@2023-08-15' = {
  name: clusterName
  location: location
  sku: {
    name: 'Standard_D13_v2'
    capacity: 2
  }
  identity: { type: 'SystemAssigned' }
  properties: {
    enableStreamingIngest: true
    purgeEnabled: true
    enableDiskEncryption: true
  }
}

resource database 'Microsoft.Kusto/clusters/databases@2023-08-15' = {
  parent: cluster
  name: 'ai-telemetry'
  kind: 'ReadWrite'
  properties: {
    softDeletePeriod: 'P365D'      // 1-year retention for compliance
  }
}
```

### Step 2 — Define Telemetry Schema

```kusto
// DDL: Create tables for AI workload metrics
.create table CompletionEvents (
  timestamp: datetime,
  request_id: string,
  session_id: string,
  user_id: string,
  model: string,
  prompt_tokens: int,
  completion_tokens: int,
  total_tokens: int,
  latency_ms: int,
  temperature: real,
  cost_usd: decimal,
  error_code: string,
  error_message: string
) with (docstring = "AI completion requests", folder = "metrics")

.create table EmbeddingEvents (
  timestamp: datetime,
  embedding_id: string,
  dimension: int,
  model: string,
  input_tokens: int,
  duration_ms: int,
  cache_hit: bool,
  cost_usd: decimal
) with (docstring = "Embedding generation", folder = "metrics")

// Create ingestion mapping for JSON
.create table CompletionEvents ingestion json mapping 'CompletionEventsMapping' '['
'  {"column":"timestamp", "path":"$.timestamp"},'
'  {"column":"request_id", "path":"$.request_id"},'
'  {"column":"model", "path":"$.model"},'
'  {"column":"total_tokens", "path":"$.tokens.total"}'
']'
```

### Step 3 — Ingest Data from Event Hub

```python
from azure.kusto.ingest import QueuedIngestClient, DescriptorToDict
from azure.kusto.ingest.descriptors import BlobDescriptor
from azure.identity import DefaultAzureCredential
import json

client = QueuedIngestClient(
    kusto_cluster=f"https://{KUSTO_CLUSTER}.kusto.windows.net",
    aa_d_token_provider=lambda: DefaultAzureCredential().get_token(
        "https://kusto.kusto.windows.net/.default"
    ).token,
)

# Ingest JSON events
descriptor = BlobDescriptor(
    path=f"https://{STORAGE_ACCOUNT}.blob.core.windows.net/events/completions.jsonl",
    size=1024000,
)

ingestion_properties = DescriptorToDict(
    database="ai-telemetry",
    table="CompletionEvents",
    format="JSON",
    ingestion_mapping_reference="CompletionEventsMapping",
)

client.ingest_from_descriptor(descriptor, ingestion_properties)
```

### Step 4 — KQL Queries for Analysis

```kusto
// Query 1: Token consumption by user (daily)
CompletionEvents
| where timestamp > ago(30d)
| summarize
    total_prompt_tokens = sum(prompt_tokens),
    total_completion_tokens = sum(completion_tokens),
    total_cost_usd = sum(cost_usd),
    request_count = count()
    by user_id, bin(timestamp, 1d)
| order by timestamp desc, total_cost_usd desc

// Query 2: Model latency P50/P95/P99 (hourly trend)
CompletionEvents
| where timestamp > ago(7d) and error_code == ""
| summarize
    p50_latency = percentile(latency_ms, 50),
    p95_latency = percentile(latency_ms, 95),
    p99_latency = percentile(latency_ms, 99),
    avg_latency = avg(latency_ms)
    by model, bin(timestamp, 1h)
| render timechart

// Query 3: Error rate and root causes (real-time)
CompletionEvents
| where timestamp > ago(5m) and error_code != ""
| summarize
    error_count = count(),
    affected_users = dcount(user_id),
    top_error = arg_max(error_message, 1)
    by error_code
| order by error_count desc

// Query 4: Cache hit ratio (embedding service)
EmbeddingEvents
| where timestamp > ago(24h)
| summarize
    hits = countif(cache_hit),
    misses = countif(not cache_hit),
    hit_ratio = (countif(cache_hit) * 100.0) / count()
    by bin(timestamp, 1h)
```

### Step 5 — Real-Time Dashboard

```kusto
// Create function for reusable metrics
.create function TokenUsageDaily(start_date: datetime = ago(30d)) {
    CompletionEvents
    | where timestamp > start_date
    | summarize tokens = sum(total_tokens) by user_id, bin(timestamp, 1d)
}

// Alert rule in Azure Monitor for anomalies
.create alert TokenSpike
  IfTrue: (TriggerCondition)
  Action: SendAlert("token_spike@company.com")
  where
    CompletionEvents
    | where timestamp > ago(5m)
    | summarize total_tokens = sum(total_tokens)
    | where total_tokens > 1_000_000
```

## KQL Query Types

| Query | Latency | Use Case |
|-------|---------|----------|
| Aggregation (group by) | < 100ms | Cost rollups, error analysis |
| Time-series projection | < 500ms | Latency trends, cache hit ratios |
| Join on request_id | < 1s | End-to-end trace reconstruction |
| Full table scan (30-day) | < 5s | Anomaly detection, compliance audits |

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Operational Excellence | KQL queries enable root-cause analysis on latency/error spikes within seconds |
| Cost Optimization | Token-to-cost attribution via `cost_usd` column enables chargeback and optimization |
| Reliability | Real-time alerting on error rates and latency anomalies prevents production impact |

## Compatible Solution Plays

- **Play 17** — AI Observability (primary telemetry sink)
- **Play 02** — AI Landing Zone (shared observability infrastructure)
- **Play 14** — Cost-Optimized AI Gateway (cost tracking)

## Notes

- 400MB/sec ingestion rate per cluster for streaming ingest; batch ingestion for 1GB+ datasets
- Soft delete period (Step 1, `softDeletePeriod`) controls query retention; set to compliance requirement
- KQL supports joins on timestamp ranges + 1-second tolerance for deduplication
- Kusto function libraries (Step 5, `.create function`) enable parametrised reusable queries bundled in code
