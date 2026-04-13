---
description: "FastAPI standards — Pydantic models, dependency injection, async endpoints, and OpenAPI-first design."
applyTo: "**/*.py"
waf:
  - "performance-efficiency"
  - "security"
  - "reliability"
---

# FastAPI — FAI Standards

> Pydantic v2, dependency injection, async endpoints, lifespan, and OpenAPI-first design.

## Core Rules

- All request/response bodies use Pydantic `BaseModel` with strict type hints — no raw dicts
- Use `Depends()` for all shared logic: auth, DB sessions, config, rate limiting
- Async endpoints (`async def`) for I/O-bound work; sync `def` for CPU-bound (runs in threadpool)
- Settings via `pydantic_settings.BaseSettings` with `.env` file — never `os.getenv` inline
- Lifespan context manager for startup/shutdown (DB pools, HTTP clients, ML models)
- Router organization: one `APIRouter` per domain, prefixed and tagged
- `response_model=` on every endpoint; `HTTPException` with structured `detail` dict

## Pydantic v2 Models

```python
from pydantic import BaseModel, Field, field_validator, model_validator

class ChatRequest(BaseModel):
    messages: list[Message] = Field(..., min_length=1, max_length=50)
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(1024, ge=1, le=4096)

    @field_validator("messages")
    @classmethod
    def no_empty_content(cls, v):
        if any(m.content.strip() == "" for m in v):
            raise ValueError("Empty message content not allowed")
        return v

    @model_validator(mode="after")
    def validate_token_budget(self):
        if self.temperature == 0 and self.max_tokens > 2048:
            raise ValueError("Deterministic mode caps at 2048 tokens")
        return self
```

## Dependency Injection & Settings

```python
@lru_cache
def get_settings() -> Settings:
    return Settings()  # pydantic_settings.BaseSettings with .env

async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    async with request.app.state.session_factory() as session:
        yield session

async def get_current_user(
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="/auth/token")),
    settings: Settings = Depends(get_settings),
) -> User:
    return User(**jwt.decode(token, settings.jwt_secret, algorithms=["HS256"]))
```

## Lifespan, Routers & App Setup

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(timeout=30)
    yield
    await app.state.http_client.aclose()

app = FastAPI(title="FAI Service", lifespan=lifespan)
router = APIRouter(prefix="/chat", tags=["chat"])  # one router per domain

@router.post("/completions", response_model=ChatResponse)
async def create_completion(req: ChatRequest, user: User = Depends(get_current_user)): ...

app.include_router(router)
```

## Streaming & Background Tasks

```python
@router.post("/stream")
async def stream_completion(request: ChatRequest):
    async def generate():
        async for chunk in llm.stream(request.messages):
            yield f"data: {chunk.model_dump_json()}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")

@router.post("/ingest")
async def ingest_document(file: UploadFile, tasks: BackgroundTasks):
    tasks.add_task(process_and_index, uuid4(), await file.read())
    return {"status": "processing"}
```

## Middleware

- CORS: `app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins)` — never `["*"]` in prod
- Correlation IDs: inject via `@app.middleware("http")`, read `X-Correlation-ID` header or generate `uuid4()`
```

## Error Handling

```python
@app.exception_handler(HTTPException)
async def structured_errors(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={
        "error": {"code": exc.status_code, "message": exc.detail}})

raise HTTPException(422, detail={"code": "INVALID_MODEL", "message": f"'{name}' unavailable"})
```

## Testing

- Use `TestClient(app)` for sync tests, `httpx.AsyncClient(app=app)` for async
- Override dependencies: `app.dependency_overrides[get_settings] = lambda: Settings(env="test")`
- Clear overrides in fixture teardown: `app.dependency_overrides.clear()`
```

## Preferred Patterns

- ✅ `response_model=` on all endpoints — validates, filters, generates OpenAPI
- ✅ `Annotated[User, Depends(get_current_user)]` for reusable typed dependencies
- ✅ `model_config = ConfigDict(strict=True)` for strict type coercion
- ✅ `status.HTTP_201_CREATED` constants over magic integers
- ✅ `structlog` or JSON formatter — never `print()`

## Anti-Patterns

- ❌ Raw dict returns from endpoints — loses validation, breaks OpenAPI
- ❌ `async def` calling blocking I/O (`requests.get`, `open()`) — blocks event loop
- ❌ Global mutable state (`global conn`) — use lifespan `app.state` or `Depends()`
- ❌ `allow_origins=["*"]` in production — explicit allowlist only
- ❌ Bare `except Exception` returning 200 — let FastAPI return 500
- ❌ Business logic in route handlers — extract to service layer
- ❌ `os.getenv()` scattered across files — centralize in `BaseSettings`

## WAF Alignment

| Pillar | FastAPI Practice |
|--------|-----------------|
| **Security** | `OAuth2PasswordBearer` + JWT, `Depends(get_current_user)`, CORS allowlist, Pydantic input validation |
| **Reliability** | Lifespan startup/shutdown, `httpx` timeout/retry, `/health` endpoint, DB session auto-rollback |
| **Performance** | Async endpoints, `StreamingResponse` for LLM output, connection pooling, `lru_cache` settings |
| **Cost** | `max_tokens` upper bound via `Field`, background tasks for deferred work, response filtering |
| **Ops Excellence** | Correlation ID middleware, structured JSON logging, auto-docs at `/docs`, `TestClient` + overrides |
