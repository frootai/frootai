---
description: "Python reliability standards — retry with tenacity, circuit breakers, health checks, structured logging."
applyTo: "**/*.py"
waf:
  - "reliability"
---

# Python Reliability Patterns — FAI Standards

## Retry with Tenacity

```python
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
import httpx

class TransientError(Exception): ...
class UpstreamTimeout(TransientError): ...
class RateLimited(TransientError): ...

@retry(
    wait=wait_exponential(multiplier=1, min=1, max=30),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type((TransientError, httpx.TimeoutException)),
    before_sleep=lambda r: logger.warning(f"Retry {r.attempt_number}: {r.outcome.exception()}"),
)
async def call_llm(prompt: str, config: dict) -> str:
    response = await client.post("/chat/completions", json={"prompt": prompt, **config})
    if response.status_code == 429:
        raise RateLimited(response.headers.get("Retry-After", "unknown"))
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]
```

## Circuit Breaker

```python
import pybreaker

ai_breaker = pybreaker.CircuitBreaker(
    fail_max=5, reset_timeout=30,
    listeners=[pybreaker.CircuitBreakerListener()],
    exclude=[ValueError],  # don't trip on validation errors
)

@ai_breaker
async def query_search_index(query: str) -> list[dict]:
    return await search_client.search(query, top=10)
```

## HTTP Client with Timeout + Retry Transport

```python
import httpx

transport = httpx.AsyncHTTPTransport(retries=2)
client = httpx.AsyncClient(
    transport=transport,
    timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0),
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
    headers={"User-Agent": "fai-service/1.0"},
)
```

## Graceful Shutdown

```python
import signal, asyncio

shutdown_event = asyncio.Event()

def _handle_sigterm(sig, frame):
    logger.info("SIGTERM received — draining requests")
    shutdown_event.set()

signal.signal(signal.SIGTERM, _handle_sigterm)
signal.signal(signal.SIGINT, _handle_sigterm)

async def run_server(app):
    server = uvicorn.Server(uvicorn.Config(app, host="0.0.0.0", port=8000))
    asyncio.create_task(server.serve())
    await shutdown_event.wait()
    server.should_exit = True
    await client.aclose()  # close httpx pool
    await engine.dispose()  # close DB pool
```

## Context Managers for Resource Cleanup

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def managed_resources():
    http = httpx.AsyncClient(timeout=30)
    engine = create_async_engine(db_url, pool_size=10)
    try:
        yield {"http": http, "db": engine}
    finally:
        await http.aclose()
        await engine.dispose()
```

## Health Check Endpoint

```python
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse

@app.get("/health", status_code=status.HTTP_200_OK)
async def health():
    checks = {
        "db": await _check_db(),
        "redis": await _check_redis(),
        "upstream_api": await _check_upstream(),
    }
    healthy = all(checks.values())
    return JSONResponse(
        status_code=status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "healthy" if healthy else "degraded", "checks": checks},
    )
```

## Connection Pooling

```python
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    db_url,
    pool_size=20, max_overflow=10,
    pool_timeout=30, pool_recycle=1800,
    pool_pre_ping=True,  # verify connections before use
)
```

## Idempotency Decorator

```python
import hashlib, functools

def idempotent(key_fn):
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"idem:{hashlib.sha256(key_fn(*args, **kwargs).encode()).hexdigest()}"
            if cached := await redis.get(key):
                return json.loads(cached)
            result = await func(*args, **kwargs)
            await redis.set(key, json.dumps(result), ex=3600)
            return result
        return wrapper
    return decorator

@idempotent(key_fn=lambda doc_id, **kw: doc_id)
async def process_document(doc_id: str) -> dict: ...
```

## Dead Letter Queue Pattern

```python
async def consume_with_dlq(queue: str, handler, max_retries: int = 3):
    while not shutdown_event.is_set():
        msg = await broker.receive(queue, timeout=5)
        if not msg:
            continue
        try:
            await handler(msg.body)
            await msg.ack()
        except Exception as exc:
            if msg.delivery_count >= max_retries:
                await broker.send(f"{queue}-dlq", msg.body, headers={"error": str(exc)})
                await msg.ack()
                logger.error(f"DLQ: {queue}", extra={"msg_id": msg.id, "error": str(exc)})
            else:
                await msg.nack()
