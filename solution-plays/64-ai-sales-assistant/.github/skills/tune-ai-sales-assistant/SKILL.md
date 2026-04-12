---
name: "tune-ai-sales-assistant"
description: "Tune AI Sales Assistant — scoring weights, ICP definition, email temperature, talk track depth, competitive intel refresh, CRM sync, cost per lead."
---

# Tune AI Sales Assistant

## Prerequisites

- Deployed sales assistant with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Lead Scoring Weights

```json
// config/agents.json
{
  "scoring": {
    "weights": {
      "company_fit": 0.35,
      "engagement": 0.30,
      "timing": 0.20,
      "deal_history": 0.15
    },
    "temperature_thresholds": {
      "hot": 80,
      "warm": 50,
      "cold": 0
    },
    "icp": {
      "target_industries": ["technology", "finance", "healthcare"],
      "min_employees": 100,
      "min_revenue": 10000000,
      "target_titles": ["CTO", "VP Engineering", "Director"]
    },
    "action_map": {
      "hot": "schedule_demo",
      "warm": "send_case_study",
      "cold": "nurture_sequence"
    }
  }
}
```

Scoring tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `company_fit` weight | 0.35 | Higher = ICP matters more |
| `engagement` weight | 0.30 | Higher = behavioral signals matter more |
| `hot` threshold | 80 | Lower = more leads flagged as hot |
| ICP industries | 3 | Add/remove based on win data |
| `min_employees` | 100 | Lower for SMB, higher for enterprise |

### Weight Tuning Guide
| Symptom | Adjustment |
|---------|------------|
| Hot leads not converting | Increase engagement weight, add deal_history |
| Missing qualified leads | Lower hot threshold to 70 |
| Too many hot leads | Raise threshold to 85, increase company_fit weight |
| Wrong industry targeting | Update ICP target_industries from recent wins |

## Step 2: Tune Email Generation

```json
// config/openai.json
{
  "email_generation": {
    "model": "gpt-4o",
    "temperature": 0.5,
    "max_tokens": 300,
    "max_word_count": 150,
    "tone": "professional_friendly",
    "require_cta": true,
    "auto_send": false
  },
  "talk_track": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 500
  },
  "competitive_intel": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "refresh_days": 30
  }
}
```

Email tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `temperature` | 0.5 | Higher = more creative but less consistent |
| `max_word_count` | 150 | Shorter = higher response rates |
| `tone` | professional_friendly | "casual" for startups, "formal" for enterprise |
| `auto_send` | false | **ALWAYS false** — rep reviews first |

### Email Tone by Persona
| Persona | Recommended Tone | Temperature |
|---------|-----------------|------------|
| C-suite | formal, concise | 0.3 |
| VP/Director | professional_friendly | 0.5 |
| Manager | conversational | 0.6 |
| Developer | technical, direct | 0.4 |

## Step 3: Tune CRM Integration

```json
// config/agents.json
{
  "crm": {
    "type": "salesforce",
    "sync_interval_minutes": 15,
    "fields_to_sync": ["name", "title", "company", "industry", "employees", "revenue", "last_activity"],
    "activity_lookback_days": 90,
    "deal_history_lookback_months": 24
  },
  "competitive_intel": {
    "track_competitors": ["competitor-a", "competitor-b", "competitor-c"],
    "refresh_schedule": "monthly",
    "win_loss_lookback_months": 12
  }
}
```

CRM tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `sync_interval_minutes` | 15 | Lower = fresher data, more API calls |
| `activity_lookback_days` | 90 | Shorter = recent engagement only |
| `deal_history_lookback_months` | 24 | Longer = better historical patterns |

## Step 4: Cost Optimization

```python
# Sales Assistant cost per lead:
# - CRM API call: ~$0 (within API limits)
# - Lead scoring (gpt-4o): ~$0.02/lead
# - Talk track (gpt-4o): ~$0.02/lead
# - Email draft (gpt-4o): ~$0.02/email
# - Competitive intel (gpt-4o-mini): ~$0.002/query
# - Total per lead: ~$0.06
# - 500 leads/month: ~$30/month + $30 infra = ~$60/month

# Cost reduction:
# 1. gpt-4o-mini for scoring (save 90%) — if accuracy sufficient
# 2. Cache competitive battle cards (save 80% intel cost)
# 3. Batch scoring (50 leads at once) = fewer API calls
# 4. Only generate talk track for warm+ leads
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| gpt-4o-mini for scoring | ~90% scoring | Slightly less nuanced |
| Cache battle cards | ~80% intel | Stale after 30 days |
| Talk tracks warm+ only | ~40% total | Cold leads less prepared |
| Batch scoring | ~20% | Slight delay |

## Step 5: Verify Tuning Impact

```bash
python evaluation/eval_scoring.py --test-data evaluation/data/leads/
python evaluation/eval_emails.py --test-data evaluation/data/emails/ --judge-model gpt-4o
python evaluation/eval_intel.py --test-data evaluation/data/competitors/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Score-to-close | baseline | +0.1-0.15 | > 0.6 |
| Email response rate | baseline | +3-5% | > 15% |
| Talk track relevance | baseline | +0.3-0.5 | > 4.0/5.0 |
| Cost per lead | ~$0.06 | ~$0.03 | < $0.10 |
