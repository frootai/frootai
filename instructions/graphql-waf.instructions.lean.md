---
description: "GraphQL standards — schema design, resolvers, DataLoader, error handling."
applyTo: "**/*.graphql, **/*.ts"
waf:
  - "reliability"
  - "performance-efficiency"
---

# GraphQL — FAI Standards

## Schema Design

- Fields are **nullable by default** — only mark `!` when the field is guaranteed to resolve
- Use `input` types for mutations — never reuse object types as arguments
- Prefer enums over string literals for finite value sets (`enum Role { ADMIN USER VIEWER }`)
- Suffix connection types with `Connection`, edges with `Edge` (`UserConnection`, `UserEdge`)
- ID fields use `ID!` scalar — never `String!` for identifiers
- Use `interface` and `union` for polymorphism — avoid catch-all types with dozens of nullable fields

```graphql
# ✅ Proper schema design
type User {
  id: ID!
  email: String!          # guaranteed at creation
  displayName: String     # nullable — may not be set yet
  role: Role!
  posts(first: Int, after: String): PostConnection!
}

enum Role { ADMIN EDITOR VIEWER }

input CreateUserInput {
  email: String!
  displayName: String
  role: Role = VIEWER     # default in input
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
}

type CreateUserPayload {
  user: User
  errors: [UserError!]!   # mutation errors as data, not exceptions
}

type UserError {
  field: String
  message: String!
  code: ErrorCode!
}
```

## Resolver Patterns

- **DataLoader for every 1:N / N:N relation** — solves N+1 at the field resolver level
- Create DataLoader instances **per-request** (in context factory) — never share across requests
- Field resolvers should be thin — delegate to service/repository layer
- Return `null` for missing optional data — throw only for unexpected failures

```typescript
// DataLoader setup — per-request, batched, cached
import DataLoader from "dataloader";

function createLoaders(db: Database) {
  return {
    userById: new DataLoader<string, User>(async (ids) => {
      const users = await db.users.findByIds([...ids]);
      const map = new Map(users.map((u) => [u.id, u]));
      return ids.map((id) => map.get(id) ?? new Error(`User ${id} not found`));
    }),
    postsByAuthor: new DataLoader<string, Post[]>(async (authorIds) => {
      const posts = await db.posts.findByAuthorIds([...authorIds]);
      const grouped = Map.groupBy(posts, (p) => p.authorId);
      return authorIds.map((id) => grouped.get(id) ?? []);
    }),
  };
}

// Field resolver — delegates to DataLoader
const resolvers = {
  Post: {
    author: (post, _args, ctx) => ctx.loaders.userById.load(post.authorId),
  },
};
```

## Relay Cursor-Based Pagination

- Implement Relay `Connection` spec for all list fields — `first/after`, `last/before`
- Cursor = opaque base64-encoded string (encode DB offset/ID, never expose raw values)
- Always return `pageInfo { hasNextPage hasPreviousPage startCursor endCursor }`
- Cap `first`/`last` to a server max (e.g., 100) — reject unbounded queries

```typescript
function connectionFromSlice<T extends { id: string }>(
  items: T[], args: { first?: number; after?: string }, totalCount: number
): Connection<T> {
  const edges = items.map((node) => ({
    node,
    cursor: Buffer.from(`cursor:${node.id}`).toString("base64"),
  }));
  return {
    edges,
    pageInfo: {
      hasNextPage: items.length === (args.first ?? 20),
      hasPreviousPage: !!args.after,
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges.at(-1)?.cursor ?? null,
    },
    totalCount,
  };
}
```

## Error Handling

- **Business errors → `errors[]` in response payload** (user not found, validation failure)
- **Unexpected errors → throw** — let the server format as GraphQL error with `extensions.code`
- Never leak stack traces — use `formatError` to strip internals in production
- Use `extensions.code` for machine-readable error classification (`UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`)

```typescript
import { GraphQLError } from "graphql";

// Business logic error — returned as data
throw new GraphQLError("Insufficient permissions", {
  extensions: { code: "FORBIDDEN", requiredRole: "ADMIN" },
});

// Format errors — strip details in production
function formatError(err: GraphQLError) {
  if (process.env.NODE_ENV === "production") {
    delete err.extensions?.stacktrace;
  }
  return err;
}
```

## Authentication & Authorization

- Extract auth token in **server context factory** — parse JWT, attach user to `ctx`
- Authorization in resolvers or directive-based (`@auth(requires: ADMIN)`)
- Never trust client-sent user IDs for authorization — use `ctx.user.id` from verified token
- Rate limit by authenticated user, not just IP

