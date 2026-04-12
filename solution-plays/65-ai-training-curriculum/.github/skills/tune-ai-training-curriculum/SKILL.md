---
name: "tune-ai-training-curriculum"
description: "Tune AI Training Curriculum — role-skill matrix, dependency graph, assessment difficulty, content sources, learning style mapping, completion optimization, cost per learner."
---

# Tune AI Training Curriculum

## Prerequisites

- Deployed training curriculum with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Role-Skill Matrix

```json
// config/agents.json
{
  "roles": {
    "ml-engineer": {
      "skills": { "python-basics": 0.9, "data-structures": 0.8, "ml-fundamentals": 0.9, "deep-learning": 0.8, "mlops": 0.7 },
      "estimated_hours": 120
    },
    "ai-architect": {
      "skills": { "cloud-basics": 0.9, "azure-services": 0.9, "rag-architecture": 0.8, "ml-fundamentals": 0.7 },
      "estimated_hours": 80
    },
    "data-engineer": {
      "skills": { "python-basics": 0.9, "data-structures": 0.9, "cloud-basics": 0.8, "azure-services": 0.8 },
      "estimated_hours": 90
    }
  },
  "learning_styles": {
    "visual": { "format": "video", "providers": ["microsoft-learn-video", "youtube"] },
    "reading": { "format": "article", "providers": ["microsoft-learn-docs", "azure-docs"] },
    "hands-on": { "format": "lab", "providers": ["azure-sandbox", "github-codespaces"] }
  },
  "content_refresh_schedule": "quarterly"
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| Skill target levels | 0.7-0.9 | Higher = more training, more competent |
| Estimated hours | Per role | Affects timeline estimate |
| Content providers | 2-3 per style | More = wider selection |
| Refresh schedule | quarterly | More frequent = fresher, more work |

## Step 2: Tune Assessments

```json
// config/guardrails.json
{
  "assessments": {
    "questions_per_skill": 5,
    "difficulty_mix": { "conceptual": 2, "practical": 2, "scenario": 1 },
    "passing_scores": { "level_1": 0.6, "level_2": 0.7, "level_3": 0.8 },
    "retry_allowed": true,
    "max_retries": 2,
    "cooldown_hours": 24
  },
  "skill_assessment": {
    "pre_test": true,
    "post_test": true,
    "skip_if_passed_pre": true
  }
}
```

Assessment tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `questions_per_skill` | 5 | More = more accurate, longer test |
| `passing_scores` level 3 | 0.8 | Higher = harder to pass advanced |
| `skip_if_passed_pre` | true | Skip modules learner already knows |
| `max_retries` | 2 | More = forgiving, may mask gaps |
| `cooldown_hours` | 24 | Prevents brute-force memorization |

## Step 3: Tune Content Generation

```json
// config/openai.json
{
  "content_generation": {
    "model": "gpt-4o",
    "temperature": 0.4,
    "max_tokens": 2000,
    "require_sme_review": true
  },
  "assessment_generation": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 1000
  },
  "path_generation": {
    "model": "gpt-4o-mini",
    "temperature": 0.1
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Content generation | gpt-4o | Quality critical for learning material |
| Assessment creation | gpt-4o | Must be accurate, well-calibrated |
| Path generation | gpt-4o-mini | Algorithmic, doesn't need full model |
| Progress analysis | gpt-4o-mini | Data summarization |

## Step 4: Tune Completion Optimization

```json
// config/agents.json
{
  "completion": {
    "nudge_after_inactive_days": 3,
    "reminder_channels": ["email", "teams"],
    "gamification": {
      "badges": true,
      "leaderboard": true,
      "streak_tracking": true
    },
    "microlearning": {
      "enabled": true,
      "max_session_minutes": 15,
      "break_long_modules": true
    }
  }
}
```

Completion tuning:
| Symptom | Adjustment |
|---------|------------|
| Drop-off at module 3 | Break into shorter sessions (microlearning) |
| Low completion rate (<70%) | Add gamification, nudge reminders |
| Assessments too hard | Lower passing_scores by 0.1 |
| Content too long | Enable microlearning (15 min max) |
| Learners skip pre-tests | Make pre-test mandatory, incentivize |

## Step 5: Cost Optimization

```python
# Training Curriculum cost per learner:
# - Path generation (gpt-4o-mini): ~$0.005
# - Pre-test assessment (gpt-4o): ~$0.02
# - Content generation (if needed, gpt-4o): ~$0.05/module
# - Post-test assessment: ~$0.02
# - Progress tracking (Cosmos DB): ~$0.001
# - Total per learner (10-module path): ~$0.60
# - 100 learners/month: ~$60 + $60 infra = ~$120/month

# Cost reduction:
# 1. Use pre-built Microsoft Learn content (save content gen cost)
# 2. gpt-4o-mini for path generation (already done)
# 3. Cache assessments for same skill/level (save 80%)
# 4. Cosmos DB serverless for small orgs
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| Pre-built content | ~80% content cost | Less customized |
| Cache assessments | ~80% assessment cost | Same questions for all |
| Cosmos serverless | ~60% DB cost | Variable throughput |
| Skip pre-test for new learners | ~50% assessment | Less accurate gap analysis |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_paths.py --test-data evaluation/data/learners/
python evaluation/eval_assessments.py --test-data evaluation/data/assessments/
python evaluation/eval_outcomes.py
python evaluation/eval_content.py --test-data evaluation/data/content/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Completion rate | baseline | +10-15% | > 70% |
| Skill gain | baseline | +5-10% | > 30% |
| Assessment validity | baseline | +5% | > 90% |
| Learner satisfaction | baseline | +0.3-0.5 | > 4.0/5.0 |
| Cost per learner | ~$0.60 | ~$0.20 | < $1.00 |
