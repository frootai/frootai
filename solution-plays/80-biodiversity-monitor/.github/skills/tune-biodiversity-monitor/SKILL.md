---
name: "tune-biodiversity-monitor"
description: "Tune Biodiversity Monitor — classifier thresholds, camera trap filtering, bioacoustic sensitivity, occupancy model parameters, invasive alerting, cost optimization."
---

# Tune Biodiversity Monitor

## Prerequisites

- Deployed biodiversity system with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Image Classification

```json
// config/guardrails.json — image classification settings
{
  "image_classification": {
    "confidence_threshold": 0.75,
    "empty_frame_threshold": 0.90,
    "low_confidence_action": "queue_for_review",
    "species_groups": {
      "mammals": {"confidence_threshold": 0.70, "priority": "high"},
      "birds": {"confidence_threshold": 0.65, "priority": "high"},
      "reptiles": {"confidence_threshold": 0.75, "priority": "medium"},
      "amphibians": {"confidence_threshold": 0.70, "priority": "medium"}
    },
    "max_detections_per_image": 10,
    "model_format": "onnx",
    "batch_processing": true
  }
}
```

Classification tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `confidence_threshold` | 0.75 | Lower = more IDs (risk misidentification) |
| `empty_frame_threshold` | 0.90 | Lower = keep more borderline frames (more to review) |
| Birds threshold | 0.65 | Lower for birds — many lookalike species |
| `batch_processing` | true | Process overnight batch vs real-time |

### Look-Alike Species Handling
| Species Pair | Confusion Risk | Mitigation |
|-------------|---------------|------------|
| Red fox ↔ Jackal | High in overlap zones | Geo-spatial check + body proportion analysis |
| Great tit ↔ Coal tit | Medium | Focus on breast stripe pattern |
| Common lizard ↔ Wall lizard | Medium | Range map validation |
| Edible frog ↔ Pool frog | High | Audio confirmation (different call) |

## Step 2: Tune Bioacoustic Settings

```json
// config/agents.json — audio analysis settings
{
  "bioacoustics": {
    "sample_rate_hz": 22050,
    "spectrogram_n_mels": 128,
    "window_duration_sec": 5,
    "hop_duration_sec": 1,
    "confidence_threshold": 0.70,
    "snr_min_db": 6,
    "noise_reduction": true,
    "target_groups": ["birds", "amphibians", "bats", "insects"],
    "bat_ultrasonic": {
      "sample_rate_hz": 256000,
      "separate_recorder": true
    },
    "dawn_chorus_priority": {
      "enabled": true,
      "hours": [4, 8],
      "boost_confidence": -0.05
    }
  }
}
```

Audio tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `snr_min_db` | 6 | Lower = more detections in noisy environments |
| `window_duration_sec` | 5 | Shorter = catch brief calls, longer = better frequency resolution |
| `dawn_chorus_priority` | enabled | Lower thresholds during peak bird activity |
| `noise_reduction` | true | May remove faint calls if too aggressive |

## Step 3: Tune Population Modeling

```json
// config/agents.json — population tracking settings
{
  "population": {
    "occupancy_model": "single_season",
    "min_surveys_per_season": 5,
    "survey_window_days": 60,
    "detection_covariates": ["time_of_day", "weather", "observer_effort"],
    "occupancy_covariates": ["habitat_type", "elevation", "disturbance_index"],
    "trend_min_years": 3,
    "trend_method": "linear_regression",
    "abundance_method": "n_max",
    "reporting_level": "site"
  }
}
```

Population tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `min_surveys_per_season` | 5 | More = better estimates, more field effort |
| `survey_window_days` | 60 | Shorter = assume closed population, longer = more data |
| `trend_min_years` | 3 | More = more reliable trends, need longer data history |
| `abundance_method` | n_max | Alternatives: mark-recapture (more accurate, more effort) |

## Step 4: Tune Invasive Species Alerting

```json
// config/guardrails.json — invasive species settings
{
  "invasive_species": {
    "watchlist_source": "IUCN + regional_authority",
    "alert_on_unexpected_range": true,
    "range_map_update_frequency": "quarterly",
    "alert_channels": ["email", "conservation_authority_api"],
    "require_photo_verification": true,
    "confidence_threshold_invasive": 0.60,
    "auto_report_to_gbif": false
  }
}
```

Invasive tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `confidence_threshold_invasive` | 0.60 | Lower than general — err on caution for invasives |
| `require_photo_verification` | true | false = faster alerting, risk false alarms |
| `alert_on_unexpected_range` | true | Catch range expansion of native species too |
| `auto_report_to_gbif` | false | true = auto-submit to Global Biodiversity Info Facility |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "conservation_report": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 3000
  },
  "species_description": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 300
  },
  "habitat_assessment": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 500
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Conservation report | gpt-4o | Quality stakeholder-facing reports |
| Species description | gpt-4o-mini | Standard taxonomic info, routine |
| Habitat assessment | gpt-4o-mini | Structured analysis from data |

## Step 6: Cost Optimization

```python
# Biodiversity Monitor cost per site per month:
# Camera traps:
#   - Image storage: ~$5/month (10K images × 3MB avg)
#   - Custom Vision (species ID): ~$2/1000 images = ~$20/month
#   - Empty frame filter (ONNX): ~$0 (runs on edge or Functions)
# Audio:
#   - Audio storage: ~$3/month (continuous dawn chorus recordings)
#   - Audio classification: ~$10/month (Azure ML batch inference)
# Compute:
#   - IoT Hub S1 (shared): ~$25/month
#   - Container Apps: ~$15/month
#   - Cosmos DB Serverless: ~$5/month
# LLM:
#   - Conservation reports (gpt-4o, monthly): ~$0.15
#   - Species descriptions (gpt-4o-mini): ~$0.05
# Total per site: ~$83/month

# Cost reduction:
# 1. ONNX edge deployment for species ID: save $20/month Custom Vision
# 2. Process only triggered images (not continuous): save 60% storage
# 3. Audio analysis only dawn/dusk windows: save 70% audio processing
# 4. Shared IoT Hub across sites: save ~$20/site
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| ONNX edge inference | ~$20/month | Requires edge device at each site |
| Trigger-only images | ~$3/month storage | May miss slow-moving species |
| Dawn/dusk audio only | ~$7/month | Miss nocturnal species (bats, owls) |
| Shared IoT Hub | ~$20/site | Multi-tenant complexity |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_image_id.py --test-data evaluation/data/camera_traps/
python evaluation/eval_audio_id.py --test-data evaluation/data/recordings/
python evaluation/eval_population.py --test-data evaluation/data/surveys/
python evaluation/eval_invasive.py --test-data evaluation/data/invasive/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Image species ID | baseline | > 85% | > 85% |
| Audio detection | baseline | > 80% | > 80% |
| Invasive detection | baseline | > 95% | > 95% |
| Population trend accuracy | baseline | > 80% | > 80% |
| Cost per site/month | ~$83 | ~$50 | < $100 |
