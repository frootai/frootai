---
name: fai-daily-prep
description: |
  Prepare a daily engineering execution brief with priorities, blockers,
  and delivery checkpoints. Use when starting a work day or planning
  sprint execution with an AI-powered daily standup assistant.
---

# Daily Engineering Prep

Generate a daily execution brief with priorities, blockers, and checkpoints.

## When to Use

- Starting the engineering work day
- Preparing for daily standup
- Tracking sprint progress against commitments
- Identifying blockers before they cause delays

---

## Daily Brief Template

```markdown
## Daily Brief — [Date]

### Top 3 Priorities
1. [Most important deliverable] — ETA: [time]
2. [Second priority] — ETA: [time]
3. [Third priority] — ETA: [time]

### Blockers
- [ ] [Blocker description] — Owner: [name] — Escalation: [path]

### Yesterday Completed
- [x] [Task 1]
- [x] [Task 2]

### Checkpoints
- [ ] 11:00 — [Checkpoint 1: what should be done by then]
- [ ] 15:00 — [Checkpoint 2: end-of-day target]

### Notes
- [Context, decisions, risks]
```

## Auto-Generation from Git + Issues

```python
import subprocess, json
from datetime import datetime, timedelta

def generate_brief():
    # Yesterday's commits
    since = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    commits = subprocess.check_output(
        ["git", "log", f"--since={since}", "--pretty=%s"], text=True
    ).strip().split("\n")

    # Open issues assigned to me
    issues = subprocess.check_output(
        ["gh", "issue", "list", "--assignee=@me", "--state=open", "--json=title,labels"],
        text=True
    )
    open_issues = json.loads(issues)
    blockers = [i for i in open_issues if any(l["name"] == "blocker" for l in i["labels"])]

    return {
        "completed": commits,
        "priorities": [i["title"] for i in open_issues[:3]],
        "blockers": [b["title"] for b in blockers],
    }
```

## Sprint Progress Check

```python
def sprint_health(total_points: int, completed_points: int,
                   days_elapsed: int, sprint_days: int) -> dict:
    expected = total_points * (days_elapsed / sprint_days)
    velocity = completed_points / max(days_elapsed, 1)
    projected = velocity * sprint_days
    return {
        "on_track": completed_points >= expected * 0.9,
        "completion_pct": round(completed_points / total_points * 100, 1),
        "projected_completion": round(projected / total_points * 100, 1),
    }
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Brief feels empty | No commits yesterday | Include PR reviews and design work |
| Too many priorities | Not ruthless enough | Force rank to top 3, defer rest |
| Blockers not escalated | No escalation path | Define owner + escalation for each |

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
