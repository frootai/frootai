---
name: fai-gh-cli
description: |
  Automate GitHub workflows with the gh CLI for issues, PRs, releases,
  and repository management. Use when scripting GitHub operations in
  CI/CD pipelines or developer workflows.
---

# GitHub CLI Automation

Automate GitHub operations with gh CLI for issues, PRs, releases, and repos.

## When to Use

- Scripting GitHub operations in CI/CD
- Automating issue triage and labeling
- Creating releases with changelogs
- Managing PRs programmatically

---

## Issue Management

```bash
# Create issue
gh issue create --title "Bug: Search returns stale results" \
  --body "After reindexing, old results appear for 5 minutes" \
  --label bug,search --assignee @me

# List open bugs
gh issue list --label bug --state open --json number,title,assignees -q '.[] | "\(.number): \(.title)"'

# Close with comment
gh issue close 42 --comment "Fixed in PR #45"

# Bulk label
gh issue list --label needs-triage --json number -q '.[].number' | \
  xargs -I{} gh issue edit {} --add-label triaged --remove-label needs-triage
```

## PR Workflow

```bash
# Create PR from current branch
gh pr create --title "feat: Add hybrid search" \
  --body "Implements BM25+vector hybrid search" \
  --reviewer team/ai-platform

# Review PR
gh pr review 45 --approve --body "LGTM - tested locally"

# Merge with squash
gh pr merge 45 --squash --delete-branch

# Check CI status
gh pr checks 45 --watch
```

## Release Automation

```bash
# Create release with auto-generated notes
gh release create v2.1.0 --generate-notes --title "v2.1.0"

# Create release with specific notes
gh release create v2.1.0 --notes-file CHANGELOG.md

# Upload assets to release
gh release upload v2.1.0 dist/*.zip
```

## Scripting Patterns

```bash
# Find stale PRs (>7 days without review)
gh pr list --json number,title,createdAt,reviewDecision \
  -q '[.[] | select(.createdAt < (now - 604800 | todate) and .reviewDecision == "")]'

# Close stale issues
gh issue list --state open --json number,updatedAt \
  -q '[.[] | select(.updatedAt < "2026-01-01")] | .[].number' | \
  xargs -I{} gh issue close {} --comment "Closing as stale"
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Auth failed | Token expired | Run `gh auth login` |
| Rate limited | Too many API calls | Add sleeps between bulk operations |
| Wrong repo context | Not in repo directory | Use `--repo owner/repo` flag |
| JSON query fails | Wrong jq syntax | Test with `gh ... --json field | jq '.'` |

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
