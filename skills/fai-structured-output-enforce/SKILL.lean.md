---
name: fai-structured-output-enforce
description: "Enforce structured JSON output from LLMs with schema validation"
---

# Structured Output Enforce

Guarantee LLM responses conform to a strict schema. Covers JSON mode, function calling with strict schemas, Pydantic/Zod validation, retry loops for malformed output, and config-driven schema selection.

## JSON Mode vs Strict Structured Output

**JSON mode** (`response_format={"type":"json_object"}`) guarantees valid JSON but does NOT enforce a schema. The model can return any valid JSON. You must validate after.

**Structured output** (`response_format={"type":"json_schema","json_schema":{...}}`) guarantees the response matches your exact schema. Available on `gpt-4o-2024-08-06+` and Azure OpenAI `2024-08-01-preview+`.

**Function calling with `strict: true`** forces the model to emit arguments matching your function's JSON Schema exactly — no extra keys, no missing required fields.

## Python — Pydantic Schema + Structured Output

```python
from pydantic import BaseModel, Field
from openai import AzureOpenAI
import json, os

class TicketClassification(BaseModel):
    category: str = Field(description="One of: billing, technical, account, general")
    priority: int = Field(ge=1, le=5, description="1=critical, 5=low")
    summary: str = Field(max_length=200)
    requires_escalation: bool

client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_version="2024-08-01-preview",
)

def classify_ticket(text: str) -> TicketClassification:
    """Use structured output to guarantee schema conformance."""
    completion = client.beta.chat.completions.parse(
        model=os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o"),
        messages=[
            {"role": "system", "content": "Classify the support ticket."},
            {"role": "user", "content": text},
        ],
        response_format=TicketClassification,
    )
    result = completion.choices[0].message.parsed
    if result is None:
        raise ValueError(f"Refusal: {completion.choices[0].message.refusal}")
    return result
```

## Python — JSON Mode with Validation + Retry

When structured output isn't available (older models, non-OpenAI providers), use JSON mode with a retry loop:

```python
from pydantic import ValidationError
from openai import AzureOpenAI
import json

def extract_with_retry(client: AzureOpenAI, prompt: str, schema_cls, max_retries: int = 3):
    """JSON mode + Pydantic validation with retry on malformed output."""
    messages = [
        {"role": "system", "content": f"Respond in JSON matching: {schema_cls.model_json_schema()}"},
        {"role": "user", "content": prompt},
    ]
    for attempt in range(max_retries):
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0,
        )
        raw = resp.choices[0].message.content
        try:
            data = json.loads(raw)
            return schema_cls.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as e:
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content": f"Invalid output: {e}. Fix and retry."})
    raise ValueError(f"Failed to get valid output after {max_retries} attempts")
```

## Python — Function Calling with Strict Schema

```python
import json

tools = [{
    "type": "function",
    "function": {
        "name": "save_extraction",
        "description": "Save extracted invoice data",
        "strict": True,
        "parameters": {
            "type": "object",
            "properties": {
                "vendor": {"type": "string"},
                "total": {"type": "number"},
                "currency": {"type": "string", "enum": ["USD", "EUR", "GBP"]},
                "line_items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "description": {"type": "string"},
                            "amount": {"type": "number"},
                        },
                        "required": ["description", "amount"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["vendor", "total", "currency", "line_items"],
            "additionalProperties": False,
        },
    },
}]

resp = client.chat.completions.create(
    model="gpt-4o", messages=messages, tools=tools, tool_choice="required",
)
args = json.loads(resp.choices[0].message.tool_calls[0].function.arguments)
# args is guaranteed to match the schema when strict=True
```

## TypeScript — Zod Schema Enforcement

```typescript
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { AzureOpenAI } from "openai";

const TicketSchema = z.object({
  category: z.enum(["billing", "technical", "account", "general"]),
  priority: z.number().int().min(1).max(5),
  summary: z.string().max(200),
  requires_escalation: z.boolean(),
});
type Ticket = z.infer<typeof TicketSchema>;

async function classifyTicket(client: AzureOpenAI, text: string): Promise<Ticket> {
  const completion = await client.beta.chat.completions.parse({
    model: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o",
    messages: [
      { role: "system", content: "Classify the support ticket." },
      { role: "user", content: text },
    ],
    response_format: zodResponseFormat(TicketSchema, "ticket_classification"),
  });
  const result = completion.choices[0].message.parsed;
  if (!result) throw new Error(`Refusal: ${completion.choices[0].message.refusal}`);
  return result;
}
```

