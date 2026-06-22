---
description: "Python performance — async/await, connection pooling, streaming, profiling with cProfile/py-spy."
applyTo: "**/*.py"
waf:
  - "performance-efficiency"
---

# Python Performance — FAI Standards

## Concurrency Model Decision Matrix

| Workload | Use | Why |
| --- | --- | --- |
| I/O-bound (HTTP, DB, file) | `asyncio` | Single-thread, no GIL contention, lowest overhead |
| CPU-bound (ML inference, hashing) | `multiprocessing` / `ProcessPoolExecutor` | Bypasses GIL, true parallelism |
| Mixed I/O + light CPU | `asyncio` + `run_in_executor` | Offload CPU bursts without blocking event loop |
| Legacy sync libraries | `threading` / `ThreadPoolExecutor` | GIL released during I/O waits |

## Asyncio Patterns

### Bounded concurrency with semaphore
```python
import asyncio
import httpx

async def fetch_all(urls: list[str], max_concurrent: int = 20) -> list[dict]:
    sem = asyncio.Semaphore(max_concurrent)
    async with httpx.AsyncClient(timeout=30) as client:
        async def _fetch(url: str) -> dict:
            async with sem:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.json()
        return await asyncio.gather(*[_fetch(u) for u in urls])
```

### TaskGroup (Python 3.11+) — structured concurrency
```python
async def process_batch(items: list[str]) -> list[Result]:
    results: list[Result] = []
    async with asyncio.TaskGroup() as tg:
        for item in items:
            tg.create_task(process_one(item, results))
    return results  # all tasks completed or group cancelled on first exception
```

### Event loop — use uvloop in production
```python
# pyproject.toml: dependencies = ["uvloop>=0.19"]
import uvloop
asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())  # 2-4x faster than default
```

## Memory Efficiency

### Generators over lists for large datasets
```python
# ❌ Loads entire file into memory
rows = [parse(line) for line in open("data.jsonl")]

# ✅ Streams line-by-line — constant memory
def stream_rows(path: str):
    with open(path) as f:
        for line in f:
            yield parse(line)
```

### __slots__ on data-heavy classes
```python
from dataclasses import dataclass

@dataclass(slots=True)  # 40-50% less memory per instance
class Embedding:
    id: str
    vector: list[float]
    metadata: dict[str, str]
```

### Lazy imports for startup speed
```python
def encode_image(path: str) -> bytes:
    from PIL import Image  # ~200ms import — defer until first call
    img = Image.open(path)
    return img.tobytes()
```

## Caching

```python
from functools import lru_cache, cache

@lru_cache(maxsize=1024)  # bounded — evicts LRU when full
def get_embedding_model(model_name: str) -> EmbeddingModel:
    return load_model(model_name)

@cache  # unbounded — use only for small finite domains
def parse_config(path: str) -> dict:
    return json.loads(Path(path).read_text())
```

## Fast Serialization

```python
# orjson: 3-10x faster than stdlib json
import orjson
data = orjson.dumps(payload, option=orjson.OPT_SERIALIZE_NUMPY)
parsed = orjson.loads(raw_bytes)

# msgspec: zero-copy deserialization with schema validation
import msgspec
class Chunk(msgspec.Struct):
    id: str
    text: str
    score: float
decoder = msgspec.json.Decoder(list[Chunk])
chunks = decoder.decode(raw_bytes)  # validates + deserializes in one pass
```

## NumPy Vectorization

```python
import numpy as np

# ❌ Python loop — 100x slower
similarities = [np.dot(query, doc) / (np.linalg.norm(query) * np.linalg.norm(doc)) for doc in docs]

# ✅ Vectorized — single C-level operation
docs_matrix = np.stack(docs)  # (N, D)
norms = np.linalg.norm(docs_matrix, axis=1) * np.linalg.norm(query)
similarities = docs_matrix @ query / norms
```

## Connection Pooling

```python
# httpx — reuse TCP connections, HTTP/2 multiplexing
client = httpx.AsyncClient(
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
    timeout=httpx.Timeout(30.0, connect=5.0),
    http2=True,
)

# SQLAlchemy — bounded pool with overflow
from sqlalchemy.ext.asyncio import create_async_engine
engine = create_async_engine(
    db_url,
    pool_size=20,          # persistent connections
    max_overflow=10,       # burst capacity — closed after use
    pool_recycle=1800,     # recycle stale connections every 30min
    pool_pre_ping=True,    # verify connection before checkout
)
```

## Profiling Toolkit

| Tool | Use Case | Command |
|------|----------|---------|
| `cProfile` | Function-level CPU hotspots | `python -m cProfile -s cumtime app.py` |
| `py-spy` | Production sampling (no restart) | `py-spy top --pid 1234` |
| `memory_profiler` | Line-by-line memory usage | `python -m memory_profiler script.py` |
| `memray` | Allocation tracking with flamegraph | `memray run script.py && memray flamegraph output.bin` |
| `scalene` | CPU + memory + GPU combined | `scalene script.py` |
| `line_profiler` | Line-by-line CPU time | `kernprof -lv script.py` |

## C Extension Acceleration

- **Cython**: annotate hot loops with `cdef`, compile to C — 10-100x speedup for numeric code
- **PyO3 / maturin**: write Rust, expose as Python module — safe concurrency + zero-cost abstractions
- **cffi / ctypes**: call existing C/C++ libraries without compilation step
- Rule: profile first, optimize the measured bottleneck, never speculate

## Anti-Patterns

- ❌ `time.sleep()` in async code — blocks the entire event loop; use `await asyncio.sleep()`
- ❌ `asyncio.gather()` with unbounded tasks — OOM on large inputs; use semaphore
- ❌ Creating new `httpx.Client` per request — TCP handshake + TLS negotiation on every call
- ❌ `json.dumps`/`json.loads` in hot paths — use `orjson` or `msgspec` for 3-10x improvement
- ❌ Python loops over NumPy arrays — defeats vectorization; use array operations
- ❌ `@lru_cache` on methods without `__hash__` — caches `self`, leaks memory
- ❌ `global` interpreter lock workarounds via threads for CPU work — use `multiprocessing`
- ❌ Profiling in debug mode — use release builds; `PYTHONDONTWRITEBYTECODE=1` skews results
- ❌ Premature Cython/Rust — profile first, optimize measured bottlenecks only

## WAF Alignment

| WAF Pillar | Practice |
| --- | --- |
| Performance Efficiency | uvloop, orjson, connection pooling, vectorized NumPy, `__slots__` |
| Reliability | Bounded semaphores prevent resource exhaustion; pool_pre_ping detects stale DB connections |
| Cost Optimization | Generator streaming avoids memory over-provisioning; caching reduces redundant API calls |
| Operational Excellence | cProfile/py-spy in CI gates; `memray` flamegraphs in post-deployment validation |
| Security | `pool_recycle` rotates connections; bounded concurrency prevents self-DoS |
- Health check at /health with dependency status
- Graceful degradation, connection pooling, SIGTERM handling

### Cost Optimization
- max_tokens from config — never unlimited
- Model routing (gpt-4o-mini for classification, gpt-4o for reasoning)
- Semantic caching with Redis (TTL from config)
- Right-sized SKUs, FinOps telemetry (token usage per request)

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
