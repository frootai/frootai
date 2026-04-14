---
name: "sla-monitor-setup"
description: "Set up SLA monitoring with availability, latency, and quality metrics"
---

# SLA Monitoring for AI Services

## SLI/SLO Definitions

Define Service Level Indicators (SLIs) and Objectives (SLOs) in `config/sla.json`:

```json
{
  "slos": {
    "availability": { "target": 0.999, "window_days": 30 },
    "latency_p99_ms": { "target": 3000, "window_days": 30 },
    "error_rate": { "target": 0.005, "window_days": 30 },
    "groundedness": { "target": 0.85, "window_days": 7 },
    "token_throughput_per_sec": { "target": 500, "window_days": 7 }
  },
  "composite": {
    "ai_pipeline_health": {
      "components": ["availability", "latency_p99_ms", "groundedness"],
      "strategy": "worst_of"
    }
  },
  "error_budget": { "monthly_minutes_allowed": 43.2 },
  "burn_rate_alerts": [
    { "name": "fast_burn", "rate": 14.4, "short_window_min": 5, "long_window_min": 60 },
    { "name": "slow_burn", "rate": 1.0, "short_window_min": 360, "long_window_min": 4320 }
  ],
  "incident_thresholds": {
    "sev1": { "error_budget_consumed_pct": 50, "window_hours": 1 },
    "sev2": { "error_budget_consumed_pct": 25, "window_hours": 6 },
    "sev3": { "error_budget_consumed_pct": 10, "window_hours": 24 }
  }
}
```

## Error Budget Calculation

Error budget = `(1 - SLO_target) × window_minutes`. For 99.9% over 30 days: `0.001 × 43200 = 43.2 min`. Burn rate = actual error rate ÷ allowed error rate. A burn rate of 14.4 exhausts the monthly budget in ~2 days — triggers fast-burn alert.

## Azure Monitor Alert Rules (Bicep)

```bicep
param logAnalyticsId string
param actionGroupId string

resource availabilitySloAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'slo-availability-breach'
  location: resourceGroup().location
  properties: {
    severity: 1
    evaluationFrequency: 'PT5M'
    windowSize: 'PT1H'
    scopes: [logAnalyticsId]
    criteria: {
      allOf: [
        {
          query: '''
            AppRequests
            | where TimeGenerated > ago(1h)
            | summarize total=count(), failed=countif(ResultCode >= 500 or ResultCode == 429)
            | extend error_rate = todouble(failed) / todouble(total)
            | where error_rate > 0.001
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
        }
      ]
    }
    actions: { actionGroups: [actionGroupId] }
  }
}

resource latencyP99Alert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'slo-latency-p99-breach'
  location: resourceGroup().location
  properties: {
    severity: 2
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [logAnalyticsId]
    criteria: {
      allOf: [
        {
          query: '''
            AppRequests
            | where TimeGenerated > ago(15m)
            | summarize p99_ms=percentile(DurationMs, 99)
            | where p99_ms > 3000
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
        }
      ]
    }
    actions: { actionGroups: [actionGroupId] }
  }
}

resource burnRateAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'slo-fast-burn-rate'
  location: resourceGroup().location
  properties: {
    severity: 1
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    scopes: [logAnalyticsId]
    criteria: {
      allOf: [
        {
          query: '''
            AppRequests
            | where TimeGenerated > ago(5m)
            | summarize total=count(), failed=countif(ResultCode >= 500)
            | extend burn_rate = (todouble(failed)/todouble(total)) / 0.001
            | where burn_rate > 14.4
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
        }
      ]
    }
    actions: { actionGroups: [actionGroupId] }
  }
}
```

## SLA Dashboard — KQL Queries

**Availability over rolling 30 days:**
```kql
AppRequests
| where TimeGenerated > ago(30d)
| summarize total=count(), successful=countif(ResultCode < 500 and ResultCode != 429) by bin(TimeGenerated, 1h)
| extend availability = todouble(successful) / todouble(total)
| project TimeGenerated, availability, slo=0.999
| render timechart
```

**Latency P99 trend with SLO line:**
```kql
AppRequests
| where TimeGenerated > ago(7d)
| summarize p50=percentile(DurationMs,50), p95=percentile(DurationMs,95), p99=percentile(DurationMs,99) by bin(TimeGenerated, 1h)
| extend slo_ms=3000
| render timechart
```

**AI quality SLO — groundedness tracking:**
```kql
customMetrics
| where TimeGenerated > ago(7d) and name == "groundedness_score"
| summarize avg_score=avg(value), p10=percentile(value,10) by bin(TimeGenerated, 1h)
| extend slo=0.85
| render timechart
```

