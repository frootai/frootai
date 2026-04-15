---
name: fai-pytest-coverage
description: |
  Configure pytest with coverage reporting, threshold enforcement, and CI
  integration. Use when setting up Python test infrastructure with coverage
  gates and reporting.
---

# Pytest Coverage Configuration

Set up pytest with coverage reporting, thresholds, and CI gates.

## When to Use

- Setting up test coverage for Python projects
- Enforcing minimum coverage thresholds in CI
- Generating HTML and XML coverage reports
- Identifying untested code paths

---

## Setup

```bash
pip install pytest pytest-cov pytest-asyncio
```

## pyproject.toml Configuration

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
addopts = "--cov=src --cov-report=term-missing --cov-report=xml --cov-fail-under=80"

[tool.coverage.run]
source = ["src"]
omit = ["src/__main__.py", "src/**/test_*.py"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "if __name__ == .__main__.",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
]
show_missing = true
```

## Running Tests

```bash
# Basic with coverage
pytest --cov=src --cov-report=term-missing

# With HTML report
pytest --cov=src --cov-report=html
open htmlcov/index.html

# Fail if under threshold
pytest --cov=src --cov-fail-under=80
```

## CI Integration

```yaml
- name: Run tests with coverage
  run: pytest --cov=src --cov-report=xml --cov-fail-under=80
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with: { files: coverage.xml }
```

## Coverage by Module

```bash
# See per-file breakdown
pytest --cov=src --cov-report=term-missing | grep -E "^src/"
```

## Testing Patterns

```python
import pytest

@pytest.fixture
def sample_docs():
    return [{"id": "1", "content": "Test document"}]

@pytest.mark.asyncio
async def test_search_returns_results(sample_docs):
    results = await search(sample_docs, "test")
    assert len(results) >= 1
    assert results[0]["id"] == "1"

@pytest.mark.parametrize("input,expected", [
    ("hello", "hello"),
    ("HELLO", "hello"),
    ("", ""),
])
def test_normalize(input, expected):
    assert normalize(input) == expected
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Coverage below threshold | Untested error paths | Add tests for exceptions and edge cases |
| Wrong source measured | source config missing | Set [tool.coverage.run] source |
| Async tests not found | Missing asyncio_mode | Add asyncio_mode = "auto" to config |
| HTML report empty | Wrong report path | Check --cov-report=html output dir |
