---
name: fai-fine-tune-llm
description: |
  Design and execute LLM fine-tuning workflows with dataset preparation,
  training configuration, evaluation gates, and model registry. Use when
  customizing models for domain-specific tasks on Azure OpenAI.
---

# LLM Fine-Tuning Workflow

Fine-tune models with curated datasets, training config, and evaluation gates.

## When to Use

- Customizing GPT models for domain-specific tasks
- Improving quality beyond what prompting achieves
- Reducing token costs by distilling from larger to smaller models
- Creating specialized classification or extraction models

---

## Dataset Preparation

```python
import json

def prepare_training_data(examples: list[dict], output_path: str):
    """Convert to JSONL format for Azure OpenAI fine-tuning."""
    with open(output_path, "w") as f:
        for ex in examples:
            entry = {
                "messages": [
                    {"role": "system", "content": ex["system_prompt"]},
                    {"role": "user", "content": ex["input"]},
                    {"role": "assistant", "content": ex["output"]},
                ]
            }
            f.write(json.dumps(entry) + "\n")

# Quality checks
def validate_dataset(path: str) -> dict:
    with open(path) as f:
        rows = [json.loads(l) for l in f]
    issues = []
    for i, row in enumerate(rows):
        msgs = row.get("messages", [])
        if len(msgs) < 2:
            issues.append(f"Row {i}: needs at least user + assistant")
        for m in msgs:
            if not m.get("content", "").strip():
                issues.append(f"Row {i}: empty content in {m.get('role')}")
    return {"total": len(rows), "issues": len(issues), "details": issues[:10]}
```

## Azure OpenAI Fine-Tuning

```bash
# Upload training file
az openai file create --file training.jsonl --purpose fine-tune

# Create fine-tuning job
az openai fine-tuning create \
  --training-file file-abc123 \
  --model gpt-4o-mini-2024-07-18 \
  --hyperparameters '{"n_epochs": 3, "learning_rate_multiplier": 1.0}'

# Monitor job
az openai fine-tuning show --job ftjob-xyz789
```

## Evaluation Gate

```python
def evaluate_fine_tuned(base_model: str, fine_tuned_model: str,
                         test_set: list[dict], judge) -> dict:
    base_scores, ft_scores = [], []
    for row in test_set:
        base_out = generate(base_model, row["input"])
        ft_out = generate(fine_tuned_model, row["input"])
        base_scores.append(judge(base_out, row["expected"]))
        ft_scores.append(judge(ft_out, row["expected"]))
    return {
        "base_avg": sum(base_scores) / len(base_scores),
        "fine_tuned_avg": sum(ft_scores) / len(ft_scores),
        "improvement": (sum(ft_scores) - sum(base_scores)) / len(ft_scores),
        "deploy_recommended": sum(ft_scores) > sum(base_scores),
    }
```

## Dataset Size Guide

| Task | Min Examples | Recommended |
|------|-------------|-------------|
| Classification | 50 | 200-500 |
| Extraction | 100 | 500-1000 |
| Conversation style | 50 | 200-500 |
| Code generation | 200 | 1000+ |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No improvement | Dataset too small or noisy | Clean data, increase to 500+ examples |
| Overfitting | Too many epochs | Reduce to 2-3 epochs, add validation set |
| Regression on general tasks | Catastrophic forgetting | Evaluate on general + domain test sets |
| High training cost | Too many examples or epochs | Start with 200 examples, 2 epochs |
