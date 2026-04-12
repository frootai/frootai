---
name: "tune-responsible-ai-dashboard"
description: "Tune Responsible AI Dashboard — monitoring cadence, fairness thresholds, alert rules, compliance frameworks, executive summary style, incident severity classification."
---

# Tune Responsible AI Dashboard

## Prerequisites

- Deployed RAI dashboard with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Monitoring Cadence

```json
// config/agents.json
{
  "monitoring": {
    "default_cadence": "weekly",
    "cadence_by_risk": {
      "high": "weekly",
      "medium": "bi-weekly",
      "low": "monthly"
    },
    "real_time_alerts": true,
    "batch_collection_time": "02:00 UTC",
    "retention_months": 24
  },
  "system_registry": {
    "auto_discover": true,
    "require_model_card": true,
    "require_owner": true,
    "risk_classification": "eu_ai_act"
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `default_cadence` | weekly | More frequent = earlier detection, higher cost |
| High-risk cadence | weekly | Non-negotiable for EU AI Act high-risk |
| `real_time_alerts` | true | false = batch-only (delayed detection) |
| `retention_months` | 24 | Longer = better trend analysis |
| `require_model_card` | true | false = allow unregistered systems (not recommended) |

## Step 2: Tune Fairness Thresholds

```json
// config/guardrails.json
{
  "fairness": {
    "demographic_parity_max_diff": 0.1,
    "equalized_odds_max_diff": 0.1,
    "disparate_impact_min_ratio": 0.80,
    "calibration_slope_range": [0.9, 1.1],
    "intersectional_min_ratio": 0.75,
    "protected_attributes": ["gender", "age_group", "ethnicity", "disability_status"],
    "alert_on_violation": true,
    "auto_flag_for_review": true
  }
}
```

Fairness tuning guide:
| Threshold | Default | When to Adjust |
|-----------|---------|----------------|
| `demographic_parity_max_diff` | 0.1 | Lower for hiring (EEOC), higher for internal tools |
| `disparate_impact_min_ratio` | 0.80 | EEOC 4/5 rule (non-negotiable for hiring) |
| `intersectional_min_ratio` | 0.75 | Higher for high-risk (EU AI Act Art. 10) |
| Protected attributes | 4 | Add: religion, nationality for global systems |

## Step 3: Tune Alert Rules

```json
// config/guardrails.json
{
  "alerts": {
    "fairness_violation": { "severity": "high", "channels": ["teams", "email"] },
    "critical_incident": { "severity": "critical", "channels": ["pagerduty", "teams", "email"] },
    "compliance_gap": { "severity": "medium", "channels": ["email"] },
    "model_card_missing": { "severity": "medium", "channels": ["teams"] },
    "metrics_stale": { "severity": "low", "channels": ["email"], "stale_days": 14 }
  },
  "escalation": {
    "unresolved_critical_hours": 4,
    "unresolved_high_days": 3,
    "escalation_chain": ["rai_lead", "cto", "legal"]
  }
}
```

Alert tuning:
| Symptom | Adjustment |
|---------|------------|
| Too many alerts (fatigue) | Raise stale_days, batch low-severity |
| Critical incidents missed | Add pagerduty to all high + critical |
| Compliance gaps not addressed | Reduce unresolved threshold to 2 days |
| No escalation | Configure escalation_chain |

## Step 4: Tune Compliance Frameworks

```json
// config/agents.json
{
  "compliance": {
    "frameworks": {
      "eu_ai_act": {
        "enabled": true,
        "risk_levels": ["unacceptable", "high", "limited", "minimal"],
        "evidence": ["risk_assessment", "transparency_report", "human_oversight_log", "technical_doc", "data_governance"]
      },
      "eeoc": {
        "enabled": true,
        "evidence": ["disparate_impact_test", "adverse_action_log", "bias_audit"]
      },
      "nist_ai_rmf": {
        "enabled": true,
        "evidence": ["governance_doc", "risk_profile", "metrics_log", "incident_log"]
      }
    },
    "auto_assess_schedule": "monthly",
    "gap_remediation_sla_days": 30
  }
}
```

## Step 5: Tune Executive Summary

```json
// config/openai.json
{
  "executive_summary": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 1500,
    "format": "traffic_light",
    "audience": "C-suite, non-technical",
    "include_recommendations": true,
    "max_length": "1 page"
  },
  "incident_analysis": {
    "model": "gpt-4o-mini",
    "temperature": 0.1
  }
}
```

## Step 6: Cost Optimization

```python
# RAI Dashboard cost breakdown:
# - Cosmos DB (system registry + incidents): ~$25/month
# - App Insights queries: ~$10/month
# - LLM summaries (gpt-4o, weekly): ~$5/month
# - Static Web Apps: ~$10/month
# - Container Apps: ~$30/month
# - Total: ~$80/month for org-wide RAI monitoring

# Cost reduction:
# 1. gpt-4o-mini for incident analysis (save 90%)
# 2. Monthly summaries instead of weekly (save 75%)
# 3. Cosmos DB serverless for small orgs (save 60%)
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| gpt-4o-mini for analysis | ~90% LLM cost | Less nuanced analysis |
| Monthly cadence (low-risk) | ~75% per system | Slower detection |
| Cosmos DB serverless | ~60% DB cost | Limited throughput |
| Static Web Apps free tier | ~$10/month | Custom domain costs extra |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_fairness_coverage.py --dashboard-endpoint $DASHBOARD_ENDPOINT
python evaluation/eval_incidents.py --dashboard-endpoint $DASHBOARD_ENDPOINT
python evaluation/eval_compliance.py --dashboard-endpoint $DASHBOARD_ENDPOINT
python evaluation/eval_summary.py --dashboard-endpoint $DASHBOARD_ENDPOINT --judge-model gpt-4o

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Systems monitored | baseline | 100% | 100% |
| Fairness metrics complete | baseline | 100% | 100% |
| Compliance evidence | baseline | +10-20% | > 90% |
| Summary readability | baseline | +0.5 | > 4.0/5.0 |
| Monthly cost | ~$80 | ~$50 | < $100 |
