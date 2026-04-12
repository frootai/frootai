---
name: "deploy-retail-inventory-predictor"
description: "Deploy Retail Inventory Predictor — SKU-level demand forecasting, dynamic safety stock, promotion modeling, automated replenishment, stockout/overstock prevention."
---

# Deploy Retail Inventory Predictor

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- POS transaction history (≥2 years per SKU/store for seasonality)
- Python 3.11+ with `azure-openai`, `lightgbm`, `prophet`, `pandas`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-inventory \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure ML | Demand forecasting model training + serving | Compute on-demand |
| Azure Data Explorer | Sales time-series analytics (KQL) | Dev(No SLA) |
| Azure OpenAI | Anomaly explanation + replenishment reports | S0 |
| Event Hubs | Real-time POS transaction streaming | Standard |
| Cosmos DB | SKU metadata, forecasts, reorder history | Serverless |
| Azure Functions | Reorder trigger engine (event-driven) | Consumption |
| Container Apps | Inventory dashboard API | Consumption |
| Azure Key Vault | API keys + POS system credentials | Standard |

## Step 2: Ingest Sales History

```python
# Sales data schema (per transaction line)
SALES_SCHEMA = {
    "transaction_id": str,
    "timestamp": str,       # ISO 8601
    "store_id": str,
    "sku": str,
    "quantity": int,
    "unit_price": float,
    "discount_pct": float,
    "promotion_id": str,    # null if no promotion
    "payment_method": str
}

# Aggregate to daily SKU × store level
# daily_sales = SUM(quantity) per sku × store × date
# Include zero-sales days (important for demand modeling)
```

## Step 3: Train Demand Forecasting Model

```python
import lightgbm as lgb

DEMAND_FEATURES = [
    # Temporal
    "day_of_week", "month", "day_of_month", "is_weekend", "is_holiday",
    "week_of_year", "is_payday",
    # Lag features
    "sales_lag_1d", "sales_lag_7d", "sales_lag_14d", "sales_lag_28d",
    "sales_rolling_7d_avg", "sales_rolling_28d_avg",
    # External
    "promotion_active", "promotion_discount_pct", "promotion_type",
    "weather_temp_max", "weather_precip",
    "local_event_nearby",
    # Product
    "category", "brand", "price_tier", "shelf_life_days",
    # Store
    "store_size", "store_region", "store_format"
]

# Train per store-cluster (group similar stores for data efficiency)
model = lgb.LGBMRegressor(
    n_estimators=300, max_depth=8, learning_rate=0.05,
    num_leaves=63, min_child_samples=20,
    subsample=0.8, colsample_bytree=0.8
)
model.fit(X_train[DEMAND_FEATURES], y_train["daily_quantity"])

# For slow movers (< 1 unit/day): use intermittent demand model (Croston)
from statsforecast.models import CrostonClassic
slow_model = CrostonClassic()
```

## Step 4: Deploy Reorder Point Calculator

```python
import numpy as np
from scipy.stats import norm

def calculate_reorder_point(
    forecast: list[float],  # Daily demand forecast for lead_time + review period
    lead_time_days: int,
    review_period_days: int,
    service_level: float = 0.95,
    demand_std: float = None
) -> int:
    """Calculate reorder point with safety stock."""
    # Demand during lead time + review period
    demand_during_lt = sum(forecast[:lead_time_days + review_period_days])
    
    # Safety stock = z-score × σ × √(lead_time + review)
    if demand_std is None:
        demand_std = np.std(forecast)
    z_score = norm.ppf(service_level)  # 0.95 → z = 1.645
    safety_stock = z_score * demand_std * np.sqrt(lead_time_days + review_period_days)
    
    reorder_point = int(np.ceil(demand_during_lt + safety_stock))
    return reorder_point

def calculate_order_quantity(
    forecast: list[float],
    lead_time_days: int,
    review_period_days: int = 7,
    current_stock: int = 0,
    on_order: int = 0,
    min_order_qty: int = 1,
    pack_size: int = 1
) -> int:
    """Calculate how much to order (order-up-to level)."""
    target_stock = sum(forecast[:lead_time_days + review_period_days]) + calculate_safety_stock(forecast, lead_time_days)
    order_qty = max(0, target_stock - current_stock - on_order)
    
    # Round up to pack size
    order_qty = int(np.ceil(order_qty / pack_size) * pack_size)
    return max(order_qty, min_order_qty) if order_qty > 0 else 0
```

