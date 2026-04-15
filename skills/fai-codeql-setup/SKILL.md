---
name: fai-codeql-setup
description: |
  Configure CodeQL analysis with language detection, custom queries, security
  gate enforcement, and GitHub Advanced Security integration. Use when setting
  up SAST scanning for code repositories.
---

# CodeQL Setup

Configure static analysis with CodeQL for security scanning in CI/CD.

## When to Use

- Setting up SAST scanning for a repository
- Enforcing security gates before merge
- Writing custom CodeQL queries for domain-specific rules
- Integrating with GitHub Advanced Security

---

## GitHub Actions Workflow

```yaml
name: CodeQL Analysis
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
  schedule: [{ cron: "0 6 * * 1" }]

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions: { security-events: write, actions: read, contents: read }
    strategy:
      matrix:
        language: [python, javascript]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: security-and-quality
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

## Custom Query Example

```ql
/**
 * @name Hardcoded API key
 * @description Detects hardcoded API keys in source code
 * @kind problem
 * @problem.severity error
 * @security-severity 9.0
 */
import python

from StrConst s
where s.getText().regexpMatch("(?i)(api[_-]?key|secret|password)\\s*=\\s*['\"][^'\"]{10,}")
select s, "Potential hardcoded secret detected"
```

## Security Gate

```yaml
# Branch protection rule configuration
# Settings > Branches > Branch protection rules
# - Require status checks: CodeQL Analysis
# - Require CodeQL to pass before merge
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No results | Wrong language matrix | Check detected languages match repo |
| False positives | Default queries too broad | Use security-only query suite |
| Slow analysis | Large monorepo | Limit paths with paths/paths-ignore |
| Custom query errors | QL syntax issue | Test with `codeql query run` locally |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Start simple, add complexity when needed | Avoid over-engineering |
| Automate repetitive tasks | Consistency and speed |
| Document decisions and tradeoffs | Future reference for the team |
| Validate with real data | Don't rely on synthetic tests alone |
| Review with peers | Fresh eyes catch blind spots |
| Iterate based on feedback | First version is never perfect |

## Quality Checklist

- [ ] Requirements clearly defined
- [ ] Implementation follows project conventions
- [ ] Tests cover happy path and error paths
- [ ] Documentation updated
- [ ] Peer reviewed
- [ ] Validated in staging environment

## Related Skills

- `fai-implementation-plan-generator` — Planning and milestones
- `fai-review-and-refactor` — Code review patterns
- `fai-quality-playbook` — Engineering quality standards
