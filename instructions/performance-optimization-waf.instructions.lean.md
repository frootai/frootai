---
description: "Performance optimization standards — measure first, profile before optimizing, and avoid premature optimization."
applyTo: "*"
waf:
  - "performance-efficiency"
  - "cost-optimization"
---

# Performance Optimization — FAI Standards

## Async & Parallel Execution

Fire independent I/O concurrently. Sequential awaits on unrelated calls waste wall-clock time.

```typescript
// ✅ Parallel — total time = max(a, b, c)
const [users, orders, inventory] = await Promise.all([
  fetchUsers(ids),
  fetchOrders(dateRange),
  fetchInventory(skus),
]);

// ✅ Controlled concurrency for large fan-outs
async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit).map(fn);
    results.push(...await Promise.all(batch));
  }
  return results;
}
```

```python
# ✅ Parallel — gather with return_exceptions to avoid silent failures
results = await asyncio.gather(
    fetch_users(ids),
    fetch_orders(date_range),
    fetch_inventory(skus),
    return_exceptions=True,
)
for r in results:
    if isinstance(r, Exception):
        logger.error("Parallel task failed", exc_info=r)

# ✅ Semaphore-bounded concurrency
sem = asyncio.Semaphore(10)
async def bounded_fetch(url: str) -> bytes:
    async with sem:
        async with session.get(url) as resp:
            return await resp.read()
```

## Streaming Responses

Stream LLM and large payloads — never buffer entire responses when the client can consume chunks.

```typescript
// SSE streaming from an LLM endpoint
app.get("/api/chat", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const stream = await openai.chat.completions.create({ model: "gpt-4o", messages, stream: true });
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
  }
  res.write("data: [DONE]\n\n");
  res.end();
});
```

```python
# FastAPI streaming response
from fastapi.responses import StreamingResponse

async def generate_stream(messages: list[dict]):
    stream = await client.chat.completions.create(model="gpt-4o", messages=messages, stream=True)
    async for chunk in stream:
        if content := chunk.choices[0].delta.content:
            yield f"data: {json.dumps({'content': content})}\n\n"
    yield "data: [DONE]\n\n"

@app.post("/api/chat")
async def chat(req: ChatRequest):
    return StreamingResponse(generate_stream(req.messages), media_type="text/event-stream")
```

## Connection Pooling

Create clients once at module scope. Never instantiate HTTP/DB clients per request.

```typescript
// ✅ Module-scoped — reuses TCP connections, TLS sessions, DNS cache
const httpAgent = new https.Agent({ keepAlive: true, maxSockets: 50, maxFreeSockets: 10 });
const httpClient = axios.create({ httpAgent, timeout: 10_000 });

// DB pool — sized to (core_count * 2) + spindle_count
const pool = new Pool({ host, database, max: 20, idleTimeoutMillis: 30_000 });
```

```python
# httpx with connection pool (async context manager)
client = httpx.AsyncClient(limits=httpx.Limits(max_connections=50, max_keepalive_connections=10), timeout=10.0)

# SQLAlchemy async pool
engine = create_async_engine(db_url, pool_size=20, max_overflow=5, pool_recycle=1800)
```

## Caching Strategies

| Layer | Tool | TTL | Use Case |
| --- | --- | --- | --- |
| L1 In-memory | LRU cache / `Map` | 30-300s | Hot config, token counts, repeated lookups |
| L2 Distributed | Redis | 5-60min | Embedding results, API responses, session data |
| L3 CDN | Azure CDN / Cloudflare | 1h-1d | Static assets, pre-rendered pages |
| HTTP | `stale-while-revalidate` | varies | Serve stale, revalidate async |

```typescript
// LRU with TTL (use lru-cache or quick-lru)
import { LRUCache } from "lru-cache";
const cache = new LRUCache<string, EmbeddingResult>({ max: 1000, ttl: 5 * 60_000 });

async function getEmbedding(text: string): Promise<number[]> {
  const key = createHash("sha256").update(text).digest("hex");
  const cached = cache.get(key);
  if (cached) return cached.vector;
  const result = await embedClient.embed(text);
  cache.set(key, result);
  return result.vector;
}
```

```python
from functools import lru_cache
from cachetools import TTLCache

embedding_cache = TTLCache(maxsize=1000, ttl=300)

async def get_embedding(text: str) -> list[float]:
    key = hashlib.sha256(text.encode()).hexdigest()
    if key in embedding_cache:
        return embedding_cache[key]
    result = await embed_client.embed(text)
    embedding_cache[key] = result
    return result
```

