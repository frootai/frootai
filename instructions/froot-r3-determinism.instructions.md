---
description: "Determinism standards — temperature=0+seed, structured output, validation pipeline, grounding checks."
applyTo: "**/*.py, **/*.ts, **/*.json"
waf:
  - "reliability"
  - "responsible-ai"
---

# Deterministic AI — FAI Standards

## 1. Reproducible LLM Calls

Every LLM call MUST pin `temperature=0` and supply a `seed`. Log the `system_fingerprint` returned by the API for audit.

```python
# Python — deterministic call with seed pinning
response = client.chat.completions.create(
    model=config["model"],
    messages=messages,
    temperature=0,
    seed=config.get("seed", 42),
    max_tokens=config["max_tokens"],
)
fingerprint = response.system_fingerprint  # log for reproducibility audit
```

```typescript
// TypeScript — deterministic call with seed pinning
const response = await client.chat.completions.create({
  model: config.model,
  messages,
  temperature: 0,
  seed: config.seed ?? 42,
  max_tokens: config.maxTokens,
});
const fingerprint = response.system_fingerprint; // log for reproducibility audit
```

- Store `(prompt_hash, seed, system_fingerprint, model_version)` per request for replay
- If the upstream model updates (fingerprint drift), alert — do NOT silently continue

## 2. Structured Output Enforcement

Never parse free-text LLM output with regex. Use the API's structured output or function-calling mode.

```python
# Python — Pydantic model as structured output schema
from pydantic import BaseModel, Field

class TicketClassification(BaseModel):
    category: str = Field(..., pattern="^(billing|technical|account)$")
    confidence: float = Field(..., ge=0.0, le=1.0)
    reasoning: str = Field(..., min_length=10)

response = client.beta.chat.completions.parse(
    model=config["model"],
    messages=messages,
    response_format=TicketClassification,
    temperature=0,
    seed=42,
)
result: TicketClassification = response.choices[0].message.parsed
```

```typescript
// TypeScript — Zod schema as structured output
import { z } from "zod";

const TicketClassification = z.object({
  category: z.enum(["billing", "technical", "account"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(10),
});

const response = await client.beta.chat.completions.parse({
  model: config.model,
  messages,
  response_format: zodResponseFormat(TicketClassification, "ticket"),
  temperature: 0,
  seed: 42,
});
const result = response.choices[0].message.parsed;
```

## 3. Output Validation with Retry

Validate every LLM output against the schema. On validation failure, retry up to `max_retries` (default 2) with the error fed back as context.

```python
for attempt in range(config.get("max_retries", 2) + 1):
    response = call_llm(messages, temperature=0, seed=42)
    try:
        result = TicketClassification.model_validate_json(response.content)
        break
    except ValidationError as e:
        messages.append({"role": "user", "content": f"Fix: {e.errors()}"})
else:
    raise DeterminismError("LLM output failed validation after retries")
```

## 4. Deterministic Tool Calling

- Tools MUST be invoked in a **fixed, declared order** — never randomize or shuffle
- Tool results are **idempotent**: same input → same output, no side effects on read operations
- Log every tool call with `(tool_name, input_hash, output_hash, duration_ms)`
- If a tool has side effects (write/delete), guard with an idempotency key

## 5. Fixed Embedding & Chunking

- Pin embedding model version explicitly: `text-embedding-3-small` not `text-embedding-latest`
- Pin `dimensions` parameter (e.g., `1536`) — never let the API default
- Use deterministic chunking: fixed `chunk_size` + `chunk_overlap` from config, no random sampling
- Sentence splitters MUST use the same locale and tokenizer version across environments
- Record `(model_version, dimensions, chunk_size, chunk_overlap)` in index metadata

## 6. Config-Driven Randomness Control

All randomness parameters live in `config/*.json` — never hardcoded. Any parameter that affects output distribution:

```json
{
  "model": "gpt-4o-2024-11-20",
  "temperature": 0,
  "seed": 42,
  "top_p": 1,
  "max_tokens": 2048,
  "embedding_model": "text-embedding-3-small",
  "embedding_dimensions": 1536,
  "chunk_size": 512,
  "chunk_overlap": 64,
  "max_retries": 2,
  "deterministic_tool_order": true
}
```

## 7. Testing for Determinism

### Snapshot Testing for Prompts
- Pin prompt templates in version control — any change triggers a diff review
- Snapshot-test rendered prompts (with variables substituted) against `.snap` files
- CI fails on unexpected prompt drift

### Pinned Response Fixtures
- Record golden LLM responses as JSON fixtures in `tests/fixtures/`
- Unit tests mock the LLM client to return fixtures — zero network calls
- Re-record fixtures explicitly with `RECORD_FIXTURES=1` — never auto-update

### Semantic Diff for Output Comparison
- Exact string match is too brittle for natural language. Use embedding cosine similarity ≥ 0.95 threshold
- For structured output, compare parsed objects field-by-field, not raw strings
- Log both expected and actual with diff when threshold fails

### A/B Test Isolation
- A/B variants MUST use separate `seed` values — never share seeds across variants
- Each variant logs its own `(variant_id, seed, model, config_hash)` tuple
- Statistical significance required before promoting a variant (p < 0.05, n ≥ 100)

## 8. Preferred Patterns

- ✅ `temperature=0, seed=N` on every LLM call — no exceptions
- ✅ Pydantic/Zod schema validation on every LLM response
- ✅ Idempotency keys on write operations
- ✅ Pinned model versions (`gpt-4o-2024-11-20` not `gpt-4o`)
- ✅ Config files for all tunable parameters — seed, thresholds, model names
- ✅ Deterministic iteration order (arrays, not sets/dicts without ordering)
- ✅ Snapshot tests for prompt templates with CI enforcement
- ✅ `system_fingerprint` logging for model-version drift detection

## 9. Anti-Patterns

- ❌ `temperature > 0` in production without documented justification and approval
- ❌ Parsing LLM free-text with regex instead of structured output
- ❌ Omitting `seed` — makes reproduction impossible across runs
- ❌ Using model aliases (`gpt-4o`) instead of dated snapshots (`gpt-4o-2024-11-20`)
- ❌ Random tool execution order or shuffled few-shot examples
- ❌ Embedding model upgrades without re-indexing all vectors
- ❌ `top_p < 1` combined with `temperature=0` (contradictory — pick one strategy)
- ❌ Auto-updating test fixtures without human review
- ❌ Comparing LLM outputs with exact string match (fragile, false negatives)
- ❌ Sharing seeds across A/B variants (contaminates experiment)

## 10. WAF Alignment

| WAF Pillar | Determinism Practice |
|---|---|
| **Reliability** | Seed pinning + validation retry guarantees consistent outputs across deployments. Fingerprint monitoring detects model drift before it impacts users. |
| **Responsible AI** | Structured output prevents hallucinated fields. Validation pipelines enforce schema constraints. Snapshot testing catches prompt regression. |
| **Security** | Schema validation blocks injection via malformed output. Idempotency keys prevent replay attacks on write operations. |
| **Cost Optimization** | `temperature=0` reduces token waste from retries. Pinned models prevent surprise cost changes from auto-upgrades. |
| **Operational Excellence** | Config-driven parameters enable environment parity. Fixture-based tests run in CI without API calls. Semantic diff reduces false-positive test failures. |
| **Performance Efficiency** | Fixed chunking + pinned dimensions enable stable vector index performance. Deterministic tool order enables predictable latency profiling. |
