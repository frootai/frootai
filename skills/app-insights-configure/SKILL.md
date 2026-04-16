---
name: app-insights-configure
description: "Configure Application Insights, OpenTelemetry, and KQL dashboards for AI workloads — trace latency, token usage, failures, and cost signals"
---

# App Insights Configure

Deploy Application Insights with Log Analytics, instrument Python services with OpenTelemetry, emit AI-specific custom metrics, build KQL dashboards, and configure alert rules for RAG pipelines.

## Step 1: Bicep — Log Analytics + App Insights

```bicep
param location string = resourceGroup().location
param environmentName string

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${environmentName}'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30           // 30d keeps costs low; bump for compliance
    dailyQuotaGb: 5               // budget guard — triggers ingestion stop
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'ai-${environmentName}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    IngestionMode: 'LogAnalytics'
    SamplingPercentage: 50        // start at 50%, tune per volume
    RetentionInDays: 30
    DisableIpMasking: false
  }
}

output connectionString string = appInsights.properties.ConnectionString
```

## Step 2: Python SDK Setup

```python
# requirements: azure-monitor-opentelemetry, opentelemetry-api
from azure.monitor.opentelemetry import configure_azure_monitor
from opentelemetry import trace, metrics
import logging, os

configure_azure_monitor(
    connection_string=os.environ["APPLICATIONINSIGHTS_CONNECTION_STRING"],
    enable_live_metrics=True,
    sampling_ratio=0.5,           # matches Bicep SamplingPercentage
)

tracer = trace.get_tracer("fai.rag.pipeline")
meter = metrics.get_meter("fai.rag.metrics")

# --- Custom metrics ---
token_counter = meter.create_counter("fai.tokens.total", description="LLM tokens consumed")
latency_hist = meter.create_histogram("fai.latency.ms", unit="ms", description="Request latency")
cache_hit_rate = meter.create_up_down_counter("fai.cache.hits", description="Semantic cache hits")

logger = logging.getLogger("fai.rag")
```

## Step 3: Distributed Tracing for RAG Pipeline

```python
def rag_query(question: str, correlation_id: str) -> dict:
    with tracer.start_as_current_span("rag.query") as root:
        root.set_attribute("fai.correlation_id", correlation_id)
        root.set_attribute("fai.question_length", len(question))

        # --- Retrieval ---
        with tracer.start_as_current_span("rag.retrieve") as span:
            docs = search_index(question)
            span.set_attribute("fai.docs_retrieved", len(docs))
            span.set_attribute("fai.retrieval_source", "ai-search")

        # --- Cache check ---
        cached = check_semantic_cache(question)
        cache_hit_rate.add(1 if cached else -1)
        if cached:
            return cached

        # --- LLM call ---
        with tracer.start_as_current_span("rag.generate") as span:
            import time; t0 = time.perf_counter()
            result = call_openai(question, docs)
            elapsed_ms = (time.perf_counter() - t0) * 1000

            span.set_attribute("fai.model", result["model"])
            span.set_attribute("fai.prompt_tokens", result["usage"]["prompt_tokens"])
            span.set_attribute("fai.completion_tokens", result["usage"]["completion_tokens"])

            total_tokens = result["usage"]["prompt_tokens"] + result["usage"]["completion_tokens"]
            token_counter.add(total_tokens, {"model": result["model"], "play": "01"})
            latency_hist.record(elapsed_ms, {"operation": "generate"})

        logger.info("rag.complete", extra={
            "correlation_id": correlation_id,
            "tokens": total_tokens,
            "latency_ms": round(elapsed_ms, 1),
        })
        return result
```

## Step 4: KQL Dashboard Queries

