---
name: fai-refactor-plan
description: |
  Create refactoring plans with scope assessment, risk ranking, incremental
  execution, and regression protection. Use when planning systematic code
  improvements over multiple sprints.
---

# Refactoring Plan

Plan safe, incremental refactoring with risk assessment and regression guards.

## When to Use

- Planning a multi-sprint refactoring effort
- Prioritizing tech debt items by impact and risk
- Creating a refactoring roadmap for stakeholders
- Ensuring refactoring doesn't introduce regressions

---

## Plan Template

```markdown
# Refactoring Plan — [Area/Module]

## Goal
[What quality improvement are we targeting?]

## Scope
| Item | Current State | Target State | Risk | Priority |
|------|--------------|-------------|------|----------|
| OrderService | 450 lines, CC=15 | <100 lines, CC<5 | Medium | P1 |
| PaymentHandler | No tests | 80% coverage | High | P1 |
| UserController | Mixed concerns | Clean separation | Low | P2 |

## Execution Order
1. Add tests to PaymentHandler (safety net first)
2. Extract methods from OrderService
3. Separate concerns in UserController

## Constraints
- No behavior changes — only structural improvement
- Each PR < 200 lines changed
- All existing tests must pass after each step
- Run integration tests before merge

## Timeline
| Sprint | Items | Validation |
|--------|-------|-----------|
| S1 | Add test coverage for payment | Coverage >= 80% |
| S2 | Extract OrderService methods | CC < 5 per method |
| S3 | Separate UserController | No mixed concerns |
```

## Risk Assessment

| Risk Level | Definition | Mitigation |
|-----------|-----------|-----------|
| High | Changes core business logic paths | Add tests FIRST, then refactor |
| Medium | Changes shared utilities | Review blast radius, test consumers |
| Low | Cosmetic or naming changes | Standard PR review |

## Incremental Approach

```
1. Add tests for current behavior (safety net)
2. Refactor one function/class at a time
3. Run all tests after each change
4. Commit each step separately (easy revert)
5. Repeat until target state reached
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Regression after refactor | No test safety net | Always add tests BEFORE refactoring |
| Scope creep | "While I'm here..." | Stick to plan, log new items separately |
| PR too large | Refactoring in one commit | One extraction per commit |
| Stakeholder pushback | No clear value | Show complexity metrics before/after |

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
