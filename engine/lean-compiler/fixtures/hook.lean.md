---
name: pre-commit-hook
event: pre-commit
---

# Pre-commit Hook

This hook runs before every commit to
catch problems early. It is a safety net.

You MUST never allow a commit when the lint step fails.

## Configuration

Set the `HOOK_TIMEOUT` environment variable to bound the run.

```json
{
  "event": "pre-commit",

  "command": "npm run lint"
}
```

- Run the linter.
- Run the linter.
- Block the commit when the linter reports an error.
