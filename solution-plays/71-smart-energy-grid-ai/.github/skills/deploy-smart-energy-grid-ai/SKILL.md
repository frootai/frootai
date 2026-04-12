---
name: "deploy-smart-energy-grid-ai"
description: "Deploy Smart Energy Grid AI — load forecasting, renewable dispatch optimization, demand response, grid anomaly detection, energy trading support."
---

# Deploy Smart Energy Grid AI

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Azure IoT Hub for grid sensor data ingestion
- Time-series data store (Azure Data Explorer or Cosmos DB)
- Python 3.11+ with `azure-ai-ml`, `prophet`, `pandas`

## Step 1: Deploy Grid Data Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-energy-grid \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure IoT Hub | Sensor data ingestion (frequency, voltage, load) | S1 (400K msg/day) |
| Azure Data Explorer | Time-series storage + KQL analytics | Dev(No SLA) / Standard |
| Azure OpenAI | Anomaly explanation + demand response recommendations | S0 |
| Azure Machine Learning | Time-series forecast model training | Compute on-demand |
| Azure Event Hubs | Real-time grid telemetry streaming | Standard (1 TU) |
| Azure Functions | Event-driven processing (sensor → forecast trigger) | Consumption |
| Azure Key Vault | API keys + IoT Hub connection strings | Standard |
| Container Apps | Grid dashboard API + forecast serving | Consumption |

## Step 2: Configure IoT Hub for Grid Sensors

```bash
# Register grid zone sensor devices
az iot hub device-identity create \
  --hub-name iot-energy-grid \
  --device-id zone-north-meter-001 \
  --edge-enabled false

# Configure message routing → Event Hubs → Data Explorer
az iot hub message-route create \
  --hub-name iot-energy-grid \
  --route-name grid-telemetry \
  --source devicemessages \
  --endpoint-name eh-grid-telemetry \
  --condition "true"
```

Sensor data schema:
```json
{
  "zone_id": "north",
  "timestamp": "2026-04-11T14:30:00Z",
  "load_kw": 4523.7,
  "voltage_v": 239.8,
  "frequency_hz": 49.98,
  "renewable_kw": 1200.0,
  "temperature_c": 22.5,
  "solar_irradiance_w_m2": 680
}
```

## Step 3: Deploy Load Forecasting Model

```bash
# Train time-series model (Prophet / LightGBM / LSTM)
python models/train_forecast.py \
  --data-source adx://grid-telemetry \
  --lookback-days 365 \
  --horizon-hours 24 \
  --model-type prophet \
  --output models/load_forecast_v1.pkl

# Register model in Azure ML
az ml model create \
  --name load-forecast \
  --version 1 \
  --path models/load_forecast_v1.pkl \
  --type custom_model
```

Forecast model selection:
| Model | Best For | MAPE Target |
|-------|----------|-------------|
| Prophet | Seasonal patterns with events | < 5% |
| LightGBM | Feature-rich (weather + events) | < 4% |
| LSTM | High-frequency (15-min intervals) | < 6% |
| Ensemble | Production (weighted average of above) | < 3.5% |

## Step 4: Deploy Renewable Dispatch Optimizer

```python
# Renewable dispatch priority order:
# 1. Solar → 2. Wind → 3. Battery discharge → 4. Gas peaker (last resort)
DISPATCH_ORDER = ["solar", "wind", "battery", "hydro", "gas_peaker"]

# Curtailment only when:
# - Grid frequency > 50.5 Hz (oversupply)
# - Battery SOC > 95% AND no forecasted demand increase
# - Transmission constraint violation
```

Deploy optimizer as Azure Function:
```bash
func azure functionapp publish func-energy-dispatch \
  --python --build remote
```

## Step 5: Configure Demand Response

```json
// config/agents.json — demand response settings
{
  "demand_response": {
    "peak_threshold_kw": 8000,
    "price_signal_tiers": [
      {"tier": "normal", "price_kwh": 0.12, "below_kw": 6000},
      {"tier": "high", "price_kwh": 0.25, "below_kw": 8000},
      {"tier": "critical", "price_kwh": 0.50, "above_kw": 8000}
    ],
    "large_consumer_threshold_kw": 500,
    "notification_lead_time_min": 30,
    "max_curtailment_pct": 20
  }
}
```

## Step 6: Deploy Grid Anomaly Detection

```bash
# Anomaly detection on grid telemetry (frequency, voltage, load)
python models/train_anomaly.py \
  --data-source adx://grid-telemetry \
  --features frequency_hz,voltage_v,load_kw \
  --method isolation_forest \
  --contamination 0.02 \
  --output models/grid_anomaly_v1.pkl
```

Anomaly types:
| Anomaly | Detection Method | Response |
|---------|-----------------|----------|
| Frequency deviation (±0.5 Hz) | Statistical threshold | Auto-dispatch reserves |
| Voltage sag/swell (±10%) | Isolation Forest | Alert + auto-transformer |
| Unexpected load spike | Forecast residual > 3σ | LLM explanation + demand response |
| Renewable drop-off | Weather forecast mismatch | Switch to gas peaker |
| Transmission overload | KQL capacity query | Load shedding protocol |

## Step 7: Smoke Test

```bash
# Verify IoT Hub receiving sensor data
az iot hub monitor-events --hub-name iot-energy-grid --timeout 30

# Test forecast API
curl -s https://api-energy-grid.azurewebsites.net/api/forecast \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"zone": "north", "horizon_hours": 24}' | jq '.predictions[:3]'

# Test anomaly detection
curl -s https://api-energy-grid.azurewebsites.net/api/anomalies \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"zone": "north", "lookback_hours": 4}' | jq '.anomalies'

# Verify demand response signals
curl -s https://api-energy-grid.azurewebsites.net/api/demand-response/status \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Forecast MAPE > 10% | Insufficient training data | Add weather features, extend lookback |
| IoT Hub throttled | Too many devices/messages | Scale to S2 or partition |
| Anomaly false positives high | Contamination parameter too high | Lower to 0.01, retrain |
| Demand response lag > 5 min | Function cold start | Use Premium plan or pre-warm |
| Data Explorer query timeout | Large time range | Add materialized views, partition |
