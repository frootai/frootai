---
name: "deploy-waste-recycling-optimizer"
description: "Deploy Waste Recycling Optimizer — material classification (CV), contamination detection, route optimization, fill-level prediction, circular economy tracking."
---

# Deploy Waste Recycling Optimizer

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Labeled waste image dataset (≥5,000 images across 9 categories)
- Python 3.11+ with `onnxruntime`, `azure-cognitiveservices-vision`, `ortools`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-waste-optimizer \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure Custom Vision | Train waste material classifier | S0 |
| Azure IoT Hub | Fill-level sensor data from bins | S1 |
| Azure Maps | Route optimization for collection trucks | S1 |
| Azure OpenAI | Analytics narratives + anomaly reports | S0 |
| Cosmos DB | Collection records, classification logs, routes | Serverless |
| Azure Storage | Waste images + ONNX model artifacts | Standard LRS |
| Container Apps | Classification API + route optimization service | Consumption |
| Azure Key Vault | API keys + IoT connection strings | Standard |

## Step 2: Train Material Classification Model

```python
# Material categories (9-class multi-label)
WASTE_CATEGORIES = {
    "recyclable_plastic_pet": {"resin_code": 1, "action": "recycle_plastic"},
    "recyclable_plastic_hdpe": {"resin_code": 2, "action": "recycle_plastic"},
    "recyclable_metal_aluminum": {"action": "recycle_metal"},
    "recyclable_metal_steel": {"action": "recycle_metal"},
    "recyclable_paper": {"action": "recycle_paper"},
    "recyclable_glass": {"action": "recycle_glass"},
    "organic_compostable": {"action": "compost"},
    "electronic_waste": {"action": "special_collection"},
    "non_recyclable": {"action": "landfill"}
}

# Train with Azure Custom Vision
from azure.cognitiveservices.vision.customvision.training import CustomVisionTrainingClient
trainer = CustomVisionTrainingClient(endpoint, credentials)
project = trainer.create_project("waste-classifier", classification_type="Multiclass")

# Upload labeled images per category
for category, images in labeled_data.items():
    tag = trainer.create_tag(project.id, category)
    trainer.create_images_from_files(project.id, images, [tag.id])

# Train and export ONNX for edge deployment
iteration = trainer.train_project(project.id)
trainer.export_iteration(project.id, iteration.id, platform="ONNX")
```

## Step 3: Deploy Contamination Detection

```python
async def detect_contamination(image: bytes, classification: str) -> ContaminationResult:
    """Detect contamination in recyclable materials."""
    CONTAMINATION_TYPES = {
        "food_residue": {"threshold": 0.3, "impact": "batch_rejection"},
        "liquid_presence": {"threshold": 0.2, "impact": "sorting_jam"},
        "mixed_materials": {"threshold": 0.4, "impact": "downgrade_quality"},
        "hazardous_label": {"threshold": 0.1, "impact": "safety_stop"}
    }
    
    scores = await contamination_model.analyze(image)
    contaminated = {k: v for k, v in scores.items() if v > CONTAMINATION_TYPES[k]["threshold"]}
    
    if contaminated:
        return ContaminationResult(
            is_contaminated=True,
            types=contaminated,
            action="manual_sort",
            severity=max(contaminated.values())
        )
    return ContaminationResult(is_contaminated=False, action="auto_sort")
```

## Step 4: Deploy Route Optimization

```python
from ortools.constraint_solver import routing_enums_pb2, pywrapcp

def optimize_collection_route(bins: list[Bin], depot: Location, truck_capacity_kg: int) -> Route:
    """Solve Vehicle Routing Problem with time windows + capacity."""
    # Only collect bins with fill_level > threshold (default 70%)
    bins_to_collect = [b for b in bins if b.fill_level_pct > 70]
    
    manager = pywrapcp.RoutingIndexManager(len(bins_to_collect) + 1, 1, 0)
    routing = pywrapcp.RoutingModel(manager)
    
    # Distance callback (Azure Maps driving distance)
    def distance_callback(from_idx, to_idx):
        from_loc = get_location(from_idx)
        to_loc = get_location(to_idx)
        return azure_maps.get_route_distance(from_loc, to_loc)
    
    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
    
    # Capacity constraint
    routing.AddDimension(weight_callback_index, 0, truck_capacity_kg, True, "Weight")
    
    # Time windows (collection hours: 06:00-18:00)
    routing.AddDimension(time_callback_index, 30, 720, False, "Time")
    
    solution = routing.SolveWithParameters(search_params)
    return extract_route(solution, manager, routing)
```

## Step 5: Deploy Fill-Level Prediction

```bash
# IoT sensors in bins report fill level every 4 hours
# ML model predicts when bins reach 80% (collection trigger)

python models/train_fill_predictor.py \
  --data-source cosmosdb://collection-records \
  --features bin_type,location,day_of_week,season,local_events \
  --target fill_rate_kg_per_hour \
  --model-type gradient_boosting \
  --output models/fill_predictor_v1.pkl
```

## Step 6: Configure Circular Economy Tracking

```json
// config/agents.json — material flow tracking
{
  "circular_economy": {
    "track_stages": ["collected", "sorted", "recycled", "reused", "landfilled"],
    "recovery_targets": {
      "plastic": 0.50,
      "metal": 0.70,
      "paper": 0.65,
      "glass": 0.80,
      "organic": 0.60
    },
    "contamination_rejection_rate_target": 0.05,
    "reporting_cadence": "monthly"
  }
}
```

## Step 7: Smoke Test

```bash
# Test material classification
curl -s https://api-waste.azurewebsites.net/api/classify \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@evaluation/data/test_plastic.jpg" | jq '.'

# Test route optimization
curl -s https://api-waste.azurewebsites.net/api/optimize-route \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"zone": "north", "date": "2026-04-11"}' | jq '.route.stops[:3]'

# Check fill predictions
curl -s https://api-waste.azurewebsites.net/api/fill-predictions \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"zone": "north", "horizon_hours": 24}' | jq '.bins_needing_collection'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Classification accuracy < 80% | Insufficient training data | Add more labeled images, augment |
| Route takes too long to compute | Too many bins in one route | Partition into zones, parallelize |
| Fill prediction off by >20% | Seasonal patterns not captured | Add season + event features |
| IoT sensor gaps | Battery/connectivity issues | Set up dead-sensor alerting |
| High contamination rejection | Threshold too strict | Adjust contamination thresholds |
