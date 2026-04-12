---
name: "deploy-carbon-footprint-tracker"
description: "Deploy Carbon Footprint Tracker — Scope 1/2/3 calculation engine, emission factor database, spend-based Scope 3 estimation, GHG Protocol/CDP/TCFD reporting, reduction recommendations, data lineage."
---

# Deploy Carbon Footprint Tracker

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for Scope 3 classification)
  - `Microsoft.DocumentDB` (Cosmos DB for emission data + audit trail)
  - `Microsoft.App` (Container Apps for tracker API)
  - `Microsoft.Web` (Static Web Apps for reporting dashboard)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `openai`, `pandas`, `azure-cosmos` packages
- `.env` file with: `AZURE_OPENAI_KEY`, `COSMOS_CONNECTION`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-carbon-tracker --location eastus2

az deployment group create \
  --resource-group rg-frootai-carbon-tracker \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json

az keyvault secret set --vault-name kv-carbon-tracker \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-carbon-tracker \
  --name cosmos-conn --value "$COSMOS_CONNECTION"
```

## Step 2: Deploy Emission Factor Database

```python
# emission_factors.py — GHG Protocol emission factors
class EmissionFactorDB:
    SCOPE1_FACTORS = {
        "diesel": 2.68,        # kg CO2e per liter
        "natural_gas": 2.04,   # kg CO2e per m³
        "gasoline": 2.31,      # kg CO2e per liter
        "lpg": 1.51,           # kg CO2e per liter
        "jet_fuel": 2.52,      # kg CO2e per liter
    }

    SCOPE2_GRID_FACTORS = {
        "us_average": 0.417,   # kg CO2e per kWh
        "eu_average": 0.276,
        "uk": 0.233,
        "germany": 0.338,
        "france": 0.052,       # Low due to nuclear
        "india": 0.722,
        "china": 0.555,
        "australia": 0.656,
    }

    SCOPE3_SPEND_FACTORS = {
        # kg CO2e per $ spent (EEIO model)
        "cloud_computing": 0.12,
        "office_supplies": 0.45,
        "business_travel_air": 1.20,
        "business_travel_rail": 0.04,
        "professional_services": 0.15,
        "food_catering": 0.85,
        "electronics": 0.65,
        "construction": 1.50,
    }
```

## Step 3: Deploy Scope 1/2 Calculator

```python
# scope12_calculator.py — deterministic emission calculation
class ScopeCalculator:
    def calculate_scope1(self, fuel_records: list, factors: dict) -> dict:
        """Scope 1: Direct emissions from owned/controlled sources."""
        total = 0
        breakdown = {}
        for record in fuel_records:
            fuel_type = record["fuel_type"]
            quantity = record["quantity"]  # liters or m³
            factor = factors.get(fuel_type, 0)
            emissions = quantity * factor
            breakdown[fuel_type] = breakdown.get(fuel_type, 0) + emissions
            total += emissions

        return {
            "scope": 1,
            "total_kg_co2e": round(total, 2),
            "total_tonnes": round(total / 1000, 2),
            "breakdown": breakdown,
            "data_quality": "measured",
        }

    def calculate_scope2(self, energy_data: list, grid_factors: dict, method: str = "location") -> dict:
        """Scope 2: Indirect emissions from purchased energy."""
        total = 0
        breakdown = {}
        for record in energy_data:
            kwh = record["kwh"]
            region = record["region"]
            if method == "location":
                factor = grid_factors.get(region, grid_factors["us_average"])
            else:  # market-based
                factor = record.get("supplier_factor", grid_factors.get(region))
            emissions = kwh * factor
            breakdown[region] = breakdown.get(region, 0) + emissions
            total += emissions

        return {
            "scope": 2,
            "method": method,
            "total_kg_co2e": round(total, 2),
            "total_tonnes": round(total / 1000, 2),
            "breakdown": breakdown,
        }
