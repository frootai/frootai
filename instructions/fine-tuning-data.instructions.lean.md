---
description: "Fine-tuning data standards — JSONL format, quality validation, class balance, edge case inclusion."
applyTo: "**/*.jsonl, **/*.py"
waf:
  - "reliability"
  - "operational-excellence"
---

# Fine-Tuning Data Preparation — FAI Standards

## JSONL Format — Chat Completion Structure

Every training example must follow the OpenAI chat completion format. One JSON object per line, no trailing commas, UTF-8 encoded.

```python
import json

def create_training_example(system: str, user: str, assistant: str) -> dict:
    """Build a single JSONL training example."""
    return {
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ]
    }

# Write JSONL — one JSON object per line, newline-terminated
with open("train.jsonl", "w", encoding="utf-8") as f:
    for ex in examples:
        f.write(json.dumps(ex, ensure_ascii=False) + "\n")
```

Validate every line parses and contains the required `messages` array with at least one `user` and one `assistant` turn. Reject examples missing any role.

## Data Quality Pipeline

```python
import hashlib, tiktoken

enc = tiktoken.encoding_for_model("gpt-4o")

def token_count(messages: list[dict]) -> int:
    """Count tokens for a chat completion training example (approx)."""
    return sum(len(enc.encode(m["content"])) + 4 for m in messages) + 2

def deduplicate(examples: list[dict]) -> list[dict]:
    """Remove exact-duplicate examples by content hash."""
    seen = set()
    unique = []
    for ex in examples:
        h = hashlib.sha256(json.dumps(ex, sort_keys=True).encode()).hexdigest()
        if h not in seen:
            seen.add(h)
            unique.append(ex)
    return unique

def filter_by_length(examples: list[dict], min_tokens: int = 10, max_tokens: int = 4096) -> list[dict]:
    """Drop examples outside token bounds — too short = noise, too long = truncation."""
    return [ex for ex in examples if min_tokens <= token_count(ex["messages"]) <= max_tokens]

def validate_format(examples: list[dict]) -> list[str]:
    """Return list of errors. Empty = valid."""
    errors = []
    for i, ex in enumerate(examples):
        msgs = ex.get("messages", [])
        roles = [m.get("role") for m in msgs]
        if "user" not in roles:
            errors.append(f"Example {i}: missing user message")
        if "assistant" not in roles:
            errors.append(f"Example {i}: missing assistant message")
        if any(not m.get("content", "").strip() for m in msgs):
            errors.append(f"Example {i}: empty content field")
    return errors
```

## PII Scrubbing Before Training

Strip PII before any data leaves your control. Use Presidio or Azure AI Language PII detection — never roll your own regex-only solution.

```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

def scrub_pii(text: str, language: str = "en") -> str:
    """Detect and redact PII (emails, phones, SSNs, names, addresses)."""
    results = analyzer.analyze(text=text, language=language,
                               entities=["EMAIL_ADDRESS", "PHONE_NUMBER", "PERSON",
                                         "CREDIT_CARD", "US_SSN", "LOCATION"])
    return anonymizer.anonymize(text=text, analyzer_results=results).text

# Apply to every message content BEFORE writing JSONL
for ex in examples:
    for msg in ex["messages"]:
        msg["content"] = scrub_pii(msg["content"])
```

## Dataset Splits

```python
import random

def split_dataset(examples: list[dict], val_ratio: float = 0.2, seed: int = 42) -> tuple:
    """80/20 train/validation split. Stratify manually if class-imbalanced."""
    random.seed(seed)
    shuffled = examples.copy()
    random.shuffle(shuffled)
    split_idx = int(len(shuffled) * (1 - val_ratio))
    return shuffled[:split_idx], shuffled[split_idx:]

train, val = split_dataset(clean_examples)
# Write both files
for name, data in [("train.jsonl", train), ("val.jsonl", val)]:
    with open(name, "w", encoding="utf-8") as f:
        for ex in data:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")
```

Minimum dataset sizes: 50 examples for basic tasks, 500+ for complex domain adaptation. Validation set minimum: 20 examples.

## Token Budget Analysis

```python
def dataset_token_report(examples: list[dict]) -> dict:
    """Per-example and aggregate token stats for cost estimation."""
    counts = [token_count(ex["messages"]) for ex in examples]
    return {
        "total_examples": len(counts),
        "total_tokens": sum(counts),
        "mean_tokens": sum(counts) / max(len(counts), 1),
        "max_tokens": max(counts, default=0),
        "min_tokens": min(counts, default=0),
        "estimated_epochs_cost_1k": round(sum(counts) / 1000 * 0.008, 2),  # gpt-4o-mini rate
    }
```

## Azure OpenAI Fine-Tuning API

