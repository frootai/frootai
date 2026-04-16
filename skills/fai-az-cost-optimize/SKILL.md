---
name: fai-az-cost-optimize
description: Analyze Azure AI workload spend with Cost Management API queries, flag overprovisioned PTU, identify semantic cache gaps, right-size model SKUs, and produce actionable FinOps recommendations with ROI estimates.
---

# FAI Azure Cost Optimize

Conducts a structured FinOps review of Azure AI workloads -- from raw billing data to prioritised recommendations. Targets the three highest-cost levers in AI deployments: overprovisioned PTU, uncached repeated queries, and oversized model selection for simple tasks.

## When to Invoke

| Signal | Example |
|--------|---------|
| Monthly AI spend exceeds budget alert | Cost alert fired for Cognitive Services |
| PTU utilization is below 60% | Provisioned Throughput Units sitting idle |
| Cache hit rate is 0% | Every query hitting the model cold |
| gpt-4o used for all tasks | Simple classification using an expensive model |

## Workflow

### Step 1 — Query Azure Cost Management API

```python
from azure.mgmt.costmanagement import CostManagementClient
from azure.identity import DefaultAzureCredential
from datetime import datetime, timedelta

credential = DefaultAzureCredential()
client     = CostManagementClient(credential)
scope      = f"/subscriptions/{SUBSCRIPTION_ID}"
end        = datetime.utcnow()
start      = end - timedelta(days=30)

result = client.query.usage(scope, {
    "type": "Usage",
    "timeframe": "Custom",
    "timePeriod": {"from": start.isoformat(), "to": end.isoformat()},
    "dataset": {
        "granularity": "Daily",
        "aggregation": {"totalCost": {"name": "Cost", "function": "Sum"}},
        "grouping": [
            {"type": "Dimension", "name": "ServiceName"},
            {"type": "Dimension", "name": "ResourceId"},
        ],
    },
})

# Print top 10 resources by cost
rows = sorted(result.rows, key=lambda r: r[0], reverse=True)[:10]
for cost, service, resource, *_ in rows:
    print(f"${cost:>8.2f}  {service:<30}  {resource}")
```

### Step 2 — PTU Utilization Analysis

```python
from azure.monitor.query import MetricsQueryClient, MetricAggregationType
from azure.identity import DefaultAzureCredential
from datetime import timedelta

monitor_client = MetricsQueryClient(DefaultAzureCredential())

resource_id = (
    f"/subscriptions/{SUBSCRIPTION_ID}/resourceGroups/{RG_NAME}"
    f"/providers/Microsoft.CognitiveServices/accounts/{AOAI_NAME}"
)

result = monitor_client.query_resource(
    resource_id,
    metric_names=["ProvisionedManagedAvailability", "TokenTransaction"],
    timespan=timedelta(days=7),
    granularity=timedelta(hours=1),
    aggregations=[MetricAggregationType.AVERAGE],
)

for metric in result.metrics:
    values   = [ts.average for ts in metric.timeseries[0].data if ts.average is not None]
    avg_util = (sum(values) / len(values)) * 100 if values else 0
    print(f"{metric.name}: avg utilization = {avg_util:.1f}%")
    if avg_util < 60:
        print("  -> RECOMMENDATION: Reduce PTU tier or shift non-peak traffic to PAYG")
```

### Step 3 — Semantic Cache Gap Analysis

```python
from azure.monitor.query import LogsQueryClient
from azure.identity import DefaultAzureCredential
from datetime import timedelta
import pandas as pd

logs_client = LogsQueryClient(DefaultAzureCredential())

query = """
requests
| where timestamp > ago(7d)
| extend cached = tostring(customDimensions["cached"])
| summarize
    total = count(),
    hits  = countif(cached == "true"),
    misses = countif(cached == "false")
| extend hit_rate = round(toreal(hits) / total * 100, 1)
"""

response = logs_client.query_workspace(
    workspace_id=LOG_ANALYTICS_WORKSPACE_ID,
    query=query,
    timespan=timedelta(days=7),
)
df = pd.DataFrame(response.tables[0].rows,
                  columns=[c.name for c in response.tables[0].columns])
print(df.to_string(index=False))
# hit_rate = 0  -> add semantic cache (Redis + cosine similarity check at 0.90)
# hit_rate < 20 -> lower similarity threshold (0.90 -> 0.86) to capture more variants
```

