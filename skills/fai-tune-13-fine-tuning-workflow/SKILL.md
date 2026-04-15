---
name: fai-tune-13-fine-tuning-workflow
description: "Tune Play 13 (Fine-Tuning Workflow) training hyperparameters, dataset validation, LoRA config, and evaluation metrics."
---

# FAI Tune — Play 13: Fine-Tuning Workflow

## TuneKit Configuration Files

```
solution-plays/13-fine-tuning-workflow/config/
├── training.json         # Hyperparameters and training config
├── dataset.json          # Dataset validation and preprocessing
├── lora.json             # LoRA/QLoRA adapter configuration
├── evaluation.json       # Evaluation metrics and thresholds
└── guardrails.json       # Quality and cost guardrails
```

## Step 1 — Set Training Hyperparameters

```json
// config/training.json
{
  "base_model": "gpt-4o-mini-2024-07-18",
  "method": "supervised_fine_tuning",
  "hyperparameters": {
    "n_epochs": 3,
    "batch_size": 4,
    "learning_rate_multiplier": 1.0,
    "warmup_ratio": 0.1,
    "weight_decay": 0.01
  },
  "training_file": "data/train.jsonl",
  "validation_file": "data/validation.jsonl",
  "suffix": "custom-assistant-v1",
  "seed": 42
}
```

**Hyperparameter tuning guidance:**

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `n_epochs` | 1-10 | 3 | Start with 3; increase if validation loss still dropping |
| `batch_size` | 1-16 | 4 | Larger = faster training but uses more memory |
| `learning_rate_multiplier` | 0.1-2.0 | 1.0 | Lower for large datasets; higher for small |
| `seed` | any int | 42 | Pin for reproducibility |

## Step 2 — Validate Dataset Quality

```json
// config/dataset.json
{
  "format": "chat_completion",
  "min_examples": 50,
  "max_examples": 100000,
  "validation_split": 0.20,
  "quality_checks": {
    "min_message_length": 10,
    "max_message_length": 32768,
    "require_system_message": true,
    "require_assistant_response": true,
    "max_token_count_per_example": 16384,
    "check_duplicates": true,
    "max_duplicate_rate": 0.05
  },
  "preprocessing": {
    "strip_whitespace": true,
    "normalize_unicode": true,
    "remove_empty_messages": true
  }
}
```

```python
# Validate dataset before submitting
import json

def validate_dataset(filepath, config):
    with open(filepath) as f:
        examples = [json.loads(line) for line in f]

    errors = []
    if len(examples) < config["min_examples"]:
        errors.append(f"Too few examples: {len(examples)} < {config['min_examples']}")

    for i, ex in enumerate(examples):
        messages = ex.get("messages", [])
        if not any(m["role"] == "assistant" for m in messages):
            errors.append(f"Example {i}: missing assistant response")
        total_tokens = sum(len(m["content"].split()) for m in messages)
        if total_tokens > config["quality_checks"]["max_token_count_per_example"]:
            errors.append(f"Example {i}: exceeds max token count")

    if errors:
        print(f"FAIL: {len(errors)} validation errors")
        for e in errors[:10]:
            print(f"  - {e}")
    else:
        print(f"PASS: {len(examples)} examples validated")
    return len(errors) == 0
```

## Step 3 — Configure LoRA Adapters (Open-Source Models)

```json
// config/lora.json
{
  "method": "qlora",
  "lora_r": 16,
  "lora_alpha": 32,
  "lora_dropout": 0.05,
  "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"],
  "quantization": {
    "bits": 4,
    "type": "nf4",
    "double_quantization": true
  },
  "gradient_checkpointing": true,
  "max_grad_norm": 1.0
}
```

| Parameter | Range | Default | Guidance |
|-----------|-------|---------|----------|
| `lora_r` | 4-64 | 16 | Higher = more capacity but slower training |
| `lora_alpha` | r to 2*r | 32 | Typically 2x lora_r |
| `lora_dropout` | 0.0-0.1 | 0.05 | Small dropout helps prevent overfitting |
| `bits` | 4 or 8 | 4 | 4-bit is usually sufficient (QLoRA) |

## Step 4 — Set Evaluation Metrics

```json
// config/evaluation.json
{
  "metrics": ["accuracy", "f1", "perplexity", "bleu"],
  "eval_dataset": "data/test.jsonl",
  "thresholds": {
    "accuracy": 0.85,
    "f1": 0.80,
    "perplexity_max": 15.0
  },
  "comparison_baseline": "base_model",
  "regression_check": true,
  "human_eval_sample_size": 50
}
```

## Guardrails

```json
// config/guardrails.json
{
  "quality": {
    "min_accuracy_improvement": 0.05,
    "max_perplexity": 15.0,
    "no_regression_on_general_tasks": true
  },
  "safety": {
    "content_safety_eval": true,
    "bias_detection": true,
    "harmful_output_rate_max": 0.001
  },
  "cost": {
    "max_training_hours": 24,
    "max_training_cost_usd": 500,
    "max_gpu_hours": 48
  }
}
```

## Validation Checklist

| Check | Expected | Command |
|-------|----------|---------|
| Dataset size | 50-100K examples | `wc -l data/train.jsonl` |
| Validation split | 20% | `wc -l data/validation.jsonl` |
| Accuracy improvement | >=5% over base | Run evaluation pipeline |
| Content safety | <=0.1% harmful | Run safety evaluation |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Overfitting | Too many epochs or small dataset | Reduce `n_epochs` to 2 or add more examples |
| Underfitting | Learning rate too low | Increase `learning_rate_multiplier` to 1.5 |
| OOM during training | Batch size too large | Reduce `batch_size` to 2 and enable gradient checkpointing |
| Regression on general tasks | Catastrophic forgetting | Use LoRA instead of full fine-tuning |