## TypeScript — JSON Mode with Zod Retry

```typescript
import { z, ZodSchema } from "zod";
import { AzureOpenAI } from "openai";

async function extractWithRetry<T>(
  client: AzureOpenAI, prompt: string, schema: ZodSchema<T>, maxRetries = 3
): Promise<T> {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: `Respond in JSON matching: ${JSON.stringify(schema)}` },
    { role: "user", content: prompt },
  ];
  for (let i = 0; i < maxRetries; i++) {
    const resp = await client.chat.completions.create({
      model: "gpt-4o", messages, response_format: { type: "json_object" }, temperature: 0,
    });
    const raw = resp.choices[0].message.content ?? "";
    const parsed = schema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
    messages.push({ role: "assistant", content: raw });
    messages.push({ role: "user", content: `Invalid: ${parsed.error.message}. Fix.` });
  }
  throw new Error("Structured output failed after retries");
}
```

## Handling Partial and Malformed Responses

Streaming with structured output can yield partial JSON. Handle `finish_reason`:

```python
if completion.choices[0].finish_reason == "length":
    # Response was truncated — increase max_tokens or simplify schema
    raise ValueError("Output truncated — schema too large for token budget")
if completion.choices[0].finish_reason == "content_filter":
    # Azure content filter triggered — log and handle gracefully
    raise ValueError("Content filter blocked structured output")
```

For non-streaming, always check `message.refusal` (structured output) or wrap `json.loads` in try/except (JSON mode). Never assume the response is valid — even `strict: true` can produce `null` on refusal.

## Config-Driven Output Schemas

Load schemas from `config/output-schemas.json` so downstream consumers can evolve without code changes:

```json
{
  "ticket_classification": {
    "model": "gpt-4o",
    "method": "structured_output",
    "schema": {
      "type": "object",
      "properties": {
        "category": { "type": "string", "enum": ["billing", "technical", "account"] },
        "priority": { "type": "integer", "minimum": 1, "maximum": 5 }
      },
      "required": ["category", "priority"],
      "additionalProperties": false
    }
  }
}
```

```python
def get_schema(config_path: str, task: str) -> dict:
    with open(config_path) as f:
        config = json.load(f)
    entry = config[task]
    if entry["method"] == "structured_output":
        return {"type": "json_schema", "json_schema": {"name": task, "strict": True, "schema": entry["schema"]}}
    return {"type": "json_object"}
```

## Testing Structured Outputs

```python
import pytest
from pydantic import ValidationError

def test_schema_validates_good_output():
    data = {"category": "billing", "priority": 2, "summary": "Charge issue", "requires_escalation": False}
    result = TicketClassification.model_validate(data)
    assert result.category == "billing"

def test_schema_rejects_bad_priority():
    with pytest.raises(ValidationError):
        TicketClassification.model_validate({"category": "billing", "priority": 99, "summary": "x", "requires_escalation": False})

def test_schema_rejects_extra_fields():
    """additionalProperties:false should block unexpected keys."""
    schema = TicketClassification.model_json_schema()
    assert schema.get("additionalProperties") is False or "category" in schema["properties"]

@pytest.mark.integration
def test_live_structured_output(client):
    result = classify_ticket("I can't log in to my account")
    assert result.category in ("technical", "account")
    assert 1 <= result.priority <= 5
```

```typescript
import { describe, it, expect } from "vitest";

describe("TicketSchema", () => {
  it("accepts valid ticket", () => {
    const result = TicketSchema.safeParse({
      category: "billing", priority: 3, summary: "Overcharged", requires_escalation: false,
    });
    expect(result.success).toBe(true);
  });
  it("rejects invalid priority", () => {
    const result = TicketSchema.safeParse({ category: "billing", priority: 99, summary: "x", requires_escalation: false });
    expect(result.success).toBe(false);
  });
});
```

## Key Constraints

- `strict: true` requires `additionalProperties: false` on every object in the schema
- Structured output supports a subset of JSON Schema — no `$ref`, `oneOf` limited, max 5 levels of nesting
- First request with a new schema incurs a cache-miss latency (~10-30s) for schema compilation
- Azure OpenAI requires api-version `2024-08-01-preview` or later for structured output
- `json_object` mode requires the word "JSON" somewhere in the system or user message
- Streaming structured output arrives as partial JSON — accumulate chunks before parsing
