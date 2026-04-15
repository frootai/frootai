---
name: fai-jest-test
description: |
  Write Jest tests with reliable mocking, snapshot testing, async patterns,
  and coverage reporting. Use when testing TypeScript/JavaScript applications
  with Jest framework.
---

# Jest Testing Patterns

Write reliable Jest tests with mocking, snapshots, and async handling.

## When to Use

- Testing TypeScript/JavaScript applications
- Setting up Jest configuration and conventions
- Mocking external dependencies (APIs, databases)
- Configuring coverage thresholds in CI

---

## Basic Test Structure

```typescript
describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    service = new ChatService(mockClient);
  });

  it('should return response for valid prompt', async () => {
    const result = await service.chat('Hello');
    expect(result).toBeDefined();
    expect(result.answer).toContain('Hello');
  });

  it('should throw on empty prompt', async () => {
    await expect(service.chat('')).rejects.toThrow('Prompt required');
  });

  it.each([
    ['simple', 'gpt-4o-mini'],
    ['complex analysis', 'gpt-4o'],
  ])('routes "%s" to %s', async (prompt, expectedModel) => {
    await service.chat(prompt);
    expect(mockClient.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: expectedModel })
    );
  });
});
```

## Mocking

```typescript
// Mock external module
jest.mock('../services/openai', () => ({
  createCompletion: jest.fn().mockResolvedValue({
    choices: [{ message: { content: 'Mocked response' } }],
    usage: { total_tokens: 100 },
  }),
}));

// Mock with implementation
const mockFetch = jest.fn().mockImplementation((url: string) => {
  if (url.includes('/health')) {
    return Promise.resolve({ ok: true, json: () => ({ status: 'healthy' }) });
  }
  return Promise.reject(new Error('Not found'));
});
```

## Async Testing

```typescript
it('handles async errors', async () => {
  mockClient.create.mockRejectedValueOnce(new Error('Rate limited'));
  await expect(service.chat('test')).rejects.toThrow('Rate limited');
});

it('waits for event', async () => {
  const result = await new Promise<string>((resolve) => {
    emitter.on('complete', resolve);
    emitter.emit('complete', 'done');
  });
  expect(result).toBe('done');
});
```

## Coverage Configuration

```json
{
  "jest": {
    "collectCoverageFrom": ["src/**/*.ts", "!src/**/*.d.ts"],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

```bash
jest --coverage --ci
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Flaky async tests | Missing await | Always await async operations |
| Mock not resetting | Shared state between tests | Use beforeEach + jest.clearAllMocks() |
| Snapshot too large | Snapshotting full DOM | Snapshot only relevant subtree |
| Coverage below threshold | Untested error paths | Add error case tests |
