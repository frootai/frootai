---
name: fai-dead-code-removal
description: |
  Detect and safely remove dead code with dependency analysis, coverage data,
  and regression protection. Use when cleaning up unused functions, imports,
  feature flags, or deprecated modules.
---

# Dead Code Removal

Detect and safely remove unused code with dependency checks and regression guards.

## When to Use

- Cleaning up after a major refactoring
- Removing deprecated features or feature flags
- Reducing bundle size or compile times
- Improving codebase readability

---

## Detection Methods

### Python: vulture

```bash
# Find unused code
pip install vulture
vulture src/ --min-confidence 80

# Output:
# src/utils.py:42: unused function 'old_parser' (90% confidence)
# src/models.py:15: unused import 'deprecated_lib' (100% confidence)
```

### TypeScript: ts-prune

```bash
npx ts-prune | grep -v '(used in module)'
```

### .NET: dotnet-unused

```bash
dotnet tool install -g dotnet-unused
dotnet-unused --solution MyApp.sln
```

## Coverage-Based Detection

```python
def find_uncovered_functions(coverage_json: str) -> list[str]:
    """Find functions with 0% coverage — likely dead code."""
    import json
    data = json.loads(open(coverage_json).read())
    dead = []
    for file_path, file_data in data.items():
        for func_name, hit_count in file_data.get("functions", {}).items():
            if hit_count == 0:
                dead.append(f"{file_path}:{func_name}")
    return dead
```

## Safe Removal Process

1. **Identify** — Run detection tools, collect candidates
2. **Verify** — Cross-reference with tests, imports, and dynamic calls
3. **Remove** — Delete code in small, reviewable PRs
4. **Test** — Run full test suite + integration tests
5. **Monitor** — Watch for runtime errors in staging for 48 hours

## Feature Flag Cleanup

```python
# Find stale feature flags (enabled everywhere for 30+ days)
def find_stale_flags(config_path: str, threshold_days: int = 30) -> list[str]:
    flags = json.loads(open(config_path).read())
    stale = []
    for name, info in flags.items():
        if info.get("enabled_since"):
            age = (datetime.now() - datetime.fromisoformat(info["enabled_since"])).days
            if age > threshold_days and info.get("percentage") == 100:
                stale.append(name)
    return stale
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| False positive | Dynamic import or reflection | Mark as used in whitelist |
| Runtime error after removal | Code used via string reference | Search for string-based usage |
| Feature flag can't be removed | Still referenced in config | Remove flag + all branches |

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
