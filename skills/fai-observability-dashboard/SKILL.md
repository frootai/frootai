---
name: fai-observability-dashboard
description: "Create an observability dashboard with KQL queries for AI system health"
---

# Observability Dashboard for AI Applications

Build an Azure Monitor Workbook with five tabs covering LLM performance, RAG quality, cost tracking, and error analysis. Includes KQL queries, Bicep deployment, alert rules, and a Grafana alternative.

## Workbook Architecture

The workbook uses five tabs with drill-down from Overview → detail tabs:

| Tab | Purpose | Refresh |
|-----|---------|---------|
| **Overview** | Health score, request volume, P95 latency, error rate, cost burn | 5 min |
| **LLM Performance** | Token throughput, latency distribution, model comparison | 5 min |
| **RAG Quality** | Groundedness, relevance, citation accuracy, retrieval latency | 15 min |
| **Cost** | Token spend by model/deployment, cache savings, daily burn rate | 1 hour |
| **Errors** | Content filter triggers, 429s, prompt injection attempts, failures | 1 min |

## Custom Metrics — Emit from Application

Log these custom metrics to Application Insights via `trackMetric` or OpenTelemetry:

```json
{
  "metrics": {
    "ai.tokens.prompt": { "unit": "count", "description": "Prompt tokens per request" },
    "ai.tokens.completion": { "unit": "count", "description": "Completion tokens per request" },
    "ai.latency.ttft": { "unit": "ms", "description": "Time to first token" },
    "ai.latency.e2e": { "unit": "ms", "description": "End-to-end response time" },
    "ai.cache.hit": { "unit": "ratio", "description": "Semantic cache hit rate (0-1)" },
    "ai.rag.groundedness": { "unit": "score", "description": "Groundedness score (1-5)" },
    "ai.rag.relevance": { "unit": "score", "description": "Retrieval relevance score (1-5)" },
    "ai.cost.usd": { "unit": "USD", "description": "Estimated cost per request" }
  },
  "thresholds": {
    "latency_p95_ms": 3000,
    "error_rate_pct": 2,
    "groundedness_min": 4.0,
    "cache_hit_min": 0.3,
    "daily_cost_max_usd": 50
  }
}
```

## KQL Queries by Tab

### Overview — Health Score Tile

```kql
let latencyOk = customMetrics
  | where name == "ai.latency.e2e" and timestamp > ago(1h)
  | summarize p95 = percentile(value, 95)
  | project score = iff(p95 < 3000, 1.0, iff(p95 < 5000, 0.5, 0.0));
let errorOk = requests
  | where timestamp > ago(1h)
  | summarize errRate = countif(success == false) * 100.0 / count()
  | project score = iff(errRate < 2, 1.0, iff(errRate < 5, 0.5, 0.0));
let groundOk = customMetrics
  | where name == "ai.rag.groundedness" and timestamp > ago(1h)
  | summarize avg_g = avg(value)
  | project score = iff(avg_g >= 4.0, 1.0, iff(avg_g >= 3.0, 0.5, 0.0));
latencyOk | union errorOk | union groundOk
| summarize health = avg(score) * 100
| project HealthScore = round(health, 1), Status = iff(health >= 80, "🟢 Healthy", iff(health >= 50, "🟡 Degraded", "🔴 Critical"))
```

### LLM Performance — Latency Distribution

```kql
customMetrics
| where name == "ai.latency.e2e" and timestamp > ago(6h)
| summarize p50 = percentile(value, 50), p90 = percentile(value, 90),
            p95 = percentile(value, 95), p99 = percentile(value, 99),
            avg_ttft = avgif(value, name == "ai.latency.ttft")
            by bin(timestamp, 5m), tostring(customDimensions.model)
| render timechart
```

### LLM Performance — Token Throughput

```kql
customMetrics
| where name startswith "ai.tokens." and timestamp > ago(6h)
| extend tokenType = iff(name == "ai.tokens.prompt", "Prompt", "Completion"),
         model = tostring(customDimensions.model)
| summarize totalTokens = sum(value) by bin(timestamp, 5m), model, tokenType
| render barchart
```

### RAG Quality — Groundedness Trend

```kql
customMetrics
| where name == "ai.rag.groundedness" and timestamp > ago(24h)
| summarize avg_score = avg(value), min_score = min(value),
            below_threshold = countif(value < 4.0), total = count()
            by bin(timestamp, 1h)
| extend pct_below = round(below_threshold * 100.0 / total, 1)
| project timestamp, avg_score = round(avg_score, 2), min_score, pct_below
| render timechart
```

### Cost — Daily Spend by Model

```kql
customMetrics
| where name == "ai.cost.usd" and timestamp > ago(30d)
| extend model = tostring(customDimensions.model)
| summarize dailyCost = sum(value) by bin(timestamp, 1d), model
| render barchart
```

### Cost — Cache Savings

```kql
customMetrics
| where name == "ai.cache.hit" and timestamp > ago(7d)
| summarize hitRate = avg(value), totalReqs = count() by bin(timestamp, 1h)
| extend estimatedSaved = totalReqs * hitRate * 0.002 // avg cost per uncached call
| project timestamp, hitRate = round(hitRate * 100, 1), estimatedSaved = round(estimatedSaved, 2)
| render timechart
```

