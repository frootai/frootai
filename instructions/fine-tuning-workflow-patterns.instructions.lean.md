---
description: "Play 13 patterns — Fine-tuning patterns — JSONL data prep, LoRA config, eval metrics, A/B comparison, model versioning."
applyTo: "**/*.py, **/*.jsonl"
waf:
  - "reliability"
  - "security"
---

# Play 13 — Fine-Tuning Workflow Patterns — FAI Standards

## Data Preparation Pipeline

Collect → Clean → Format → Validate. Every stage must be idempotent and logged.

```python
import json, hashlib, tiktoken
from pathlib import Path

enc = tiktoken.encoding_for_model("gpt-4o")

def collect_raw_examples(sources: list[Path]) -> list[dict]:
    """Merge examples from multiple sources, deduplicate by content hash."""
    seen, examples = set(), []
    for src in sources:
        for line in src.read_text().splitlines():
            h = hashlib.sha256(line.encode()).hexdigest()[:16]
            if h not in seen:
                seen.add(h)
                examples.append(json.loads(line))
    return examples

def clean_example(ex: dict) -> dict | None:
    """Drop examples with empty assistant, system-only, or token overflow."""
    msgs = ex.get("messages", [])
    assistant_msgs = [m for m in msgs if m["role"] == "assistant"]
    if not assistant_msgs or all(not m["content"].strip() for m in assistant_msgs):
        return None
    total_tokens = sum(len(enc.encode(m["content"])) for m in msgs)
    if total_tokens > 16_384:  # context limit per example
        return None
    return ex

def format_jsonl(examples: list[dict], out: Path) -> int:
    """Write validated JSONL. Returns example count."""
    valid = [ex for ex in (clean_example(e) for e in examples) if ex]
    out.write_text("\n".join(json.dumps(e, ensure_ascii=False) for e in valid))
    return len(valid)
```

## JSONL Validation

Every training file must pass schema validation before upload. Catch issues locally.

```python
REQUIRED_ROLES = {"system", "user", "assistant"}

def validate_jsonl(path: Path) -> list[str]:
    """Return list of errors. Empty list = valid."""
    errors = []
    for i, line in enumerate(path.read_text().splitlines(), 1):
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            errors.append(f"Line {i}: invalid JSON — {e}")
            continue
        msgs = obj.get("messages")
        if not isinstance(msgs, list) or len(msgs) < 2:
            errors.append(f"Line {i}: messages must be list with ≥2 entries")
            continue
        roles = {m.get("role") for m in msgs}
        if not roles.issubset(REQUIRED_ROLES):
            errors.append(f"Line {i}: invalid roles {roles - REQUIRED_ROLES}")
        if msgs[-1].get("role") != "assistant":
            errors.append(f"Line {i}: last message must be assistant")
    return errors
```

## Azure OpenAI Fine-Tuning API

Upload → Create job → Poll until succeeded. Use `DefaultAzureCredential`, never API keys.

```python
from azure.identity import DefaultAzureCredential
from openai import AzureOpenAI

token = DefaultAzureCredential().get_token("https://cognitiveservices.azure.com/.default")
client = AzureOpenAI(
    azure_endpoint=config["endpoint"],
    azure_ad_token=token.token,
    api_version="2024-10-21",
)

# Upload training file
upload = client.files.create(file=open("train.jsonl", "rb"), purpose="fine-tune")

# Create fine-tuning job with hyperparameters from config
job = client.fine_tuning.jobs.create(
    training_file=upload.id,
    model=config["base_model"],  # e.g. "gpt-4o-mini-2024-07-18"
    hyperparameters={
        "n_epochs": config.get("n_epochs", 3),
        "batch_size": config.get("batch_size", "auto"),
        "learning_rate_multiplier": config.get("lr_multiplier", "auto"),
    },
    validation_file=val_upload.id if val_upload else None,
)

# Poll until terminal state
import time
while (status := client.fine_tuning.jobs.retrieve(job.id)).status not in ("succeeded", "failed", "cancelled"):
    print(f"Status: {status.status} | Trained tokens: {status.trained_tokens}")
    time.sleep(60)
```

## Hyperparameter Selection

| Parameter | Default | Guidance |
| --- | --- | --- |
| `n_epochs` | auto (~3) | 1-2 for >10k examples, 3-4 for 100-1k examples, 5+ only for <100 |
| `batch_size` | auto | Start auto; increase if loss is noisy, decrease if overfitting |
| `learning_rate_multiplier` | auto (~0.1) | Lower (0.01-0.05) for subtle style shifts, higher (0.1-0.3) for new capabilities |

Rule: always split 80/10/10 train/val/test. Monitor validation loss — stop if it rises for 2+ consecutive checkpoints.

## Evaluation Pipeline

Compare base vs fine-tuned on identical test prompts. Track metrics per-example.