### Step 4 — Model Routing Recommendations

| Task Type | Recommended Model | Cost/1M tokens (input/output) | vs gpt-4o Savings |
|-----------|------------------|-------------------------------|------------------|
| Intent classification, routing | gpt-4o-mini | $0.15 / $0.60 | 93% cheaper |
| Short Q&A, summarisation | gpt-4o-mini | $0.15 / $0.60 | 93% cheaper |
| Complex reasoning, long-form code | gpt-4o | $2.50 / $10.00 | baseline |
| Embedding generation | text-embedding-3-small | $0.02 / 1M tokens | 5x cheaper than large |
| Non-real-time batch jobs | gpt-4o Batch API | 50% discount | 50% off synchronous |

```python
def route_model(prompt: str, complexity_threshold: float = 0.7) -> str:
    """Route simple prompts to gpt-4o-mini, complex to gpt-4o."""
    complexity = estimate_complexity(prompt)   # 0.0-1.0 score from classifier
    return "gpt-4o" if complexity >= complexity_threshold else "gpt-4o-mini"
```

### Step 5 — Generate FinOps Report

```python
from datetime import datetime

def generate_finops_report(spend_df, ptu_util: float, cache_hit_rate: float) -> dict:
    recommendations = []

    if ptu_util < 60:
        monthly_ptu_cost = spend_df.loc[spend_df.service == "Azure OpenAI", "cost"].sum()
        savings = monthly_ptu_cost * (1 - ptu_util / 100) * 0.5
        recommendations.append({
            "priority": "HIGH",
            "finding": f"PTU utilization {ptu_util:.0f}% -- underutilised",
            "action": "Reduce PTU tier by 30% or shift non-peak traffic to PAYG",
            "estimated_monthly_savings_usd": round(savings, 2),
        })

    if cache_hit_rate < 20:
        recommendations.append({
            "priority": "HIGH",
            "finding": f"Semantic cache hit rate {cache_hit_rate:.0f}%",
            "action": "Add Redis semantic cache with cosine similarity threshold 0.90",
            "estimated_monthly_savings_usd": "varies by repeat-query rate",
        })

    return {
        "generated_utc": datetime.utcnow().isoformat(),
        "total_recommendations": len(recommendations),
        "recommendations": recommendations,
    }
```

## PTU Break-Even Analysis

| Monthly Queries | Avg Input Tokens | PTU Utilization | Recommendation |
|----------------|-----------------|-----------------|---------------|
| < 500K | Any | Any | PAYG -- PTU overhead not justified |
| 500K-2M | < 1K | < 60% | PAYG -- PTU underutilised |
| 500K-2M | < 1K | >= 60% | PTU -- break-even achieved |
| > 2M | Any | Any | PTU + PAYG overflow |

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Cost Optimization | PTU right-sizing and model routing are the two highest-ROI levers in AI workload FinOps |
| Operational Excellence | Automated cost queries enable weekly FinOps reviews without manual portal navigation |
| Reliability | Identifying PAYG fallback gaps prevents quota exhaustion under PTU burst conditions |

## Compatible Solution Plays

- **Play 14** — Cost-Optimized AI Gateway
- **Play 52** — FinOps AI Dashboard
- **Play 02** — AI Landing Zone (budget alert configuration)

## Notes

- PTU break-even vs PAYG depends on sustained utilization >= 60%; below that, PAYG is cheaper
- Semantic cache threshold of 0.90 gives ~25% hit rate; lower to 0.85 for ~35% at risk of returning stale results
- Apply the Batch API for any non-real-time workload (eval jobs, bulk embeddings) -- 50% cost reduction
- Run this analysis monthly; PTU utilization changes as traffic patterns evolve