```python
from openai import AzureOpenAI

client = AzureOpenAI()  # Uses AZURE_OPENAI_ENDPOINT + DefaultAzureCredential

# 1. Upload training file
train_file = client.files.create(file=open("train.jsonl", "rb"), purpose="fine-tune")
val_file = client.files.create(file=open("val.jsonl", "rb"), purpose="fine-tune")

# 2. Create fine-tuning job with hyperparameters
job = client.fine_tuning.jobs.create(
    training_file=train_file.id,
    validation_file=val_file.id,
    model="gpt-4o-mini-2024-07-18",
    hyperparameters={
        "n_epochs": 3,                # 2-4 for most tasks; more = overfitting risk
        "batch_size": "auto",          # Let API choose; override only with data
        "learning_rate_multiplier": 1.8,  # 0.5-2.0 range; lower for small datasets
    },
    suffix="my-domain-v1",
)

# 3. Poll until complete
import time
while (status := client.fine_tuning.jobs.retrieve(job.id)).status not in ("succeeded", "failed"):
    time.sleep(60)
```

## Hyperparameter Selection Guide

| Parameter | Default | Guidance |
| --- | --- | --- |
| `n_epochs` | auto (~3) | 2 for >10k examples, 3-4 for <1k, watch val loss for plateau |
| `batch_size` | auto | Larger = stable gradients but slower convergence |
| `learning_rate_multiplier` | auto (~1.8) | Reduce to 0.5–1.0 for small datasets to avoid overfitting |

## LoRA / QLoRA Configuration Basics

For open-source models (Llama, Mistral) fine-tuned via Azure AI Foundry or custom infra:

- **LoRA rank (`r`)**: 8–64. Start at 16. Higher = more parameters = more expressive but slower.
- **LoRA alpha**: Typically `2 * r`. Controls scaling of adapter weights.
- **Target modules**: `q_proj, v_proj` minimum. Add `k_proj, o_proj, gate_proj` for deeper adaptation.
- **QLoRA**: 4-bit NF4 quantization + LoRA. Use `bitsandbytes` with `bnb_4bit_compute_dtype=bfloat16`. Reduces VRAM by ~60% with <1% quality loss.
- **Dropout**: 0.05–0.1 on LoRA layers to prevent overfitting small datasets.

## Evaluation After Fine-Tuning

- Compare validation loss curves — decreasing = learning, rising = overfitting → reduce epochs
- Run the same eval benchmark on base model AND fine-tuned model — quantify improvement
- Measure task-specific metrics: accuracy, F1, BLEU/ROUGE, or custom rubric scores
- Track `completion_tokens` cost — fine-tuned models should produce tighter, cheaper outputs
- A/B test in staging before production rollout — use feature flags, not hard cutover

## Data Augmentation Techniques

- **Paraphrase**: Use a larger model to rephrase user queries while keeping assistant answers fixed
- **Role-play**: Vary system prompts across formal/casual/technical tones
- **Edge cases**: Deliberately include adversarial, ambiguous, and boundary inputs (~10% of dataset)
- **Negative examples**: Include examples where the correct response is refusal or "I don't know"
- Never augment by duplicating — it inflates loss without adding signal

## Anti-Patterns

- ❌ Training on data containing PII, credentials, or internal URLs
- ❌ Skipping validation split — no way to detect overfitting without held-out data
- ❌ Using fewer than 50 examples — model won't converge meaningfully
- ❌ Inconsistent system prompts across examples — confuses the model's persona
- ❌ Including very long examples (>4096 tokens) without checking truncation behavior
- ❌ Fine-tuning when few-shot prompting achieves the same quality — wasted cost
- ❌ Not versioning datasets — no reproducibility, no rollback capability
- ❌ Training on synthetic data only without human-reviewed ground truth

## WAF Alignment

| Pillar | Fine-Tuning Practices |
|--------|----------------------|
| **Security** | PII scrubbing before upload. `DefaultAzureCredential` for API auth. Training data stored in access-controlled Azure Blob with encryption at rest. Never log training examples. |
| **Reliability** | Validate JSONL format before upload. Checksum files for integrity. Retry file upload on transient failures. Keep dataset versions in immutable storage. |
| **Cost Optimization** | Token count analysis before job creation — estimate cost upfront. Start with gpt-4o-mini (cheapest). Use LoRA/QLoRA for open models to reduce GPU hours. Limit epochs to 2-3. |
| **Operational Excellence** | Version datasets with timestamps (`train-v3-20260413.jsonl`). Track experiments in MLflow or AI Foundry. Automate data pipeline: scrub → validate → split → upload → train → evaluate. |
| **Responsible AI** | Audit training data for bias, toxicity, and harmful content before training. Include refusal examples. Evaluate fine-tuned model against Content Safety benchmarks. Document data provenance. |
