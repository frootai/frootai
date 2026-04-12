---
name: "deploy-food-safety-inspector-ai"
description: "Deploy Food Safety Inspector AI — HACCP monitoring, contamination risk scoring, supply chain traceability, recall management, FDA/EFSA regulatory reporting."
---

# Deploy Food Safety Inspector AI

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- HACCP plan for target facility (CCPs, critical limits)
- Python 3.11+ with `azure-openai`, `azure-iot-device`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-food-safety \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure IoT Hub | Temperature/humidity sensor data from CCPs | S1 |
| Azure OpenAI | Pattern analysis + inspection report generation | S0 |
| Cosmos DB | Inspection history, HACCP records, traceability logs | Serverless |
| Azure Event Hubs | Real-time HACCP alert streaming | Standard |
| Azure Functions | Event-driven CCP violation alerts | Consumption |
| Container Apps | Inspection API + dashboard | Consumption |
| Azure Key Vault | API keys + IoT credentials | Standard |
| App Insights | Inspection telemetry + compliance tracking | Pay-as-you-go |

## Step 2: Configure HACCP Digital Twin

```python
# HACCP Critical Control Points (CCPs) by food operation
HACCP_PLAN = {
    "receiving": {
        "critical": True,
        "parameters": {
            "temperature_f": {"limit": 41, "operator": "<=", "unit": "°F"},
            "packaging_integrity": {"limit": True, "operator": "==", "unit": "boolean"}
        },
        "monitoring_frequency_min": 0,  # Every delivery
        "corrective_action": "Reject shipment if temp > 41°F or packaging damaged"
    },
    "cold_storage": {
        "critical": True,
        "parameters": {
            "temperature_f": {"limit": 40, "operator": "<=", "unit": "°F"},
            "humidity_pct": {"limit": 85, "operator": "<=", "unit": "%"}
        },
        "monitoring_frequency_min": 15,
        "corrective_action": "Move to backup unit, discard if >2 hours above limit"
    },
    "cooking": {
        "critical": True,
        "parameters": {
            "internal_temp_f": {"limit": 165, "operator": ">=", "unit": "°F"},
            "hold_time_sec": {"limit": 15, "operator": ">=", "unit": "seconds"}
        },
        "monitoring_frequency_min": 0,  # Every batch
        "corrective_action": "Continue cooking until temp reached. Discard if not achievable."
    },
    "cooling": {
        "critical": True,
        "parameters": {
            "cool_135_to_70_min": {"limit": 120, "operator": "<=", "unit": "minutes"},
            "cool_70_to_41_hours": {"limit": 4, "operator": "<=", "unit": "hours"}
        },
        "monitoring_frequency_min": 30,
        "corrective_action": "Discard if cooling times exceeded"
    },
    "hot_holding": {
        "critical": True,
        "parameters": {
            "temperature_f": {"limit": 135, "operator": ">=", "unit": "°F"}
        },
        "monitoring_frequency_min": 30,
        "corrective_action": "Reheat to 165°F within 2 hours or discard"
    }
}
```

## Step 3: Deploy IoT Sensor Integration

```bash
# Register temperature sensors at each CCP
az iot hub device-identity create \
  --hub-name iot-food-safety \
  --device-id cold-storage-sensor-001

# Sensor data schema
# {
#   "device_id": "cold-storage-sensor-001",
#   "ccp": "cold_storage",
#   "timestamp": "2026-04-11T14:30:00Z",
#   "temperature_f": 38.5,
#   "humidity_pct": 72,
#   "door_open": false
# }

# Route alerts to Event Hubs for real-time processing
az iot hub message-route create \
  --hub-name iot-food-safety \
  --route-name ccp-violations \
  --source devicemessages \
  --endpoint-name eh-violations \
  --condition "temperature_f > 41 OR temperature_f < 135"
```

## Step 4: Deploy Violation Pattern Detector

```python
async def detect_violation_patterns(facility_id: str, months: int = 12) -> list[Pattern]:
    """Detect recurring patterns in HACCP violations."""
    history = await get_inspection_history(facility_id, months=months)
    
    PATTERN_TYPES = {
        "recurring_ccp": "Same CCP fails repeatedly (equipment issue?)",
        "time_pattern": "Violations cluster at specific times (shift change?)",
        "seasonal": "Violations increase in summer (cooling capacity?)",
        "trending": "Parameter trending toward limit (preventive action needed)",
        "correlated": "Multiple CCPs fail together (systemic issue)"
    }
    
    patterns = []
    # Check recurring by CCP
    ccp_counts = Counter(v.ccp for v in history.violations)
    for ccp, count in ccp_counts.most_common(3):
        if count >= 3:
            patterns.append(Pattern(type="recurring_ccp", ccp=ccp, count=count,
                action=f"Inspect {ccp} equipment, review SOP, retrain staff"))
    
    # Check trending toward limit
    for ccp in HACCP_PLAN:
        trend = calculate_trend(history, ccp)
        if trend.slope > 0 and trend.projected_violation_days < 30:
            patterns.append(Pattern(type="trending", ccp=ccp,
                detail=f"Projected to exceed limit in {trend.projected_violation_days} days"))
    
    return patterns
```

## Step 5: Deploy Supply Chain Traceability

```python
TRACEABILITY_CHAIN = {
    "lot_tracking": {
        "fields": ["lot_number", "supplier", "farm_origin", "harvest_date",
                    "transport_temp", "receiving_date", "storage_location"],
        "retention_days": 365
    },
    "recall_scope": {
        "forward_trace": "lot → products → distribution → customers",
        "backward_trace": "customer complaint → product → lot → supplier → farm"
    },
    "one_up_one_back": {
        "description": "FDA FSMA 204 requirement: trace immediately preceding and following source",
        "fields": ["source_contact", "destination_contact", "transport_details"]
    }
}

# Recall simulation endpoint
async def simulate_recall(lot_number: str) -> RecallPlan:
    """Trace affected products and generate recall plan."""
    affected = await trace_forward(lot_number)
    return RecallPlan(
        lot=lot_number,
        affected_products=affected.products,
        affected_locations=affected.locations,
        customer_notifications=generate_notifications(affected),
        estimated_scope=affected.total_units,
        regulatory_filing=generate_fda_report(affected)
    )
```

## Step 6: Smoke Test

```bash
# Submit HACCP reading
curl -s https://api-food-safety.azurewebsites.net/api/haccp/reading \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"facility_id": "fac-001", "ccp": "cold_storage", "temperature_f": 42.5}' | jq '.'

# Get violation patterns
curl -s https://api-food-safety.azurewebsites.net/api/patterns \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"facility_id": "fac-001", "months": 6}' | jq '.patterns'

# Simulate recall
curl -s https://api-food-safety.azurewebsites.net/api/recall/simulate \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lot_number": "LOT-2026-04-001"}' | jq '.affected_products[:3]'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| IoT sensor gaps | Battery/connectivity | Set up heartbeat alerts, redundant sensors |
| False violation alerts | Door-open spike | Add door-open debounce (ignore <2 min spikes) |
| Pattern detection noisy | Too few data points | Require ≥3 months history for pattern analysis |
| Recall trace incomplete | Missing lot linking | Enforce one-up-one-back at receiving |
| Temperature trending wrong | Sensor calibration drift | Monthly sensor calibration check |
