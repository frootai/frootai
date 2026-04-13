---
description: "Pydantic standards — model design, validation, serialization, settings management, custom validators."
applyTo: "**/*.py"
waf:
  - "reliability"
  - "security"
---

# Pydantic — FAI Standards

## BaseModel & Field

```python
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone

class Document(BaseModel):
    model_config = ConfigDict(
        frozen=True,               # immutable after creation
        str_strip_whitespace=True,  # auto-strip strings
        extra="forbid",            # reject unknown fields
        strict=False,              # lax mode: coerce "42" → 42
    )

    title: str = Field(min_length=1, max_length=256)
    chunk_count: int = Field(ge=1, le=10_000)
    embedding_dim: int = Field(default=1536, ge=64, le=3072)
    tags: list[str] = Field(default_factory=list, max_length=20)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

- `extra="forbid"` catches typos and malformed payloads at the boundary
- `frozen=True` for value objects — hashable, safe as dict keys
- Strict mode (`strict=True`) rejects coercion (`"42"` raises, only `42` accepted) — use for internal models where types are controlled

## Validators

```python
from pydantic import field_validator, model_validator
import re

class Prompt(BaseModel):
    system_message: str = Field(max_length=4000)
    temperature: float = Field(ge=0.0, le=2.0)
    max_tokens: int = Field(ge=1, le=128_000)
    stop_sequences: list[str] = Field(default_factory=list, max_length=4)

    @field_validator("system_message")
    @classmethod
    def no_injection_markers(cls, v: str) -> str:
        if re.search(r"<\|im_start\|>|<\|im_end\|>", v):
            raise ValueError("Prompt contains forbidden control tokens")
        return v

    @model_validator(mode="after")
    def token_budget_check(self) -> "Prompt":
        if self.temperature == 0 and self.max_tokens > 4096:
            raise ValueError("Deterministic mode (temp=0) should cap max_tokens at 4096")
        return self
```

- `field_validator` for single-field rules, `model_validator` for cross-field logic
- `mode="before"` on model_validator receives raw dict — use for input normalization
- `mode="after"` receives the constructed instance — use for cross-field constraints

## Computed Fields

```python
from pydantic import computed_field

class TokenUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int

    @computed_field
    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    @computed_field
    @property
    def estimated_cost_usd(self) -> float:
        return (self.prompt_tokens * 2.5 + self.completion_tokens * 10.0) / 1_000_000
```

## Discriminated Unions

```python
from typing import Annotated, Literal, Union
from pydantic import Discriminator

class TextChunk(BaseModel):
    kind: Literal["text"] = "text"
    content: str

class ImageChunk(BaseModel):
    kind: Literal["image"] = "image"
    url: str
    alt_text: str = ""

ChunkType = Annotated[Union[TextChunk, ImageChunk], Discriminator("kind")]

class Passage(BaseModel):
    chunks: list[ChunkType]  # O(1) dispatch on "kind" field
```

## Serialization

```python
from pydantic import field_serializer

class SearchResult(BaseModel):
    score: float
    doc_id: str
    metadata: dict

    @field_serializer("score")
    def round_score(self, v: float) -> float:
        return round(v, 4)

# Dump to dict (excludes None by default with exclude_none)
result.model_dump(exclude_none=True, exclude={"metadata"})

# Dump to JSON bytes — faster than json.dumps(model_dump())
result.model_dump_json(indent=2)
```

## TypeAdapter — Standalone Validation

```python
from pydantic import TypeAdapter

FloatList = TypeAdapter(list[float])

# Validate embeddings from external API without a model class
embedding = FloatList.validate_python(raw_api_response["embedding"])

# JSON schema for documentation / OpenAPI
schema = FloatList.json_schema()
```

- Use `TypeAdapter` for validating simple types, lists, dicts without wrapping in BaseModel
- `validate_json()` parses + validates in one step — faster than json.loads → validate

## Settings Management

```python
from pydantic_settings import BaseSettings
from pydantic import Field, SecretStr

class AppSettings(BaseSettings):
    model_config = ConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    azure_openai_endpoint: str
    azure_openai_key: SecretStr  # masked in repr/logs
    embedding_model: str = "text-embedding-3-large"
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    search_top_k: int = Field(default=5, ge=1, le=50)

