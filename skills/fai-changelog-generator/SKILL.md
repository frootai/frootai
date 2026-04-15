---
name: fai-changelog-generator
description: |
  Generate structured changelogs from commits and PRs with semantic grouping,
  breaking change detection, and release notes formatting. Use when automating
  release documentation or maintaining CHANGELOG.md.
---

# Changelog Generator

Automate changelog creation from git history with semantic grouping.

## When to Use

- Automating CHANGELOG.md updates on release
- Grouping changes by type (feat, fix, breaking)
- Detecting breaking changes from commit messages
- Generating release notes for GitHub Releases

---

## Conventional Commits Parsing

```python
import re, subprocess

TYPES = {"feat": "Features", "fix": "Bug Fixes", "perf": "Performance",
         "docs": "Documentation", "chore": "Maintenance"}

def parse_commits(since_tag: str) -> list[dict]:
    log = subprocess.check_output(
        ["git", "log", f"{since_tag}..HEAD", "--pretty=%H|%s"], text=True)
    commits = []
    for line in log.strip().split("\n"):
        if not line: continue
        sha, msg = line.split("|", 1)
        match = re.match(r"(\w+)(?:\((.+)\))?(!)?:\s*(.+)", msg)
        if match:
            commits.append({"sha": sha[:8], "type": match.group(1),
                "scope": match.group(2), "breaking": bool(match.group(3)),
                "message": match.group(4)})
    return commits

def generate_changelog(commits: list[dict], version: str) -> str:
    sections = {}
    for c in commits:
        header = TYPES.get(c["type"], "Other")
        sections.setdefault(header, []).append(c)
    lines = [f"## {version}\n"]
    for header, items in sections.items():
        lines.append(f"### {header}\n")
        for c in items:
            prefix = "**BREAKING** " if c["breaking"] else ""
            scope = f"**{c['scope']}:** " if c["scope"] else ""
            lines.append(f"- {prefix}{scope}{c['message']} ({c['sha']})")
    return "\n".join(lines)
```

## CI Integration

```bash
# Generate and prepend to CHANGELOG.md
python changelog.py --since v2.0.0 --version v2.1.0 >> CHANGELOG.md
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Empty changelog | No conventional commits | Enforce commitlint in CI |
| Missing breaking changes | No `!` marker | Add breaking change detection for `BREAKING CHANGE:` footer |
| Wrong grouping | Non-standard commit types | Map custom types in TYPES dict |

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
- `fai-git-commit-best-practices` — Conventional commit format
- `fai-rollout-plan` — Release planning and communication

## Definition of Done

The changelog is complete when all conventional commits are grouped by type, breaking changes are flagged, and the output matches the project's CHANGELOG.md format.
