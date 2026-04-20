---
sidebar_position: 4
title: Create a Hook
description: Build a security hook with hooks.json configuration and a script triggered at session lifecycle events.
---

# Create a Hook

Build an automated guardrail triggered by Copilot session lifecycle events — scanning for secrets, blocking dangerous commands, or enforcing governance.

## Prerequisites

- FrootAI repo cloned
- Node.js 22+
- Bash (for hook scripts)

## Step 1: Create the Hook Folder

```bash
HOOK_NAME="fai-my-security-hook"
mkdir -p hooks/${HOOK_NAME}
```

## Step 2: Create hooks.json

```json title="hooks/fai-my-security-hook/hooks.json"
{
  "version": 1,
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "bash": "./hooks/fai-my-security-hook/check.sh",
        "cwd": ".",
        "env": {
          "HOOK_MODE": "warn"
        },
        "timeoutSec": 10
      }
    ]
  }
}
```

:::warning Avoid PreToolUse
`PreToolUse` hooks fire on **every tool call**, adding ~5 seconds of delay each time. Use `SessionStart` for upfront checks instead. Only use `PreToolUse` for critical security audits.
:::

## Step 3: Write the Hook Script

```bash title="hooks/fai-my-security-hook/check.sh"
#!/usr/bin/env bash
set -euo pipefail

MODE="${HOOK_MODE:-warn}"
FINDINGS=0

# Scan for common secret patterns
PATTERNS=(
  "AKIA[0-9A-Z]{16}"
  "sk-[a-zA-Z0-9]{48}"
  "ghp_[a-zA-Z0-9]{36}"
)

for pattern in "${PATTERNS[@]}"; do
  if grep -rqE "$pattern" --include="*.py" --include="*.js" .; then
    echo "🚨 Secret pattern detected: $pattern"
    FINDINGS=$((FINDINGS + 1))
  fi
done

if [ "$FINDINGS" -gt 0 ]; then
  if [ "$MODE" = "block" ]; then
    echo "❌ Blocked: $FINDINGS secret(s) found"
    exit 1
  fi
  echo "⚠️ Warning: $FINDINGS potential secret(s)"
fi

echo "✅ Security check passed"
exit 0
```

Make it executable:
```bash
chmod +x hooks/${HOOK_NAME}/check.sh
```

## Step 4: Available Events Reference

| Event | Input | Timeout | Use Case |
|-------|-------|---------|----------|
| `SessionStart` | Empty stdin | 5s | Config loading, prerequisites |
| `UserPromptSubmit` | User prompt on stdin | 10s | PII detection, governance |
| `PreToolUse` | `{"toolName":"...","toolInput":"..."}` | 10s | Block dangerous commands |
| `PostToolUse` | Tool output on stdin | 10s | Validate tool results |
| `PreCompact` | Context on stdin | 5s | Save critical context |
| `SubagentStart` | Agent metadata on stdin | 5s | Track delegation |
| `SubagentStop` | Agent output on stdin | 5s | Validate sub-agent output |
| `Stop` | Session metadata on stdin | 30s | Secrets scan, audit log |

## Step 5: Wire into a Manifest

```json title="fai-manifest.json"
{
  "primitives": {
    "hooks": ["../../hooks/fai-my-security-hook/"]
  }
}
```

## Step 6: Validate

```bash
npm run validate:primitives

# Test the script manually
echo '{"toolName":"test","toolInput":"hello"}' | bash hooks/${HOOK_NAME}/check.sh
```

## Best Practices

1. **Always set a timeout** — hooks should not hang the session
2. **Support warn and block modes** — let users choose via `HOOK_MODE`
3. **Exit 0 for pass, exit 1 for block** — standard convention
4. **Log clearly** — use emoji prefixes (🚨 ⚠️ ✅)
5. **Prefer SessionStart** — run expensive checks once, not per tool call

## See Also

- [Hooks Reference](/primitives/hooks) — full hook specification
- [Error Handling](/guides/error-handling) — error patterns for hooks
