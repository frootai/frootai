---
name: fai-review-and-refactor
description: |
  Combine code review with targeted refactoring in a single pass — identify
  issues and fix them with behavior-preserving changes. Use when reviewing
  code that needs both quality feedback and structural improvement.
---

# Review and Refactor

Review code and apply targeted refactoring in a single disciplined pass.

## When to Use

- Reviewing PR code that has structural issues
- Combining quality feedback with concrete fixes
- Mentoring through review with example refactoring
- Cleaning up code during review before merge

---

## Review Dimensions

| Dimension | What to Check |
|-----------|--------------|
| Correctness | Does it do what's intended? Edge cases handled? |
| Security | Injection, secrets, auth bypasses? |
| Performance | N+1 queries, missing indexes, unbounded loops? |
| Readability | Clear names, reasonable length, low complexity? |
| Testability | Can each function be tested in isolation? |
| Error handling | All external calls have try/catch? |

## Review-then-Refactor Workflow

```
1. Review: Read through, note issues (don't fix yet)
2. Classify: Group issues by type (bug, readability, performance)
3. Prioritize: Fix bugs first, then readability, then style
4. Refactor: One fix per commit with tests passing
5. Comment: Leave review with both issues found and fixes applied
```

## Common Review → Refactor Pairs

| Review Finding | Refactoring |
|---------------|-------------|
| Long method (>50 lines) | Extract method |
| Deeply nested conditionals | Guard clauses (early return) |
| Duplicate code blocks | Extract shared function |
| Magic numbers | Named constants |
| God class | Split by responsibility |
| No error handling | Add try/catch with specific types |

## Review Comment Template

```markdown
**Issue:** [Category] — [Description]
**Severity:** 🔴 Bug | 🟡 Improvement | 🟢 Suggestion
**Suggestion:** [Concrete fix or code example]
**Why:** [Impact if not fixed]
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Review too long | Trying to fix everything | Focus on top 3-5 issues per review |
| Refactoring introduces bugs | Changed behavior during refactor | Tests before AND after each change |
| Author defensive | Suggestions feel like criticism | Frame as questions: "Have you considered...?" |
| Review comments ignored | Too many minor nits | Separate blocking from non-blocking comments |

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
- `fai-github-pr-review` — PR review standards and merge policies

## Definition of Done

Review-and-refactor is complete when all blocking issues are fixed, tests pass before and after each change, and complexity metrics show measurable improvement.
