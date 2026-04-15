---
name: fai-git-commit-best-practices
description: |
  Enforce commit hygiene with conventional commits, atomic changes, clear
  messages, and CI-enforceable standards. Use when improving commit quality
  or setting up commitlint.
---

# Git Commit Best Practices

Write clear, atomic commits with conventional format and CI enforcement.

## When to Use

- Setting up commit conventions for a team
- Configuring commitlint in CI
- Improving changelog generation quality
- Training developers on commit hygiene

---

## Conventional Commit Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Use When |
|------|----------|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation only |
| refactor | Code change that doesn't fix or add |
| perf | Performance improvement |
| test | Adding or fixing tests |
| chore | Build, CI, tooling changes |
| ci | CI/CD pipeline changes |

### Examples

```bash
# Good
git commit -m "feat(search): add hybrid vector+keyword retrieval"
git commit -m "fix(auth): handle expired MI tokens with retry"
git commit -m "docs: add ADR for embedding model selection"
git commit -m "perf(api): reduce P95 latency from 3s to 800ms"

# Bad
git commit -m "fixed stuff"
git commit -m "wip"
git commit -m "changes"
```

## Commitlint Setup

```bash
npm install --save-dev @commitlint/{config-conventional,cli}
```

```js
// commitlint.config.js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

```bash
# Git hook (via Husky)
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit ${1}'
```

## CI Enforcement

```yaml
- name: Lint commits
  run: |
    npx commitlint --from ${{ github.event.pull_request.base.sha }} \
                    --to ${{ github.event.pull_request.head.sha }}
```

## Atomic Commit Rules

| Rule | Why |
|------|-----|
| One logical change per commit | Easy to revert, review, cherry-pick |
| Tests in same commit as code | Don't break bisect |
| Config separate from code | Clear intent |
| Never commit secrets | Use .gitignore + pre-commit hooks |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Commitlint fails | Non-conventional format | Use `type(scope): description` format |
| Too many small commits | Over-splitting | Squash related changes on merge |
| Large messy commits | Working in one commit | Use `git add -p` for staged chunks |
| Secrets committed | No pre-commit hook | Add gitleaks or trufflehog pre-commit |
