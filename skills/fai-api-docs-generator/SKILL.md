---
name: fai-api-docs-generator
description: "Generate API reference docs, examples, and error catalogs from OpenAPI or code annotations - keep endpoint docs accurate, testable, and publishable"
---

# FAI API Docs Generator

Generate production-ready API documentation from source artifacts instead of manually maintaining drift-prone markdown. This skill turns OpenAPI specs, route annotations, and example payloads into reference docs, quickstarts, and publishable artifacts.

## Source of Truth

Choose one primary source of truth and derive the rest.

| Source | Best for | Output |
|--------|----------|--------|
| OpenAPI document | HTTP APIs with existing schema coverage | reference docs, SDK examples, changelog |
| Framework annotations | FastAPI, ASP.NET, NestJS | generated OpenAPI then docs |
| Contract tests | example-heavy public APIs | request and response snippets |

If the spec and implementation diverge, fix the spec generation first. Do not patch the rendered docs by hand.

## Minimal Output Set

A useful API doc set should contain:
- overview and auth model
- endpoint reference
- request and response examples
- error catalog
- rate limits and retry guidance
- changelog or versioning notes

## Step 1: Validate the OpenAPI Document

```bash
npx @redocly/cli lint openapi.json
npx spectral lint openapi.json
```

Fail the pipeline if:
- operations are missing summaries
- response schemas are absent
- error responses are undocumented
- security schemes are missing on protected endpoints

## Step 2: Generate a Clean Spec from Code

FastAPI example:

```python
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="FAI Support API", version="1.0.0")

class TicketRequest(BaseModel):
    query: str = Field(..., description="User support request")
    top_k: int = Field(5, ge=1, le=20)

class TicketResponse(BaseModel):
    category: str
    confidence: float

@app.post("/classify", response_model=TicketResponse, summary="Classify support ticket")
async def classify_ticket(body: TicketRequest) -> TicketResponse:
    return TicketResponse(category="billing", confidence=0.94)
```

Export the spec during CI:

```bash
python -c "from app.main import app; import json; print(json.dumps(app.openapi()))" > openapi.json
```

## Step 3: Render Reference Docs

Redocly example:

```bash
npx @redocly/cli build-docs openapi.json --output docs/api-reference.html
```

For markdown output, generate one page per tag or resource group so the docs stay navigable.

## Step 4: Generate Example Payloads

Examples should be executable and realistic.

```json
{
  "query": "Customer asks for a copy of the latest invoice",
  "top_k": 5
}
```

```json
{
  "category": "billing",
  "confidence": 0.94
}
```

Curl example:

```bash
curl -X POST https://api.contoso.dev/classify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"Customer asks for a copy of the latest invoice","top_k":5}'
```

## Step 5: Publish an Error Catalog

Every public endpoint should map known failures to stable error codes.

| HTTP | Code | Meaning | Client action |
|------|------|---------|---------------|
| 400 | `INVALID_INPUT` | request body failed validation | fix payload |
| 401 | `UNAUTHORIZED` | token missing or invalid | refresh token |
| 429 | `RATE_LIMITED` | quota exceeded | retry after header |
| 500 | `INTERNAL_ERROR` | unexpected server failure | retry or escalate |
| 503 | `DEPENDENCY_UNAVAILABLE` | upstream AI service degraded | use fallback or retry |

Document errors in the OpenAPI spec:

```yaml
responses:
  '429':
    description: Rate limit exceeded
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/ErrorResponse'
```

## Step 6: Add Auth and Rate Limit Guidance

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

Also document:
- required scopes or roles
- tenant or subscription headers
- rate-limit headers such as `Retry-After` and `X-RateLimit-Remaining`

## Step 7: Check Examples Against Reality

Use contract tests so example payloads do not rot.

```python
import json
from pathlib import Path


def test_example_request_matches_schema(client):
    example = json.loads(Path("docs/examples/classify-request.json").read_text())
    response = client.post("/classify", json=example)
    assert response.status_code == 200
    assert "category" in response.json()
```

## Step 8: Publish in CI

```yaml
name: API Docs
on:
  pull_request:
    paths: ["app/**", "openapi.json", "docs/examples/**"]
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g @redocly/cli @stoplight/spectral-cli
      - run: npx @redocly/cli lint openapi.json
      - run: npx spectral lint openapi.json
      - run: npx @redocly/cli build-docs openapi.json --output docs/api-reference.html
```

## Review Checklist

- summaries and descriptions exist for every operation
- auth model is documented once and reused consistently
- examples are realistic and executable
- error catalog covers 400, 401, 429, 500, and 503 paths
- versioning and deprecation behavior are documented

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Docs drift from implementation | spec is hand-edited | regenerate from code or tests |
| Missing schemas in docs | framework models not annotated | add response models and field metadata |
| Example payload fails | stale docs example | validate examples in CI |
| Auth instructions are inconsistent | multiple unofficial docs sources | keep OpenAPI security as source of truth |

## Final Verdict

Use this skill when the docs need to be regenerated from real API contracts, not polished by hand. Good API documentation is a build artifact backed by tests, linting, and a stable source of truth.
