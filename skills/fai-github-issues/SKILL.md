---
name: fai-github-issues
description: |
  Design GitHub issue workflows with templates, labels, milestones, and
  project board conventions. Use when standardizing issue management
  for engineering teams.
---

# GitHub Issue Workflows

Standardize issue creation, labeling, and tracking for engineering teams.

## When to Use

- Setting up issue templates for a new repository
- Standardizing label taxonomy across projects
- Configuring project boards for sprint tracking
- Creating issue conventions documentation

---

## Issue Templates

```yaml
# .github/ISSUE_TEMPLATE/bug_report.yml
name: Bug Report
description: Report a bug
labels: [bug, needs-triage]
body:
  - type: input
    id: summary
    attributes: { label: Summary, placeholder: "Brief description" }
    validations: { required: true }
  - type: textarea
    id: repro
    attributes: { label: Reproduction Steps, placeholder: "1. Go to...\n2. Click..." }
    validations: { required: true }
  - type: dropdown
    id: severity
    attributes:
      label: Severity
      options: [Critical - System down, High - Major feature broken, Medium - Feature degraded, Low - Cosmetic]
  - type: textarea
    id: expected
    attributes: { label: Expected Behavior }
  - type: textarea
    id: actual
    attributes: { label: Actual Behavior }
```

```yaml
# .github/ISSUE_TEMPLATE/feature_request.yml
name: Feature Request
description: Suggest an enhancement
labels: [enhancement, needs-triage]
body:
  - type: textarea
    id: problem
    attributes: { label: Problem Statement, placeholder: "As a user, I want..." }
    validations: { required: true }
  - type: textarea
    id: solution
    attributes: { label: Proposed Solution }
  - type: textarea
    id: alternatives
    attributes: { label: Alternatives Considered }
```

## Label Taxonomy

| Category | Labels | Color |
|----------|--------|-------|
| Type | bug, enhancement, question, docs | Red, Green, Purple, Blue |
| Priority | P1-critical, P2-high, P3-medium, P4-low | Red, Orange, Yellow, Gray |
| Status | needs-triage, in-progress, blocked, ready-for-review | White, Blue, Red, Green |
| Area | ai-platform, infra, frontend, api | Various |

```bash
# Create labels via CLI
gh label create "P1-critical" --color "B60205" --description "System down"
gh label create "P2-high" --color "D93F0B" --description "Major feature broken"
gh label create "P3-medium" --color "FBCA04" --description "Feature degraded"
```

## Milestones for Sprint Tracking

```bash
gh api repos/{owner}/{repo}/milestones -f title="Sprint 12" \
  -f due_on="2026-04-30T00:00:00Z" -f description="RAG pipeline improvements"
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Issues without labels | No auto-triage | Add triage workflow or require labels |
| Stale issues | No cleanup policy | Configure stale bot |
| Duplicate issues | No search before create | Add issue search link to template |
| No velocity tracking | Issues not in milestones | Assign all issues to sprint milestone |

