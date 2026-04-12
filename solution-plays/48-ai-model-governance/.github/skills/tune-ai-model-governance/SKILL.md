---
name: "tune-ai-model-governance"
description: "Tune AI Model Governance — eval gate thresholds, A/B test duration and split, drift detection sensitivity, progressive rollout speed, approval workflow SLA."
---

# Tune AI Model Governance

## Prerequisites

- Deployed governance pipeline with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-ai-model-governance` skill

## Step 1: Tune Eval Gate Thresholds

### Automated Evaluation Configuration
```json
// config/guardrails.json
{
  "eval_gate": {
    "min_accuracy": 0.85,
    "min_f1": 0.82,
    "min_precision": 0.80,
    "min_recall": 0.80,
    "max_latency_p95_ms": 3000,
    "min_test_cases": 100,
    "comparison_to_champion": {
      "require_improvement": false,
      "max_regression": 0.02
    }
  },
  "bias_testing": {
    "protected_attributes": ["gender", "age_group", "ethnicity", "region"],
    "max_disparity_ratio": 0.8,
    "min_group_size": 50,
    "significance_level": 0.05
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `min_accuracy` | 0.85 | Lower = more models pass, higher bar = fewer |
| `min_f1` | 0.82 | Balance between precision and recall |
| `max_regression` | 0.02 | How much worse than champion allowed |
| `max_disparity_ratio` | 0.8 | Lower = stricter fairness requirement |
| `min_test_cases` | 100 | More = more reliable eval, slower gate |

### Eval Gate Tuning Guide
| Symptom | Adjustment |
|---------|------------|
| Too few models passing (>50% rejection) | Lower thresholds slightly, verify test data quality |
| Bad models reaching production | Raise thresholds, add regression comparison |
| Bias going undetected | Add more protected attributes, lower disparity ratio |
| Eval gate too slow (>30 min) | Reduce test cases to 50, parallelize tests |

## Step 2: Tune A/B Testing

### A/B Test Configuration
```json
// config/agents.json
{
  "ab_testing": {
    "initial_split": 0.05,
    "min_duration_hours": 24,
    "min_samples": 1000,
    "significance_level": 0.05,
    "auto_promote": false,
    "max_duration_hours": 168,
    "metric_to_optimize": "accuracy",
    "secondary_metrics": ["latency_p95", "error_rate"]
  },
  "progressive_rollout": {
    "stages": [0.05, 0.25, 0.50, 1.0],
    "stage_duration_minutes": 30,
    "rollback_error_threshold": 0.05,
    "health_check_interval_seconds": 60
  }
}
```

Tuning levers:
| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| `initial_split` | 0.05 (5%) | 0.01-0.20 | Higher = faster significance, more risk |
| `min_duration_hours` | 24 | 6-168 | Shorter = faster, may miss time-based patterns |
| `min_samples` | 1000 | 100-10000 | More = higher confidence, longer test |
| `significance_level` | 0.05 | 0.01-0.10 | Lower = more conservative decisions |
| `auto_promote` | false | true/false | true = promote automatically if significant |
| `max_duration_hours` | 168 (7d) | 24-720 | Safety cap on test duration |

### A/B Split Strategy
| Scenario | Recommended Split | Duration |
|----------|--------------------|----------|
| High-risk (financial, healthcare) | 1-2% | 7 days |
| Standard production | 5% | 24-48 hours |
| Low-risk (internal tools) | 10-20% | 6-12 hours |
| Non-production staging | 50% | 2-4 hours |

## Step 3: Tune Drift Detection

### Drift Configuration
```json
// config/guardrails.json
{
  "drift_monitoring": {
    "check_frequency": "daily",
    "accuracy_drift_threshold": 0.05,
    "data_drift_psi_threshold": 0.2,
    "concept_drift_window_days": 30,
    "alert_on_drift": true,
    "auto_retrain_trigger": false,
    "retrain_cooldown_days": 7
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `check_frequency` | daily | "hourly" for critical models, "weekly" for stable |
| `accuracy_drift_threshold` | 0.05 | Lower = catch smaller degradations |
| `data_drift_psi_threshold` | 0.2 | Lower = more sensitive to distribution shift |
| `auto_retrain_trigger` | false | true = automated ML pipeline triggered |
| `retrain_cooldown_days` | 7 | Prevent excessive retraining |

### PSI (Population Stability Index) Reference
| PSI Value | Interpretation | Action |
|-----------|---------------|--------|
| < 0.1 | No significant drift | Continue monitoring |
| 0.1 - 0.2 | Minor drift | Investigate, may need retraining |
| 0.2 - 0.5 | Moderate drift | Retrain recommended |
| > 0.5 | Major drift | Urgent retrain, may need new approach |

## Step 4: Tune Model Card Requirements

```json
// config/guardrails.json
{
  "model_card": {
    "required_fields": ["purpose", "limitations", "training_data", "evaluation", "risks", "mitigations"],
    "optional_fields": ["ethical_considerations", "environmental_impact", "deployment_history"],
    "evaluation_required_metrics": ["accuracy", "f1_score"],
    "bias_testing_required": true,
    "max_age_days": 90
  }
}
```

## Step 5: Cost Optimization

```python
# Model governance cost breakdown:
# - Azure ML workspace: ~$0 (free tier sufficient for registry)
# - OpenAI (governance analysis): ~$0.01/model review
# - Container Apps (governance API): ~$30/month
# - A/B testing overhead: minimal (traffic routing only)
# - Drift monitoring: ~$5/month (scheduled checks)
# - Total: ~$35-50/month

# Cost is mostly fixed infrastructure — scales per-model-review:
# 1. Batch model reviews (queue and review daily)
# 2. Use gpt-4o-mini for model card validation (save 90%)
# 3. Reduce drift check frequency for stable models
# 4. Share ML workspace across teams
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| gpt-4o-mini for card validation | ~90% per review | Slightly less nuanced review |
| Weekly drift check (stable models) | ~85% drift cost | Slower detection |
| Shared ML workspace | ~60% workspace cost | Cross-team governance complexity |
| Batch model reviews | ~30% API cost | Delayed approval |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_workflow.py --governance-endpoint $GOV_ENDPOINT
python evaluation/eval_ab_testing.py --governance-endpoint $GOV_ENDPOINT
python evaluation/eval_drift.py --governance-endpoint $GOV_ENDPOINT
python evaluation/eval_rollout.py --governance-endpoint $GOV_ENDPOINT

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Approval SLA | baseline | -30-50% | < 24 hours |
| A/B correct decisions | baseline | +5-10% | > 90% |
| Drift detection rate | baseline | +5% | > 95% |
| False rejection rate | baseline | -3-5% | < 5% |
| Governance cost | ~$50/mo | ~$35/mo | < $50/mo |
