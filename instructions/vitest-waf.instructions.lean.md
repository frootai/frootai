---
description: "Vitest testing standards — ES2022, snapshot testing, coverage, and mock patterns for Node.js/TypeScript."
applyTo: "**/*.test.ts, **/*.spec.ts"
waf:
  - "reliability"
---

# Vitest — FAI Standards

## Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,                    // describe/it/expect without imports
    environment: 'node',              // 'jsdom' | 'happy-dom' for DOM tests
    include: ['src/**/*.{test,spec}.ts'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',                // 'v8' (fast, c8-based) or 'istanbul' (precise)
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: { lines: 80, branches: 75, functions: 80, statements: 80 },
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
    },
    typecheck: { enabled: true, tsconfig: './tsconfig.json' },
  },
});
```

Workspace mode for monorepos — `vitest.workspace.ts`:
```typescript
import { defineWorkspace } from 'vitest/config';
export default defineWorkspace([
  'packages/*/vitest.config.ts',
  { test: { name: 'shared', root: './shared', environment: 'node' } },
]);
```

## Test Structure

```typescript
describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => { service = new EmbeddingService({ model: 'text-embedding-3-small' }); });

  it('generates embeddings with correct dimensions', async () => {
    const result = await service.embed('hello world');
    expect(result).toHaveLength(1536);
    expect(result.every((v) => typeof v === 'number')).toBe(true);
  });

  it.concurrent('handles batch requests in parallel', async () => {
    const texts = Array.from({ length: 10 }, (_, i) => `text-${i}`);
    const results = await service.embedBatch(texts);
    expect(results).toHaveLength(10);
  });

  it.each([
    { input: '', error: 'empty input' },
    { input: 'x'.repeat(8192), error: 'exceeds token limit' },
  ])('rejects $error', async ({ input, error }) => {
    await expect(service.embed(input)).rejects.toThrow(error);
  });

  it.skip('pending: streaming embeddings', () => { /* tracked in #142 */ });
});
```

## Mocking

```typescript
// vi.mock — module-level mock (hoisted automatically)
vi.mock('./openai-client', () => ({
  createCompletion: vi.fn().mockResolvedValue({ text: 'mocked' }),
}));

// vi.fn — standalone mock function
const onChunk = vi.fn<[chunk: string], void>();
await streamResponse('prompt', onChunk);
expect(onChunk).toHaveBeenCalledTimes(3);
expect(onChunk.mock.calls[0][0]).toContain('Hello');

// vi.spyOn — spy on existing object methods
const spy = vi.spyOn(logger, 'warn');
service.processUnsafe('<script>');
expect(spy).toHaveBeenCalledWith(expect.stringContaining('sanitized'));
spy.mockRestore();

// Mock timers
vi.useFakeTimers();
const promise = retryWithBackoff(failingFn, { maxRetries: 3, baseDelay: 1000 });
await vi.advanceTimersByTimeAsync(7000);
await expect(promise).rejects.toThrow();
vi.useRealTimers();
```

## Snapshot Testing

```typescript
it('serializes config to expected shape', () => {
  expect(generateManifest('play-01')).toMatchSnapshot();  // .snap file
});

it('renders error message', () => {
  const msg = formatError(new ValidationError('bad input'));
  expect(msg).toMatchInlineSnapshot(`"[ValidationError] bad input"`);
});
```

Update snapshots: `vitest --update` or press `u` in watch mode.

## In-Source Testing

```typescript
// src/utils/hash.ts — tests colocated with source
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;
  it('hashes deterministically', () => {
    expect(sha256('test')).toBe(sha256('test'));
    expect(sha256('a')).not.toBe(sha256('b'));
  });
}
```

Enable: `defineInlineTest: true` in vitest config, strip with `define: { 'import.meta.vitest': 'undefined' }` in production build.

## Browser Mode

```typescript
// vitest.config.ts for browser tests
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    browser: { enabled: true, provider: 'playwright', name: 'chromium' },
    include: ['src/**/*.browser.test.ts'],
  },
});
```

## Type Testing

```typescript
import { expectTypeOf } from 'vitest';

it('infers return type from config', () => {
  expectTypeOf(createClient({ streaming: true })).toEqualTypeOf<StreamingClient>();
  expectTypeOf<Config>().toHaveProperty('retries').toBeNumber();
  expectTypeOf(parseResponse).parameter(0).toMatchTypeOf<RawResponse>();
});
```

## Custom Matchers

```typescript
// tests/setup.ts
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return { pass, message: () => `expected ${received} to be within [${floor}, ${ceiling}]` };
  },
});

// usage
expect(latencyMs).toBeWithinRange(0, 500);
```

Augment types in `tests/vitest.d.ts`:
```typescript
interface CustomMatchers<R = unknown> { toBeWithinRange(floor: number, ceiling: number): R; }
declare module 'vitest' { interface Assertion extends CustomMatchers {} }
```

## Fixture Files

```typescript
import { readFile } from 'fs/promises';
import { resolve } from 'path';

const fixture = (name: string) => readFile(resolve(__dirname, `fixtures/${name}`), 'utf-8');

it('parses invoice PDF extract', async () => {
  const raw = await fixture('invoice-001.json');
  expect(parseInvoice(JSON.parse(raw))).toMatchObject({ total: 1250.00 });
});
```

## Test Filtering & UI

- `vitest --grep "EmbeddingService"` — run tests matching pattern
- `vitest --ui` — browser UI at `localhost:51204` with module graph and coverage
- `.only` / `.skip` — focus or skip at `describe` or `it` level (CI must reject `.only`)
- `vitest related src/service.ts` — run only tests that import the changed file

## Anti-Patterns

- ❌ `vi.mock` inside `it` blocks — hoisting breaks; use `vi.fn` or factory in `beforeEach`
- ❌ Shared mutable state across tests without `beforeEach` reset — causes order-dependent flakes
- ❌ `toMatchSnapshot` on large dynamic objects (timestamps, IDs) — snapshot churn; use `toMatchObject`
- ❌ Missing `mockRestore()` on spies — leaks into subsequent tests
- ❌ `any` in test types — defeats `typecheck.enabled`; define fixtures with proper interfaces
- ❌ Committing `.only` — use a CI lint rule (`no-only-tests`) to block
- ❌ No coverage thresholds — coverage silently drops; enforce in `vitest.config.ts`
- ❌ Testing implementation details (private methods, internal state) — test behavior via public API
- ❌ `setTimeout` in tests instead of `vi.useFakeTimers` — real timers cause slow, flaky suites

## WAF Alignment

| Pillar | Practice |
|--------|----------|
| **Reliability** | Coverage thresholds enforced in CI; `testTimeout` prevents hanging; `retry: 2` for known-flaky integration tests during stabilization |
| **Security** | Never hardcode secrets in test fixtures; use `vi.stubEnv` for env-dependent code; sanitize snapshot files for PII before commit |
| **Cost Optimization** | `v8` coverage provider is 3-5× faster than `istanbul`; `vitest related` in CI runs only affected tests on PRs |
| **Operational Excellence** | `--reporter=json` feeds CI dashboards; `--coverage` in merge pipelines with threshold gates; `vitest.workspace.ts` scales to monorepo |
| **Performance Efficiency** | `it.concurrent` parallelizes independent tests; `pool: 'threads'` (default) for CPU-bound, `pool: 'forks'` for isolation; `--shard=1/4` for CI matrix |
