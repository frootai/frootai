---
name: fai-build-tokenizer
description: |
  Build tokenizer workflows for prompt budgeting, truncation strategies, and
  model-specific token counting. Use when managing token limits, estimating
  costs, or implementing context window packing.
---

# Tokenizer Workflows

Token counting, budget management, and context window optimization.

## When to Use

- Managing token budgets for prompts with RAG context
- Estimating API costs based on token counts
- Truncating content to fit model context windows
- Packing multiple documents into a single prompt

---

## Token Counting

```python
import tiktoken

def count_tokens(text: str, model: str = "gpt-4o") -> int:
    enc = tiktoken.encoding_for_model(model)
    return len(enc.encode(text))

def estimate_cost(prompt_tokens: int, completion_tokens: int,
                  model: str = "gpt-4o") -> float:
    rates = {"gpt-4o": (0.0025, 0.01), "gpt-4o-mini": (0.00015, 0.0006)}
    p_rate, c_rate = rates.get(model, (0.0025, 0.01))
    return (prompt_tokens * p_rate + completion_tokens * c_rate) / 1000
```

## Context Window Packing

```python
def pack_context(chunks: list[str], max_tokens: int = 3000,
                 model: str = "gpt-4o") -> list[str]:
    """Pack as many chunks as fit within token budget."""
    enc = tiktoken.encoding_for_model(model)
    selected, used = [], 0
    for chunk in chunks:
        tokens = len(enc.encode(chunk))
        if used + tokens > max_tokens:
            break
        selected.append(chunk)
        used += tokens
    return selected
```

## Smart Truncation

```python
def truncate_to_tokens(text: str, max_tokens: int, model: str = "gpt-4o") -> str:
    enc = tiktoken.encoding_for_model(model)
    tokens = enc.encode(text)
    if len(tokens) <= max_tokens:
        return text
    return enc.decode(tokens[:max_tokens])
```

## Budget Tracking

```python
@dataclass
class TokenBudget:
    limit: int
    used: int = 0
    def spend(self, n: int) -> bool:
        self.used += n
        return self.used <= self.limit
    @property
    def remaining(self): return max(0, self.limit - self.used)

budget = TokenBudget(limit=100000)
# Track per-request usage
budget.spend(response.usage.total_tokens)
```

## Model Context Windows

| Model | Context Window | Output Max |
|-------|---------------|------------|
| gpt-4o | 128K | 16K |
| gpt-4o-mini | 128K | 16K |
| text-embedding-3-small | 8K | N/A |
| Claude 3.5 Sonnet | 200K | 8K |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Token count mismatch | Wrong encoding for model | Use tiktoken.encoding_for_model() |
| Context overflow | No truncation before API call | Truncate or pack to max_tokens - output_buffer |
| Cost higher than expected | Not counting system prompt | Include system + few-shot in budget |
| Slow tokenization | Tokenizing in a loop | Batch encode, cache encoder instance |
