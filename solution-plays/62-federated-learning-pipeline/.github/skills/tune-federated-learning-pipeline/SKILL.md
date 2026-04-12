---
name: "tune-federated-learning-pipeline"
description: "Tune Federated Learning Pipeline — DP epsilon/delta, client selection, aggregation strategy, convergence threshold, learning rate schedule, non-IID handling, cost."
---

# Tune Federated Learning Pipeline

## Prerequisites

- Deployed federated pipeline with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Differential Privacy

```json
// config/guardrails.json
{
  "differential_privacy": {
    "epsilon": 1.0,
    "delta": 1e-5,
    "max_grad_norm": 1.0,
    "noise_mechanism": "gaussian",
    "accountant": "rdp",
    "total_budget": 10.0,
    "per_round_budget": 0.1
  }
}
```

DP tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `epsilon` | 1.0 | Lower = more privacy, less utility |
| `delta` | 1e-5 | Must be < 1/dataset_size |
| `max_grad_norm` | 1.0 | Higher = less clipping, more noise needed |
| `total_budget` | 10.0 | Total privacy budget across all rounds |
| `per_round_budget` | 0.1 | Budget consumed per training round |

### DP Epsilon Guide
| Epsilon | Privacy Level | Utility Impact | Use Case |
|---------|--------------|----------------|----------|
| 0.1 | Very strong | Significant accuracy loss | Regulatory requirement |
| 1.0 | Strong | Moderate loss (~5% accuracy) | Healthcare, finance |
| 5.0 | Moderate | Minor loss (~1-2%) | Enterprise default |
| 10.0 | Weak | Minimal loss | Low-sensitivity data |

## Step 2: Tune Training Configuration

```json
// config/openai.json
{
  "federated_training": {
    "model": "resnet18",
    "local_epochs": 3,
    "learning_rate": 0.01,
    "lr_decay": 0.99,
    "batch_size": 32,
    "optimizer": "sgd",
    "momentum": 0.9
  },
  "server": {
    "max_rounds": 100,
    "convergence_threshold": 0.001,
    "convergence_patience": 5,
    "early_stopping": true
  },
  "analysis": {
    "model": "gpt-4o-mini",
    "temperature": 0.1,
    "explain_convergence": true
  }
}
```

Training tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `local_epochs` | 3 | More = faster convergence, more client drift |
| `learning_rate` | 0.01 | Higher = faster but risk divergence |
| `lr_decay` | 0.99 | Per-round decay for stability |
| `max_rounds` | 100 | Safety limit |
| `convergence_threshold` | 0.001 | Lower = more precise convergence detection |

### Tuning Guide
| Symptom | Adjustment |
|---------|------------|
| Not converging after 50 rounds | Increase local_epochs to 5, lower learning_rate |
| Diverging (loss increasing) | Lower learning_rate, increase LR decay |
| Too slow convergence | Increase local_epochs, select more clients |
| High client variance | Use FedProx (mu=0.01), reduce local_epochs |
| Privacy budget exhausted early | Lower per_round_budget, reduce rounds |

## Step 3: Tune Client Selection

```json
// config/agents.json
{
  "client_selection": {
    "strategy": "random",
    "clients_per_round": 10,
    "min_data_size": 100,
    "max_client_staleness_rounds": 5,
    "prioritize_underserved": true
  },
  "aggregation": {
    "method": "fedavg",
    "weight_by": "data_size",
    "non_iid_handling": "fedprox",
    "fedprox_mu": 0.01
  }
}
```

Client selection strategies:
| Strategy | When to Use | Trade-off |
|----------|------------|----------|
| Random | IID data, uniform clients | Simple, fair |
| Stratified | Non-IID, ensure diversity | More complex, better convergence |
| Resource-aware | Heterogeneous hardware | Avoids stragglers |
| Priority (underserved) | Include minority clients | Fairness over speed |

## Step 4: Tune Non-IID Handling

```json
// config/agents.json
{
  "non_iid": {
    "detection": {
      "enabled": true,
      "method": "kl_divergence",
      "threshold": 0.5
    },
    "handling": {
      "method": "fedprox",
      "mu": 0.01,
      "auto_adjust_mu": true,
      "mu_range": [0.001, 0.1]
    }
  }
}
```

Non-IID tuning:
| KL Divergence | Data Distribution | Recommended Strategy |
|--------------|-------------------|---------------------|
| < 0.1 | Near-IID | FedAvg (default) |
| 0.1 - 0.5 | Mild skew | FedProx (mu=0.01) |
| 0.5 - 1.0 | Significant skew | FedProx (mu=0.05) |
| > 1.0 | Severe skew | SCAFFOLD or per-client fine-tune |

## Step 5: Cost Optimization

```python
# Federated Learning cost breakdown:
# - Server (Container Apps, 1 replica): ~$30/month
# - Client compute (Azure ML, per training hour): ~$2/hour/client
# - Communication: ~$0.01/MB transferred
# - Confidential Computing (if used): ~$0.50/hour
# - Example: 10 clients × 50 rounds × 1 hour/round = 500 client-hours = ~$1,000

# Cost reduction:
# 1. Reduce rounds (early stopping) — save 30-50%
# 2. Fewer clients per round (5 vs 10) — save 50% per round
# 3. Model compression (send sparse updates) — save 60% communication
# 4. Async training (don't wait for stragglers) — save 20% time
# 5. Skip CC for less-sensitive data — save $0.50/hour
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| Early stopping | ~30-50% | May stop before optimal |
| Fewer clients/round | ~50% compute | Slower convergence |
| Model compression | ~60% network | Slight accuracy loss |
| Async training | ~20% time | Stale updates possible |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_convergence.py --server-endpoint $SERVER_ENDPOINT
python evaluation/eval_accuracy.py --test-data evaluation/data/global-test.json
python evaluation/eval_privacy.py
python evaluation/eval_communication.py

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Rounds to converge | baseline | -20-30% | < 50 |
| Global accuracy | baseline | +2-5% | > 85% |
| Epsilon consumed | baseline budget | -20% | < budget |
| Training cost | ~$1,000 | ~$500-700 | Minimize |
