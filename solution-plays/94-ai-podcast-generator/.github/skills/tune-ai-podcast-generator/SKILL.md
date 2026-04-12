---
name: "tune-ai-podcast-generator"
description: "Tune AI Podcast Generator — script style, voice assignments, SSML prosody, audio production, publishing config, cost per episode."
---

# Tune AI Podcast Generator

## Prerequisites

- Deployed podcast generator with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Script Generation

```json
// config/agents.json — script settings
{
  "script": {
    "default_format": "interview",
    "words_per_minute": 150,
    "conversational_markers": true,
    "markers": ["um", "right?", "that's interesting", "exactly", "so basically"],
    "marker_frequency_pct": 3,
    "source_citation_required": true,
    "min_sources": 3,
    "hook_max_seconds": 30,
    "takeaway_required": true,
    "humor_level": "light",
    "disagreement_required": true,
    "max_monologue_sentences": 5
  }
}
```

Script tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `words_per_minute` | 150 | Lower = slower speech, longer audio for same script |
| `marker_frequency_pct` | 3% | Higher = more natural, risk over-use |
| `humor_level` | light | "none" for serious topics, "moderate" for entertainment |
| `max_monologue_sentences` | 5 | Lower = more back-and-forth, shorter speaker turns |
| `disagreement_required` | true | Creates tension and listener interest |

### Format Templates
| Format | Speakers | Duration | Best For |
|--------|---------|----------|---------|
| Interview | Host + Expert | 15-20 min | Educational, deep-dive |
| Monologue | Host only | 8-12 min | Opinion, storytelling |
| Debate | Moderator + Pro + Con | 20-30 min | Controversial topics |
| Panel | Host + 3 Panelists | 25-35 min | Industry roundtable |

## Step 2: Tune Voice Assignments

```json
// config/agents.json — voice settings
{
  "voices": {
    "default_assignments": {
      "Host": "en-US-GuyNeural",
      "Expert": "en-US-AriaNeural",
      "Narrator": "en-US-BrandonNeural"
    },
    "voice_catalog": {
      "en-US-GuyNeural": {"style": "friendly", "pitch": "+0%", "rate": "+5%"},
      "en-US-JennyNeural": {"style": "cheerful", "pitch": "+0%", "rate": "+0%"},
      "en-US-AriaNeural": {"style": "professional", "pitch": "-5%", "rate": "+0%"},
      "en-US-DavisNeural": {"style": "authoritative", "pitch": "-10%", "rate": "-5%"},
      "en-US-JasonNeural": {"style": "casual", "pitch": "+0%", "rate": "+10%"}
    },
    "ssml_defaults": {
      "express_as": "chat",
      "rate_variation_pct": 10,
      "pitch_variation_pct": 5,
      "pause_between_speakers_ms": 800
    }
  }
}
```

Voice tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `rate` per voice | ±5% | Faster = energetic, slower = thoughtful |
| `pitch` per voice | ±5% | Different pitch = easier to distinguish speakers |
| `express_as` | chat | Options: chat, newscast, customerservice, friendly |
| `pause_between_speakers_ms` | 800 | Shorter = rapid conversation, longer = deliberate |

## Step 3: Tune Audio Production

```json
// config/guardrails.json — production settings
{
  "production": {
    "loudness_target_lufs": -16,
    "loudness_tolerance_lufs": 1,
    "intro_music_duration_sec": 15,
    "outro_music_duration_sec": 20,
    "intro_fade_in_ms": 3000,
    "outro_fade_out_ms": 5000,
    "crossfade_between_speakers_ms": 100,
    "transition_sound_duration_ms": 500,
    "output_format": "mp3",
    "output_bitrate": "320k",
    "sample_rate": 44100,
    "channels": "mono"
  }
}
```

Production tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `loudness_target_lufs` | -16 | Industry standard for podcasts |
| `output_bitrate` | 320k | 128k = smaller files, 320k = best quality |
| `channels` | mono | Stereo only if spatial audio (speakers in different channels) |
| `crossfade_between_speakers_ms` | 100 | Higher = smoother but may cut words |

## Step 4: Tune Publishing

```json
// config/agents.json — publishing settings
{
  "publishing": {
    "auto_publish": false,
    "review_before_publish": true,
    "rss_feed": {
      "title": "Your Podcast Name",
      "description": "AI-generated podcast about...",
      "language": "en",
      "category": "Technology",
      "explicit": false,
      "image_url": "https://..."
    },
    "transcript": {
      "generate": true,
      "format": ["srt", "txt"],
      "include_timestamps": true
    },
    "cdn_cache_hours": 24
  }
}
```

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "script_generation": {
    "model": "gpt-4o",
    "temperature": 0.7,
    "max_tokens": 4000
  },
  "research": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 1000
  },
  "content_review": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 500
  }
}
```

| Task | Model | Temperature | Why |
|------|-------|-------------|-----|
| Script generation | gpt-4o | 0.7 | Creative, conversational writing |
| Research/sourcing | gpt-4o-mini | 0.2 | Factual, grounded in sources |
| Content review | gpt-4o-mini | 0 | Deterministic safety check |

## Step 6: Cost Optimization

```python
# AI Podcast Generator cost per episode (20 min):
# Script:
#   - Research (gpt-4o-mini): ~$0.05
#   - Script generation (gpt-4o, ~3000 words): ~$0.15
#   - Content review (gpt-4o-mini): ~$0.01
# TTS:
#   - Azure Speech Neural (3000 words ≈ 18K chars): ~$2.88 at $16/1M chars
# Audio:
#   - Post-processing compute: ~$0.01
#   - Storage (50MB MP3): ~$0.001/month
#   - CDN delivery: ~$0.01/100 downloads
# Infrastructure:
#   - Container Apps: ~$15/month
#   - AI Search Basic: ~$75/month
# Total per episode: ~$3.10
# Monthly (4 episodes): ~$102/month

# Cost reduction:
# 1. Standard voices instead of Neural: save ~80% TTS ($0.58 vs $2.88)
# 2. gpt-4o-mini for script generation: save ~$0.12/episode (lower quality)
# 3. Shorter episodes (10 min): save ~50% TTS
# 4. Skip AI Search (no research): save $75/month (less grounded)
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Standard TTS voices | ~$2.30/episode | Noticeably less natural |
| gpt-4o-mini scripts | ~$0.12/episode | Less creative dialogue |
| Shorter episodes | ~50% TTS | Less content per episode |
| Skip research | ~$75/month | Ungrounded claims |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_script.py --test-data evaluation/data/scripts/
python evaluation/eval_audio.py --test-data evaluation/data/episodes/
python evaluation/eval_safety.py --test-data evaluation/data/scripts/
python evaluation/eval_publishing.py --test-data evaluation/data/published/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Conversational tone | baseline | > 4.0/5.0 | > 4.0/5.0 |
| Voice naturalness | baseline | > 3.5/5.0 | > 3.5/5.0 |
| Loudness compliance | baseline | -16 ± 1 LUFS | -16 ± 1 |
| Source citation | baseline | > 90% | > 90% |
| Cost per episode | ~$3.10 | ~$1.50 | < $5.00 |