### Errors — Content Filter and 429s

```kql
let contentFilter = dependencies
  | where timestamp > ago(6h) and resultCode == "content_filter"
  | summarize cnt = count() by bin(timestamp, 5m)
  | extend errorType = "Content Filter";
let throttled = dependencies
  | where timestamp > ago(6h) and resultCode == "429"
  | summarize cnt = count() by bin(timestamp, 5m)
  | extend errorType = "Throttled (429)";
let promptInjection = customEvents
  | where timestamp > ago(6h) and name == "PromptInjectionDetected"
  | summarize cnt = count() by bin(timestamp, 5m)
  | extend errorType = "Prompt Injection";
contentFilter | union throttled | union promptInjection
| render barchart
```

## Bicep Deployment

```bicep
@description('Deploy AI Observability Workbook to Azure Monitor')
param workbookName string = 'ai-observability-${uniqueString(resourceGroup().id)}'
param appInsightsId string
param location string = resourceGroup().location

resource workbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid(workbookName)
  location: location
  kind: 'shared'
  properties: {
    displayName: 'AI Observability Dashboard'
    category: 'AI'
    sourceId: appInsightsId
    serializedData: loadTextContent('workbook-template.json')
  }
  tags: { 'hidden-title': 'AI Observability Dashboard' }
}

resource highLatencyAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'alert-ai-latency-p95'
  location: location
  properties: {
    displayName: 'AI Latency P95 > 3s'
    severity: 2
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [appInsightsId]
    criteria: {
      allOf: [
        {
          query: 'customMetrics | where name == "ai.latency.e2e" | summarize p95=percentile(value,95)'
          timeAggregation: 'Maximum'
          metricMeasureColumn: 'p95'
          operator: 'GreaterThan'
          threshold: 3000
        }
      ]
    }
  }
}

resource lowGroundednessAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'alert-ai-groundedness-low'
  location: location
  properties: {
    displayName: 'RAG Groundedness Below 4.0'
    severity: 2
    evaluationFrequency: 'PT15M'
    windowSize: 'PT1H'
    scopes: [appInsightsId]
    criteria: {
      allOf: [
        {
          query: 'customMetrics | where name == "ai.rag.groundedness" | summarize avg_g=avg(value)'
          timeAggregation: 'Minimum'
          metricMeasureColumn: 'avg_g'
          operator: 'LessThan'
          threshold: 4
        }
      ]
    }
  }
}
```

## Grafana Alternative

For teams using Azure Managed Grafana instead of Workbooks:

1. **Data source**: Add Azure Monitor data source → connect to the same App Insights resource
2. **Dashboard JSON**: Import the workbook queries as Grafana panels — KQL works directly in the Azure Monitor plugin
3. **Refresh**: Set dashboard auto-refresh to match intervals above (Overview=5m, Cost=1h)
4. **Alerts**: Use Grafana alerting with the same KQL thresholds, route to PagerDuty/Slack via contact points
5. **Provisioning**: Store dashboard JSON in `monitoring/grafana/ai-dashboard.json`, deploy via `grafana-cli` or Terraform

Key query translation — Grafana Azure Monitor plugin uses the same KQL, but wrap in:
```
Workspace("your-log-analytics-workspace-id").customMetrics | where name == "ai.latency.e2e" ...
```

## Drill-Down Pattern

The Overview tab links to detail tabs via workbook parameter actions:

1. Click a health score tile → sets `selectedTab` parameter → switches to the relevant detail tab
2. Click a time range on any chart → sets `timeRange` parameter → all tabs filter to that window
3. Click a model name → sets `modelFilter` → LLM Performance and Cost tabs filter to that deployment

Implement by adding `"actions"` to each visualization element in the workbook JSON template, binding click events to parameter names that other tabs consume as filters.

## Sharing and Export

| Method | How |
|--------|-----|
| **Azure Portal share** | Workbook → Share → copy link or pin to Azure Dashboard |
| **Scheduled email** | Action Group with email → attach to any scheduled query rule |
| **PDF export** | Workbook → Export → PDF (manual) or use Logic App with `renderWorkbook` API |
| **Terraform/Bicep** | Export workbook JSON via `az monitor workbook show`, commit to repo |
| **Grafana snapshots** | Dashboard → Share → Snapshot → public or internal link |

## Config-Driven Thresholds

Store thresholds in `config/observability.json` and reference them in alert Bicep via parameters:

```json
{
  "alerts": {
    "latency_p95_ms": { "warning": 2000, "critical": 5000 },
    "error_rate_pct": { "warning": 1, "critical": 5 },
    "groundedness_avg": { "warning": 4.0, "critical": 3.0 },
    "daily_cost_usd": { "warning": 40, "critical": 100 },
    "cache_hit_rate": { "warning": 0.2, "critical": 0.1 }
  },
  "refresh_intervals": {
    "overview": "PT5M",
    "llm_performance": "PT5M",
    "rag_quality": "PT15M",
    "cost": "PT1H",
    "errors": "PT1M"
  }
}
```

Load in Bicep: `param thresholds object = loadJsonContent('../../config/observability.json').alerts` and use `thresholds.latency_p95_ms.critical` as the alert threshold value. This lets ops teams tune sensitivity without modifying infrastructure code.
