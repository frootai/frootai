---
description: "tRPC standards — router design, middleware, error handling, type-safe API calls, input validation."
applyTo: "**/*.ts"
waf:
  - "reliability"
  - "security"
---

# tRPC — FAI Standards

## Router Organization

Split routers by domain. Merge into a single `appRouter` exported as the type source of truth.

```typescript
// server/routers/user.ts
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";

export const userRouter = router({
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input, ctx }) => ctx.db.user.findUniqueOrThrow({ where: { id: input.id } })),
  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1).max(100) }))
    .mutation(({ input, ctx }) => ctx.db.user.update({ where: { id: input.id }, data: { name: input.name } })),
});

// server/routers/_app.ts
import { router, mergeRouters } from "../trpc";
import { userRouter } from "./user";
import { postRouter } from "./post";

export const appRouter = mergeRouters(
  router({ user: userRouter, post: postRouter })
);
export type AppRouter = typeof appRouter;
```

## Context & Middleware

Create context once per request. Layer middleware for cross-cutting concerns — logger → auth → rate limit.

```typescript
// server/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

export async function createContext({ req }: { req: Request }) {
  const session = await getSession(req.headers.get("authorization"));
  return { session, user: session?.user ?? null, db: prisma, logger: createLogger(req) };
}
type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({ transformer: superjson });

const loggerMiddleware = t.middleware(async ({ path, type, ctx, next }) => {
  const start = performance.now();
  const result = await next();
  ctx.logger.info({ path, type, durationMs: performance.now() - start, ok: result.ok });
  return result;
});

const authMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { user: ctx.session.user } }); // narrowed type
});

const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  const key = `ratelimit:${ctx.user?.id ?? ctx.session?.ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  if (count > 100) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" });
  return next();
});

export const router = t.router;
export const publicProcedure = t.procedure.use(loggerMiddleware);
export const protectedProcedure = publicProcedure.use(authMiddleware).use(rateLimitMiddleware);
```

## Input & Output Validation

Always validate inputs with Zod. Use `.output()` for contract enforcement on responses.

```typescript
const createPost = protectedProcedure
  .input(z.object({
    title: z.string().min(1).max(200).trim(),
    body: z.string().max(50_000),
    tags: z.array(z.string().max(30)).max(10).default([]),
  }))
  .output(z.object({ id: z.string(), createdAt: z.date() }))
  .mutation(async ({ input, ctx }) => {
    return ctx.db.post.create({ data: { ...input, authorId: ctx.user.id } });
  });
```

## Error Handling

Map domain errors to `TRPCError` codes. Never leak internal details to clients.

```typescript
import { TRPCError } from "@trpc/server";

function handleDomainError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") throw new TRPCError({ code: "CONFLICT", message: "Resource already exists" });
    if (err.code === "P2025") throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unexpected error", cause: err });
}

// Global error formatter — strip stack traces in production
t.create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: { ...shape.data, stack: process.env.NODE_ENV === "production" ? undefined : error.stack },
    };
  },
});
```

## React Query Integration

Use `@trpc/react-query` hooks. Invalidate related queries after mutations.

```typescript
// utils/trpc.ts
import { createTRPCReact, httpBatchLink, splitLink, httpLink } from "@trpc/react-query";
import type { AppRouter } from "../server/routers/_app";

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: wsLink({ url: "ws://localhost:3001" }),
      false: httpBatchLink({
        url: "/api/trpc",
        maxURLLength: 2048, // fall back to POST for large batches
        headers: () => ({ Authorization: `Bearer ${getToken()}` }),
      }),
    }),
  ],
});

// Component usage
function UserProfile({ id }: { id: string }) {
  const { data, isLoading } = trpc.user.getById.useQuery({ id });
  const utils = trpc.useUtils();
  const updateUser = trpc.user.update.useMutation({
    onSuccess: () => utils.user.getById.invalidate({ id }),
  });
  // ...
}
```

## Subscriptions (WebSocket)

Use `observable` for real-time events. Clean up with `unsubscribe`.

```typescript
import { observable } from "@trpc/server/observable";

