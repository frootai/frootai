---
name: fai-git-flow-branch
description: |
  Define Git branching strategy with clear promotion paths, protected branches,
  and merge policies. Use when standardizing branch workflow for teams using
  GitHub Flow, Git Flow, or trunk-based development.
---

# Git Branching Strategy

Define branch conventions, promotion paths, and merge policies.

## When to Use

- Setting up branching for a new team or project
- Migrating from Git Flow to trunk-based (or vice versa)
- Configuring branch protection rules
- Documenting release promotion workflow

---

## Strategy Comparison

| Strategy | Branches | Best For |
|----------|---------|----------|
| GitHub Flow | main + feature | Small teams, continuous deploy |
| Git Flow | main + develop + feature + release | Versioned releases |
| Trunk-Based | main + short-lived feature | CI/CD-mature teams |

## GitHub Flow (Recommended for AI Projects)

```
main ─────────────────────────────────────►
      ├── feature/add-hybrid-search ──► PR → merge
      ├── fix/auth-token-expiry ──► PR → merge
      └── feature/eval-pipeline ──► PR → merge
```

```bash
# Feature branch workflow
git checkout -b feature/add-hybrid-search
# ... work ...
git push origin feature/add-hybrid-search
gh pr create --title "feat(search): add hybrid search" --base main
# After review + CI pass → squash merge → delete branch
```

## Branch Protection

```json
{
  "branch": "main",
  "rules": {
    "require_pull_request": true,
    "required_reviewers": 1,
    "require_status_checks": ["CI", "CodeQL"],
    "require_conversation_resolution": true,
    "require_linear_history": true,
    "restrict_pushes": true,
    "allow_force_push": false,
    "allow_deletion": false
  }
}
```

```bash
# Configure via gh CLI
gh api repos/{owner}/{repo}/branches/main/protection -X PUT \
  -f required_status_checks='{"strict":true,"contexts":["CI"]}' \
  -f required_pull_request_reviews='{"required_approving_review_count":1}' \
  -F enforce_admins=true
```

## Release Workflow

```bash
# Tag and release from main
git tag -a v2.1.0 -m "Release v2.1.0"
git push origin v2.1.0
gh release create v2.1.0 --generate-notes
```

## Naming Convention

| Branch Type | Pattern | Example |
|------------|---------|---------|
| Feature | feature/{desc} | feature/add-eval-pipeline |
| Bug fix | fix/{desc} | fix/search-timeout |
| Hotfix | hotfix/{desc} | hotfix/critical-auth-bypass |
| Release | release/v{x.y.z} | release/v2.1.0 |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Merge conflicts | Long-lived branches | Keep branches short (<3 days) |
| Broken main | No CI gate | Require status checks on main |
| Force push to main | No protection rules | Enable branch protection |
| Stale branches | No cleanup | Delete branch after merge, prune monthly |