```typescript
// Context factory — runs once per request
async function contextFactory({ req }): Promise<GraphQLContext> {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = token ? await verifyJwt(token) : null;
  return { user, loaders: createLoaders(db), db };
}

// Resolver-level auth check
const resolvers = {
  Mutation: {
    deleteUser: (_parent, { id }, ctx) => {
      if (!ctx.user) throw new GraphQLError("Not authenticated", { extensions: { code: "UNAUTHENTICATED" } });
      if (ctx.user.role !== "ADMIN") throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
      return ctx.db.users.delete(id);
    },
  },
};
```

## Query Complexity & Depth Limiting

- Set `maxDepth: 10` — reject deeply nested queries that cause exponential resolver calls
- Assign complexity cost per field — connections cost more than scalar fields
- Set max complexity budget per request (e.g., 1000) — reject expensive queries before execution
- Use persisted queries (APQ) in production — clients send hash, server maps to allowed query

```typescript
import { createYoga } from "graphql-yoga";
import { useDepthLimit } from "@envelop/depth-limit";
import { usePersistedOperations } from "@graphql-yoga/plugin-persisted-operations";

const yoga = createYoga({
  plugins: [
    useDepthLimit({ maxDepth: 10 }),
    usePersistedOperations({ getPersistedOperation: (hash) => queryStore.get(hash) }),
  ],
});
```

## Subscriptions

- Use **WebSocket transport** (`graphql-ws` protocol, not legacy `subscriptions-transport-ws`)
- Authenticate on `connectionInit` — reject unauthenticated WebSocket connections
- Scope subscription payloads by user authorization — never broadcast data users can't see
- Implement heartbeat/keepalive to detect stale connections (30s interval)

## Schema-First vs Code-First

- **Schema-first** (SDL files): preferred for teams with frontend/backend separation — schema is the contract
- **Code-first** (TypeGraphQL, Pothos, Nexus): preferred when TypeScript types drive the schema — avoids drift
- Whichever approach: generate types from schema (`graphql-codegen`) to keep resolvers type-safe
- Never hand-write resolver argument types — always derive from schema

## Apollo Federation v2

- Use `@key` directive to define entity primary keys across subgraphs
- Reference entities with stub types (`extend type User @key(fields: "id") { id: ID! @external }`)
- Use `@shareable` for fields resolved by multiple subgraphs
- Gateway handles composition — subgraphs stay independently deployable

## Schema Evolution & Deprecation

- **Never remove fields** — deprecate first with `@deprecated(reason: "Use newField instead")`
- Monitor deprecated field usage via observability — remove only when traffic reaches zero
- Additive changes (new fields, new types) are always safe — no versioning needed
- Breaking changes require a new type or a migration period with both old and new fields

## Testing Resolvers

- Test resolvers as functions — pass mocked `context` with DataLoaders and DB stubs
- Integration test the full query → response cycle with `yoga.fetch()` or `apollo.executeOperation()`
- Snapshot-test schema SDL to catch unintended changes — commit `schema.graphql` to version control
- Test error paths: invalid input, unauthorized access, DataLoader key-not-found

## Anti-Patterns

- ❌ Returning entire entities from mutations instead of a typed payload with `errors[]`
- ❌ Using REST-style `getUser`/`getUserById` naming — use `user(id: ID!)` or `users(filter: ...)`
- ❌ Missing DataLoader on relation fields — guarantees N+1 queries
- ❌ Exposing database IDs directly in cursors — encode as opaque base64 strings
- ❌ Allowing arbitrary query depth/complexity — enables DoS via nested introspection
- ❌ Sharing DataLoader instances across requests — stale cache, data leaks between users
- ❌ Throwing exceptions for business logic errors instead of returning typed error payloads
- ❌ Using `subscriptions-transport-ws` (deprecated) — use `graphql-ws` protocol
- ❌ Versioning the API (`/v2/graphql`) — evolve the schema additively with deprecation

## WAF Alignment

| Pillar | GraphQL Practice |
|---|---|
| **Security** | JWT in context factory, resolver-level auth, persisted queries block injection, depth/complexity limits prevent DoS |
| **Reliability** | DataLoader batching prevents N+1 cascade failures, typed error payloads give clients actionable failures, nullable defaults prevent schema breakage |
| **Performance** | DataLoader batching + caching, cursor pagination (no offset scans), persisted queries (skip parse/validate), subscription keepalive |
| **Cost** | Complexity budgets cap expensive queries, field-level cost analysis, DataLoader deduplication reduces DB calls |
| **Ops Excellence** | Schema SDL committed + snapshot-tested, deprecated field usage tracked, `graphql-codegen` keeps types in sync, federation enables independent deploys |
| **Responsible AI** | Sanitize LLM outputs returned through GraphQL fields, audit log mutations that trigger AI actions, rate limit AI-backed resolvers separately |
