---
name: fai-code-smell-detector
description: |
  Detect and prioritize code smells with severity scoring, refactor suggestions,
  and risk-aware cleanup ordering. Use when improving code quality, reducing
  tech debt, or preparing for a refactoring sprint.
---

# Code Smell Detection

Identify, prioritize, and address code quality issues systematically.

## When to Use

- Planning a refactoring sprint
- Reviewing codebase health before a major feature
- Onboarding onto an unfamiliar codebase
- Setting up automated quality gates in CI

---

## Common Smells and Fixes

| Smell | Detection Signal | Refactor |
|-------|-----------------|----------|
| Long method | >50 lines | Extract method |
| God class | >500 lines, >10 methods | Split by responsibility |
| Feature envy | Method uses another class more than its own | Move method |
| Primitive obsession | Many raw strings/ints as params | Introduce value objects |
| Deep nesting | >3 levels of if/for | Early returns, extract |
| Duplicate code | >10 lines repeated | Extract shared function |
| Dead code | Unreachable or unused | Delete it |

## Automated Detection

```python
import ast, os

def detect_long_methods(file_path: str, threshold: int = 50) -> list[dict]:
    """Find functions longer than threshold lines."""
    with open(file_path) as f:
        tree = ast.parse(f.read())
    smells = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            length = node.end_lineno - node.lineno + 1
            if length > threshold:
                smells.append({"file": file_path, "function": node.name,
                    "lines": length, "severity": "high" if length > 100 else "medium"})
    return smells
```

## Prioritization Matrix

| Severity | Impact | Fix Effort | Priority |
|----------|--------|------------|----------|
| High | Bugs likely | Low | Fix now |
| High | Bugs likely | High | Plan sprint |
| Medium | Readability | Low | Fix opportunistically |
| Low | Style | Any | Optional |

## CI Integration

```bash
# Run ruff for Python code smells
ruff check . --select C901,E501,W291 --statistics

# Run SonarQube for multi-language
sonar-scanner -Dsonar.projectKey=myapp
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Too many findings | No severity filter | Focus on High first |
| False positives | Generic rules | Customize rules per project |
| Team ignores findings | No priority | Use prioritization matrix |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Tests before refactoring | Safety net for behavior preservation |
| One refactoring per commit | Easy to revert specific changes |
| No feature changes mixed in | Separate refactor from feature PRs |
| Measure complexity before/after | Prove improvement objectively |
| Small PRs (< 200 lines changed) | Easier to review thoroughly |
| CI must pass after each step | Catch breakage immediately |

## Refactoring Safety Checklist

- [ ] All existing tests pass before starting
- [ ] Each refactoring step committed separately
- [ ] No behavior changes (same inputs → same outputs)
- [ ] All tests still pass after each step
- [ ] Complexity metrics improved
- [ ] PR is under 200 lines of changes

## Related Skills

- `fai-refactor-complexity` — Reduce cyclomatic complexity
- `fai-refactor-plan` — Multi-sprint refactoring plans
- `fai-code-smell-detector` — Automated smell detection
- `fai-review-and-refactor` — Combined review + fix workflow
