---
name: fai-api-endpoint-generator
description: |
  Scaffold production API endpoints with input validation, structured errors, idempotency,
  auth policies, and observability. Supports FastAPI, ASP.NET Minimal API, and Express.
---

# API Endpoint Generator

Scaffold secure, production-ready API endpoints with validation, error contracts, and observability.

## When to Use

- Creating new API endpoints for a service
- Standardizing error responses across an API surface
- Adding idempotency to mutation endpoints
- Wiring auth policies and rate limiting

---

## Pattern 1: FastAPI with Validation and Structured Errors

```python
from fastapi import FastAPI, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import Optional
import uuid, time

app = FastAPI()

class CreateItemRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., pattern=r"^[a-z-]+$")
    metadata: Optional[dict] = None

class ProblemDetail(BaseModel):
    type: str
    title: str
    status: int
    detail: str
    instance: Optional[str] = None

@app.exception_handler(HTTPException)
async def problem_details_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=ProblemDetail(
            type=f"/errors/{exc.status_code}",
            title=exc.detail,
            status=exc.status_code,
            detail=exc.detail,
            instance=str(request.url),
        ).model_dump(),
    )

@app.post("/items", status_code=201)
async def create_item(
    req: CreateItemRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
):
    # Check idempotency cache
    cached = await cache.get(f"idem:{idempotency_key}")
    if cached:
        return cached

    item = {"id": str(uuid.uuid4()), **req.model_dump()}
    await db.insert(item)
    await cache.set(f"idem:{idempotency_key}", item, ttl=86400)
    return item
```

## Pattern 2: ASP.NET Minimal API

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("per-user", opt =>
    {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromMinutes(1);
    });
});

var app = builder.Build();

app.MapPost("/items", async (CreateItemRequest req, IValidator<CreateItemRequest> validator) =>
{
    var result = await validator.ValidateAsync(req);
    if (!result.IsValid)
        return Results.ValidationProblem(result.ToDictionary());

    var item = new Item { Id = Guid.NewGuid(), Name = req.Name };
    await db.InsertAsync(item);
    return Results.Created($"/items/{item.Id}", item);
})
.RequireAuthorization("api-user")
.RequireRateLimiting("per-user");
```

## Pattern 3: Express with Zod Validation

```typescript
import express from 'express';
import { z } from 'zod';

const CreateItemSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().regex(/^[a-z-]+$/),
});

app.post('/items', async (req, res) => {
  const parsed = CreateItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      type: '/errors/validation',
      title: 'Validation failed',
      status: 400,
      errors: parsed.error.flatten().fieldErrors,
    });
  }
  const item = { id: crypto.randomUUID(), ...parsed.data };
  await db.insert(item);
  res.status(201).json(item);
});
```

## Endpoint Checklist

| Concern | Requirement |
|---------|-------------|
| Input validation | Schema-based (Pydantic, FluentValidation, Zod) |
| Error format | RFC 9457 Problem Details |
| Idempotency | Idempotency-Key header for mutations |
| Auth | Policy-based (role/scope, not hardcoded checks) |
| Rate limiting | Per-user or per-API-key window |
| Observability | Request ID in response headers + structured logging |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Duplicate side effects | Missing idempotency | Add Idempotency-Key + cached response |
| Inconsistent errors | No shared error handler | Register global ProblemDetails handler |
| Auth bypass | Missing policy decorator | Require auth at route or group level |
