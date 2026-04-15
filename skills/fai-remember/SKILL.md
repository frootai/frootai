---
name: fai-remember
description: |
  Manage persistent memory and context notes across coding sessions with
  organized file-based storage. Use when saving preferences, patterns,
  project-specific knowledge, or session state for AI assistants.
---

# Memory Management

Save and organize persistent notes for AI assistants across sessions.

## When to Use

- Saving coding preferences and patterns
- Recording project-specific conventions
- Tracking task progress across sessions
- Storing debug findings for future reference

---

## Memory Organization

```
/memories/
├── preferences.md       # User coding style, tools, conventions
├── patterns.md          # Reusable solutions to common problems
├── debugging.md         # Past debugging insights
└── session/
    ├── current-task.md  # Active task context
    └── findings.md      # Session-specific discoveries
```

## What to Remember

| Category | Examples |
|----------|---------|
| Preferences | "Always use Managed Identity, never connection strings" |
| Patterns | "Use circuit breaker for all external API calls" |
| Project context | "This repo uses FastAPI + Cosmos DB + AI Search" |
| Debugging | "Port 3000 conflict: kill serve process before restart" |
| Conventions | "Commit format: feat(scope): description" |

## When to Save

- After discovering a non-obvious fix
- When a user states a preference
- After completing a complex task (lessons learned)
- When project conventions are established

## Memory Best Practices

| Practice | Why |
|----------|-----|
| Keep entries concise | Memory is loaded into context — brief = efficient |
| Organize by topic | Separate files for preferences, patterns, debugging |
| Update, don't duplicate | Edit existing entries instead of adding new ones |
| Delete when obsolete | Remove outdated information |
| Session memory for temp | Use session/ for task-specific, non-persistent notes |

## Example Entries

```markdown
# preferences.md
- Use Python 3.11+ with type hints
- Prefer FastAPI over Flask for new APIs
- Always use DefaultAzureCredential, never hardcode keys
- Use ruff for linting (not flake8)
- Commit messages follow conventional commits

# debugging.md
- PowerShell here-strings corrupt markdown backticks — use Node.js for file gen
- Azure OpenAI 403: check MI role assignment, wait 5 min for propagation
- Next.js dev server holds 2-3GB RAM — use `npx serve out` for preview
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Memory too large | Too many entries | Prune old/obsolete entries |
| Duplicate entries | Not checking existing | Read memory before writing |
| Wrong scope | Session note saved globally | Use session/ for temporary context |
| Stale information | Never updated | Review and update regularly |

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
