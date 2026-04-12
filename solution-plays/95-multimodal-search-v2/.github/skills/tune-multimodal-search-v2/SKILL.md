---
name: "tune-multimodal-search-v2"
description: "Tune Multimodal Search V2 — fusion weights, embedding models, cross-modal accuracy, video processing, personalization, cost optimization."
---

# Tune Multimodal Search V2

## Prerequisites

- Deployed multimodal search with evaluation results available
- Access to `config/openai.json`, `config/search.json`, `config/guardrails.json`

## Step 1: Tune Fusion Weights

```json
// config/search.json — fusion settings
{
  "fusion": {
    "method": "reciprocal_rank_fusion",
    "default_weights": {
      "text": 0.40,
      "image": 0.30,
      "audio": 0.20,
      "video": 0.10
    },
    "query_dependent_weighting": true,
    "query_type_profiles": {
      "factual": {"text": 0.60, "image": 0.10, "audio": 0.20, "video": 0.10},
      "visual": {"text": 0.15, "image": 0.50, "audio": 0.05, "video": 0.30},
      "tutorial": {"text": 0.20, "image": 0.10, "audio": 0.10, "video": 0.60},
      "music_audio": {"text": 0.10, "image": 0.05, "audio": 0.75, "video": 0.10}
    },
    "multi_modal_bonus": 0.05,
    "rrf_k": 60,
    "personalization_enabled": true,
    "user_preference_boost": 1.3
  }
}
```

Fusion tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `text` weight | 0.40 | Higher = text-dominant results (good for factual queries) |
| `image` weight | 0.30 | Higher = visual content prioritized |
| `multi_modal_bonus` | 0.05 per extra modality | Higher = strongly prefer multi-modal matches |
| `rrf_k` | 60 | Lower = more emphasis on top ranks |
| `user_preference_boost` | 1.3× | Higher = more personalized, risk filter bubble |

### Query Type Detection
| Query Type | Detection Signal | Weight Profile |
|-----------|-----------------|---------------|
| Factual | Question words, definitions | Text 60%, Image 10% |
| Visual | "show me", "what does X look like" | Image 50%, Video 30% |
| Tutorial | "how to", "step by step" | Video 60%, Text 20% |
| Audio | "song", "podcast", "listen" | Audio 75%, Text 10% |
| General | None matched | Default weights |

## Step 2: Tune Embedding Models

```json
// config/openai.json — encoder settings
{
  "encoders": {
    "text": {
      "model": "text-embedding-3-large",
      "dimensions": 1536,
      "batch_size": 100
    },
    "image": {
      "model": "clip-vit-large-patch14",
      "dimensions": 768,
      "preprocessing": {"resize": 224, "normalize": true}
    },
    "audio": {
      "transcription_model": "whisper-large-v3",
      "embedding_model": "text-embedding-3-large",
      "chunk_duration_sec": 30,
      "overlap_sec": 5
    },
    "video": {
      "frame_extraction_fps": 1,
      "deduplicate_threshold": 0.85,
      "scene_detection": true,
      "visual_encoder": "clip-vit-large-patch14",
      "transcript_encoder": "text-embedding-3-large"
    },
    "cross_modal": {
      "shared_space": "clip",
      "text_to_image_enabled": true,
      "image_to_text_enabled": true
    }
  }
}
```

Encoder tuning:
| Modality | Model | Dimensions | Trade-off |
|----------|-------|-----------|-----------|
| Text | text-embedding-3-large | 1536 (or 256 for cost) | Higher dim = better accuracy, more storage |
| Image | CLIP ViT-L/14 | 768 | Enables cross-modal text↔image |
| Audio | Whisper → text-embed | 1536 | Accuracy depends on transcription quality |
| Video | CLIP + text-embed | 768 + 1536 | Dual embedding captures visual + spoken |

## Step 3: Tune Video Processing

```json
// config/agents.json — video settings
{
  "video_processing": {
    "key_frame_fps": 1,
    "deduplicate_frames": true,
    "deduplicate_threshold": 0.85,
    "scene_detection": {
      "enabled": true,
      "method": "content_aware",
      "min_scene_duration_sec": 5
    },
    "transcript": {
      "model": "whisper-large-v3",
      "language": "auto",
      "timestamps": true,
      "chunk_for_embedding_sec": 30
    },
    "max_video_duration_min": 120,
    "index_strategy": "scene_level",
    "thumbnail_generation": true
  }
}
```

Video tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `key_frame_fps` | 1 | Higher = more frames, more compute/storage |
| `scene_detection` | enabled | Groups frames into semantic scenes |
| `index_strategy` | scene_level | "video_level" = one embedding per video (less granular) |
| `max_video_duration_min` | 120 | Longer videos = more processing time |

## Step 4: Tune Personalization

```json
// config/agents.json — personalization settings
{
  "personalization": {
    "enabled": true,
    "user_profile_features": [
      "preferred_modalities",
      "frequently_searched_topics",
      "click_through_history",
      "format_preferences"
    ],
    "modality_boost": 1.3,
    "topic_boost": 1.2,
    "cold_start_strategy": "popular_items",
    "profile_update_frequency": "per_session",
    "privacy": {
      "anonymize_profiles": true,
      "retention_days": 90,
      "opt_out_supported": true
    }
  }
}
```

| Parameter | Default | Impact |
|-----------|---------|--------|
| `modality_boost` | 1.3× | Higher = stronger preference following |
| `topic_boost` | 1.2× | Boost results matching user's topic interests |
| `retention_days` | 90 | Longer = better personalization, more privacy concern |
| `opt_out_supported` | true | Required for privacy compliance |

## Step 5: Cost Optimization

```python
# Multimodal Search V2 cost per month (100K documents, 50K queries):
# Encoding (one-time + delta):
#   - Text embeddings (100K docs): ~$2/month (delta only)
#   - Image embeddings (50K images): ~$2.50
#   - Audio transcription (10K tracks, Whisper): ~$30
#   - Video processing (5K videos, frames+transcript): ~$50
# Search:
#   - AI Search S1: ~$250/month
#   - 4 vector indices: included in S1
# LLM:
#   - Query understanding (gpt-4o-mini): ~$1/month
# Infrastructure:
#   - Container Apps: ~$15/month
#   - Cosmos DB: ~$10/month
#   - CDN: ~$10/month
# Total: ~$371/month

# Cost reduction:
# 1. Reduce text-embedding dimensions (1536 → 256): save ~60% vector storage
# 2. Process video at 0.5 fps (not 1): save ~50% video compute
# 3. Skip scene detection (index at video level): save ~30% video
# 4. AI Search Basic (if <1M docs): save $200/month
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Lower dimensions | ~60% storage | Slightly lower precision |
| Lower video FPS | ~$25/month | May miss short scenes |
| Skip scenes | ~$15/month | Less granular video search |
| Search Basic | ~$200/month | 15M document limit |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_per_modality.py --test-data evaluation/data/queries/
python evaluation/eval_cross_modal.py --test-data evaluation/data/cross_modal/
python evaluation/eval_fusion.py --test-data evaluation/data/fusion/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Text Precision@10 | baseline | > 85% | > 85% |
| Cross-modal text→image | baseline | > 70% | > 70% |
| Fusion improvement | baseline | > 10% | > 10% |
| Latency p50 | baseline | < 200ms | < 200ms |
| Monthly cost | ~$371 | ~$150 | < $400 |
