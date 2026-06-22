---
description: "TypeScript reliability standards — AbortSignal timeout, retry patterns, health endpoints, error boundaries."
applyTo: "**/*.ts"
waf:
  - "reliability"
---

# TypeScript Reliability Patterns — FAI Standards

## Retry with Exponential Backoff

```typescript
// Custom retry — no dependencies
async function withRetry<T>(
  fn: () => Promise<T>,
  opts = { retries: 3, baseMs: 1000, maxMs: 30_000 }
): Promise<T> {
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === opts.retries) throw err;
      const jitter = Math.random() * 200;
      const delay = Math.min(opts.baseMs * 2 ** attempt + jitter, opts.maxMs);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

// p-retry — production-grade alternative
import pRetry, { AbortError } from "p-retry";
const data = await pRetry(() => fetchFromApi("/items"), {
  retries: 4,
  minTimeout: 1_000,
  onFailedAttempt: (e) =>
    console.error(`Attempt ${e.attemptNumber} failed: ${e.message}`),
});
```

## Circuit Breaker (opossum)

```typescript
import CircuitBreaker from "opossum";
const breaker = new CircuitBreaker(callExternalService, {
  timeout: 5_000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 10,
});
breaker.fallback(() => ({ source: "cache", stale: true }));
breaker.on("open", () => logger.warn("Circuit OPEN — using fallback"));
const result = await breaker.fire(requestPayload);
```

## AbortController Timeouts

```typescript
async function fetchWithTimeout(url: string, ms = 5_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```

## Graceful Shutdown

```typescript
const connections = new Set<import("net").Socket>();
server.on("connection", (sock) => {
  connections.add(sock);
  sock.on("close", () => connections.delete(sock));
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — draining`);
  server.close();
  for (const sock of connections) sock.destroy();
  await db.end();
  await telemetry.flush();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

## Health Check Endpoint

```typescript
// Express
app.get("/health", async (_req, res) => {
  const checks = await Promise.allSettled([
    db.query("SELECT 1"),
    redis.ping(),
  ]);
  const healthy = checks.every((c) => c.status === "fulfilled");
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "healthy" : "degraded",
    db: checks[0].status,
    cache: checks[1].status,
    uptime: process.uptime(),
  });
});
```

## Connection Pooling

```typescript
// undici — HTTP connection pool
import { Pool } from "undici";
const httpPool = new Pool("https://api.example.com", { connections: 20, pipelining: 1 });

// pg — Postgres connection pool
import { Pool as PgPool } from "pg";
const pgPool = new PgPool({ max: 20, idleTimeoutMillis: 30_000 });
pgPool.on("error", (err) => logger.error("Idle client error", err));
```

## Error Class Hierarchy

```typescript
abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly isOperational = true;
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
  }
}
class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
  readonly statusCode = 404;
}
class ConflictError extends AppError {
  readonly code = "CONFLICT";
  readonly statusCode = 409;
}
class UpstreamError extends AppError {
  readonly code = "UPSTREAM_FAILURE";
  readonly statusCode = 502;
}
```

## Idempotency Middleware

```typescript
import type { RequestHandler } from "express";
const seen = new Map<string, { status: number; body: unknown }>();

const idempotent: RequestHandler = (req, res, next) => {
  const key = req.headers["idempotency-key"] as string | undefined;
  if (!key) return next();
  if (seen.has(key)) {
    const cached = seen.get(key)!;
    return res.status(cached.status).json(cached.body);
  }
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    seen.set(key, { status: res.statusCode, body });
    return originalJson(body);
  };
  next();
};
```
> Production: replace `Map` with Redis using `SET key NX EX 86400`.

## Dead Letter Queue (Azure Service Bus)

```typescript
import { ServiceBusClient } from "@azure/service-bus";
const sbClient = new ServiceBusClient(connStr);
const receiver = sbClient.createReceiver("orders", { receiveMode: "peekLock" });
receiver.subscribe({
  processMessage: async (msg) => {
    if (msg.deliveryCount > 5) {
      await receiver.deadLetterMessage(msg, {
        deadLetterReason: "MaxRetriesExceeded",
      });
      return;
    }
    await processOrder(msg.body);
    await receiver.completeMessage(msg);
  },
  processError: async (err) => logger.error("SB error", err),
});
```

## Partial Failure Handling

```typescript
const results = await Promise.allSettled(
  urls.map((u) => fetchWithTimeout(u, 3_000))
);
const succeeded = results.filter((r) => r.status === "fulfilled");
const failed = results.filter((r) => r.status === "rejected");
if (failed.length) logger.warn(`${failed.length}/${results.length} calls failed`);
```

## Rate Limiting (bottleneck)

```typescript
import Bottleneck from "bottleneck";
const limiter = new Bottleneck({ maxConcurrent: 5, minTime: 200 });
const rateLimited = limiter.wrap(callExternalApi);
const results = await Promise.all(items.map((i) => rateLimited(i)));
```

## Structured Error Responses (RFC 7807)

```typescript
interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}
app.use((err: AppError, req: Request, res: Response, _next: NextFunction) => {
  const problem: ProblemDetail = {
    type: `https://api.example.com/errors/${err.code}`,
    title: err.name,
    status: err.statusCode,
    detail: err.message,
    instance: req.originalUrl,
  };
  res.status(err.statusCode).json(problem);
});
```

## Anti-Patterns

- ❌ Bare `catch {}` that swallows errors — always log or rethrow
- ❌ Unbounded `Promise.all` without concurrency limit — use `bottleneck` or `p-limit`
- ❌ Missing `AbortController` timeout on outbound HTTP — one hung call blocks the event loop
- ❌ `process.exit(1)` inside request handlers — kills in-flight requests; use graceful shutdown
- ❌ Storing idempotency keys in memory across multiple instances — use Redis
- ❌ Retrying non-idempotent writes without deduplication — causes duplicate side effects
- ❌ Health check that returns 200 without probing dependencies — hides cascading failures

## WAF Alignment

| Pillar | Pattern | Benefit |
| --- | --- | --- |
| Reliability | Retry + backoff, circuit breaker, DLQ | Survives transient faults, prevents cascading failure |
| Reliability | Graceful shutdown, health checks | Zero-downtime deploys, load balancer awareness |
| Reliability | `Promise.allSettled`, partial failure | Degrades gracefully instead of all-or-nothing |
| Performance | Connection pooling, rate limiting | Bounded resource usage, predictable throughput |
| Security | Error hierarchy, RFC 7807 responses | No stack traces leaked, consistent error contract |
| Operational Excellence | Structured logging, idempotency keys | Debuggable, safely retryable operations |
