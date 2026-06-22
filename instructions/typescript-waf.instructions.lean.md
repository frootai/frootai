---
description: "TypeScript/JavaScript coding standards aligned with Azure WAF pillars — secure credential handling, async patterns, Zod validation, structured error handling, and production-ready testing with Vitest."
applyTo: "**/*.ts, **/*.tsx, **/*.js, **/*.jsx"
waf:
  - "security"
  - "reliability"
  - "performance-efficiency"
---

# TypeScript — FAI Standards

## Strict Mode & Compiler

Always enable `strict: true` in `tsconfig.json`. Use `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, and `"type": "module"` in `package.json` for ESM-first. Target ES2022+ for top-level await and native `structuredClone`.

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true
  }
}
```

## Discriminated Unions & Exhaustive Checks

Model domain states as tagged unions. Use `never` to guarantee exhaustiveness at compile time.

```typescript
type ApiResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "error"; code: number; message: string }
  | { status: "rate_limited"; retryAfterMs: number };

function handle(result: ApiResult): string {
  switch (result.status) {
    case "ok": return JSON.stringify(result.data);
    case "error": return `[${result.code}] ${result.message}`;
    case "rate_limited": return `Retry in ${result.retryAfterMs}ms`;
    default: {
      const _exhaustive: never = result;
      throw new Error(`Unhandled status: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
```

## Type Guards, `satisfies`, and Const Assertions

```typescript
// Type guard with `is` keyword — narrows at call site
function isRetryable(err: unknown): err is { statusCode: number; retryAfterMs: number } {
  return typeof err === "object" && err !== null && "statusCode" in err && "retryAfterMs" in err;
}

// satisfies — validates shape without widening
const endpoints = {
  openai: "https://eastus.api.cognitive.microsoft.com",
  search: "https://my-search.search.windows.net",
} satisfies Record<string, string>;

// as const — freezes literal types for config objects
const RETRY_CONFIG = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 30_000 } as const;
type RetryKey = keyof typeof RETRY_CONFIG; // "maxAttempts" | "baseDelayMs" | "maxDelayMs"
```

## Branded Types for Domain Safety

Prevent accidental mixing of structurally identical primitives.

```typescript
type Brand<T, B extends string> = T & { readonly __brand: B };
type UserId = Brand<string, "UserId">;
type SessionId = Brand<string, "SessionId">;

function createUserId(raw: string): UserId {
  if (!raw.startsWith("usr_")) throw new Error("Invalid user ID format");
  return raw as UserId;
}

// Compile error: Argument of type 'SessionId' is not assignable to parameter of type 'UserId'
function getUser(id: UserId): Promise<unknown> { /* ... */ }
```

## Template Literal Types

```typescript
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type ApiVersion = `v${number}`;
type Endpoint = `/${string}`;
type Route = `${HttpMethod} ${ApiVersion}${Endpoint}`;

const route: Route = "GET v2/users/profile"; // ✅
```

## Utility Types & Generic Constraints

```typescript
// Pick/Omit for API boundaries — expose only what clients need
type UserPublic = Pick<User, "id" | "displayName" | "avatar">;
type UserCreate = Omit<User, "id" | "createdAt">;

// Partial/Required for update vs create contracts
type UserUpdate = Partial<Pick<User, "displayName" | "avatar">>;

// Record for maps — always declare value type
type FeatureFlags = Record<string, boolean>;

// Generic constraints — bound T to what the function actually needs
function getProperty<T extends Record<string, unknown>, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

## Result Pattern & Error Handling

Never throw for expected failures. Reserve `throw` for programmer bugs.

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

async function fetchConfig(path: string): Promise<Result<Config, AppError>> {
  try {
    const raw = await fs.readFile(path, "utf8");
    return { ok: true, value: JSON.parse(raw) as Config };
  } catch (cause) {
    return { ok: false, error: new AppError("Config load failed", "CONFIG_ERR", 500, cause) };
  }
}
```

## Barrel Exports

Use `index.ts` to define public API surface per module. Re-export only what consumers need.

```typescript
// src/domain/index.ts
export type { UserId, SessionId } from "./branded.js";
export { createUserId } from "./branded.js";
export { AppError } from "./errors.js";
// Internal helpers NOT exported — enforces encapsulation
```

## Testing Types with Vitest

```typescript
import { expectTypeOf, describe, it } from "vitest";

describe("type contracts", () => {
  it("createUserId returns branded type", () => {
    expectTypeOf(createUserId).returns.toEqualTypeOf<UserId>();
  });
  it("Result discriminates correctly", () => {
    expectTypeOf<Result<string>>().toMatchTypeOf<{ ok: boolean }>();
  });
});
```

## Linting & Formatting (Biome-first)

Prefer Biome over ESLint+Prettier for speed. If ESLint is required, use flat config (`eslint.config.ts`).

```jsonc
// biome.json
{
  "linter": { "rules": { "suspicious": { "noExplicitAny": "error" } } },
  "formatter": { "indentStyle": "space", "indentWidth": 2 }
}
```

## Anti-Patterns

- ❌ `any` / `as unknown as T` — use type guards or `satisfies` instead
- ❌ Barrel re-exports of entire directories (`export * from`) — causes tree-shaking failures
- ❌ Throwing strings — always throw `Error` subclasses with `.code` and `.cause`
- ❌ `enum` — use `as const` objects + template literal unions; enums emit runtime code
- ❌ Default exports — named exports enable auto-import and refactoring tools
- ❌ `@ts-ignore` without issue link — use `@ts-expect-error` with justification
- ❌ Untyped `catch(e)` — narrow with `instanceof` or type guard before accessing properties
- ❌ `require()` in ESM — use `import` with `.js` extension for NodeNext resolution

## WAF Alignment

| Pillar | TypeScript Practice |
|---|---|
| **Security** | Branded types prevent ID confusion; Zod validates all external input at system boundaries; `noUncheckedIndexedAccess` catches undefined access; `DefaultAzureCredential` for auth |
| **Reliability** | `Result<T,E>` pattern makes failures explicit in the type system; discriminated unions ensure exhaustive case handling; `exactOptionalPropertyTypes` prevents accidental `undefined` |
| **Performance** | Named exports enable tree-shaking; `verbatimModuleSyntax` avoids transpiler-injected helpers; `as const` compiles away at runtime; generic constraints reduce overloads |
| **Cost** | Biome runs 100x faster than ESLint+Prettier — saves CI minutes; strict types catch bugs at compile time instead of production monitoring |
| **Operational Excellence** | Consistent barrel exports enforce module boundaries; `satisfies` validates config objects without losing literal inference; `expectTypeOf` catches contract regressions in CI |
