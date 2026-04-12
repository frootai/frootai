---
name: "tune-exam-generation-engine"
description: "Tune Exam Generation Engine — Bloom's distribution, distractor quality, difficulty calibration, question type mix, IRT parameters, cost optimization."
---

# Tune Exam Generation Engine

## Prerequisites

- Deployed exam engine with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Bloom's Distribution

```json
// config/guardrails.json — Bloom's taxonomy settings
{
  "blooms_distribution": {
    "remember": {"min": 0.10, "max": 0.20, "target": 0.15},
    "understand": {"min": 0.20, "max": 0.30, "target": 0.25},
    "apply": {"min": 0.25, "max": 0.30, "target": 0.30},
    "analyze": {"min": 0.15, "max": 0.20, "target": 0.20},
    "evaluate": {"min": 0.05, "max": 0.10, "target": 0.07},
    "create": {"min": 0.03, "max": 0.10, "target": 0.03}
  },
  "bloom_classifier": {
    "model": "gpt-4o-mini",
    "validate_after_generation": true,
    "reject_misaligned": true
  }
}
```

Bloom's tuning by context:
| Context | Remember | Understand | Apply | Analyze | Evaluate | Create |
|---------|----------|-----------|-------|---------|----------|--------|
| High school quiz | 25% | 30% | 25% | 15% | 5% | 0% |
| University midterm | 10% | 20% | 35% | 25% | 7% | 3% |
| Professional cert | 5% | 15% | 35% | 30% | 10% | 5% |
| Graduate exam | 5% | 10% | 25% | 30% | 20% | 10% |

## Step 2: Tune Distractor Generation

```json
// config/guardrails.json — distractor settings
{
  "distractors": {
    "count": 3,
    "length_tolerance_pct": 20,
    "plausibility_threshold": 3.5,
    "misconception_grounded": true,
    "avoid_patterns": [
      "all_of_the_above", "none_of_the_above",
      "obviously_wrong", "humorous"
    ],
    "position_randomization": true,
    "common_misconceptions_db": "data/misconceptions/{subject}.json"
  }
}
```

Distractor tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `count` | 3 | More = harder MCQ, more generation cost |
| `length_tolerance_pct` | 20% | Tighter = harder for test-taking tricks |
| `plausibility_threshold` | 3.5/5.0 | Higher = better distractors, more regeneration |
| `misconception_grounded` | true | false = faster generation, less educational value |

### Distractor Quality Levels
| Level | Description | Action |
|-------|------------|--------|
| 5.0 | Expert-level: indistinguishable from correct without full knowledge | Accept |
| 4.0-4.9 | Strong: plausible, based on real misconception | Accept |
| 3.5-3.9 | Adequate: reasonable but slightly detectable | Accept (borderline) |
| 2.0-3.4 | Weak: somewhat obviously wrong | Regenerate |
| < 2.0 | Poor: trivially wrong | Reject + regenerate |

## Step 3: Tune Question Type Mix

```json
// config/agents.json — question type settings
{
  "question_types": {
    "mcq": {
      "weight": 0.50,
      "options_count": 4,
      "time_minutes": 1.5,
      "points": 1
    },
    "short_answer": {
      "weight": 0.25,
      "max_words": 100,
      "time_minutes": 3,
      "points": 3,
      "rubric_auto_generate": true
    },
    "essay": {
      "weight": 0.15,
      "max_words": 500,
      "time_minutes": 15,
      "points": 10,
      "rubric_criteria": 4
    },
    "true_false": {
      "weight": 0.10,
      "require_explanation": true,
      "time_minutes": 1,
      "points": 1
    }
  },
  "total_time_minutes": 60,
  "total_points": 100
}
```

Question type mix by exam type:
| Exam Type | MCQ | Short Answer | Essay | True/False |
|-----------|-----|-------------|-------|-----------|
| Quiz (15 min) | 80% | 10% | 0% | 10% |
| Midterm (60 min) | 50% | 25% | 15% | 10% |
| Final (120 min) | 40% | 20% | 30% | 10% |
| Certification | 70% | 20% | 0% | 10% |

