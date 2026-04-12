---
name: "deploy-building-energy-optimizer"
description: "Deploy Building Energy Optimizer — occupancy-based HVAC scheduling, zone setpoint optimization, energy consumption prediction, fault detection, sustainability reporting."
---

# Deploy Building Energy Optimizer

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- BMS (Building Management System) with API or BACnet access
- Python 3.11+ with `azure-openai`, `azure-iot-device`, `scikit-learn`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-building-energy \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure IoT Hub | BMS sensor data (temperature, humidity, occupancy) | S1 |
| Azure Digital Twins | Building model (zones, HVAC units, sensors) | S1 |
| Azure OpenAI | Sustainability reporting + anomaly explanation | S0 |
| Azure Data Explorer | 15-minute interval energy time-series | Dev(No SLA) |
| Azure ML | Occupancy prediction + energy forecasting | Compute on-demand |
| Azure Functions | Setpoint recommendation engine (event-driven) | Consumption |
| Cosmos DB | Zone configs, schedules, optimization history | Serverless |
| Container Apps | Energy dashboard API | Consumption |

## Step 2: Configure Building Digital Twin

```python
# Building zone model
BUILDING_MODEL = {
    "building_id": "hq-001",
    "floors": 5,
    "zones": [
        {
            "id": "floor-1-east",
            "type": "open_office",
            "sqft": 5000,
            "max_occupancy": 80,
            "hvac_unit": "ahu-1e",
            "orientation": "east",
            "sensors": ["temp-1e", "humidity-1e", "occ-1e", "co2-1e"]
        },
        {
            "id": "floor-1-conf",
            "type": "conference_room",
            "sqft": 400,
            "max_occupancy": 12,
            "hvac_unit": "vav-1c",
            "orientation": "north",
            "sensors": ["temp-1c", "humidity-1c", "occ-1c"]
        }
    ]
}

# Register in Azure Digital Twins
az dt twin create --dt-name dt-building-hq \
  --twin-id floor-1-east --model "dtmi:building:zone;1" \
  --properties '{"type":"open_office","sqft":5000}'
```

## Step 3: Deploy Occupancy Prediction

```python
async def predict_occupancy(building_id: str, horizon_hours: int = 24) -> dict[str, list[int]]:
    """Predict occupancy per zone for scheduling."""
    # Data sources (fused for accuracy)
    OCCUPANCY_SOURCES = {
        "badge_in": {"weight": 0.30, "lag_min": 0},
        "wifi_devices": {"weight": 0.25, "lag_min": 5},
        "co2_levels": {"weight": 0.15, "lag_min": 15},
        "calendar_events": {"weight": 0.20, "lag_min": -60},  # Predictive
        "historical_pattern": {"weight": 0.10, "lag_min": 0}
    }
    
    predictions = {}
    for zone in building.zones:
        features = await gather_occupancy_features(zone.id, OCCUPANCY_SOURCES)
        predicted = occupancy_model.predict(features, horizon_hours=horizon_hours)
        predictions[zone.id] = predicted  # List of hourly occupancy counts
    
    return predictions
```

## Step 4: Deploy HVAC Optimization Engine

```python
# ASHRAE 55 comfort ranges
COMFORT_RANGES = {
    "cooling_season": {"temp_f": (73, 79), "humidity_pct": (30, 60)},
    "heating_season": {"temp_f": (68, 76), "humidity_pct": (30, 60)},
    "setback_cooling": 85,   # Empty zone in summer
    "setback_heating": 55,   # Empty zone in winter
    "pre_condition_lead_min": 30  # Start conditioning 30 min before occupancy
}

async def compute_setpoints(zone: Zone, occupancy: list[int], weather: WeatherForecast) -> list[SetPoint]:
    """Compute optimal setpoints per 15-minute interval."""
    setpoints = []
    for interval in range(96):  # 96 × 15-min = 24 hours
        hour = interval // 4
        occ = occupancy[hour]
        
        if occ == 0:
            # Empty zone — setback temperature
            mode = "eco"
            temp = COMFORT_RANGES["setback_cooling"] if weather.is_cooling else COMFORT_RANGES["setback_heating"]
        elif occ < zone.max_occupancy * 0.3:
            # Low occupancy — moderate savings
            mode = "economy"
            temp = comfort_midpoint(weather) + (2 if weather.is_cooling else -2)
        else:
            # Occupied — full comfort
            mode = "comfort"
            temp = comfort_midpoint(weather)
        
        # Pre-conditioning: start 30 min before occupancy increase
        if interval > 0 and occupancy.get(hour+1, 0) > occ * 1.5:
            mode = "pre_condition"
        
        setpoints.append(SetPoint(zone=zone.id, interval=interval, temp=temp, mode=mode))
    return setpoints
```

## Step 5: Deploy Fault Detection

```python
FAULT_RULES = {
    "stuck_valve": {
        "condition": "zone_temp diverges from setpoint > 5°F for > 60 min",
        "severity": "high",
        "action": "Create maintenance ticket for valve inspection"
    },
    "simultaneous_heating_cooling": {
        "condition": "heating AND cooling active in same zone simultaneously",
        "severity": "critical",
        "action": "Disable conflicting system, alert facilities"
    },
    "excessive_runtime": {
        "condition": "HVAC unit runs > 20 hours/day for 3+ consecutive days",
        "severity": "medium",
        "action": "Check for equipment degradation, review setpoints"
    },
    "energy_anomaly": {
        "condition": "Energy consumption > 2 std dev above 30-day rolling average",
        "severity": "medium",
        "action": "LLM explanation of anomaly + root cause analysis"
    },
    "sensor_drift": {
        "condition": "Temperature sensor reads > 5°F different from adjacent zone avg",
        "severity": "low",
        "action": "Schedule sensor calibration"
    }
}
```

## Step 6: Smoke Test

```bash
# Get current building status
curl -s https://api-building.azurewebsites.net/api/status \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"building_id": "hq-001"}' | jq '.zones[:2]'

# Get optimized schedule
curl -s https://api-building.azurewebsites.net/api/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"building_id": "hq-001", "date": "2026-04-12"}' | jq '.estimated_savings_pct'

# Check active faults
curl -s https://api-building.azurewebsites.net/api/faults \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"building_id": "hq-001"}' | jq '.active_faults'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Occupancy prediction off | Badge data not synced | Check badge-in API lag, add WiFi fallback |
| Zone too hot/cold | Stale weather data | Reduce weather poll interval to 30 min |
| Setback zone complained cold | Meeting not in calendar | Add CO2 sensor as real-time override |
| Energy savings < 10% | Zones already well-managed | Focus on setback + pre-conditioning |
| Fault detection false positives | Thresholds too tight | Widen stuck_valve threshold to 7°F, 90 min |
