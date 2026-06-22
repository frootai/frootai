---
description: "TypeScript performance — event loop, streaming SSE, connection pooling, memory profiling."
applyTo: "**/*.ts"
waf:
  - "performance-efficiency"
---

# TypeScript Performance — FAI Standards

## Parallel I/O

Use `Promise.all` for independent operations that must all succeed. Use `Promise.allSettled` when partial failure is acceptable.

```typescript
// ✅ Parallel — 3 calls execute concurrently, total time = max(a, b, c)
const [embeddings, config, user] = await Promise.all([
  fetchEmbeddings(query),
  loadConfig("config/openai.json"),
  getUser(userId),
]);

// ✅ Partial failure tolerance — process what succeeded
const results = await Promise.allSettled(chunks.map(c => indexChunk(c)));
const succeeded = results.filter((r): r is PromiseFulfilledResult<IndexResult> => r.status === "fulfilled");
const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
```

Never `await` in a loop when iterations are independent — this serializes I/O.

## Streaming with Web Streams API

Prefer `ReadableStream`/`TransformStream` over buffering entire payloads.

```typescript
function streamTokens(response: AsyncIterable<ChatChunk>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      for await (const chunk of response) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.close();
    },
  });
}

// TransformStream for pipeline processing
const { readable, writable } = new TransformStream<string, Embedding>({
  async transform(chunk, controller) {
    controller.enqueue(await embed(chunk));
  },
});
```

## AbortController for Timeouts

Every outbound call must have a timeout. AbortController is the standard mechanism.

```typescript
async function fetchWithTimeout<T>(url: string, ms: number): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json() as T;
  } finally {
    clearTimeout(id);
  }
}
```

## Connection Pooling

Reuse connections — never create a new client per request.

```typescript
import { Pool } from "pg";
import { Agent } from "undici";

// pg: pool at module scope, shared across requests
const pool = new Pool({ max: 20, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });

// undici: persistent HTTP/1.1 or HTTP/2 connections
const dispatcher = new Agent({ connections: 50, pipelining: 1, keepAliveTimeout: 60_000 });
const res = await fetch(url, { dispatcher });
```

## Worker Threads for CPU-Bound Work

Offload CPU-intensive tasks (hashing, JSON schema validation, large transforms) to worker threads so the event loop stays free.

```typescript
import { Worker, isMainThread, parentPort } from "node:worker_threads";

if (isMainThread) {
  const result = await new Promise<Buffer>((resolve, reject) => {
    const w = new Worker(new URL(import.meta.url));
    w.on("message", resolve);
    w.on("error", reject);
    w.postMessage(largePayload);
  });
} else {
  parentPort!.on("message", (data) => {
    parentPort!.postMessage(cpuIntensiveWork(data));
  });
}
```

## WeakMap / WeakRef for Cache Eviction

Use `WeakRef` + `FinalizationRegistry` for caches that auto-evict when keys are GC'd. Use `WeakMap` when cache lifetime should match object lifetime.

```typescript
const cache = new Map<string, WeakRef<EmbeddingVector>>();
const registry = new FinalizationRegistry<string>((key) => cache.delete(key));

function cacheEmbedding(key: string, vec: EmbeddingVector): void {
  cache.set(key, new WeakRef(vec));
  registry.register(vec, key);
}

function getEmbedding(key: string): EmbeddingVector | undefined {
  return cache.get(key)?.deref();
}
```

## Lazy Module Loading

Use dynamic `import()` to defer loading of heavy dependencies until actually needed.

```typescript
async function analyzeImage(buffer: Buffer) {
  const { default: sharp } = await import("sharp"); // loaded only when called
  return sharp(buffer).metadata();
}
```

## V8 Optimization Hints

- **Monomorphic functions** — always pass the same shape of object. Polymorphic call sites deoptimize.
- **Hidden classes** — initialize all properties in the constructor in the same order. Never `delete obj.prop`.
- **Avoid megamorphic Map/Set** — V8 falls back to dictionary mode after ~30 inline cache misses.
- **Prefer `for` loops** over `.forEach()` for hot paths — avoids closure allocation per iteration.
- **Avoid `arguments`** — use rest params `(...args)`. `arguments` disables V8 optimizations.

## Node.js Runtime Tuning

- `--max-old-space-size=4096` — set to ~75% of container memory limit to leave room for native heap + stack
- `--max-semi-space-size=64` — increase for high-allocation-rate apps (default 16 MB)
- `NODE_OPTIONS="--enable-source-maps"` — only in staging, adds ~5% overhead
- ESM (`"type": "module"`) outperforms CJS for tree-shaking and static analysis but has cold-start overhead from top-level await resolution — benchmark both for serverless

## Event Loop Monitoring

Detect event loop stalls before they become user-visible latency.

```typescript
import { monitorEventLoopDelay } from "node:perf_hooks";

const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setInterval(() => {
  if (h.percentile(99) > 100_000_000) { // >100ms p99
    logger.warn({ p99: h.percentile(99) / 1e6 }, "event loop lag detected");
  }
  h.reset();
}, 10_000);
```

## Bundle Analysis & Tree-Shaking

- Run `npx source-map-explorer dist/main.js` to identify bloated dependencies
- Use `"sideEffects": false` in package.json to enable aggressive tree-shaking
- Prefer named exports over default exports — bundlers eliminate unused named exports
- Replace `lodash` → `lodash-es` or individual imports (`lodash/get`)
- `@rollup/plugin-terser` with `compress: { passes: 2 }` for production builds

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| `await` in `for` loop for independent calls | Serializes I/O, N× latency | `Promise.all(items.map(...))` |
| `JSON.parse(JSON.stringify(obj))` for deep clone | 10-50× slower than `structuredClone` | `structuredClone(obj)` |
| Creating `new Pool()` per request | Exhausts DB connections, causes ECONNREFUSED | Module-scope singleton pool |
| No timeout on `fetch`/HTTP calls | Hung connections exhaust sockets | `AbortController` with deadline |
| `Buffer.concat` in a loop | O(n²) copy on each iteration | Collect in array, single `Buffer.concat` at end |
| `process.env.X` in hot paths | V8 cannot inline — dictionary lookup each call | Read into const at startup |
| Synchronous `fs.readFileSync` in request handler | Blocks event loop for all concurrent requests | `fs.promises.readFile` or cache at startup |
| Unbounded `Map` cache without eviction | Memory leak → OOM kill | LRU cache with max size or `WeakRef` |

## WAF Alignment

| Pillar | TypeScript Performance Requirement |
|---|---|
| **Performance Efficiency** | Parallel I/O via `Promise.all`, streaming via `ReadableStream`, worker threads for CPU, event loop p99 < 100ms |
| **Reliability** | `AbortController` timeouts on all external calls, connection pool with health checks, graceful shutdown draining |
| **Cost Optimization** | Lazy imports to reduce cold-start, tree-shaking to shrink bundle, connection reuse to reduce socket churn |
| **Operational Excellence** | `monitorEventLoopDelay` metrics, `source-map-explorer` in CI, `--max-old-space-size` tuned to container limits |
| **Security** | No `eval()`, no `Function()` constructor, `AbortController` prevents connection exhaustion DoS |
