---
name: "tune-synthetic-data-factory"
description: "Tune Synthetic Data Factory — generation temperature, CTGAN epochs, batch size, PII markers, differential privacy budget, correlation preservation, cost optimization."
---

# Tune Synthetic Data Factory

## Prerequisites

- Deployed synthetic data factory with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-synthetic-data-factory` skill

## Step 1: Tune LLM Text Generation

### Generation Model Configuration
```json
// config/openai.json
{
  "generation": {
    "model": "gpt-4o",
    "temperature": 0.8,
    "max_tokens": 2048,
    "top_p": 0.95,
    "seed": null,
    "batch_size": 50,
    "system_prompt": "Generate realistic synthetic data. All PII must be fictional. Preserve realistic distributions and correlations between fields."
  },
  "validation": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "system_prompt": "Validate that synthetic data contains no real PII and matches specified distributions."
  }
}
```

Tuning levers:
| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| `temperature` | 0.8 | 0.5-1.2 | Higher = more diverse, lower = more consistent |
| `top_p` | 0.95 | 0.8-1.0 | Higher = broader vocabulary for variety |
| `batch_size` | 50 | 10-200 | Larger = fewer API calls, risk of diminishing quality |
| `seed` | null | null/int | null = varied outputs, int = reproducible |
| `max_tokens` | 2048 | 512-4096 | Higher for complex schemas with many fields |

### Temperature Tuning Guide
| Temperature | Diversity | Consistency | Best For |
|-------------|-----------|-------------|----------|
| 0.5 | Low | High | Structured data with strict schemas |
| 0.7 | Medium | Medium | Balanced quality + variety |
| 0.8 | Good (default) | Good | Most synthetic data use cases |
| 1.0 | High | Lower | Creative text, conversation data |
| 1.2 | Very high | Low | Maximum diversity (may have quality issues) |

## Step 2: Tune CTGAN Tabular Generation

```json
// config/tabular.json
{
  "ctgan": {
    "epochs": 300,
    "batch_size": 500,
    "generator_dim": [256, 256],
    "discriminator_dim": [256, 256],
    "generator_lr": 0.0002,
    "discriminator_lr": 0.0002,
    "pac": 10,
    "enforce_min_max": true,
    "enforce_rounding": true
  },
  "differential_privacy": {
    "enabled": false,
    "epsilon": 1.0,
    "delta": 1e-5,
    "max_grad_norm": 1.0
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `epochs` | 300 | More = better fit, risk of overfitting (memorizing real data) |
| `batch_size` | 500 | Larger = faster training, may miss rare patterns |
| `generator_dim` | [256, 256] | Deeper = captures complex relationships, slower |
| `pac` | 10 | Higher = better mode coverage, slower |
| `enforce_min_max` | true | Keeps values within real data bounds |
| `epsilon` (DP) | 1.0 | Lower = more privacy, less utility |

### CTGAN Tuning Guide
| Symptom | Adjustment |
|---------|-----------|
| KS statistic > 0.1 | Increase epochs to 500, check training convergence |
| Correlation not preserved | Use CopulaGAN instead of CTGAN |
| Mode collapse (few distinct values) | Increase PAC to 20, reduce batch_size |
| Training too slow | Reduce generator_dim to [128, 128] |
| Overfitting (synthetic = real memorized) | Reduce epochs, enable differential privacy |

## Step 3: Tune Privacy Controls

```json
// config/guardrails.json
{
  "privacy": {
    "pii_scan_on_output": true,
    "pii_scanner": "presidio",
    "block_on_pii_detected": true,
    "re_identification_check": true,
    "min_k_anonymity": 5,
    "quasi_identifier_columns": ["age", "zip_code", "gender"]
  },
  "markers": {
    "name_prefix": "SYNTH-",
    "email_domain": "@synth-example.com",
    "ssn_prefix": "S-",
    "phone_area_code": "555",
    "address_city_prefix": "Synthville-"
  },
  "differential_privacy": {
    "enabled": false,
    "epsilon_budget": 10.0,
    "per_query_epsilon": 1.0,
    "noise_mechanism": "gaussian"
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `min_k_anonymity` | 5 | Higher = more privacy, less unique records |
| `epsilon_budget` | 10.0 | Lower = more privacy, less utility |
| `block_on_pii_detected` | true | false = warn only (for internal dev use) |
| `quasi_identifier_columns` | 3 | More columns = stricter re-identification check |
| PII markers | Various | Obvious markers prevent accidental real-data use |

### Differential Privacy Budget
| Epsilon | Privacy Level | Utility Impact | Use Case |
|---------|--------------|----------------|----------|
| 0.1 | Very high | Significant noise | Regulatory requirement |
| 1.0 | High | Moderate noise | Sensitive data (healthcare, finance) |
| 5.0 | Medium | Minor noise | Internal enterprise data |
| 10.0 | Low | Minimal noise | Development/testing data |
| ∞ (disabled) | None | No noise | When source is already public |

## Step 4: Tune Schema Definitions

```json
// config/schemas.json
{
  "employee": {
    "fields": {
      "name": { "type": "string", "generator": "faker", "faker_provider": "name" },
      "email": { "type": "string", "generator": "derived", "template": "{name_slug}@synth-example.com" },
      "age": { "type": "int", "distribution": "normal", "mean": 35, "std": 10, "min": 18, "max": 70 },
      "salary": { "type": "float", "distribution": "lognormal", "mean": 65000, "std": 25000 },
      "department": { "type": "categorical", "values": ["Engineering", "Sales", "Marketing", "HR", "Finance"], "weights": [0.35, 0.25, 0.15, 0.15, 0.10] }
    },
    "correlations": [
      { "columns": ["age", "salary"], "type": "positive", "strength": 0.6 },
      { "columns": ["department", "salary"], "type": "conditional", "rules": { "Engineering": { "mean": 85000 }, "Sales": { "mean": 55000 } } }
    ],
    "constraints": [
      "salary > 30000",
      "engineering department has highest average salary"
    ]
  }
}
```

## Step 5: Cost Optimization

```python
# Synthetic data generation cost breakdown:
# LLM generation (GPT-4o, 50-record batch):
#   - Input: ~500 tokens (schema + prompt)
#   - Output: ~2000 tokens (50 records)
#   - Cost per batch: ~$0.013
#   - Cost per 1000 records: ~$0.26
#
# CTGAN training:
#   - Training: ~5 min on CPU, free (local compute)
#   - Generation: instant after training
#   - Cost per 1000 records: ~$0.001 (compute only)
#
# Validation (Presidio + statistical):
#   - Local processing, no API cost
#   - Cost per 1000 records: ~$0.001

# Cost reduction strategies:
# 1. Use gpt-4o-mini for simple schemas (save 90%)
# 2. Use CTGAN for tabular data instead of LLM (save 99%)
# 3. Larger batch sizes (200 records) for LLM gen (save 40%)
# 4. Cache schemas for repeated generation (save 10%)
# 5. Use Faker for PII-style fields, LLM for content only
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| gpt-4o-mini for simple schemas | ~90% LLM cost | Lower quality for complex schemas |
| CTGAN for tabular data | ~99% vs LLM | Requires training data sample |
| Larger batch sizes | ~40% | Diminishing quality beyond 200 |
| Faker for PII columns | ~60% per record | Less contextually appropriate |
| Rule-based for structured | 100% vs LLM | No realistic variation |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_fidelity.py --real evaluation/data/real-reference.csv --synthetic evaluation/data/synthetic-output.csv
python evaluation/eval_privacy.py --real evaluation/data/real-reference.csv --synthetic evaluation/data/synthetic-output.csv
python evaluation/eval_diversity.py --synthetic evaluation/data/synthetic-output.csv
python evaluation/eval_utility.py --real evaluation/data/real-reference.csv --synthetic evaluation/data/synthetic-output.csv

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| KS statistic | baseline | -0.02-0.05 | < 0.1 |
| PII leakage | 0% | 0% | 0% (non-negotiable) |
| Uniqueness | baseline | +3-5% | > 95% |
| TSTR accuracy | baseline | +5-10% | > 85% parity |
| Cost per 1K records | ~$0.26 | ~$0.05-0.10 | < $0.30 |
