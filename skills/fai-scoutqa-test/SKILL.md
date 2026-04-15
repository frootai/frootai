---
name: fai-scoutqa-test
description: |
  Run ScoutQA automated test generation and execution for web applications
  with AI-driven test discovery and self-healing selectors. Use when adding
  comprehensive E2E test coverage with minimal manual test writing.
---

# ScoutQA Test Automation

AI-driven test generation with self-healing selectors and coverage discovery.

## When to Use

- Adding E2E test coverage to existing web apps
- Generating tests from user flows without manual scripting
- Maintaining tests with self-healing selectors
- Running exploratory testing with AI guidance

---

## Test Generation

```python
from scoutqa import Scout

scout = Scout(base_url="http://localhost:3000")

# AI explores the app and generates test scenarios
scenarios = scout.discover_flows(
    starting_pages=["/", "/chat", "/dashboard"],
    max_depth=3,
    interaction_types=["click", "fill", "navigate"],
)

# Generate test code from discovered flows
for scenario in scenarios:
    test_code = scout.generate_test(scenario, framework="playwright")
    print(f"# {scenario.name}")
    print(test_code)
```

## Self-Healing Selectors

```python
# Instead of brittle CSS selectors:
# page.click("#submit-btn-v3")  # Breaks on redesign

# ScoutQA uses multiple selector strategies:
scout.click(
    element="submit button",
    selectors=[
        {"strategy": "test-id", "value": "submit-btn"},
        {"strategy": "role", "value": "button", "name": "Submit"},
        {"strategy": "text", "value": "Submit"},
        {"strategy": "css", "value": "form button[type=submit]"},
    ],
    # Falls back through strategies if primary fails
)
```

## Test Execution

```bash
# Run discovered tests
scoutqa run --base-url http://localhost:3000 --output results/

# Run with visual report
scoutqa run --report html --screenshots on-failure
```

## CI Integration

```yaml
- name: Run ScoutQA
  run: |
    scoutqa run --base-url ${{ env.APP_URL }} \
      --output test-results/ \
      --report junit
- name: Upload Results
  uses: actions/upload-artifact@v4
  with: { name: test-results, path: test-results/ }
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Low discovery coverage | shallow max_depth | Increase max_depth to 4-5 |
| False positive failures | UI changed, selectors stale | Enable self-healing mode |
| Slow test runs | Too many scenarios | Filter by priority or page |
| Auth flows not discovered | Login not configured | Provide auth cookies or setup script |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Test naming: `test_{action}_{scenario}_{expected}` | Clear intent from name alone |
| One assertion per test (ideally) | Pinpoints exact failure |
| Arrange-Act-Assert structure | Consistent, readable tests |
| Mock external dependencies | Fast, deterministic execution |
| Run tests in CI on every PR | Catch regressions before merge |
| Separate unit from integration | Fast feedback loop for unit tests |

## Related Skills

- `fai-build-test-harness` — Reusable test infrastructure
- `fai-build-unit-test` — Unit test patterns across languages
- `fai-build-integration-test` — Integration test with fixtures
- `fai-pytest-coverage` — Python coverage configuration
