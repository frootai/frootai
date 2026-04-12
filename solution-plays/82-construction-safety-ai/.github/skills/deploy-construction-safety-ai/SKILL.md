---
name: "deploy-construction-safety-ai"
description: "Deploy Construction Safety AI — PPE detection (YOLO/RT-DETR), hazard zone monitoring, incident prediction, safety compliance reporting, real-time worker alerts."
---

# Deploy Construction Safety AI

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Site camera feeds (IP cameras with RTSP streams)
- Labeled PPE dataset (hard hat, vest, boots, gloves — ≥5,000 images)
- Python 3.11+ with `ultralytics` (YOLOv8), `azure-ai-ml`, `opencv-python`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-construction-safety \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure Custom Vision | PPE detection model training + hosting | S0 |
| Azure IoT Hub | Camera feed ingestion + edge device management | S1 |
| Azure IoT Edge | On-site inference (low-latency detection) | Runtime |
| Azure OpenAI | Incident report generation + trend analysis | S0 |
| Event Hubs | Real-time safety alert streaming | Standard |
| Cosmos DB | Incident records, compliance logs, zone configs | Serverless |
| Azure Storage | Video clips, detection snapshots | Standard LRS |
| Container Apps | Safety dashboard API | Consumption |
| Azure Notification Hubs | Push alerts to supervisor mobile devices | Free/Basic |

## Step 2: Train PPE Detection Model

```python
from ultralytics import YOLO

# PPE detection classes
PPE_CLASSES = {
    0: "hard_hat",
    1: "no_hard_hat",
    2: "safety_vest",
    3: "no_safety_vest",
    4: "safety_boots",
    5: "no_safety_boots",
    6: "gloves",
    7: "no_gloves",
    8: "safety_glasses",
    9: "no_safety_glasses"
}

# Train YOLOv8 for PPE detection
model = YOLO("yolov8m.pt")  # Medium model — balance speed/accuracy
results = model.train(
    data="datasets/ppe/data.yaml",
    epochs=100,
    imgsz=640,
    batch=16,
    device="cuda",
    project="models",
    name="ppe_detector_v1"
)

# Export for edge deployment (ONNX for IoT Edge)
model.export(format="onnx", imgsz=640, half=True)
```

## Step 3: Deploy Edge Inference (IoT Edge)

```bash
# Deploy YOLO model to IoT Edge device at construction site
az iot edge set-modules \
  --hub-name iot-construction-safety \
  --device-id site-alpha-edge-001 \
  --content deployment/edge-deployment.json
```

Edge module configuration:
```json
{
  "ppe_detector": {
    "image": "ghcr.io/frootai/ppe-detector:v1",
    "settings": {
      "model_path": "/models/ppe_v1.onnx",
      "camera_rtsp_urls": ["rtsp://cam-01/stream", "rtsp://cam-02/stream"],
      "fps_sample_rate": 2,
      "confidence_threshold": 0.80,
      "motion_triggered_fps": 5
    }
  }
}
```

Processing pipeline:
| Stage | Rate | Purpose |
|-------|------|---------|
| Frame sampling | 2 FPS baseline | Most frames identical — save compute |
| Motion detection | Triggers 5 FPS | Increase rate when workers moving |
| Person detection | Per frame | Bounding box around each worker |
| PPE classification | Per person | Check required PPE items |
| Alert generation | Per violation | Deduplicate + aggregate per worker |

## Step 4: Configure Hazard Zones

```python
# Define hazard zones with geo-fencing per site
SITE_ZONES = {
    "crane_radius": {
        "type": "circle",
        "center": {"lat": 40.7128, "lon": -74.0060},
        "radius_m": 25,
        "risk_level": "critical",
        "required_ppe": ["hard_hat", "safety_vest", "safety_boots"],
        "max_workers": 5,
        "authorized_roles": ["crane_operator", "rigger", "signal_person"]
    },
    "excavation_edge": {
        "type": "polygon",
        "coordinates": [...],
        "risk_level": "high",
        "buffer_m": 2,
        "required_ppe": ["hard_hat", "safety_vest", "harness"],
        "fall_protection_required": True
    },
    "material_storage": {
        "type": "polygon",
        "coordinates": [...],
        "risk_level": "medium",
        "required_ppe": ["hard_hat", "safety_boots"],
        "forklift_warning": True
    }
}
```

## Step 5: Deploy Incident Prediction

```python
async def predict_incident_risk(site_id: str) -> RiskAssessment:
    """Predict incident risk based on historical patterns + current conditions."""
    # Historical patterns
    history = await get_incident_history(site_id, months=12)
    
    RISK_FACTORS = {
        "time_of_day": {"peak": [14, 16], "reason": "Fatigue + rush to finish"},
        "weather": {"rain": 1.5, "wind_above_40mph": 2.0, "extreme_heat": 1.8},
        "day_of_week": {"friday_afternoon": 1.3, "monday_morning": 1.2},
        "ppe_violation_rate": {"above_10pct": 1.5},
        "new_workers_pct": {"above_30pct": 1.4},
        "concurrent_trades": {"above_5": 1.3}
    }
    
    current_risk = calculate_composite_risk(history, RISK_FACTORS, current_conditions)
    
    return RiskAssessment(
        risk_score=current_risk.score,
        level=current_risk.level,  # "low", "elevated", "high", "critical"
        top_factors=current_risk.top_3_factors,
        recommendations=generate_mitigations(current_risk)
    )
```

## Step 6: Deploy Safety Compliance Dashboard

```bash
# Real-time metrics streamed to dashboard
# - PPE compliance rate (% workers with full PPE)
# - Active hazard zone intrusions
# - Incident trend (7-day rolling)
# - Risk score per shift
# - Violation heatmap by zone

az containerapp create \
  --name safety-dashboard \
  --resource-group rg-frootai-construction-safety \
  --environment cae-construction \
  --image ghcr.io/frootai/safety-dashboard:latest \
  --target-port 3000
```

## Step 7: Smoke Test

```bash
# Submit test image for PPE detection
curl -s https://api-safety.azurewebsites.net/api/detect-ppe \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@evaluation/data/site_photo.jpg" | jq '.detections'

# Check zone compliance
curl -s https://api-safety.azurewebsites.net/api/zones/status \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"site_id": "site-alpha"}' | jq '.zones'

# Get risk prediction
curl -s https://api-safety.azurewebsites.net/api/risk \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"site_id": "site-alpha"}' | jq '.risk_score, .level, .top_factors'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| PPE detection misses helmets | Similar color to background | Train with site-specific data, adjust contrast |
| Too many false alerts | Confidence threshold too low | Raise threshold to 0.85, add temporal smoothing |
| Edge device overheating | Processing too many FPS | Lower to 1 FPS, use motion trigger only |
| Night detection fails | No IR cameras | Deploy IR-capable cameras for night shifts |
| Zone intrusion false positives | GPS drift on workers | Use camera-based position, not GPS |
