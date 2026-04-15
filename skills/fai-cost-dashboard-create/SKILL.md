---
name: fai-cost-dashboard-create
description: "Create a cost attribution dashboard for AI workloads with Azure Cost Management"
---

# Cost Dashboard Create

Build a real-time AI cost attribution dashboard that tracks token consumption across endpoints, models, and tenants — with budget alerts, anomaly detection, and drill-down by team.

## Architecture

The dashboard pipeline flows: **AOAI diagnostic logs → Log Analytics → KQL workbook → budget alerts**. Every Azure OpenAI call emits `AzureDiagnostics` with `properties_s` containing `promptTokens`, `completionTokens`, `model`, and custom dimensions you tag via HTTP headers (`x-tenant-id`, `x-team`, `x-endpoint`).

## Step 1: Enable Diagnostic Logging

Configure Azure OpenAI to send request-level logs to Log Analytics:

```bicep
resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'aoai-cost-tracking'
  scope: openAiAccount
  properties: {
    workspaceId: logAnalyticsWorkspace.id
    logs: [
      { categoryGroup: 'allLogs', enabled: true }
    ]
    metrics: [
      { category: 'AllMetrics', enabled: true }
    ]
  }
}
```

## Step 2: Token Usage Tracking with KQL

Core query that calculates cost per request. Pricing is per-1K tokens — adjust rates when models change:

```kql
let pricing = datatable(model:string, promptRate:real, completionRate:real) [
    "gpt-4o",       0.0025,  0.010,
    "gpt-4o-mini",  0.00015, 0.0006,
    "gpt-4.1",      0.002,   0.008,
    "gpt-4.1-mini", 0.0004,  0.0016,
    "text-embedding-3-large", 0.00013, 0.0
];
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.COGNITIVESERVICES"
| where Category == "RequestResponse"
| extend props = parse_json(properties_s)
| extend model = tostring(props.modelName),
         promptTokens = toint(props.promptTokens),
         completionTokens = toint(props.completionTokens),
         tenantId = tostring(props.customHeaders.["x-tenant-id"]),
         team = tostring(props.customHeaders.["x-team"])
| lookup pricing on model
| extend promptCost = (promptTokens / 1000.0) * promptRate,
         completionCost = (completionTokens / 1000.0) * completionRate,
         totalCost = promptCost + completionCost
| project TimeGenerated, model, tenantId, team, promptTokens,
          completionTokens, promptCost, completionCost, totalCost
```

## Step 3: Dashboard Sections

Build an Azure Monitor Workbook with these tabs:

**Tab 1 — Daily Spend Trend** (line chart, 30-day window):
```kql
// Daily spend by model — stacked area chart
AzureDiagnostics
| where TimeGenerated > ago(30d)
| extend props = parse_json(properties_s)
| extend model = tostring(props.modelName),
         tokens = toint(props.promptTokens) + toint(props.completionTokens)
| summarize totalTokens = sum(tokens), requests = count() by bin(TimeGenerated, 1d), model
| render timechart
```

**Tab 2 — Model Cost Comparison** (bar chart):
```kql
// Compare cost across models for same period
// Reveals where model routing saves money
<same base query as Step 2>
| summarize totalCost = sum(totalCost), totalTokens = sum(promptTokens + completionTokens)
    by model
| extend costPer1KTokens = round(totalCost / (totalTokens / 1000.0), 4)
| order by totalCost desc
```

**Tab 3 — Cache Savings** (tracks semantic cache hit rate):
```kql
AzureDiagnostics
| where TimeGenerated > ago(7d)
| extend props = parse_json(properties_s)
| extend cacheHit = tobool(props.cacheHit), model = tostring(props.modelName)
| summarize hits = countif(cacheHit), misses = countif(not(cacheHit)) by model
| extend hitRate = round(100.0 * hits / (hits + misses), 1),
         estimatedSavings = misses * 0.0  // replace 0.0 with avg cost per miss
| project model, hits, misses, hitRate
```

**Tab 4 — Per-Team Allocation** (pie chart + table):
```kql
<same base query as Step 2>
| summarize totalCost = round(sum(totalCost), 2),
            totalRequests = count()
    by team
| order by totalCost desc
```

## Step 4: Budget Alerts with Bicep

Deploy action groups and metric alerts that fire when daily spend exceeds thresholds:

```bicep
param dailyBudgetUsd int = 50
param alertEmail string

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'ag-ai-cost-alerts'
  location: 'global'
  properties: {
    groupShortName: 'AICost'
    enabled: true
    emailReceivers: [
      { name: 'finops-team', emailAddress: alertEmail, useCommonAlertSchema: true }
    ]
  }
}

resource costAlert 'Microsoft.Insights/scheduledQueryRules@2022-06-15' = {
  name: 'alert-ai-daily-spend'
  location: resourceGroup().location
  properties: {
    severity: 2
    evaluationFrequency: 'PT1H'
    windowSize: 'PT24H'
    scopes: [ logAnalyticsWorkspace.id ]
    criteria: {
      allOf: [
        {
          query: '''
            AzureDiagnostics
            | where ResourceProvider == "MICROSOFT.COGNITIVESERVICES"
            | extend props = parse_json(properties_s)
            | extend tokens = toint(props.promptTokens) + toint(props.completionTokens)
            | summarize totalTokens = sum(tokens)
            | extend estimatedCost = totalTokens / 1000.0 * 0.003
            | where estimatedCost > ${dailyBudgetUsd}
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
        }
      ]
    }
    actions: { actionGroups: [ actionGroup.id ] }
  }
}
```