settings = AppSettings()  # reads from env vars + .env file
# Access secret: settings.azure_openai_key.get_secret_value()
```

- `SecretStr` prevents accidental logging of keys — `.get_secret_value()` required
- Env vars override `.env` file — deploy-time config without code changes

## JSON Schema Generation

```python
schema = Document.model_json_schema()
# Use for: OpenAPI specs, structured output with Azure OpenAI, config validation
# response_format={"type": "json_schema", "json_schema": {"schema": schema}}
```

## Custom Types with Validators

```python
from typing import Annotated
from pydantic import AfterValidator, BeforeValidator

def normalize_whitespace(v: str) -> str:
    return " ".join(v.split())

def clamp_score(v: float) -> float:
    return max(0.0, min(1.0, v))

CleanStr = Annotated[str, BeforeValidator(normalize_whitespace)]
Score = Annotated[float, AfterValidator(clamp_score)]
```

## Performance

- `model_validate(data)` over `Model(**data)` — skips Python `__init__` overhead
- `model_validate_json(raw_bytes)` — parse + validate in one C-level pass (2-5x faster)
- Reuse `TypeAdapter` instances — construction is expensive, validation is cheap
- `model_construct(**data)` skips validation entirely — only for trusted internal data

## FastAPI Integration

```python
from fastapi import FastAPI
app = FastAPI()

@app.post("/chat", response_model=TokenUsage)
async def chat(prompt: Prompt) -> TokenUsage:
    # Prompt is validated automatically on ingestion
    # TokenUsage is serialized automatically on response
    ...
```

- FastAPI calls `model_validate` on request body and `model_dump` on response automatically
- Define `response_model_exclude_none=True` on routes to omit null fields

## Testing Models

```python
def test_prompt_rejects_injection():
    import pytest
    with pytest.raises(ValueError, match="forbidden control tokens"):
        Prompt(system_message="<|im_start|>system", temperature=0.7, max_tokens=100)

def test_frozen_model_immutable():
    doc = Document(title="Test", chunk_count=1)
    with pytest.raises(ValidationError):
        doc.title = "Changed"

def test_discriminated_union_dispatch():
    p = Passage(chunks=[{"kind": "text", "content": "hello"}])
    assert isinstance(p.chunks[0], TextChunk)
```

## Anti-Patterns

- ❌ Using `dict` or `Any` for API payloads — define explicit models with Field constraints
- ❌ `extra="allow"` on boundary models — lets malformed data leak through
- ❌ `model_construct()` on untrusted input — bypasses all validation
- ❌ Bare `str` for secrets — use `SecretStr` to prevent accidental logging
- ❌ Mutable default `list` in Field — use `default_factory=list`
- ❌ Catching `ValidationError` silently — log the `.errors()` detail for debugging
- ❌ Re-creating `TypeAdapter` per call — instantiate once at module level
- ❌ `from_orm()` (v1 pattern) — use `model_validate(obj, from_attributes=True)` in v2

## WAF Alignment

| Pillar | Practice |
|--------|----------|
| **Security** | `extra="forbid"` rejects injection fields; `SecretStr` masks credentials; `field_validator` blocks control tokens; `strict=True` prevents type-coercion attacks |
| **Reliability** | `Field(ge=, le=)` enforces invariants at construction; `model_validator` validates cross-field consistency; `frozen=True` prevents mutation bugs; fail-fast on invalid config via `BaseSettings` |
| **Cost** | `model_validate_json` avoids double-parse overhead; `exclude_none=True` reduces payload sizes; `TypeAdapter` reuse eliminates repeated schema compilation |
| **Ops Excellence** | `model_json_schema()` auto-generates OpenAPI specs; structured `ValidationError.errors()` for observability; `model_dump()` produces clean audit logs |
| **Performance** | `model_validate` over `__init__`; `model_validate_json` for C-level parse; `model_construct` for trusted hot paths; discriminated unions for O(1) dispatch |
| **Responsible AI** | Validator-enforced token budgets prevent runaway costs; prompt injection defense via field_validator; temperature constraints enforce deterministic modes |
