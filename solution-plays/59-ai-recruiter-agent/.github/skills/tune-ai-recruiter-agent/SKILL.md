---
name: "tune-ai-recruiter-agent"
description: "Tune AI Recruiter Agent — scoring weights, PII detection sensitivity, bias thresholds, matching criteria, JD language rules, cost per screening."
---

# Tune AI Recruiter Agent

## Prerequisites

- Deployed recruiter agent with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Scoring Weights

```json
// config/agents.json
{
  "scoring": {
    "weights": {
      "skills": 0.45,
      "experience": 0.35,
      "education": 0.20
    },
    "min_factors": 3,
    "max_factors": 7,
    "threshold_shortlist": 70,
    "threshold_reject": 30,
    "human_review_range": [30, 70]
  },
  "matching": {
    "required_skills_weight": 2.0,
    "preferred_skills_weight": 1.0,
    "years_experience_tolerance": 2,
    "education_flexibility": true
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `skills` weight | 0.45 | Higher = skills matter most (recommended) |
| `experience` weight | 0.35 | Higher = prioritize years of experience |
| `education` weight | 0.20 | Lower for roles where skills > degrees |
| `threshold_shortlist` | 70 | Lower = more candidates pass, more review |
| `years_experience_tolerance` | 2 | Allows ±2 years from requirement |
| `education_flexibility` | true | Accept equivalent experience instead of degree |

### Scoring Weight Tuning Guide
| Role Type | Skills | Experience | Education |
|-----------|--------|------------|----------|
| Engineering | 0.50 | 0.35 | 0.15 |
| Management | 0.30 | 0.50 | 0.20 |
| Entry-level | 0.40 | 0.20 | 0.40 |
| Research | 0.35 | 0.30 | 0.35 |
| Creative | 0.60 | 0.30 | 0.10 |

## Step 2: Tune PII Redaction

```json
// config/guardrails.json
{
  "pii_redaction": {
    "engine": "presidio",
    "entities": ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "URL", "LOCATION", "DATE_TIME"],
    "custom_patterns": [
      { "name": "graduation_year", "regex": "\\b(19|20)\\d{2}\\b", "action": "replace_with_[YEAR]" },
      { "name": "photo_embed", "action": "strip_binary" }
    ],
    "pronoun_neutralization": true,
    "confidence_threshold": 0.5,
    "allow_list": ["Microsoft", "Google", "Amazon", "Azure"]
  }
}
```

PII tuning:
| Symptom | Adjustment |
|---------|------------|
| Company names redacted | Add to allow_list |
| Names missed | Lower confidence_threshold to 0.3 |
| Skills redacted as PII | Add technical terms to allow_list |
| Graduation years visible | Verify graduation_year pattern active |

## Step 3: Tune Fairness

```json
// config/guardrails.json
{
  "fairness": {
    "disparate_impact_threshold": 0.80,
    "protected_attributes": ["gender", "ethnicity", "age_group"],
    "testing_frequency": "weekly",
    "auto_flag_violations": true,
    "paired_testing": true,
    "paired_test_max_score_diff": 5
  },
  "jd_bias_check": {
    "enabled": true,
    "biased_terms_file": "config/biased-terms.json",
    "auto_replace": true,
    "flag_requirement_inflation": true,
    "max_years_requirement": 10
  }
}
```

Fairness tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `disparate_impact_threshold` | 0.80 | EEOC 4/5 rule (non-negotiable) |
| `paired_test_max_score_diff` | 5 points | Lower = stricter bias check |
| `max_years_requirement` | 10 | Flag JDs that require 15+ years |
| `auto_replace` biased terms | true | Automatically fix biased JDs |

## Step 4: Tune Model Configuration

```json
// config/openai.json
{
  "scoring": {
    "model": "gpt-4o",
    "temperature": 0,
    "seed": 42,
    "max_tokens": 1500,
    "response_format": "json_object"
  },
  "jd_generation": {
    "model": "gpt-4o",
    "temperature": 0.5,
    "max_tokens": 2000
  },
  "resume_parsing": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 1000
  }
}
```

Model selection:
| Task | Model | Why |
|------|-------|-----|
| Candidate scoring | gpt-4o (temp=0) | Critical accuracy, deterministic |
| JD generation | gpt-4o (temp=0.5) | Needs some creativity |
| Resume parsing | gpt-4o-mini | Structured extraction, save cost |
| Bias checking | gpt-4o-mini | Pattern matching, simpler |

## Step 5: Cost Optimization

```python
# Recruiter Agent cost per candidate:
# - Resume parsing (Doc Intel + gpt-4o-mini): ~$0.03
# - PII redaction (Presidio, local): $0
# - Candidate scoring (gpt-4o): ~$0.02
# - Total per candidate: ~$0.05
# - JD generation (gpt-4o): ~$0.03 per JD
# - 1000 candidates/month: ~$50

# Cost reduction:
# 1. gpt-4o-mini for resume parsing (already done)
# 2. Batch scoring (50 candidates per batch) = fewer API calls
# 3. Cache job descriptions for identical roles
# 4. Skip scoring for auto-reject (missing required skills)
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| gpt-4o-mini for parsing | ~90% parsing cost | Slightly less accurate extraction |
| Pre-filter before scoring | ~30% total | May miss edge-case candidates |
| Cache JDs | ~50% JD cost | Stale for evolving roles |
| Batch scoring | ~20% | Slight delay |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_matching.py --test-data evaluation/data/
python evaluation/eval_fairness.py --test-data evaluation/data/ --protected-attributes gender,ethnicity,age_group
python evaluation/eval_pii.py --test-data evaluation/data/pii/
python evaluation/eval_explainability.py --test-data evaluation/data/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Matching accuracy | baseline | +5-10% | > 80% |
| Disparate impact | baseline | ≥ 0.80 | > 0.80 |
| PII redaction | baseline | +1-2% | > 99% |
| Cost per candidate | ~$0.05 | ~$0.03 | < $0.10 |
| Protected attr refs | 0 | 0 | 0 (non-negotiable) |
