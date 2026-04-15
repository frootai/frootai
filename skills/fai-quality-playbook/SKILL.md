---
name: fai-quality-playbook
description: |
  Define engineering quality playbooks with code review standards, testing
  requirements, release criteria, and incident response. Use when establishing
  quality gates and engineering practices for a team.
---

# Engineering Quality Playbook

Define quality standards, testing requirements, and release criteria.

## When to Use

- Establishing engineering quality practices for a new team
- Defining code review and testing standards
- Creating release checklists and quality gates
- Setting up incident response procedures

---

## Code Quality Standards

| Dimension | Standard | Enforcement |
|-----------|---------|-------------|
| Lint | Zero warnings | CI gate (ruff/eslint) |
| Test coverage | >= 80% lines | pytest --cov-fail-under=80 |
| Type checking | No errors | mypy --strict / tsc --strict |
| Security scan | No high/critical | CodeQL / Trivy in CI |
| Dependency audit | No known CVEs | npm audit / pip-audit |

## Code Review Checklist

```markdown
## Review Checklist
- [ ] Logic: Does the code do what's intended?
- [ ] Tests: Are happy + error paths covered?
- [ ] Security: No secrets, injection points, or PII exposure?
- [ ] Performance: No N+1, unbounded queries, or missing indexes?
- [ ] Naming: Clear, descriptive names for functions and variables?
- [ ] Error handling: All external calls have try/catch?
- [ ] Documentation: Public APIs documented?
```

## Release Criteria

```markdown
## Release Readiness Checklist
- [ ] All CI checks pass (lint, test, security, build)
- [ ] Coverage >= 80% with no decrease from main
- [ ] No P1/P2 bugs open
- [ ] Changelog updated
- [ ] Smoke tests pass in staging
- [ ] Rollback plan documented
- [ ] Monitoring dashboards reviewed
```

## Incident Response

```markdown
## Incident Severity Levels

| Severity | Definition | Response Time | Example |
|----------|-----------|--------------|---------|
| P1 | Service down, all users affected | 15 min | API returns 500 for all |
| P2 | Major feature degraded | 1 hour | Search returns wrong results |
| P3 | Minor feature issue | 4 hours | Dashboard chart incorrect |
| P4 | Cosmetic or low-impact | Next sprint | Typo in UI |

## Incident Process
1. Detect: Alert fires or user report
2. Acknowledge: On-call responds within SLA
3. Mitigate: Apply quick fix or rollback
4. Communicate: Update status page and stakeholders
5. Resolve: Root cause fix deployed
6. Review: Post-incident review within 48 hours
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Quality standards ignored | No enforcement | Make all checks CI-blocking |
| Review turnaround slow | No SLA | Set 24h review target |
| Incidents repeat | No post-mortem | Require post-incident review |
| Coverage declining | No ratchet | Fail CI if coverage < main branch |

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
