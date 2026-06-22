---
description: "Prisma ORM standards — schema design, migrations, query optimization, relation loading, type safety."
applyTo: "**/*.ts, **/schema.prisma"
waf:
  - "reliability"
  - "performance-efficiency"
---

# Prisma — FAI Standards

## Schema Design

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  role      Role     @default(USER)
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  @@index([email, role])
  @@map("users")
}

model Post {
  id        String  @id @default(cuid())
  title     String  @db.VarChar(255)
  published Boolean @default(false)
  authorId  String
  author    User    @relation(fields: [authorId], references: [id], onDelete: Cascade)
  @@unique([authorId, title])
  @@index([authorId, published])
  @@map("posts")
}

enum Role { USER ADMIN MODERATOR }
```

- `@@index` on every FK and filter column. `@@unique` for compound constraints. `@@map`/`@map` for naming.
- Prefer `cuid()` over `uuid()` — shorter, sortable, index-friendly. `@db.*` for DB-specific types.

## Prisma Client Queries

```typescript
// Paginated list with filtering
const users = await prisma.user.findMany({
  where: { role: "ADMIN", deletedAt: null },
  select: { id: true, email: true, name: true },
  orderBy: { createdAt: "desc" },
  skip: (page - 1) * pageSize,
  take: pageSize,
});

// Unique lookup — throws if not found
const user = await prisma.user.findUniqueOrThrow({
  where: { id: userId },
  include: { posts: { where: { published: true }, take: 10 } },
});

// Upsert — create or update atomically
const profile = await prisma.profile.upsert({
  where: { userId },
  create: { userId, bio, avatarUrl },
  update: { bio, avatarUrl },
});
```

- `select` for specific fields, `include` for relations — never combine both on the same level.
- Always paginate: `skip`/`take` or cursor-based (`cursor`, `take`, `skip: 1`).

## Transactions

```typescript
const order = await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: { userId, total } });
  await tx.orderItem.createMany({ data: items.map((i) => ({ orderId: order.id, ...i })) });
  await tx.user.update({ where: { id: userId }, data: { balance: { decrement: total } } });
  return order;
}, { timeout: 10_000, isolationLevel: "Serializable" });

// Sequential — independent ops, single round-trip
const [userCount, postCount] = await prisma.$transaction([
  prisma.user.count(), prisma.post.count({ where: { published: true } }),
]);
```

- Interactive for dependent ops with rollback. Sequential for batched independent reads/writes.
- Set `timeout` on interactive transactions to prevent long-held locks.

## Raw SQL

```typescript
const results = await prisma.$queryRaw<{ id: string; rank: number }[]>`
  SELECT id, ts_rank(search_vector, to_tsquery(${searchTerm})) AS rank
  FROM posts WHERE search_vector @@ to_tsquery(${searchTerm})
  ORDER BY rank DESC LIMIT ${limit}`;
```

- Tagged template literals auto-escape parameters. Never use `$queryRawUnsafe` with user input.

## Migrations & Seeding

```bash
prisma migrate dev --name add-role    # Dev: generate + apply + regen client
prisma migrate deploy                 # Prod: apply pending only (CI/CD)
prisma migrate resolve --applied "20240101_init"  # Mark as applied (hotfix)
prisma db seed                        # Runs prisma.seed from package.json
```

- Never edit applied SQL. Never run `migrate dev` in production.
- Seed config: `"prisma": { "seed": "tsx prisma/seed.ts" }` in `package.json`.

## Middleware, Soft Delete & Pooling

```typescript
// Slow-query logging middleware
prisma.$use(async (params, next) => {
  const start = performance.now();
  const result = await next(params);
  const ms = performance.now() - start;
  if (ms > 200) logger.warn({ model: params.model, action: params.action, ms }, "Slow query");
  return result;
});

// Soft delete via client extension
const xprisma = new PrismaClient().$extends({
  query: { $allModels: {
    async findMany({ args, query }) { args.where = { ...args.where, deletedAt: null }; return query(args); },
    async delete({ model, args }) { return (prisma as any)[model].update({ where: args.where, data: { deletedAt: new Date() } }); },
  }},
});
```

- PgBouncer: `transaction` mode, `?pgbouncer=true&connection_limit=1` in URL.
- Serverless: Prisma Accelerate or `connection_limit=1` per instance. Set `pool_timeout`.

## Error Handling

```typescript
try { await prisma.user.create({ data: { email } }); }
catch (e) {
  if (e instanceof PrismaClientKnownRequestError) {
    if (e.code === "P2002") throw new ConflictError(`Duplicate: ${e.meta?.target}`);
    if (e.code === "P2025") throw new NotFoundError("Record not found");
    if (e.code === "P2003") throw new BadRequestError("FK constraint failed");
  }
  throw e;
}
}
```

## Testing

```typescript
// Singleton client — prevents connection pool exhaustion across test files
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- Singleton client — one per test suite. Test against real DB (Docker Postgres), not mocks.
- Use `jest-prisma` or `vitest --pool=forks` for connection isolation.
- **Prisma Studio** (`npx prisma studio`) for visual data inspection during development.

## Anti-Patterns

- ❌ N+1 queries — use `include`/`select` with the parent, not loops
- ❌ Missing `@@index` on FK/filter columns — causes full table scans
- ❌ `findMany` without `take` — unbounded results crash memory
- ❌ `$queryRawUnsafe` with user input — SQL injection
- ❌ Editing applied migrations — creates environment drift
- ❌ `new PrismaClient()` per request — pool exhaustion
- ❌ Mixing `select` + `include` on same level — `include` silently ignored

## WAF Alignment

| Pillar | Practices |
|--------|-----------||
| **Reliability** | Interactive transactions with timeout + isolation. Retry on P1001 (connection). Health check `SELECT 1`. `prisma.$disconnect()` on shutdown. |
| **Security** | Tagged template `$queryRaw` prevents injection. `env("DATABASE_URL")` — no inline credentials. Middleware audit logging. Row-level tenant isolation. |
| **Performance** | `@@index` on FK + filter columns. `select` over `include`. Cursor pagination. PgBouncer/Accelerate pooling. Slow-query threshold at 200ms. |
| **Cost** | `connection_limit=1` for serverless, `10-20` for servers. `createMany` to reduce round-trips. |
| **Ops** | `migrate deploy` in CI/CD only. Seed scripts for reproducible data. Schema + migrations versioned in git. |
