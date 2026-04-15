---
name: fai-secret-scanning
description: |
  Detect and prevent secrets in code with pre-commit hooks, CI scanning,
  and remediation workflows. Use when hardening repositories against
  accidental credential exposure.
---

# Secret Scanning

Detect and prevent secrets in code with scanning and pre-commit hooks.

## When to Use

- Setting up secret detection for a repository
- Configuring pre-commit hooks to catch secrets before push
- Remediating leaked secrets
- Integrating secret scanning into CI/CD

---

## Pre-Commit Hook (gitleaks)

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

```bash
# Install and run
pip install pre-commit
pre-commit install
pre-commit run gitleaks --all-files
```

## GitHub Secret Scanning

```yaml
# Automatically enabled on public repos
# For private repos: Settings → Code security → Secret scanning → Enable

# Custom patterns
# Settings → Code security → Secret scanning → Custom patterns
# Pattern: "FROOTAI_[A-Za-z0-9]{32}"
```

## CI Integration

```yaml
name: Secret Scan
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## detect-secrets (Alternative)

```bash
pip install detect-secrets

# Create baseline (existing false positives)
detect-secrets scan --all-files > .secrets.baseline

# Scan for new secrets
detect-secrets scan --all-files --baseline .secrets.baseline
```

## Remediation Workflow

```markdown
## Secret Leak Remediation

1. **Revoke immediately** — Rotate the leaked credential
2. **Remove from history** — Use BFG or git-filter-repo
3. **Scan for usage** — Check if credential was exploited
4. **Prevent recurrence** — Add pre-commit hook + CI scan
5. **Document** — Log incident and remediation steps

```bash
# Remove secret from git history
git filter-repo --invert-paths --path-match "config/secrets.json"
# Force push (destructive — team must re-clone)
git push --force --all
```
```

## .gitignore Essentials

```
.env
.env.local
*.pem
*.key
**/secrets/*
**/credentials/*
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| False positive on test data | Test file contains fake keys | Add to .gitleaksignore |
| Pre-commit too slow | Scanning all files | Use --staged-only flag |
| Secret in git history | Committed before hook | Use git-filter-repo to rewrite history |
| Custom pattern not matching | Regex wrong | Test with gitleaks --config=custom.toml |
