---
name: fai-build-test-harness
description: |
  Build reusable test harnesses for API, UI, and AI evaluation with fixtures,
  mocks, reporting, and CI integration. Use when standardizing test infrastructure
  across projects or building evaluation pipelines.
---

# Test Harness Patterns

Build reusable test infrastructure with fixtures, mocks, and reporting.

## When to Use

- Standardizing test setup across multiple services
- Building AI evaluation harnesses with dataset loading
- Creating reusable fixtures for database, API, and queue tests
- Setting up test reporting for CI dashboards

---

## Python Test Harness

```python
import pytest, json, time
from dataclasses import dataclass, field

@dataclass
class TestResult:
    name: str
    passed: bool
    duration_ms: float
    error: str = ""

class TestHarness:
    def __init__(self):
        self.results: list[TestResult] = []

    def run_test(self, name: str, fn):
        start = time.monotonic()
        try:
            fn()
            self.results.append(TestResult(name, True, (time.monotonic()-start)*1000))
        except Exception as e:
            self.results.append(TestResult(name, False, (time.monotonic()-start)*1000, str(e)))

    def report(self) -> dict:
        passed = sum(1 for r in self.results if r.passed)
        return {"total": len(self.results), "passed": passed,
                "failed": len(self.results) - passed,
                "pass_rate": passed / len(self.results) if self.results else 0}
```

## AI Evaluation Harness

```python
class EvalHarness:
    def __init__(self, dataset_path: str):
        with open(dataset_path) as f:
            self.dataset = [json.loads(l) for l in f]

    def run(self, predict_fn, score_fn) -> dict:
        scores = []
        for row in self.dataset:
            prediction = predict_fn(row["input"])
            score = score_fn(prediction, row["expected"])
            scores.append(score)
        return {"mean_score": sum(scores)/len(scores), "n": len(scores),
                "min": min(scores), "max": max(scores)}
```

## Reusable Fixtures

```python
@pytest.fixture(scope="session")
def api_client():
    """Shared HTTP client for all tests in session."""
    from httpx import Client
    with Client(base_url="http://localhost:8000") as c:
        yield c

@pytest.fixture
def sample_documents():
    return [
        {"id": "1", "content": "Circuit breaker pattern prevents cascading failures."},
        {"id": "2", "content": "Retry with exponential backoff handles transient errors."},
    ]
```

## CI Reporting

```bash
pytest --junitxml=results.xml --cov=src --cov-report=xml -v
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Flaky tests | Shared mutable state | Use fresh fixtures per test |
| Slow harness | Loading full dataset | Sample dataset for fast feedback |
| Missing coverage | Tests not discovered | Check pytest collection rules |
| CI reports missing | Wrong output path | Verify junitxml path in CI config |
