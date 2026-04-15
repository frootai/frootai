---
name: fai-polyglot-test
description: |
  Generate tests across multiple languages with consistent patterns, shared
  test data, and cross-language assertion conventions. Use when maintaining
  SDKs or libraries in multiple programming languages.
---

# Polyglot Test Generation

Write tests consistently across Python, TypeScript, C#, Java, and Go.

## When to Use

- Maintaining SDKs in multiple languages
- Ensuring consistent behavior across language implementations
- Generating equivalent test suites from shared test data
- Cross-language code review with consistent patterns

---

## Shared Test Data (JSONL)

```jsonl
{"input": "Hello", "expected_status": 200, "expected_contains": "Hello"}
{"input": "", "expected_status": 400, "expected_error": "empty input"}
{"input": "What is RAG?", "expected_status": 200, "expected_contains": "retrieval"}
```

## Python (pytest)

```python
import pytest, json

with open("test-data.jsonl") as f:
    TEST_CASES = [json.loads(l) for l in f]

@pytest.mark.parametrize("case", TEST_CASES, ids=[c["input"][:20] for c in TEST_CASES])
def test_chat_api(case, client):
    resp = client.post("/chat", json={"message": case["input"]})
    assert resp.status_code == case["expected_status"]
    if "expected_contains" in case:
        assert case["expected_contains"].lower() in resp.json()["reply"].lower()
```

## TypeScript (Jest)

```typescript
import testCases from './test-data.json';

describe.each(testCases)('chat API - %s', (tc) => {
  it(`returns ${tc.expected_status}`, async () => {
    const resp = await fetch('/chat', {
      method: 'POST', body: JSON.stringify({ message: tc.input }),
    });
    expect(resp.status).toBe(tc.expected_status);
    if (tc.expected_contains) {
      const body = await resp.json();
      expect(body.reply.toLowerCase()).toContain(tc.expected_contains.toLowerCase());
    }
  });
});
```

## C# (xUnit)

```csharp
public class ChatApiTests
{
    public static IEnumerable<object[]> TestCases =>
        File.ReadAllLines("test-data.jsonl")
            .Select(JsonSerializer.Deserialize<TestCase>)
            .Select(tc => new object[] { tc! });

    [Theory, MemberData(nameof(TestCases))]
    public async Task Chat_ReturnsExpected(TestCase tc)
    {
        var resp = await _client.PostAsync("/chat", JsonContent.Create(new { message = tc.Input }));
        Assert.Equal(tc.ExpectedStatus, (int)resp.StatusCode);
    }
}
```

## Cross-Language Convention

| Aspect | Convention |
|--------|-----------|
| Test data | Shared JSONL file |
| Naming | test_{feature}_{scenario} |
| Assertions | Status code + body contains |
| Parametrization | Data-driven from JSONL |
| CI | Matrix strategy per language |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Data format mismatch | Language-specific JSON parsing | Use JSONL with simple types |
| Inconsistent results | Language-specific string handling | Normalize (lowercase) before compare |
| CI matrix slow | Running all languages serially | Use matrix strategy for parallel |
| Test case drift | Edited per-language | Always edit shared JSONL first |
