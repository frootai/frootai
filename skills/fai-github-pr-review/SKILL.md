---
name: fai-github-pr-review
description: |
  Define pull request review practices with quality gates, review checklists,
  security checks, and merge discipline. Use when standardizing code review
  across teams or configuring branch protection.
---

# Pull Request Review Practices

Standardize code review with quality gates, checklists, and merge policies.

## When to Use

- Setting up PR review conventions for a team
- Configuring branch protection rules
- Creating review checklists for AI code
- Automating PR quality checks in CI

---

## PR Template

```markdown
## Description
<!-- What does this PR do? -->

## Type
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Documentation
- [ ] Infrastructure

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No secrets or PII in code
- [ ] Error handling covers failure paths
- [ ] Backward compatible (or migration documented)

## AI-Specific Checks (if applicable)
- [ ] Prompt changes evaluated against test set
- [ ] Token budget impact assessed
- [ ] Guardrail thresholds validated
- [ ] No hardcoded model versions (use config)
```

## Automated Review Checks

```yaml
name: PR Quality
on: [pull_request]
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ruff check . --output-format=github
      - run: pytest --tb=short
      - name: Check for secrets
        run: |
          pip install detect-secrets
          detect-secrets scan --all-files --exclude-files '\.lock$' \
            | python -c "import sys,json; r=json.load(sys.stdin); sys.exit(1 if r['results'] else 0)"
```

## Review Guidelines

| Category | Check | Severity |
|----------|-------|----------|
| Security | No hardcoded secrets | Blocking |
| Security | Input validation on all endpoints | Blocking |
| Quality | Tests cover happy + error paths | Required |
| Quality | No TODO without issue link | Warning |
| AI | Prompt changes have eval results | Required |
| AI | Model version in config, not code | Required |
| Style | Follows project conventions | Advisory |

## Merge Policies

| Policy | Setting |
|--------|---------|
| Require approvals | 1 reviewer minimum |
| Require CI pass | All status checks green |
| Squash merge | Default (clean history) |
| Delete branch | Auto-delete after merge |
| Conversation resolution | All comments resolved |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| PRs merged without review | No branch protection | Enable required reviews |
| Large PRs (>500 lines) | No size guidance | Set PR size limit, encourage stacking |
| Slow review turnaround | No review SLA | Set 24h review target |
| Review comments ignored | No resolution requirement | Enable conversation resolution |

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