## Step 5: Cost Budget Configuration

Define per-team and per-model budgets in `config/cost-budgets.json`:

```json
{
  "version": "1.0",
  "currency": "USD",
  "alertThresholds": [0.5, 0.8, 1.0],
  "budgets": {
    "daily": { "total": 100, "perTeam": { "platform": 40, "ml-ops": 35, "apps": 25 } },
    "monthly": { "total": 2500 }
  },
  "modelPricing": {
    "gpt-4o":       { "promptPer1K": 0.0025, "completionPer1K": 0.010 },
    "gpt-4o-mini":  { "promptPer1K": 0.00015, "completionPer1K": 0.0006 },
    "gpt-4.1":      { "promptPer1K": 0.002, "completionPer1K": 0.008 },
    "text-embedding-3-large": { "promptPer1K": 0.00013, "completionPer1K": 0.0 }
  },
  "anomalyDetection": {
    "lookbackDays": 14,
    "stddevMultiplier": 2.5,
    "minimumRequests": 50
  }
}
```

## Step 6: Anomaly Detection for Cost Spikes

Python script that queries Log Analytics and flags days where spend deviates beyond the configured standard deviation threshold:

```python
import json, statistics
from azure.monitor.query import LogsQueryClient
from azure.identity import DefaultAzureCredential
from datetime import timedelta

def detect_cost_anomalies(workspace_id: str, config_path: str = "config/cost-budgets.json"):
    with open(config_path) as f:
        cfg = json.load(f)

    client = LogsQueryClient(DefaultAzureCredential())
    lookback = cfg["anomalyDetection"]["lookbackDays"]
    multiplier = cfg["anomalyDetection"]["stddevMultiplier"]

    query = f"""
    AzureDiagnostics
    | where TimeGenerated > ago({lookback}d)
    | where ResourceProvider == "MICROSOFT.COGNITIVESERVICES"
    | extend props = parse_json(properties_s)
    | extend tokens = toint(props.promptTokens) + toint(props.completionTokens)
    | summarize dailyTokens = sum(tokens) by bin(TimeGenerated, 1d)
    | extend estimatedCost = dailyTokens / 1000.0 * 0.003
    | order by TimeGenerated asc
    """
    result = client.query_workspace(workspace_id, query, timespan=timedelta(days=lookback))
    daily_costs = [row["estimatedCost"] for row in result.tables[0].rows]

    if len(daily_costs) < cfg["anomalyDetection"]["minimumRequests"]:
        return []

    mean = statistics.mean(daily_costs)
    stdev = statistics.stdev(daily_costs)
    threshold = mean + (multiplier * stdev)
    return [
        {"date": str(row["TimeGenerated"]), "cost": row["estimatedCost"], "threshold": threshold}
        for row in result.tables[0].rows
        if row["estimatedCost"] > threshold
    ]
```

## Step 7: Power BI / Grafana Integration

**Power BI**: Use the Azure Monitor Logs connector → paste the Step 2 KQL query → schedule daily refresh. Add slicers for `model`, `team`, `tenantId`.

**Grafana**: Install the Azure Monitor data source plugin. Create panels using the same KQL queries. Set up Grafana alerting as a secondary channel alongside Azure Monitor alerts.

Both options pull from the same Log Analytics workspace — pick based on your org's BI tooling.

## FinOps Practices for AI

1. **Tag every request** — propagate `x-tenant-id` and `x-team` headers from your API gateway so cost is attributable
2. **Model routing** — send simple queries to `gpt-4o-mini` (40x cheaper than `gpt-4o` for prompts), reserve large models for complex reasoning
3. **Semantic caching** — cache identical/similar prompts in Redis with embedding similarity; track cache hit rate in Tab 3
4. **Token budgets** — enforce `max_tokens` per request and daily caps per team using the gateway middleware
5. **PTU vs PAYG analysis** — if a model consistently uses >150K tokens/minute, PTU provisioning is cheaper; query average TPM weekly
6. **Right-size embeddings** — use `text-embedding-3-large` with `dimensions=1024` instead of 3072 for 3x cost reduction with <2% quality loss
7. **Review weekly** — schedule a 15-min FinOps review using the workbook; focus on cost-per-request trends, not just totals

## Validation Checklist

- [ ] Diagnostic settings emit `AzureDiagnostics` with token counts
- [ ] KQL queries return data within 5 minutes of API calls
- [ ] Budget alert fires when simulated spend crosses threshold
- [ ] `config/cost-budgets.json` pricing matches current Azure OpenAI rates
- [ ] Anomaly detection correctly flags a 3x spike in test data
- [ ] Per-team attribution works end-to-end (header → log → dashboard)
- [ ] Workbook loads in <3s with 30 days of data
