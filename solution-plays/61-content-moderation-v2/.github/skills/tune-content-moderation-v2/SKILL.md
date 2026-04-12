---
name: "tune-content-moderation-v2"
description: "Tune Content Moderation V2 — per-category severity thresholds, custom blocklists, review queue routing, appeal workflow, video sampling rate, latency optimization."
---

# Tune Content Moderation V2

## Prerequisites

- Deployed moderation pipeline with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Per-Category Severity Thresholds

```json
// config/guardrails.json
{
  "thresholds": {
    "auto_block": 6,
    "human_review": 4,
    "flag": 2,
    "per_category": {
      "violence": { "auto_block": 4, "review": 2 },
      "hate": { "auto_block": 4, "review": 2 },
      "sexual": { "auto_block": 4, "review": 2 },
      "self_harm": { "auto_block": 2, "review": 1 }
    }
  },
  "multi_modal": {
    "aggregation": "worst_wins",
    "require_all_modalities": false,
    "video_sample_rate": 1
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `auto_block` (global) | 6 | Lower = more aggressive blocking, more false positives |
| `self_harm.auto_block` | 2 | Very low — self-harm detection must be aggressive |
| `violence.auto_block` | 4 | Moderate — context matters (news, education) |
| `video_sample_rate` | 1/sec | Higher = more frames checked, higher cost |
| `aggregation` | worst_wins | "average" for less aggressive multi-modal |

### Threshold Tuning Guide
| Symptom | Adjustment |
|---------|------------|
| Too many false positives (>3%) | Raise thresholds by 1 for affected category |
| Dangerous content getting through | Lower auto_block to 4 for that category |
| Queue overwhelmed | Raise human_review threshold to 5 |
| Self-harm missed | self_harm thresholds should be lowest (1-2) |
| Video processing too slow | Reduce video_sample_rate to 0.5 |

## Step 2: Tune Custom Blocklists

```json
// config/agents.json
{
  "custom_categories": {
    "blocklists": [
      { "name": "brand-safety", "terms_count": 500, "enabled": true },
      { "name": "competitor-mentions", "terms_count": 50, "enabled": true },
      { "name": "internal-terms", "terms_count": 100, "enabled": true }
    ],
    "halt_on_hit": true,
    "case_sensitive": false,
    "update_frequency": "weekly"
  }
}
```

Blocklist tuning:
| Symptom | Adjustment |
|---------|------------|
| Legitimate content blocked | Review blocklist, add exceptions |
| Violations not caught | Add term variants (plural, misspellings) |
| Too many blocklists | Merge similar, reduce to <5 active |

## Step 3: Tune Review Queue

```json
// config/agents.json
{
  "review_queue": {
    "routing": {
      "self_harm": { "priority": "critical", "sla_minutes": 15 },
      "violence": { "priority": "high", "sla_minutes": 60 },
      "hate": { "priority": "high", "sla_minutes": 60 },
      "sexual": { "priority": "normal", "sla_minutes": 240 }
    },
    "max_queue_size": 500,
    "overflow_action": "auto_block",
    "reviewer_assignment": "round_robin"
  },
  "appeal": {
    "enabled": true,
    "window_hours": 72,
    "require_different_reviewer": true,
    "max_appeals_per_user": 3
  }
}
```

Review tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| Self-harm SLA | 15 minutes | Non-negotiable — safety critical |
| `overflow_action` | auto_block | "auto_allow" is risky but reduces queue |
| `require_different_reviewer` | true | Prevents bias in appeal review |
| `max_appeals_per_user` | 3 | Prevents abuse of appeal system |

## Step 4: Tune LLM for Borderline Cases

```json
// config/openai.json
{
  "borderline_analysis": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 500,
    "system_prompt": "Analyze this content for safety. Consider cultural context, intent, and audience. Return: {safe: bool, reasoning: string, suggested_action: string}"
  },
  "explanation_generation": {
    "model": "gpt-4o-mini",
    "temperature": 0.1,
    "max_tokens": 200
  }
}
```

LLM usage:
| Task | Model | When Used |
|------|-------|----------|
| Borderline analysis | gpt-4o | Severity 3-5 (uncertain zone) |
| Explanation to user | gpt-4o-mini | On block/flag actions |
| Cultural context | gpt-4o | Non-English content |
| Appeal analysis | gpt-4o | During appeal review |

## Step 5: Cost Optimization

```python
# Content Moderation V2 cost breakdown:
# - Content Safety API: ~$1.50/1K text calls, ~$1.50/1K image calls
# - Video: ~$1.50/1K frames (at 1fps, 60s video = 60 frames = $0.09)
# - LLM borderline (gpt-4o, ~5% of content): ~$0.01/analysis
# - Explanation (gpt-4o-mini): ~$0.001/explanation
# - Service Bus queue: ~$0.01/1K messages
# - Total for 100K posts/day: ~$250/day

# Cost reduction:
# 1. Reduce video sample rate to 0.5fps (save 50% video cost)
# 2. gpt-4o-mini for all explanations (already done)
# 3. Skip LLM for clear-cut cases (severity 0-1 or 6+)
# 4. Batch moderation for non-real-time content
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| Lower video sample rate | ~50% video | May miss brief violations |
| Skip LLM for clear cases | ~80% LLM | Less nuanced for edge cases |
| Batch (non-realtime) | ~30% API | Higher latency |
| Cache repeat content hash | ~20% | Miss edits to same content |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_accuracy.py --test-data evaluation/data/
python evaluation/eval_modality.py --test-data evaluation/data/
python evaluation/eval_review_queue.py
python evaluation/eval_custom.py --test-data evaluation/data/custom/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| False positive rate | baseline | -1-2% | < 3% |
| Self-harm recall | baseline | +2-3% | > 98% |
| Text latency | baseline | -20% | < 200ms |
| Queue wait time | baseline | -30% | < 1 hour |
| Cost per 100K posts | ~$250 | ~$150 | < $300 |
