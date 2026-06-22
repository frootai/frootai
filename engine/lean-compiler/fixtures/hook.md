---
name: pre-commit-hook
event: pre-commit
---

# Pre-commit Hook



It is important to note that this hook runs before every commit in order to
catch problems early. It is essentially a safety net.

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