## Step 5: Deploy Promotion Effect Modeling

```python
PROMOTION_EFFECTS = {
    "bogo": {"lift_multiplier": 2.5, "post_promo_dip": 0.7, "dip_days": 7},
    "pct_off_20": {"lift_multiplier": 1.5, "post_promo_dip": 0.9, "dip_days": 3},
    "pct_off_40": {"lift_multiplier": 2.0, "post_promo_dip": 0.8, "dip_days": 5},
    "bundle": {"lift_multiplier": 1.3, "post_promo_dip": 0.95, "dip_days": 2},
    "loyalty_exclusive": {"lift_multiplier": 1.2, "post_promo_dip": 1.0, "dip_days": 0}
}

async def adjust_forecast_for_promotion(forecast: list[float], promo: Promotion) -> list[float]:
    """Adjust demand forecast for planned promotions."""
    effect = PROMOTION_EFFECTS.get(promo.type, {"lift_multiplier": 1.3, "post_promo_dip": 0.9, "dip_days": 3})
    
    adjusted = forecast.copy()
    for day_idx in range(promo.start_day, promo.end_day):
        adjusted[day_idx] *= effect["lift_multiplier"]
    
    # Post-promotion demand dip
    for day_idx in range(promo.end_day, min(promo.end_day + effect["dip_days"], len(adjusted))):
        adjusted[day_idx] *= effect["post_promo_dip"]
    
    return adjusted
```

## Step 6: Deploy Automated Replenishment Engine

```python
# Event-driven: check inventory daily (or on each POS transaction)
async def check_replenishment(sku: str, store: str):
    """Triggered by daily schedule or stockout event."""
    current = await get_current_inventory(sku, store)
    forecast = await get_demand_forecast(sku, store, horizon_days=14)
    lead_time = await get_supplier_lead_time(sku)
    
    reorder_point = calculate_reorder_point(forecast, lead_time, review_period_days=1, service_level=0.95)
    
    if current <= reorder_point:
        order_qty = calculate_order_quantity(forecast, lead_time, current_stock=current)
        await create_purchase_order(sku, store, order_qty, supplier=get_preferred_supplier(sku))
        await notify_buyer(sku, store, order_qty, reason="below_reorder_point")
```

## Step 7: Smoke Test

```bash
# Get demand forecast
curl -s https://api-inventory.azurewebsites.net/api/forecast \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sku": "SKU-001", "store": "store-42", "horizon_days": 14}' | jq '.predictions[:7]'

# Check reorder status
curl -s https://api-inventory.azurewebsites.net/api/reorder \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sku": "SKU-001", "store": "store-42"}' | jq '.action, .order_qty'

# Get stockout risk report
curl -s https://api-inventory.azurewebsites.net/api/stockout-risk \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"store": "store-42", "days_ahead": 7}' | jq '.at_risk_skus[:5]'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Forecast MAPE > 30% | Insufficient features or data | Add promotion + weather + events features |
| Constant stockouts | Safety stock too low | Increase service level from 0.95 to 0.98 |
| Overstock building up | Forecast too optimistic | Check for bias (mean error), add post-promo dip |
| Slow movers always reordering | Standard model bad for intermittent demand | Use Croston model for items < 1 unit/day |
| Promotion lift wrong | Using generic multiplier | Calibrate from actual promotion history per category |
