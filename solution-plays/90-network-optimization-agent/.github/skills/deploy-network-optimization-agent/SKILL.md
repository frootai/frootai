---
name: "deploy-network-optimization-agent"
description: "Deploy Network Optimization Agent — traffic forecasting, dynamic routing, capacity planning, predictive maintenance, 5G resource allocation."
---

# Deploy Network Optimization Agent

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Network topology data (nodes, links, capacities)
- SNMP/telemetry feed from network equipment
- Python 3.11+ with `azure-openai`, `networkx`, `scikit-learn`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-network-optimization \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure IoT Hub | Network equipment telemetry (SNMP traps, metrics) | S1 |
| Azure Data Explorer | Network time-series (traffic, latency, errors) | Dev(No SLA) |
| Azure OpenAI | Anomaly analysis + network reports | S0 |
| Azure ML | Traffic forecasting + failure prediction | Compute on-demand |
| Event Hubs | Real-time traffic flow streaming | Standard |
| Cosmos DB | Topology, SLA configs, maintenance history | Serverless |
| Azure Functions | Alert engine + routing recalculation triggers | Consumption |
| Container Apps | Network dashboard API | Consumption |

## Step 2: Ingest Network Topology

```python
import networkx as nx

# Network topology model
TOPOLOGY = {
    "nodes": [
        {"id": "core-1", "type": "core_router", "capacity_gbps": 400, "location": "dc-east"},
        {"id": "core-2", "type": "core_router", "capacity_gbps": 400, "location": "dc-west"},
        {"id": "agg-1", "type": "aggregation", "capacity_gbps": 100, "location": "pop-north"},
        {"id": "agg-2", "type": "aggregation", "capacity_gbps": 100, "location": "pop-south"},
        {"id": "cell-1", "type": "5g_gnb", "capacity_gbps": 10, "location": "site-001"},
    ],
    "links": [
        {"from": "core-1", "to": "core-2", "capacity_gbps": 100, "latency_ms": 2},
        {"from": "core-1", "to": "agg-1", "capacity_gbps": 40, "latency_ms": 5},
        {"from": "core-2", "to": "agg-2", "capacity_gbps": 40, "latency_ms": 5},
        {"from": "agg-1", "to": "cell-1", "capacity_gbps": 10, "latency_ms": 3},
    ]
}

# Build NetworkX graph for path analysis
G = nx.DiGraph()
for node in TOPOLOGY["nodes"]:
    G.add_node(node["id"], **node)
for link in TOPOLOGY["links"]:
    G.add_edge(link["from"], link["to"], **link)

# Validate redundancy (every node has ≥2 paths)
for node in G.nodes:
    paths = list(nx.all_simple_paths(G, "core-1", node, cutoff=5))
    if len(paths) < 2:
        print(f"WARNING: {node} has only {len(paths)} path(s) — single point of failure")
```

## Step 3: Deploy Traffic Forecasting

```python
# Traffic prediction per link (LSTM for temporal patterns)
TRAFFIC_FEATURES = [
    "hour_of_day", "day_of_week", "is_weekend",
    "traffic_lag_1h", "traffic_lag_24h", "traffic_lag_168h",
    "traffic_rolling_1h_avg", "traffic_rolling_24h_avg",
    "active_subscribers", "event_nearby",
    "link_utilization_pct"
]

async def forecast_traffic(region: str, horizon_hours: int = 4) -> dict[str, list[float]]:
    """Forecast traffic per link for the next N hours."""
    forecasts = {}
    for link in get_links(region):
        history = await get_traffic_history(link.id, lookback_hours=168)
        features = build_features(history, TRAFFIC_FEATURES)
        prediction = traffic_model.predict(features, horizon=horizon_hours)
        forecasts[link.id] = prediction  # Gbps per hour
    return forecasts
```

## Step 4: Deploy Dynamic Routing Optimizer

