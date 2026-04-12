---
name: "deploy-precision-agriculture-agent"
description: "Deploy Precision Agriculture Agent — NDVI crop monitoring, pest/disease detection, irrigation optimization, yield prediction, variable-rate prescriptions."
---

# Deploy Precision Agriculture Agent

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Sentinel-2 or drone imagery access (Copernicus Open Access Hub)
- Python 3.11+ with `rasterio`, `geopandas`, `azure-ai-ml`, `scikit-learn`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-agriculture \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure Custom Vision | Crop stress/pest/disease classification | S0 |
| Azure IoT Hub | Soil sensor data (moisture, pH, nutrients) | S1 |
| Azure Maps | Field boundaries, weather data, elevation | S1 |
| Azure OpenAI | Agronomic recommendation generation | S0 |
| Azure Data Explorer | Time-series NDVI + sensor data analytics | Dev(No SLA) |
| Azure Storage | Satellite imagery (GeoTIFF), sensor data | Standard LRS |
| Azure ML | Yield prediction + stress classification models | Compute on-demand |
| Container Apps | Agriculture API + dashboard | Consumption |

## Step 2: Configure Satellite Imagery Pipeline

```python
# Sentinel-2 bands for precision agriculture
SPECTRAL_BANDS = {
    "B02": {"name": "Blue", "wavelength_nm": 490, "resolution_m": 10},
    "B03": {"name": "Green", "wavelength_nm": 560, "resolution_m": 10},
    "B04": {"name": "Red", "wavelength_nm": 665, "resolution_m": 10},
    "B08": {"name": "NIR", "wavelength_nm": 842, "resolution_m": 10},
    "B11": {"name": "SWIR", "wavelength_nm": 1610, "resolution_m": 20},
}

# Vegetation indices
def calculate_ndvi(nir: np.ndarray, red: np.ndarray) -> np.ndarray:
    """Normalized Difference Vegetation Index. Range: -1 to 1. Healthy > 0.6."""
    return (nir - red) / (nir + red + 1e-10)

def calculate_ndwi(nir: np.ndarray, swir: np.ndarray) -> np.ndarray:
    """Normalized Difference Water Index. Detects water stress."""
    return (nir - swir) / (nir + swir + 1e-10)

def calculate_evi(nir, red, blue) -> np.ndarray:
    """Enhanced Vegetation Index. Better than NDVI in dense canopy."""
    return 2.5 * (nir - red) / (nir + 6*red - 7.5*blue + 1)

# NDVI interpretation
NDVI_CLASSES = {
    "bare_soil": {"range": (-0.1, 0.1), "color": "#8B4513"},
    "sparse_vegetation": {"range": (0.1, 0.3), "color": "#FFD700"},
    "moderate_health": {"range": (0.3, 0.5), "color": "#90EE90"},
    "healthy": {"range": (0.5, 0.7), "color": "#228B22"},
    "very_healthy": {"range": (0.7, 1.0), "color": "#006400"}
}
```

## Step 3: Deploy Stress Detection & Classification

```python
STRESS_CAUSES = {
    "drought": {
        "spectral_signature": "Low NDWI, decreasing NDVI over 2+ weeks",
        "visual_pattern": "Browning from field edges inward",
        "correlation": "Low soil moisture + high temperature"
    },
    "nutrient_deficiency": {
        "nitrogen": "Yellowing of older leaves, low chlorophyll index",
        "phosphorus": "Purple/red discoloration, stunted growth",
        "potassium": "Brown leaf margins, patchy NDVI"
    },
    "pest_infestation": {
        "spectral_signature": "Scattered low-NDVI patches, irregular pattern",
        "visual_pattern": "Random clusters, not aligned with field features",
        "examples": ["aphids", "armyworm", "corn_borer"]
    },
    "disease": {
        "spectral_signature": "Progressive NDVI decline in circular patterns",
        "visual_pattern": "Expanding from infection point outward",
        "examples": ["rust", "blight", "powdery_mildew"]
    },
    "waterlogging": {
        "spectral_signature": "High NDWI in low elevation areas",
        "visual_pattern": "Stress in field depressions",
        "correlation": "Recent heavy rainfall + poor drainage"
    }
}

# Train Custom Vision model for pest/disease from close-up imagery
az cognitiveservices account create \
  --name cv-crop-health \
  --resource-group rg-frootai-agriculture \
  --kind CustomVision.Training --sku S0
```

## Step 4: Deploy Irrigation Optimizer

```python
async def optimize_irrigation(field_id: str) -> IrrigationPlan:
    """Calculate variable-rate irrigation prescription."""
    soil_moisture = await get_soil_moisture_map(field_id)  # From IoT sensors
    weather = await get_weather_forecast(field_id, days=7)
    ndwi = await get_latest_ndwi(field_id)
    crop_stage = await get_crop_growth_stage(field_id)
    
    # Crop water requirement by growth stage (mm/day)
    CROP_WATER_NEEDS = {
        "germination": 3, "vegetative": 5, "flowering": 7,
        "grain_fill": 6, "maturity": 3
    }
    
    target_mm = CROP_WATER_NEEDS[crop_stage]
    rain_forecast_mm = sum(day.precip_mm for day in weather[:3])
    deficit_mm = max(0, target_mm * 3 - rain_forecast_mm)
    
    # Variable-rate: more water where soil is dry + NDWI is low
    zones = create_management_zones(soil_moisture, ndwi)
    prescription = {}
    for zone in zones:
        zone_deficit = deficit_mm * (1 - zone.moisture_pct / 100)
        prescription[zone.id] = {"water_mm": round(zone_deficit, 1)}
    
    return IrrigationPlan(field_id=field_id, prescription=prescription, total_mm=sum(p["water_mm"] for p in prescription.values()))
```

## Step 5: Deploy Yield Prediction Model

```bash
python models/train_yield.py \
  --features ndvi_timeseries,soil_data,weather_history,crop_type,planting_date \
  --target yield_tonnes_per_hectare \
  --model-type gradient_boosting \
  --output models/yield_predictor_v1.pkl
```

Yield prediction features:
| Feature Group | Variables | Importance |
|--------------|-----------|-----------|
| NDVI time-series | Weekly NDVI from planting to harvest | 35% |
| Weather | Temperature, rainfall, solar radiation | 25% |
| Soil | Moisture, pH, N/P/K levels | 20% |
| Management | Planting date, crop variety, fertilizer applied | 15% |
| Historical | Previous yields, crop rotation history | 5% |

## Step 6: Smoke Test

```bash
# Analyze field health
curl -s https://api-agri.azurewebsites.net/api/health \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"field_id": "field-001", "imagery_date": "2026-04-10"}' | jq '.ndvi_avg, .stress_zones[:2]'

# Get irrigation prescription
curl -s https://api-agri.azurewebsites.net/api/irrigation \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"field_id": "field-001"}' | jq '.prescription'

# Predict yield
curl -s https://api-agri.azurewebsites.net/api/yield \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"field_id": "field-001", "crop": "corn"}' | jq '.predicted_yield_t_ha'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| NDVI all zero | Cloud-covered imagery | Use cloud mask, request cloud-free scene |
| Stress detection misses early signs | Threshold too high | Lower NDVI stress threshold from 0.3 to 0.4 |
| Irrigation over-prescribing | Missing rain forecast | Integrate weather API forecast |
| Yield prediction ±30% error | Insufficient NDVI time-series | Need weekly captures, not monthly |
| Pest vs disease confusion | Similar spectral signatures | Add close-up drone imagery for Custom Vision |