## Step 4: Tune Difficulty Calibration

```json
// config/guardrails.json — difficulty settings
{
  "difficulty": {
    "target_mean_score_pct": 70,
    "target_std_dev_pct": 15,
    "difficulty_distribution": {
      "easy": {"pct": 0.30, "target_correct_rate": 0.85},
      "medium": {"pct": 0.45, "target_correct_rate": 0.65},
      "hard": {"pct": 0.25, "target_correct_rate": 0.40}
    },
    "irt_calibration_after_n_responses": 50,
    "item_bank_min_size": 200,
    "retire_after_n_uses": 10
  }
}
```

Difficulty tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `target_mean_score_pct` | 70% | Higher = easier exam, lower = harder |
| Easy/Medium/Hard split | 30/45/25 | Adjust for target population |
| `irt_calibration_after_n_responses` | 50 | Lower = calibrate sooner (less accurate) |
| `retire_after_n_uses` | 10 | Lower = fresher items, higher = less generation cost |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "question_generation": {
    "model": "gpt-4o",
    "temperature": 0.5,
    "max_tokens": 500
  },
  "distractor_generation": {
    "model": "gpt-4o",
    "temperature": 0.6,
    "max_tokens": 300
  },
  "bloom_classification": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 50
  },
  "rubric_generation": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 500
  },
  "quality_validation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 200
  }
}
```

| Task | Model | Temperature | Why |
|------|-------|-------------|-----|
| Question generation | gpt-4o | 0.5 | Creative but grounded |
| Distractor generation | gpt-4o | 0.6 | Slightly more creative for plausibility |
| Bloom's classification | gpt-4o-mini | 0 | Deterministic classification |
| Rubric generation | gpt-4o | 0.3 | Structured but quality output |
| Quality validation | gpt-4o-mini | 0 | Fast validation pass |

## Step 6: Cost Optimization

```python
# Exam Generation Engine cost per exam (30 questions):
# - Question generation (gpt-4o, 30 × $0.02): ~$0.60
# - Distractor generation (gpt-4o, 15 MCQs × $0.015): ~$0.22
# - Bloom's classification (gpt-4o-mini, 30 × $0.001): ~$0.03
# - Rubric generation (gpt-4o, 10 essay/short × $0.02): ~$0.20
# - Quality validation (gpt-4o-mini, 30 × $0.001): ~$0.03
# - Doc Intelligence (material extraction): ~$0.01/page
# - AI Search (retrieval): ~$0.01
# - Total per exam: ~$1.10
# - Infrastructure: Container Apps (~$15) + Cosmos DB (~$5) + Search Basic (~$75)
# - 100 exams/month: ~$205/month

# Cost reduction:
# 1. Cache frequently used material chunks (save Search + retrieval cost)
# 2. gpt-4o-mini for question generation (save 90% LLM, lower quality)
# 3. Item bank reuse: generate once, use 10 times (save 90% per exam)
# 4. Batch generation (10 questions per API call instead of 1)
# 5. Free tier Search if <10K items
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Item bank reuse | ~90% generation cost | Items become known after multiple uses |
| Batch generation | ~50% API calls | Less per-question tuning |
| gpt-4o-mini for questions | ~$0.54/exam | Lower question quality |
| Cache materials | ~$0.01/exam | Stale if materials updated |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_question_quality.py --test-data evaluation/data/questions/
python evaluation/eval_distractors.py --test-data evaluation/data/mcq/
python evaluation/eval_blooms.py --test-data evaluation/data/exams/
python evaluation/eval_bias.py --test-data evaluation/data/questions/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Answer accuracy | baseline | > 95% | > 95% |
| Bloom's alignment | baseline | > 85% | > 85% |
| Distractor plausibility | baseline | > 3.5/5.0 | > 3.5/5.0 |
| Groundedness | baseline | > 0.90 | > 0.90 |
| Cost per exam | ~$1.10 | ~$0.50 | < $1.50 |