## Database Query Optimization

- **N+1 prevention**: Use `JOIN` / `$lookup` / `include` — never query inside a loop
- **Pagination**: Keyset (cursor) pagination over `OFFSET`/`SKIP` for large tables
- **Projections**: Select only needed columns — `SELECT id, name` not `SELECT *`
- **Indexing**: Composite indexes for multi-column filters; cover queries with included columns
- **Batch writes**: Use `executemany` / `bulkWrite` — individual inserts are 10-100x slower

```typescript
// ❌ N+1 — fires 100 queries
const users = await db.query("SELECT * FROM users LIMIT 100");
for (const u of users) { u.orders = await db.query("SELECT * FROM orders WHERE user_id = $1", [u.id]); }

// ✅ Single join
const rows = await db.query(`SELECT u.id, u.name, o.id as order_id, o.total
  FROM users u LEFT JOIN orders o ON u.id = o.user_id LIMIT 100`);
```

## Memory Management

- Use generators/async iterators for datasets that exceed available RAM
- Use `WeakRef` / `WeakMap` for caches that should not prevent garbage collection
- Profile with `--inspect` (Node) or `tracemalloc` (Python) before optimizing

```python
# ✅ Generator — processes 10M rows in constant memory
def read_large_csv(path: str):
    with open(path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield transform(row)

# Process in chunks
for batch in itertools.batched(read_large_csv("data.csv"), 1000):
    await bulk_insert(batch)
```

## Cold Start & Serverless Optimization

- Minimize top-level imports — lazy-load heavy modules (pandas, torch, sklearn)
- Pre-warm connections in module scope, not per invocation
- Keep deployment packages small: tree-shake, exclude dev dependencies, use layers
- Set `FUNCTIONS_WORKER_PROCESS_COUNT` and pre-initialized instances for Azure Functions

## Batch Processing

- Embeddings: batch up to 16-2048 texts per call (model-dependent) — never embed one-by-one
- LLM classification: group requests and use structured output for batch scoring
- File uploads: multipart with concurrent chunk upload, resume on failure

## Content Compression

- Serve all HTTP responses with Brotli (preferred) or gzip — `Accept-Encoding: br, gzip`
- Compress assets at build time (`.br` / `.gz` pre-compressed files) — avoid runtime compression CPU
- Set `Content-Encoding` header; use `CompressionStream` API in edge runtimes
- Minimum compression threshold: 1KB — compressing smaller payloads wastes CPU

## Bundle & Code Splitting

- Dynamic `import()` for routes and heavy components — keep initial bundle < 200KB
- Tree-shake: use ESM, avoid `export default { ... }` barrel re-exports
- Analyze with `source-map-explorer` or `webpack-bundle-analyzer` — remove duplicate polyfills
- Image optimization: WebP/AVIF with `<picture>` fallback, lazy-load below-the-fold

## Anti-Patterns

- ❌ Sequential `await` on independent async calls — use `Promise.all` / `asyncio.gather`
- ❌ Creating new HTTP/DB clients per request — pool at module scope
- ❌ `SELECT *` queries or missing pagination on unbounded result sets
- ❌ Querying inside loops (N+1) — join or batch-fetch
- ❌ Buffering entire LLM responses before sending to client — stream
- ❌ No cache layer between app and expensive API calls (embeddings, search)
- ❌ Synchronous file I/O on the request path — use async `fs.promises` / `aiofiles`
- ❌ Importing entire libraries for a single function (`import _ from "lodash"`)
- ❌ Runtime compression without pre-compressed static assets
- ❌ Missing `Connection: keep-alive` or per-request DNS resolution

## WAF Alignment

| Pillar | Performance Practice |
|--------|---------------------|
| **Performance Efficiency** | Stream responses, connection pooling, LRU + Redis caching, async parallelism, lazy loading |
| **Cost Optimization** | Batch API calls to reduce per-request overhead, cache embeddings to avoid recomputation, right-size connection pools |
| **Reliability** | Bounded concurrency prevents downstream overload, semaphores protect shared resources, circuit breakers on pool exhaustion |
| **Operational Excellence** | CPU/memory profiling in CI, p50/p95/p99 latency dashboards, bundle size budgets in build pipeline |
| **Security** | Cache invalidation on permission changes, compressed responses include proper `Vary` headers, pool credentials via Managed Identity |
