---
description: "OpenAPI standards — spec-first design, versioning, security schemes, examples."
applyTo: "**/*.yaml, **/*.json"
waf:
  - "operational-excellence"
  - "reliability"
---

# OpenAPI — FAI Standards

- Author OpenAPI 3.1 (JSON Schema 2020-12 compatible) — avoid 3.0 `nullable`, use `type: ["string", "null"]`
- Single source of truth: `openapi.yaml` generates server stubs, client SDKs, docs, and tests
- Every endpoint: `operationId`, `summary`, `description`, `tags`, and at least one `responses` entry
- Semantic `description` fields — AI tool-calling agents parse these to select and invoke endpoints

## Document Structure & operationId

```yaml
openapi: "3.1.0"
info: { title: Contoso AI API, version: "2025-04-01", description: Enterprise RAG service. }
servers: [{ url: "https://api.contoso.com/v1", description: Production }]
paths:
  /completions:
    post:
      operationId: createCompletion       # camelCase verb-noun, unique across spec
      tags: [Completions]
      summary: Generate a grounded completion.
      description: Sends prompt with context to LLM, returns grounded answer with citations.
```

- **operationId** — camelCase verb-noun: `listDocuments`, `getDocumentById`, `createCompletion`, `deleteIndex`
- Verbs: `list`, `get`, `create`, `update`, `replace`, `delete`, `search`, `upload`
- **Path**: required identifiers (`/{documentId}`, `format: uuid`). **Query**: filters/pagination. **Header**: `X-Request-ID`, `If-None-Match`
- Never put secrets in query params — use `Authorization` header

## Schema Design

```yaml
components:
  schemas:
    CompletionRequest:
      type: object
      required: [messages]
      properties:
        messages: { type: array, items: { $ref: "#/components/schemas/ChatMessage" }, minItems: 1 }
        temperature: { type: number, minimum: 0, maximum: 2, default: 0.7 }
        max_tokens: { type: integer, minimum: 1, maximum: 128000 }
    ChatMessage:
      type: object
      required: [role, content]
      properties:
        role: { type: string, enum: [system, user, assistant, tool] }
        content: { type: string, maxLength: 100000 }
    ToolCall:  # Discriminator for polymorphism
      oneOf: [{ $ref: "#/components/schemas/FunctionToolCall" }, { $ref: "#/components/schemas/RetrievalToolCall" }]
      discriminator: { propertyName: type, mapping: { function: "#/…/FunctionToolCall", retrieval: "#/…/RetrievalToolCall" } }
```

- `$ref` for every reusable type — never inline objects deeper than 2 levels
- `allOf` for inheritance, `oneOf` + `discriminator` for polymorphism, `anyOf` for loose unions
- Set `required`, `minimum`, `maximum`, `maxLength`, `pattern`, `enum` — client-side validation
- `additionalProperties: false` on request bodies to reject unknown fields

## Error Responses — RFC 7807

```yaml
    ProblemDetails:
      type: object
      required: [type, title, status]
      properties:
        type: { type: string, format: uri }     # e.g. https://api.contoso.com/errors/rate-limited
        title: { type: string }                  # e.g. "Rate limit exceeded"
        status: { type: integer }                # HTTP status code
        detail: { type: string }                 # Human-readable explanation
        instance: { type: string, format: uri }  # Request URI that caused the error
        retryAfter: { type: integer }            # Seconds to wait (429/503)
```

- Return `ProblemDetails` for all 4xx/5xx (`application/problem+json`): 400, 401, 403, 404, 409, 422, 429, 503

## Security Schemes

```yaml
  securitySchemes:
    BearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
    OAuth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize
          tokenUrl: https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
          scopes: { "api://contoso-ai/.default": "Full API access" }
security: [{ BearerAuth: [] }]  # Global default — override per-operation for public endpoints
```

- Prefer OAuth2/JWT over API keys — keys for dev/testing only

## Pagination & Examples

```yaml
    PaginatedResponse:
      type: object
      required: [items, total, limit, offset]
      properties:
        items: { type: array, items: {} }
        total: { type: integer, minimum: 0 }
        limit: { type: integer, minimum: 1, maximum: 100 }
        offset: { type: integer, minimum: 0 }
        nextLink: { type: string, format: uri }
```

- Cursor-based for large datasets, offset-based for small. Every body needs `examples` (plural, named map)

## Versioning & Linting

- **Path-based** (`/v1/`) for breaking changes. **Date-based** (`api-version: 2025-04-01`) for Azure-style
- `info.version` = API version, not spec file revision
- Spectral in CI: `spectral lint openapi.yaml` — block merge on errors
- Required rules: `operation-operationId: error`, `oas3-schema: error`, `operation-tag-defined: error`

## Code Generation & AI Tool-Calling

- **TS**: `openapi-generator-cli generate -i openapi.yaml -g typescript-axios -o sdk/`
- **Python**: `openapi-generator-cli generate -g python-flask -o server/`
- **C#**: `autorest --input-file=openapi.yaml --csharp --output-folder=sdk/dotnet`
- Pin generator version in CI — commit SDKs or publish to private registry
- AI agents use `summary` for tool selection, `description` for call construction (side effects, idempotency, limits)
- `operationId` becomes function name. Add `x-ai-hints` for disambiguation

## Anti-Patterns

- ❌ Missing `operationId` — breaks codegen and AI tool discovery
- ❌ Generic descriptions — useless for AI agents
- ❌ Inline schemas instead of `$ref` — unmaintainable
- ❌ `200` for all responses — masks errors
- ❌ Secrets in query params — logged by proxies/caches
- ❌ No `examples` — API explorers render empty
- ❌ `additionalProperties: true` on requests — allows field injection
- ❌ Array responses without pagination — unbounded payload

## WAF Alignment

| Pillar | OpenAPI Practice |
|---|---|
| **Security** | OAuth2/JWT, no secrets in query params, `additionalProperties: false`, schema constraints |
| **Reliability** | RFC 7807 `retryAfter`, `Idempotency-Key` header, `429`/`503` documented |
| **Cost** | Pagination bounds payload, `max_tokens` constraints, `304 Not Modified` + `ETag` |
| **Ops Excellence** | Spectral in CI, pinned SDK generation, `X-Request-ID` correlation, tag grouping |
| **Performance** | `HEAD` for existence checks, `ETag`/`If-None-Match` caching, SSE streaming |
| **Responsible AI** | Semantic descriptions for AI tools, `x-pii: true` markers, content safety in docs |
