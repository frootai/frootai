---
name: "deploy-ai-infrastructure-optimizer"
description: "Deploy AI Infrastructure Optimizer — Azure Monitor metrics, GPU utilization analysis, SKU right-sizing, cost anomaly detection, auto-scaling recommendations, FinOps dashboard."
---

# Deploy AI Infrastructure Optimizer

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with Reader + Cost Management Reader roles
- Azure resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for recommendation explanations)
  - `Microsoft.Insights` (Azure Monitor for resource metrics)
  - `Microsoft.CostManagement` (cost analysis APIs)
  - `Microsoft.App` (Container Apps for optimizer API)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `azure-mgmt-monitor`, `azure-mgmt-costmanagement`, `openai` packages
- `.env` file with: `AZURE_SUBSCRIPTION_ID`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-infra-optimizer --location eastus2

az deployment group create \
  --resource-group rg-frootai-infra-optimizer \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json

az keyvault secret set --vault-name kv-infra-optimizer \
  --name openai-key --value "$AZURE_OPENAI_KEY"
```

## Step 2: Deploy Resource Metrics Collector

```python
# metrics_collector.py — collect CPU, GPU, memory, cost metrics
from azure.mgmt.monitor import MonitorManagementClient
from azure.identity import DefaultAzureCredential

class ResourceMetricsCollector:
    def __init__(self, subscription_id):
        self.monitor = MonitorManagementClient(DefaultAzureCredential(), subscription_id)

    async def collect(self, resource_id: str, period_days: int = 30) -> dict:
        end = datetime.utcnow()
        start = end - timedelta(days=period_days)

        # CPU utilization
        cpu = self.monitor.metrics.list(
            resource_id, timespan=f"{start}/{end}",
            metricnames="Percentage CPU", aggregation="Average",
            interval="PT1H",
        )

        # GPU utilization (for GPU-enabled resources)
        gpu = None
        try:
            gpu = self.monitor.metrics.list(
                resource_id, timespan=f"{start}/{end}",
                metricnames="GPU Utilization", aggregation="Average",
            )
        except: pass

        # Memory utilization
        memory = self.monitor.metrics.list(
            resource_id, timespan=f"{start}/{end}",
            metricnames="Available Memory Bytes", aggregation="Average",
        )

        return {
            "resource_id": resource_id,
            "period_days": period_days,
            "cpu": self._summarize(cpu),    # avg, p50, p95, max
            "gpu": self._summarize(gpu) if gpu else None,
            "memory": self._summarize(memory),
            "cost": await self.get_cost(resource_id, start, end),
        }

    def _summarize(self, metrics_response) -> dict:
        values = [dp.average for ts in metrics_response.value for dp in ts.timeseries[0].data if dp.average]
        return {
            "avg": round(sum(values) / len(values), 1) if values else 0,
            "p50": round(sorted(values)[len(values)//2], 1) if values else 0,
            "p95": round(sorted(values)[int(len(values)*0.95)], 1) if values else 0,
            "max": round(max(values), 1) if values else 0,
        }
```

## Step 3: Deploy Right-Sizing Engine

```python
# right_sizer.py — SKU recommendations based on utilization
class RightSizingEngine:
    SKU_TIERS = {
        "Standard_D2s_v5": {"vcpu": 2, "ram_gb": 8, "cost_hr": 0.096},
        "Standard_D4s_v5": {"vcpu": 4, "ram_gb": 16, "cost_hr": 0.192},
        "Standard_D8s_v5": {"vcpu": 8, "ram_gb": 32, "cost_hr": 0.384},
        "Standard_D16s_v5": {"vcpu": 16, "ram_gb": 64, "cost_hr": 0.768},
        "Standard_NC4as_T4_v3": {"vcpu": 4, "gpu": "T4", "cost_hr": 0.526},
        "Standard_NC8as_T4_v3": {"vcpu": 8, "gpu": "T4", "cost_hr": 0.752},
        "Standard_NC24ads_A100_v4": {"vcpu": 24, "gpu": "A100", "cost_hr": 3.673},
    }

    def recommend(self, resource, metrics) -> dict:
        current_sku = resource["sku"]
        current_cost = self.SKU_TIERS.get(current_sku, {}).get("cost_hr", 0)

        recommendations = []

        # CPU under-utilized → downsize
        if metrics["cpu"]["p95"] < 30 and current_sku in self.SKU_TIERS:
            smaller = self._find_smaller_sku(current_sku)
            if smaller:
                savings = (current_cost - self.SKU_TIERS[smaller]["cost_hr"]) / current_cost * 100
                recommendations.append({
                    "type": "downsize",
                    "current": current_sku,
                    "suggested": smaller,
                    "savings_pct": round(savings, 1),
                    "reason": f"CPU p95={metrics['cpu']['p95']}% — over-provisioned",
                    "monthly_savings": round((current_cost - self.SKU_TIERS[smaller]["cost_hr"]) * 730, 2),
                })

        # GPU under-utilized → switch to CPU or smaller GPU
        if metrics.get("gpu") and metrics["gpu"]["avg"] < 30:
            recommendations.append({
                "type": "gpu_optimization",
                "current": current_sku,
                "suggested": "Standard_D8s_v5",
                "reason": f"GPU utilization {metrics['gpu']['avg']}% — consider CPU-only for this workload",
                "monthly_savings": round((current_cost - 0.384) * 730, 2),
            })

        return {"resource": resource["name"], "recommendations": recommendations}
```

## Step 4: Deploy Cost Anomaly Detector

```python
# anomaly_detector.py — detect unusual cost spikes
class CostAnomalyDetector:
    def __init__(self, config):
        self.threshold_pct = config.get("anomaly_threshold_pct", 20)
        self.lookback_days = config.get("lookback_days", 30)

    async def detect(self, subscription_id: str) -> list:
        # Get daily costs for last 30 days
        daily_costs = await self.get_daily_costs(subscription_id, self.lookback_days)

        avg_daily = sum(daily_costs.values()) / len(daily_costs)
        anomalies = []

        for date, cost in daily_costs.items():
            deviation = ((cost - avg_daily) / avg_daily) * 100
            if deviation > self.threshold_pct:
                anomalies.append({
                    "date": date,
                    "cost": cost,
                    "avg_daily": round(avg_daily, 2),
                    "deviation_pct": round(deviation, 1),
                    "severity": "critical" if deviation > 50 else "high" if deviation > 30 else "medium",
                })

        return anomalies
```

## Step 5: Deploy Auto-Scaling Advisor

```python
# scaling_advisor.py — recommend auto-scale configurations
class AutoScalingAdvisor:
    async def recommend(self, resource, metrics) -> dict:
        if metrics["cpu"]["p95"] > 80:
            return {
                "recommendation": "enable_auto_scale",
                "trigger": "cpu_p95 > 80%",
                "suggested_config": {
                    "min_replicas": max(1, resource.get("current_replicas", 1)),
                    "max_replicas": resource.get("current_replicas", 1) * 3,
                    "scale_up_rule": "cpu > 70% for 5 min → +1 replica",
                    "scale_down_rule": "cpu < 30% for 10 min → -1 replica",
                    "cooldown_minutes": 5,
                },
            }
        return {"recommendation": "no_change", "reason": "CPU p95 within acceptable range"}
```

## Step 6: Deploy FinOps Dashboard

```bash
az containerapp create \
  --name infra-optimizer \
  --resource-group rg-frootai-infra-optimizer \
  --environment optimizer-env \
  --image acrOptimizer.azurecr.io/infra-optimizer:latest \
  --target-port 8080 --min-replicas 1 --max-replicas 2

# Test right-sizing analysis
curl -X POST https://infra-optimizer.azurecontainerapps.io/api/analyze \
  -d '{"resource_group": "rg-my-ai-workloads", "period_days": 30}'

# Check cost anomalies
curl https://infra-optimizer.azurecontainerapps.io/api/anomalies

# Get scaling recommendations
curl https://infra-optimizer.azurecontainerapps.io/api/scaling-advisor
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Metrics collected | Analyze resource group | CPU/GPU/memory/cost data |
| Right-sizing | Over-provisioned VM | Downsize recommendation |
| GPU analysis | Low-GPU-util resource | CPU-only suggestion |
| Cost anomaly | Spike in daily costs | Alert with deviation % |
| Scaling advisor | High-CPU resource | Auto-scale config suggested |
| Monthly savings | Check recommendations | Dollar savings calculated |
| LLM explanation | Check recommendation detail | Human-readable reasoning |
| Dashboard | Open portal | Resource list with scores |

## Rollback Procedure

```bash
az containerapp revision list --name infra-optimizer \
  --resource-group rg-frootai-infra-optimizer
az containerapp ingress traffic set --name infra-optimizer \
  --resource-group rg-frootai-infra-optimizer \
  --revision-weight previousRevision=100
```