```

## Structured Error Hierarchy

```python
class ServiceError(Exception):
    def __init__(self, message: str, *, code: str, retriable: bool = False):
        super().__init__(message)
        self.code, self.retriable = code, retriable

class UpstreamError(ServiceError):
    def __init__(self, msg: str): super().__init__(msg, code="UPSTREAM_FAILURE", retriable=True)

class ValidationError(ServiceError):
    def __init__(self, msg: str): super().__init__(msg, code="VALIDATION_ERROR", retriable=False)

class QuotaExceeded(ServiceError):
    def __init__(self, msg: str): super().__init__(msg, code="QUOTA_EXCEEDED", retriable=True)
```

## Concurrent Reliability with TaskGroup

```python
async def enrich_document(doc: dict) -> dict:
    async with asyncio.TaskGroup() as tg:
        embed_task = tg.create_task(generate_embedding(doc["text"]))
        classify_task = tg.create_task(classify_content(doc["text"]))
        safety_task = tg.create_task(check_content_safety(doc["text"]))
    # If ANY task raises, TaskGroup cancels siblings and propagates ExceptionGroup
    doc["embedding"] = embed_task.result()
    doc["category"] = classify_task.result()
    doc["safety"] = safety_task.result()
    return doc
```

## Rate Limiting — Token Bucket

```python
import time, asyncio

class TokenBucket:
    def __init__(self, rate: float, capacity: int):
        self.rate, self.capacity = rate, capacity
        self._tokens, self._last = float(capacity), time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, tokens: int = 1) -> None:
        async with self._lock:
            now = time.monotonic()
            self._tokens = min(self.capacity, self._tokens + (now - self._last) * self.rate)
            self._last = now
            if self._tokens < tokens:
                wait = (tokens - self._tokens) / self.rate
                await asyncio.sleep(wait)
                self._tokens = 0
            else:
                self._tokens -= tokens

llm_limiter = TokenBucket(rate=10, capacity=60)  # 10 req/s, burst 60
```

## Anti-Patterns

- ❌ Bare `except Exception: pass` — swallows errors, masks failures
- ❌ Retry on non-retriable errors (400, 401, 403) — wastes quota, never succeeds
- ❌ Unbounded retry without `stop_after_attempt` — infinite loops under failure
- ❌ Creating new `httpx.Client` per request — no connection reuse, socket exhaustion
- ❌ `asyncio.gather(return_exceptions=True)` without inspecting results — silent failures
- ❌ Health endpoint that returns 200 when dependencies are down
- ❌ Missing `pool_pre_ping` on long-lived DB connections — stale connection errors
- ❌ Synchronous I/O inside `async def` — blocks the event loop

## WAF Alignment

| Pillar | Pattern | Detail |
|--------|---------|--------|
| Reliability | Tenacity retry | `wait_exponential(1,1,30)`, `stop_after_attempt(3)`, typed exceptions |
| Reliability | Circuit breaker | `pybreaker` — `fail_max=5`, `reset_timeout=30`, exclude validation |
| Reliability | Health checks | `/health` with per-dependency status, 503 on degraded |
| Reliability | Graceful shutdown | SIGTERM → drain → close pools → flush telemetry |
| Reliability | Dead letter queue | Route poison messages after `max_retries`, preserve error context |
| Performance | Connection pooling | SQLAlchemy `pool_size=20`, httpx `max_connections=100` |
| Performance | TaskGroup | Concurrent fan-out with automatic cancellation on failure |
| Performance | Token bucket | Rate-limit outbound calls, prevent upstream throttling |
| Security | Error hierarchy | Typed codes, no stack traces to clients, retriable flag |
| Cost | Idempotency | SHA-256 key, Redis TTL — prevent duplicate expensive calls |
