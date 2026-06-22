---
description: "Python cost optimization — token budgets, model routing, caching, batch embedding, async for throughput."
applyTo: "**/*.py"
waf:
  - "cost-optimization"
---

# Python Cost Optimization — FAI Standards

## Token Budget Enforcement

- Always set `max_tokens` from config — never leave it unset (defaults vary by model and burn budget silently)
- Count tokens before sending with `tiktoken` — reject prompts exceeding budget before they hit the API
- Track `completion_tokens` + `prompt_tokens` from every response; emit as structured telemetry

```python
# ✅ Preferred — budget-aware completion
import tiktoken

def enforce_budget(prompt: str, max_prompt_tokens: int, model: str = "gpt-4o") -> str:
    enc = tiktoken.encoding_for_model(model)
    tokens = enc.encode(prompt)
    if len(tokens) > max_prompt_tokens:
        tokens = tokens[:max_prompt_tokens]
        return enc.decode(tokens)
    return prompt

response = client.chat.completions.create(
    model=config["model"],
    messages=messages,
    max_tokens=config["max_completion_tokens"],  # from config/*.json
)
usage = response.usage
logger.info("token_usage", extra={"prompt": usage.prompt_tokens, "completion": usage.completion_tokens})
```

```python
# ❌ Avoided — no budget, no tracking
response = client.chat.completions.create(model="gpt-4o", messages=messages)
print(response.choices[0].message.content)
```

## Model Routing

- Route by task complexity: `gpt-4o-mini` for classification, extraction, simple Q&A; `gpt-4o` for reasoning, multi-step, code generation
- Load routing rules from `config/openai.json` — never hardcode model names in application code
- Implement fallback chains: primary model → cheaper fallback → cached response

```python
# ✅ Preferred — config-driven model router
def select_model(task: str, config: dict) -> str:
    routing = config["model_routing"]
    return routing.get(task, routing["default"])

# config/openai.json: {"model_routing": {"classify": "gpt-4o-mini", "reason": "gpt-4o", "default": "gpt-4o-mini"}}
model = select_model("classify", config)
```

```python
# ❌ Avoided — hardcoded model, no routing
response = client.chat.completions.create(model="gpt-4o", messages=messages)  # paying 15x for classification
```

## Semantic Caching

- Hash (system_prompt + user_message) with SHA-256 as cache key — skip API call on hit
- Store in Redis with TTL from config (default 3600s) — tune per use case
- Cache embeddings aggressively — they are deterministic for the same input and model

```python
# ✅ Preferred — semantic cache with Redis
import hashlib, json, redis

cache = redis.Redis.from_url(config["redis_url"])

def cached_completion(messages: list[dict], ttl: int = 3600) -> str:
    key = hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest()
    if hit := cache.get(key):
        return hit.decode()
    response = client.chat.completions.create(model=config["model"], messages=messages)
    result = response.choices[0].message.content
    cache.setex(key, ttl, result)
    return result
```

## Batch Embedding

- Always batch embedding calls — single-item calls waste HTTP round trips and hit rate limits faster
- Use `openai.embeddings.create(input=[...])` with batches of up to 2048 items
- Pre-deduplicate inputs before batching — don't pay to embed the same text twice

```python
# ✅ Preferred — batch embeddings with deduplication
def batch_embed(texts: list[str], model: str = "text-embedding-3-small", batch_size: int = 2048) -> dict[str, list[float]]:
    unique = list(set(texts))
    results: dict[str, list[float]] = {}
    for i in range(0, len(unique), batch_size):
        batch = unique[i : i + batch_size]
        resp = client.embeddings.create(input=batch, model=model)
        for item, text in zip(resp.data, batch):
            results[text] = item.embedding
    return results
```

```python
# ❌ Avoided — one-by-one embedding calls
for text in texts:
    resp = client.embeddings.create(input=text, model="text-embedding-ada-002")  # N round trips, old model
```

## Async & Concurrency for Throughput

- Use `asyncio.gather` for independent API calls — don't serialize inherently parallel work
- Use `AsyncOpenAI` client for all async code paths — sync client blocks the event loop
- Limit concurrency with `asyncio.Semaphore` to stay under rate limits

```python
# ✅ Preferred — concurrent with rate-limit semaphore
import asyncio
from openai import AsyncOpenAI

aclient = AsyncOpenAI()
semaphore = asyncio.Semaphore(config.get("max_concurrent_calls", 10))

async def limited_call(messages: list[dict]) -> str:
    async with semaphore:
        resp = await aclient.chat.completions.create(model=config["model"], messages=messages)
        return resp.choices[0].message.content

async def process_batch(items: list[list[dict]]) -> list[str]:
    return await asyncio.gather(*(limited_call(m) for m in items))
```

## Streaming Responses

- Use `stream=True` for user-facing completions — perceived latency drops from seconds to milliseconds
- Accumulate streamed chunks for token counting after response completes

```python
# ✅ Preferred — streaming with token accumulation
def stream_response(messages: list[dict]) -> str:
    chunks: list[str] = []
    stream = client.chat.completions.create(model=config["model"], messages=messages, stream=True)
    for chunk in stream:
        if delta := chunk.choices[0].delta.content:
            chunks.append(delta)
            yield delta  # send to client immediately
    # log total after stream ends
    logger.info("stream_complete", extra={"total_chars": sum(len(c) for c in chunks)})
```

## Prompt Compression

- Strip unnecessary whitespace, duplicate instructions, and verbose examples from system prompts
- Use structured output (`response_format={"type": "json_object"}`) to avoid parsing overhead and retries
- Prefer few-shot with 1-2 examples over verbose instructions — cheaper token-wise, often more effective

## Anti-Patterns

- ❌ Leaving `max_tokens` unset — model may generate thousands of tokens for a yes/no question
- ❌ Using `gpt-4o` for classification, tagging, or extraction — `gpt-4o-mini` is 15x cheaper and sufficient
- ❌ Embedding one document at a time in a loop instead of batching
- ❌ Calling the API for identical prompts without caching — especially deterministic tasks (temperature=0)
- ❌ Using synchronous `OpenAI()` client inside `async def` functions — blocks the event loop
- ❌ Not tracking token usage per request — impossible to optimize what you don't measure
- ❌ Using `text-embedding-ada-002` instead of `text-embedding-3-small` — same quality, 5x cheaper
- ❌ Verbose system prompts with repeated instructions instead of concise few-shot examples
- ❌ Ignoring `response_format` for structured output — regex parsing fails, retries cost extra tokens
- ❌ Spawning a new `OpenAI()` client per request instead of reusing a module-level singleton

## WAF Alignment

| Pillar | Practice | Impact |
|--------|----------|--------|
| Cost Optimization | `max_tokens` from config, never unlimited | Prevents runaway token spend |
| Cost Optimization | Model routing (`gpt-4o-mini` vs `gpt-4o`) | 10-15x cost reduction for simple tasks |
| Cost Optimization | Semantic caching with Redis TTL | Eliminates duplicate API calls |
| Cost Optimization | Batch embeddings (up to 2048/call) | Reduces HTTP overhead and rate limit hits |
| Cost Optimization | `text-embedding-3-small` over `ada-002` | 5x cheaper, comparable quality |
| Performance | `AsyncOpenAI` + `asyncio.gather` | Parallel throughput without blocking |
| Performance | `stream=True` for user-facing responses | Sub-second perceived latency |
| Performance | Client singleton, connection reuse | Eliminates per-request TLS handshake |
| Operational Excellence | Token usage telemetry per request | FinOps visibility, budget alerting |
| Operational Excellence | Config-driven model/budget parameters | No redeployment for tuning |