```

## Step 4: Deploy Scope 3 AI-Assisted Estimator

```python
# scope3_estimator.py — LLM classifies spend → emission factors
class Scope3Estimator:
    async def estimate(self, spend_data: list, travel_data: list) -> dict:
        total = 0
        categories = {}

        # Travel: actual distance-based
        for trip in travel_data:
            if trip["mode"] == "flight":
                emissions = trip["distance_km"] * 0.255  # kg CO2e per passenger-km
            elif trip["mode"] == "rail":
                emissions = trip["distance_km"] * 0.041
            elif trip["mode"] == "car":
                emissions = trip["distance_km"] * 0.171
            else:
                emissions = 0
            categories[f"travel_{trip['mode']}"] = categories.get(f"travel_{trip['mode']}", 0) + emissions
            total += emissions

        # Spend-based: LLM classifies unclear categories
        for item in spend_data:
            if item["category"] in self.SPEND_FACTORS:
                factor = self.SPEND_FACTORS[item["category"]]
            else:
                # LLM classifies unclear spend items
                classification = await self.classify_spend(item)
                factor = self.SPEND_FACTORS.get(classification, 0.30)  # Default: average services

            emissions = item["amount_usd"] * factor
            categories[item["category"]] = categories.get(item["category"], 0) + emissions
            total += emissions

        return {
            "scope": 3,
            "total_kg_co2e": round(total, 2),
            "total_tonnes": round(total / 1000, 2),
            "categories": categories,
            "llm_classified_count": len([s for s in spend_data if s["category"] not in self.SPEND_FACTORS]),
            "data_quality": "estimated",
        }

    async def classify_spend(self, item: dict) -> str:
        response = await self.openai.chat.completions.create(
            model="gpt-4o-mini", temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": f"Classify this procurement spend into one of: {list(self.SPEND_FACTORS.keys())}. Return: {{category: string}}"},
                {"role": "user", "content": f"Vendor: {item.get('vendor', 'unknown')}, Description: {item['description']}, Amount: ${item['amount_usd']}"},
            ],
        )
        return json.loads(response.choices[0].message.content)["category"]
```

## Step 5: Deploy Reporting Engine

```python
# reporter.py — GHG Protocol, CDP, TCFD compliant reports
class EmissionReporter:
    FRAMEWORKS = {
        "ghg_protocol": {
            "sections": ["scope1", "scope2_location", "scope2_market", "scope3_categories", "total", "intensity", "targets"],
            "format": "ghg_inventory"
        },
        "cdp": {
            "sections": ["governance", "risks_opportunities", "strategy", "metrics", "verification"],
            "format": "cdp_questionnaire"
        },
        "tcfd": {
            "sections": ["governance", "strategy", "risk_management", "metrics_targets"],
            "format": "tcfd_disclosure"
        },
    }

    async def generate_report(self, emissions: dict, framework: str) -> dict:
        config = self.FRAMEWORKS[framework]
        report = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0.3,
            messages=[
                {"role": "system", "content": f"Generate a {framework} compliant emission report. Sections: {config['sections']}. Use actual data provided, never estimate beyond what's given."},
                {"role": "user", "content": json.dumps(emissions)},
            ],
        )
        return {"framework": framework, "content": report.choices[0].message.content, "data_sources": emissions}
```

## Step 6: Deploy Reduction Recommender

```python
# reduction.py — AI-powered emission reduction recommendations
class ReductionRecommender:
    async def recommend(self, emissions: dict) -> list:
        # Find top emission sources
        all_sources = {}
        for scope_data in [emissions.get("scope1", {}), emissions.get("scope2", {}), emissions.get("scope3", {})]:
            if "breakdown" in scope_data:
                all_sources.update(scope_data["breakdown"])
            if "categories" in scope_data:
                all_sources.update(scope_data["categories"])

        top_sources = sorted(all_sources.items(), key=lambda x: x[1], reverse=True)[:10]

        response = await self.openai.chat.completions.create(
            model="gpt-4o", temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "Recommend emission reduction actions. Return: {recommendations: [{source, action, estimated_reduction_pct, timeframe, cost_level, difficulty}]}"},
                {"role": "user", "content": f"Top emission sources:\n{json.dumps(top_sources)}"},
            ],
        )
        return json.loads(response.choices[0].message.content)["recommendations"]
```

## Step 7: Deploy and Verify

```bash
az acr build --registry acrCarbon --image carbon-tracker:latest .

az containerapp create \
  --name carbon-tracker \
  --resource-group rg-frootai-carbon-tracker \
  --environment carbon-env \
  --image acrCarbon.azurecr.io/carbon-tracker:latest \
  --target-port 8080 --min-replicas 1 --max-replicas 2

# Calculate emissions
curl -X POST https://carbon-tracker.azurecontainerapps.io/api/calculate \
  -d '{"fuel_records": [...], "energy_data": [...], "spend_data": [...]}'

# Generate GHG Protocol report
curl https://carbon-tracker.azurecontainerapps.io/api/report?framework=ghg_protocol

# Get reduction recommendations
curl https://carbon-tracker.azurecontainerapps.io/api/recommendations
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Scope 1 calculated | Submit fuel records | kg CO2e with breakdown |
| Scope 2 calculated | Submit energy data | Location + market-based |
| Scope 3 estimated | Submit spend data | LLM-classified categories |
| GHG Protocol report | GET report | Compliant sections |
| CDP report | GET report?framework=cdp | CDP questionnaire format |
| Reduction recs | GET recommendations | Top 10 actions with ROI |
| Data lineage | Check audit trail | Every calculation logged |
| Emission factors | Check factor DB | Latest GHG Protocol factors |

## Rollback Procedure

```bash
az containerapp revision list --name carbon-tracker \
  --resource-group rg-frootai-carbon-tracker
az containerapp ingress traffic set --name carbon-tracker \
  --resource-group rg-frootai-carbon-tracker \
  --revision-weight previousRevision=100
```
