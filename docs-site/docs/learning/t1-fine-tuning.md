---
sidebar_position: 14
title: "T1: Fine-Tuning & MLOps"
description: "The model customization spectrum — from prompt engineering to full fine-tuning. LoRA/QLoRA, data preparation, Azure AI Foundry workflows, evaluation metrics, and MLOps for LLMs."
---

# T1: Fine-Tuning & MLOps

Fine-tuning is the **most misused tool in AI**. Most teams reach for it when prompt engineering + RAG would solve 90% of their problems at 1% of the cost. This module covers the full customization spectrum so you pick the right technique — and when you do need fine-tuning, you do it efficiently with LoRA/QLoRA. For prompting techniques, see [R1: Prompt Engineering](./r1-prompt-engineering.md). For RAG patterns, see [R2: RAG Architecture](./r2-rag-architecture.md).

:::tip Always Try Prompt Engineering First
Before investing in fine-tuning (days of work, thousands of examples, GPU costs), exhaust simpler options. The progression: better prompts → few-shot examples → RAG grounding → system instructions. Only fine-tune when these fail to meet quality requirements.
:::

## The Customization Spectrum

Each technique trades effort/cost for control. Start from the left; move right only when needed:

| Technique | Data Needed | Cost | Time | When to Use |
|-----------|------------|------|------|-------------|
| **Prompt Engineering** | 0 examples | ~$0 | Minutes | First approach for everything |
| **Few-Shot Prompting** | 3-10 examples | ~$0 | Minutes | Format/style consistency |
| **RAG** | Your docs | $50-500/mo | Hours | Domain knowledge grounding |
| **System Instructions** | 0-5 examples | ~$0 | Minutes | Behavioral constraints |
| **LoRA / QLoRA** | 100-10K examples | $10-100 | Hours | Style, format, domain adaptation |
| **Full Fine-Tuning** | 10K-100K examples | $100-10K | Days | Deep behavioral changes |
| **Continued Pre-Training** | 1M+ tokens | $10K+ | Days-Weeks | New domain vocabulary |
| **Training From Scratch** | Billions of tokens | $1M+ | Months | Novel architecture needs |

## When to Fine-Tune: Decision Framework

Fine-tune when **all** of these are true:

1. **Prompt engineering + RAG tried and insufficient** — documented evidence of failures
2. **Consistent format/style needed** — the model must always output in a specific structure
3. **Latency matters** — you need shorter prompts (fine-tuned models need less instruction)
4. **You have quality training data** — minimum 100 curated examples, ideally 1K+
5. **The task is narrow** — classification, extraction, or domain-specific generation

**Don't fine-tune when:**
- You need up-to-date knowledge → use RAG
- You need factual accuracy → use grounding + citations
- You have fewer than 50 examples → use few-shot prompting
- The base model already performs well with good prompts

## LoRA & QLoRA: Parameter-Efficient Fine-Tuning

Instead of updating all model parameters (billions), LoRA freezes the original weights and trains small **rank-decomposition matrices** injected into attention layers:

```
Original Weight Matrix W (d × d):  Frozen ❄️
LoRA Adapter:  W' = W + B × A
  where A is (d × r) and B is (r × d), r << d (rank 4-64)
```

| Aspect | Full Fine-Tuning | LoRA | QLoRA |
|--------|-----------------|------|-------|
| **Parameters trained** | 100% | 0.1-1% | 0.1-1% |
| **GPU memory** | 80-160 GB | 16-24 GB | 4-8 GB |
| **Adapter size** | Full model (10-100 GB) | 10-100 MB | 10-100 MB |
| **Training cost** | $100-10K | $10-100 | $5-50 |
| **Quality** | Best | 95-99% of full | 90-97% of full |

**QLoRA** adds 4-bit quantization of the base model during training, cutting memory usage further while maintaining quality through double quantization and paged optimizers.

## Data Preparation

Training data uses **JSONL format** with conversation turns:

