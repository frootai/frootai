---
name: fai-build-unit-test
description: |
  Generate unit tests with deterministic fixtures, boundary coverage, error path
  testing, and stable CI behavior. Use when writing tests for Python, .NET, or
  TypeScript code with pytest, xUnit, or Jest.
---

# Unit Test Patterns

Write reliable unit tests with fixtures, boundary coverage, and CI stability.

## When to Use

- Writing tests for new code or untested modules
- Improving coverage on error paths and edge cases
- Making flaky tests deterministic
- Setting up test conventions for a team

---

## Python (pytest)

```python
import pytest

def test_chunk_text_splits_correctly():
    text = "Hello world. This is a test. Another sentence."
    chunks = chunk_text(text, max_size=20)
    assert len(chunks) >= 2
    assert all(len(c) <= 20 for c in chunks)

def test_chunk_text_empty_input():
    assert chunk_text("", max_size=100) == []

def test_chunk_text_single_word():
    assert chunk_text("Hello", max_size=100) == ["Hello"]

@pytest.mark.parametrize("input,expected", [
    ("hello", "hello"),
    ("HELLO", "hello"),
    ("Hello World", "hello world"),
])
def test_normalize(input, expected):
    assert normalize(input) == expected
```

## .NET (xUnit)

```csharp
public class ChunkerTests
{
    [Fact]
    public void ChunkText_SplitsCorrectly()
    {
        var chunks = Chunker.Chunk("Hello world. Test.", maxSize: 15);
        Assert.True(chunks.Count >= 2);
        Assert.All(chunks, c => Assert.True(c.Length <= 15));
    }

    [Theory]
    [InlineData("", 0)]
    [InlineData("Hello", 1)]
    public void ChunkText_EdgeCases(string input, int expectedCount)
    {
        Assert.Equal(expectedCount, Chunker.Chunk(input, 100).Count);
    }
}
```

## TypeScript (Jest)

```typescript
describe('normalize', () => {
  it.each([
    ['hello', 'hello'],
    ['HELLO', 'hello'],
    ['Hello World', 'hello world'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});
```

## Test Structure (AAA)

```python
def test_example():
    # Arrange
    input_data = {"name": "Test", "value": 42}

    # Act
    result = process(input_data)

    # Assert
    assert result.status == "ok"
    assert result.value == 42
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Flaky test | Time-dependent or external deps | Mock external calls, freeze time |
| Low coverage | Only happy path tested | Add error path + boundary tests |
| Slow tests | Real I/O in unit tests | Mock all I/O, use in-memory stores |
| Test coupled to impl | Testing internal methods | Test public API behavior only |