export const notificationRouter = router({
  onNew: protectedProcedure.subscription(({ ctx }) =>
    observable<Notification>((emit) => {
      const handler = (data: Notification) => {
        if (data.userId === ctx.user.id) emit.next(data);
      };
      eventEmitter.on("notification", handler);
      return () => eventEmitter.off("notification", handler);
    })
  ),
});
```

## Server-Side Calls & Testing

Use `createCaller` for server-side invocation and tests. Inject mock context for isolation.

```typescript
import { appRouter } from "./routers/_app";

// Server-side call (e.g., from a webhook handler)
const caller = appRouter.createCaller({ session: null, user: null, db: prisma, logger });
const publicData = await caller.user.getById({ id: "abc" });

// Test with mock context
import { describe, it, expect } from "vitest";

describe("user.getById", () => {
  it("returns user by ID", async () => {
    const caller = appRouter.createCaller({
      session: { user: { id: "u1", role: "admin" } },
      user: { id: "u1", role: "admin" },
      db: mockPrisma,
      logger: mockLogger,
    });
    const user = await caller.user.getById({ id: "u1" });
    expect(user).toMatchObject({ id: "u1" });
  });

  it("throws NOT_FOUND for missing user", async () => {
    const caller = appRouter.createCaller({ session: null, user: null, db: mockPrisma, logger: mockLogger });
    await expect(caller.user.getById({ id: "missing" })).rejects.toThrow("NOT_FOUND");
  });
});
```

## OpenAPI Generation

Expose REST endpoints via `trpc-openapi` for external consumers.

```typescript
import { generateOpenApiDocument } from "trpc-openapi";

const openApiDoc = generateOpenApiDocument(appRouter, {
  title: "My API", version: "1.0.0", baseUrl: "https://api.example.com",
});

// Mark procedures as OpenAPI-enabled
const getUser = publicProcedure
  .meta({ openapi: { method: "GET", path: "/users/{id}", tags: ["users"] } })
  .input(z.object({ id: z.string().uuid() }))
  .output(userSchema)
  .query(({ input }) => db.user.findUniqueOrThrow({ where: { id: input.id } }));
```

## Anti-Patterns

- ❌ Importing `AppRouter` type as a value — use `import type` only
- ❌ Putting all procedures in one file — split by domain, merge at root
- ❌ Skipping `.input()` validation — raw `any` inputs bypass type safety at runtime
- ❌ Throwing plain `Error` instead of `TRPCError` — clients lose structured error codes
- ❌ Calling `trpc.useQuery` inside event handlers — hooks must be at component top level
- ❌ Missing `onSuccess` invalidation after mutations — stale cache shown to users
- ❌ Using `httpLink` when batching is available — `httpBatchLink` reduces HTTP roundtrips
- ❌ Leaking stack traces or DB errors to clients in production error responses
- ❌ Creating `createCaller` per request without proper context — bypasses middleware

## WAF Alignment

| Pillar | tRPC Practice |
|--------|--------------|
| **Security** | Auth middleware on `protectedProcedure`, Zod input validation, error formatter strips internals, rate limiting middleware, CORS on adapter |
| **Reliability** | Output validation enforces contracts, structured error codes for client retry logic, graceful WebSocket reconnection, circuit breaker in link chain |
| **Performance** | `httpBatchLink` reduces roundtrips, `splitLink` routes subscriptions to WS, `superjson` for efficient serialization, React Query caching + invalidation |
| **Cost** | Batch queries reduce server load, `maxURLLength` prevents oversized requests, selective invalidation avoids refetch storms |
| **Ops Excellence** | Logger middleware with correlation IDs, `trpc-openapi` for documentation, `createCaller` tests validate without HTTP overhead, type-safe client eliminates runtime type bugs |