```python
async def optimize_routing(topology: nx.DiGraph, traffic_forecast: dict) -> RoutingPlan:
    """Optimize traffic routing to balance load and meet SLAs."""
    plan = {}
    
    for traffic_flow in get_traffic_demands():
        # Find K shortest paths
        paths = list(nx.shortest_simple_paths(topology, traffic_flow.src, traffic_flow.dst, weight="latency_ms"))[:3]
        
        # Score each path
        scored = []
        for path in paths:
            utilization = max(get_link_utilization(topology, path, traffic_forecast))
            latency = sum(topology[u][v]["latency_ms"] for u, v in zip(path, path[1:]))
            redundancy = count_alternate_paths(topology, path)
            
            score = (
                0.40 * (1 - utilization / 100) +  # Prefer lower utilization
                0.35 * (1 - latency / 50) +         # Prefer lower latency
                0.25 * (redundancy / 3)              # Prefer paths with alternatives
            )
            scored.append({"path": path, "score": score, "utilization": utilization, "latency": latency})
        
        best = max(scored, key=lambda x: x["score"])
        plan[traffic_flow.id] = best
    
    return RoutingPlan(routes=plan, max_utilization=max(get_all_utilizations(plan)))
```

## Step 5: Deploy Predictive Maintenance

```python
EQUIPMENT_HEALTH_METRICS = {
    "temperature_c": {"warning": 65, "critical": 80, "failure_correlation": 0.85},
    "error_rate_pct": {"warning": 0.1, "critical": 1.0, "failure_correlation": 0.90},
    "cpu_utilization_pct": {"warning": 80, "critical": 95, "failure_correlation": 0.70},
    "memory_utilization_pct": {"warning": 85, "critical": 95, "failure_correlation": 0.65},
    "uptime_days": {"warning": 365, "critical": 730, "failure_correlation": 0.45},
    "power_supply_voltage": {"warning_deviation_pct": 5, "critical_deviation_pct": 10}
}

async def predict_equipment_failure(region: str) -> list[EquipmentAlert]:
    """Predict equipment failures before they happen."""
    equipment = await get_equipment_metrics(region)
    alerts = []
    
    for device in equipment:
        features = extract_health_features(device)
        failure_prob = failure_model.predict_proba(features)[0][1]
        
        if failure_prob > 0.7:
            alerts.append(EquipmentAlert(
                device_id=device.id,
                failure_probability=failure_prob,
                estimated_days_to_failure=estimate_rul(device),
                top_indicators=get_top_indicators(device, features),
                recommended_action=suggest_maintenance(device, failure_prob)
            ))
    
    return sorted(alerts, key=lambda a: a.failure_probability, reverse=True)
```

## Step 6: Deploy 5G Resource Allocation

```python
# 5G network slicing — allocate resources per slice type
NETWORK_SLICES = {
    "embb": {  # Enhanced Mobile Broadband
        "priority": 2,
        "min_bandwidth_mbps": 100,
        "max_latency_ms": 20,
        "use_case": "Video streaming, web browsing"
    },
    "urllc": {  # Ultra-Reliable Low-Latency
        "priority": 1,
        "min_bandwidth_mbps": 10,
        "max_latency_ms": 1,
        "use_case": "Autonomous vehicles, remote surgery"
    },
    "mmtc": {  # Massive Machine-Type Communications
        "priority": 3,
        "min_bandwidth_mbps": 1,
        "max_latency_ms": 100,
        "use_case": "IoT sensors, smart meters"
    }
}
```

## Step 7: Smoke Test

```bash
# Get traffic forecast
curl -s https://api-network.azurewebsites.net/api/forecast \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"region": "east", "horizon_hours": 4}' | jq '.forecasts | keys[:3]'

# Get routing optimization
curl -s https://api-network.azurewebsites.net/api/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"region": "east"}' | jq '.max_utilization, .routes | length'

# Check equipment health
curl -s https://api-network.azurewebsites.net/api/equipment/health \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"region": "east"}' | jq '.at_risk[:3]'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Traffic forecast wrong during events | No event feature | Add local events + subscriber count features |
| Routing oscillation | Re-optimizing too frequently | Add dampening, re-optimize only when delta > 10% |
| False maintenance alerts | Thresholds too tight | Widen warning thresholds, require sustained anomaly |
| 5G slice SLA violation | Overcommitted resources | Enforce admission control, reserve per-slice minimum |
| Single path identified | Topology missing redundant links | Update topology, verify physical connectivity |
