---
name: "deploy-property-valuation-ai"
description: "Deploy Property Valuation AI — automated valuation model (AVM), comparable sales analysis, market trend prediction, adjustment engine, regulatory-compliant reports."
---

# Deploy Property Valuation AI

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- MLS/property sales data feed (historical comparable sales)
- Python 3.11+ with `azure-openai`, `scikit-learn`, `geopandas`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-property-valuation \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Valuation narrative generation (gpt-4o) | S0 |
| Azure AI Search | Comparable sales search with geospatial filters | Standard S1 |
| Azure Maps | Property geolocation, distance calculations, neighborhood data | S1 |
| Azure ML | Valuation regression model training | Compute on-demand |
| Cosmos DB | Property records, valuation history, market indices | Serverless |
| Azure Storage | Property photos, MLS data feeds, report PDFs | Standard LRS |
| Container Apps | Valuation API | Consumption |
| Azure Key Vault | API keys + MLS credentials | Standard |

## Step 2: Ingest Property Sales Data

```python
# MLS data schema
PROPERTY_SCHEMA = {
    "address": str,
    "lat": float, "lon": float,
    "property_type": str,  # "single_family", "condo", "townhouse", "multi_family"
    "sqft_living": int,
    "sqft_lot": int,
    "bedrooms": int,
    "bathrooms": float,
    "year_built": int,
    "condition": str,  # "excellent", "good", "average", "fair", "poor"
    "features": list,  # ["pool", "garage_2car", "fireplace", "basement_finished"]
    "sale_price": float,
    "sale_date": str,
    "days_on_market": int,
    "listing_price": float
}

# Index into AI Search with geospatial support
await index_properties(
    properties=mls_data,
    index_name="comparable-sales",
    geo_field="location",  # Enables radius-based comp search
    facets=["property_type", "bedrooms", "condition"]
)
```

## Step 3: Deploy Comparable Sales Engine

```python
async def find_comparables(subject: PropertyData, config: CompConfig) -> list[Comparable]:
    """Find comparable sales using AI Search with geospatial filtering."""
    # Search criteria (adjustable per market)
    filters = {
        "radius_km": config.search_radius_km,  # Default: 2km
        "property_type": subject.property_type,
        "sqft_range": (subject.sqft * 0.8, subject.sqft * 1.2),
        "sold_within_months": config.recency_months,  # Default: 6
        "bedrooms_range": (subject.bedrooms - 1, subject.bedrooms + 1),
    }
    
    comps = await search_client.search(
        search_text="",
        filter=build_odata_filter(filters),
        order_by=["geo.distance(location, geography'POINT({lon} {lat})') asc"],
        top=config.max_comps  # Default: 10
    )
    
    # Rank by similarity score
    ranked = rank_by_similarity(comps, subject, weights={
        "distance": 0.25, "sqft_diff": 0.20, "age_diff": 0.15,
        "condition_match": 0.15, "recency": 0.15, "feature_match": 0.10
    })
    return ranked[:config.final_count]  # Return top 5
```

## Step 4: Deploy Adjustment Engine

```python
# Per-unit adjustment factors (market-specific, derived from paired sales analysis)
ADJUSTMENT_FACTORS = {
    "sqft_living": {"per_sqft": 150, "cap_pct": 15},  # $150/sqft, max 15% adjustment
    "bedrooms": {"per_unit": 15000},
    "bathrooms": {"per_unit": 10000},
    "garage": {"per_car": 12000},
    "pool": {"value": 20000},
    "fireplace": {"value": 5000},
    "basement_finished": {"per_sqft": 75},
    "condition": {
        "excellent_to_good": -10000,
        "good_to_average": -8000,
        "average_to_fair": -12000,
        "fair_to_poor": -15000
    },
    "age": {"per_year": -500, "cap_years": 20},
    "lot_size": {"per_sqft": 5, "cap_pct": 10}
}

def adjust_comp(comp: Comparable, subject: PropertyData) -> AdjustedComp:
    """Adjust comparable sale price to reflect subject property differences."""
    adjustments = {}
    adjusted_price = comp.sale_price
    
    # Sqft adjustment
    sqft_diff = subject.sqft - comp.sqft
    sqft_adj = sqft_diff * ADJUSTMENT_FACTORS["sqft_living"]["per_sqft"]
    sqft_adj = cap_adjustment(sqft_adj, comp.sale_price, 15)
    adjustments["sqft"] = sqft_adj
    adjusted_price += sqft_adj
    
    # Feature adjustments (subject has but comp doesn't → add value, vice versa)
    for feature in ["pool", "fireplace", "garage"]:
        if feature in subject.features and feature not in comp.features:
            adjustments[feature] = ADJUSTMENT_FACTORS[feature].get("value", 0)
            adjusted_price += adjustments[feature]
    
    return AdjustedComp(comp=comp, adjustments=adjustments, adjusted_price=adjusted_price)
```

## Step 5: Deploy ML Valuation Model

```bash
python models/train_avm.py \
  --data-source cosmosdb://property-sales \
  --features sqft,bedrooms,bathrooms,year_built,condition,lot_size,lat,lon,market_index \
  --target sale_price \
  --model-type gradient_boosting \
  --output models/avm_v1.pkl
```

Model features:
| Feature Group | Variables | Importance |
|--------------|-----------|-----------|
| Size | sqft_living, sqft_lot, bedrooms, bathrooms | 35% |
| Location | lat, lon, neighborhood_score, school_rating | 25% |
| Condition | year_built, condition_score, renovation_year | 15% |
| Market | median_price_index, days_on_market_avg, inventory | 15% |
| Features | pool, garage, basement, fireplace | 10% |

## Step 6: Deploy Report Generator

```python
async def generate_valuation_report(subject: PropertyData, valuation: Valuation) -> Report:
    """Generate regulatory-compliant valuation report narrative."""
    prompt = f"""Generate a property valuation narrative for:
Address: {subject.address}
Estimated Value: ${valuation.estimate:,.0f}
Confidence Range: ${valuation.low:,.0f} - ${valuation.high:,.0f}
Top factors: {valuation.top_factors}
Comparable sales used: {len(valuation.comps)}

Rules:
1. Explain WHY this value — reference specific comps and adjustments
2. Include market trend context (appreciating/stable/declining)
3. Note any risk factors (deferred maintenance, flood zone, etc.)
4. Use professional appraisal language
5. Never fabricate comps or adjustment amounts — use only provided data"""
    
    return await generate_report(prompt, valuation, format="pdf")
```

## Step 7: Smoke Test

```bash
# Value a property
curl -s https://api-valuation.azurewebsites.net/api/value \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"address": "123 Main St", "sqft": 2000, "bedrooms": 3, "bathrooms": 2, "year_built": 1990}' | jq '.estimate, .confidence_range'

# Get comparable sales
curl -s https://api-valuation.azurewebsites.net/api/comps \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lat": 40.7128, "lon": -74.0060, "sqft": 2000, "bedrooms": 3}' | jq '.comps[:3]'

# Generate report
curl -s https://api-valuation.azurewebsites.net/api/report \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"property_id": "..."}' | jq '.report_url'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| No comps found | Radius too small or sqft range too tight | Expand radius to 5km, widen sqft to ±30% |
| Valuation ±20% vs actual | Adjustment factors not calibrated | Re-derive factors from paired sales analysis |
| Old comps dominating | Recency not weighted enough | Reduce `sold_within_months` to 3, boost recency weight |
| Bias by neighborhood | Demographic correlation in features | Remove demographic proxies, test disparate impact |
| Report narrative generic | Missing comp details in prompt | Include specific comp addresses and adjustments |
