---
name: fai-refactor-skill
description: |
  Apply systematic code refactoring patterns with behavior preservation,
  test-driven validation, and complexity reduction. Use when improving
  code structure without changing external behavior.
---

# Code Refactoring Patterns

Apply safe refactoring with behavior preservation and test validation.

## When to Use

- Improving code readability and maintainability
- Reducing duplication
- Preparing code for new features
- Addressing code review feedback

---

## Core Refactoring Patterns

### Extract Method
```python
# Before
def process(data):
    # validate
    if not data: raise ValueError()
    if len(data) > 1000: raise ValueError("too large")
    # transform
    result = [item.strip().lower() for item in data]
    # save
    db.save(result)

# After
def process(data):
    validate(data)
    result = transform(data)
    save(result)
```

### Replace Temp with Query
```python
# Before
base = order.quantity * order.price
discount = base * 0.1 if order.is_bulk else 0
total = base - discount

# After
def base_price(order): return order.quantity * order.price
def discount(order): return base_price(order) * 0.1 if order.is_bulk else 0
def total(order): return base_price(order) - discount(order)
```

### Introduce Parameter Object
```python
# Before
def search(query, limit, offset, sort_by, sort_dir, filters):
    pass

# After
@dataclass
class SearchParams:
    query: str
    limit: int = 10
    offset: int = 0
    sort_by: str = "relevance"
    sort_dir: str = "desc"
    filters: dict = field(default_factory=dict)

def search(params: SearchParams):
    pass
```

## Refactoring Safety Rules

| Rule | Why |
|------|-----|
| Tests pass before AND after | Proves no behavior change |
| One refactoring per commit | Easy to bisect and revert |
| No feature changes mixed in | Separate refactor from feature PRs |
| Measure complexity before/after | Prove improvement |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tests break | Changed behavior | Undo, refactor without changing logic |
| Too many changes at once | Not incremental | One pattern per commit |
| Can't test private methods | Testing implementation | Test public behavior instead |
| Performance regression | Added indirection | Profile before and after |

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