```jsonl
{"messages": [
  {"role": "system", "content": "You are a legal contract analyzer."},
  {"role": "user", "content": "Summarize the key obligations in this clause: ..."},
  {"role": "assistant", "content": "Key obligations:\n1. Payment within 30 days\n2. ..."}
]}
```

**Data quality checklist:**
- ✅ Minimum 100 examples (1K+ recommended for production)
- ✅ Diverse inputs covering edge cases
- ✅ Consistent output format across all examples
- ✅ No PII unless required and compliant
- ✅ 80/10/10 split: training / validation / test
- ✅ Human-reviewed — never use synthetic data alone

## Azure AI Foundry Fine-Tuning Workflow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Upload Data │───▶│  Configure   │───▶│   Train      │
│  (JSONL)     │    │  (model,     │    │  (managed    │
│              │    │   epochs,    │    │   compute)   │
│              │    │   LR, batch) │    │              │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                               │
┌──────────────┐    ┌──────────────┐    ┌──────▼───────┐
│  Deploy      │◀───│  Evaluate    │◀───│  Review      │
│  (endpoint)  │    │  (metrics,   │    │  (loss curve, │
│              │    │   A/B test)  │    │   samples)   │
└──────────────┘    └──────────────┘    └──────────────┘
```

**Key hyperparameters:**

| Parameter | Default | Guidance |
|-----------|---------|----------|
| **Epochs** | 3-5 | More data → fewer epochs; watch for overfitting |
| **Learning rate** | 2e-5 | Lower (1e-5) for larger models |
| **Batch size** | 4-16 | Larger = faster but more memory |
| **LoRA rank** | 8-16 | Higher rank = more capacity, more memory |

## Evaluation Metrics

Track these during and after training:

- **Training/validation loss** — should decrease smoothly; divergence signals overfitting
- **Task-specific metrics** — accuracy, F1, BLEU/ROUGE depending on task
- **A/B testing** — compare fine-tuned vs base model on held-out test set
- **Human evaluation** — expert review of output quality on real-world queries

:::warning Overfitting Detection
If validation loss starts increasing while training loss continues decreasing, **stop training**. The model is memorizing training data rather than learning patterns. Reduce epochs or increase training data diversity.
:::

## MLOps for LLMs

Production fine-tuned models need the same rigor as traditional ML:

| Practice | What | Why |
|----------|------|-----|
| **Model Registry** | Version every fine-tuned model with metadata | Rollback, audit, comparison |
| **Data Versioning** | Track training data versions alongside models | Reproducibility |
| **Automated Evaluation** | Run eval suite on every new model version | Prevent regressions |
| **Deployment Pipelines** | Blue-green deployment with traffic splitting | Safe rollout |
| **Monitoring** | Track drift, latency, quality metrics post-deploy | Catch degradation early |
| **Retraining Triggers** | Quality drops below threshold → retrain | Maintain accuracy over time |

```bash
# Example: Azure AI Foundry CLI workflow
az ai model fine-tune create \
  --model gpt-4o-mini \
  --training-data ./train.jsonl \
  --validation-data ./val.jsonl \
  --hyperparameters '{"n_epochs": 3, "learning_rate_multiplier": 1.0}'

# Monitor training
az ai model fine-tune show --id <job-id>

# Deploy when ready
az ai model deployment create \
  --model <fine-tuned-model-id> \
  --name my-fine-tuned-deployment
```

## Key Takeaways

1. **Exhaust simpler options first** — prompt engineering + RAG solve 90% of use cases
2. **LoRA/QLoRA is the default** — 95%+ quality at 1% of the cost of full fine-tuning
3. **Data quality > data quantity** — 500 excellent examples beat 10K noisy ones
4. **Evaluate rigorously** — A/B test against the base model before deploying
5. **Treat models as artifacts** — version, register, monitor, retrain

Next: [T2: Responsible AI](./t2-responsible-ai.md) — ensuring your AI systems are safe, fair, and transparent.
