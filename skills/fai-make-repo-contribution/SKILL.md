---
name: fai-make-repo-contribution
description: |
  Guide repository contributions with fork workflow, PR conventions, review
  readiness, and CI compliance. Use when contributing to open-source projects
  or onboarding new contributors.
---

# Repository Contribution Guide

Follow best practices for forking, branching, committing, and PR submission.

## When to Use

- Contributing to an open-source project
- Onboarding as a new contributor
- Creating CONTRIBUTING.md for your project
- Ensuring PR meets review standards

---

## Contribution Workflow

```bash
# 1. Fork and clone
gh repo fork org/repo --clone

# 2. Create feature branch
git checkout -b feat/add-hybrid-search

# 3. Make changes with conventional commits
git add .
git commit -m "feat(search): add hybrid vector+keyword retrieval"

# 4. Push and create PR
git push origin feat/add-hybrid-search
gh pr create --title "feat(search): add hybrid search" \
  --body "Implements hybrid retrieval combining BM25 and vector search."

# 5. Address review feedback
git commit -m "fix: address review comments"
git push origin feat/add-hybrid-search
```

## PR Readiness Checklist

```markdown
## PR Checklist
- [ ] Branch is up to date with main
- [ ] Code follows project conventions
- [ ] Tests added for new functionality
- [ ] All existing tests pass
- [ ] Documentation updated (if applicable)
- [ ] No secrets or PII in code
- [ ] Commit messages follow conventional format
- [ ] PR description explains what and why
```

## CONTRIBUTING.md Template

```markdown
# Contributing to [Project]

## Getting Started
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOU/repo`
3. Install dependencies: `npm install` / `pip install -r requirements.txt`
4. Create a branch: `git checkout -b feat/your-feature`

## Coding Standards
- Follow existing code style
- Use conventional commits: `feat:`, `fix:`, `docs:`
- Keep PRs focused — one feature/fix per PR

## Pull Request Process
1. Update documentation for any changed behavior
2. Add tests for new functionality
3. Ensure CI passes (lint + test + build)
4. Request review from maintainers
5. Address feedback within 48 hours

## Good First Issues
Look for issues labeled `good-first-issue` for beginner-friendly tasks.
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| PR has merge conflicts | Branch behind main | `git rebase main` or merge main into branch |
| CI fails | Missing dependency or test | Run CI locally before pushing |
| PR too large | Multiple features in one PR | Split into focused PRs |
| No review response | Maintainers busy | Politely ping after 3 business days |

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
