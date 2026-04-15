---
name: fai-azure-data-explorer
description: |
  Set up Azure Data Explorer (Kusto) with ingestion pipelines, retention policies,
  materialized views, and KQL query optimization. Use when building real-time analytics
  or telemetry platforms for AI observability.
---

# Azure Data Explorer Setup

Configure ADX for real-time analytics with ingestion, retention, and KQL optimization.

## When to Use

- Building real-time analytics dashboards for AI telemetry
- Ingesting high-volume streaming data (logs, metrics, events)
- Creating materialized views for pre-aggregated reporting
- Querying large datasets with KQL for incident investigation

---

## Create Database and Table

```kql
// Create table for AI telemetry
.create table AITelemetry (
    Timestamp: datetime,
    RequestId: string,
    Model: string,
    PromptTokens: int,
    CompletionTokens: int,
    LatencyMs: real,
    StatusCode: int,
    Groundedness: real,
    UserId: string
)

// Set retention to 90 days, hot cache to 14 days
.alter-merge table AITelemetry policy retention
```{"SoftDeletePeriod": "90.00:00:00", "Recoverability": "Enabled"}```

.alter-merge table AITelemetry policy caching
```{"DataHotSpan": "14.00:00:00"}```
```

## Ingestion Pipeline

```python
from azure.kusto.data import KustoConnectionStringBuilder
from azure.kusto.ingest import QueuedIngestClient, IngestionProperties
from azure.identity import DefaultAzureCredential

kcsb = KustoConnectionStringBuilder.with_azure_token_credential(
    "https://adx-prod.eastus2.kusto.windows.net",
    DefaultAzureCredential()
)
ingest_client = QueuedIngestClient(kcsb)

props = IngestionProperties(
    database="telemetry",
    table="AITelemetry",
    data_format="json",
)

# Ingest from blob
ingest_client.ingest_from_blob(
    "https://storage.blob.core.windows.net/events/batch-001.json",
    ingestion_properties=props,
)
```

## Materialized Views

Pre-aggregate for dashboard queries:

```kql
// Hourly model usage summary
.create materialized-view ModelUsageHourly on table AITelemetry {
    AITelemetry
    | summarize
        Requests = count(),
        AvgLatencyMs = avg(LatencyMs),
        TotalTokens = sum(PromptTokens + CompletionTokens),
        P95Latency = percentile(LatencyMs, 95),
        AvgGroundedness = avg(Groundedness)
    by Model, bin(Timestamp, 1h)
}
```

## KQL Query Patterns

```kql
// Token burn rate by model (last 24h)
AITelemetry
| where Timestamp > ago(24h)
| summarize TotalTokens = sum(PromptTokens + CompletionTokens) by Model, bin(Timestamp, 1h)
| render timechart

// Latency P95 with anomaly detection
AITelemetry
| where Timestamp > ago(7d)
| summarize P95 = percentile(LatencyMs, 95) by bin(Timestamp, 15m)
| extend anomaly = iff(P95 > 3000, "HIGH", "normal")

// Error rate by model
AITelemetry
| where Timestamp > ago(24h)
| summarize Total = count(), Errors = countif(StatusCode >= 400) by Model
| extend ErrorRate = round(todouble(Errors) / Total * 100, 2)
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Slow KQL queries | No materialized views, wide scans | Create materialized views and add time filters |
| Ingestion lag | Batch interval too long | Reduce batching interval (default 5min → 30s) |
| Hot cache misses | Cache too short for query range | Extend caching hot span |
| High costs | Over-retention or over-ingestion | Reduce retention, add ingestion filters |
