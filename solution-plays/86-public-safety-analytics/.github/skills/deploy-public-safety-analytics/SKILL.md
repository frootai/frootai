---
name: "deploy-public-safety-analytics"
description: "Deploy Public Safety Analytics — incident pattern detection, resource allocation optimization, response time analytics, bias-mitigated community dashboards, emergency routing."
---

# Deploy Public Safety Analytics

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Incident data (CAD/RMS system export, anonymized)
- Python 3.11+ with `azure-openai`, `azure-maps`, `pandas`, `scikit-learn`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-public-safety \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Pattern analysis + recommendation generation | S0 |
| Azure Data Explorer | Incident time-series analytics (KQL) | Dev(No SLA) |
| Azure Maps | Response routing + resource positioning | S1 |
| Cosmos DB | Incident records, resource allocations, analytics | Serverless |
| Azure Storage | Anonymized incident data, reports | Standard LRS |
| Container Apps | Analytics API + community dashboard | Consumption |
| Azure Key Vault | API keys + database credentials | Standard |
| Power BI Embedded | Interactive dashboard for agency leaders | A1 |

## Step 2: Ingest & Anonymize Incident Data

```python
# CRITICAL: Anonymize before analysis
ANONYMIZATION_RULES = {
    "remove_fields": ["suspect_name", "victim_name", "witness_name", "ssn", "dob"],
    "generalize_address": "block_level",  # "123 Main St" → "100 block Main St"
    "round_coordinates": 3,  # ~100m precision (prevent re-identification)
    "remove_narrative_pii": True,  # Scrub names from free-text narratives
    "aggregate_demographics": "census_tract",  # No individual-level demographics
    "retention_days": 365
}

async def ingest_incidents(raw_data: list[dict]) -> list[AnonymizedIncident]:
    """Anonymize and ingest incident data."""
    anonymized = []
    for incident in raw_data:
        clean = anonymize(incident, ANONYMIZATION_RULES)
        # Bias audit flag: mark if enforcement-generated (vs community-reported)
        clean["source"] = classify_source(incident)  # "community_report" or "patrol_generated"
        anonymized.append(clean)
    
    await ingest_to_adx(anonymized, table="incidents")
    return anonymized
```

## Step 3: Deploy Temporal Pattern Analysis (NOT Geographic Targeting)

```python
async def analyze_temporal_patterns(region: str, months: int = 12) -> TemporalAnalysis:
    """Analyze WHEN incidents occur — not WHERE (avoids geographic bias)."""
    # KQL query for temporal patterns
    query = f"""
    incidents
    | where region == '{region}' and timestamp > ago({months}m)
    | summarize count() by bin(timestamp, 1h), incident_type
    | project hour_of_day = hourofday(timestamp), day_of_week = dayofweek(timestamp), 
              incident_type, count_
    """
    results = await adx_client.execute(query)
    
    patterns = {
        "peak_hours": find_peaks(results, "hour_of_day"),  # e.g., 2-4 PM, 10 PM-1 AM
        "peak_days": find_peaks(results, "day_of_week"),    # e.g., Friday, Saturday
        "seasonal": detect_seasonality(results),             # Summer vs winter patterns
        "trends": calculate_trends(results, window_months=3) # Increasing or decreasing
    }
    
    return TemporalAnalysis(
        patterns=patterns,
        resource_recommendation=optimize_scheduling(patterns),
        bias_note="Analysis based on temporal patterns only, not geographic targeting"
    )
```

## Step 4: Deploy Resource Allocation Optimizer

```python
async def optimize_resources(region: str) -> ResourcePlan:
    """Optimize resource allocation based on demand patterns + response time."""
    demand = await get_demand_patterns(region)
    current_resources = await get_current_resources(region)
    
    # Optimization objective: minimize average response time
    # Subject to: budget constraints, shift length limits, minimum coverage
    CONSTRAINTS = {
        "max_shift_hours": 12,
        "min_rest_hours": 10,
        "response_time_target_min": 8,  # 8 min for priority 1
        "minimum_coverage_units": 3,     # At least 3 units always active
        "budget_monthly": current_resources.budget
    }
    
    # Shift scheduling optimization
    optimal_shifts = solve_shift_scheduling(demand, CONSTRAINTS)
    
    # Staging position optimization (where to position waiting units)
    staging = await optimize_staging_positions(
        demand_heatmap=demand,
        road_network=await maps.get_road_network(region),
        target_response_time_min=8
    )
    
    return ResourcePlan(
        shifts=optimal_shifts,
        staging_positions=staging,
        estimated_response_improvement=calculate_improvement(current_resources, optimal_shifts),
        bias_audit=audit_resource_distribution(optimal_shifts, region)
    )
```

## Step 5: Deploy Community Dashboard (Transparency)

```python
# Public-facing dashboard requirements
TRANSPARENCY_FEATURES = {
    "public_data": [
        "Response time trends (aggregated, not per-incident)",
        "Resource allocation by shift (no officer-level detail)",
        "Incident volume trends (anonymized, no locations below block level)",
        "Community feedback integration (311 data, surveys)"
    ],
    "methodology_disclosure": [
        "How pattern analysis works (temporal, not geographic targeting)",
        "What data is used (anonymized, no individual-level)",
        "What the AI does NOT do (no suspect targeting, no predictive policing)",
        "How bias is audited and mitigated"
    ],
    "community_input": [
        "Community priority surveys",
        "311 service request integration",
        "Public comment on resource allocation plans",
        "Annual community review board presentation"
    ]
}
```

## Step 6: Deploy Emergency Response Routing

```bash
# Optimize emergency response routing via Azure Maps
# - Real-time traffic integration
# - Multi-unit dispatch (nearest available)
# - Hospital proximity for medical emergencies
# - Dynamic rerouting on traffic changes

az maps account create \
  --name maps-public-safety \
  --resource-group rg-frootai-public-safety \
  --sku S1
```

## Step 7: Smoke Test

```bash
# Get temporal patterns
curl -s https://api-safety-analytics.azurewebsites.net/api/patterns \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"region": "district-5", "months": 6}' | jq '.peak_hours, .trends'

# Get resource optimization
curl -s https://api-safety-analytics.azurewebsites.net/api/resources/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"region": "district-5"}' | jq '.estimated_response_improvement'

# Check bias audit
curl -s https://api-safety-analytics.azurewebsites.net/api/bias-audit \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"region": "district-5"}' | jq '.audit_result'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Bias audit fails | Historical data reflects over-policing | Weight community-reported incidents higher, flag patrol-generated |
| Response time worse | Staging positions suboptimal | Update road network data, recalculate with real-time traffic |
| Pattern analysis too noisy | Insufficient data | Expand time window, aggregate across similar regions |
| Community dashboard empty | Data pipeline lag | Check ADX ingestion, verify anonymization doesn't drop all records |
| Resource plan infeasible | Constraints too tight | Relax minimum coverage or budget constraint |
