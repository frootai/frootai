---
name: "evaluate-federated-learning-pipeline"
description: "Evaluate Federated Learning Pipeline quality — convergence speed, model accuracy, privacy budget consumption, client contribution fairness, communication efficiency."
---

# Evaluate Federated Learning Pipeline

## Prerequisites

- Deployed federated pipeline (run `deploy-federated-learning-pipeline` skill first)
- Test dataset for global model validation
- Python 3.11+ with `flwr`, `torch`, `opacus` packages

## Step 1: Evaluate Convergence

```bash
python evaluation/eval_convergence.py \
  --server-endpoint $SERVER_ENDPOINT \
  --output evaluation/results/convergence.json
```

Convergence metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Rounds to Convergence** | Total rounds until loss stabilizes | < 50 rounds |
| **Final Loss** | Global model loss at convergence | Domain-dependent |
| **Loss Monotonicity** | Loss decreases consistently | > 90% of rounds |
| **Divergence Events** | Rounds where loss increased | < 5% |
| **Client Variance** | Variance of client losses per round | Decreasing trend |

## Step 2: Evaluate Model Accuracy

```bash
python evaluation/eval_accuracy.py \
  --test-data evaluation/data/global-test.json \
  --output evaluation/results/accuracy.json
```

Accuracy metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Global Accuracy** | Accuracy on held-out server test set | > 85% |
| **Per-Client Accuracy** | Accuracy on each client's test set | > 80% per client |
| **Accuracy vs Centralized** | Federated accuracy / centralized accuracy | > 0.95 ratio |
| **Non-IID Robustness** | Accuracy stable across heterogeneous clients | Variance < 5% |

## Step 3: Evaluate Privacy

```bash
python evaluation/eval_privacy.py \
  --output evaluation/results/privacy.json
```

Privacy metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Epsilon Consumed** | Total DP budget used | < configured budget |
| **Delta** | DP failure probability | < 1e-5 |
| **Gradient Leakage Test** | Can training data be reconstructed? | No leakage |
| **Membership Inference** | Can attacker tell if data was in training? | AUC < 0.55 |
| **Data Isolation** | No raw data transferred to server | 100% verified |

## Step 4: Evaluate Communication

```bash
python evaluation/eval_communication.py \
  --output evaluation/results/communication.json
```

Communication metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Bytes per Round** | Data transferred per training round | Track |
| **Client Selection Efficiency** | Useful clients selected per round | > 80% |
| **Straggler Rate** | Slow clients slowing the round | < 10% |
| **Round Duration** | Time per federated round | < 5 min |
| **Total Training Time** | All rounds combined | < 24 hours |

## Step 5: Evaluate Client Contribution

```bash
python evaluation/eval_contribution.py \
  --output evaluation/results/contribution.json
```

Contribution metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Fair Contribution** | All clients contribute proportionally | Gini < 0.2 |
| **Free-Rider Detection** | Clients sending random updates | 0 detected |
| **Data Quality Impact** | Low-quality clients identified | Flagged |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md \
  --thresholds config/guardrails.json
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Rounds to convergence | < 50 | config/guardrails.json |
| Global accuracy | > 85% | config/guardrails.json |
| Epsilon consumed | < budget | config/guardrails.json |
| Data isolation | 100% | config/guardrails.json (non-negotiable) |
| Gradient leakage | None | config/guardrails.json (non-negotiable) |
