---
description: "Uvicorn/ASGI standards — worker config, graceful shutdown, health checks, production settings."
applyTo: "**/*.py"
waf:
  - "performance-efficiency"
  - "reliability"
---

# Uvicorn & ASGI — FAI Standards

## Uvicorn Configuration

Production launch — never use `--reload` outside development:

```python
# main.py
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app:create_app",
        factory=True,
        host="0.0.0.0",
        port=8000,
        workers=4,               # CPU count, override via WEB_CONCURRENCY
        log_level="warning",     # info floods logs — warning+ in prod
        access_log=False,        # disable default, use structured middleware
        loop="uvloop",           # 2-4x faster than asyncio default
        http="httptools",        # C-based HTTP parser
        limit_concurrency=200,   # max simultaneous connections
        timeout_keep_alive=5,    # seconds before idle conn close
        timeout_notify=30,       # worker silence before restart
    )
```

## Gunicorn + UvicornWorker

Scale with gunicorn managing worker processes — preferred for multi-core production:

```python
# gunicorn.conf.py
import multiprocessing

bind = "0.0.0.0:8000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"
max_requests = 1000            # restart worker after N requests (leak guard)
max_requests_jitter = 50       # stagger restarts across workers
graceful_timeout = 30          # seconds to finish in-flight on SIGTERM
keepalive = 5
accesslog = "-"
errorlog = "-"
loglevel = "warning"
```

```toml
# pyproject.toml — pin versions
[project]
dependencies = [
    "uvicorn[standard]>=0.34.0",
    "gunicorn>=23.0.0",
    "uvloop>=0.21.0",
    "httptools>=0.6.0",
]
```

## ASGI Lifecycle Events

Register startup/shutdown via lifespan context manager (FastAPI 0.93+):

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — initialize pools, warm caches, verify dependencies
    app.state.db_pool = await create_pool(dsn=settings.DATABASE_URL, min_size=5, max_size=20)
    app.state.http_client = httpx.AsyncClient(timeout=30, limits=httpx.Limits(max_connections=100))
    yield
    # Shutdown — drain connections, flush telemetry
    await app.state.http_client.aclose()
    await app.state.db_pool.close()

app = FastAPI(lifespan=lifespan)
```

## Middleware Chain

Order matters — outermost executes first on request, last on response:

```python
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.gzip import GZipMiddleware

app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # explicit list — never ["*"] in prod
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)
```

## SSL/TLS Configuration

Terminate TLS at uvicorn only for dev/internal — use reverse proxy (nginx, Azure Front Door) in production:

```python
uvicorn.run(
    "app:app",
    ssl_keyfile="/certs/key.pem",
    ssl_certfile="/certs/cert.pem",
    ssl_version=ssl.PROTOCOL_TLS_SERVER,
)
```

## Structured Logging

Replace default access log with structlog for JSON output and correlation IDs:

```python
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)

@app.middleware("http")
async def log_requests(request, call_next):
    correlation_id = request.headers.get("x-correlation-id", uuid4().hex)
    structlog.contextvars.bind_contextvars(correlation_id=correlation_id)
    response = await call_next(request)
    structlog.get_logger().info("request", method=request.method, path=request.url.path, status=response.status_code)
    return response
```

## Health Check Endpoint

```python
@app.get("/health")
async def health(request: Request):
    db_ok = await request.app.state.db_pool.fetchval("SELECT 1") == 1
    return {"status": "healthy" if db_ok else "degraded", "db": db_ok}
```

## Graceful Shutdown & SIGTERM

Uvicorn handles SIGTERM by default — ensure in-flight work drains:

```python
import signal, asyncio

async def shutdown_handler():
    logger.info("shutdown_initiated")
    # Cancel background tasks, flush buffers
    for task in asyncio.all_tasks():
        if task is not asyncio.current_task():
            task.cancel()

loop = asyncio.get_event_loop()
loop.add_signal_handler(signal.SIGTERM, lambda: asyncio.create_task(shutdown_handler()))
```

## Docker Deployment

```dockerfile
FROM python:3.12-slim AS runtime
COPY --from=builder /app /app
WORKDIR /app
ENV WEB_CONCURRENCY=4
EXPOSE 8000
# exec form — PID 1 receives SIGTERM directly
ENTRYPOINT ["gunicorn", "app:create_app()", "-c", "gunicorn.conf.py"]
HEALTHCHECK --interval=15s --timeout=3s CMD curl -f http://localhost:8000/health || exit 1
```

Use `WEB_CONCURRENCY` env var so container orchestrators control worker count.

## HTTP/2 with Hypercorn

When HTTP/2 or HTTP/3 is needed, use hypercorn instead of uvicorn:

```bash
hypercorn app:app --bind 0.0.0.0:8000 --workers 4 --access-log - --quic-bind 0.0.0.0:4433
```

## Prometheus Metrics

```python
from prometheus_client import Counter, Histogram, make_asgi_app

REQUEST_COUNT = Counter("http_requests_total", "Total requests", ["method", "path", "status"])
REQUEST_LATENCY = Histogram("http_request_duration_seconds", "Latency", ["method", "path"])

metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
```

## Anti-Patterns

- ❌ `--reload` in production — file watcher overhead, single worker, no process management
- ❌ `workers=1` with gunicorn — defeats multi-core, single point of failure
- ❌ `access_log=True` at high RPS — synchronous I/O bottleneck, use structured middleware
- ❌ `allow_origins=["*"]` in CORSMiddleware — disables credential sharing, opens to CSRF
- ❌ Blocking calls (`requests.get`, `time.sleep`) inside async handlers — starves event loop
- ❌ Missing `HEALTHCHECK` in Dockerfile — orchestrator can't detect stuck processes
- ❌ Shell-form `CMD` in Docker — process runs under `/bin/sh`, never receives SIGTERM
- ❌ No `max_requests` in gunicorn — memory leaks accumulate until OOM kill

## WAF Alignment

| Pillar | Practice |
|--------|----------|
| **Performance** | `uvloop` + `httptools` for C-level parsing; `limit_concurrency` caps load; `GZipMiddleware` for response compression |
| **Reliability** | `max_requests` + jitter prevents OOM; `graceful_timeout=30` drains in-flight; lifespan events clean up resources |
| **Security** | `TrustedHostMiddleware` blocks host-header attacks; TLS termination; explicit CORS origins; no `--reload` in prod |
| **Operational Excellence** | structlog JSON + correlation IDs; Prometheus `/metrics`; `HEALTHCHECK` in Dockerfile; `WEB_CONCURRENCY` env var |
| **Cost Optimization** | Workers = `2*CPU+1` right-sizes compute; `timeout_keep_alive=5` frees idle connections; `access_log=False` reduces I/O |
