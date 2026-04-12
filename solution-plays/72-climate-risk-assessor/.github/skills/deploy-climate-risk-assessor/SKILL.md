---
name: "deploy-climate-risk-assessor"
description: "Deploy Climate Risk Assessor — physical risk scoring, transition risk analysis, NGFS scenario modeling, TCFD-aligned reporting."
---

# Deploy Climate Risk Assessor

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- NGFS Scenario Explorer access (climate scenario data)
- Python 3.11+ with `geopandas`, `rasterio`, `azure-ai-ml`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-climate-risk \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Narrative generation + scenario explanation | S0 |
| Azure AI Search | Risk factor knowledge base retrieval | Standard S1 |
| Cosmos DB | Company profiles + risk assessments | Serverless |
| Azure Maps | Geospatial analysis for physical risk | S1 |
| Azure Storage | Climate data files (GeoTIFF, NetCDF) | Standard LRS |
| Container Apps | Risk assessment API | Consumption |
| Azure Key Vault | API keys + data source credentials | Standard |
| App Insights | Telemetry + assessment tracking | Pay-as-you-go |

## Step 2: Ingest Climate Data Sources

```python
# Physical risk data layers
CLIMATE_DATA_SOURCES = {
    "flood": {
        "source": "Aqueduct Floods (WRI)",
        "format": "GeoTIFF",
        "resolution": "30 arc-seconds (~1km)",
        "scenarios": ["baseline", "rcp4.5_2030", "rcp8.5_2050"]
    },
    "heat_stress": {
        "source": "NASA NEX-GDDP-CMIP6",
        "format": "NetCDF",
        "metric": "days_above_35C",
        "scenarios": ["ssp126", "ssp245", "ssp585"]
    },
    "sea_level": {
        "source": "IPCC AR6 Sea Level Projections",
        "format": "CSV per tide gauge",
        "scenarios": ["low", "intermediate", "high"]
    },
    "wildfire": {
        "source": "Global Wildfire Danger Index",
        "format": "GeoTIFF",
        "resolution": "0.25 degree"
    },
    "storm": {
        "source": "IBTrACS (NOAA)",
        "format": "CSV/NetCDF",
        "metric": "historical_frequency_cat3plus"
    }
}
```

Upload climate data to Azure Storage:
```bash
az storage blob upload-batch \
  --account-name stclimatedata \
  --destination climate-layers \
  --source data/climate/ \
  --pattern "*.tif"
```

## Step 3: Deploy Physical Risk Engine

```python
async def assess_physical_risk(locations: list[Location], scenario: str) -> list[PhysicalRisk]:
    """Assess physical climate risks for each asset location."""
    risks = []
    for loc in locations:
        # Query geospatial layers at lat/long
        flood_score = await query_flood_risk(loc.lat, loc.lon, scenario)
        heat_score = await query_heat_stress(loc.lat, loc.lon, scenario)
        sea_level_score = await query_sea_level_rise(loc.lat, loc.lon, scenario)
        wildfire_score = await query_wildfire_risk(loc.lat, loc.lon, scenario)
        storm_score = await query_storm_frequency(loc.lat, loc.lon)

        # Composite physical risk score (weighted by exposure)
        composite = weighted_average({
            "flood": (flood_score, loc.flood_exposure_usd),
            "heat": (heat_score, loc.operations_value_usd),
            "sea_level": (sea_level_score, loc.coastal_asset_usd),
            "wildfire": (wildfire_score, loc.asset_value_usd),
            "storm": (storm_score, loc.asset_value_usd)
        })
        risks.append(PhysicalRisk(location=loc, scores=scores, composite=composite))
    return risks
```

## Step 4: Deploy Transition Risk Engine

```python
TRANSITION_RISK_FACTORS = {
    "carbon_pricing": {
        "description": "Impact of carbon taxes / ETS on operating costs",
        "data_source": "NGFS scenarios",
        "metric": "carbon_price_usd_per_ton",
        "scenarios": {
            "orderly": {"2030": 75, "2050": 250},
            "disorderly": {"2030": 25, "2050": 500},
            "hot_house": {"2030": 10, "2050": 10}
        }
    },
    "stranded_assets": {
        "description": "Fossil fuel assets that become uneconomic",
        "sectors": ["oil_gas", "coal", "utilities"],
        "metric": "pct_assets_at_risk"
    },
    "market_shift": {
        "description": "Consumer/investor preferences shifting to low-carbon",
        "metric": "revenue_at_risk_pct"
    },
    "technology_disruption": {
        "description": "Clean tech making current products obsolete",
        "metric": "capex_required_for_transition"
    },
    "reputation": {
        "description": "Brand damage from perceived climate inaction",
        "metric": "stakeholder_sentiment_score"
    }
}
```

## Step 5: Deploy TCFD Report Generator

```bash
# TCFD reporting pillars
# 1. Governance — Board oversight of climate risks
# 2. Strategy — Impact on business, strategy, financial planning
# 3. Risk Management — Processes for identifying, assessing, managing
# 4. Metrics & Targets — Metrics used to assess climate risks/opportunities

python deploy/setup_report_templates.py \
  --template-dir templates/tcfd/ \
  --output-format html,pdf \
  --framework tcfd
```

## Step 6: Configure NGFS Scenario Integration

```json
// config/agents.json — scenario settings
{
  "scenarios": {
    "active": ["orderly", "disorderly", "hot_house"],
    "default": "disorderly",
    "time_horizons": ["short_1_3y", "medium_3_10y", "long_10_30y"],
    "default_horizon": "medium_3_10y",
    "ngfs_version": "v4",
    "include_opportunities": true
  }
}
```

## Step 7: Smoke Test

```bash
# Test with sample company profile
curl -s https://api-climate-risk.azurewebsites.net/api/assess \
  -H "Authorization: Bearer $TOKEN" \
  -d @evaluation/data/sample_company.json | jq '.summary'

# Verify physical risk scoring
curl -s https://api-climate-risk.azurewebsites.net/api/physical-risk \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lat": 51.5074, "lon": -0.1278, "scenario": "rcp8.5_2050"}' | jq '.'

# Generate TCFD report
curl -s https://api-climate-risk.azurewebsites.net/api/report/tcfd \
  -H "Authorization: Bearer $TOKEN" \
  -d @evaluation/data/sample_company.json | jq '.report_url'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Physical risk scores all zero | Climate data layers not uploaded | Run Step 2 data ingestion |
| NGFS data stale | Using old scenarios version | Update `ngfs_version` in config |
| Geospatial query timeout | Large raster at high resolution | Add spatial index, downsample |
| TCFD report missing sections | Company profile incomplete | Ensure all 4 TCFD pillars have data |
| Transition risk N/A for sector | Sector not in mapping | Add sector to TRANSITION_RISK_FACTORS |
