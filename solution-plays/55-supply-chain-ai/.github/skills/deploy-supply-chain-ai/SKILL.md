---
name: "deploy-supply-chain-ai"
description: "Deploy Supply Chain AI — demand forecasting (ML + LLM explanation), supplier risk scoring, inventory optimization, logistics routing, procurement anomaly detection, external signal integration."
---

# Deploy Supply Chain AI

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for analysis/explanation)
  - `Microsoft.Kusto` (Azure Data Explorer for time-series data)
  - `Microsoft.App` (Container Apps for forecast pipeline)
  - `Microsoft.Storage` (Blob Storage for historical data)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `openai`, `prophet`, `scikit-learn`, `pandas`, `azure-kusto-data` packages
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `ADX_CLUSTER`, `ADX_DATABASE`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-supply-chain-ai --location eastus2

az deployment group create \
  --resource-group rg-frootai-supply-chain-ai \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

az keyvault secret set --vault-name kv-supply-chain \
  --name openai-key --value "$AZURE_OPENAI_KEY"
```

## Step 2: Deploy Azure Data Explorer for Time-Series

```bash
# Create ADX cluster for time-series analytics
az kusto cluster create \
  --name adx-supply-chain \
  --resource-group rg-frootai-supply-chain-ai \
  --location eastus2 \
  --sku name="Dev(No SLA)_Standard_E2a_v4" tier="Basic" capacity=1

# Create database
az kusto database create \
  --cluster-name adx-supply-chain \
  --database-name supply_data \
  --resource-group rg-frootai-supply-chain-ai \
  --read-write-database soft-delete-period=P365D hot-cache-period=P31D
```

ADX tables for supply chain:
| Table | Content | Retention |
|-------|---------|-----------|
| `sales_history` | Daily/weekly sales per product | 3 years |
| `inventory_levels` | Current stock per warehouse | 90 days |
| `supplier_deliveries` | Delivery timestamps, quality scores | 2 years |
| `external_signals` | Weather, holidays, economic indicators | 1 year |
| `procurement_orders` | PO data, costs, lead times | 2 years |

## Step 3: Deploy Demand Forecasting Pipeline

```python
# forecaster.py — ML forecast with LLM anomaly explanation
from prophet import Prophet
import pandas as pd

class DemandForecaster:
    def __init__(self, config):
        self.horizon_days = config.get("forecast_horizon", 90)
        self.confidence_level = config.get("confidence_interval", 0.95)
        self.openai = AzureOpenAI(azure_endpoint=config["endpoint"])

    async def forecast(self, product_id: str, sales_data: pd.DataFrame) -> Forecast:
        # 1. Prepare data for Prophet
        df = sales_data.rename(columns={"date": "ds", "quantity": "y"})

        # 2. Add external regressors
        external = await self.get_external_signals()
        for signal in ["holiday", "promotion", "weather_temp"]:
            if signal in external.columns:
                df[signal] = external[signal]

        # 3. Fit and predict
        model = Prophet(
            interval_width=self.confidence_level,
            seasonality_mode="multiplicative",
            yearly_seasonality=True,
            weekly_seasonality=True,
        )
        for signal in ["holiday", "promotion", "weather_temp"]:
            if signal in df.columns:
                model.add_regressor(signal)

        model.fit(df)
        future = model.make_future_dataframe(periods=self.horizon_days)
        forecast = model.predict(future)

        # 4. Anomaly detection + LLM explanation
        anomalies = self.detect_anomalies(forecast)
        explanations = []
        if anomalies:
            for anomaly in anomalies:
                explanation = await self.explain_anomaly(anomaly, external)
                explanations.append(explanation)

        return Forecast(
            predictions=forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(self.horizon_days),
            anomalies=anomalies,
            explanations=explanations,
            model_metrics={"mape": self.calculate_mape(df, forecast)},
        )

    async def explain_anomaly(self, anomaly, external_signals):
        """LLM explains why the forecast shows unusual patterns."""
        response = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0.2,
            messages=[
                {"role": "system", "content": "You are a supply chain analyst. Explain demand anomalies using external data."},
                {"role": "user", "content": f"Anomaly: {anomaly}\nExternal signals: {external_signals.to_dict()}"},
            ],
        )
        return response.choices[0].message.content