**Error budget remaining:**
```kql
let slo = 0.999;
let window = 30d;
let budget_min = (1.0 - slo) * (30 * 24 * 60);
AppRequests
| where TimeGenerated > ago(window)
| summarize failed_min = dcountif(bin(TimeGenerated, 1m), ResultCode >= 500)
| extend budget_remaining_min = budget_min - failed_min,
         budget_consumed_pct = round(failed_min / budget_min * 100, 2)
```

## Composite SLOs

When your AI pipeline spans AOAI + AI Search + App Service, compute a composite SLO using worst-of or weighted strategy:

```python
import json
from dataclasses import dataclass

@dataclass
class ComponentSLI:
    name: str
    achieved: float  # 0.0-1.0

def composite_slo(components: list[ComponentSLI], strategy: str = "worst_of") -> float:
    values = [c.achieved for c in components]
    if strategy == "worst_of":
        return min(values)
    if strategy == "product":
        result = 1.0
        for v in values:
            result *= v
        return result
    raise ValueError(f"Unknown strategy: {strategy}")

def load_sla_config(path: str = "config/sla.json") -> dict:
    with open(path) as f:
        return json.load(f)

def evaluate_incident_severity(budget_consumed_pct: float, window_hours: float, config: dict) -> str | None:
    for sev in ["sev1", "sev2", "sev3"]:
        thresh = config["incident_thresholds"][sev]
        if budget_consumed_pct >= thresh["error_budget_consumed_pct"] and window_hours <= thresh["window_hours"]:
            return sev
    return None
```

## Monthly SLA Report Generation

```python
from azure.monitor.query import LogsQueryClient
from azure.identity import DefaultAzureCredential
from datetime import timedelta
import json

def generate_monthly_report(workspace_id: str, config_path: str = "config/sla.json") -> dict:
    config = json.loads(open(config_path).read())
    client = LogsQueryClient(DefaultAzureCredential())

    availability_query = """
    AppRequests | where TimeGenerated > ago(30d)
    | summarize total=count(), ok=countif(ResultCode < 500 and ResultCode != 429)
    | extend achieved=todouble(ok)/todouble(total)"""

    latency_query = """
    AppRequests | where TimeGenerated > ago(30d)
    | summarize p99=percentile(DurationMs, 99)"""

    quality_query = """
    customMetrics | where TimeGenerated > ago(30d) and name == 'groundedness_score'
    | summarize avg_score=avg(value)"""

    results = {}
    for name, query in [("availability", availability_query), ("latency_p99_ms", latency_query), ("groundedness", quality_query)]:
        resp = client.query_workspace(workspace_id, query, timespan=timedelta(days=30))
        row = resp.tables[0].rows[0]
        achieved = float(row[0]) if name == "latency_p99_ms" else float(row[-1])
        target = config["slos"][name]["target"]
        met = achieved >= target if name != "latency_p99_ms" else achieved <= target
        results[name] = {"achieved": round(achieved, 5), "target": target, "met": met}

    budget = config["error_budget"]["monthly_minutes_allowed"]
    avail = results["availability"]["achieved"]
    consumed = round((1 - avail) * 30 * 24 * 60, 2)
    results["error_budget"] = {"total_min": budget, "consumed_min": consumed, "remaining_pct": round((1 - consumed / budget) * 100, 2)}
    return results
```

## Token Throughput SLO

Track AOAI token throughput as an AI-specific SLI. Log via Application Insights custom metrics:

```kql
customMetrics
| where TimeGenerated > ago(1h) and name == "aoai_tokens_per_second"
| summarize avg_tps=avg(value), min_tps=min(value) by bin(TimeGenerated, 5m)
| extend slo=500
| where min_tps < slo
```

## Incident Trigger Mapping

| Severity | Condition | Action |
|----------|-----------|--------|
| SEV1 | >50% budget consumed in 1h | Page on-call, auto-scale, fallback model |
| SEV2 | >25% budget consumed in 6h | Notify team, investigate, reduce traffic |
| SEV3 | >10% budget consumed in 24h | Create ticket, review next business day |
| Quality | Groundedness <0.70 for 30min | Pause RAG pipeline, revert index |

## Checklist
- [ ] `config/sla.json` defines SLOs for all five SLIs
- [ ] Bicep deploys alert rules to Log Analytics workspace
- [ ] Burn rate alerts fire on both fast (14.4×) and slow (1×) burns
- [ ] Dashboard workbook imported with availability, latency, quality, and budget panels
- [ ] Composite SLO computed for multi-dependency pipelines
- [ ] Monthly report script runs via scheduled Azure Function or pipeline
- [ ] AI-specific metrics (groundedness, token throughput) tracked as custom metrics
