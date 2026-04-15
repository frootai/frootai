---
name: fai-github-issue-triage
description: |
  Automate GitHub issue triage with AI-powered classification, priority assignment,
  labeling, and routing. Use when managing high-volume issue queues or setting up
  automated triage workflows.
---

# GitHub Issue Triage

Automate issue classification, prioritization, and routing with AI and GitHub CLI.

## When to Use

- Managing high-volume open-source or internal issue queues
- Automating label assignment and priority scoring
- Routing issues to the right team or individual
- Tracking triage SLAs and response times

---

## AI-Powered Classification

```python
from pydantic import BaseModel

class TriageResult(BaseModel):
    category: str  # bug, feature, question, docs, security
    priority: str  # P1-critical, P2-high, P3-medium, P4-low
    labels: list[str]
    assignee_team: str
    needs_reproduction: bool

def triage_issue(title: str, body: str) -> TriageResult:
    resp = client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": """Triage GitHub issues. Classify:
- category: bug/feature/question/docs/security
- priority: P1=outage, P2=degraded, P3=enhancement, P4=question
- labels: relevant labels from [bug, enhancement, question, documentation, security, good-first-issue]
- assignee_team: ai-platform/infra/frontend/docs
- needs_reproduction: true if bug without repro steps"""},
            {"role": "user", "content": f"Title: {title}\nBody: {body}"},
        ],
        response_format=TriageResult,
    )
    return resp.choices[0].message.parsed
```

## GitHub Actions Automation

```yaml
name: Auto-Triage Issues
on: { issues: { types: [opened] } }

permissions:
  issues: write

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Classify and label
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
        run: |
          TITLE="${{ github.event.issue.title }}"
          python scripts/triage.py --title "$TITLE" --number $ISSUE_NUMBER
```

## CLI-Based Triage

```bash
# List untriaged issues
gh issue list --label "" --state open --json number,title,createdAt \
  -q '.[] | select(.createdAt > (now - 86400 | todate))'

# Apply triage results
gh issue edit 42 --add-label "bug,P2-high,ai-platform" --add-assignee @team/ai
gh issue comment 42 --body "Triaged: P2 bug, assigned to AI Platform team."
```

## Triage SLA Dashboard

| Priority | Response Target | Resolution Target |
|----------|----------------|-------------------|
| P1 | 1 hour | 24 hours |
| P2 | 4 hours | 1 week |
| P3 | 1 business day | 2 weeks |
| P4 | 1 week | Best effort |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Wrong classification | Vague issue title/body | Ask for reproduction steps via template |
| Duplicate labels | Multiple triage runs | Check existing labels before adding |
| Stale issues piling up | No staleness policy | Add stale bot with 30-day warning |
| P1 not escalated | No alerting on P1 | Send Slack/Teams notification on P1 |