```

## Step 4: Deploy Supplier Risk Scoring

```python
# supplier_risk.py — multi-factor risk assessment
class SupplierRiskScorer:
    RISK_WEIGHTS = {
        "financial_health": 0.25,
        "delivery_reliability": 0.25,
        "quality_score": 0.20,
        "geo_risk": 0.15,
        "concentration_risk": 0.15,
    }

    async def score_supplier(self, supplier_id: str) -> SupplierRisk:
        data = await self.get_supplier_data(supplier_id)

        scores = {
            "financial_health": self.score_financial(data["financials"]),
            "delivery_reliability": data["on_time_rate"],
            "quality_score": 1 - data["defect_rate"],
            "geo_risk": self.score_geo_risk(data["country"]),
            "concentration_risk": self.score_concentration(data["revenue_share"]),
        }

        weighted_score = sum(scores[k] * self.RISK_WEIGHTS[k] for k in scores)
        risk_score = (1 - weighted_score) * 100  # 0=safe, 100=risky

        recommendation = "maintain"
        if risk_score > 70: recommendation = "replace"
        elif risk_score > 40: recommendation = "diversify"

        return SupplierRisk(
            supplier=supplier_id, risk_score=risk_score,
            factors=scores, recommendation=recommendation,
        )
```

## Step 5: Deploy Inventory Optimizer

```python
# inventory_optimizer.py — safety stock + reorder point
class InventoryOptimizer:
    def optimize(self, forecast, lead_time_days, service_level=0.95):
        avg_demand = forecast.predictions["yhat"].mean()
        demand_std = forecast.predictions["yhat"].std()

        # Safety stock = Z-score × demand std × sqrt(lead time)
        z_score = stats.norm.ppf(service_level)  # 1.645 for 95%
        safety_stock = z_score * demand_std * math.sqrt(lead_time_days)

        # Reorder point = avg daily demand × lead time + safety stock
        reorder_point = avg_demand * lead_time_days + safety_stock

        # Economic order quantity (EOQ)
        ordering_cost = self.config["ordering_cost"]
        holding_cost = self.config["holding_cost_per_unit"]
        annual_demand = avg_demand * 365
        eoq = math.sqrt(2 * annual_demand * ordering_cost / holding_cost)

        return InventoryPlan(
            safety_stock=round(safety_stock),
            reorder_point=round(reorder_point),
            eoq=round(eoq),
            service_level=service_level,
        )
```

## Step 6: Deploy and Verify

```bash
az acr build --registry acrSupplyChain --image supply-chain-ai:latest .

az containerapp create \
  --name supply-chain-ai \
  --resource-group rg-frootai-supply-chain-ai \
  --environment supply-env \
  --image acrSupplyChain.azurecr.io/supply-chain-ai:latest \
  --target-port 8080 --min-replicas 1 --max-replicas 3 \
  --secrets openai-key=keyvaultref:kv-supply-chain/openai-key

# Test forecast
curl -X POST https://supply-chain-ai.azurecontainerapps.io/api/forecast \
  -d '{"product_id": "SKU-001", "horizon_days": 90}'

# Test supplier risk
curl https://supply-chain-ai.azurecontainerapps.io/api/supplier-risk/SUP-001
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| ADX data flowing | Query sales_history | Recent data present |
| Forecast generated | POST forecast request | 90-day predictions with CI |
| Confidence intervals | Check output | yhat_lower, yhat_upper present |
| Anomaly explained | Inject anomaly | LLM explanation returned |
| Supplier risk scored | GET risk endpoint | Score 0-100 with factors |
| Inventory plan | GET optimization | Safety stock + reorder + EOQ |
| External signals | Check feature matrix | Weather, holidays integrated |
| MAPE calculated | Check model metrics | MAPE value returned |

## Rollback Procedure

```bash
az containerapp revision list --name supply-chain-ai \
  --resource-group rg-frootai-supply-chain-ai
az containerapp ingress traffic set --name supply-chain-ai \
  --resource-group rg-frootai-supply-chain-ai \
  --revision-weight previousRevision=100
```