```kql
// Token consumption by model — last 24h
customMetrics
| where name == "fai.tokens.total" and timestamp > ago(24h)
| extend model = tostring(customDimensions["model"])
| summarize totalTokens=sum(value) by model, bin(timestamp, 1h)
| render timechart

// P50/P95/P99 latency — last 7d
customMetrics
| where name == "fai.latency.ms" and timestamp > ago(7d)
| summarize p50=percentile(value, 50), p95=percentile(value, 95),
            p99=percentile(value, 99) by bin(timestamp, 1h)
| render timechart

// Failed requests with correlation IDs
requests
| where success == false and timestamp > ago(1h)
| extend correlationId = tostring(customDimensions["fai.correlation_id"])
| project timestamp, name, resultCode, duration, correlationId
| order by timestamp desc

// Cache hit ratio
customMetrics
| where name == "fai.cache.hits" and timestamp > ago(24h)
| summarize hits=sumif(value, value > 0), misses=sumif(value, value < 0)
  by bin(timestamp, 1h)
| extend hitRate = round(100.0 * hits / (hits + abs(misses)), 1)
| render timechart

// Estimated daily cost (GPT-4o pricing)
customMetrics
| where name == "fai.tokens.total" and timestamp > ago(1d)
| extend model = tostring(customDimensions["model"])
| summarize totalTokens=sum(value) by model
| extend estimatedCost = case(
    model == "gpt-4o", totalTokens / 1000000.0 * 5.0,
    model == "gpt-4o-mini", totalTokens / 1000000.0 * 0.15,
    0.0)
| project model, totalTokens, estimatedCost
```

## Step 5: Alert Rules (Bicep)

```bicep
// Metric alert — P99 latency > 5s
resource latencyAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-rag-latency-p99'
  location: 'global'
  properties: {
    severity: 2
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [{ name: 'p99check', metricName: 'fai.latency.ms', operator: 'GreaterThan'
                threshold: 5000, timeAggregation: 'Maximum', criterionType: 'StaticThresholdCriterion' }]
    }
    scopes: [appInsights.id]
    actions: [{ actionGroupId: actionGroup.id }]
  }
}

// Scheduled query alert — error spike
resource errorAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'alert-rag-error-spike'
  location: location
  properties: {
    severity: 1
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [logAnalytics.id]
    criteria: {
      allOf: [{
        query: 'requests | where success == false | summarize errorCount=count() by bin(TimeGenerated, 5m)'
        timeAggregation: 'Total'
        metricMeasureColumn: 'errorCount'
        operator: 'GreaterThan'
        threshold: 50
        failingPeriods: { numberOfEvaluationPeriods: 1, minFailingPeriodsToAlert: 1 }
      }]
    }
    actions: { actionGroups: [actionGroup.id] }
  }
}

// Budget alert — daily ingestion > 4 GB
resource budgetAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'alert-ingestion-budget'
  location: location
  properties: {
    severity: 3
    evaluationFrequency: 'PT1H'
    windowSize: 'PT24H'
    scopes: [logAnalytics.id]
    criteria: {
      allOf: [{
        query: 'Usage | where TimeGenerated > ago(24h) | summarize totalGB=sum(Quantity)/1024'
        timeAggregation: 'Total'
        metricMeasureColumn: 'totalGB'
        operator: 'GreaterThan'
        threshold: 4
        failingPeriods: { numberOfEvaluationPeriods: 1, minFailingPeriodsToAlert: 1 }
      }]
    }
    actions: { actionGroups: [actionGroup.id] }
  }
}
```

## Step 6: Sampling & Cost Management

| Lever | Setting | Effect |
|-------|---------|--------|
| Ingestion sampling | `SamplingPercentage: 50` in Bicep | Drops 50% of telemetry at source |
| SDK sampling | `sampling_ratio=0.5` in `configure_azure_monitor` | Must match Bicep value |
| Daily cap | `dailyQuotaGb: 5` on Log Analytics | Hard stop — no data loss, just paused |
| Retention | `retentionInDays: 30` | 30d free on basic; 90d+ costs extra |
| Metric pre-aggregation | Use counters/histograms, not `track_event` | 10x cheaper than custom events |

Tune sampling per environment: dev=100% (full visibility), staging=50%, prod=25-50% depending on volume.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| No telemetry in portal | Connection string missing | Verify `APPLICATIONINSIGHTS_CONNECTION_STRING` env var |
| SDK still uses instrumentation key | Legacy configuration path | Use the connection string only; instrumentation keys are legacy |
| Spans not correlated | Missing parent context | Ensure `start_as_current_span` nests inside root span |
| Metrics delayed >5min | Ingestion lag or daily cap hit | Check `Usage` table; raise `dailyQuotaGb` |
| Alert never fires | Wrong scope or metric name | Verify `scopes` points to correct resource ID |
| Double-counted tokens | SDK + Bicep sampling mismatch | Align `sampling_ratio` with `SamplingPercentage` |
