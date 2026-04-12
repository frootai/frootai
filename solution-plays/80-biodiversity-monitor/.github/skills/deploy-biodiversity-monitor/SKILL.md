---
name: "deploy-biodiversity-monitor"
description: "Deploy Biodiversity Monitor — multi-modal species identification (camera+audio), population tracking, invasive species alerting, habitat health assessment, conservation scoring."
---

# Deploy Biodiversity Monitor

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Camera trap images + audio recordings (labeled species data for training)
- Python 3.11+ with `azure-ai-ml`, `librosa` (audio), `rasterio` (geospatial)

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-biodiversity \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure Custom Vision | Species image classification | S0 |
| Azure Speech / Custom ML | Bioacoustic species identification | S0 / on-demand |
| Azure IoT Hub | Camera trap + audio sensor telemetry | S1 |
| Azure OpenAI | Conservation report generation | S0 |
| Cosmos DB | Observations, species records, population data | Serverless |
| Azure Maps | Range maps, habitat boundaries, elevation | S1 |
| Azure Storage | Camera trap images, audio recordings, ONNX models | Standard LRS |
| Container Apps | Biodiversity API + monitoring dashboard | Consumption |

## Step 2: Deploy Camera Trap Image Pipeline

```python
# Camera trap processing pipeline
async def process_camera_trap(image_batch: list[CameraTrapImage]) -> list[Detection]:
    """Process camera trap images: filter → detect → classify."""
    results = []
    for img in image_batch:
        # Step 1: Empty/animal filter (reject 70-90% empty frames)
        is_animal = await empty_filter.predict(img.data)
        if not is_animal:
            continue
        
        # Step 2: Animal detection (bounding box)
        detections = await animal_detector.detect(img.data)
        
        # Step 3: Species classification per detection
        for det in detections:
            cropped = crop_detection(img.data, det.bbox)
            species = await species_classifier.classify(cropped)
            
            # Step 4: Geo-spatial validation
            if not is_expected_species(species.name, img.location):
                species.flag = "unexpected_range"
                species.alert_type = "invasive_or_range_expansion"
            
            results.append(Detection(
                species=species.name, confidence=species.confidence,
                location=img.location, timestamp=img.timestamp,
                image_id=img.id, bbox=det.bbox, flag=species.flag
            ))
    return results

# Species classifier categories
SPECIES_TAXONOMY = {
    "mammals": ["deer", "fox", "badger", "hare", "wild_boar", "lynx", "wolf", "bear"],
    "birds": ["eagle", "owl", "woodpecker", "heron", "falcon", "stork"],
    "reptiles": ["lizard", "snake", "turtle"],
    "amphibians": ["frog", "salamander", "newt"]
}
```

## Step 3: Deploy Bioacoustic Identification

```python
import librosa

async def identify_species_audio(audio_file: str) -> list[AudioDetection]:
    """Identify species from audio recordings (bird calls, amphibians, bats)."""
    # Load audio and generate spectrogram
    y, sr = librosa.load(audio_file, sr=22050)
    spectrogram = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128)
    
    # Segment into windows (5-second chunks with 1-second overlap)
    windows = segment_audio(spectrogram, window_sec=5, hop_sec=1)
    
    detections = []
    for window in windows:
        # BirdNET-style classifier or custom trained model
        result = await audio_classifier.classify(window)
        if result.confidence > 0.7:
            detections.append(AudioDetection(
                species=result.species,
                confidence=result.confidence,
                time_offset_sec=window.start_sec,
                call_type=result.call_type  # "song", "call", "alarm", "echolocation"
            ))
    
    return merge_consecutive_detections(detections)

# Audio target groups
AUDIO_TARGETS = {
    "birds": {"frequency_range_hz": [500, 10000], "model": "birdnet_v2"},
    "amphibians": {"frequency_range_hz": [200, 5000], "model": "anuran_classifier"},
    "bats": {"frequency_range_hz": [20000, 120000], "model": "bat_echolocation"},
    "insects": {"frequency_range_hz": [1000, 15000], "model": "insect_classifier"}
}
```

## Step 4: Deploy Population Tracker

```python
async def estimate_population(species: str, site_id: str) -> PopulationEstimate:
    """Occupancy modeling from repeated surveys."""
    # Collect detection/non-detection data across multiple surveys
    surveys = await get_survey_data(species, site_id, min_surveys=5)
    
    # Single-season occupancy model
    # p = detection probability (given present)
    # psi = occupancy probability
    detection_history = build_detection_history(surveys)
    model = OccupancyModel(detection_history)
    psi, p = model.fit()
    
    # Population index (relative abundance)
    abundance = calculate_abundance_index(surveys, method="n_max")
    
    # Trend analysis (year-over-year)
    trend = calculate_population_trend(species, site_id, years=5)
    
    return PopulationEstimate(
        species=species, occupancy=psi, detection_prob=p,
        abundance_index=abundance, trend=trend.direction,
        trend_magnitude=trend.pct_change_per_year
    )
```

## Step 5: Deploy Invasive Species Alert System

```python
INVASIVE_SPECIES_WATCHLIST = {
    "Vespa_velutina": {"common": "Asian Hornet", "risk": "critical", "native_range": "Southeast Asia"},
    "Procyon_lotor": {"common": "Raccoon", "risk": "high", "native_range": "North America"},
    "Trachemys_scripta": {"common": "Red-eared Slider", "risk": "high", "native_range": "North America"},
    "Myocastor_coypus": {"common": "Coypu", "risk": "medium", "native_range": "South America"},
}

async def check_invasive(detection: Detection) -> InvasiveAlert:
    if detection.species in INVASIVE_SPECIES_WATCHLIST:
        return InvasiveAlert(
            species=detection.species,
            risk=INVASIVE_SPECIES_WATCHLIST[detection.species]["risk"],
            action="verify_and_report",
            report_to=["conservation_authority", "citizen_science_platform"]
        )
    if detection.flag == "unexpected_range":
        return InvasiveAlert(species=detection.species, risk="unknown",
            action="investigate_range_expansion")
    return None
```

## Step 6: Smoke Test

```bash
# Submit camera trap image
curl -s https://api-biodiversity.azurewebsites.net/api/identify/image \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@evaluation/data/camera_trap_001.jpg" \
  -F "location=48.8566,2.3522" | jq '.'

# Submit audio recording
curl -s https://api-biodiversity.azurewebsites.net/api/identify/audio \
  -H "Authorization: Bearer $TOKEN" \
  -F "audio=@evaluation/data/dawn_chorus.wav" \
  -F "location=48.8566,2.3522" | jq '.detections[:3]'

# Get population estimate
curl -s https://api-biodiversity.azurewebsites.net/api/population \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"species": "Lynx lynx", "site_id": "site-alpine-001"}' | jq '.'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 90% empty camera trap images | Motion trigger too sensitive | Add AI empty-frame filter (pre-classify) |
| Bird ID accuracy < 60% | Look-alike species in same region | Add geo-spatial range validation |
| Audio detection missed species | Background noise too high | Apply noise reduction, filter by SNR > 10dB |
| Invasive alert false positive | Species range map outdated | Update GBIF range data quarterly |
| Population trend unreliable | Too few surveys | Require ≥5 surveys per season for occupancy model |
