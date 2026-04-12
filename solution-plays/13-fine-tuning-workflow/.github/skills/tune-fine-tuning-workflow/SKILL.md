---
name: tune-fine-tuning-workflow
description: "Tune Fine-Tuning — optimize LoRA rank, learning rate, epochs, batch size, data mix, compute selection, cost per training run. Use when: tune, optimize hyperparameters."
---

# Tune Fine-Tuning Workflow

## When to Use
- Optimize LoRA/QLoRA hyperparameters for best quality
- Balance training cost vs model quality
- Select optimal compute (GPU type and count)
- Configure data mixing strategies
- Reduce cost per training run

## Tuning Dimensions

### Dimension 1: LoRA Hyperparameters

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| `lora_rank` | 16 | 4-128 | Higher = more capacity, more VRAM, better quality |
| `lora_alpha` | 32 | 2× rank | Controls effective learning rate scaling |
| `learning_rate` | 1e-4 | 1e-5 to 5e-4 | Too high = unstable, too low = slow convergence |
| `epochs` | 3 | 1-10 | More = better fit, risk of overfitting |
| `batch_size` | 4 | 1-32 | Larger = stable gradients, more VRAM |
| `warmup_steps` | 100 | 0-500 | Prevents early loss spikes |
| `weight_decay` | 0.01 | 0-0.1 | Regularization against overfitting |
| `target_modules` | q,v | q,k,v,o,gate,up,down | More modules = more capacity |

**Tuning strategy**:
1. Start with defaults: rank=16, lr=1e-4, epochs=3
2. If underfitting: increase rank to 32-64, increase lr slightly
3. If overfitting: reduce epochs, add weight_decay, add more data
4. If training unstable: reduce lr, increase warmup_steps

### Dimension 2: Data Quality Optimization

| Factor | Current | Target | How to Improve |
|--------|---------|--------|---------------|
| Sample count | 10-50 | 200-500 | Synthetic data augmentation |
| Diversity | Low | High | Cover all task categories |
| Quality | Mixed | Curated | Human review top 100 samples |
| Balance | Skewed | Balanced | Upsample minority categories |
| Length distribution | Fixed | Varied | Include short + long examples |

**Data augmentation techniques**:
- Paraphrase existing examples (GPT-4o with different wording)
- Backtranslation (English → French → English)
- Template variation (same content, different framing)
- Never augment test/validation sets — only training data

### Dimension 3: Compute Selection

| Compute | GPU | VRAM | Best For | Cost/hr |
|---------|-----|------|----------|---------|
| Standard_NC6s_v3 | 1× V100 | 16GB | LoRA on 7B models | ~$3.06 |
| Standard_NC24ads_A100_v4 | 1× A100 | 80GB | LoRA on 7B-70B | ~$3.67 |
| Standard_ND96asr_v4 | 8× A100 | 640GB | Full fine-tune 70B+ | ~$27.20 |

**Decision matrix**:
- LoRA on ≤7B model → NC6s_v3 (cheapest, sufficient VRAM)
- LoRA on 13B-70B → NC24ads_A100_v4 (80GB single GPU)
- QLoRA on 70B → NC24ads_A100_v4 (4-bit fits in 80GB)
- Full fine-tune → ND96asr_v4 (8× A100 with DeepSpeed)

### Dimension 4: Azure OpenAI Fine-Tuning Parameters

| Parameter | Default | Range | Notes |
|-----------|---------|-------|-------|
| `n_epochs` | auto | 1-10 | "auto" = Azure optimizes |
| `batch_size` | auto | 1-256 | "auto" = Azure optimizes |
| `learning_rate_multiplier` | 1.0 | 0.1-10 | Multiplied by base lr |
| `suffix` | — | string | Model name suffix |

**Cost**: Azure OpenAI fine-tuning charges per 1K training tokens:
| Model | Training Cost | Hosting Cost |
|-------|--------------|-------------|
| gpt-4o-mini | $3.00/1M tokens | $0.30/1M input + $1.20/1M output |
| gpt-4o | $25.00/1M tokens | $3.75/1M input + $15.00/1M output |

### Dimension 5: Cost Per Training Run

**Estimate for 500 samples, avg 1000 tokens, 3 epochs**:
| Method | Tokens | Cost |
|--------|--------|------|
| Azure OpenAI (gpt-4o-mini) | 1.5M tokens | ~$4.50 |
| Azure OpenAI (gpt-4o) | 1.5M tokens | ~$37.50 |
| Azure ML (LoRA on 7B, NC6s) | 2 hrs compute | ~$6.12 |
| Azure ML (LoRA on 70B, A100) | 4 hrs compute | ~$14.68 |

**Optimization**: Use gpt-4o-mini fine-tuning first (cheapest). Only fine-tune gpt-4o if mini doesn't meet quality bar.

## Hyperparameter Search Strategy
```bash
# Grid search (small sets)
python scripts/hyperparam_search.py --strategy grid \
  --lora-rank 8,16,32 --lr 5e-5,1e-4,2e-4 --epochs 2,3,5

# Random search (larger sets)
python scripts/hyperparam_search.py --strategy random \
  --trials 10 --budget $50
```

## Production Readiness Checklist
- [ ] LoRA rank optimized (start small, increase if underfitting)
- [ ] Learning rate validated (no training instability)
- [ ] Epochs set to avoid overfitting (val loss not increasing)
- [ ] Training data quality reviewed (no duplicates, balanced categories)
- [ ] Compute right-sized (don't use A100 for 7B LoRA)
- [ ] Cost per training run documented
- [ ] MLflow experiment with all hyperparameters logged
- [ ] Fine-tuned model compared to base on eval set
- [ ] Model registered with version and training metadata

## Output: Tuning Report
After tuning, document:
- Best hyperparameters found and why
- Training cost vs quality trade-off curve
- Compute recommendation for this task
- Data quantity/quality recommendations for next iteration
