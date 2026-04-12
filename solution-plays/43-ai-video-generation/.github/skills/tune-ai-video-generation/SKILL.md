---
name: "tune-ai-video-generation"
description: "Tune AI Video Generation configuration — resolution presets, quality/cost trade-offs, batch queue throughput, prompt enhancement, content safety thresholds, preview workflow."
---

# Tune AI Video Generation

## Prerequisites

- Deployed video generation pipeline with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-ai-video-generation` skill

## Step 1: Tune Generation Presets

### Resolution and Quality Presets
```json
// config/openai.json
{
  "generation": {
    "model": "video-generation",
    "presets": {
      "preview": {
        "resolution": "480p",
        "duration_max": 5,
        "quality": "draft",
        "fps": 24,
        "aspect_ratio": "16:9"
      },
      "standard": {
        "resolution": "720p",
        "duration_max": 15,
        "quality": "standard",
        "fps": 24,
        "aspect_ratio": "16:9"
      },
      "production": {
        "resolution": "1080p",
        "duration_max": 60,
        "quality": "high",
        "fps": 30,
        "aspect_ratio": "16:9"
      }
    },
    "default_preset": "standard"
  },
  "prompt_enhancement": {
    "enabled": true,
    "model": "gpt-4o-mini",
    "temperature": 0.3,
    "enhance_prompt": true,
    "add_style_hints": true,
    "max_enhanced_length": 500
  }
}
```

Tuning levers:
| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| `resolution` | 720p | 480p-4K | Higher = better quality, 4x cost per step |
| `duration_max` | 15s | 5-60s | Longer = proportionally higher cost |
| `quality` | standard | draft/standard/high | Affects rendering detail level |
| `fps` | 24 | 15-60 | Higher = smoother motion, larger file |
| `default_preset` | standard | preview/standard/production | Controls default generation quality |

### Preview-First Workflow
```python
# Recommended: generate preview first, then upgrade on approval
# 1. Generate 480p/5s preview (~$0.06)
# 2. User reviews preview
# 3. If approved: regenerate at 1080p/full-duration (~$0.50+)
# 4. Cost savings: ~85% on rejected previews
```

Preview workflow saves:
| Scenario | Without Preview | With Preview | Savings |
|----------|----------------|--------------|---------|
| User approves first try | $0.50 | $0.56 | -12% (slightly more) |
| User rejects first, approves second | $1.00 | $0.62 | 38% |
| User rejects 3 times, approves | $2.00 | $0.68 | 66% |
| Average (40% rejection rate) | $0.80 | $0.60 | **25%** |

## Step 2: Tune Prompt Enhancement

```json
// config/openai.json — prompt enhancement
{
  "prompt_enhancement": {
    "enabled": true,
    "model": "gpt-4o-mini",
    "temperature": 0.3,
    "system_prompt": "Enhance this video generation prompt with cinematic details. Add lighting, camera angle, motion, and atmosphere. Keep the core intent intact. Max 500 characters.",
    "examples": [
      {
        "input": "a cat in a garden",
        "enhanced": "A fluffy orange tabby cat prowling through a sunlit English garden, morning dew on flower petals, soft bokeh background, tracking shot at cat eye level, golden hour lighting, 4K cinematic"
      }
    ]
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `enabled` | true | false = use raw prompts (cheaper, less consistent) |
| `temperature` | 0.3 | Higher = more creative enhancements |
| `max_enhanced_length` | 500 | Longer prompts give more control but cost more |
| Few-shot examples | 1 | More examples = more consistent style |

When to tune:
- **Quality < 3.5/5**: Add more style/lighting hints in enhancement
- **Prompt adherence < 4.0**: Lower temperature, add "keep core intent" instruction
- **Too creative**: Lower temperature to 0.1, remove style hints

## Step 3: Tune Content Safety

```json
// config/guardrails.json — content safety tuning
{
  "input_safety": {
    "severity_threshold": 2,
    "categories": {
      "violence": { "enabled": true, "threshold": 2 },
      "sexual": { "enabled": true, "threshold": 2 },
      "hate": { "enabled": true, "threshold": 2 },
      "self_harm": { "enabled": true, "threshold": 2 }
    },
    "copyright_filter": {
      "enabled": true,
      "keyword_list": "config/copyright-keywords.json",
      "character_detection": true
    }
  },
  "output_safety": {
    "frame_sample_rate": 1,
    "check_every_nth_frame": 1,
    "severity_threshold": 2,
    "reject_action": "delete_and_notify"
  }
}
```

Tuning levers:
| Parameter | Default | When to Adjust |
|-----------|---------|---------------|
| `severity_threshold` | 2 | Lower to 1 for children's content, higher to 3 for editorial |
| `frame_sample_rate` | 1/sec | Decrease to 0.5/sec for lower cost, increase to 2/sec for strict |
| `copyright_filter` | enabled | Disable for internal/enterprise use only |
| `reject_action` | delete_and_notify | Change to "flag_for_review" for human-in-loop |

## Step 4: Tune Batch Queue

```json
// config/agents.json — batch queue tuning
{
  "queue": {
    "max_concurrent": 3,
    "poll_interval_ms": 5000,
    "job_timeout_ms": 300000,
    "retry_count": 2,
    "retry_delay_ms": 10000,
    "priority_queues": {
      "high": "video-generation-priority",
      "standard": "video-generation-queue"
    },
    "rate_limiting": {
      "max_per_user_per_hour": 20,
      "max_per_user_per_day": 100,
      "burst_limit": 5
    }
  },
  "storage": {
    "container": "generated-videos",
    "retention_days": 30,
    "tier": "Cool",
    "cdn_enabled": false
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `max_concurrent` | 3 | Higher = more throughput, higher API cost |
| `job_timeout_ms` | 300000 (5min) | Increase for long videos (60s = 3 min gen) |
| `retry_count` | 2 | More retries = higher reliability but more cost |
| `max_per_user_per_hour` | 20 | Prevents single user exhausting budget |
| `retention_days` | 30 | Longer = more storage cost |
| `tier` | Cool | Hot for frequent access, Archive for long-term |

## Step 5: Tune Style and Rendering

```json
// config/styles.json
{
  "available_styles": {
    "natural": { "description": "Photorealistic, natural lighting", "cost_multiplier": 1.0 },
    "cinematic": { "description": "Movie-quality, dramatic lighting", "cost_multiplier": 1.2 },
    "animated": { "description": "2D/3D animation style", "cost_multiplier": 0.8 },
    "artistic": { "description": "Painterly, stylized rendering", "cost_multiplier": 0.9 },
    "documentary": { "description": "Neutral, observational tone", "cost_multiplier": 1.0 }
  },
  "default_style": "natural",
  "camera_defaults": {
    "angle": "eye_level",
    "movement": "static",
    "transition": "cut"
  }
}
```

## Step 6: Cost Optimization

```python
# Video generation cost optimization strategies:
#
# 1. Preview-first workflow (saves 25% average)
#    - 480p preview → approve → 1080p production
#
# 2. Smart prompt enhancement (saves 15%)
#    - Use gpt-4o-mini instead of gpt-4o for enhancement
#    - Cache enhanced prompts for similar requests
#
# 3. Frame safety sampling (saves 30% safety cost)
#    - Sample every 2nd frame instead of every frame
#    - Only check if prompt was borderline
#
# 4. Resolution-appropriate style (saves 20%)
#    - Animated style at 720p often looks better than natural at 480p
#    - Match style to resolution for best quality/cost
#
# 5. Batch scheduling (saves 10%)
#    - Process non-urgent jobs during off-peak hours
#    - Lower API rates during low-demand periods
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Preview-first workflow | ~25% | Slight delay for approval step |
| gpt-4o-mini for enhancement | ~90% enhancement cost | Slightly less creative prompts |
| Frame sampling every 2s | ~50% safety cost | May miss brief unsafe frames |
| Cool storage tier | ~60% storage cost | Higher retrieval latency |
| Off-peak batch processing | ~10% API cost | Longer queue wait times |
| Style-based routing | ~20% gen cost | Animated may not suit all prompts |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_quality.py --test-data evaluation/data/ --judge-model gpt-4o
python evaluation/eval_safety.py --test-data evaluation/data/
python evaluation/eval_performance.py --test-data evaluation/data/
python evaluation/eval_cost.py --test-data evaluation/data/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Prompt adherence | baseline | +0.3-0.5 | > 4.0/5.0 |
| Content safety | baseline | +1-2% | > 99% |
| Generation latency (5s) | baseline | -10-20% | < 60s |
| Cost per 5s/1080p | ~$0.50 | ~$0.35-0.40 | < $0.50 |
| Queue throughput | baseline | +30-50% | > 20/hr |
