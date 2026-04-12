---
name: "tune-creative-ai-studio"
description: "Tune Creative AI Studio — creative temperature, brand voice rules, variation count, platform templates, A/B test config, image style presets, cost optimization."
---

# Tune Creative AI Studio

## Prerequisites

- Deployed creative AI studio with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-creative-ai-studio` skill

## Step 1: Tune Brand Voice

### Brand Configuration
```json
// config/guardrails.json
{
  "brand": {
    "company": "Contoso",
    "tone": "Professional yet approachable. Clear, not corporate.",
    "voice": "First-person plural (we, our team). Active voice.",
    "style": "Short sentences. Max 3 sentences per paragraph. Data-driven.",
    "forbidden_words": ["revolutionary", "game-changing", "synergy", "leverage", "disrupt", "paradigm", "pivot"],
    "required_elements": ["customer benefit per paragraph", "specific metric or example", "clear CTA"],
    "personality": "Knowledgeable friend, not corporate spokesperson"
  },
  "content_safety": {
    "check_text": true,
    "check_images": true,
    "severity_threshold": 2,
    "copyright_filter": true
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `forbidden_words` | 7 words | More = stricter brand control |
| `required_elements` | 3 elements | More = richer content, longer generation |
| `tone` description | ~15 words | More specific = more consistent |
| `personality` | 1 sentence | Shapes overall content character |

### Brand Voice Tuning Guide
| Symptom | Adjustment |
|---------|------------|
| Content too formal | Change tone to "conversational", add emoji permission |
| Forbidden words appearing | Add word variants ("game changing", "game-changing") |
| Missing CTAs | Add to required_elements, add CTA examples |
| Inconsistent person (I vs we) | Explicitly state in voice: "NEVER use I/my" |
| Content too long | Add to style: "Max 150 words per section" |

## Step 2: Tune Generation Parameters

### Temperature and Creativity
```json
// config/openai.json
{
  "text_generation": {
    "model": "gpt-4o",
    "temperature": 0.8,
    "top_p": 0.95,
    "max_tokens": 2048,
    "variation_count": 3,
    "seed": null
  },
  "image_generation": {
    "model": "dall-e-3",
    "size": "1024x1024",
    "quality": "hd",
    "style": "natural",
    "variation_count": 3
  },
  "adaptation": {
    "model": "gpt-4o-mini",
    "temperature": 0.6,
    "max_tokens": 500
  }
}
```

Tuning levers:
| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| `temperature` (text) | 0.8 | 0.5-1.2 | Higher = more creative, less consistent |
| `temperature` (adapt) | 0.6 | 0.3-0.8 | Lower for platform adaptation (more precise) |
| `variation_count` | 3 | 2-10 | More = wider choice, higher cost |
| `image.quality` | hd | standard/hd | hd = better quality, 2x cost |
| `image.style` | natural | natural/vivid | vivid = more dramatic, artistic |
| `seed` | null | null/int | null = varied, int = reproducible |

### Temperature by Content Type
| Content Type | Recommended Temp | Why |
|-------------|-----------------|-----|
| Headlines | 0.9 | Maximum creativity for hooks |
| Blog posts | 0.7 | Balanced creativity + coherence |
| Email copy | 0.6 | More structured, personalized |
| Social posts | 0.8 | Creative but on-brand |
| Technical content | 0.3-0.5 | Accuracy over creativity |
| Ad copy | 0.9 | Punchy, attention-grabbing |

## Step 3: Tune Platform Adaptation

```json
// config/agents.json
{
  "platforms": {
    "linkedin": {
      "tone": "professional",
      "max_chars": 3000,
      "hashtags": 3,
      "emoji": "minimal (1-2 max)",
      "cta_style": "soft (learn more, read article)",
      "include_link": true
    },
    "twitter": {
      "tone": "concise, punchy, engaging",
      "max_chars": 280,
      "hashtags": 2,
      "emoji": "moderate (2-3)",
      "cta_style": "direct (check it out, try now)",
      "include_link": true
    },
    "instagram": {
      "tone": "visual, casual, community",
      "max_chars": 2200,
      "hashtags": 15,
      "emoji": "heavy (5+)",
      "cta_style": "engagement (what do you think? tag a friend)",
      "include_link": false
    },
    "blog": {
      "tone": "informative, detailed, SEO-aware",
      "max_chars": 5000,
      "hashtags": 0,
      "emoji": "none",
      "cta_style": "value (download guide, start free trial)",
      "include_link": true
    }
  },
  "content_calendar": {
    "posts_per_week_per_platform": 3,
    "best_posting_times": {
      "linkedin": ["08:00", "12:00", "17:00"],
      "twitter": ["09:00", "13:00", "18:00"],
      "instagram": ["11:00", "14:00", "19:00"]
    }
  }
}
```

## Step 4: Tune A/B Testing

```json
// config/agents.json
{
  "ab_testing": {
    "enabled": true,
    "variations_to_test": 2,
    "metric": "engagement_rate",
    "min_impressions": 500,
    "test_duration_hours": 48,
    "auto_select_winner": false
  }
}
```

A/B test dimensions:
| Dimension | Test | Metric |
|-----------|------|--------|
| Headlines | 3-5 variations | CTR |
| Images | 2-3 visuals | Engagement rate |
| CTA text | 2 variations | Conversion rate |
| Post timing | 3 time slots | Reach |
| Platform | Multiple adaptations | Platform-specific engagement |

## Step 5: Cost Optimization

```python
# Creative AI Studio cost breakdown per campaign:
# - Text generation (GPT-4o, 3 variations): ~$0.15
# - Image generation (DALL-E 3, 3 images): ~$0.24 (HD)
# - Platform adaptation (GPT-4o-mini, 4 platforms): ~$0.01
# - Content calendar (GPT-4o, 1 generation): ~$0.05
# - Content safety checks: ~$0.01
# - Total per campaign: ~$0.46

# Cost reduction strategies:
# 1. Use gpt-4o-mini for adaptation (save 90% on adaptation)
# 2. DALL-E standard quality (save 50% per image)
# 3. Reduce variations from 5 to 3 (save 40%)
# 4. Cache similar campaign patterns (save 20%)
# 5. Use standard image size 1024x1024 (cheapest DALL-E option)
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| gpt-4o-mini for adaptation | ~90% adapt cost | Slightly less nuanced |
| DALL-E standard quality | ~50% image cost | Lower image detail |
| 3 variations (not 5) | ~40% text cost | Fewer choices |
| Cache campaign patterns | ~20% total | May reuse ideas |
| Batch platform adaptation | ~15% | Slightly higher latency |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_brand.py --test-data evaluation/data/ --judge-model gpt-4o
python evaluation/eval_quality.py --test-data evaluation/data/ --judge-model gpt-4o
python evaluation/eval_diversity.py --test-data evaluation/data/
python evaluation/eval_platform.py --test-data evaluation/data/
python evaluation/eval_images.py --test-data evaluation/data/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Brand tone consistency | baseline | +0.3-0.5 | > 4.0/5.0 |
| Content quality | baseline | +0.2-0.4 | > 4.0/5.0 |
| Variation diversity | baseline | +10-15% | < 0.7 similarity |
| Platform compliance | baseline | +5-10% | 100% char limits |
| Cost per campaign | ~$0.46 | ~$0.25-0.35 | < $0.50 |
