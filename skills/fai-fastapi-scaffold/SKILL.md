---
name: fai-fastapi-scaffold
description: |
  Scaffold FastAPI services with async endpoints, Pydantic validation, middleware
  stack, health checks, and OpenAPI generation. Use when building Python APIs
  for AI inference, data processing, or microservices.
---

# FastAPI Scaffold

Scaffold production-ready FastAPI services with validation, middleware, and observability.

## When to Use

- Building Python APIs for AI inference endpoints
- Creating microservices with structured validation
- Setting up health checks and OpenAPI documentation
- Adding middleware for logging, CORS, and rate limiting

---

## Project Structure

```
src/
  main.py           # App factory + routes
  config.py          # Settings from environment
  models.py          # Pydantic request/response models
  middleware.py       # Logging, CORS, error handling
  routes/
    chat.py          # Chat endpoint
    health.py        # Health check
  services/
    openai_client.py # Azure OpenAI wrapper
tests/
  test_chat.py
  test_health.py
Dockerfile
requirements.txt
```

## main.py

```python
from fastapi import FastAPI
from contextlib import asynccontextmanager
from .routes import chat, health
from .middleware import setup_middleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize clients
    app.state.oai_client = create_openai_client()
    yield
    # Shutdown: cleanup

app = FastAPI(title="AI API", version="1.0.0", lifespan=lifespan)
setup_middleware(app)
app.include_router(health.router)
app.include_router(chat.router, prefix="/api")
```

## models.py

```python
from pydantic import BaseModel, Field

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    model: str = Field(default="gpt-4o-mini", pattern=r"^gpt-4o(-mini)?$")
    temperature: float = Field(default=0.3, ge=0, le=2)

class ChatResponse(BaseModel):
    answer: str
    model: str
    tokens: int
    latency_ms: float
```

## routes/chat.py

```python
from fastapi import APIRouter, Request
from ..models import ChatRequest, ChatResponse
import time

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, request: Request):
    start = time.monotonic()
    client = request.app.state.oai_client
    resp = client.chat.completions.create(
        model=req.model,
        messages=[{"role": "user", "content": req.message}],
        temperature=req.temperature,
    )
    elapsed = (time.monotonic() - start) * 1000
    return ChatResponse(
        answer=resp.choices[0].message.content,
        model=req.model,
        tokens=resp.usage.total_tokens,
        latency_ms=round(elapsed, 1),
    )
```

## routes/health.py

```python
from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health():
    return {"status": "healthy"}

@router.get("/ready")
async def ready(request: Request):
    try:
        request.app.state.oai_client.models.list()
        return {"status": "ready", "openai": "connected"}
    except Exception as e:
        return JSONResponse({"status": "not_ready", "error": str(e)}, status_code=503)
```

## middleware.py

```python
from fastapi.middleware.cors import CORSMiddleware
import logging, time, uuid

def setup_middleware(app):
    app.add_middleware(CORSMiddleware, allow_origins=["*"],
        allow_methods=["*"], allow_headers=["*"])

    @app.middleware("http")
    async def log_requests(request, call_next):
        req_id = str(uuid.uuid4())[:8]
        start = time.monotonic()
        response = await call_next(request)
        elapsed = (time.monotonic() - start) * 1000
        logging.info(f"[{req_id}] {request.method} {request.url.path} "
                     f"{response.status_code} {elapsed:.0f}ms")
        response.headers["X-Request-ID"] = req_id
        return response
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Validation errors not helpful | Default error format | FastAPI auto-returns 422 with field details |
| CORS blocked | Missing middleware | Add CORSMiddleware with allowed origins |
| Slow startup | Sync initialization | Use lifespan for async init |
| OpenAPI not showing | Routes not included | Check app.include_router() calls |
