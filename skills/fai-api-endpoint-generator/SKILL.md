---
name: fai-api-endpoint-generator
description: Generate typed REST API endpoints with Zod/Pydantic input validation, RFC 7807 error responses, OpenAPI annotation, and Managed Identity auth — eliminating schema drift and IDOR vulnerabilities.
---

# FAI API Endpoint Generator

Builds production-ready REST API endpoints that combine strict schema validation, standardised error envelopes, and OpenAPI documentation in a single pass. Prevents the three most common API issues in AI services: missing input bounds (which enable prompt injection), inconsistent error surfaces, and docs that lag behind code.

## When to Invoke

| Signal | Example |
|--------|---------|
| Building a new AI service route | POST /completions, GET /documents/{id} |
| Existing endpoint lacks validation | No Pydantic model or Zod schema present |
| Error responses are inconsistent | Mix of plain strings and JSON objects |
| OpenAPI spec is missing or stale | Swagger shows wrong request shape |

## Workflow

### Step 1 — Define the Contract

Before writing any code, capture the request shape, success payload, and failure modes.

```typescript
// TypeScript — Zod contract first
import { z } from "zod";

export const CompletionRequestSchema = z.object({
  prompt:      z.string().min(1).max(4000),
  model:       z.enum(["gpt-4o", "gpt-4o-mini"]).default("gpt-4o-mini"),
  max_tokens:  z.number().int().min(1).max(2000).default(512),
  temperature: z.number().min(0).max(2).default(0.7),
  stream:      z.boolean().default(false),
});

export type CompletionRequest = z.infer<typeof CompletionRequestSchema>;
```

```python
# Python — Pydantic contract first
from pydantic import BaseModel, Field
from typing import Literal

class CompletionRequest(BaseModel):
    prompt:      str  = Field(min_length=1, max_length=4000)
    model:       Literal["gpt-4o", "gpt-4o-mini"] = "gpt-4o-mini"
    max_tokens:  int  = Field(default=512, ge=1, le=2000)
    temperature: float = Field(default=0.7, ge=0, le=2)
    stream:      bool  = False
```

### Step 2 — Implement the Route Handler

```typescript
// Express route with Zod middleware
import express from "express";
import { DefaultAzureCredential } from "@azure/identity";
import { AzureOpenAI } from "openai";

const router = express.Router();
const credential = new DefaultAzureCredential();   // Managed Identity — no API key

router.post("/completions",
  validateBody(CompletionRequestSchema),            // Zod middleware
  async (req, res, next) => {
    try {
      const { prompt, model, max_tokens, temperature } = req.body as CompletionRequest;
      const client = new AzureOpenAI({ azureADTokenProvider: () => credential.getToken("https://cognitiveservices.azure.com/.default").then(t => t.token) });
      const result = await client.chat.completions.create({
        model, messages: [{ role: "user", content: prompt }],
        max_tokens, temperature,
      });
      res.json({ status: "success", data: result.choices[0] });
    } catch (err) {
      next(err);                                   // Centralised error handler
    }
  }
);
```

### Step 3 — Standardise Error Responses (RFC 7807)

```typescript
// Centralised error handler — all errors become Problem Details
interface ProblemDetails {
  type:      string;
  title:     string;
  status:    number;
  detail?:   string;
  instance?: string;
}

function errorHandler(err: unknown, req: express.Request, res: express.Response) {
  const problem: ProblemDetails = {
    type:     "https://frootai.dev/errors/internal",
    title:    "Internal Server Error",
    status:   500,
    instance: req.path,
  };

  if (err instanceof z.ZodError) {
    problem.type   = "https://frootai.dev/errors/validation";
    problem.title  = "Request Validation Failed";
    problem.status = 400;
    problem.detail = err.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ");
  }
  res.status(problem.status).json(problem);
}
```

### Step 4 — Add OpenAPI Annotation

```typescript
/**
 * @openapi
 * /completions:
 *   post:
 *     summary: Generate an AI completion
 *     tags: [Completions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompletionRequest'
 *     responses:
 *       200:
 *         description: Successful completion
 *       400:
 *         description: Validation error (RFC 7807 Problem Details)
 *       429:
 *         description: Rate limited
 */
```

### Step 5 — Request ID Propagation

```typescript
// Middleware — inject correlation ID for distributed tracing
app.use((req, res, next) => {
  const requestId = (req.headers["x-request-id"] as string) ?? crypto.randomUUID();
  res.setHeader("x-request-id", requestId);
  (req as any).requestId = requestId;
  next();
});
```

## Output Envelope

```json
{
  "status": "success",
  "data": { "text": "...", "model": "gpt-4o-mini", "usage": { "total_tokens": 213 } },
  "meta": { "request_id": "a1b2c3d4", "duration_ms": 187, "cached": false }
}
```

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Security | Zod/Pydantic bounds prevent over-size prompt injection; Managed Identity eliminates API key exposure |
| Reliability | RFC 7807 error envelope enables consistent retry logic on the client side |
| Performance Efficiency | Typed schemas reduce deserialization overhead; stream=true enables token-level streaming |
| Operational Excellence | OpenAPI annotation keeps docs in sync with code; request ID enables distributed trace correlation |

## Compatible Solution Plays

- **Play 01** — Enterprise RAG (POST /query endpoint)
- **Play 14** — Cost-Optimized AI Gateway (routing endpoints)
- **Play 29** — MCP Server (tool registration endpoints)

## Notes

- Always leave the `name` field unquoted per agentskills.io spec
- Zod errors -> 400 with Problem Details; unhandled exceptions -> 500
- Use `DefaultAzureCredential` not an API key — avoids key rotation risk and supports local dev via `az login`
