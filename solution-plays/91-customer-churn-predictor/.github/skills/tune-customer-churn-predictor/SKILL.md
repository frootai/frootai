---
name: "tune-customer-churn-predictor"
description: "Tune Customer Churn Predictor — risk thresholds, feature selection, retention playbooks, scoring frequency, segment strategies, cost optimization."
---

# Tune Customer Churn Predictor

## Prerequisites

- Deployed churn predictor with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Risk Thresholds

```json
// config/guardrails.json — churn risk settings
{
  "churn_risk": {
    "thresholds": {
      "high_risk": 0.70,
      "medium_risk": 0.40,
      "low_risk_below": 0.40
    },
    "action_triggers": {
      "high_risk": "immediate_retention",
      "medium_risk": "monitor_and_nurture",
      "low_risk": "standard_engagement"
    },
    "re_score_frequency": {
      "high_risk": "daily",
      "medium_risk": "weekly",
      "low_risk": "monthly"
    },
    "alert_channels": {
      "high_risk": ["csm_notification", "slack_alert"],
      "medium_risk": ["dashboard_flag"],
      "low_risk": []
    }
  }
}
```

Threshold tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `high_risk` threshold | 0.70 | Lower = more customers flagged (more retention spend) |
| `medium_risk` threshold | 0.40 | Lower = fewer in "monitor" (miss subtle signals) |
| Re-score frequency (high) | daily | More frequent = catch rapid changes, more compute |

### Risk Score Interpretation
| Score Range | Level | Action | Expected Churn Rate |
|------------|-------|--------|-------------------|
| 0.70-1.00 | High | Immediate retention outreach | ~50-70% would churn |
| 0.40-0.69 | Medium | Nurture campaign + monitor | ~20-40% would churn |
| 0.00-0.39 | Low | Standard engagement | ~5-15% would churn |

## Step 2: Tune Feature Engineering

```json
// config/agents.json — feature settings
{
  "features": {
    "usage_lookback_days": 90,
    "engagement_lookback_days": 60,
    "billing_lookback_days": 90,
    "support_lookback_days": 90,
    "trend_comparison_periods": [30, 60, 90],
    "feature_selection": {
      "method": "shap_importance",
      "min_importance": 0.01,
      "max_features": 30,
      "recalculate_frequency": "monthly"
    },
    "derived_features": [
      "login_trend_pct_30d_vs_prior",
      "support_ticket_velocity",
      "nps_trend_direction",
      "contract_months_remaining",
      "feature_adoption_change_rate"
    ]
  }
}
```

Feature tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `usage_lookback_days` | 90 | Shorter = recent behavior only, miss long-term trends |
| `max_features` | 30 | More = risk overfitting, fewer = miss signals |
| `min_importance` | 0.01 | Lower = keep more features, higher = sparse model |

### Top Features by Segment (Typically)
| Rank | Enterprise | SMB | Consumer |
|------|-----------|-----|----------|
| 1 | Contract proximity | Login frequency decline | Usage frequency decline |
| 2 | CSM engagement | Payment delays | Feature adoption % |
| 3 | Support escalations | Feature adoption | NPS score trend |
| 4 | NPS trend | Email engagement | Session duration |
| 5 | Feature adoption | Competitor mentions | Price sensitivity |

## Step 3: Tune Retention Playbooks

```json
// config/agents.json — retention settings
{
  "retention": {
    "playbooks": {
      "high_risk_price_sensitive": {
        "actions": ["discount_20pct", "billing_flexibility", "downgrade_option"],
        "budget_cap": 200,
        "channel": "email_and_call"
      },
      "high_risk_feature_gap": {
        "actions": ["demo_session", "training", "roadmap_preview"],
        "budget_cap": 50,
        "channel": "email_and_in_app"
      },
      "high_risk_support": {
        "actions": ["csm_escalation", "priority_support_30d", "exec_outreach"],
        "budget_cap": 100,
        "channel": "phone_and_email"
      },
      "contract_expiry": {
        "actions": ["early_renewal_discount", "annual_review", "roi_report"],
        "budget_cap": 500,
        "channel": "csm"
      }
    },
    "monthly_budget_total": 10000,
    "max_actions_per_customer_per_month": 2,
    "cooldown_after_action_days": 14,
    "personalize_via_llm": true,
    "ab_test_playbooks": true
  }
}
```

Retention tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `budget_cap` per customer | $50-$500 | Based on customer LTV (higher LTV = higher budget) |
| `max_actions_per_month` | 2 | Higher = more aggressive, risk annoyance |
| `cooldown_after_action_days` | 14 | Shorter = faster follow-up |
| `ab_test_playbooks` | true | Compare playbook effectiveness |

## Step 4: Tune Model Configuration

```json
// config/openai.json
{
  "retention_personalization": {
    "model": "gpt-4o",
    "temperature": 0.5,
    "max_tokens": 300
  },
  "churn_driver_explanation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 200
  },
  "cohort_report": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 800
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Retention personalization | gpt-4o | Customer-facing messaging quality matters |
| Driver explanation | gpt-4o-mini | Internal CSM tool, structured output |
| Cohort report | gpt-4o-mini | Weekly summary, routine |

## Step 5: Cost Optimization

```python
# Customer Churn Predictor cost per month (10K customers):
# ML:
#   - Azure ML training (weekly retrain): ~$25/month
#   - Batch scoring (daily, 10K customers): ~$10/month
# LLM:
#   - Retention messages (gpt-4o, ~200 high-risk × $0.02): ~$4/month
#   - Driver explanations (gpt-4o-mini, ~1000 × $0.001): ~$1/month
# Communication:
#   - Email delivery (Azure Comm Services): ~$5/month
#   - SMS (high-risk only): ~$10/month
# Infrastructure:
#   - Event Hubs: ~$11/month
#   - Container Apps: ~$15/month
#   - Cosmos DB Serverless: ~$10/month
#   - Functions: ~$5/month
# Total: ~$96/month for 10K customers
# ROI: 15% churn reduction × $100 avg MRR × 10K = $150K saved annually

# Cost reduction:
# 1. Score weekly instead of daily (save ~$7/month ML)
# 2. gpt-4o-mini for retention messages (save ~$3.50/month)
# 3. Email only, no SMS (save ~$10/month)
# 4. Shared infrastructure (Event Hubs + Functions): save ~$10/month
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Weekly scoring | ~$7/month | Miss rapid behavior changes |
| gpt-4o-mini messages | ~$3.50/month | Less personalized retention |
| Email only | ~$10/month | Lower response rate vs SMS |
| Shared infra | ~$10/month | Multi-tenant complexity |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_accuracy.py --test-data evaluation/data/holdout/
python evaluation/eval_retention.py --test-data evaluation/data/retention_outcomes/
python evaluation/eval_fairness.py --test-data evaluation/data/demographics/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| AUC-ROC | baseline | > 0.85 | > 0.85 |
| Retention lift | baseline | > 15% | > 15% |
| ROI | baseline | > 3:1 | > 3:1 |
| Calibration | baseline | Brier < 0.15 | < 0.15 |
| Monthly cost | ~$96 | ~$65 | < $120 |