```python
import mlflow

def evaluate_model(model_id: str, test_set: list[dict], run_name: str) -> dict:
    mlflow.set_experiment("play-13-fine-tuning")
    with mlflow.start_run(run_name=run_name):
        scores = {"exact_match": 0, "total_tokens": 0, "latency_ms": []}
        for ex in test_set:
            prompt = [m for m in ex["messages"] if m["role"] != "assistant"]
            expected = ex["messages"][-1]["content"]
            t0 = time.perf_counter()
            resp = client.chat.completions.create(model=model_id, messages=prompt, temperature=0)
            elapsed = (time.perf_counter() - t0) * 1000
            actual = resp.choices[0].message.content
            scores["total_tokens"] += resp.usage.total_tokens
            scores["latency_ms"].append(elapsed)
            if actual.strip() == expected.strip():
                scores["exact_match"] += 1
        accuracy = scores["exact_match"] / len(test_set)
        avg_latency = sum(scores["latency_ms"]) / len(scores["latency_ms"])
        mlflow.log_metrics({"accuracy": accuracy, "avg_latency_ms": avg_latency,
                            "total_tokens": scores["total_tokens"]})
        return {"accuracy": accuracy, "avg_latency_ms": avg_latency}

base_metrics = evaluate_model(config["base_model"], test_set, "base-model")
ft_metrics = evaluate_model(status.fine_tuned_model, test_set, "fine-tuned")
# Only deploy if fine-tuned improves accuracy by ≥5% absolute
assert ft_metrics["accuracy"] - base_metrics["accuracy"] >= 0.05, "Insufficient improvement"
```

## Checkpoint Management & LoRA Merging

```python
# List checkpoints from a completed job
checkpoints = client.fine_tuning.jobs.list_events(job.id)
# For open-weight models (LLaMA, Mistral) with PEFT/LoRA:
from peft import PeftModel, PeftConfig
from transformers import AutoModelForCausalLM

base = AutoModelForCausalLM.from_pretrained(config["base_hf_model"])
adapter = PeftModel.from_pretrained(base, config["adapter_path"])
merged = adapter.merge_and_unload()  # Single model for inference — no adapter overhead
merged.save_pretrained(config["merged_output_path"])
```

## Cost Estimation

```python
def estimate_cost(jsonl_path: Path, n_epochs: int, price_per_1m: float) -> float:
    """Estimate fine-tuning cost. price_per_1m = cost per 1M training tokens."""
    total_tokens = 0
    for line in jsonl_path.read_text().splitlines():
        msgs = json.loads(line)["messages"]
        total_tokens += sum(len(enc.encode(m["content"])) for m in msgs)
    training_tokens = total_tokens * n_epochs
    return (training_tokens / 1_000_000) * price_per_1m
# gpt-4o-mini-2024-07-18: ~$3.00/1M training tokens (check current pricing)
```

## A/B Deployment

Route traffic between base and fine-tuned using APIM or app-level routing.

```python
import random

def route_request(messages: list[dict], ab_config: dict) -> str:
    """Return model deployment name based on A/B split."""
    if random.random() < ab_config.get("fine_tuned_pct", 0.1):
        return ab_config["fine_tuned_deployment"]
    return ab_config["base_deployment"]
# Log which model served each request for offline analysis
```

## Data Versioning & Automated Retraining

```python
# DVC-based data versioning
# dvc add data/train.jsonl → tracks in .dvc, stores in remote
# dvc push → uploads to Azure Blob / S3

# Automated retraining trigger (e.g., Azure Function on schedule or drift detection)
def should_retrain(drift_score: float, threshold: float = 0.15) -> bool:
    """Trigger retraining when output distribution drift exceeds threshold."""
    return drift_score > threshold
```

## Anti-Patterns

- ❌ Training on raw, unvalidated JSONL — garbage in, garbage out
- ❌ Skipping validation split — no overfitting detection until production
- ❌ Setting high `n_epochs` (>10) without monitoring validation loss
- ❌ Deploying fine-tuned model without A/B comparison against base
- ❌ Hardcoding hyperparameters instead of using `config/fine-tuning.json`
- ❌ No data versioning — can't reproduce training runs
- ❌ Ignoring cost estimation — 100k-example dataset × 5 epochs adds up fast
- ❌ Using API keys instead of `DefaultAzureCredential` for fine-tuning API
- ❌ Merging LoRA adapters without evaluating the merged model separately

## WAF Alignment

| Pillar | Play 13 Implementation |
| --- | --- |
| **Security** | `DefaultAzureCredential` for fine-tuning API; PII scrubbing in training data; Key Vault for endpoint config; private endpoints for file upload |
| **Reliability** | Validation split with early-stop on rising loss; checkpoint selection not just final model; retry on 429/500 during job polling |
| **Cost Optimization** | Token-based cost estimation before training; start with smallest base model; `n_epochs` auto to avoid waste; compare improvement delta before deploying |
| **Operational Excellence** | MLflow experiment tracking with per-run metrics; DVC data versioning; automated drift-triggered retraining; structured logging of all job events |
| **Performance Efficiency** | Batch size tuning for throughput; LoRA merge to eliminate adapter overhead at inference; A/B routing to measure latency impact |
| **Responsible AI** | Bias audit on training data distribution; evaluation on diverse test subsets; human review of fine-tuned outputs before production |
