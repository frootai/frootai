---
name: "evaluate-ai-model-governance"
description: "Evaluate AI Model Governance quality — approval workflow efficiency, A/B test effectiveness, drift detection accuracy, model card completeness, rollback reliability."
---

# Evaluate AI Model Governance

## Prerequisites

- Deployed governance pipeline (run `deploy-ai-model-governance` skill first)
- Test models registered with model cards
- Python 3.11+ with `azure-ai-ml`, `scipy` packages
- A/B test data from at least one completed test

## Step 1: Evaluate Approval Workflow

```bash
python evaluation/eval_workflow.py \
  --governance-endpoint $GOV_ENDPOINT \
  --output evaluation/results/workflow.json
```

Workflow metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Approval SLA** | Time from registration to approved | < 24 hours |
| **Eval Gate Pass Rate** | Models passing automated eval | > 80% |
| **Bias Test Coverage** | Protected attributes tested | 100% |
| **Model Card Completeness** | Cards with all required fields | 100% |
| **Rejection Rate** | Models rejected at any gate | Track (healthy: 10-30%) |
| **False Rejection Rate** | Good models incorrectly rejected | < 5% |

Workflow stage timing:
| Stage | Expected Duration | Automated |
|-------|-------------------|----------|
| Eval gate | < 10 minutes | Yes |
| Bias testing | < 30 minutes | Yes |
| Model card validation | < 1 minute | Yes |
| Security scan | < 15 minutes | Yes |
| Human review | < 8 hours (business hours) | No |
| **Total** | **< 24 hours** | — |

## Step 2: Evaluate A/B Testing

```bash
python evaluation/eval_ab_testing.py \
  --governance-endpoint $GOV_ENDPOINT \
  --output evaluation/results/ab_testing.json
```

A/B testing metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Statistical Power** | Ability to detect real differences | > 80% |
| **False Positive Rate** | Promote worse challenger | < 5% |
| **Test Duration Accuracy** | Minimum duration achieves significance | > 90% |
| **Sample Size Adequacy** | Enough samples for significance | > 95% |
| **Correct Decision Rate** | Right promote/keep decision | > 90% |
| **Traffic Split Accuracy** | Actual vs configured split | < 2% deviation |

A/B testing evaluation:
1. **Power analysis**: Verify sample size achieves desired statistical power
2. **False positive test**: Run A/A test (same model both sides) — should not promote
3. **Sensitivity test**: Run A/B with known-better model — should promote
4. **Duration test**: Verify minimum duration is sufficient for significance
5. **Split accuracy**: Verify 5%/95% split is actually 5%/95%

## Step 3: Evaluate Drift Detection

```bash
python evaluation/eval_drift.py \
  --governance-endpoint $GOV_ENDPOINT \
  --output evaluation/results/drift.json
```

Drift detection metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Accuracy Drift Detection** | Catch >5% accuracy drops | > 95% |
| **Data Drift Detection** | Catch PSI > 0.2 shifts | > 90% |
| **Detection Latency** | Time from drift onset to alert | < 1 week |
| **False Alarm Rate** | Alert without actual drift | < 5% |
| **Retrain Recommendation** | Correct retrain trigger | > 85% |

Drift test scenarios:
1. Inject 10% accuracy drop — verify detected within 1 drift check
2. Shift feature distributions (PSI 0.3) — verify data drift flagged
3. Stable model, no drift — verify no false alarm
4. Gradual concept drift over 4 weeks — verify trend detection

## Step 4: Evaluate Progressive Rollout

```bash
python evaluation/eval_rollout.py \
  --governance-endpoint $GOV_ENDPOINT \
  --output evaluation/results/rollout.json
```

Rollout metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Rollout Success Rate** | Deployments completing all stages | > 95% |
| **Rollback Speed** | Time from detect-to-rollback | < 5 minutes |
| **Stage Health Check** | Error rate monitored at each stage | 100% |
| **Rollback Trigger Accuracy** | Correct rollback on error | > 95% |

## Step 5: Evaluate Lineage Tracking

```bash
python evaluation/eval_lineage.py \
  --governance-endpoint $GOV_ENDPOINT \
  --output evaluation/results/lineage.json
```

Lineage metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Traceability** | Model → training run → data source | 100% |
| **Version Chain** | Complete version history | 100% |
| **Dependency Graph** | All model dependencies tracked | > 95% |
| **Audit Compliance** | Full audit trail for any model | 100% |

## Step 6: Generate Evaluation Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md \
  --thresholds config/guardrails.json
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Approval SLA | < 24 hours | config/guardrails.json |
| A/B correct decision | > 90% | config/guardrails.json |
| Drift detection | > 95% catch rate | config/guardrails.json |
| Rollback speed | < 5 minutes | config/guardrails.json |
| Model card completeness | 100% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
