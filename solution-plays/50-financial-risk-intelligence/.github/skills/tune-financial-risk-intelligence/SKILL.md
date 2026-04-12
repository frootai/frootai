---
name: "tune-financial-risk-intelligence"
description: "Tune Financial Risk Intelligence — fraud decision thresholds, risk score calibration, LLM usage ratio, fairness constraints, explainability depth, latency optimization, cost per transaction."
---

# Tune Financial Risk Intelligence

## Prerequisites

- Deployed risk engine with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-financial-risk-intelligence` skill

## Step 1: Tune Fraud Detection Thresholds

### Three-Tier Fraud Configuration
```json
// config/guardrails.json
{
  "fraud": {
    "rules": {
      "velocity_max_24h": 10,
      "amount_threshold": 10000,
      "geo_impossible_hours": 2,
      "new_device_amount_limit": 500,
      "high_risk_merchants": ["crypto_exchange", "gambling", "wire_transfer"]
    },
    "ml_thresholds": {
      "block": 0.90,
      "review": 0.70,
      "allow": 0.30,
      "model_path": "models/fraud-detector-v3.pkl"
    },
    "llm_analysis": {
      "enabled": true,
      "only_uncertain_zone": true,
      "model": "gpt-4o",
      "temperature": 0,
      "max_tokens": 500
    }
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `ml_thresholds.block` | 0.90 | Lower = more blocks, fewer false negatives |
| `ml_thresholds.review` | 0.70 | Lower = more human reviews, fewer misses |
| `ml_thresholds.allow` | 0.30 | Higher = more conservative auto-allow |
| `velocity_max_24h` | 10 | Lower = catch velocity fraud, more false positives |
| `amount_threshold` | 10000 | Lower = flag more transactions |
| `only_uncertain_zone` | true | false = LLM analyzes all flagged (expensive) |

### Threshold Tuning Guide
| Symptom | Adjustment |
|---------|------------|
| Too many false positives (FPR > 2%) | Raise block threshold to 0.95, review to 0.80 |
| Missing real fraud (recall < 95%) | Lower block to 0.85, add more rules |
| Too many human reviews (> 10%) | Narrow uncertain zone (raise review, lower allow) |
| LLM cost too high | Enable only_uncertain_zone, reduce LLM rate |
| New fraud pattern missed | Add rule-based check, retrain ML model |

## Step 2: Tune Credit Risk Scoring

### Credit Configuration
```json
// config/openai.json
{
  "credit_risk": {
    "model": "gpt-4o",
    "temperature": 0,
    "seed": 42,
    "max_tokens": 1500,
    "response_format": "json_object",
    "system_prompt": "You are a credit risk analyst. Score applicants 300-850. Provide at least 4 risk factors. Use ECOA-compliant adverse action language. Temperature=0 for deterministic scoring."
  },
  "scoring_rules": {
    "debt_to_income_threshold": 0.36,
    "min_credit_history_years": 2,
    "payment_history_weight": 0.35,
    "credit_utilization_weight": 0.30,
    "income_stability_weight": 0.20,
    "credit_mix_weight": 0.15
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `temperature` | 0 | ALWAYS 0 for financial decisions (deterministic) |
| `seed` | 42 | Fixed seed = reproducible scores |
| `debt_to_income_threshold` | 0.36 | Lower = stricter, higher = more approvals |
| `payment_history_weight` | 0.35 | Higher = more weight on past behavior |
| Factor count | 4 minimum | More factors = better explainability |

## Step 3: Tune Fairness Constraints

```json
// config/guardrails.json
{
  "fairness": {
    "enabled": true,
    "protected_attributes": ["age_group", "gender", "region"],
    "disparate_impact_threshold": 0.80,
    "equalized_odds_max_diff": 0.05,
    "testing_schedule": "weekly",
    "auto_flag_violations": true,
    "remediation": {
      "on_violation": "flag_and_report",
      "max_score_adjustment": 0,
      "require_human_review_for_protected": false
    }
  }
}
```

Fairness tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `disparate_impact_threshold` | 0.80 | 4/5 rule (ECOA standard) |
| `equalized_odds_max_diff` | 0.05 | Stricter = tighter equality requirement |
| `testing_schedule` | weekly | More frequent = faster issue detection |
| `auto_flag_violations` | true | Immediate alert on fairness failure |

## Step 4: Tune Audit Trail

```json
// config/agents.json
{
  "audit": {
    "log_all_decisions": true,
    "store_input_hash": true,
    "store_raw_input": false,
    "retention_years": 7,
    "immutable": true,
    "export_format": "regulatory_report",
    "cosmos_throughput_ru": 400
  },
  "regulatory_reporting": {
    "ecoa_adverse_action": true,
    "gdpr_explanation_on_request": true,
    "basel_model_card_refresh": "quarterly",
    "sox_data_integrity_check": "daily"
  }
}
```

Audit requirements:
| Regulation | Retention | Format | Frequency |
|-----------|-----------|--------|----------|
| SOX | 7 years | Immutable Cosmos DB | Every decision |
| ECOA | 25 months after action | Adverse action notice | On decline |
| GDPR | Until erasure request | Explainable JSON | On request |
| Basel III | 5 years | Model validation report | Quarterly |

## Step 5: Cost Optimization

```python
# Financial risk engine cost breakdown (10K transactions/day):
# - Fraud detection:
#   - Rules tier: $0 (local processing)
#   - ML tier: $0 (local model inference)
#   - LLM tier (5% of transactions): ~$5/day
# - Credit risk scoring (100 applications/day):
#   - GPT-4o per application: ~$1.50/day
# - Audit trail (Cosmos DB):
#   - 400 RU/s + storage: ~$25/month
# - Container Apps (2 replicas):
#   - ~$60/month
# - Total: ~$120/month

# Cost reduction strategies:
# 1. Narrow LLM uncertain zone (save 30% LLM cost)
# 2. Use gpt-4o-mini for sentiment analysis (save 90%)
# 3. Cache similar credit profiles (save 20% scoring cost)
# 4. Reduce Cosmos throughput during off-hours (save 40%)
# 5. Rule-based pre-screening before LLM scoring
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| Narrow uncertain zone | ~30% LLM | May miss edge cases |
| gpt-4o-mini for sentiment | ~90% sentiment cost | Lower analysis depth |
| Cache credit profiles | ~20% scoring | Stale scores possible |
| Cosmos autoscale | ~40% DB cost | Higher latency at low throughput |
| Rule pre-screening | ~50% LLM calls | Rules must be comprehensive |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_credit.py --test-data evaluation/data/credit/
python evaluation/eval_fraud.py --test-data evaluation/data/fraud/
python evaluation/eval_fairness.py --test-data evaluation/data/credit/
python evaluation/eval_explainability.py --test-data evaluation/data/credit/
python evaluation/eval_compliance.py --audit-db $COSMOS_ENDPOINT

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Credit AUC-ROC | baseline | +0.03-0.05 | > 0.80 |
| Fraud recall | baseline | +2-5% | > 95% |
| Fraud FPR | baseline | -0.5-1% | < 2% |
| Disparate impact | baseline | +0.05 | > 0.80 |
| LLM usage rate | ~10% | ~5% | < 10% |
| Cost per 10K txns | ~$120/mo | ~$80/mo | < $150/mo |
