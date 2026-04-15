---
name: fai-inference-optimization
description: |
  Optimize AI inference for latency, throughput, and cost with batching, caching,
  model routing, quantization, and streaming. Use when production AI endpoints
  need faster responses or lower costs.
---

# Inference Optimization

Reduce latency, increase throughput, and cut costs for AI inference.

## When to Use

- Production AI endpoint latency exceeds SLO
- Token costs growing faster than usage
- Need to support higher concurrent users
- Evaluating model compression or distillation

---

## Optimization Techniques

| Technique | Latency Reduction | Cost Reduction | Effort |
|-----------|------------------|---------------|--------|
| Streaming | Perceived -80% | None | Low |
| Model routing (4o→mini) | None | 40-60% | Low |
| Semantic caching | -90% for cache hits | -90% for hits | Medium |
| Prompt compression | -20-30% | -20-30% | Medium |
| Batching | None | -30% | Medium |
| Quantization (INT4/INT8) | -30-50% | -30-50% | High |

## Streaming Response

```python
async def stream_response(prompt: str):
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        stream=True,
    )
    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
```

## Model Routing

```python
def smart_route(prompt: str) -> str:
    complexity = estimate_complexity(prompt)
    if complexity < 0.3:
        return "gpt-4o-mini"   # Simple: classification, extraction
    elif complexity < 0.7:
        return "gpt-4o-mini"   # Medium: Q&A, summarization
    else:
        return "gpt-4o"        # Complex: analysis, code generation

def estimate_complexity(prompt: str) -> float:
    signals = [len(prompt) > 2000, "analyze" in prompt.lower(),
               "compare" in prompt.lower(), prompt.count("\n") > 20]
    return sum(signals) / len(signals)
```

## Semantic Cache

```python
import hashlib

class ResponseCache:
    def __init__(self, ttl_hours: int = 24):
        self.cache = {}
        self.ttl = ttl_hours * 3600

    def get(self, prompt: str) -> str | None:
        key = hashlib.sha256(prompt.strip().lower().encode()).hexdigest()[:16]
        entry = self.cache.get(key)
        if entry and time.time() - entry["ts"] < self.ttl:
            return entry["response"]
        return None

    def set(self, prompt: str, response: str):
        key = hashlib.sha256(prompt.strip().lower().encode()).hexdigest()[:16]
        self.cache[key] = {"response": response, "ts": time.time()}
```

## Prompt Compression

```python
def compress_context(context: str, max_tokens: int = 2000) -> str:
    """Summarize context to fit within token budget."""
    if count_tokens(context) <= max_tokens:
        return context
    return llm(f"Summarize in under {max_tokens} tokens, preserving key facts:\n{context}")
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| P95 > 3s | No streaming, large prompts | Enable streaming, compress context |
| High cost/query | Always using gpt-4o | Route simple queries to mini |
| Cache miss rate > 80% | Prompts too variable | Normalize prompts before caching |
| Quality drops with mini | Task too complex | Keep gpt-4o for complex tasks only |
