---
name: "evaluate-financial-risk-intelligence"
description: "Evaluate Financial Risk Intelligence quality — credit scoring accuracy, fraud detection precision/recall, explainability compliance, fairness across protected attributes, regulatory audit readiness."
---

# Evaluate Financial Risk Intelligence

## Prerequisites

- Deployed risk engine (run `deploy-financial-risk-intelligence` skill first)
- Test dataset with labeled credit outcomes and fraud events
- Python 3.11+ with `azure-ai-evaluation`, `scikit-learn`, `fairlearn`, `shap` packages
- Access to audit trail for compliance verification

## Step 1: Prepare Evaluation Dataset

```bash
mkdir -p evaluation/data

# Credit risk test cases (synthetic applicants with known outcomes)
# evaluation/data/credit-001.json
# {
#   "applicant": {"income": 75000, "debt": 25000, "credit_years": 8},
#   "actual_outcome": "repaid",
#   "expected_risk_level": "low",
#   "protected_attributes": {"age_group": "25-34", "gender": "F", "region": "northeast"}
# }
```

Test categories:
- **Credit Risk**: 200 applicants with known repayment outcomes
- **Fraud Detection**: 500 transactions (50 known fraud, 450 legitimate)
- **Fairness**: Same 200 applicants partitioned by protected attributes
- **Edge Cases**: Borderline applicants near decision thresholds
- **Stress Test**: Market crash simulation, fraud spike scenario

## Step 2: Evaluate Credit Risk Accuracy

```bash
python evaluation/eval_credit.py \
  --test-data evaluation/data/credit/ \
  --engine-endpoint $ENGINE_ENDPOINT \
  --output evaluation/results/credit.json
```

Credit risk metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Score Accuracy** | Correct risk level assignment | > 85% |
| **AUC-ROC** | Discriminative power of score | > 0.80 |
| **KS Statistic** | Separation between good/bad | > 0.40 |
| **Gini Coefficient** | Score ranking quality | > 0.50 |
| **Default Prediction** | Defaults correctly identified | > 80% |
| **Score Stability** | Same input → same score (deterministic) | 100% |

## Step 3: Evaluate Fraud Detection

```bash
python evaluation/eval_fraud.py \
  --test-data evaluation/data/fraud/ \
  --engine-endpoint $ENGINE_ENDPOINT \
  --output evaluation/results/fraud.json
```

Fraud detection metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Precision** | True fraud / all flagged | > 80% |
| **Recall** | True fraud detected / all actual fraud | > 95% |
| **F1 Score** | Balance of precision + recall | > 87% |
| **False Positive Rate** | Legitimate transactions blocked | < 2% |
| **Detection Latency** | Time from transaction to decision | < 100ms (rules+ML) |
| **LLM Usage Rate** | Transactions needing LLM analysis | < 10% |

Fraud detection by tier:
| Tier | Expected Coverage | Latency | Cost |
|------|-------------------|---------|------|
| Rules | 30% of fraud caught | < 1ms | Free |
| ML Model | 60% of remaining | < 10ms | Free |
| LLM (edge cases) | 80% of uncertain | < 500ms | ~$0.01/txn |
| **Combined** | **> 95% recall** | **< 100ms avg** | **< $0.001/txn avg** |

## Step 4: Evaluate Fairness

```bash
python evaluation/eval_fairness.py \
  --test-data evaluation/data/credit/ \
  --protected-attributes age_group,gender,region \
  --output evaluation/results/fairness.json
```

Fairness metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Demographic Parity** | Approval rate equal across groups | Ratio > 0.80 |
| **Equalized Odds** | FPR/TPR equal across groups | Diff < 0.05 |
| **Disparate Impact** | Approval ratio minority/majority | > 0.80 (4/5 rule) |
| **Calibration** | Score means same probability across groups | Diff < 0.05 |
| **Individual Fairness** | Similar applicants get similar scores | > 90% |

Protected attributes tested:
| Attribute | Groups | Disparity Threshold |
|-----------|--------|--------------------|
| Age | 18-24, 25-34, 35-44, 45-54, 55+ | < 20% |
| Gender | M, F, Non-binary | < 20% |
| Region | Northeast, Southeast, Midwest, West | < 15% |
| Ethnicity | (if available, anonymized) | < 20% |

## Step 5: Evaluate Explainability

```bash
python evaluation/eval_explainability.py \
  --test-data evaluation/data/credit/ \
  --output evaluation/results/explainability.json
```

Explainability metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Factor Count** | Factors provided per decision | ≥ 4 per decision |
| **Factor Consistency** | Same factors for similar applicants | > 85% |
| **Human Readability** (LLM judge) | Factors understandable by consumers | > 4.0/5.0 |
| **Adverse Action Notice** | ECOA-compliant notice on declines | 100% |
| **SHAP Alignment** | LLM factors match SHAP feature importance | > 70% correlation |
| **Audit Trail Completeness** | Every decision logged with full context | 100% |

## Step 6: Evaluate Regulatory Compliance

```bash
python evaluation/eval_compliance.py \
  --audit-db $COSMOS_ENDPOINT \
  --output evaluation/results/compliance.json
```

Compliance metrics:
| Regulation | Check | Target |
|-----------|-------|--------|
| ECOA | Adverse action reasons on declines | 100% |
| GDPR Art.22 | Full explanation available on request | 100% |
| Basel III | Model card + validation report current | Verified |
| SOX | Audit trail immutable + complete | 100% |
| Fair Lending | No disparate impact detected | 4/5 rule passed |

## Step 7: Generate Evaluation Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md \
  --thresholds config/guardrails.json
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Credit AUC-ROC | > 0.80 | config/guardrails.json |
| Fraud recall | > 95% | config/guardrails.json |
| Fraud FPR | < 2% | config/guardrails.json |
| Disparate impact ratio | > 0.80 | Fair Lending (4/5 rule) |
| Adverse action notice | 100% | ECOA requirement |
| Audit trail coverage | 100% | SOX requirement |
| Groundedness | > 0.85 | fai-manifest.json |
