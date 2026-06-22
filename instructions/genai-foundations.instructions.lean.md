---
description: "GenAI foundations coding — token counting, model parameter configuration, inference optimization."
applyTo: "**/*.py, **/*.ts"
waf:
  - "performance-efficiency"
  - "cost-optimization"
---

# GenAI Foundations — FAI Standards

## Token Counting & Budget Enforcement

- Count tokens before every request: `available = context_window - system - user - max_tokens`
- Truncate or summarize context when approaching limits, not after hitting errors

```python
import tiktoken
def count_tokens(text: str, model: str = "gpt-4o") -> int:
    return len(tiktoken.encoding_for_model(model).encode(text))

def enforce_budget(messages: list[dict], max_ctx: int = 128_000, reserve: int = 4_096) -> list[dict]:
    budget = max_ctx - reserve
    total = sum(count_tokens(m["content"]) for m in messages)
    while total > budget and len(messages) > 2:  # keep system + latest user
        total -= count_tokens(messages.pop(1)["content"])
    return messages
```

```typescript
import { encoding_for_model } from "tiktoken";
function countTokens(text: string, model = "gpt-4o"): number {
  const enc = encoding_for_model(model);
  const n = enc.encode(text).length; enc.free(); return n;
}
```

## Model Parameter Configuration

- All params in `config/*.json` — never hardcode temperature, top_p, max_tokens
- Pin deployment names, not model names: `"deployment": "gpt-4o-2024-08-06"`
- `temperature=0` + `seed` for deterministic tasks; `≤0.7` for creative (document why)
- Tune `temperature` OR `top_p`, never both simultaneously

```json
{ "deployment": "gpt-4o-2024-08-06", "temperature": 0, "max_tokens": 4096, "seed": 42 }
```

## Message Structure & Prompt Templates

- System message first, then alternating user/assistant — never skip system
- System messages under 2000 tokens — move examples to few-shot pairs
- Use XML delimiters for injected content, not raw string concatenation

```python
messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "user", "content": f"<document>\n{doc_text}\n</document>\n\nExtract entities."},
]
# ❌ Avoided: prompt = f"You are an expert. {user_input}"  — loses role separation
```

## Structured Output

- Set `response_format: { type: "json_object" }` when expecting JSON
- Prefer function calling with Pydantic/Zod schemas over free-form JSON
- Validate LLM output against schema before downstream use

```python
from pydantic import BaseModel
class Entity(BaseModel):
    name: str; entity_type: str; confidence: float

resp = client.chat.completions.create(
    model=config["deployment"], messages=messages,
    response_format={"type": "json_object"}, temperature=0, seed=42,
)
entity = Entity.model_validate_json(resp.choices[0].message.content)
```

```typescript
import { z } from "zod";
const EntitySchema = z.object({ name: z.string(), type: z.string(), confidence: z.number() });
const entity = EntitySchema.parse(JSON.parse(choice.message.content ?? "{}"));
```

## Streaming Responses

- Stream all user-facing responses — reduces time-to-first-token
- Accumulate chunks for logging after stream; check `finish_reason` per chunk

```python
collected = []
async for chunk in await client.chat.completions.create(
    model=config["deployment"], messages=messages, stream=True):
    if delta := chunk.choices[0].delta.content:
        collected.append(delta); yield delta
```

## Embeddings

- Batch max 2048 items/call; pin model version — switching invalidates vector index

```python
resp = client.embeddings.create(model=config["embedding_deployment"], input=texts[:2048])
vectors = [item.embedding for item in resp.data]
```

## Retry & Rate Limits

- Retry only 429 and 5xx — never retry 400/401/403. Read `Retry-After` header
- Timeouts: 30s chat, 60s embedding batch, 120s image generation

```python
from openai import RateLimitError
for attempt in range(3):
    try: return client.chat.completions.create(**params)
    except RateLimitError as e:
        time.sleep(float(e.response.headers.get("Retry-After", 2**attempt)))
```

## Content Filter & Context Window

- Check `finish_reason` on every response — `"content_filter"` = output blocked
- Return graceful error on filter, never raw exception. Log for audit
- Model limits: gpt-4o=128K, gpt-4o-mini=128K, o3-mini=200K
- Multi-turn: sliding window (system + last N turns). RAG: 20% system / 60% context / 20% response

## Anti-Patterns

- ❌ Calling LLM without counting tokens — context overflow errors
- ❌ Hardcoding `model: "gpt-4o"` instead of deployment name from config
- ❌ `temperature > 0` for classification/extraction — nondeterministic results
- ❌ Parsing LLM JSON without schema validation — brittle failures
- ❌ Ignoring `finish_reason: "content_filter"` — silent data loss
- ❌ Retrying 400 Bad Request — wastes tokens, never succeeds
- ❌ No `max_tokens` cap — runaway cost and latency
- ❌ Switching embedding models without reindexing vectors
- ❌ String-concatenating user input into prompts — injection risk
- ❌ Logging full prompts/completions — PII exposure

## WAF Alignment

| Pillar | GenAI Practice |
|--------|---------------|
| **Security** | Validate LLM output before use; Content Safety on user-facing responses; never log raw prompts |
| **Reliability** | Retry 429/5xx with Retry-After; fallback model on failure; enforce context limits pre-call |
| **Cost** | Token counting before calls; model routing (mini→simple, full→complex); max_tokens caps; cache |
| **Performance** | Streaming for users; batch embeddings; async parallel for independent calls |
| **Ops Excellence** | Log token usage per request; track finish_reason; pin deployment versions; config-driven params |
| **Responsible AI** | Content filter on all outputs; human-in-the-loop for high-stakes; bias eval in CI |
